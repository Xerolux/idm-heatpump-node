import {
  DEFAULT_PORT,
  DEFAULT_SLAVE_ID,
  DEFAULT_TIMEOUT,
  MAX_RETRIES,
  MODEL_NAVIGATOR_20,
  MODEL_UNKNOWN,
} from "../constants.js";
import { performance } from "node:perf_hooks";
import type { ModbusTransport } from "../transport/types.js";
import type { IdmModelInfo } from "../types.js";
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
  #transport: ModbusTransport | null = null;
  #modelInfo: IdmModelInfo | null = null;
  #connectionSuspect = false;

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
    void this.#maxRetries;
    void this.#maxGroupSize;
    void this.#connectionSuspect;
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
}
