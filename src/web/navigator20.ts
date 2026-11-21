import {
  DEFAULT_NAVIGATOR20_PATHS,
  IdmWebAuthenticationError,
  IdmWebConnectionError,
  IdmWebCsrfError,
  IdmWebData,
  IdmWebDiagnostics,
  IdmWebError,
  IdmWebPinRejectedError,
  IdmWebResponseError,
  IdmWebTimeoutError,
  extractCsrfToken,
  formatUrlHost,
  looksLikeAuthFailure,
  looksLikeDataResponse,
  looksLikeLoginPage,
  parseNavigator20Response,
  parseNavigator20StatisticsResponse,
  type IdmWebValue,
} from "./core.js";

// Navigator 2.0 statistics pages: one URL per statistics type (runtime,
// generated heat, electrical energy consumption). The pages answer with JSON
// carrying a unitTotal scale and a localized category list.
const NAVIGATOR20_STATISTICS_PATHS: readonly (readonly [string, string])[] = Object.freeze([
  ["runtime", "/data/statistics.php?type=heatpump"],
  ["genheat", "/data/statistics.php?type=amountofheat"],
  ["elcons", "/data/statistics.php?type=baenergyhp"],
] as const);

export interface Navigator20Response {
  readonly status: number;
  readonly text: string;
  readonly setCookies?: readonly string[];
}
export interface Navigator20Request {
  readonly method: "GET" | "POST" | "PUT";
  readonly url: string;
  readonly data?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly timeout: number;
}
export interface Navigator20Session {
  request(request: Navigator20Request): Promise<Navigator20Response>;
  close?(): Promise<void>;
}

class FetchNavigator20Session implements Navigator20Session {
  readonly #cookies = new Map<string, string>();

  async request(request: Navigator20Request): Promise<Navigator20Response> {
    const headers: Record<string, string> = { ...request.headers };
    if (this.#cookies.size > 0)
      headers.cookie = [...this.#cookies].map(([name, value]) => `${name}=${value}`).join("; ");
    let formBody: URLSearchParams | undefined;
    if (request.data !== undefined) {
      formBody = new URLSearchParams(request.data);
      headers["content-type"] = "application/x-www-form-urlencoded";
    }
    if (request.body !== undefined && headers["content-type"] === undefined)
      headers["content-type"] = "application/json";
    const response = await fetch(request.url, {
      method: request.method,
      headers,
      ...(formBody === undefined && request.body === undefined
        ? {}
        : { body: formBody ?? request.body }),
      signal: AbortSignal.timeout(request.timeout * 1000),
      redirect: "manual",
    });
    const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] })
      .getSetCookie;
    const setCookies =
      typeof getSetCookie === "function"
        ? getSetCookie.call(response.headers)
        : response.headers.get("set-cookie") === null
          ? []
          : [response.headers.get("set-cookie") as string];
    for (const cookie of setCookies) {
      const pair = cookie.split(";", 1)[0] ?? "";
      const separator = pair.indexOf("=");
      if (separator > 0) this.#cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    return { status: response.status, text: await response.text(), setCookies };
  }
}

export interface IdmNavigator20WebClientOptions {
  readonly timeout?: number;
  readonly session?: Navigator20Session;
  readonly now?: () => number;
}

export class IdmNavigator20WebClient {
  readonly modelName = "Navigator 2.0";
  readonly #urlHost: string;
  readonly #pin: string;
  readonly #timeout: number;
  readonly #session: Navigator20Session;
  readonly #ownSession: boolean;
  readonly #now: () => number;
  #csrfToken: string | null = null;
  #dataPaths: readonly string[] = Object.freeze([]);
  #probeResponses = new Map<string, string>();
  #loginFormReturned = false;
  #authError: IdmWebAuthenticationError | null = null;
  #lastSuccessMonotonic: number | null = null;
  #lastError: string | null = null;
  #cachedData: IdmWebData | null = null;
  #queue: Promise<void> = Promise.resolve();

