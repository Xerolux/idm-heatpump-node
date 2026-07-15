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
import { createRegisterDef, type RegisterDef } from "../../src/registers/definitions.js";
import {
  buildRegisterMap,
  getAllRegisters,
  getDetectionRegisters,
  getHeatingCircuitRegisters,
  getRegister,
  getRegisterRegistry,
  getZoneModuleRegisters,
  RegisterRegistry,
} from "../../src/registers/index.js";
import { DataType, IdmModelInfo, RegisterType, type IdmModelInfoInput } from "../../src/types.js";

interface MappingEntry {
  readonly python_symbol: string;
  readonly typescript_symbol: string;
  readonly export_path: string;
  readonly owner_phase: number;
  readonly normalizations: readonly string[];
  readonly representation: Readonly<Record<string, unknown>>;
}

interface ApiMappingFixture {
  readonly mappings: readonly MappingEntry[];
}

interface RegisterSchemaFixture {
  readonly builder_contract: Readonly<{
    circuits: readonly Readonly<{
      letter: string;
      register_count: number;
      addresses: Readonly<Record<string, number>>;
    }>[];
    rooms: readonly Readonly<{
      room_count: number;
      register_count: number;
      last_relay_address: number;
    }>[];
    zones: readonly Readonly<{
      zone: number;
      base_address: number;
      last_address: number;
      register_count: number;
    }>[];
    invalid_circuits: readonly InvalidBoundary[];
    invalid_rooms: readonly InvalidBoundary[];
    invalid_zones: readonly InvalidBoundary[];
    models: readonly Readonly<{
      model_name: string;
      register_count: number;
      includes_circuit_a: boolean;
      includes_navigator_10_block: boolean;
    }>[];
    features: readonly Readonly<{ feature: string; added_registers: readonly string[] }>[];
    model_info_precedence: Readonly<{
      requested_manual_circuit: string;
      requested_manual_zones: number;
      actual_circuits: readonly string[];
      actual_zone_modules: number;
    }>;
    detection_registers: readonly Readonly<Record<string, unknown>>[];
  }>;
  readonly maps: Readonly<{
    default: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  }>;
}

interface InvalidBoundary {
  readonly id: string;
  readonly error: Readonly<{ category: string; code: string; diagnostic: string }>;
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
      Object.entries(register.enumOptions ?? {}).sort(
        ([left], [right]) => Number(left) - Number(right),
      ),
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

function modelInfo(overrides: Partial<IdmModelInfoInput> = {}) {
  return IdmModelInfo.create({
    modelName: "Navigator 10",
    activeHeatingCircuits: ["A"],
    zoneModules: 0,
    hasSolar: false,
    hasIsc: false,
    hasPv: false,
    hasCascade: false,
    ...overrides,
  });
}

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error: unknown) {
    return error;
  }
  throw new Error("Expected action to throw");
}

