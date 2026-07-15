import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ModbusCodec } from "../../src/codec.js";
import { normalizeTaggedValue, parseTaggedValue } from "../../src/contracts/tagged-values.js";
import { decodeValue, encodeValue } from "../../src/codec.js";
import { createRegisterDef } from "../../src/registers/definitions.js";
import { DataType, type DataType as DataTypeValue } from "../../src/types.js";

interface ValidationExpectation {
  readonly category: "validation";
  readonly code: string;
  readonly diagnostic: string;
}

interface CodecCase {
  readonly id: string;
  readonly operation: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly expected_result?: unknown;
  readonly expected_error?: ValidationExpectation;
}

interface CodecFixture {
  readonly baseline: { readonly git_commit: string };
  readonly layers: {
    readonly primitive: { readonly cases: readonly CodecCase[] };
    readonly register: { readonly cases: readonly CodecCase[] };
  };
  readonly schema_version: number;
}

function registerFor(input: Readonly<Record<string, unknown>>) {
  const datatype = input.datatype as DataTypeValue;
  return createRegisterDef({
    address: 1,
    datatype,
    name: `${datatype.toLowerCase()}_case`,
    ...(typeof input.multiplier === "number" ? { multiplier: input.multiplier } : {}),
  });
}

function runRegisterCase(testCase: CodecCase): unknown {
  const input = parsed<Record<string, unknown>>(testCase.input);
  const definition = registerFor(input);

  switch (testCase.operation) {
    case "decode_value": {
      const words = input.words as readonly number[];
      return Array.isArray(testCase.expected_result) && input.datatype === DataType.BOOL
        ? words.map((word) => decodeValue([word], definition))
        : decodeValue(words, definition);
    }
    case "encode_value":
      return Array.isArray(input.values)
        ? (input.values as readonly number[]).map((value) => encodeValue(value, definition))
        : encodeValue(input.value, definition);
    case "encode_decode_value": {
      const encoded = encodeValue(input.value, definition);
      return { encoded, decoded: decodeValue(encoded, definition) };
    }
    default:
      throw new Error(`Unsupported register fixture operation: ${testCase.operation}`);
  }
}

const fixture = JSON.parse(
  readFileSync("test/fixtures/codec-vectors.json", "utf8"),
) as CodecFixture;

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Missing codec fixture value: ${label}`);
  }
  return value;
}

function parsed<T>(value: unknown): T {
  return parseTaggedValue(value) as T;
}

function runPrimitiveCase(testCase: CodecCase): unknown {
  const input = parsed<Record<string, unknown>>(testCase.input);

  switch (testCase.operation) {
    case "decode_float32":
      return ModbusCodec.decodeFloat32(
        input.words as readonly number[],
        (input.swapped as boolean | undefined) ?? false,
      );
    case "encode_float32":
      return ModbusCodec.encodeFloat32(input.value as number);
    case "encode_decode_float32": {
      const words = ModbusCodec.encodeFloat32(input.value as number);
      const value = ModbusCodec.decodeFloat32(words);
      return typeof testCase.expected_result === "object" && testCase.expected_result !== null
        ? { words, value }
        : value;
    }
    case "decode_int8":
      return (input.words as readonly number[]).map((word) => ModbusCodec.decodeInt8(word));
    case "encode_int8":
      return ModbusCodec.encodeInt8(input.value as number);
    case "int8":
      return (input.values as readonly number[]).map((value) => {
        const word = ModbusCodec.encodeInt8(value);
        return { value, word, decoded: ModbusCodec.decodeInt8(word) };
      });
    case "decode_int16":
      return (input.words as readonly number[]).map((word) => ModbusCodec.decodeInt16(word));
    case "encode_int16":
      return ModbusCodec.encodeInt16(input.value as number);
    case "int16":
      return (input.values as readonly number[]).map((value) => {
        const word = ModbusCodec.encodeInt16(value);
        return { value, word, decoded: ModbusCodec.decodeInt16(word) };
      });
    default:
      throw new Error(`Unsupported primitive fixture operation: ${testCase.operation}`);
  }
}

describe("pinned primitive codec golden contract", () => {
  it("is bound to the exact Python baseline and closed primitive case inventory", () => {
    expect(fixture.schema_version).toBe(1);
    expect(fixture.baseline.git_commit).toBe("ad121ebf34a5f5e37204371c026927d77efcd15c");
    expect(fixture.layers.primitive.cases).toHaveLength(19);
    expect(new Set(fixture.layers.primitive.cases.map(({ id }) => id))).toHaveLength(19);
  });

  for (const testCase of fixture.layers.primitive.cases) {
    it(`matches Python primitive vector: ${testCase.id}`, () => {
      if (testCase.expected_error !== undefined) {
        try {
          runPrimitiveCase(testCase);
        } catch (error) {
          expect(error).toMatchObject({
            category: testCase.expected_error.category,
            code: testCase.expected_error.code,
          });
          return;
        }
        throw new Error(`Expected primitive vector to reject: ${testCase.id}`);
      }

      const actual = normalizeTaggedValue(runPrimitiveCase(testCase));
      expect(actual).toEqual(required(testCase.expected_result, testCase.id));
    });
  }
});

describe("pinned register-aware codec golden contract", () => {
  it("has the complete generated register case inventory", () => {
    expect(fixture.layers.register.cases).toHaveLength(17);
    expect(new Set(fixture.layers.register.cases.map(({ id }) => id))).toHaveLength(17);
  });

  for (const testCase of fixture.layers.register.cases) {
    it(`matches Python register vector: ${testCase.id}`, () => {
      if (testCase.expected_error !== undefined) {
        try {
          runRegisterCase(testCase);
        } catch (error) {
          expect(error).toMatchObject({
            category: testCase.expected_error.category,
            code: testCase.expected_error.code,
          });
          return;
        }
        throw new Error(`Expected register vector to reject: ${testCase.id}`);
      }

      const actual = normalizeTaggedValue(runRegisterCase(testCase));
      expect(actual).toEqual(required(testCase.expected_result, testCase.id));
    });
  }
});