  constructor(host: string, pin: string, options: IdmNavigator20WebClientOptions = {}) {
    if (!pin) throw new TypeError("PIN must not be empty");
    this.#urlHost = formatUrlHost(host);
    this.#pin = pin;
    this.#timeout = options.timeout ?? 8;
    if (!Number.isFinite(this.#timeout) || this.#timeout < 0)
      throw new TypeError("timeout must be finite and >= 0");
    this.#session = options.session ?? new FetchNavigator20Session();
    this.#ownSession = options.session === undefined;
    this.#now = options.now ?? (() => performance.now() / 1000);
  }

  async #exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.#queue;
    let release!: () => void;
    this.#queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async connect(): Promise<void> {
    await this.login();
  }

  async detect(): Promise<boolean> {
    try {
      await this.login();
      return this.#dataPaths.length > 0;
    } catch {
      return false;
    }
  }

  async login(): Promise<void> {
    await this.#exclusive(async () => {
      try {
        const initial = await this.#initialGet();
        this.#csrfToken = extractCsrfToken(initial);
        await this.#tryLogin();
        this.#probeResponses.clear();
        const paths = await this.#probeDataEndpoints(DEFAULT_NAVIGATOR20_PATHS);
        if (paths.length === 0) {
          if (this.#authError !== null) {
            // A firmware that answers with HTTP 401/403 already named the
            // cause; do not downgrade it to "detection failed" or to the
            // generic login-form message.
            this.#lastError = this.#authError.message;
            throw this.#authError;
          }
          if (this.#loginFormReturned)
            throw new IdmWebAuthenticationError(
              "NAV2 web login failed: PIN rejected or login form returned again",
            );
          throw new IdmWebResponseError(
            `NAV2 web detection failed after trying ${DEFAULT_NAVIGATOR20_PATHS.length} endpoint candidates`,
          );
        }
        this.#dataPaths = Object.freeze(paths);
        this.#lastSuccessMonotonic = this.#now();
        this.#lastError = null;
      } catch (error) {
        await this.#closeUnlocked();
        throw error;
      }
    });
  }

  async close(): Promise<void> {
    await this.#exclusive(async () => await this.#closeUnlocked());
  }

