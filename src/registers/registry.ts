import { MAX_ROOMS_PER_ZONE, MODEL_NAVIGATOR_10 } from "../constants.js";
import { compareUnicodeCodePoints } from "../contracts/canonical-order.js";
import { SemanticValidationError } from "../errors.js";
import { DataType, type IdmModelInfo } from "../types.js";
import { CORE_REGISTERS, getCommonRegisters } from "./core.js";
import { createRegisterDef, type RegisterDef } from "./definitions.js";
import {
  getCascadeRegisters,
  getGltRegisters,
  getIscRegisters,
  getNavigator10Registers,
  getPvRegisters,
  getSolarRegisters,
} from "./feature-blocks.js";
import { getHeatingCircuitRegisters } from "./heating-circuits.js";
import { immutableRegisterMap, mergeRegisterMaps } from "./map-utils.js";
import { getZoneModuleRegisters } from "./zone-modules.js";

interface BuildRegisterMapOptions {
  readonly modelInfo?: IdmModelInfo | null;
  readonly circuits?: readonly string[] | null;
  readonly zoneModules?: number;
  readonly roomsPerZone?: number;
}

interface ModelOption {
  readonly modelInfo?: IdmModelInfo | null;
}

function pythonNumberText(value: number): string {
  if (Number.isNaN(value)) return "nan";
  if (value === Number.POSITIVE_INFINITY) return "inf";
  if (value === Number.NEGATIVE_INFINITY) return "-inf";
  return String(value);
}

function requirePythonRangeInteger(value: number): void {
  if (!Number.isInteger(value)) {
    throw new TypeError("'float' object cannot be interpreted as an integer");
  }
}

export interface RegisterRegistrySchemaEntry {
  readonly key: string;
  readonly address: number;
  readonly datatype: string;
  readonly unit: string | null;
  readonly scale: number;
  readonly min_value: number | null;
  readonly max_value: number | null;
  readonly writable: boolean;
  readonly register_type: string;
  readonly write_class: string;
  readonly supported_models: readonly string[];
}

function addressKey(registerType: string, address: number): string {
  return `${registerType}\u0000${String(address)}`;
}

export class RegisterRegistry {
  public readonly registers: ReadonlyMap<string, RegisterDef>;
  readonly #byAddress: ReadonlyMap<string, string>;

  public constructor(registers: ReadonlyMap<string, RegisterDef>) {
    const copiedEntries: [string, RegisterDef][] = [];
    const index = new Map<string, string>();
    for (const [key, register] of registers) {
      if (key !== register.name) {
        throw new Error(`Register key '${key}' must match register name '${register.name}'`);
      }
      const identity = addressKey(register.registerType, register.address);
      const existing = index.get(identity);
      if (existing !== undefined && existing !== key) {
        throw new Error(
          `Register address ${String(register.address)} is duplicated by '${existing}' and '${key}'`,
        );
      }
      index.set(identity, key);
      copiedEntries.push([key, register]);
    }
    this.registers = immutableRegisterMap(copiedEntries);
    this.#byAddress = index;
  }

  public get(key: string): RegisterDef | null {
    return this.registers.get(key) ?? null;
  }

  public require(key: string): RegisterDef {
    const register = this.get(key);
    if (register === null) {
      throw new Error(`Unknown IDM register key: ${key}`);
    }
    return register;
  }

  public byAddress(address: number, registerType = "input"): RegisterDef | null {
    const key = this.#byAddress.get(addressKey(registerType, address));
    return key === undefined ? null : (this.registers.get(key) ?? null);
  }

  public writable(): ReadonlyMap<string, RegisterDef> {
    return immutableRegisterMap([...this.registers].filter(([, register]) => register.writable));
  }

  public toSchema(): readonly RegisterRegistrySchemaEntry[] {
    const schema = [...this.registers]
      .sort(([left], [right]) => compareUnicodeCodePoints(left, right))
      .map(([key, register]) =>
        Object.freeze({
          key,
          address: register.address,
          datatype: register.datatype,
          unit: register.unit,
          scale: register.multiplier,
          min_value: register.minVal,
          max_value: register.maxVal,
          writable: register.writable,
          register_type: register.registerType,
          write_class: register.writeClass,
          supported_models: Object.freeze([...register.supportedModels]),
        }),
      );
    return Object.freeze(schema);
  }
}

function validateOptions(options: BuildRegisterMapOptions): {
  readonly circuits: readonly string[] | null;
  readonly zoneModules: number;
  readonly roomsPerZone: number;
  readonly modelInfo: IdmModelInfo | null;
} {
  const circuits = options.circuits ?? null;
  const zoneModules = options.zoneModules ?? 0;
  const roomsPerZone = options.roomsPerZone ?? 6;
  if (circuits !== null) {
    const invalid = (circuits as readonly unknown[]).filter(
      (circuit) =>
        typeof circuit !== "string" ||
        circuit.length !== 1 ||
        !"ABCDEFG".includes(circuit.toUpperCase()),
    );
    if (invalid.length > 0) {
      const diagnostic = invalid.map((value) => `'${String(value)}'`).join(", ");
      throw new SemanticValidationError(
        "circuit_invalid",
        `Invalid heating circuit letters: [${diagnostic}]`,
      );
    }
  }
  if (!(zoneModules >= 0 && zoneModules <= 10)) {
    throw new SemanticValidationError(
      "zone_invalid",
      `zone_modules must be 0-10, got ${pythonNumberText(zoneModules)}`,
    );
  }
  if (!(roomsPerZone >= 1 && roomsPerZone <= MAX_ROOMS_PER_ZONE)) {
    throw new SemanticValidationError(
      "room_invalid",
      `rooms_per_zone must be 1-${String(MAX_ROOMS_PER_ZONE)}, got ${pythonNumberText(roomsPerZone)}`,
    );
  }
  const modelInfo = options.modelInfo ?? null;
  if (modelInfo !== null && !(modelInfo.zoneModules >= 0 && modelInfo.zoneModules <= 10)) {
    throw new SemanticValidationError(
      "zone_invalid",
      `zone_modules must be 0-10, got ${pythonNumberText(modelInfo.zoneModules)}`,
    );
  }
  return { circuits, zoneModules, roomsPerZone, modelInfo };
}

