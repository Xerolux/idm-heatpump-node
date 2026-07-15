import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import * as constants from "../../src/constants.js";
import { SemanticValidationError } from "../../src/errors.js";
import { AdaptiveBackoff, PollRateLimiter } from "../../src/timing.js";
import {
  DATA_TYPE_SIZE,
  DataType,
  FeatureFlags,
  IdmModelInfo,
  RegisterType,
  WriteClass,
} from "../../src/types.js";

interface ApiMappingRow {
  readonly python_symbol: string;
  readonly typescript_symbol: string;
  readonly owner_phase: number;
  readonly representation: {
    readonly form: string;
    readonly constructor: string;
  };
}

interface ApiMapping {
  readonly mappings: readonly ApiMappingRow[];
}

interface PublicClassFact {
  readonly python_name: string;
  readonly members: readonly { readonly name: string }[];
}

interface PublicClasses {
  readonly classes: readonly PublicClassFact[];
}

const mapping = JSON.parse(readFileSync("contracts/api-mapping.json", "utf8")) as ApiMapping;
const publicClasses = JSON.parse(
  readFileSync("test/fixtures/public-classes.json", "utf8"),
) as PublicClasses;

const EXPECTED_CONSTANTS = {
  ACTIVE_HC_MODE_OPTIONS: {
    0: "Off",
    1: "Heating",
    2: "Cooling",
    255: "Not configured / Unavailable",
  },
  BIVALENCE_STATE_OPTIONS: {
    0: "Off",
    1: "Bivalence 1 Active",
    2: "Bivalence 2 Active",
    3: "Bivalence 1+2 Active",
  },
  BOOSTER_FAULT_OPTIONS: {
    0: "No fault",
    1: "Booster A fault",
    2: "Booster B fault",
    3: "Booster A + B fault",
  },
  CIRCUIT_MODE_OPTIONS: {
    0: "Off",
    1: "Time Program",
    2: "Normal",
    3: "Eco",
    4: "Manual Heat",
    5: "Manual Cool",
    255: "Not configured / Unavailable",
  },
  DEFAULT_PORT: 502,
  DEFAULT_SLAVE_ID: 1,
  DEFAULT_TIMEOUT: 10,
  EEPROM_SENSITIVE_ADDRESSES: [
    1005, 1032, 1033, 1034, 1120, 1121, 1122, 1123, 1393, 1394, 1395, 1396, 1397, 1398, 1399, 1401,
    1403, 1405, 1407, 1409, 1411, 1413, 1415, 1417, 1419, 1421, 1423, 1425, 1427, 1429, 1431, 1433,
    1435, 1437, 1439, 1441, 1442, 1443, 1444, 1445, 1446, 1447, 1448, 1449, 1450, 1451, 1452, 1453,
    1454, 1455, 1457, 1459, 1461, 1463, 1465, 1467, 1469, 1471, 1473, 1475, 1477, 1479, 1481, 1483,
    1484, 1485, 1486, 1487, 1488, 1489, 1490, 1491, 1492, 1493, 1494, 1495, 1496, 1497, 1505, 1506,
    1507, 1508, 1509, 1510, 1511, 1694, 1695, 1856,
  ],
  EVU_LOCK_OPTIONS: { 0: "Locked", 1: "Not Locked" },
  FEATURE_CASCADE: "cascade",
  FEATURE_HEATING_CIRCUITS: "heating_circuits",
  FEATURE_ISC: "isc",
  FEATURE_PV: "pv",
  FEATURE_SOLAR: "solar",
  FEATURE_ZONE_MODULES: "zone_modules",
  HEATING_CIRCUIT_LETTERS: ["A", "B", "C", "D", "E", "F", "G"],
  HP_OPERATING_MODE_OPTIONS: {
    0: "Standby",
    1: "Heating",
    2: "Cooling",
    4: "DHW",
    8: "Defrost",
  },
  ISC_MODE_OPTIONS: {
    0: "No Waste Heat",
    1: "Heating",
    4: "DHW",
    8: "Heat Source",
    255: "Not configured / Unavailable",
  },
  MAX_HEATING_CIRCUITS: 7,
  MAX_RETRIES: 3,
  MAX_ROOMS_PER_ZONE: 8,
  MAX_ZONE_MODULES: 10,
  MODEL_DETECTION_MAX_RETRIES: 1,
  MODEL_DETECTION_TIMEOUT: 2,
  MODEL_NAVIGATOR_10: "Navigator 10",
  MODEL_NAVIGATOR_20: "Navigator 2.0",
  MODEL_NAVIGATOR_PRO: "Navigator Pro",
  MODEL_UNKNOWN: "Unknown",
  RETRY_BACKOFF_BASE: 0.5,
  ROOM_MODE_OPTIONS: { 0: "Off", 1: "Automatic", 2: "Eco", 3: "Normal", 4: "Comfort" },
  SMART_GRID_OPTIONS: { 0: "Red", 1: "Yellow", 2: "Green", 4: "Supergreen" },
  SOLAR_MODE_OPTIONS: {
    0: "Automatic",
    1: "DHW",
    2: "Heating",
    3: "DHW + Heating",
    4: "Heat Source / Pool",
  },
  SYSTEM_MODE_OPTIONS: {
    0: "Standby",
    1: "Automatic",
    2: "Absent",
    4: "Hot Water Only",
    5: "Heating/Cooling Only",
  },
  VARIABLE_INPUT_OPTIONS: {
    0: "Not configured",
    1: "External DHW Charging",
    2: "PV / Digital Input",
    3: "External Heat/Cool Switch",
  },
  ZONE_MODULE_MODE_OPTIONS: { 0: "Cooling", 1: "Heating" },
} as const;

