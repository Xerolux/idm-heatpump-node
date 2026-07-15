import type { RegisterDef } from "./registers/definitions.js";
import { DataType, type DataType as DataTypeValue } from "./types.js";

type CodecValidationCode =
  | "codec_input_empty"
  | "codec_input_short"
  | "codec_word_range"
  | "codec_not_numeric"
  | "codec_nonfinite"
  | "codec_float_overflow"
  | "codec_uchar_range"
  | "codec_int8_range"
  | "codec_int16_range"
  | "codec_uint16_range"
  | "register_invalid";

class CodecValidationError extends RangeError {
  public readonly category = "validation" as const;
  public readonly code: CodecValidationCode;
  public readonly diagnostic: string;

  public constructor(code: CodecValidationCode, diagnostic: string) {
    super(diagnostic);
    this.name = "CodecValidationError";
    this.code = code;
    this.diagnostic = diagnostic;
  }
}

function invalid(code: CodecValidationCode, diagnostic: string): never {
  throw new CodecValidationError(code, diagnostic);
}

function requireNumeric(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number") {
    invalid("codec_not_numeric", `${label} must be numeric`);
  }
}

function requireFiniteInteger(value: unknown, label: string): asserts value is number {
  requireNumeric(value, label);
  if (!Number.isFinite(value)) {
    invalid("codec_nonfinite", `${label} must be finite`);
  }
  if (!Number.isInteger(value)) {
    invalid("codec_not_numeric", `${label} must be an integer`);
  }
}

function requireUnsignedWord(value: unknown, label: string): asserts value is number {
  requireFiniteInteger(value, label);
  if (value < 0 || value > 0xffff) {
    invalid("codec_word_range", `${label} must be between 0 and 65535`);
  }
}

function maskInteger(value: unknown, bits: 8 | 16, label: string): number {
  requireFiniteInteger(value, label);
  const modulus = 2 ** bits;
  return ((value % modulus) + modulus) % modulus;
}

function encodeSigned(value: unknown, minimum: number, maximum: number, modulus: number): number {
  requireFiniteInteger(value, "Value");
  if (value < minimum || value > maximum) {
    const code = modulus === 0x100 ? "codec_int8_range" : "codec_int16_range";
    invalid(code, `Value ${String(value)} out of INT${modulus === 0x100 ? "8" : "16"} range`);
  }
  return value < 0 ? value + modulus : value;
}

function firstWord(registers: readonly number[]): number {
  return registers[0] as number;
}

function immutableWords(...values: readonly number[]): readonly number[] {
  return Object.freeze([...values]);
}

function numericValue(value: unknown, label: string): number {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  requireNumeric(value, label);
  return value;
}

function requireFiniteNumericValue(value: unknown, label: string): number {
  const numeric = numericValue(value, label);
  if (!Number.isFinite(numeric)) {
    invalid("codec_nonfinite", `${label} must be finite`);
  }
  return numeric;
}

function roundHalfEvenInteger(value: number): number {
  if (!Number.isFinite(value)) {
    invalid("codec_nonfinite", "Integer codec value must be finite");
  }

  const lower = Math.floor(value);
  const fraction = value - lower;
  if (fraction < 0.5) {
    return lower;
  }
  if (fraction > 0.5) {
    return lower + 1;
  }
  return lower % 2 === 0 ? lower : lower + 1;
}

function roundedCentsToNumber(cents: bigint, negative: boolean): number {
  const absolute = cents < 0n ? -cents : cents;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  return Number(`${negative ? "-" : ""}${whole.toString()}.${fraction}`);
}

/** Match CPython's correctly rounded binary-float round(value, 2). */
function roundBinaryFloatToTwoDigits(value: number): number {
  if (!Number.isFinite(value)) {
    return value;
  }

  const negative = value < 0 || Object.is(value, -0);
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, Math.abs(value), false);
  const high = view.getUint32(0, false);
  const low = view.getUint32(4, false);
  const exponentBits = (high >>> 20) & 0x7ff;
  const fractionBits = (BigInt(high & 0x000f_ffff) << 32n) | BigInt(low);
  const significand = exponentBits === 0 ? fractionBits : (1n << 52n) | fractionBits;
  const binaryExponent = exponentBits === 0 ? -1074 : exponentBits - 1023 - 52;

  let numerator = significand * 100n;
  let denominator = 1n;
  if (binaryExponent >= 0) {
    numerator <<= BigInt(binaryExponent);
  } else {
    denominator <<= BigInt(-binaryExponent);
  }

  let rounded = numerator / denominator;
  const remainder = numerator % denominator;
  const comparison = remainder * 2n - denominator;
  if (comparison > 0n || (comparison === 0n && rounded % 2n !== 0n)) {
    rounded += 1n;
  }

  const signed = negative ? -rounded : rounded;
  return roundedCentsToNumber(signed, negative);
}

