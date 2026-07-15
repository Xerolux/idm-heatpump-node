type CodecValidationCode =
  | "codec_input_short"
  | "codec_word_range"
  | "codec_not_numeric"
  | "codec_nonfinite"
  | "codec_float_overflow"
  | "codec_int8_range"
  | "codec_int16_range";

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