export function buildRegisterMap(
  options: BuildRegisterMapOptions = {},
): ReadonlyMap<string, RegisterDef> {
  const { circuits, zoneModules, roomsPerZone, modelInfo } = validateOptions(options);
  const maps: ReadonlyMap<string, RegisterDef>[] = [getCommonRegisters()];

  if (modelInfo === null || modelInfo.modelName === MODEL_NAVIGATOR_10) {
    maps.push(getNavigator10Registers());
  }

  let activeCircuits: readonly string[];
  let activeZoneModules: number;
  if (modelInfo !== null) {
    activeCircuits = modelInfo.activeHeatingCircuits;
    activeZoneModules = modelInfo.zoneModules;
    if (modelInfo.hasCascade) maps.push(getCascadeRegisters());
    if (modelInfo.hasSolar) maps.push(getSolarRegisters());
    if (modelInfo.hasIsc) maps.push(getIscRegisters());
    if (modelInfo.hasPv) maps.push(getPvRegisters());
  } else {
    activeCircuits = circuits === null || circuits.length === 0 ? [..."ABCDEFG"] : circuits;
    activeZoneModules = zoneModules;
    maps.push(getSolarRegisters(), getIscRegisters(), getPvRegisters(), getCascadeRegisters());
  }

  requirePythonRangeInteger(activeZoneModules);

  for (const circuit of activeCircuits) {
    try {
      maps.push(getHeatingCircuitRegisters(circuit));
    } catch (error: unknown) {
      if (!(error instanceof SemanticValidationError) || error.code !== "circuit_invalid") {
        throw error;
      }
    }
  }
  for (let zone = 1; zone <= activeZoneModules; zone += 1) {
    maps.push(getZoneModuleRegisters(zone, roomsPerZone));
  }

  maps.push(getGltRegisters());
  const special = immutableRegisterMap([
    [
      "error_acknowledge",
      createRegisterDef({
        address: 1999,
        datatype: DataType.UCHAR,
        name: "error_acknowledge",
        writable: true,
        writeOnly: true,
      }),
    ],
    [
      "humidity_sensor",
      createRegisterDef({
        address: 1392,
        datatype: DataType.FLOAT,
        name: "humidity_sensor",
        unit: "%",
        minVal: 0,
        maxVal: 100,
        stateClass: "measurement",
        sentinelValues: [-1],
        lastVerified: "2026-07-10",
      }),
    ],
  ]);
  maps.push(special);
  return mergeRegisterMaps(...maps);
}

export function getDetectionRegisters(): readonly RegisterDef[] {
  const definitions: RegisterDef[] = [
    createRegisterDef({
      address: 1000,
      datatype: DataType.FLOAT,
      name: "detect_outdoor_temp",
    }),
  ];
  for (let index = 0; index < 7; index += 1) {
    definitions.push(
      createRegisterDef({
        address: 1350 + index * 2,
        datatype: DataType.FLOAT,
        name: `detect_hc_${String.fromCharCode(97 + index)}_flow_temp`,
      }),
    );
  }
  definitions.push(
    createRegisterDef({ address: 1850, datatype: DataType.FLOAT, name: "detect_solar" }),
    createRegisterDef({ address: 1870, datatype: DataType.FLOAT, name: "detect_isc" }),
    createRegisterDef({ address: 74, datatype: DataType.FLOAT, name: "detect_pv" }),
    createRegisterDef({ address: 1147, datatype: DataType.UCHAR, name: "detect_cascade" }),
  );
  for (let zone = 0; zone < 10; zone += 1) {
    definitions.push(
      createRegisterDef({
        address: 2000 + zone * 65,
        datatype: DataType.UCHAR,
        name: `detect_zm${String(zone + 1)}`,
      }),
    );
  }
  return Object.freeze(definitions);
}

export function getRegister(name: string, options: ModelOption = {}): RegisterDef {
  const core = CORE_REGISTERS.get(name);
  if (core !== undefined) return core;
  const register = buildRegisterMap({ modelInfo: options.modelInfo ?? null }).get(name);
  if (register === undefined) {
    throw new Error(`Register '${name}' not found.`);
  }
  return register;
}

export function getRegisterRegistry(options: ModelOption = {}): RegisterRegistry {
  return new RegisterRegistry(
    options.modelInfo == null ? CORE_REGISTERS : buildRegisterMap({ modelInfo: options.modelInfo }),
  );
}

export function getAllRegisters(options: ModelOption = {}): readonly RegisterDef[] {
  const registers =
    options.modelInfo == null ? CORE_REGISTERS : buildRegisterMap({ modelInfo: options.modelInfo });
  return Object.freeze([...registers.values()]);
}
