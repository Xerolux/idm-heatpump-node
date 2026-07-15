import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import apiMapping from "../../contracts/api-mapping.json" with { type: "json" };
import {
  CORE_REGISTERS,
  getCommonRegisters,
  getEnergyRegisters,
  getHpStatusRegisters,
  getSystemRegisters,
} from "../../src/registers/core.js";
import {
  getCascadeRegisters,
  getGltRegisters,
  getIscRegisters,
  getNavigator10Registers,
  getPvRegisters,
  getSolarRegisters,
} from "../../src/registers/feature-blocks.js";
import type { RegisterDef } from "../../src/registers/definitions.js";

interface MappingEntry {
  readonly python_symbol: string;
  readonly typescript_symbol: string;
  readonly export_path: string;
  readonly owner_phase: number;
  readonly normalizations: readonly string[];
  readonly representation: Readonly<Record<string, unknown>>;
}

interface RegisterSchemaFixture {
  readonly maps: Readonly<{
    default: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  }>;
}

function readFixture(): RegisterSchemaFixture {
  return JSON.parse(
    readFileSync(new URL("../fixtures/register-schema.json", import.meta.url), "utf8"),
  ) as RegisterSchemaFixture;
}

function serializeForStaticContract(register: RegisterDef): Readonly<Record<string, unknown>> {
  return {
    address: register.address,
    binary: register.binary,
    cyclic_required: register.cyclicRequired,
    cyclic_write_ttl: register.cyclicWriteTtl,
    datatype: register.datatype,
    eeprom_sensitive: register.eepromSensitive,
    enabled_by_default: register.enabledByDefault,
    enum_options: Object.fromEntries(
      Object.entries(register.enumOptions ?? {}).sort(([left], [right]) => Number(left) - Number(right)),
    ),
    exclude_from_write: [...(register.excludeFromWrite ?? [])].sort((left, right) => left - right),
    icon: register.icon,
    last_verified: register.lastVerified,
    max_val: register.maxVal,
    min_val: register.minVal,
    multiplier: register.multiplier,
    name: register.name,
    register_type: register.registerType,
    sentinel_values: [...register.sentinelValues],
    size: register.size,
    source: register.source,
    source_version: register.sourceVersion,
    state_class: register.stateClass,
    supported_models: [...register.supportedModels],
    unit: register.unit,
    writable: register.writable,
    write_class: register.writeClass,
    write_only: register.writeOnly,
  };
}

function mergeMaps(...maps: readonly ReadonlyMap<string, RegisterDef>[]): Map<string, RegisterDef> {
  const merged = new Map<string, RegisterDef>();
  for (const map of maps) {
    for (const [name, register] of map) {
      merged.set(name, register);
    }
  }
  return merged;
}

describe("static register catalog", () => {
  it("matches the sole CORE_REGISTERS mapping decision and exact five-register metadata", () => {
    const mapping = (apiMapping.entries as readonly MappingEntry[]).filter(
      (entry) => entry.python_symbol === "CORE_REGISTERS",
    );

    expect(mapping).toEqual([
      expect.objectContaining({
        typescript_symbol: "CORE_REGISTERS",
        export_path: ".",
        owner_phase: 1,
        normalizations: ["mapping_to_readonly_map_or_record"],
        representation: {
          form: "readonly_map",
          constructor: "value",
          validation: "constant_fixture",
        },
      }),
    ]);
    expect([...CORE_REGISTERS]).toEqual(
      [
        "outdoor_temp",
        "system_mode",
        "storage_temp",
        "hp_operating_mode",
        "error_acknowledge",
      ].map((name) => [name, expect.objectContaining({ name })]),
    );

    const expected = readFixture().maps.default;
    for (const [name, register] of CORE_REGISTERS) {
      expect(serializeForStaticContract(register)).toEqual(expected[name]);
    }
  });

  it("matches every static family name, count, and all 26 metadata fields", () => {
    expect(getSystemRegisters()).toHaveLength(24);
    expect(getHpStatusRegisters()).toHaveLength(35);
    expect(getEnergyRegisters()).toHaveLength(14);
    expect(getCommonRegisters()).toHaveLength(73);
    expect(getCascadeRegisters()).toHaveLength(18);
    expect(getSolarRegisters()).toHaveLength(5);
    expect(getIscRegisters()).toHaveLength(3);
    expect(getPvRegisters()).toHaveLength(7);
    expect(getNavigator10Registers()).toHaveLength(33);
    expect(getGltRegisters()).toHaveLength(14);

    const actual = mergeMaps(
      getCommonRegisters(),
      getCascadeRegisters(),
      getSolarRegisters(),
      getIscRegisters(),
      getPvRegisters(),
      getNavigator10Registers(),
      getGltRegisters(),
    );
    const expected = Object.fromEntries(
      Object.entries(readFixture().maps.default).filter(
        ([name]) => !name.startsWith("hc_") && !name.startsWith("zm") &&
          name !== "humidity_sensor" && name !== "error_acknowledge",
      ),
    );

    expect(actual.size).toBe(153);
    expect([...actual.keys()].sort()).toEqual(Object.keys(expected).sort());
    for (const [name, register] of actual) {
      expect(serializeForStaticContract(register)).toEqual(expected[name]);
    }
  });

  it("preserves hardware-verified static sentinels and source metadata", () => {
    const registers = mergeMaps(
      getCommonRegisters(),
      getPvRegisters(),
      getNavigator10Registers(),
      getGltRegisters(),
    );
    const expected = new Map<string, readonly number[]>([
      ["variable_input", [255]],
      ["battery_soc", [-1]],
      ["ext_demand_groundwater_pump_m15", [254]],
      ["ext_demand_groundwater_pump_m15_sw_max", [254]],
      ["booster_fault", [255]],
      ["ext_humidity", [-1]],
    ]);

    for (const [name, sentinels] of expected) {
      const register = registers.get(name);
      expect(register?.sentinelValues).toEqual(sentinels);
      expect(register?.lastVerified).toBe("2026-07-10");
      expect(register?.source).toBe("official_idm_modbus");
      expect(register?.supportedModels).toEqual([
        "Navigator 10",
        "Navigator 2.0",
        "Navigator Pro",
      ]);
    }
  });

  it("keeps internal static-family helpers outside the public mapping", () => {
    const mappedSymbols = new Set(
      (apiMapping.entries as readonly MappingEntry[]).map((entry) => entry.typescript_symbol),
    );
    for (const internalName of [
      "getCommonRegisters",
      "getSystemRegisters",
      "getHpStatusRegisters",
      "getEnergyRegisters",
      "getCascadeRegisters",
      "getSolarRegisters",
      "getIscRegisters",
      "getPvRegisters",
      "getNavigator10Registers",
      "getGltRegisters",
    ]) {
      expect(mappedSymbols.has(internalName)).toBe(false);
    }
  });
});
