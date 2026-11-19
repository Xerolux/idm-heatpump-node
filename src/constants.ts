type OptionMap<T extends Record<number, string>> = Readonly<T>;

function frozenOptions<const T extends Record<number, string>>(value: T): OptionMap<T> {
  return Object.freeze(value);
}

function immutableSet<T>(values: Iterable<T>): ReadonlySet<T> {
  const backing = new Set(values);
  const view: ReadonlySet<T> = Object.freeze({
    get size(): number {
      return backing.size;
    },
    has: (value: T): boolean => backing.has(value),
    entries: (): SetIterator<[T, T]> => backing.entries(),
    keys: (): SetIterator<T> => backing.keys(),
    values: (): SetIterator<T> => backing.values(),
    forEach(callback: (value: T, value2: T, set: ReadonlySet<T>) => void, thisArg?: unknown): void {
      for (const value of backing) {
        callback.call(thisArg, value, value, view);
      }
    },
    [Symbol.iterator]: (): SetIterator<T> => backing[Symbol.iterator](),
  });
  return view;
}

export const DEFAULT_PORT = 502;
export const DEFAULT_SLAVE_ID = 1;
export const DEFAULT_TIMEOUT = 10;
export const MAX_RETRIES = 3;
export const RETRY_BACKOFF_BASE = 0.5;
export const MODEL_DETECTION_TIMEOUT = 2;
export const MODEL_DETECTION_MAX_RETRIES = 1;

export const HEATING_CIRCUIT_LETTERS = Object.freeze(["A", "B", "C", "D", "E", "F", "G"] as const);
export const MAX_HEATING_CIRCUITS = 7;
export const MAX_ZONE_MODULES = 10;
export const MAX_ROOMS_PER_ZONE = 8;

export const MODEL_NAVIGATOR_20 = "Navigator 2.0";
export const MODEL_NAVIGATOR_PRO = "Navigator Pro";
export const MODEL_NAVIGATOR_10 = "Navigator 10";
export const MODEL_NAVIGATOR_17 = "Navigator 1.7";
export const MODEL_UNKNOWN = "Unknown";

export const FEATURE_SOLAR = "solar";
export const FEATURE_ISC = "isc";
export const FEATURE_PV = "pv";
export const FEATURE_CASCADE = "cascade";
export const FEATURE_ZONE_MODULES = "zone_modules";
export const FEATURE_HEATING_CIRCUITS = "heating_circuits";

export const SYSTEM_MODE_OPTIONS = frozenOptions({
  0: "Standby",
  1: "Automatic",
  2: "Absent",
  // 3 = Holiday: accepted since Python 2.14.5 (idm-heatpump-hass#596) —
  // validated Modbus polls discarded register 1005 while the controller
  // was on holiday although the web protocol already supported the mode.
  3: "Holiday",
  4: "Hot Water Only",
  5: "Heating/Cooling Only",
});

/**
 * Navigator 1.0/1.7 system mode (holding register 2000). The value set
 * differs from the shared family's SYSTEM_MODE_OPTIONS on purpose: 2 is
 * hot water charging and 3 a one-time hot water charge, values the shared
 * family assigns differently. Official ma_de_812049 Rev.1 table; reads and
 * writes confirmed against a real Navigator 1.7 (idm-heatpump-hass#319).
 */
export const SYSTEM_MODE_17_OPTIONS = frozenOptions({
  0: "Standby",
  1: "Automatic",
  2: "Hot Water",
  3: "Hot Water Once",
});

/**
 * Navigator 1.0/1.7 heating-circuit operating mode (holding register 2002
 * for circuit A). Not the shared family's active hc mode: this selects the
 * circuit's operating mode, not the currently active function.
 */
export const HC_OPERATING_MODE_17_OPTIONS = frozenOptions({
  0: "Off",
  1: "Time Program",
  2: "Normal",
  3: "ECO",
  4: "Heating Only",
});

/**
 * Navigator 1.0/1.7 solar operating mode (holding register 2150, SC002).
 * Selects what the solar circuit charges. Distinct from the read-only
 * solar_mode status word at 1522, which reports the running state with a
 * different value range.
 */
