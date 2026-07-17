import {
  DEFAULT_NAVIGATOR20_PATHS,
  IdmWebAuthenticationError,
  IdmWebConnectionError,
  IdmWebCsrfError,
  IdmWebData,
  IdmWebDiagnostics,
  IdmWebPinRejectedError,
  IdmWebResponseError,
  extractCsrfToken,
  formatUrlHost,
  looksLikeAuthFailure,
  looksLikeDataResponse,
  looksLikeLoginPage,
  parseIdmHtmlTableValues,
  type IdmWebValue,
} from "./core.js";

export interface Navigator20Response {
  readonly status: number;
  readonly text: string;
  readonly setCookies?: readonly string[];
}
export interface Navigator20Request {
  readonly method: "GET" | "POST";
  readonly url: string;
  readonly data?: Readonly<Record<string, string>>;
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
    let body: URLSearchParams | undefined;
    if (request.data !== undefined) {
      body = new URLSearchParams(request.data);
      headers["content-type"] = "application/x-www-form-urlencoded";
    }
    const response = await fetch(request.url, {
      method: request.method,
      headers,
      ...(body === undefined ? {} : { body }),
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
    const selected = paths.filter((path) => this.#dataPaths.includes(path));
    const selectedPaths = selected.length > 0 ? selected : this.#dataPaths;
    try {
      for (const path of selectedPaths) {
        let text: string | undefined = useProbeResponses
          ? this.#probeResponses.get(path)
          : undefined;
        this.#probeResponses.delete(path);
        try {
          text ??= await this.#requestText("GET", path);
        } catch (error) {
          if (!(error instanceof IdmWebCsrfError) || csrfRetried) throw error;
          this.#csrfToken = null;
          await this.login();
          csrfRetried = true;
          useProbeResponses = true;
          text = this.#probeResponses.get(path);
          this.#probeResponses.delete(path);
          text ??= await this.#requestText("GET", path);
        }
        if (text.toLowerCase().includes("invalid csrf token")) {
          this.#csrfToken = null;
          throw new IdmWebCsrfError("Navigator 2.0 CSRF token was rejected");
        }
        if (looksLikeAuthFailure(text) || looksLikeLoginPage(text))
          throw new IdmWebAuthenticationError(
            `NAV2 endpoint ${path} returned an authentication response instead of data`,
          );
        if (options.includeRaw === true) rawResponses[path] = text;
        Object.assign(values, parseIdmHtmlTableValues(text));
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
    for (const path of ["/", "/index.php", "/login.php"]) {
      for (const fieldName of ["pin", "PIN", "password", "pass"]) {
        let text: string;
        try {
          text = await this.#requestText("POST", path, { [fieldName]: this.#pin }, false, false);
        } catch {
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
      } catch {
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