function pythonTruth(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "bigint") {
    return value !== 0n;
  }
  if (typeof value === "string") {
    return value.length > 0;
  }
  return true;
}

/** Bit-exact primitive codecs matching the pinned Python ModbusCodec surface. */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Public parity requires this static class representation.
export class ModbusCodec {
  public static decodeFloat32(registers: readonly number[], swapped = false): number {
    if (registers.length < 2) {
      invalid("codec_input_short", "FLOAT32 decoding requires two registers");
    }

    const first = registers[swapped ? 1 : 0];
    const second = registers[swapped ? 0 : 1];
    requireUnsignedWord(first, "FLOAT32 low word");
    requireUnsignedWord(second, "FLOAT32 high word");

    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint16(0, first, true);
    view.setUint16(2, second, true);
    return view.getFloat32(0, true);
  }

  public static encodeFloat32(value: number, swapped = false): readonly [number, number] {
    requireNumeric(value, "FLOAT32 value");

    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setFloat32(0, value, true);
    const narrowed = view.getFloat32(0, true);
    if (Number.isFinite(value) && !Number.isFinite(narrowed)) {
      invalid("codec_float_overflow", "float too large to pack with f format");
    }

    const low = view.getUint16(0, true);
    const high = view.getUint16(2, true);
    return swapped ? [high, low] : [low, high];
  }

  public static decodeInt16(register: number): number {
    const value = maskInteger(register, 16, "INT16 register");
    return value >= 0x8000 ? value - 0x1_0000 : value;
  }

  public static encodeInt16(value: number): number {
    return encodeSigned(value, -0x8000, 0x7fff, 0x1_0000);
  }

  public static decodeInt8(register: number): number {
    const value = maskInteger(register, 8, "INT8 register");
    return value >= 0x80 ? value - 0x100 : value;
  }

  public static encodeInt8(value: number): number {
    return encodeSigned(value, -0x80, 0x7f, 0x100);
  }
}

type DecodedValue = number | boolean | null;
type Decoder = (registers: readonly number[], register: RegisterDef) => DecodedValue;
type Encoder = (value: unknown, register: RegisterDef) => readonly number[];

const decodeFloat: Decoder = (registers, register) => {
  const value = ModbusCodec.decodeFloat32(registers);
  if (!Number.isFinite(value)) {
    return null;
  }
  return roundBinaryFloatToTwoDigits(value * register.multiplier);
};

const decodeUchar: Decoder = (registers, register) => {
  const value = maskInteger(firstWord(registers), 8, "UCHAR register");
  return register.multiplier === 1
    ? value
    : roundBinaryFloatToTwoDigits(value * register.multiplier);
};

const decodeInt8: Decoder = (registers, register) => {
  const value = ModbusCodec.decodeInt8(firstWord(registers));
  return register.multiplier === 1
    ? value
    : roundBinaryFloatToTwoDigits(value * register.multiplier);
};

const decodeInt16: Decoder = (registers, register) => {
  const value = ModbusCodec.decodeInt16(firstWord(registers));
  return register.multiplier === 1
    ? value
    : roundBinaryFloatToTwoDigits(value * register.multiplier);
};

const decodeUint16: Decoder = (registers, register) => {
  const value = firstWord(registers);
  return register.multiplier === 1
    ? value
    : roundBinaryFloatToTwoDigits(value * register.multiplier);
};

const decodeBool: Decoder = (registers) =>
  maskInteger(firstWord(registers), 8, "BOOL register") % 2 === 1;

const decodeBitflag: Decoder = (registers) =>
  maskInteger(firstWord(registers), 8, "BITFLAG register");