export const SOLAR_OPERATING_MODE_17_OPTIONS = frozenOptions({
  0: "Automatic",
  1: "Domestic Water",
  2: "Heat Storage",
  3: "Domestic Water + Heat Storage",
  4: "Heat Source / Pool",
});

export const CIRCUIT_MODE_OPTIONS = frozenOptions({
  0: "Off",
  1: "Time Program",
  2: "Normal",
  3: "Eco",
  4: "Manual Heat",
  5: "Manual Cool",
  255: "Not configured / Unavailable",
});

export const ROOM_MODE_OPTIONS = frozenOptions({
  0: "Off",
  1: "Automatic",
  2: "Eco",
  3: "Normal",
  4: "Comfort",
});

export const HP_OPERATING_MODE_OPTIONS = frozenOptions({
  0: "Standby",
  1: "Heating",
  2: "Cooling",
  4: "DHW",
  8: "Defrost",
});

export const SMART_GRID_OPTIONS = frozenOptions({
  0: "Red",
  1: "Yellow",
  2: "Green",
  4: "Supergreen",
});

export const VARIABLE_INPUT_OPTIONS = frozenOptions({
  0: "Not configured",
  1: "External DHW Charging",
  2: "PV / Digital Input",
  3: "External Heat/Cool Switch",
});

export const EVU_LOCK_OPTIONS = frozenOptions({
  0: "Locked",
  1: "Not Locked",
});

/**
 * Address 1110: heating-circuit changeover valve (M61). The official
 * Navigator 10 table (2025-06-18) labels the two positions explicitly:
 * 0 ... Heizen (Heating), 1 ... Kühlen (Cooling). The neighbouring valve
 * status words (1111-1116) document only the 0/1 range without value
 * labels, so they deliberately stay raw until field captures confirm
 * their polarity.
 */
export const VALVE_HC_HEAT_COOL_OPTIONS = frozenOptions({
  0: "Heating",
  1: "Cooling",
});

/**
 * Navigator 1.7 status registers (1513-1517): pump and compressor
 * auxiliary statuses share one documented value set.
 */
export const PUMP_STATUS_OPTIONS = frozenOptions({
  0: "Off",
  1: "Running",
  2: "Fault",
});

export const BIVALENCE_STATE_OPTIONS = frozenOptions({
  0: "Off",
  1: "Bivalence 1 Active",
  2: "Bivalence 2 Active",
  3: "Bivalence 1+2 Active",
});

export const SOLAR_MODE_OPTIONS = frozenOptions({
  0: "Automatic",
  1: "DHW",
  2: "Heating",
  3: "DHW + Heating",
  4: "Heat Source / Pool",
});

export const ISC_MODE_OPTIONS = frozenOptions({
  0: "No Waste Heat",
  1: "Heating",
  4: "DHW",
  8: "Heat Source",
  255: "Not configured / Unavailable",
});

export const ACTIVE_HC_MODE_OPTIONS = frozenOptions({
  0: "Off",
  1: "Heating",
  2: "Cooling",
  255: "Not configured / Unavailable",
});

export const ZONE_MODULE_MODE_OPTIONS = frozenOptions({
  0: "Cooling",
  1: "Heating",
});

export const BOOSTER_FAULT_OPTIONS = frozenOptions({
  0: "No fault",
  1: "Booster A fault",
  2: "Booster B fault",
  3: "Booster A + B fault",
});

export const EEPROM_SENSITIVE_ADDRESSES = immutableSet([
  1005, 1032, 1033, 1034, 1120, 1121, 1122, 1123, 1393, 1394, 1395, 1396, 1397, 1398, 1399, 1401,
  1403, 1405, 1407, 1409, 1411, 1413, 1415, 1417, 1419, 1421, 1423, 1425, 1427, 1429, 1431, 1433,
  1435, 1437, 1439, 1441, 1442, 1443, 1444, 1445, 1446, 1447, 1448, 1449, 1450, 1451, 1452, 1453,
  1454, 1455, 1457, 1459, 1461, 1463, 1465, 1467, 1469, 1471, 1473, 1475, 1477, 1479, 1481, 1483,
  1484, 1485, 1486, 1487, 1488, 1489, 1490, 1491, 1492, 1493, 1494, 1495, 1496, 1497, 1505, 1506,
  1507, 1508, 1509, 1510, 1511, 1694, 1695, 1856,
]);
