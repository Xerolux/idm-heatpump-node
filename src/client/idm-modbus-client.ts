import { performance } from "node:perf_hooks";

import {
  DEFAULT_PORT,
  DEFAULT_SLAVE_ID,
  DEFAULT_TIMEOUT,
  MAX_RETRIES,
  MODEL_NAVIGATOR_20,
  MODEL_UNKNOWN,
  RETRY_BACKOFF_BASE,
} from "../constants.js";
import { compareUnicodeCodePoints } from "../contracts/canonical-order.js";
import {
  createNormalizedTransportFailure,
  IllegalAddressError,
  isKnownTransportFailure,
  NormalizedTransportFailure,
  NormalizedTransportFailureKind,
  redactDiagnosticMessage,
  type DiagnosticEndpoint,
  type NormalizedTransportFailureKind as NormalizedTransportFailureKindValue,
} from "../transport/errors.js";
import {
  createModbusReadRequest,
  type ModbusReadRequest,
  type ModbusTransport,
  validateModbusWords,
} from "../transport/types.js";
import { RegisterType, type IdmModelInfo } from "../types.js";
import { IdmClientDiagnostics, ModbusErrorContext } from "./diagnostics.js";
import type {
  IdmClientDiagnostics as IdmClientDiagnosticsValue,
  ModbusErrorContext as ModbusErrorContextValue,
} from "./diagnostics.js";
import { FifoGate } from "./fifo-gate.js";

const DEFAULT_MAX_GROUP_SIZE = 40;
const INTERNAL_DEPENDENCIES = Symbol("IdmModbusClient.internalDependencies");

export interface IdmModbusClientOptions {
  readonly port?: number;
  readonly slaveId?: number;
  readonly timeout?: number;
  readonly maxRetries?: number;
  readonly maxGroupSize?: number;
}

export interface ProbeRegisterOptions {
  readonly maxRetries?: number;
  readonly timeout?: number;
}

export interface InternalTransportFactoryConfiguration {
  readonly host: string;
  readonly port: number;
  readonly unitId: number;
  readonly timeout: number;
  readonly adapterRetries: 0;
}

export interface InternalClientDependencies {
  readonly transportFactory: (
    configuration: InternalTransportFactoryConfiguration,
  ) => ModbusTransport;
  readonly now: () => number;
  readonly sleep: (seconds: number) => Promise<void>;
}

interface InternalIdmModbusClientOptions extends IdmModbusClientOptions {
  readonly [INTERNAL_DEPENDENCIES]?: InternalClientDependencies;
}

const allowedOptionKeys = new Set(["port", "slaveId", "timeout", "maxRetries", "maxGroupSize"]);
const reconnectFailureKinds: ReadonlySet<NormalizedTransportFailureKindValue> = new Set([
  NormalizedTransportFailureKind.TIMEOUT,
  NormalizedTransportFailureKind.DISCONNECTED,
  NormalizedTransportFailureKind.SOCKET,
  NormalizedTransportFailureKind.NO_RESPONSE,
]);

function defaultTransportFactory(): never {
  throw new Error("The default Modbus transport adapter is not configured");
}

const defaultDependencies: InternalClientDependencies = Object.freeze({
  transportFactory: defaultTransportFactory,
  now: () => performance.now() / 1_000,
  sleep: async (seconds: number): Promise<void> => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, seconds * 1_000);
    });
  },
});

function requireIntegerAtLeast(value: number, minimum: number, field: string): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new RangeError(`${field} must be an integer greater than or equal to ${String(minimum)}`);
  }
}

function requireIntegerRange(value: number, minimum: number, maximum: number, field: string): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(
      `${field} must be an integer between ${String(minimum)} and ${String(maximum)}`,
    );
  }
}

function requireClosedOptions(options: IdmModbusClientOptions): void {
  for (const key of Object.keys(options)) {
    if (!allowedOptionKeys.has(key)) {
      throw new RangeError(`Unknown IdmModbusClient option: ${key}`);
    }
  }
}

function normalizeRetryCount(value: number | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isFinite(value)) {
    throw new RangeError("maxRetries override must be finite");
  }
  return Math.max(1, Math.trunc(value));
}

function timeoutMilliseconds(timeout: number | undefined): number | undefined {
  if (timeout === undefined) {
    return undefined;
  }
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new RangeError("timeout override must be finite and positive");
  }
  const milliseconds = timeout * 1_000;
  if (!Number.isInteger(milliseconds)) {
    throw new RangeError("timeout override must resolve to whole milliseconds");
  }
  return milliseconds;
}

