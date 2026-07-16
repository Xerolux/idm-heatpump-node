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

export interface ModbusTransport {
  readonly connected: boolean;
  connect(): Promise<void>;
  close(): Promise<void>;
  destroy(): Promise<void>;
  read(request: ModbusReadRequest): Promise<readonly number[]>;
}

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
