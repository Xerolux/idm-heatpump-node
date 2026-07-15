import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { SemanticValidationError } from "../../src/errors.js";
import {
  createRegisterDef,
  type RegisterDef,
  type RegisterDefInput,
} from "../../src/registers/definitions.js";
import { DataType, RegisterType, WriteClass } from "../../src/types.js";

interface ApiMapping {
  readonly mappings: readonly {
    readonly python_symbol: string;
    readonly typescript_symbol: string;
    readonly owner_phase: number;
    readonly representation: {
      readonly form: string;
      readonly constructor: string;
      readonly member_naming?: string;
    };
  }[];
}

interface RegisterClassFact {
  readonly python_name: string;
  readonly constructor: {
    readonly parameters: readonly { readonly name: string }[];
  };
  readonly members: readonly { readonly name: string }[];
}

interface PublicClasses {
  readonly classes: readonly RegisterClassFact[];
}

const mapping = JSON.parse(readFileSync("contracts/api-mapping.json", "utf8")) as ApiMapping;
const publicClasses = JSON.parse(
  readFileSync("test/fixtures/public-classes.json", "utf8"),
) as PublicClasses;

const toCamelCase = (value: string): string =>
  value.replaceAll(/_([a-z])/gu, (_match, letter: string) => letter.toUpperCase());

function baseInput(overrides: Partial<RegisterDefInput> = {}): RegisterDefInput {
  return {
    address: 1,
    datatype: DataType.UCHAR,
    name: "test_register",
    ...overrides,
  };
}