export function withInternalClientDependencies(
  options: IdmModbusClientOptions | undefined,
  dependencies: InternalClientDependencies,
): IdmModbusClientOptions {
  const internalOptions: InternalIdmModbusClientOptions = { ...(options ?? {}) };
  Object.defineProperty(internalOptions, INTERNAL_DEPENDENCIES, {
    configurable: false,
    enumerable: false,
    value: Object.freeze({ ...dependencies }),
    writable: false,
  });
  return internalOptions;
}

export class IdmModbusClient {
  readonly #gate = new FifoGate();
  readonly #host: string;
  readonly #port: number;
  readonly #slaveId: number;
  readonly #timeout: number;
  readonly #maxRetries: number;
  readonly #maxGroupSize: number;
  readonly #dependencies: InternalClientDependencies;
  readonly #endpoint: DiagnosticEndpoint;
  #transport: ModbusTransport | null = null;
  #modelInfo: IdmModelInfo | null = null;
  #connectionSuspect = false;
  #lastErrorContext: ModbusErrorContextValue | null = null;
  readonly #permanentlyFailedRegisters = new Set<string>();
  readonly #batchUnsafeRegisters = new Set<string>();

  public constructor(host: string, options: IdmModbusClientOptions = {}) {
    if (typeof host !== "string" || host.length === 0) {
      throw new RangeError("Host must not be empty");
    }
    if (typeof options !== "object" || options === null || Array.isArray(options)) {
      throw new TypeError("IdmModbusClient options must be an object");
    }
    requireClosedOptions(options);

    const internalOptions = options as InternalIdmModbusClientOptions;
    const port = options.port ?? DEFAULT_PORT;
    const slaveId = options.slaveId ?? DEFAULT_SLAVE_ID;
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    const maxRetries = options.maxRetries ?? MAX_RETRIES;
    const maxGroupSize = options.maxGroupSize ?? DEFAULT_MAX_GROUP_SIZE;

    requireIntegerRange(port, 1, 65_535, "port");
    requireIntegerRange(slaveId, 1, 247, "slaveId");
    if (typeof timeout !== "number") {
      throw new TypeError("timeout must be a number");
    }
    requireIntegerAtLeast(maxRetries, 1, "maxRetries");
    requireIntegerAtLeast(maxGroupSize, 1, "maxGroupSize");

    this.#host = host;
    this.#port = port;
    this.#slaveId = slaveId;
    this.#timeout = timeout;
    this.#maxRetries = maxRetries;
    this.#maxGroupSize = maxGroupSize;
    this.#dependencies = internalOptions[INTERNAL_DEPENDENCIES] ?? defaultDependencies;
    this.#endpoint = Object.freeze({ host: this.#host, port: this.#port });
    void this.#maxGroupSize;
  }

  public get host(): string {
    return this.#host;
  }

  public get port(): number {
    return this.#port;
  }

  public get isConnected(): boolean {
    return this.#transport?.connected ?? false;
  }

  public get modelInfo(): IdmModelInfo | null {
    return this.#modelInfo;
  }

  public get modelName(): string {
    if (this.#modelInfo === null || this.#modelInfo.modelName === MODEL_UNKNOWN) {
      return MODEL_NAVIGATOR_20;
    }
    return this.#modelInfo.modelName;
  }

  public getLastErrorContext(): ModbusErrorContextValue | null {
    return this.#lastErrorContext;
  }

  public clearLastErrorContext(): void {
    this.#lastErrorContext = null;
  }

  public getDiagnostics(): IdmClientDiagnosticsValue {
    const firmware =
      this.#modelInfo?.firmwareVersion === null || this.#modelInfo?.firmwareVersion === undefined
        ? null
        : String(this.#modelInfo.firmwareVersion);
    return IdmClientDiagnostics.create({
      navigatorType: this.modelName,
      modbusConnected: this.isConnected,
      firmware,
      lastError: this.#lastErrorContext?.message ?? null,
      permanentlyFailedRegisters: [...this.#permanentlyFailedRegisters].sort(
        compareUnicodeCodePoints,
      ),
      connectionSuspect: this.#connectionSuspect,
      batchUnsafeRegisters: [...this.#batchUnsafeRegisters].sort(compareUnicodeCodePoints),
    });
  }

  public async connect(): Promise<void> {
    await this.#gate.runExclusive(async () => this.#connectLocked());
  }

  public async disconnect(): Promise<void> {
    await this.#gate.runExclusive(async () => this.#disconnectLocked());
  }

  public async forceReconnect(): Promise<void> {
    await this.#gate.runExclusive(async () => {
      await this.#closeTransportLocked();
      this.#connectionSuspect = false;
      await this.#connectLocked();
    });
  }

  public async probeRegister(
    address: number,
    count = 1,
    options: ProbeRegisterOptions = {},
  ): Promise<readonly number[] | null> {
    return this.#gate.runExclusive(async () => this.#probeRegisterLocked(address, count, options));
  }

