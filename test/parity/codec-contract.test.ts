import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ModbusCodec } from "../../src/codec.js";
import { normalizeTaggedValue, parseTaggedValue } from "../../src/contracts/tagged-values.js";

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
  };
  readonly schema_version: number;
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
      return { words, value: ModbusCodec.decodeFloat32(words) };
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
