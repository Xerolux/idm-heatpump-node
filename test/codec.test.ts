import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { decodeValue, encodeValue, ModbusCodec } from "../src/codec.js";
import { createRegisterDef, type RegisterDef } from "../src/registers/definitions.js";
import { DataType, type DataType as DataTypeValue } from "../src/types.js";
import * as rootExports from "../src/index.js";

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

function register(
  datatype: DataTypeValue,
  options: {
    readonly multiplier?: number;
    readonly name?: string;
    readonly sentinelValues?: readonly (number | string)[];
  } = {},
): RegisterDef {
  return createRegisterDef({
    address: 1,
    datatype,
    name: options.name ?? `${datatype.toLowerCase()}_case`,
    ...(options.multiplier === undefined ? {} : { multiplier: options.multiplier }),
    ...(options.sentinelValues === undefined ? {} : { sentinelValues: options.sentinelValues }),
  });
}

describe("internal register-aware codec ownership", () => {
  it("keeps helpers out of the 89-row mapping and package root after client completion", () => {
    expect(mapping.mappings).toHaveLength(89);
    expect(
      mapping.mappings.some(({ typescript_symbol }) =>
        ["decodeValue", "encodeValue"].includes(typescript_symbol),
      ),
    ).toBe(false);
    expect("decodeValue" in rootExports).toBe(false);
    expect("encodeValue" in rootExports).toBe(false);

    expect(
      mapping.mappings.find(({ python_symbol }) => python_symbol === "IdmModbusClient"),
    ).toMatchObject({
      typescript_symbol: "IdmModbusClient",
      owner_phase: 2,
      status: "complete",
    });
  });
});

describe("register-aware decoding", () => {
  it("dispatches every datatype with its exact Python word domain", () => {
    expect(decodeValue([0, 16_256, 65_535], register(DataType.FLOAT))).toBe(1);
    expect(decodeValue([511], register(DataType.UCHAR))).toBe(255);
    expect(decodeValue([-1], register(DataType.UCHAR))).toBe(255);
    expect(decodeValue([511], register(DataType.INT8))).toBe(-1);
    expect(decodeValue([-1], register(DataType.INT8))).toBe(-1);
    expect(decodeValue([131_071], register(DataType.INT16))).toBe(-1);
    expect(decodeValue([-1], register(DataType.INT16))).toBe(-1);
    expect(decodeValue([-1, 2], register(DataType.UINT16))).toBe(-1);
    expect([0, 1, 2, 3].map((word) => decodeValue([word], register(DataType.BOOL)))).toEqual([
      false,
      true,
      false,
      true,
    ]);
    expect(decodeValue([511], register(DataType.BITFLAG))).toBe(255);
    expect(decodeValue([-1], register(DataType.BITFLAG))).toBe(255);
  });

  it("applies multipliers and Python binary-float round(value, 2)", () => {
    expect(decodeValue([123], register(DataType.UINT16, { multiplier: 0.1 }))).toBe(12.3);
    expect(decodeValue([15], register(DataType.INT8, { multiplier: 0.1 }))).toBe(1.5);
    expect(decodeValue([15], register(DataType.UCHAR, { multiplier: 0.1 }))).toBe(1.5);

    const roundCases = [
      [1.005, 1],
      [2.675, 2.67],
      [-1.225, -1.23],
      [1.125, 1.12],
      [-1.125, -1.12],
    ] as const;
    for (const [value, expected] of roundCases) {
      expect(decodeValue(ModbusCodec.encodeFloat32(value), register(DataType.FLOAT))).toBe(
        expected,
      );
    }

    expect(decodeValue([0x0001, 0x3f90], register(DataType.FLOAT))).toBe(1.13);
    expect(decodeValue([0xffff, 0x3f8f], register(DataType.FLOAT))).toBe(1.12);
    expect(decodeValue([0x0001, 0xbf90], register(DataType.FLOAT))).toBe(-1.13);
    expect(decodeValue([0xffff, 0xbf8f], register(DataType.FLOAT))).toBe(-1.12);
  });

  it("maps only raw Float32 non-finite states to null and preserves finite sentinels", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(decodeValue(ModbusCodec.encodeFloat32(value), register(DataType.FLOAT))).toBeNull();
    }

    const negativeZero = decodeValue(
      ModbusCodec.encodeFloat32(-0),
      register(DataType.FLOAT, { sentinelValues: [-1] }),
    );
    expect(Object.is(negativeZero, -0)).toBe(true);
    expect(
      decodeValue(
        ModbusCodec.encodeFloat32(-1),
        register(DataType.FLOAT, { sentinelValues: [-1] }),
      ),
    ).toBe(-1);
    expect(decodeValue([254], register(DataType.UCHAR, { sentinelValues: [254, 255] }))).toBe(254);
    expect(decodeValue([255], register(DataType.UCHAR, { sentinelValues: [254, 255] }))).toBe(255);
  });

  it("checks only required length at dispatch before datatype-specific handling", () => {
    expectCodecError(() => decodeValue([], register(DataType.UCHAR)), "codec_input_empty");
    expectCodecError(() => decodeValue([0], register(DataType.FLOAT)), "codec_input_short");
    expectCodecError(() => decodeValue([65_536, 0], register(DataType.FLOAT)), "codec_word_range");

    const mutated = {
      ...register(DataType.UCHAR),
      datatype: "MUTATED",
    } as unknown as RegisterDef;
    expectCodecError(() => decodeValue([1], mutated), "register_invalid");
  });

  it("does not mutate caller-owned words", () => {
    const words = Object.freeze([0, 16_256, 65_535]);
    expect(decodeValue(words, register(DataType.FLOAT))).toBe(1);
    expect(words).toEqual([0, 16_256, 65_535]);
  });
});