  async #connectLocked(): Promise<void> {
    if (this.#transport?.connected === true) {
      return;
    }

    const transport = this.#dependencies.transportFactory(
      Object.freeze({
        host: this.#host,
        port: this.#port,
        unitId: this.#slaveId,
        timeout: this.#timeout,
        adapterRetries: 0,
      }),
    );
    this.#transport = transport;
    try {
      await transport.connect();
    } catch (error) {
      if (this.#transport === transport) {
        this.#transport = null;
      }
      throw error;
    }
  }

  async #disconnectLocked(): Promise<void> {
    await this.#closeTransportLocked();
  }

  async #ensureConnectedLocked(): Promise<ModbusTransport> {
    if (this.#transport?.connected === true && !this.#connectionSuspect) {
      return this.#transport;
    }
    if (this.#connectionSuspect) {
      await this.#closeTransportLocked();
      this.#connectionSuspect = false;
    }
    await this.#connectLocked();
    return this.#requireTransportLocked();
  }

  #requireTransportLocked(): ModbusTransport {
    if (this.#transport === null || !this.#transport.connected) {
      throw createNormalizedTransportFailure(
        NormalizedTransportFailureKind.DISCONNECTED,
        `Not connected to ${this.#host}:${String(this.#port)}`,
        this.#endpoint,
      );
    }
    return this.#transport;
  }

  async #closeTransportLocked(): Promise<void> {
    const transport = this.#transport;
    if (transport === null) {
      return;
    }
    await transport.close();
    if (this.#transport === transport) {
      this.#transport = null;
    }
  }

  async #probeRegisterLocked(
    address: number,
    count: number,
    options: ProbeRegisterOptions,
  ): Promise<readonly number[] | null> {
    const retries = normalizeRetryCount(options.maxRetries, this.#maxRetries);
    const timeoutMs = timeoutMilliseconds(options.timeout);
    const requestBase = {
      unitId: this.#slaveId,
      registerType: RegisterType.INPUT,
      functionCode: 4,
      address,
      count,
    } as const;
    const request = createModbusReadRequest(
      timeoutMs === undefined ? requestBase : { ...requestBase, timeoutMs },
    );

    try {
      await this.#ensureConnectedLocked();
      return await this.#retryReadLocked(request, retries);
    } catch (error) {
      if (isKnownTransportFailure(error)) {
        return null;
      }
      throw error;
    }
  }

  async #retryReadLocked(request: ModbusReadRequest, retries: number): Promise<readonly number[]> {
    for (let attemptIndex = 0; attemptIndex < retries; attemptIndex += 1) {
      try {
        const words = await this.#requireTransportLocked().read(request);
        let validated: readonly number[];
        try {
          validated = validateModbusWords(words, request.count);
        } catch {
          throw createNormalizedTransportFailure(
            NormalizedTransportFailureKind.INVALID_RESPONSE,
            `Invalid Modbus response reading address ${String(request.address)}: expected ${String(request.count)} 16-bit words`,
          );
        }
        this.#connectionSuspect = false;
        return validated;
      } catch (error) {
        const attempt = attemptIndex + 1;
        if (error instanceof IllegalAddressError) {
          this.#recordErrorContext(request, error, attempt);
          throw error;
        }
        if (!(error instanceof NormalizedTransportFailure)) {
          throw error;
        }

        this.#recordErrorContext(request, error, attempt);
        const reconnect = reconnectFailureKinds.has(error.kind);
        if (reconnect) {
          this.#connectionSuspect = true;
        }
        if (attempt === retries) {
          throw error;
        }
        if (reconnect) {
          await this.#tryReconnectLocked();
        }
        await this.#dependencies.sleep(RETRY_BACKOFF_BASE * 2 ** attemptIndex);
      }
    }
    throw new Error("Unreachable retry state");
  }

  async #tryReconnectLocked(): Promise<void> {
    await this.#closeTransportLocked();
    try {
      await this.#connectLocked();
    } catch (error) {
      if (error instanceof NormalizedTransportFailure && reconnectFailureKinds.has(error.kind)) {
        return;
      }
      throw error;
    }
  }

  #recordErrorContext(
    request: ModbusReadRequest,
    error: IllegalAddressError | NormalizedTransportFailure,
    attempt: number,
  ): void {
    this.#lastErrorContext = ModbusErrorContext.create({
      operation: "read",
      address: request.address,
      count: request.count,
      registerType: request.registerType,
      errorType:
        error instanceof IllegalAddressError
          ? NormalizedTransportFailureKind.ILLEGAL_ADDRESS
          : error.kind,
      message: redactDiagnosticMessage(error.message, this.#endpoint),
      attempt,
    });
  }
}