describe("immutable RegisterDef factory", () => {
  it("consumes the sole mapping representation and closes all 26 Python members", () => {
    const row = mapping.mappings.find(({ python_symbol }) => python_symbol === "RegisterDef");
    const fact = publicClasses.classes.find(({ python_name }) => python_name === "RegisterDef");
    expect(row).toMatchObject({
      typescript_symbol: "RegisterDef",
      owner_phase: 1,
      representation: {
        form: "readonly_object_factory",
        constructor: "factory",
        member_naming: "snake_case_to_camelCase",
      },
    });
    expect(fact).toBeDefined();

    const definition = createRegisterDef(baseInput());
    const mappedMembers = fact?.members.map(({ name }) => toCamelCase(name)).sort();
    expect(Object.keys(definition).sort()).toEqual(mappedMembers);
    expect(mappedMembers).toHaveLength(26);
    expect(fact?.constructor.parameters.map(({ name }) => toCamelCase(name))).toEqual([
      "address",
      "datatype",
      "name",
      "unit",
      "writable",
      "minVal",
      "maxVal",
      "enumOptions",
      "multiplier",
      "registerType",
      "eepromSensitive",
      "cyclicRequired",
      "cyclicWriteTtl",
      "binary",
      "enabledByDefault",
      "stateClass",
      "icon",
      "writeOnly",
      "excludeFromWrite",
      "source",
      "sourceVersion",
      "supportedModels",
      "sentinelValues",
      "lastVerified",
    ]);
  });

  it("applies every pinned default and ignores caller-controlled derived fields", () => {
    const definition = createRegisterDef({
      ...baseInput(),
      size: 99,
      writeClass: WriteClass.EEPROM,
    } as RegisterDefInput & { readonly size: number; readonly writeClass: WriteClass });

    expect(definition).toEqual({
      address: 1,
      datatype: DataType.UCHAR,
      name: "test_register",
      unit: null,
      writable: false,
      minVal: null,
      maxVal: null,
      enumOptions: null,
      multiplier: 1,
      registerType: RegisterType.INPUT,
      eepromSensitive: false,
      cyclicRequired: false,
      cyclicWriteTtl: null,
      binary: false,
      enabledByDefault: true,
      stateClass: null,
      icon: null,
      writeOnly: false,
      writeClass: WriteClass.FORBIDDEN,
      excludeFromWrite: null,
      source: "official_idm_modbus",
      sourceVersion: "MODBUS TCP NAVIGATOR 10 2025-06-18 plus Navigator 2.0/Pro legacy docs",
      supportedModels: ["Navigator 10", "Navigator 2.0", "Navigator Pro"],
      sentinelValues: [],
      lastVerified: null,
      size: 1,
    });
    expect(Object.isFrozen(definition)).toBe(true);
  });

  it.each([
    [DataType.FLOAT, 2],
    [DataType.UCHAR, 1],
    [DataType.INT8, 1],
    [DataType.INT16, 1],
    [DataType.UINT16, 1],
    [DataType.BOOL, 1],
    [DataType.BITFLAG, 1],
  ] as const)("derives %s size as %i", (datatype, size) => {
    expect(createRegisterDef(baseInput({ datatype })).size).toBe(size);
  });

  it.each([
    [{}, WriteClass.FORBIDDEN],
    [{ writable: true }, WriteClass.VOLATILE],
    [{ writable: true, eepromSensitive: true }, WriteClass.EEPROM],
    [{ writable: true, cyclicRequired: true }, WriteClass.CYCLIC],
    [
      { writable: true, writeOnly: true, cyclicRequired: true, cyclicWriteTtl: 30 },
      WriteClass.WRITE_ONLY,
    ],
    [{ writable: true, writeOnly: true, eepromSensitive: true }, WriteClass.WRITE_ONLY],
  ] as const)("derives write-class precedence for %o", (overrides, expected) => {
    expect(createRegisterDef(baseInput(overrides)).writeClass).toBe(expected);
  });

  const invalidCases: readonly (readonly [
    name: string,
    input: RegisterDefInput,
    diagnostic: string,
  ])[] = [
    [
      "unknown datatype",
      baseInput({ datatype: "INVALID" as DataType }),
      "Invalid datatype: INVALID",
    ],
    [
      "unknown register type",
      baseInput({ registerType: "coil" as RegisterType }),
      "Invalid register type: coil",
    ],
    [
      "null register type",
      baseInput({ registerType: null as unknown as RegisterType }),
      "Invalid register type: null",
    ],
    ["negative address", baseInput({ address: -1 }), "Register address must be non-negative"],
    ["empty source", baseInput({ source: "" }), "Register source must not be empty"],
    [
      "empty source version",
      baseInput({ sourceVersion: "" }),
      "Register source version must not be empty",
    ],
    [
      "empty model list",
      baseInput({ supportedModels: [] }),
      "must declare at least one supported model",
    ],
    ["zero multiplier", baseInput({ multiplier: 0 }), "Multiplier must be finite and non-zero"],
    [
      "infinite multiplier",
      baseInput({ multiplier: Number.POSITIVE_INFINITY }),
      "Multiplier must be finite and non-zero",
    ],
    [
      "NaN multiplier",
      baseInput({ multiplier: Number.NaN }),
      "Multiplier must be finite and non-zero",
    ],
    [
      "non-finite minimum",
      baseInput({ minVal: Number.NEGATIVE_INFINITY }),
      "Minimum value must be finite",
    ],
    ["non-finite maximum", baseInput({ maxVal: Number.NaN }), "Maximum value must be finite"],
    ["reversed bounds", baseInput({ minVal: 2, maxVal: 1 }), "Minimum value 2 exceeds maximum 1"],
    [
      "read-only EEPROM metadata",
      baseInput({ eepromSensitive: true }),
      "Write metadata requires writable=True",
    ],
    [
      "read-only cyclic metadata",
      baseInput({ cyclicRequired: true }),
      "Write metadata requires writable=True",
    ],
    [
      "read-only write-only metadata",
      baseInput({ writeOnly: true }),
      "Write metadata requires writable=True",
    ],
    [
      "read-only exclusions",
      baseInput({ excludeFromWrite: new Set([255]) }),
      "Write metadata requires writable=True",
    ],
    [
      "EEPROM and cyclic",
      baseInput({ writable: true, eepromSensitive: true, cyclicRequired: true }),
      "cannot be both EEPROM-sensitive and cyclic",
    ],
    [
      "TTL without cyclic",
      baseInput({ writable: true, cyclicWriteTtl: 30 }),
      "Cyclic write TTL requires cyclic_required=True",
    ],
    [
      "zero TTL",
      baseInput({ writable: true, cyclicRequired: true, cyclicWriteTtl: 0 }),
      "Cyclic write TTL must be finite and positive",
    ],
    [
      "negative TTL",
      baseInput({ writable: true, cyclicRequired: true, cyclicWriteTtl: -1 }),
      "Cyclic write TTL must be finite and positive",
    ],
    [
      "infinite TTL",
      baseInput({
        writable: true,
        cyclicRequired: true,
        cyclicWriteTtl: Number.POSITIVE_INFINITY,
      }),
      "Cyclic write TTL must be finite and positive",
    ],
    [
      "NaN TTL",
      baseInput({ writable: true, cyclicRequired: true, cyclicWriteTtl: Number.NaN }),
      "Cyclic write TTL must be finite and positive",
    ],
  ];

  it.each(invalidCases)("rejects the pinned %s invariant", (_name, input, diagnostic) => {
    expect(() => createRegisterDef(input)).toThrowError(
      expect.objectContaining({
        category: "validation",
        code: "register_invalid",
        diagnostic: expect.stringContaining(diagnostic),
      }),
    );
  });

  it("does not invent integer-address, non-empty-name, or collection-member rules", () => {
    const nestedModel = { arbitrary: true };
    const nestedOption = { label: "unvalidated" };
    const nestedExclusion = { code: 255 };
    const nestedSentinel = { sentinel: true };
    const enumOptions = { 1: nestedOption };
    const exclusions = new Set([nestedExclusion]);
    const supportedModels = [nestedModel];
    const sentinelValues = [nestedSentinel];

    const definition = createRegisterDef({
      address: 1.5,
      datatype: DataType.UCHAR,
      name: "",
      writable: true,
      enumOptions: enumOptions as unknown as Readonly<Record<number, string>>,
      excludeFromWrite: exclusions as unknown as ReadonlySet<number>,
      supportedModels: supportedModels as unknown as readonly string[],
      sentinelValues: sentinelValues as unknown as readonly (number | string)[],
    });

    nestedModel.arbitrary = false;
    nestedOption.label = "corrupt";
    nestedExclusion.code = 0;
    nestedSentinel.sentinel = false;
    supportedModels.push({ arbitrary: false });
    sentinelValues.push({ sentinel: false });

    expect(definition.address).toBe(1.5);
    expect(definition.name).toBe("");
    expect(definition.supportedModels).toEqual([{ arbitrary: true }]);
    expect(definition.enumOptions).toEqual({ 1: { label: "unvalidated" } });
    expect([...(definition.excludeFromWrite as unknown as ReadonlySet<object>)]).toEqual([
      { code: 255 },
    ]);
    expect(definition.sentinelValues).toEqual([{ sentinel: true }]);
    expect(Object.isFrozen(definition.supportedModels[0] as unknown as object)).toBe(true);
    expect(Object.isFrozen((definition.enumOptions as unknown as Record<number, object>)[1])).toBe(
      true,
    );
    expect(() => (definition.excludeFromWrite as unknown as Set<object>).add({ code: 1 })).toThrow(
      TypeError,
    );
  });

  it("preserves decoded sentinel values exactly as metadata", () => {
    const definition = createRegisterDef(
      baseInput({ datatype: DataType.FLOAT, sentinelValues: [-1, 254, 255] }),
    );
    expect(definition.sentinelValues).toEqual([-1, 254, 255]);
    expect(definition.sentinelValues).not.toContain(null);
    expect(Object.isFrozen(definition.sentinelValues)).toBe(true);
  });

  it("allows the documented logical overlap as separate exact definitions", () => {
    const humidity = createRegisterDef(
      baseInput({ address: 1392, datatype: DataType.FLOAT, name: "humidity_sensor" }),
    );
    const mode = createRegisterDef(
      baseInput({ address: 1393, datatype: DataType.UCHAR, name: "hc_a_mode" }),
    );

    expect([humidity.address, humidity.size]).toEqual([1392, 2]);
    expect([mode.address, mode.size]).toEqual([1393, 1]);
  });

  it("returns stable semantic validation errors", () => {
    try {
      createRegisterDef(baseInput({ address: -1 }));
      throw new Error("expected createRegisterDef to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(SemanticValidationError);
    }
  });

  it("is assignable as the mapped readonly RegisterDef representation", () => {
    const definition: RegisterDef = createRegisterDef(baseInput());
    expect(definition.datatype).toBe(DataType.UCHAR);
  });
});
