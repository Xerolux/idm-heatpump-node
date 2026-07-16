import ModbusRTU from "modbus-serial";

import {
  createModbusFailure,
  createNormalizedTransportFailure,
  isKnownTransportFailure,
  NormalizedTransportFailureKind,
  type DiagnosticEndpoint,
  type RetryableTransportFailureKind,
} from "./errors.js";
import { type ModbusReadRequest, type ModbusTransport, validateModbusWords } from "./types.js";

export interface ModbusSerialTransportConfiguration {
  readonly host: string;
  readonly port: number;
  readonly unitId: number;
  readonly timeout: number;
  readonly adapterRetries: 0;
}

export interface ModbusSerialClientBoundary {
  readonly isOpen: boolean;
  setID(unitId: number): void;
  setTimeout(timeoutMs: number): void;
  connectTCP(host: string, options: Readonly<{ readonly port: number }>): Promise<void>;
  readHoldingRegisters(address: number, count: number): Promise<unknown>;
  readInputRegisters(address: number, count: number): Promise<unknown>;
  close(callback: (error?: unknown) => void): void;
  destroy(callback: (error?: unknown) => void): void;
}

export type ModbusSerialClientFactory = () => ModbusSerialClientBoundary;

type AdapterOperation = "close" | "connect" | "destroy" | "read";

const disconnectedCodes: ReadonlySet<string> = new Set([
  "ENOTCONN",
  "ERR_SOCKET_CLOSED",
  "ERR_STREAM_DESTROYED",
]);
const noResponseCodes: ReadonlySet<string> = new Set(["ERR_STREAM_PREMATURE_CLOSE"]);
const socketCodes: ReadonlySet<string> = new Set([
  "EAI_AGAIN",
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETDOWN",
  "ENETUNREACH",
  "ENOTFOUND",
  "EPIPE",
]);

function errorRecord(error: unknown): Readonly<Record<string, unknown>> | null {
  return typeof error === "object" && error !== null
    ? (error as Readonly<Record<string, unknown>>)
    : null;
}

function errorMessage(error: unknown, operation: AdapterOperation): string {
  const record = errorRecord(error);
  return typeof record?.message === "string" ? record.message : `Modbus ${operation} failed`;
}

function errorCode(error: unknown): string | null {
  const record = errorRecord(error);
  if (typeof record?.code === "string") {
    return record.code;
  }
  return typeof record?.errno === "string" ? record.errno : null;
}

function normalizeAdapterError(
  error: unknown,
  operation: AdapterOperation,
  endpoint: DiagnosticEndpoint,
): Error {
  if (isKnownTransportFailure(error)) {
    return error;
  }

  const record = errorRecord(error);
  const message = errorMessage(error, operation);
  if (typeof record?.modbusCode === "number") {
    return createModbusFailure(record.modbusCode, message, endpoint);
  }

  const code = errorCode(error);
  let kind: RetryableTransportFailureKind;
  if (code === "ETIMEDOUT") {
    kind = NormalizedTransportFailureKind.TIMEOUT;
  } else if (code !== null && disconnectedCodes.has(code)) {
    kind = NormalizedTransportFailureKind.DISCONNECTED;
  } else if (code !== null && noResponseCodes.has(code)) {
    kind = NormalizedTransportFailureKind.NO_RESPONSE;
  } else if (code !== null && socketCodes.has(code)) {
    kind = NormalizedTransportFailureKind.SOCKET;
  } else if (operation === "read") {
    kind = NormalizedTransportFailureKind.MODBUS;
  } else {
    kind = NormalizedTransportFailureKind.DISCONNECTED;
  }
  return createNormalizedTransportFailure(kind, message, endpoint);
}

function invalidResponse(request: ModbusReadRequest, endpoint: DiagnosticEndpoint): Error {
  return createNormalizedTransportFailure(
    NormalizedTransportFailureKind.INVALID_RESPONSE,
    `Invalid Modbus response at address ${String(request.address)}: expected exactly ${String(request.count)} words`,
    endpoint,
  );
}