describe("static register catalog", () => {
  it("matches the sole CORE_REGISTERS mapping decision and exact five-register metadata", () => {
    const mapping = (apiMapping as ApiMappingFixture).mappings.filter(
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
      ["outdoor_temp", "system_mode", "storage_temp", "hp_operating_mode", "error_acknowledge"].map(
        (name) => [name, expect.objectContaining({ name })],
      ),
    );

    const expected = readFixture().maps.default;
    for (const [name, register] of CORE_REGISTERS) {
      expect(serializeForStaticContract(register)).toEqual(expected[name]);
    }
  });

  it("matches every static family name, count, and all 26 metadata fields", () => {
    expect(getSystemRegisters().size).toBe(24);
    expect(getHpStatusRegisters().size).toBe(35);
    expect(getEnergyRegisters().size).toBe(14);
    expect(getCommonRegisters().size).toBe(73);
    expect(getCascadeRegisters().size).toBe(18);
    expect(getSolarRegisters().size).toBe(5);
    expect(getIscRegisters().size).toBe(3);
    expect(getPvRegisters().size).toBe(7);
    expect(getNavigator10Registers().size).toBe(33);
    expect(getGltRegisters().size).toBe(14);

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
        ([name]) =>
          !name.startsWith("hc_") &&
          !name.startsWith("zm") &&
          name !== "humidity_sensor" &&
          name !== "error_acknowledge",
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
      expect(register?.supportedModels).toEqual(["Navigator 10", "Navigator 2.0", "Navigator Pro"]);
    }
  });

  it("keeps internal static-family helpers outside the public mapping", () => {
    const mappedSymbols = new Set(
      (apiMapping as ApiMappingFixture).mappings.map((entry) => entry.typescript_symbol),
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

describe("parametric register builders and mapping closure", () => {
  it("implements exactly the nine mapping-owned public register symbols", () => {
    const expected = new Map([
      ["CORE_REGISTERS", "CORE_REGISTERS"],
      ["RegisterRegistry", "RegisterRegistry"],
      ["build_register_map", "buildRegisterMap"],
      ["get_all_registers", "getAllRegisters"],
      ["get_detection_registers", "getDetectionRegisters"],
      ["get_heating_circuit_registers", "getHeatingCircuitRegisters"],
      ["get_register", "getRegister"],
      ["get_register_registry", "getRegisterRegistry"],
      ["get_zone_module_registers", "getZoneModuleRegisters"],
    ]);
    const rows = (apiMapping as ApiMappingFixture).mappings.filter((entry) =>
      expected.has(entry.python_symbol),
    );

    expect(rows).toHaveLength(9);
    for (const row of rows) {
      expect(row.typescript_symbol).toBe(expected.get(row.python_symbol));
      expect(row.owner_phase).toBe(1);
      expect(row.export_path).toBe(".");
    }
  });

  it("matches every A-G formula and retains the humidity/mode boundary identity", () => {
    for (const circuit of readFixture().builder_contract.circuits) {
      const registers = getHeatingCircuitRegisters(circuit.letter);
      expect(registers.size).toBe(circuit.register_count);
      expect(
        Object.fromEntries([...registers].map(([name, register]) => [name, register.address])),
      ).toEqual(circuit.addresses);
    }

    const full = buildRegisterMap();
    expect(full.get("humidity_sensor")).toMatchObject({
      address: 1392,
      datatype: DataType.FLOAT,
      size: 2,
    });
    expect(full.get("hc_a_mode")).toMatchObject({
      address: 1393,
      datatype: DataType.UCHAR,
      size: 1,
    });
  });

  it("rejects malformed circuit, zone, and room boundaries with generated stable codes", () => {
    const fixture = readFixture().builder_contract;
    const circuitInputs = ["", "AB", "H"];
    fixture.invalid_circuits.forEach((boundary, index) => {
      expect(
        captureError(() => getHeatingCircuitRegisters(circuitInputs[index] ?? "")),
      ).toMatchObject(boundary.error);
    });
    const zoneInputs = [0, 11];
    fixture.invalid_zones.forEach((boundary, index) => {
      expect(captureError(() => getZoneModuleRegisters(zoneInputs[index] ?? 0))).toMatchObject(
        boundary.error,
      );
    });
    const roomInputs = [0, 9];
    fixture.invalid_rooms.forEach((boundary, index) => {
      expect(captureError(() => getZoneModuleRegisters(1, roomInputs[index] ?? 0))).toMatchObject(
        boundary.error,
      );
    });
  });

  it("matches zone 1-10 bases and every room-count boundary from 1-8", () => {
    const fixture = readFixture().builder_contract;
    for (const zone of fixture.zones) {
      const registers = getZoneModuleRegisters(zone.zone);
      expect(registers.size).toBe(zone.register_count);
      expect(registers.get(`zm${zone.zone}_mode_heat_cool`)?.address).toBe(zone.base_address);
      expect(registers.get(`zm${zone.zone}_room6_relay`)?.address).toBe(zone.last_address);
    }
    for (const rooms of fixture.rooms) {
      const registers = getZoneModuleRegisters(1, rooms.room_count);
      expect(registers.size).toBe(rooms.register_count);
      expect(registers.get(`zm1_room${rooms.room_count}_relay`)?.address).toBe(
        rooms.last_relay_address,
      );
    }
  });

  it("matches model gates, independent feature gates, and model-info precedence", () => {
    const fixture = readFixture().builder_contract;
    for (const model of fixture.models) {
      const registers = buildRegisterMap({ modelInfo: modelInfo({ modelName: model.model_name }) });
      expect(registers.size).toBe(model.register_count);
      expect(registers.has("hc_a_flow_temp")).toBe(model.includes_circuit_a);
      expect(registers.has("power_limit_hp")).toBe(model.includes_navigator_10_block);
    }

    const allOff = buildRegisterMap({ modelInfo: modelInfo() });
    for (const feature of fixture.features.slice(0, 4)) {
      const flags = {
        hasSolar: feature.feature === "solar",
        hasIsc: feature.feature === "isc",
        hasPv: feature.feature === "pv",
        hasCascade: feature.feature === "cascade",
      };
      const enabled = buildRegisterMap({ modelInfo: modelInfo(flags) });
      const added = [...enabled.keys()].filter((name) => !allOff.has(name)).sort();
      expect(added).toEqual([...feature.added_registers].sort());
    }

    const precedence = buildRegisterMap({
      modelInfo: modelInfo(),
      circuits: [fixture.model_info_precedence.requested_manual_circuit],
      zoneModules: fixture.model_info_precedence.requested_manual_zones,
    });
    expect(precedence.has("hc_a_flow_temp")).toBe(true);
    expect(precedence.has("hc_g_flow_temp")).toBe(false);
    expect([...precedence.keys()].some((name) => name.startsWith("zm1_"))).toBe(false);
  });

  it("matches detection definitions and core/full helper defaults", () => {
    expect(getDetectionRegisters().map(serializeForStaticContract)).toEqual(
      readFixture().builder_contract.detection_registers,
    );
    expect(
      getAllRegisters()
        .map((register) => register.name)
        .sort(),
    ).toEqual([...CORE_REGISTERS.keys()].sort());
    expect(getRegisterRegistry().registers.size).toBe(5);
    expect(getRegister("dhw_temp_top").address).toBe(1014);
    expect(
      getAllRegisters({ modelInfo: modelInfo() }).some(
        (register) => register.name === "hc_a_flow_temp",
      ),
    ).toBe(true);
  });

  it("isolates every public map result from hostile mutation", () => {
    const first = buildRegisterMap();
    expect(() =>
      (first as Map<string, RegisterDef>).set("poison", getRegister("outdoor_temp")),
    ).toThrow(TypeError);
    const second = buildRegisterMap();
    expect(second.has("poison")).toBe(false);
    expect(second.size).toBe(267);

    const writable = getRegisterRegistry({ modelInfo: modelInfo() }).writable();
    expect(() => (writable as Map<string, RegisterDef>).clear()).toThrow(TypeError);
  });
});

describe("RegisterRegistry", () => {
  it("rejects key/name mismatches and duplicate exact start identities", () => {
    const first = createRegisterDef({ address: 1, datatype: DataType.UCHAR, name: "first" });
    const second = createRegisterDef({ address: 1, datatype: DataType.FLOAT, name: "second" });

    expect(() => new RegisterRegistry(new Map([["wrong", first]]))).toThrow(
      "Register key 'wrong' must match register name 'first'",
    );
    expect(
      () =>
        new RegisterRegistry(
          new Map([
            ["first", first],
            ["second", second],
          ]),
        ),
    ).toThrow("Register address 1 is duplicated by 'first' and 'second'");
    const holding = createRegisterDef({
      address: 1,
      datatype: DataType.UCHAR,
      name: "holding",
      registerType: RegisterType.HOLDING,
    });
    expect(
      () =>
        new RegisterRegistry(
          new Map([
            ["first", first],
            ["holding", holding],
          ]),
        ),
    ).not.toThrow();
  });

  it("implements get, require, defaulted byAddress, writable, and abbreviated toSchema", () => {
    const registry = getRegisterRegistry();
    expect(registry.get("missing")).toBeNull();
    expect(registry.require("system_mode").address).toBe(1005);
    expect(() => registry.require("missing")).toThrow("Unknown IDM register key: missing");
    expect(registry.byAddress(1005)?.name).toBe("system_mode");
    expect(registry.byAddress(1005, "holding")).toBeNull();
    expect([...registry.writable().keys()].sort()).toEqual(["error_acknowledge", "system_mode"]);

    const schema = registry.toSchema();
    expect(schema.map((entry) => entry.key)).toEqual([...CORE_REGISTERS.keys()].sort());
    expect(schema.find((entry) => entry.key === "system_mode")).toEqual({
      key: "system_mode",
      address: 1005,
      datatype: "UCHAR",
      unit: null,
      scale: 1,
      min_value: 0,
      max_value: 5,
      writable: true,
      register_type: "input",
      write_class: "eeprom",
      supported_models: ["Navigator 10", "Navigator 2.0", "Navigator Pro"],
    });
    expect(Object.keys(schema[0] ?? {})).toHaveLength(11);
  });

  it("permits occupied-range overlaps because indexes use exact starts only", () => {
    const humidity = createRegisterDef({
      address: 1392,
      datatype: DataType.FLOAT,
      name: "humidity_sensor",
    });
    const mode = createRegisterDef({ address: 1393, datatype: DataType.UCHAR, name: "hc_a_mode" });
    const registry = new RegisterRegistry(
      new Map([
        [humidity.name, humidity],
        [mode.name, mode],
      ]),
    );

    expect(registry.byAddress(1392)?.name).toBe("humidity_sensor");
    expect(registry.byAddress(1393)?.name).toBe("hc_a_mode");
  });
});
