import {
  DEFAULT_NAVIGATOR10_PORT,
  DEFAULT_NAVIGATOR10_REQUEST_DELAY,
  DEFAULT_NAVIGATOR10_SETTING_IDS,
  IdmWebAuthenticationError,
  IdmWebData,
  IdmWebDiagnostics,
  IdmWebPinRejectedError,
  IdmWebProtocolError,
  IdmWebTimeoutError,
  IdmWebWebSocketError,
  parseNavigatorNotificationsResponse,
  parseNavigatorSettingResponse,
  parseNavigatorStatisticResponse,
  type IdmWebNotifications,
  type IdmWebValue,
  formatUrlHost,
} from "./core.js";

export interface Navigator10Socket {
  readonly closed: boolean;
  sendJson(payload: Readonly<Record<string, unknown>>): Promise<void>;
  receiveText(timeoutSeconds: number): Promise<string>;
  close(): Promise<void>;
}
export type Navigator10SocketFactory = (
  url: string,
  timeoutSeconds: number,
) => Promise<Navigator10Socket>;

interface WebSocketBoundary {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  addEventListener(
    type: string,
    listener: (event: { readonly data?: unknown; readonly message?: string }) => void,
    options?: { readonly once?: boolean },
  ): void;
}

class NativeNavigator10Socket implements Navigator10Socket {
  readonly #socket: WebSocketBoundary;
  readonly #messages: string[] = [];
  readonly #waiters: ((value: string | Error) => void)[] = [];

  private constructor(socket: WebSocketBoundary) {
    this.#socket = socket;
    socket.addEventListener("message", (event) => {
      const text = typeof event.data === "string" ? event.data : String(event.data);
      const waiter = this.#waiters.shift();
      if (waiter === undefined) this.#messages.push(text);
      else waiter(text);
    });
    const fail = (message: string): void => {
      for (const waiter of this.#waiters.splice(0)) waiter(new IdmWebWebSocketError(message));
    };
    socket.addEventListener("close", () => fail("Navigator 10 websocket was closed by the device"));
    socket.addEventListener("error", () => fail("Navigator 10 websocket error"));
  }

  static async connect(url: string, timeoutSeconds: number): Promise<NativeNavigator10Socket> {
    const Constructor = (globalThis as { WebSocket?: new (url: string) => WebSocketBoundary })
      .WebSocket;
    if (Constructor === undefined)
      throw new IdmWebWebSocketError("The Node.js runtime does not provide WebSocket");
    const socket = new Constructor(url);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new IdmWebTimeoutError("Navigator 10 websocket connection timed out")),
        timeoutSeconds * 1000,
      );
      socket.addEventListener(
        "open",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      socket.addEventListener(
        "error",
        () => {
          clearTimeout(timer);
          reject(new IdmWebWebSocketError("Navigator 10 websocket connection failed"));
        },
        { once: true },
      );
    });
    return new NativeNavigator10Socket(socket);
  }

  get closed(): boolean {
    return this.#socket.readyState >= 2;
  }

  async sendJson(payload: Readonly<Record<string, unknown>>): Promise<void> {
    if (this.closed) throw new IdmWebWebSocketError("Navigator 10 websocket is closed");
    this.#socket.send(JSON.stringify(payload));
  }

  async receiveText(timeoutSeconds: number): Promise<string> {
    const queued = this.#messages.shift();
    if (queued !== undefined) return queued;
    return await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.#waiters.indexOf(waiter);
        if (index >= 0) this.#waiters.splice(index, 1);
        reject(new IdmWebTimeoutError("Navigator 10 websocket request timed out"));
      }, timeoutSeconds * 1000);
      const waiter = (result: string | Error): void => {
        clearTimeout(timer);
        if (result instanceof Error) reject(result);
        else resolve(result);
      };
      this.#waiters.push(waiter);
    });
  }

  async close(): Promise<void> {
    if (!this.closed) this.#socket.close();
  }
}

export interface IdmNavigator10WebClientOptions {
  readonly port?: number;
  readonly timeout?: number;
  readonly requestDelay?: number;
  readonly reconnectBaseDelay?: number;
  readonly reconnectMaxDelay?: number;
  readonly maxReconnectAttempts?: number;
  readonly socketFactory?: Navigator10SocketFactory;
  readonly now?: () => number;
  readonly sleep?: (seconds: number) => Promise<void>;
}

function assertFiniteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be finite and >= 0`);
}

export class IdmNavigator10WebClient {
  readonly modelName = "Navigator 10";
  readonly #urlHost: string;
  readonly #pin: string;
  readonly #port: number;
  readonly #timeout: number;
  readonly #requestDelay: number;
  readonly #reconnectBaseDelay: number;
  readonly #reconnectMaxDelay: number;
  readonly #maxReconnectAttempts: number;
  readonly #socketFactory: Navigator10SocketFactory;
  readonly #now: () => number;
  readonly #sleep: (seconds: number) => Promise<void>;
  #socket: Navigator10Socket | null = null;
  #lastSuccessMonotonic: number | null = null;
  #lastError: string | null = null;
  #lastReconnectMonotonic: number | null = null;
  #reconnectAttempts = 0;
  #cachedData: IdmWebData | null = null;
  #queue: Promise<void> = Promise.resolve();

  constructor(host: string, pin: string, options: IdmNavigator10WebClientOptions = {}) {
    if (!pin) throw new TypeError("PIN must not be empty");
    this.#urlHost = formatUrlHost(host);
    this.#pin = pin;
    this.#port = options.port ?? DEFAULT_NAVIGATOR10_PORT;
    this.#timeout = options.timeout ?? 8;
    this.#requestDelay = Math.max(0, options.requestDelay ?? DEFAULT_NAVIGATOR10_REQUEST_DELAY);
    this.#reconnectBaseDelay = Math.max(0, options.reconnectBaseDelay ?? 0.25);
    this.#reconnectMaxDelay = Math.max(this.#reconnectBaseDelay, options.reconnectMaxDelay ?? 5);
    this.#maxReconnectAttempts = Math.max(1, Math.trunc(options.maxReconnectAttempts ?? 3));
    this.#socketFactory =
      options.socketFactory ??
      (async (url, timeout) => await NativeNavigator10Socket.connect(url, timeout));
    this.#now = options.now ?? (() => performance.now() / 1000);
    this.#sleep =
      options.sleep ??
      (async (seconds) => {
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      });
    if (!Number.isInteger(this.#port) || this.#port < 1 || this.#port > 65_535)
      throw new TypeError(`Port must be between 1 and 65535, got ${this.#port}`);
    assertFiniteNonNegative(this.#timeout, "timeout");
    assertFiniteNonNegative(this.#requestDelay, "requestDelay");
    assertFiniteNonNegative(this.#reconnectBaseDelay, "reconnectBaseDelay");
    assertFiniteNonNegative(this.#reconnectMaxDelay, "reconnectMaxDelay");
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
    await this.#exclusive(async () => await this.#connectUnlocked());
  }

  async #connectUnlocked(): Promise<void> {
    if (this.#socket !== null && !this.#socket.closed) return;
    this.#socket = null;
    const url = `ws://${this.#urlHost}:${this.#port}/?auth_code=${encodeURIComponent(this.#pin)}`;
    try {
      this.#socket = await this.#socketFactory(url, this.#timeout);
      const auth = await this.#socket.receiveText(this.#timeout);
      const parsed: unknown = JSON.parse(auth);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
        throw new IdmWebProtocolError("Navigator 10 authorization response was not recognized");
      const authorized = (parsed as Record<string, unknown>).authorized;
      if (authorized !== true) {
        if (authorized === false) throw new IdmWebPinRejectedError("Navigator 10 rejected the PIN");
        throw new IdmWebProtocolError("Navigator 10 authorization response was not recognized");
      }
      this.#lastSuccessMonotonic = this.#now();
      this.#lastError = null;
    } catch (error) {
      await this.#closeUnlocked();
      if (error instanceof IdmWebAuthenticationError || error instanceof IdmWebProtocolError)
        throw error;
      if (error instanceof IdmWebTimeoutError) {
        this.#lastError = "Navigator 10 websocket connection timed out";
        throw error;
      }
      this.#lastError = "Navigator 10 websocket connection failed";
      throw new IdmWebWebSocketError(this.#lastError, { cause: error });
    }
  }

  async close(): Promise<void> {
    await this.#exclusive(async () => await this.#closeUnlocked());
  }

  async #closeUnlocked(): Promise<void> {
    const socket = this.#socket;
    this.#socket = null;
    if (socket !== null) {
      try {
        await socket.close();
      } catch {
        // Close is best effort, matching the Python client.
      }
    }
  }

  async #request(payload: Readonly<Record<string, unknown>>): Promise<string> {
    return await this.#exclusive(async () => {
      await this.#connectUnlocked();
      try {
        return await this.#requestOnce(payload);
      } catch (error) {
        if (error instanceof IdmWebAuthenticationError) throw error;
        this.#lastError = `Navigator 10 websocket request failed: ${
          error instanceof Error ? error.name : "Error"
        }`;
      }
      let delay = this.#reconnectBaseDelay;
      let lastError: unknown;
      for (let attempt = 1; attempt <= this.#maxReconnectAttempts; attempt += 1) {
        this.#reconnectAttempts = attempt;
        this.#lastReconnectMonotonic = this.#now();
        try {
          await this.#closeUnlocked();
          if (delay > 0) {
            await this.#sleep(Math.min(delay, this.#reconnectMaxDelay));
            delay = Math.min(delay * 2, this.#reconnectMaxDelay);
          }
          await this.#connectUnlocked();
          const result = await this.#requestOnce(payload);
          this.#reconnectAttempts = 0;
          return result;
        } catch (error) {
          if (error instanceof IdmWebAuthenticationError) throw error;
          lastError = error;
          this.#lastError = `Navigator 10 websocket reconnect attempt ${attempt} failed: ${
            error instanceof Error ? error.name : "Error"
          }`;
        }
      }
      throw new IdmWebWebSocketError(this.#lastError ?? "Navigator 10 websocket reconnect failed", {
        cause: lastError,
      });
    });
  }

  async #requestOnce(payload: Readonly<Record<string, unknown>>): Promise<string> {
    if (this.#socket === null || this.#socket.closed)
      throw new IdmWebWebSocketError("Navigator 10 websocket is not connected");
    await this.#socket.sendJson(payload);
    return await this.#socket.receiveText(this.#timeout);
  }

  async readData(
    settingIds: readonly string[] = DEFAULT_NAVIGATOR10_SETTING_IDS,
    options: { readonly includeRaw?: boolean } = {},
  ): Promise<IdmWebData> {
    const typedValues: Record<string, IdmWebValue> = Object.create(null);
    const rawResponses: Record<string, string> = Object.create(null);
    for (const [index, settingId] of settingIds.entries()) {
      const raw = await this.#request({
        controller: "setting",
        command: "detail",
        data: { settingId },
      });
      Object.assign(typedValues, parseNavigatorSettingResponse(raw));
      if (options.includeRaw === true) rawResponses[`setting:${settingId}`] = raw;
      if (this.#requestDelay > 0 && index < settingIds.length - 1)
        await this.#sleep(this.#requestDelay);
    }
    const data = IdmWebData.create({
      model: "Navigator 10 Web",
      values: typedValues,
      rawResponses,
    });
    this.#cachedData = data;
    this.#lastSuccessMonotonic = this.#now();
    return data;
  }

  async readStatistics(
    statisticType: number,
    periodType: number,
    prefix: string,
    options: { readonly includeRaw?: boolean } = {},
  ): Promise<IdmWebData> {
    const raw = await this.#request({
      controller: "statistic",
      command: "detail",
      data: { statisticType, periodType, statisticSubType: null },
    });
    this.#lastSuccessMonotonic = this.#now();
    return IdmWebData.create({
      model: "Navigator 10 Web",
      values: parseNavigatorStatisticResponse(raw, prefix),
      rawResponses:
        options.includeRaw === true ? { [`statistic:${statisticType}:${periodType}`]: raw } : {},
    });
  }

  async readNotifications(
    options: { readonly includeRaw?: boolean } = {},
  ): Promise<IdmWebNotifications> {
    const raw = await this.#request({ controller: "notification", command: "overview" });
    this.#lastSuccessMonotonic = this.#now();
    return parseNavigatorNotificationsResponse(raw, options.includeRaw === true);
  }

  getCachedData(): IdmWebData | null {
    return this.#cachedData;
  }

  diagnostics(): IdmWebDiagnostics {
    return IdmWebDiagnostics.create({
      navigatorType: "nav10",
      websocketConnected: this.#socket !== null && !this.#socket.closed,
      webDataEnabled: true,
      lastSuccessMonotonic: this.#lastSuccessMonotonic,
      lastError: this.#lastError,
      lastReconnectMonotonic: this.#lastReconnectMonotonic,
      reconnectAttempts: this.#reconnectAttempts,
      cached: this.#cachedData !== null,
    });
  }
}
