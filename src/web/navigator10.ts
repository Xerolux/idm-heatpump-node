import {
  DEFAULT_NAVIGATOR10_PORT,
  DEFAULT_NAVIGATOR10_REQUEST_DELAY,
  DEFAULT_NAVIGATOR10_SETTING_IDS,
  NAVIGATOR10_DATETIME_SETTING_ID,
  NAVIGATOR10_DHW_SETPOINT_PARAM,
  NAVIGATOR10_DHW_SETPOINT_SETTING_ID,
  NAVIGATOR10_WRITABLE_SYSTEM_MODES,
  IdmWebAuthenticationError,
  IdmWebConnectionError,
  IdmWebHeatingCircuitUnavailableError,
  IdmWebData,
  IdmWebDiagnostics,
  IdmWebPinRejectedError,
  IdmWebProtocolError,
  IdmWebResponseError,
  IdmWebTimeoutError,
  IdmWebWebSocketError,
  isJsonObject,
  parseNavigatorEnergyflowResponse,
  parseNavigatorFreshwaterResponse,
  parseNavigatorHeatingcircuitResponse,
  parseNavigatorHomeOverviewResponse,
  parseNavigatorHomeResponse,
  parseNavigatorIonResponse,
  parseNavigatorNotificationsResponse,
  parseNavigatorPerformanceResponse,
  parseNavigatorSaveResponse,
  parseNavigatorSettingParameter,
  parseNavigatorSettingResponse,
  parseNavigatorStatisticResponse,
  parseNavigatorStatusResponse,
  parseNavigatorSystemOverviewResponse,
  parseNavigatorWeatherResponse,
  type IdmWebEnergyflow,
  type IdmWebFreshwater,
  type IdmWebHeatingCircuit,
  type IdmWebHomeDetail,
  type IdmWebHomeOverview,
  type IdmWebIon,
  type IdmWebNotifications,
  type IdmWebPerformance,
  type IdmWebSettingParameter,
  type IdmWebStatus,
  type IdmWebSystemOverview,
  type IdmWebValue,
  type IdmWebWeatherDetail,
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
  #closed = false;
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
    await this.#exclusive(async () => {
      // An explicit connect() re-opens a client that was closed; only
      // the reconnect loop must refuse to run after close().
      this.#closed = false;
      await this.#connectUnlocked();
    });
  }

  async #connectUnlocked(): Promise<void> {
    if (this.#closed) throw new IdmWebConnectionError("Navigator 10 web client is closed");
    if (this.#socket !== null && !this.#socket.closed) return;
    this.#socket = null;
    const url = `ws://${this.#urlHost}:${this.#port}/?auth_code=${encodeURIComponent(this.#pin)}`;
    const closedMessage = "Navigator 10 web client was closed while connecting";
    try {
      this.#socket = await this.#socketFactory(url, this.#timeout);
      if (this.#closed) throw new IdmWebConnectionError(closedMessage);
      const auth = await this.#socket.receiveText(this.#timeout);
      if (this.#closed) throw new IdmWebConnectionError(closedMessage);
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
      if (this.#closed) {
        this.#lastError = closedMessage;
        throw new IdmWebConnectionError(this.#lastError, { cause: error });
      }
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
    // Set before touching the websocket: closing it fails the request that
    // may be in flight under the lock, and that request must not reconnect
    // (which would leave a websocket nobody closes).
    this.#closed = true;
    await this.#closeUnlocked();
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
      try {
        await this.#connectUnlocked();
        return await this.#requestOnce(payload);
      } catch (error) {
        if (error instanceof IdmWebAuthenticationError) throw error;
        // A save may already have reached the controller even when sending
        // or receiving fails. Never replay an uncertain write; discard the
        // socket so a late reply cannot poison the next read.
        if (payload.command === "save") {
          this.#lastError = "Navigator 10 write outcome is unknown; request was not retried";
          await this.#closeUnlocked();
          throw new IdmWebWebSocketError(this.#lastError, { cause: error });
        }
        if (this.#closed)
          throw new IdmWebWebSocketError("Navigator 10 web client was closed during the request", {
            cause: error,
          });
        this.#lastError = `Navigator 10 websocket request failed: ${
          error instanceof Error ? error.name : "Error"
        }`;
      }
      let delay = this.#reconnectBaseDelay;
      let lastError: unknown;
      for (let attempt = 1; attempt <= this.#maxReconnectAttempts; attempt += 1) {
        if (this.#closed)
          throw new IdmWebWebSocketError(
            this.#lastError ?? "Navigator 10 web client was closed during the request",
            { cause: lastError },
          );
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
          if (error instanceof IdmWebAuthenticationError) {
            await this.#closeUnlocked();
            throw error;
          }
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
    await this.connect();
    const typedValues: Record<string, IdmWebValue> = Object.create(null);
    const rawResponses: Record<string, string> = Object.create(null);
    let parsedSections = 0;
    for (const [index, settingId] of settingIds.entries()) {
      const raw = await this.#request({
        controller: "setting",
        command: "detail",
        data: { settingId },
      });
      if (options.includeRaw === true) rawResponses[`setting:${settingId}`] = raw;
      try {
        Object.assign(typedValues, parseNavigatorSettingResponse(raw));
        parsedSections += 1;
      } catch (error) {
        if (!(error instanceof IdmWebResponseError)) throw error;
        // Firmware-specific optional sections may be unavailable even after
        // successful authentication. Do not hide malformed data.
        let payload: unknown;
        try {
          payload = JSON.parse(raw);
        } catch {
          throw new IdmWebResponseError("Navigator 10 setting response is not valid JSON");
        }
        const setting = isJsonObject(payload) ? payload.setting : undefined;
        const note = isJsonObject(setting) ? setting.note : undefined;
        if (!(isJsonObject(note) && note.text === `setting item [${settingId}] is not accessible!`))
          throw error;
      }
      if (this.#requestDelay > 0 && index < settingIds.length - 1)
        await this.#sleep(this.#requestDelay);
    }
    if (parsedSections === 0)
      throw new IdmWebResponseError("Navigator 10 returned no accessible setting sections");
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
    await this.connect();
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
    await this.connect();
    const raw = await this.#request({ controller: "notification", command: "overview" });
    this.#lastSuccessMonotonic = this.#now();
    return parseNavigatorNotificationsResponse(raw, options.includeRaw === true);
  }

  async readHomeDetail(options: { readonly includeRaw?: boolean } = {}): Promise<IdmWebHomeDetail> {
    await this.connect();
    const raw = await this.#request({ controller: "home", command: "detail" });
    const detail = parseNavigatorHomeResponse(raw, options.includeRaw === true);
    this.#lastSuccessMonotonic = this.#now();
    return detail;
  }

  async readStatusOverview(options: { readonly includeRaw?: boolean } = {}): Promise<IdmWebStatus> {
    await this.connect();
    const raw = await this.#request({ controller: "status", command: "overview" });
    const status = parseNavigatorStatusResponse(raw, options.includeRaw === true);
    this.#lastSuccessMonotonic = this.#now();
    return status;
  }

  async readPerformance(
    options: { readonly includeRaw?: boolean } = {},
  ): Promise<IdmWebPerformance> {
    await this.connect();
    const raw = await this.#request({
      controller: "system.heatpump.performance",
      command: "detail",
    });
    const performance = parseNavigatorPerformanceResponse(raw, options.includeRaw === true);
    this.#lastSuccessMonotonic = this.#now();
    return performance;
  }

  async readWeather(options: { readonly includeRaw?: boolean } = {}): Promise<IdmWebWeatherDetail> {
    await this.connect();
    const raw = await this.#request({ controller: "weather", command: "detail" });
    const weather = parseNavigatorWeatherResponse(raw, options.includeRaw === true);
    this.#lastSuccessMonotonic = this.#now();
    return weather;
  }

  async readIon(options: { readonly includeRaw?: boolean } = {}): Promise<IdmWebIon> {
    await this.connect();
    const raw = await this.#request({ controller: "ion", command: "overview" });
    const ion = parseNavigatorIonResponse(raw, options.includeRaw === true);
    this.#lastSuccessMonotonic = this.#now();
    return ion;
  }

  async readEnergyflow(options: { readonly includeRaw?: boolean } = {}): Promise<IdmWebEnergyflow> {
    await this.connect();
    const raw = await this.#request({ controller: "energyflow", command: "overview" });
    const energyflow = parseNavigatorEnergyflowResponse(raw, options.includeRaw === true);
    this.#lastSuccessMonotonic = this.#now();
    return energyflow;
  }

  async readSystemOverview(
    options: { readonly includeRaw?: boolean } = {},
  ): Promise<IdmWebSystemOverview> {
    await this.connect();
    const raw = await this.#request({ controller: "system", command: "overview" });
    const overview = parseNavigatorSystemOverviewResponse(raw, options.includeRaw === true);
    this.#lastSuccessMonotonic = this.#now();
    return overview;
  }

  async readFreshwaterOverview(
    options: { readonly includeRaw?: boolean } = {},
  ): Promise<IdmWebFreshwater> {
    await this.connect();
    const raw = await this.#request({ controller: "system.freshwater", command: "overview" });
    const freshwater = parseNavigatorFreshwaterResponse(raw, options.includeRaw === true);
    this.#lastSuccessMonotonic = this.#now();
    return freshwater;
  }

  async readHomeOverview(
    options: { readonly includeRaw?: boolean } = {},
  ): Promise<IdmWebHomeOverview> {
    await this.connect();
    const raw = await this.#request({ controller: "home", command: "overview" });
    const overview = parseNavigatorHomeOverviewResponse(raw, options.includeRaw === true);
    this.#lastSuccessMonotonic = this.#now();
    return overview;
  }

  async setSystemMode(mode: number): Promise<void> {
    if (
      typeof mode !== "number" ||
      !Number.isInteger(mode) ||
      !NAVIGATOR10_WRITABLE_SYSTEM_MODES.includes(mode)
    )
      throw new TypeError(`mode must be one of [0, 1, 2, 3, 4, 5], got ${String(mode)}`);
    await this.connect();
    const raw = await this.#request({
      controller: "home",
      command: "save",
      data: { systemMode: { value: mode } },
    });
    parseNavigatorSaveResponse(raw, "homeSave");
  }

  async acknowledgeAllNotifications(): Promise<void> {
    await this.connect();
    const raw = await this.#request({
      controller: "notification",
      command: "save",
      data: { quitAll: true },
    });
    parseNavigatorSaveResponse(raw, "notificationSave");
  }

  async acknowledgeNotification(code: string, remindMeLater = false): Promise<void> {
    const cleanCode = String(code).trim();
    if (cleanCode.length === 0) throw new TypeError("code must not be empty");
    await this.connect();
    const raw = await this.#request({
      controller: "notification",
      command: "save",
      data: { code: cleanCode, remindMeLater: remindMeLater === true },
    });
    parseNavigatorSaveResponse(raw, "notificationSave");
  }

  async readSettingParameter(settingId: string): Promise<IdmWebSettingParameter> {
    const cleanId = String(settingId).trim();
    if (cleanId.length === 0) throw new TypeError("setting_id must not be empty");
    await this.connect();
    const raw = await this.#request({
      controller: "setting",
      command: "detail",
      data: { settingId: cleanId },
    });
    return parseNavigatorSettingParameter(raw);
  }

  async saveFreshwaterParameter(
    parameterId: string,
    value: number,
    options: { readonly settingId?: string | null } = {},
  ): Promise<void> {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new TypeError(`value must be a finite number, got ${String(value)}`);
    const cleanParameter = String(parameterId).trim();
    if (cleanParameter.length === 0) throw new TypeError("parameter_id must not be empty");
    if (options.settingId !== null && options.settingId !== undefined) {
      const definition = await this.readSettingParameter(options.settingId);
      if (definition.param !== null && definition.param !== cleanParameter)
        throw new TypeError(
          `setting ${options.settingId} is parameter ${definition.param}, not ${cleanParameter}`,
        );
      if (definition.minValue !== null && value < definition.minValue)
        throw new TypeError(
          `value ${String(value)} is below the device-declared minimum ${String(definition.minValue)}`,
        );
      if (definition.maxValue !== null && value > definition.maxValue)
        throw new TypeError(
          `value ${String(value)} is above the device-declared maximum ${String(definition.maxValue)}`,
        );
    }
    await this.connect();
    const raw = await this.#request({
      controller: "system.freshwater",
      command: "save",
      data: { parameterId: cleanParameter, value },
    });
    parseNavigatorSaveResponse(raw, "freshwaterSave");
  }

  async saveDhwSetpoint(celsius: number): Promise<void> {
    await this.saveFreshwaterParameter(NAVIGATOR10_DHW_SETPOINT_PARAM, celsius, {
      settingId: NAVIGATOR10_DHW_SETPOINT_SETTING_ID,
    });
  }

  async setDatetime(value: Date): Promise<void> {
    if (!(value instanceof Date) || Number.isNaN(value.getTime()))
      throw new TypeError("value must be a datetime");
    await this.connect();
    const raw = await this.#request({
      controller: "setting",
      command: "save",
      data: { settingId: NAVIGATOR10_DATETIME_SETTING_ID, value: value.toISOString() },
    });
    parseNavigatorSaveResponse(raw, "settingSave");
  }

  async readHeatingcircuit(hcId: string): Promise<IdmWebHeatingCircuit> {
    const cleanId = String(hcId).trim().toUpperCase();
    if (cleanId.length === 0) throw new TypeError("hc_id must not be empty");
    await this.connect();
    const raw = await this.#request({
      controller: "system.heatingcircuit",
      command: "detail",
      data: { hcId: cleanId },
    });
    try {
      const circuit = parseNavigatorHeatingcircuitResponse(raw);
      this.#lastSuccessMonotonic = this.#now();
      return circuit;
    } catch (error) {
      if (error instanceof IdmWebHeatingCircuitUnavailableError && error.hcId !== cleanId) {
        throw new IdmWebResponseError("Navigator 10 unavailable circuit does not match request", {
          cause: error,
        });
      }
      throw error;
    }
  }

  async saveHeatingcircuitParameter(
    parameterId: string,
    value: number,
    options: { readonly minValue?: number | null; readonly maxValue?: number | null } = {},
  ): Promise<void> {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new TypeError(`value must be a finite number, got ${String(value)}`);
    const cleanParameter = String(parameterId).trim();
    if (cleanParameter.length === 0) throw new TypeError("parameter_id must not be empty");
    if (options.minValue !== null && options.minValue !== undefined && value < options.minValue)
      throw new TypeError(
        `value ${String(value)} is below the device-declared minimum ${String(options.minValue)}`,
      );
    if (options.maxValue !== null && options.maxValue !== undefined && value > options.maxValue)
      throw new TypeError(
        `value ${String(value)} is above the device-declared maximum ${String(options.maxValue)}`,
      );
    await this.connect();
    const raw = await this.#request({
      controller: "system.heatingcircuit",
      command: "save",
      data: { parameterId: cleanParameter, value },
    });
    parseNavigatorSaveResponse(raw, "heatingcircuitSave");
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