describe("register-aware encoding", () => {
  it("rounds exact and adjacent half ties like Python before integer encoding", () => {
    const uchar = register(DataType.UCHAR);
    expect([0.5, 1.5, 2.5, 3.5].map((value) => encodeValue(value, uchar))).toEqual([
      [0],
      [2],
      [2],
      [4],
    ]);

    const int8 = register(DataType.INT8);
    expect([-1.5, -2.5].map((value) => encodeValue(value, int8))).toEqual([[254], [254]]);
    expect(encodeValue(2.500_000_000_000_000_4, uchar)).toEqual([3]);
    expect(encodeValue(2.499_999_999_999_999_6, uchar)).toEqual([2]);
    expect(encodeValue(-2.500_000_000_000_000_4, int8)).toEqual([253]);
    expect(encodeValue(-2.499_999_999_999_999_6, int8)).toEqual([254]);
  });

  it("encodes every datatype with Python-equivalent masks, signs, and scaling", () => {
    expect(encodeValue(12.3, register(DataType.UINT16, { multiplier: 0.1 }))).toEqual([123]);
    expect(encodeValue(255, register(DataType.UCHAR))).toEqual([255]);
    expect(encodeValue(-128, register(DataType.INT8))).toEqual([128]);
    expect(encodeValue(-32_768, register(DataType.INT16))).toEqual([32_768]);
    expect(encodeValue(65_535, register(DataType.UINT16))).toEqual([65_535]);
    expect(encodeValue(false, register(DataType.BOOL))).toEqual([0]);
    expect(encodeValue(true, register(DataType.BOOL))).toEqual([1]);
    expect(encodeValue(0x1ff, register(DataType.BITFLAG))).toEqual([255]);
    expect(encodeValue(-1, register(DataType.BITFLAG))).toEqual([255]);

    const encodedFloat = encodeValue(21.5, register(DataType.FLOAT));
    expect(encodedFloat).toEqual(ModbusCodec.encodeFloat32(21.5));
    expect(decodeValue(encodedFloat, register(DataType.FLOAT))).toBe(21.5);
  });

  it("uses datatype-specific range and non-finite failures", () => {
    expectCodecError(() => encodeValue(-1, register(DataType.UCHAR)), "codec_uchar_range");
    expectCodecError(() => encodeValue(256, register(DataType.UCHAR)), "codec_uchar_range");
    expectCodecError(() => encodeValue(-129, register(DataType.INT8)), "codec_int8_range");
    expectCodecError(() => encodeValue(128, register(DataType.INT8)), "codec_int8_range");
    expectCodecError(() => encodeValue(-32_769, register(DataType.INT16)), "codec_int16_range");
    expectCodecError(() => encodeValue(32_768, register(DataType.INT16)), "codec_int16_range");
    expectCodecError(() => encodeValue(-1, register(DataType.UINT16)), "codec_uint16_range");
    expectCodecError(() => encodeValue(65_536, register(DataType.UINT16)), "codec_uint16_range");
    expectCodecError(() => encodeValue(Number.NaN, register(DataType.FLOAT)), "codec_nonfinite");
    expectCodecError(
      () => encodeValue(Number.POSITIVE_INFINITY, register(DataType.FLOAT)),
      "codec_nonfinite",
    );
  });

  it("returns newly owned immutable words and guards mutated datatype dispatch", () => {
    const definition = register(DataType.UCHAR);
    const first = encodeValue(1, definition);
    const second = encodeValue(1, definition);

    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(second)).toBe(true);

    const mutated = { ...definition, datatype: "MUTATED" } as unknown as RegisterDef;
    expectCodecError(() => encodeValue(1, mutated), "register_invalid");
  });
});