function extractWords(
  result: unknown,
  request: ModbusReadRequest,
  endpoint: DiagnosticEndpoint,
): readonly number[] {
  const record = errorRecord(result);
  if (!Array.isArray(record?.data)) {
    throw invalidResponse(request, endpoint);
  }
  try {
    return validateModbusWords(record.data, request.count);
  } catch {
    throw invalidResponse(request, endpoint);
  }
}

class ModbusSerialTransport implements ModbusTransport {
  readonly #client: ModbusSerialClientBoundary;
  readonly #configuration: ModbusSerialTransportConfiguration;
  readonly #endpoint: DiagnosticEndpoint;
  readonly #normalTimeoutMs: number;
  #closePromise: Promise<void> | null = null;
  #destroyPromise: Promise<void> | null = null;

  public constructor(
    configuration: ModbusSerialTransportConfiguration,
    client: ModbusSerialClientBoundary,
  ) {
    this.#configuration = configuration;
    this.#client = client;
    this.#endpoint = Object.freeze({ host: configuration.host, port: configuration.port });
    this.#normalTimeoutMs = configuration.timeout * 1_000;
  }

  public get connected(): boolean {
    return this.#client.isOpen;
  }

  public async connect(): Promise<void> {
    if (this.#client.isOpen) {
      return;
    }
    try {
      this.#client.setID(this.#configuration.unitId);
      this.#client.setTimeout(this.#normalTimeoutMs);
      await this.#client.connectTCP(this.#configuration.host, {
        port: this.#configuration.port,
      });
    } catch (error) {
      throw normalizeAdapterError(error, "connect", this.#endpoint);
    }
  }

  public close(): Promise<void> {
    if (this.#closePromise !== null) {
      return this.#closePromise;
    }
    if (!this.#client.isOpen) {
      this.#closePromise = Promise.resolve();
      return this.#closePromise;
    }
    this.#closePromise = this.#invokeLifecycle("close");
    return this.#closePromise;
  }

  public destroy(): Promise<void> {
    if (this.#destroyPromise !== null) {
      return this.#destroyPromise;
    }
    this.#destroyPromise = this.#invokeLifecycle("destroy");
    return this.#destroyPromise;
  }

  public async read(request: ModbusReadRequest): Promise<readonly number[]> {
    const temporaryTimeout = request.timeoutMs;
    this.#client.setID(request.unitId);
    if (temporaryTimeout !== undefined) {
      this.#setTimeout(temporaryTimeout);
    }

    try {
      const result =
        request.functionCode === 3
          ? await this.#client.readHoldingRegisters(request.address, request.count)
          : await this.#client.readInputRegisters(request.address, request.count);
      return extractWords(result, request, this.#endpoint);
    } catch (error) {
      throw normalizeAdapterError(error, "read", this.#endpoint);
    } finally {
      if (temporaryTimeout !== undefined) {
        this.#setTimeout(this.#normalTimeoutMs);
      }
    }
  }

  #setTimeout(timeoutMs: number): void {
    try {
      this.#client.setTimeout(timeoutMs);
    } catch (error) {
      throw normalizeAdapterError(error, "read", this.#endpoint);
    }
  }

  #invokeLifecycle(operation: "close" | "destroy"): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: unknown): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (error === undefined || error === null) {
          resolve();
        } else {
          reject(normalizeAdapterError(error, operation, this.#endpoint));
        }
      };

      try {
        this.#client[operation](finish);
      } catch (error) {
        finish(error);
      }
    });
  }
}

const ModbusRTUConstructor = ModbusRTU as unknown as new () => ModbusSerialClientBoundary;
const defaultClientFactory: ModbusSerialClientFactory = () => new ModbusRTUConstructor();

export function createModbusSerialTransport(
  configuration: ModbusSerialTransportConfiguration,
  clientFactory: ModbusSerialClientFactory = defaultClientFactory,
): ModbusTransport {
  return new ModbusSerialTransport(configuration, clientFactory());
}
