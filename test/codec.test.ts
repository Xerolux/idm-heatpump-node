import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ModbusCodec } from "../src/codec.js";

interface MappingRow {
  readonly python_symbol: string;
  readonly typescript_symbol: string;
  readonly export_path: string;
  readonly owner_phase: number;
  readonly normalizations: readonly string[];
  readonly representation: {
    readonly form: string;
    readonly constructor: string;
    readonly member_naming?: string;
    readonly python_class?: string;
    readonly validation: string;
  };
}

interface ApiMapping {
  readonly mappings: readonly MappingRow[];
}

interface ParameterFact {
  readonly name: string;
  readonly kind: string;
  readonly default: { readonly kind: string; readonly value?: unknown };
}

interface MemberFact {
  readonly kind: string;
  readonly name: string;
  readonly parameters: readonly ParameterFact[];
}

interface ClassFact {
  readonly python_name: string;
  readonly public_names: readonly string[];
  readonly members: readonly MemberFact[];
}

interface PublicClasses {
  readonly classes: readonly ClassFact[];
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

const mapping = readJson<ApiMapping>("contracts/api-mapping.json");
const publicClasses = readJson<PublicClasses>("test/fixtures/public-classes.json");

function requireValue<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Missing fixture value: ${label}`);
  }
  return value;
}

function camelCase(name: string): string {
  return name.replace(/_([a-z0-9])/g, (_match, character: string) => character.toUpperCase());
}

function expectCodecError(callback: () => unknown, code: string): void {
  expect(callback).toThrowError(
    expect.objectContaining({
      category: "validation",
      code,
    }),
  );
}

describe("public primitive ModbusCodec mapping", () => {
  it("implements the exact mapping-owned class and six Python static members", () => {
    const row = requireValue(
      mapping.mappings.find(({ python_symbol }) => python_symbol === "ModbusCodec"),
      "ModbusCodec mapping",
    );
    const facts = requireValue(
      publicClasses.classes.find(({ python_name }) => python_name === "ModbusCodec"),
      "ModbusCodec class facts",
    );

    expect(row).toMatchObject({
      typescript_symbol: "ModbusCodec",
      export_path: ".",
      owner_phase: 1,
      normalizations: ["snake_case_to_camelCase"],
      representation: {
        form: "class",
        constructor: "class",
        member_naming: "snake_case_to_camelCase",
        python_class: "ModbusCodec",
        validation: "python_fixture",
      },
    });
    expect(ModbusCodec.name).toBe(row.typescript_symbol);
    expect(facts.public_names).toEqual(["ModbusCodec"]);

    const expectedMembers = facts.members.map(({ name }) => camelCase(name)).sort();
    const actualMembers = Object.getOwnPropertyNames(ModbusCodec)
      .filter((name) => !["length", "name", "prototype"].includes(name))
      .sort();

    expect(expectedMembers).toEqual([
      "decodeFloat32",
      "decodeInt16",
      "decodeInt8",
      "encodeFloat32",
      "encodeInt16",
      "encodeInt8",
    ]);
    expect(actualMembers).toEqual(expectedMembers);
    expect(facts.members.every(({ kind }) => kind === "staticmethod")).toBe(true);
    expect(new ModbusCodec()).toBeInstanceOf(ModbusCodec);
  });

  it("preserves generated required/default parameter shapes", () => {
    const facts = requireValue(
      publicClasses.classes.find(({ python_name }) => python_name === "ModbusCodec"),
      "ModbusCodec class facts",
    );
    const byName = new Map(facts.members.map((member) => [member.name, member]));

    for (const name of ["decode_float32", "encode_float32"]) {
      const parameters = requireValue(byName.get(name), name).parameters;
      expect(parameters).toHaveLength(2);
      expect(parameters[0]?.default.kind).toBe("required");
      expect(parameters[1]).toMatchObject({
        name: "swapped",
        kind: "KEYWORD_ONLY",
        default: { kind: "value", value: false },
      });
    }
    for (const name of ["decode_int16", "encode_int16", "decode_int8", "encode_int8"]) {
      const parameters = requireValue(byName.get(name), name).parameters;
      expect(parameters).toHaveLength(1);
      expect(parameters[0]?.default.kind).toBe("required");
    }

    expect(ModbusCodec.decodeFloat32([0, 16_256])).toBe(1);
    expect(ModbusCodec.encodeFloat32(1)).toEqual([0, 16_256]);
  });
});

describe("primitive Float32 codec", () => {
  it.each([
    [0, [0, 0]],
    [-0, [0, 32_768]],
    [1, [0, 16_256]],
    [-1, [0, 49_024]],
    [Number.NaN, [0, 32_704]],
    [Number.POSITIVE_INFINITY, [0, 32_640]],
    [Number.NEGATIVE_INFINITY, [0, 65_408]],
    [3.402_823_466_385_288_6e38, [65_535, 32_639]],
    [1.401_298_464_324_817e-45, [1, 0]],
  ])("encodes and decodes %s low-word first", (value, expectedWords) => {
    const words = ModbusCodec.encodeFloat32(value);
    const decoded = ModbusCodec.decodeFloat32(words);

    expect(words).toEqual(expectedWords);
    if (Number.isNaN(value)) {
      expect(Number.isNaN(decoded)).toBe(true);
    } else {
      expect(Object.is(decoded, value)).toBe(true);
    }
  });

  it("supports swapped words and ignores the same extra words as Python", () => {
    expect(ModbusCodec.encodeFloat32(1, true)).toEqual([16_256, 0]);
    expect(ModbusCodec.decodeFloat32([16_256, 0], true)).toBe(1);
    expect(ModbusCodec.decodeFloat32([0, 16_256, 65_535])).toBe(1);
  });

  it("rejects short, malformed, and out-of-range Float32 words without coercion", () => {
    expectCodecError(() => ModbusCodec.decodeFloat32([]), "codec_input_short");
    expectCodecError(() => ModbusCodec.decodeFloat32([0]), "codec_input_short");
    expectCodecError(() => ModbusCodec.decodeFloat32([-1, 0]), "codec_word_range");
    expectCodecError(() => ModbusCodec.decodeFloat32([65_536, 0]), "codec_word_range");
    expectCodecError(() => ModbusCodec.decodeFloat32([1.5, 0]), "codec_not_numeric");
    expectCodecError(
      () => ModbusCodec.decodeFloat32([Number.POSITIVE_INFINITY, 0]),
      "codec_nonfinite",
    );
    expectCodecError(
      () => ModbusCodec.decodeFloat32(["1" as unknown as number, 0]),
      "codec_not_numeric",
    );
  });

  it("rejects finite values that Python Float32 packing cannot represent", () => {
    expectCodecError(() => ModbusCodec.encodeFloat32(3.5e38), "codec_float_overflow");
    expectCodecError(() => ModbusCodec.encodeFloat32(Number.MAX_VALUE), "codec_float_overflow");
    expectCodecError(
      () => ModbusCodec.encodeFloat32("1" as unknown as number),
      "codec_not_numeric",
    );
  });
});

describe("primitive signed integer codecs", () => {
  it("round-trips exact INT8 and INT16 boundaries", () => {
    expect(ModbusCodec.encodeInt8(-128)).toBe(128);
    expect(ModbusCodec.decodeInt8(128)).toBe(-128);
    expect(ModbusCodec.encodeInt8(127)).toBe(127);
    expect(ModbusCodec.decodeInt8(127)).toBe(127);

    expect(ModbusCodec.encodeInt16(-32_768)).toBe(32_768);
    expect(ModbusCodec.decodeInt16(32_768)).toBe(-32_768);
    expect(ModbusCodec.encodeInt16(32_767)).toBe(32_767);
    expect(ModbusCodec.decodeInt16(32_767)).toBe(32_767);
  });

  it("masks arbitrary negative and oversized integers instead of applying a u16 guard", () => {
    expect(ModbusCodec.decodeInt8(-1)).toBe(-1);
    expect(ModbusCodec.decodeInt8(511)).toBe(-1);
    expect(ModbusCodec.decodeInt8(-257)).toBe(-1);
    expect(ModbusCodec.decodeInt16(-1)).toBe(-1);
    expect(ModbusCodec.decodeInt16(131_071)).toBe(-1);
    expect(ModbusCodec.decodeInt16(-65_537)).toBe(-1);
  });

  it("rejects only malformed decoder inputs and primitive encoder range failures", () => {
    expectCodecError(() => ModbusCodec.decodeInt8(1.5), "codec_not_numeric");
    expectCodecError(() => ModbusCodec.decodeInt16(Number.NaN), "codec_nonfinite");
    expectCodecError(() => ModbusCodec.encodeInt8(-129), "codec_int8_range");
    expectCodecError(() => ModbusCodec.encodeInt8(128), "codec_int8_range");
    expectCodecError(() => ModbusCodec.encodeInt16(-32_769), "codec_int16_range");
    expectCodecError(() => ModbusCodec.encodeInt16(32_768), "codec_int16_range");
  });
});
