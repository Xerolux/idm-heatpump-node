import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import * as registerApi from "../../src/registers/index.js";
import { createRegisterDef } from "../../src/registers/definitions.js";
import { serializeRegisterDef, serializeRegisterMap } from "../../src/registers/serialize.js";
import { DataType, IdmModelInfo } from "../../src/types.js";

interface RegisterSchemaFixture {
  readonly maps: Readonly<{
    default: Readonly<Record<string, unknown>>;
    navigator_10_full: Readonly<Record<string, unknown>>;
    navigator_20_circuit_a: Readonly<Record<string, unknown>>;
  }>;
  readonly documented_overlaps: readonly Readonly<{
    address: number;
    names: readonly string[];
  }>[];
}

function fixture(): RegisterSchemaFixture {
  return JSON.parse(
    readFileSync(new URL("../fixtures/register-schema.json", import.meta.url), "utf8"),
  ) as RegisterSchemaFixture;
}

const navigator10Full = IdmModelInfo.create({
  modelName: "Navigator 10",
  activeHeatingCircuits: [..."ABCDEFG"],
  zoneModules: 10,
  hasSolar: true,
  hasIsc: true,
  hasPv: true,
  hasCascade: true,
});

const navigator20CircuitA = IdmModelInfo.create({
  modelName: "Navigator 2.0",
  activeHeatingCircuits: ["A"],
  zoneModules: 0,
  hasSolar: false,
  hasIsc: false,
  hasPv: false,
  hasCascade: false,
});

describe("complete register-schema parity", () => {
  it("matches all three authoritative complete maps across every one of 26 fields", () => {
    const expected = fixture().maps;
    const actual = {
      default: serializeRegisterMap(registerApi.buildRegisterMap()),
      navigator_10_full: serializeRegisterMap(
        registerApi.buildRegisterMap({ modelInfo: navigator10Full }),
      ),
      navigator_20_circuit_a: serializeRegisterMap(
        registerApi.buildRegisterMap({ modelInfo: navigator20CircuitA }),
      ),
    };

    expect(Object.keys(actual.default)).toHaveLength(267);
    expect(Object.keys(actual.navigator_10_full)).toHaveLength(587);
    expect(Object.keys(actual.navigator_20_circuit_a)).toHaveLength(105);
    expect(actual).toEqual(expected);

    const expectedFields = [
      "address",
      "binary",
      "cyclic_required",
      "cyclic_write_ttl",
      "datatype",
      "eeprom_sensitive",
      "enabled_by_default",
      "enum_options",
      "exclude_from_write",
      "icon",
      "last_verified",
      "max_val",
      "min_val",
      "multiplier",
      "name",
      "register_type",
      "sentinel_values",
      "size",
      "source",
      "source_version",
      "state_class",
      "supported_models",
      "unit",
      "writable",
      "write_class",
      "write_only",
    ].sort();
    for (const serialized of Object.values(actual.default)) {
      expect(Object.keys(serialized as object).sort()).toEqual(expectedFields);
    }
  });

  it("requires the complete exact set of three official occupied-range overlaps", () => {
    const registers = registerApi.buildRegisterMap();
    const occupied = new Map<number, string>();
    const overlaps: { address: number; names: string[] }[] = [];
    for (const [name, register] of registers) {
      for (
        let address = register.address;
        address < register.address + register.size;
        address += 1
      ) {
        const first = occupied.get(address);
        if (first === undefined) occupied.set(address, name);
        else overlaps.push({ address, names: [first, name].sort() });
      }
    }

    expect(overlaps.sort((left, right) => left.address - right.address)).toEqual(
      fixture().documented_overlaps.map((overlap) => ({
        address: overlap.address,
        names: [...overlap.names].sort(),
      })),
    );
    expect(registers.get("humidity_sensor")).toMatchObject({
      address: 1392,
      datatype: "FLOAT",
      size: 2,
    });
    expect(registers.get("hc_a_mode")).toMatchObject({
      address: 1393,
      datatype: "UCHAR",
      size: 1,
    });
  });

  it("keeps the abbreviated public registry schema independent from the full serializer", () => {
    const registry = registerApi.getRegisterRegistry();
    const abbreviated = registry.toSchema();
    const full = serializeRegisterMap(registry.registers);

    expect(Object.keys(abbreviated[0] ?? {})).toHaveLength(11);
    expect(Object.keys(Object.values(full)[0] as object)).toHaveLength(26);
    expect(abbreviated).not.toEqual(Object.values(full));
    expect(
      readFileSync(new URL("../../src/registers/registry.ts", import.meta.url), "utf8"),
    ).not.toContain("serializeRegister");
    expect(
      readFileSync(new URL("../../src/registers/serialize.ts", import.meta.url), "utf8"),
    ).not.toContain(".toSchema(");
  });

  it("tags only exceptional numbers while sorting enum and excluded-value contract fields", () => {
    const serialized = serializeRegisterDef(
      createRegisterDef({
        address: 1,
        datatype: DataType.UCHAR,
        name: "exceptional",
        writable: true,
        enumOptions: { 10: "ten", 2: "two" },
        excludeFromWrite: new Set([10, 2]),
        sentinelValues: [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0],
      }),
    );

    expect(serialized.enum_options).toEqual({ 2: "two", 10: "ten" });
    expect(serialized.exclude_from_write).toEqual([2, 10]);
    expect(serialized.sentinel_values).toEqual([
      { $number: "NaN" },
      { $number: "+Infinity" },
      { $number: "-Infinity" },
      { $number: "-0" },
    ]);
  });

  it("exposes exactly the nine mapping-approved public register values", () => {
    expect(Object.keys(registerApi).sort()).toEqual(
      [
        "CORE_REGISTERS",
        "RegisterRegistry",
        "buildRegisterMap",
        "getAllRegisters",
        "getDetectionRegisters",
        "getHeatingCircuitRegisters",
        "getRegister",
        "getRegisterRegistry",
        "getZoneModuleRegisters",
      ].sort(),
    );
    expect("serializeRegisterMap" in registerApi).toBe(false);
  });
});