const DECODERS: Readonly<Record<DataTypeValue, Decoder>> = Object.freeze({
  [DataType.FLOAT]: decodeFloat,
  [DataType.UCHAR]: decodeUchar,
  [DataType.INT8]: decodeInt8,
  [DataType.INT16]: decodeInt16,
  [DataType.UINT16]: decodeUint16,
  [DataType.BOOL]: decodeBool,
  [DataType.BITFLAG]: decodeBitflag,
});

const encodeFloat: Encoder = (value, register) => {
  const scaled =
    requireFiniteNumericValue(value, `Value for ${register.name}`) / register.multiplier;
  if (!Number.isFinite(scaled)) {
    invalid("codec_nonfinite", `Cannot encode NaN/Inf for register ${register.name}`);
  }
  return immutableWords(...ModbusCodec.encodeFloat32(scaled));
};

const encodeUchar: Encoder = (value, register) => {
  const scaled =
    requireFiniteNumericValue(value, `Value for ${register.name}`) / register.multiplier;
  const encoded = roundHalfEvenInteger(scaled);
  if (encoded < 0 || encoded > 0xff) {
    invalid("codec_uchar_range", `Value ${String(value)} out of UCHAR range for ${register.name}`);
  }
  return immutableWords(maskInteger(encoded, 8, "UCHAR value"));
};

const encodeInt8: Encoder = (value, register) => {
  const scaled =
    requireFiniteNumericValue(value, `Value for ${register.name}`) / register.multiplier;
  const encoded = ModbusCodec.encodeInt8(roundHalfEvenInteger(scaled));
  return immutableWords(maskInteger(encoded, 8, "INT8 value"));
};

const encodeInt16: Encoder = (value, register) => {
  const scaled =
    requireFiniteNumericValue(value, `Value for ${register.name}`) / register.multiplier;
  const encoded = ModbusCodec.encodeInt16(roundHalfEvenInteger(scaled));
  return immutableWords(maskInteger(encoded, 16, "INT16 value"));
};

const encodeUint16: Encoder = (value, register) => {
  const scaled =
    requireFiniteNumericValue(value, `Value for ${register.name}`) / register.multiplier;
  const encoded = roundHalfEvenInteger(scaled);
  if (encoded < 0 || encoded > 0xffff) {
    invalid(
      "codec_uint16_range",
      `Value ${String(value)} out of UINT16 range for ${register.name}`,
    );
  }
  return immutableWords(maskInteger(encoded, 16, "UINT16 value"));
};

const encodeBool: Encoder = (value) => immutableWords(pythonTruth(value) ? 1 : 0);

const encodeBitflag: Encoder = (value, register) => {
  const numeric = requireFiniteNumericValue(value, `Value for ${register.name}`);
  return immutableWords(maskInteger(Math.trunc(numeric), 8, "BITFLAG value"));
};

const ENCODERS: Readonly<Record<DataTypeValue, Encoder>> = Object.freeze({
  [DataType.FLOAT]: encodeFloat,
  [DataType.UCHAR]: encodeUchar,
  [DataType.INT8]: encodeInt8,
  [DataType.INT16]: encodeInt16,
  [DataType.UINT16]: encodeUint16,
  [DataType.BOOL]: encodeBool,
  [DataType.BITFLAG]: encodeBitflag,
});

/** Internal semantic helper for the later IdmModbusClient implementation. */
export function decodeValue(registers: readonly number[], register: RegisterDef): DecodedValue {
  if (registers.length === 0) {
    invalid(
      "codec_input_empty",
      `Empty register list for ${register.name} (expected ${String(register.size)})`,
    );
  }
  if (registers.length < register.size) {
    invalid(
      "codec_input_short",
      `Not enough registers for ${register.name}: got ${String(registers.length)}, need ${String(register.size)}`,
    );
  }
  if (!Object.hasOwn(DECODERS, register.datatype)) {
    invalid("register_invalid", `Unsupported datatype for decoding: ${String(register.datatype)}`);
  }
  return DECODERS[register.datatype](registers, register);
}

/** Internal semantic helper for the later IdmModbusClient implementation. */
export function encodeValue(value: unknown, register: RegisterDef): readonly number[] {
  if (!Object.hasOwn(ENCODERS, register.datatype)) {
    invalid("register_invalid", `Unsupported datatype for encoding: ${String(register.datatype)}`);
  }
  return ENCODERS[register.datatype](value, register);
}
