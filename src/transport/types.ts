import { RegisterType } from "../types.js";

export const MODBUS_READ_LIMITS = Object.freeze({
  minimumUnitId: 1,
  maximumUnitId: 247,
  minimumAddress: 0,
  maximumAddress: 0xffff,
  minimumCount: 1,
  maximumCount: 125,
  minimumTimeoutMs: 1,
  maximumTimeoutMs: 0x7fffffff,
} as const);

export const MODBUS_WRITE_LIMITS = Object.freeze({
  minimumUnitId: 1,
  maximumUnitId: 247,
  minimumAddress: 0,
  maximumAddress: 0xffff,
  minimumCount: 1,
  maximumCount: 123,
  minimumWord: 0,
  maximumWord: 0xffff,
} as const);

export interface ModbusReadRequestInput {
  readonly unitId: number;
  readonly registerType: RegisterType;
  readonly functionCode: 3 | 4;
  readonly address: number;
  readonly count: number;
  readonly timeoutMs?: number;
}

export interface ModbusReadRequest {
  readonly unitId: number;
  readonly registerType: RegisterType;
  readonly functionCode: 3 | 4;
  readonly address: number;
  readonly count: number;
  readonly timeoutMs?: number;
}

export interface ModbusWriteRequestInput {
  readonly unitId: number;
  readonly registerType: typeof RegisterType.HOLDING;
  readonly functionCode: 16;
  readonly address: number;
  readonly count: number;
  readonly words: readonly number[];
}

export interface ModbusWriteRequest {
  readonly unitId: number;
  readonly registerType: typeof RegisterType.HOLDING;
  readonly functionCode: 16;
  readonly address: number;
  readonly count: number;
  readonly words: readonly number[];
}

export interface ModbusTransport {
  readonly connected: boolean;
  connect(): Promise<void>;
  close(): Promise<void>;
  destroy(): Promise<void>;
  read(request: ModbusReadRequest): Promise<readonly number[]>;
  write(request: ModbusWriteRequest): Promise<void>;
}

/** Backwards-compatible name for the Phase-3 write-capable transport boundary. */
export type ModbusWriteTransport = ModbusTransport;

function requireBoundedInteger(
  value: number,
  minimum: number,
  maximum: number,
  field: string,
): void {
  if (!Number.isInteger(value) || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${field} must be an integer in ${minimum}..${maximum}`);
  }
}

export function createModbusReadRequest(input: ModbusReadRequestInput): ModbusReadRequest {
  requireBoundedInteger(
    input.unitId,
    MODBUS_READ_LIMITS.minimumUnitId,
    MODBUS_READ_LIMITS.maximumUnitId,
    "unitId",
  );
  requireBoundedInteger(
    input.address,
    MODBUS_READ_LIMITS.minimumAddress,
    MODBUS_READ_LIMITS.maximumAddress,
    "address",
  );
  requireBoundedInteger(
    input.count,
    MODBUS_READ_LIMITS.minimumCount,
    MODBUS_READ_LIMITS.maximumCount,
    "count",
  );
  if (input.address + input.count > MODBUS_READ_LIMITS.maximumAddress + 1) {
    throw new RangeError("address and count exceed the Modbus address space");
  }
  if (input.timeoutMs !== undefined) {
    requireBoundedInteger(
      input.timeoutMs,
      MODBUS_READ_LIMITS.minimumTimeoutMs,
      MODBUS_READ_LIMITS.maximumTimeoutMs,
      "timeoutMs",
    );
  }

  const validFunction =
    (input.registerType === RegisterType.HOLDING && input.functionCode === 3) ||
    (input.registerType === RegisterType.INPUT && input.functionCode === 4);
  if (!validFunction) {
    throw new RangeError("functionCode does not match registerType");
  }

  return Object.freeze({
    unitId: input.unitId,
    registerType: input.registerType,
    functionCode: input.functionCode,
    address: input.address,
    count: input.count,
    ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs }),
  });
}

export function createModbusWriteRequest(input: ModbusWriteRequestInput): ModbusWriteRequest {
  requireBoundedInteger(
    input.unitId,
    MODBUS_WRITE_LIMITS.minimumUnitId,
    MODBUS_WRITE_LIMITS.maximumUnitId,
    "unitId",
  );
  requireBoundedInteger(
    input.address,
    MODBUS_WRITE_LIMITS.minimumAddress,
    MODBUS_WRITE_LIMITS.maximumAddress,
    "address",
  );
  requireBoundedInteger(
    input.count,
    MODBUS_WRITE_LIMITS.minimumCount,
    MODBUS_WRITE_LIMITS.maximumCount,
    "count",
  );
  if (input.address + input.count > MODBUS_WRITE_LIMITS.maximumAddress + 1) {
    throw new RangeError("address and count exceed the Modbus address space");
  }
  if (input.registerType !== RegisterType.HOLDING || input.functionCode !== 16) {
    throw new RangeError("writes require holding registers and functionCode 16");
  }
  if (!Array.isArray(input.words)) {
    throw new TypeError("Modbus write words must be an array");
  }
  if (input.words.length !== input.count) {
    throw new RangeError("Modbus write count must equal the word payload length");
  }

  const words: number[] = [];
  for (let index = 0; index < input.words.length; index += 1) {
    if (!Object.hasOwn(input.words, index)) {
      throw new TypeError(`words[${String(index)}] must be present`);
    }
    const word = input.words[index] as number;
    requireBoundedInteger(
      word,
      MODBUS_WRITE_LIMITS.minimumWord,
      MODBUS_WRITE_LIMITS.maximumWord,
      `words[${String(index)}]`,
    );
    words.push(word);
  }

  return Object.freeze({
    unitId: input.unitId,
    registerType: RegisterType.HOLDING,
    functionCode: 16,
    address: input.address,
    count: input.count,
    words: Object.freeze(words),
  });
}

export function validateModbusWords(
  words: readonly number[],
  expectedCount?: number,
): readonly number[] {
  if (!Array.isArray(words)) {
    throw new TypeError("Modbus words must be an array");
  }
  if (expectedCount !== undefined) {
    requireBoundedInteger(
      expectedCount,
      MODBUS_READ_LIMITS.minimumCount,
      MODBUS_READ_LIMITS.maximumCount,
      "expectedCount",
    );
    if (words.length !== expectedCount) {
      throw new RangeError(`Modbus response must contain exactly ${expectedCount} words`);
    }
  }

  const owned = words.map((word, index) => {
    requireBoundedInteger(word, 0, 0xffff, `words[${index}]`);
    return word;
  });
  return Object.freeze(owned);
}