function mappingRow(name: string): ApiMappingRow {
  const row = mapping.mappings.find((candidate) => candidate.python_symbol === name);
  if (row === undefined) {
    throw new Error(`Missing API mapping for ${name}`);
  }
  return row;
}

function classFact(name: string): PublicClassFact {
  const fact = publicClasses.classes.find((candidate) => candidate.python_name === name);
  if (fact === undefined) {
    throw new Error(`Missing public class facts for ${name}`);
  }
  return fact;
}

describe("pinned constants and mapped semantic types", () => {
  it("implements exactly the 35 pinned const.py exports owned by phase 1", () => {
    const mappedConstantNames = mapping.mappings
      .filter(
        (row) =>
          row.owner_phase === 1 &&
          row.representation.form === "frozen_constant" &&
          row.python_symbol !== "CORE_REGISTERS",
      )
      .map((row) => row.typescript_symbol)
      .sort();

    expect(mappedConstantNames).toEqual(Object.keys(EXPECTED_CONSTANTS).sort());
    expect(mappedConstantNames).toHaveLength(35);

    for (const [name, expected] of Object.entries(EXPECTED_CONSTANTS)) {
      const actual = constants[name as keyof typeof constants];
      if (name === "EEPROM_SENSITIVE_ADDRESSES") {
        expect([...constants.EEPROM_SENSITIVE_ADDRESSES]).toEqual(expected);
      } else {
        expect(actual).toEqual(expected);
      }
      expect(mappingRow(name).typescript_symbol).toBe(name);
      expect(mappingRow(name).representation.form).toBe("frozen_constant");
    }
  });

  it("publishes frozen const-and-union runtime domains and exhaustive sizes", () => {
    expect(DataType).toEqual({
      FLOAT: "FLOAT",
      UCHAR: "UCHAR",
      INT8: "INT8",
      INT16: "INT16",
      UINT16: "UINT16",
      BOOL: "BOOL",
      BITFLAG: "BITFLAG",
    });
    expect(RegisterType).toEqual({ INPUT: "input", HOLDING: "holding" });
    expect(WriteClass).toEqual({
      FORBIDDEN: "forbidden",
      VOLATILE: "volatile",
      CYCLIC: "cyclic",
      EEPROM: "eeprom",
      WRITE_ONLY: "write_only",
    });
    expect(DATA_TYPE_SIZE).toEqual({
      FLOAT: 2,
      UCHAR: 1,
      INT8: 1,
      INT16: 1,
      UINT16: 1,
      BOOL: 1,
      BITFLAG: 1,
    });

    for (const name of ["DataType", "RegisterType", "WriteClass"] as const) {
      expect(mappingRow(name).representation).toMatchObject({
        form: "frozen_const_and_union",
        constructor: "not_constructible",
      });
    }
    expect(Object.isFrozen(DataType)).toBe(true);
    expect(Object.isFrozen(RegisterType)).toBe(true);
    expect(Object.isFrozen(WriteClass)).toBe(true);
    expect(Object.isFrozen(DATA_TYPE_SIZE)).toBe(true);
  });

  it("keeps all exported collection constants isolated from hostile mutation", () => {
    expect(Reflect.set(constants.SYSTEM_MODE_OPTIONS, "0", "corrupt")).toBe(false);
    expect(Reflect.set(constants.HEATING_CIRCUIT_LETTERS, "0", "Z")).toBe(false);
    expect(() =>
      (constants.EEPROM_SENSITIVE_ADDRESSES as unknown as Set<number>).add(9999),
    ).toThrow(TypeError);

    expect(constants.SYSTEM_MODE_OPTIONS[0]).toBe("Standby");
    expect(constants.HEATING_CIRCUIT_LETTERS[0]).toBe("A");
    expect(constants.EEPROM_SENSITIVE_ADDRESSES.has(9999)).toBe(false);
  });

  it("creates the complete immutable FeatureFlags shape with pinned defaults", () => {
    const flags = FeatureFlags.create();
    expect(flags).toEqual({
      enableNav2Web: true,
      enableNav10Ws: true,
      enableExperimentalFeatures: false,
      enableWriteSupport: true,
      enableDebugEndpoints: false,
    });
    expect(Object.isFrozen(flags)).toBe(true);
    expect(mappingRow("FeatureFlags").representation.form).toBe("readonly_object_factory");
    expect(
      classFact("FeatureFlags")
        .members.map(({ name }) => name)
        .sort(),
    ).toEqual([
      "enable_debug_endpoints",
      "enable_experimental_features",
      "enable_nav10_ws",
      "enable_nav2_web",
      "enable_write_support",
    ]);

    expect(FeatureFlags.create({ enableNav2Web: false, enableDebugEndpoints: true })).toEqual({
      enableNav2Web: false,
      enableNav10Ws: true,
      enableExperimentalFeatures: false,
      enableWriteSupport: true,
      enableDebugEndpoints: true,
    });
  });

  it("creates cloned immutable IdmModelInfo values and derives isPro", () => {
    const circuits = ["A"];
    const features = new Set(["solar"]);
    const info = IdmModelInfo.create({
      modelName: "Navigator Pro",
      activeHeatingCircuits: circuits,
      zoneModules: 1,
      hasSolar: true,
      hasIsc: false,
      hasPv: false,
      hasCascade: false,
      features,
    });
    circuits.push("B");
    features.add("corrupt");

    expect(info).toMatchObject({
      modelName: "Navigator Pro",
      activeHeatingCircuits: ["A"],
      zoneModules: 1,
      hasSolar: true,
      hasIsc: false,
      hasPv: false,
      hasCascade: false,
      firmwareVersion: null,
      isPro: true,
    });
    expect([...info.features]).toEqual(["solar"]);
    expect(Object.isFrozen(info)).toBe(true);
    expect(Object.isFrozen(info.activeHeatingCircuits)).toBe(true);
    expect(() => (info.features as unknown as Set<string>).add("mutated")).toThrow(TypeError);
    expect(classFact("IdmModelInfo").members.map(({ name }) => name)).toContain("is_pro");
    expect(mappingRow("IdmModelInfo").representation.form).toBe("readonly_object_factory");

    expect(
      IdmModelInfo.create({
        modelName: "Navigator 2.0",
        activeHeatingCircuits: [],
        zoneModules: 0,
        hasSolar: false,
        hasIsc: false,
        hasPv: false,
        hasCascade: false,
      }).isPro,
    ).toBe(false);
  });
});

