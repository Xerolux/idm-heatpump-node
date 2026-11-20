import ModbusRTU from "modbus-serial";

import {
  createModbusFailure,
  createNormalizedTransportFailure,
  isKnownTransportFailure,
  NormalizedTransportFailureKind,
  type DiagnosticEndpoint,
  type RetryableTransportFailureKind,
} from "./errors.js";
import {
  createModbusWriteRequest,
  type CoilReadRequestInput,
  type CoilWriteRequestInput,
  type ModbusReadRequest,
  type ModbusTransport,
  type ModbusWriteRequest,
  validateModbusWords,
} from "./types.js";

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
  writeRegisters(address: number, values: number[]): Promise<unknown>;
  readCoils?(address: number, count: number): Promise<unknown>;
  writeCoil?(address: number, value: boolean): Promise<unknown>;
  close(callback: (status?: unknown) => void): void;
  destroy(callback: (status?: unknown) => void): void;
}

export type ModbusSerialClientFactory = () => ModbusSerialClientBoundary;

type AdapterOperation = "close" | "connect" | "destroy" | "read" | "write";

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
    // Reads and writes share the device-response mapping: exception code 2 is
    // permanently unsupported for the address, every other code is a
    // transient Modbus failure. This mirrors Python's shared
    // ``check_transport_response`` helper introduced in 1.0.
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
  } else if (operation === "read" || operation === "write") {
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

function extractBits(
  result: unknown,
  request: CoilReadRequestInput,
  endpoint: DiagnosticEndpoint,
): readonly boolean[] {
  const record = errorRecord(result);
  const data = Array.isArray(record?.data)
    ? record.data
    : Array.isArray(result)
      ? (result as unknown[])
      : null;
  if (data === null) {
    throw createNormalizedTransportFailure(
      NormalizedTransportFailureKind.INVALID_RESPONSE,
      `Invalid Modbus coil response at address ${String(request.address)}: expected exactly ${String(request.count)} bits`,
      endpoint,
    );
  }
  // FC01 answers pad to byte boundaries; keep only the requested bits.
  const bits = data.slice(0, request.count).map((bit) => bit === true || bit === 1);
  if (bits.length !== request.count) {
    throw createNormalizedTransportFailure(
      NormalizedTransportFailureKind.INVALID_RESPONSE,
      `Incomplete Modbus coil response at address ${String(request.address)}: got ${String(bits.length)} bits, expected ${String(request.count)}`,
      endpoint,
    );
  }
  return Object.freeze(bits);
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
    return validateModbusWords(record.data);
  } catch {
    throw invalidResponse(request, endpoint);
  }
}

function invalidWriteResponse(request: ModbusWriteRequest, endpoint: DiagnosticEndpoint): Error {
  return createNormalizedTransportFailure(
    NormalizedTransportFailureKind.INVALID_RESPONSE,
    `Invalid Modbus write response at address ${String(request.address)}: expected length ${String(request.count)}`,
    endpoint,
  );
}

function validateWriteAcknowledgement(
  result: unknown,
  request: ModbusWriteRequest,
  endpoint: DiagnosticEndpoint,
): void {
  if (typeof result !== "object" || result === null || Array.isArray(result)) {
    throw invalidWriteResponse(request, endpoint);
  }
  const acknowledgement = result as Readonly<Record<string, unknown>>;
  if (
    typeof acknowledgement.address !== "number" ||
    !Number.isInteger(acknowledgement.address) ||
    acknowledgement.address !== request.address ||
    typeof acknowledgement.length !== "number" ||
    !Number.isInteger(acknowledgement.length) ||
    acknowledgement.length !== request.count
  ) {
    throw invalidWriteResponse(request, endpoint);
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

  public async write(request: ModbusWriteRequest): Promise<void> {
    const ownedRequest = createModbusWriteRequest(request);
    this.#client.setID(ownedRequest.unitId);
    try {
      const result = await this.#client.writeRegisters(ownedRequest.address, [
        ...ownedRequest.words,
      ]);
      validateWriteAcknowledgement(result, ownedRequest, this.#endpoint);
    } catch (error) {
      throw normalizeAdapterError(error, "write", this.#endpoint);
    }
  }

  public async readCoils(input: CoilReadRequestInput): Promise<readonly boolean[]> {
    const readCoils = this.#client.readCoils;
    if (readCoils === undefined) {
      throw createNormalizedTransportFailure(
        NormalizedTransportFailureKind.NO_RESPONSE,
        "The modbus-serial backend does not expose readCoils (FC01)",
        this.#endpoint,
      );
    }
    this.#client.setID(this.#configuration.unitId);
    try {
      const result = await readCoils.call(this.#client, input.address, input.count);
      return extractBits(result, input, this.#endpoint);
    } catch (error) {
      throw normalizeAdapterError(error, "read", this.#endpoint);
    }
  }

  public async writeCoil(input: CoilWriteRequestInput): Promise<void> {
    const writeCoil = this.#client.writeCoil;
    if (writeCoil === undefined) {
      throw createNormalizedTransportFailure(
        NormalizedTransportFailureKind.NO_RESPONSE,
        "The modbus-serial backend does not expose writeCoil (FC05)",
        this.#endpoint,
      );
    }
    this.#client.setID(this.#configuration.unitId);
    try {
      await writeCoil.call(this.#client, input.address, input.value);
    } catch (error) {
      throw normalizeAdapterError(error, "write", this.#endpoint);
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
        if (error === undefined || error === null || error === false) {
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