  async #closeUnlocked(): Promise<void> {
    this.#csrfToken = null;
    this.#dataPaths = Object.freeze([]);
    this.#probeResponses.clear();
    this.#loginFormReturned = false;
    this.#authError = null;
    if (this.#ownSession && this.#session.close !== undefined) {
      try {
        await this.#session.close();
      } catch {
        // Close is best effort.
      }
    }
  }

  async readData(
    paths: readonly string[] = DEFAULT_NAVIGATOR20_PATHS,
    options: { readonly includeRaw?: boolean } = {},
  ): Promise<IdmWebData> {
    let useProbeResponses = false;
    if (this.#dataPaths.length === 0) {
      await this.login();
      useProbeResponses = true;
    } else {
      this.#probeResponses.clear();
    }
    const values: Record<string, IdmWebValue> = Object.create(null);
    const rawResponses: Record<string, string> = Object.create(null);
    let csrfRetried = false;
    let authRetried = false;
    // Caller may pass a subset of paths; intersect with the endpoints that
    // were confirmed during login. Fall back to all confirmed endpoints when
    // the caller's subset does not overlap the detected paths.
    const selected = paths.filter((path) => this.#dataPaths.includes(path));
    const selectedPaths = selected.length > 0 ? selected : this.#dataPaths;
    try {
      for (const path of selectedPaths) {
        let text: string | undefined;
        for (;;) {
          try {
            text = useProbeResponses ? this.#probeResponses.get(path) : undefined;
            if (text !== undefined) this.#probeResponses.delete(path);
            text ??= await this.#requestText("GET", path);
          } catch (error) {
            if (!(error instanceof IdmWebCsrfError) || csrfRetried) throw error;
            this.#csrfToken = null;
            await this.login();
            csrfRetried = true;
            useProbeResponses = true;
            continue;
          }
          if (text.toLowerCase().includes("invalid csrf token")) {
            this.#csrfToken = null;
            throw new IdmWebCsrfError("Navigator 2.0 CSRF token was rejected");
          }
          if (looksLikeAuthFailure(text) || looksLikeLoginPage(text)) {
            if (authRetried)
              throw new IdmWebAuthenticationError(
                `NAV2 endpoint ${path} returned an authentication response instead of data`,
              );
            // The session cookie expired or the controller rebooted: the
            // endpoint serves its login page again. Log in once more instead
            // of reporting a rejected PIN on every poll until the consumer
            // restarts.
            this.#dataPaths = Object.freeze([]);
            this.#csrfToken = null;
            await this.login();
            authRetried = true;
            useProbeResponses = true;
            continue;
          }
          break;
        }
        if (options.includeRaw === true) rawResponses[path] = text;
        Object.assign(values, parseNavigator20Response(text));
      }
    } finally {
      this.#probeResponses.clear();
    }
    const data = IdmWebData.create({ model: "Navigator 2.0 Web", values, rawResponses });
    this.#cachedData = data;
    this.#lastSuccessMonotonic = this.#now();
    return data;
  }

  async readExtraData(): Promise<Readonly<Record<string, string>>> {
    return (await this.readData()).simpleValues;
  }

  async readStatistics(options: { readonly includeRaw?: boolean } = {}): Promise<IdmWebData> {
    if (this.#dataPaths.length === 0) await this.login();
    const values: Record<string, IdmWebValue> = Object.create(null);
    const rawResponses: Record<string, string> = Object.create(null);
    let answered = 0;
    let authRetried = false;
    for (const [statType, path] of NAVIGATOR20_STATISTICS_PATHS) {
      let raw: string;
      try {
        for (;;) {
          try {
            raw = await this.#requestText("GET", path);
            if (looksLikeAuthFailure(raw) || looksLikeLoginPage(raw))
              throw new IdmWebAuthenticationError(
                "Navigator 2.0 statistics returned a login response",
              );
            break;
          } catch (error) {
            if (!(error instanceof IdmWebAuthenticationError) || authRetried) throw error;
            authRetried = true;
            await this.login();
          }
        }
      } catch (error) {
        if (error instanceof IdmWebAuthenticationError) throw error;
        if (error instanceof IdmWebError) continue;
        throw error;
      }
      answered += 1;
      if (options.includeRaw === true) rawResponses[path] = raw;
      try {
        Object.assign(values, parseNavigator20StatisticsResponse(raw, statType));
      } catch (error) {
        if (!(error instanceof IdmWebResponseError)) throw error;
      }
    }
    if (answered === 0)
      throw new IdmWebResponseError("Navigator 2.0 answered none of the statistics pages");
    const data = IdmWebData.create({ model: "Navigator 2.0 Web", values, rawResponses });
    this.#lastSuccessMonotonic = this.#now();
    return data;
  }

  async setDatetime(value: Date): Promise<void> {
    if (!(value instanceof Date) || Number.isNaN(value.getTime()))
      throw new TypeError("value must be a datetime");
    await this.login();
    const payload =
      `{"edesc":"_SETDATETIME","id":"SSETDATETIME","index":3,` +
      `"name":"Date/time","type":"setdt","value":"${value.toISOString()}"}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    };
    if (this.#csrfToken !== null) {
      headers["CSRF-Token"] = this.#csrfToken;
      headers["X-CSRF-Token"] = this.#csrfToken;
    }
    let text: string;
    let status: number;
    try {
      const response = await this.#session.request({
        method: "PUT",
        url: `http://${this.#urlHost}/index.php`,
        body: payload,
        headers,
        timeout: this.#timeout,
      });
      text = response.text;
      status = response.status;
    } catch (error) {
      if (error instanceof IdmWebError) throw error;
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"))
        throw new IdmWebTimeoutError("Navigator 2.0 clock setting timed out", { cause: error });
      throw new IdmWebConnectionError(
        `Navigator 2.0 clock setting failed: ${error instanceof Error ? error.name : "Error"}`,
        { cause: error },
      );
    }
    if (status === 401 || status === 403)
      throw new IdmWebPinRejectedError("Navigator 2.0 rejected the PIN or session");
    if (text.toLowerCase().includes("invalid csrf token"))
      throw new IdmWebCsrfError("Navigator 2.0 CSRF token was rejected");
    if (status !== 200)
      throw new IdmWebResponseError(`Navigator 2.0 clock setting returned HTTP ${status}`);
    this.#lastSuccessMonotonic = this.#now();
  }

  getCachedData(): IdmWebData | null {
    return this.#cachedData;
  }

  capabilities(): Readonly<Record<string, boolean>> {
    const pathText = this.#dataPaths.join(" ").toLowerCase();
    const names = Object.keys(this.#cachedData?.values ?? {});
    return Object.freeze({
      web_data: this.#dataPaths.length > 0,
      settings: this.#dataPaths.includes("/data/settings.php"),
      heatpump: this.#dataPaths.includes("/data/heatpump.php"),
      rooms: pathText.includes("rooms") || names.some((name) => name.includes("room")),
      zones: pathText.includes("zones") || names.some((name) => name.includes("zone")),
      pv: names.some((name) => name.includes("pv")),
      smart_grid: names.some((name) => name.includes("smart_grid")),
    });
  }

  diagnostics(): IdmWebDiagnostics {
    return IdmWebDiagnostics.create({
      navigatorType: "nav2",
      websocketConnected: false,
      webDataEnabled: this.#dataPaths.length > 0,
      lastSuccessMonotonic: this.#lastSuccessMonotonic,
      lastError: this.#lastError,
      usedEndpoints: this.#dataPaths,
      cached: this.#cachedData !== null,
    });
  }

  async #initialGet(): Promise<string> {
    const errors: string[] = [];
    for (const path of ["/", "/index.php"]) {
      try {
        return await this.#requestText("GET", path, undefined, true, false);
      } catch (error) {
        errors.push(`${path}: ${error instanceof Error ? error.name : "Error"}`);
      }
    }
    this.#lastError = `Navigator 2.0 HTTP interface was not reachable: ${errors.join(", ")}`;
    throw new IdmWebConnectionError(this.#lastError);
  }

  async #tryLogin(): Promise<void> {
    this.#loginFormReturned = false;
    this.#authError = null;
    for (const path of ["/", "/index.php", "/login.php"]) {
      for (const fieldName of ["pin", "PIN", "password", "pass"]) {
        let text: string;
        try {
          text = await this.#requestText("POST", path, { [fieldName]: this.#pin }, false, false);
        } catch (error) {
          if (error instanceof IdmWebAuthenticationError) {
            // HTTP 401/403: the device named the cause. Remember it so
            // login() can raise it instead of a generic detection error.
            this.#loginFormReturned = true;
            this.#authError = error;
          }
          continue;
        }
        if (text.toLowerCase().includes("authorization required")) {
          this.#loginFormReturned = true;
          continue;
        }
        this.#csrfToken = extractCsrfToken(text) ?? this.#csrfToken;
        if (!text.trim()) continue;
        if (looksLikeLoginPage(text)) {
          this.#loginFormReturned = true;
          break;
        }
        this.#loginFormReturned = false;
        return;
      }
    }
  }

  async #probeDataEndpoints(paths: readonly string[]): Promise<string[]> {
    const usable: string[] = [];
    for (const path of paths) {
      let text: string;
      try {
        text = await this.#requestText("GET", path, undefined, false);
      } catch (error) {
        if (error instanceof IdmWebAuthenticationError) {
          this.#loginFormReturned = true;
          this.#authError = error;
        }
        continue;
      }
      if (looksLikeDataResponse(text)) {
        usable.push(path);
        this.#probeResponses.set(path, text);
      } else if (looksLikeAuthFailure(text) || looksLikeLoginPage(text)) {
        this.#loginFormReturned = true;
      }
    }
    return usable;
  }

  async #requestText(
    method: "GET" | "POST",
    path: string,
    data?: Readonly<Record<string, string>>,
    requireOk = true,
    includeCsrf = true,
  ): Promise<string> {
    const headers: Record<string, string> = { "X-Requested-With": "XMLHttpRequest" };
    if (includeCsrf && this.#csrfToken !== null) {
      headers["CSRF-Token"] = this.#csrfToken;
      headers["X-CSRF-Token"] = this.#csrfToken;
      headers["X-CSRFToken"] = this.#csrfToken;
    }
    const response = await this.#session.request({
      method,
      url: `http://${this.#urlHost}${path}`,
      ...(data === undefined ? {} : { data }),
      headers,
      timeout: this.#timeout,
    });
    if (response.status === 401 || response.status === 403)
      throw new IdmWebPinRejectedError("Navigator 2.0 rejected the PIN or session");
    if (response.text.toLowerCase().includes("invalid csrf token"))
      throw new IdmWebCsrfError("Navigator 2.0 CSRF token was rejected");
    if (requireOk && response.status !== 200)
      throw new IdmWebResponseError(`Navigator 2.0 ${path} returned HTTP ${response.status}`);
    return response.text;
  }
}