describe("pinned pure timing helpers", () => {
  it("implements AdaptiveBackoff defaults, cap, and reset", () => {
    const backoff = new AdaptiveBackoff();
    expect([
      backoff.nextDelay(),
      backoff.nextDelay(),
      backoff.nextDelay(),
      backoff.nextDelay(),
      backoff.nextDelay(),
      backoff.nextDelay(),
    ]).toEqual([5, 15, 45, 135, 300, 300]);
    backoff.reset();
    expect(backoff.nextDelay()).toBe(5);

    expect(mappingRow("AdaptiveBackoff").typescript_symbol).toBe("AdaptiveBackoff");
    expect(
      classFact("AdaptiveBackoff")
        .members.map(({ name }) => name)
        .sort(),
    ).toEqual(["next_delay", "reset"]);
  });

  it.each([
    [{ initial: 0 }, "initial backoff must be positive"],
    [{ multiplier: 0.5 }, "backoff multiplier must be >= 1"],
    [{ initial: 10, maximum: 9 }, "maximum backoff must be >= initial"],
  ] as const)("rejects invalid AdaptiveBackoff options %o", (options, diagnostic) => {
    expect(() => new AdaptiveBackoff(options)).toThrowError(
      expect.objectContaining({
        category: "validation",
        code: "register_invalid",
        diagnostic,
      }),
    );
  });

  it("implements PollRateLimiter with a fake clock and readonly interval", () => {
    let now = 100;
    const limiter = new PollRateLimiter(5, { clock: () => now });

    expect(limiter.interval).toBe(5);
    expect(limiter.remaining()).toBe(0);
    expect(limiter.allow()).toBe(true);
    limiter.mark();
    expect(limiter.allow()).toBe(false);
    expect(limiter.remaining()).toBe(5);
    now = 103;
    expect(limiter.remaining()).toBe(2);
    now = 105;
    expect(limiter.remaining()).toBe(0);
    expect(limiter.allow()).toBe(true);
    expect(Reflect.set(limiter, "interval", 10)).toBe(false);
    expect(limiter.interval).toBe(5);

    expect(
      classFact("PollRateLimiter")
        .members.map(({ name }) => name)
        .sort(),
    ).toEqual(["allow", "interval", "mark", "remaining"]);
    expect(mappingRow("PollRateLimiter").representation.form).toBe("class");
  });

  it("accepts a zero poll interval and rejects only the pinned negative boundary", () => {
    expect(new PollRateLimiter(0).interval).toBe(0);
    expect(() => new PollRateLimiter(-1)).toThrowError(
      expect.objectContaining({
        category: "validation",
        code: "register_invalid",
        diagnostic: "poll interval must be >= 0",
      }),
    );
  });

  it("uses the stable Phase-1 validation error shape", () => {
    const error = new SemanticValidationError("register_invalid", "diagnostic");
    expect(error).toBeInstanceOf(RangeError);
    expect(error).toMatchObject({
      name: "SemanticValidationError",
      category: "validation",
      code: "register_invalid",
      diagnostic: "diagnostic",
    });
  });
});
