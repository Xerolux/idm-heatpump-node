import {
  HC_OPERATING_MODE_17_OPTIONS,
  HP_OPERATING_MODE_OPTIONS,
  MODEL_NAVIGATOR_17,
  PUMP_STATUS_OPTIONS,
  SOLAR_OPERATING_MODE_17_OPTIONS,
  SYSTEM_MODE_17_OPTIONS,
} from "../constants.js";
import { DataType, RegisterType } from "../types.js";
import type { RegisterDef, RegisterDefInput } from "./definitions.js";
import { buildRegisterDefinitions } from "./map-utils.js";

const NAVIGATOR_17_REGISTER_SOURCE = "official_idm_modbus";
const NAVIGATOR_17_REGISTER_SOURCE_VERSION =
  "Modbus TCP Navigator 1.0/1.7 register table 2016-06-13 (ma_de_812049)";
// The PV block (74-82) and the power measurement (4122) were added to the
// 1.x firmware after the 2016 table was published; iDM support documents
// them as the same data points the shared 2.0/10/Pro family exposes at the
// same addresses. Older 1.x firmware rejects them, so the block is included
// only when the detection probe at address 74 responded.
const NAVIGATOR_17_PV_SOURCE_VERSION =
  "iDM PV-signal Modbus TCP supplement to ma_de_812049 (post-2016)";
const NAVIGATOR_17_HOLDING_SOURCE_VERSION =
  "RW holding table of ma_de_812049 Rev.1 (2016-06-13), read/write confirmed by FHEM capture (idm-heatpump-hass#319, 2026-09)";
const NAVIGATOR_17_COIL_SOURCE_VERSION =
  "Coil table of ma_de_812049 Rev.1 (2016-06-13), read confirmed by FHEM capture (idm-heatpump-hass#319, 2026-09)";

/**
 * Register map for the Navigator 1.0/1.7 protocol family.
 *
 * Source: official iDM Modbus TCP documentation for Navigator 1.0/1.7
 * (ma_de_812049 Rev.1, register table dated 2016-06-13). The 1.x family
 * uses a completely different layout from Navigator 2.0/10/Pro; in
 * particular the meaning of the FLOAT block from address 1000 differs
 * register by register (for example 1002 is the heat-pump flow
 * temperature, not the averaged outdoor temperature, and 1046 is the
 * humidity sensor). Never reuse the shared 2.0/10/Pro definitions for
 * these addresses.
 *
 * The FC04 input blocks (FLOAT values from 1000, status words from 1500)
 * are read-only. The FC03/FC06 holding block from 2000 carries the
 * official RW parameter table (system mode, per-circuit operating modes,
 * room/flow setpoints, heating curves, limits, bivalence points, solar
 * mode, DHW setpoint); every holding register is EEPROM-sensitive per the
 * official warning (300 000 write cycles per register, identical values
 * are not rewritten). The per-circuit parameters reuse the shared
 * family's register names because ranges and semantics are identical —
 * the 2.0/10/Pro holding block is the direct successor of this table.
 * The FC01/FC05 coil block from 3000 (Störung quittieren, Anforderung
 * Vorrangladung) is mapped as write-only COIL commands since Python
 * 2.5.0 (readable status coils were removed in 2.13.0 — they are
 * momentary command bits, not state); reading and writing them needs a
 * transport implementing the coil extension. When the detection probe at
 * address 74 responded (`hasPv`), the post-2016 PV supplement is
 * included: the writable PV/energy-management registers (74/76/78/82,
 * mirroring the shared family's volatile writes) and the read-only power
 * measurement at 4122.
 */
export function getNavigator17Registers(
  options: { hasPv?: boolean } = {},
): ReadonlyMap<string, RegisterDef> {
  const hasPv = options.hasPv ?? false;
  const inputs: RegisterDefInput[] = [];

  const familyRegister = (
    input: Omit<RegisterDefInput, "source" | "sourceVersion" | "supportedModels">,
  ) => {
    inputs.push({
      ...input,
      source: NAVIGATOR_17_REGISTER_SOURCE,
      sourceVersion: NAVIGATOR_17_REGISTER_SOURCE_VERSION,
      supportedModels: [MODEL_NAVIGATOR_17],
    });
  };

  // FC04 input block from 1000: FLOAT values, low word first.
  const floatSpecs: readonly (readonly [number, string, string | null])[] = [
    [1000, "outdoor_temp", "°C"], // Aussentemperatur
    [1002, "hp_flow_temp", "°C"], // Wärmepumpen Vorlauftemperatur
    [1004, "hgl_flow_temp", "°C"], // HGL Vorlauftemperatur
    [1006, "heat_source_outlet_temp", "°C"], // Wärmequellenaustrittstemperatur
    // WP-Rücklauftemperatur / Wärmespeichertemperatur (one data point)
    [1008, "storage_temp", "°C"],
    [1010, "cold_storage_temp", "°C"], // Kältespeichertemperatur
    [1012, "dhw_temp", "°C"], // Trinkwassererwärmertemperatur
    [1014, "dhw_tapping_temp", "°C"], // Frischwasserzapftemperatur
    [1044, "hot_gas_temp", "°C"], // Heissgastemperatur
    [1046, "humidity_sensor", "%"], // Feuchtesensor
    [1048, "air_intake_temp", "°C"], // Luftansaugtemperatur
    [1050, "air_heat_exchanger_temp", "°C"], // Luftwärmetauschertemperatur
    [1052, "solar_collector_temp", "°C"], // Solar Kollektortemperatur
    [1054, "solar_charging_temp", "°C"], // Solar Ladetemperatur
    [1056, "solar_collector_return_temp", "°C"], // Solar Kollektorrücklauftemperatur
    // Solar Wärmequellenreferenz-/Pooltemperatur
    [1058, "solar_pool_temp", "°C"],
    [1060, "outdoor_temp_avg", "°C"], // Gemittelte Aussentemperatur
    [1062, "heat_source_inlet_temp", "°C"], // Wärmequelleneintrittstemperatur
    [1064, "isc_cooling_charge_temp", "°C"], // ISC Ladefühler Kühlen
    [1066, "isc_recooling_temp", "°C"], // ISC Rückkühlfühler
  ];
  for (const [address, name, unit] of floatSpecs) {
    familyRegister({ address, datatype: DataType.FLOAT, name, unit });
  }

  // Heating-circuit A-G flow temperatures (1016-1028) and room-device
  // temperatures (1030-1042), two registers per value.
  for (let index = 0; index < 7; index += 1) {
    const letter = "abcdefg"[index] as string;
    familyRegister({
      address: 1016 + index * 2,
      datatype: DataType.FLOAT,
      name: `hc_${letter}_flow_temp`,
      unit: "°C",
    });
    // Raumgerät temperature of heating circuit A-G
    familyRegister({
      address: 1030 + index * 2,
      datatype: DataType.FLOAT,
      name: `hc_${letter}_room_device_temp`,
      unit: "°C",
    });
  }

  // Thermal power values (kW, instantaneous).
  familyRegister({
    address: 1068,
    datatype: DataType.FLOAT,
    name: "thermal_power_hp_flow",
    unit: "kW",
    stateClass: "measurement",
  });
  familyRegister({
    address: 1070,
    datatype: DataType.FLOAT,
    name: "thermal_power_hgl_flow",
    unit: "kW",
    stateClass: "measurement",
  });
  // Wärmemenge Momentanleistung
  familyRegister({
    address: 1072,
    datatype: DataType.FLOAT,
    name: "thermal_power_total",
    unit: "kW",
    stateClass: "measurement",
  });
  familyRegister({
    address: 1074,
    datatype: DataType.FLOAT,
    name: "thermal_power_solar",
    unit: "kW",
    stateClass: "measurement",
  });

  // Heat meters (kWh, cumulative).
  const meterSpecs: readonly (readonly [number, string, string | null, string])[] = [
    [1076, "energy_total", "kWh", "total_increasing"],
    [1078, "energy_heating", "kWh", "total_increasing"],
    [1080, "energy_hgl", "kWh", "total_increasing"],
    [1082, "energy_cooling", "kWh", "total_increasing"],
    [1084, "energy_solar", "kWh", "total_increasing"],
    // Summe Durchflussmengenzähler Grundwasserpumpe; the volume unit is
    // not documented, so the value is exposed without one.
    [1086, "groundwater_pump_flow_total", null, "total_increasing"],
    // Betriebsstundenzähler Wärmequellenpumpe
    [1088, "heat_source_pump_operating_hours", "h", "total_increasing"],
  ];
  for (const [address, name, unit, stateClass] of meterSpecs) {
    familyRegister({ address, datatype: DataType.FLOAT, name, unit, stateClass });
  }

  // FC04 input block from 1500: UINT16 status words.
  familyRegister({
    address: 1500,
    datatype: DataType.UINT16,
    name: "error_number", // Aktuelle Störungsnummer
  });
  // UCHAR per the 1.x table: firmwares return the mode byte doubled into
  // both bytes of the word (a value of 1 arrives as 0x0101), so the low
  // byte must be masked off instead of decoding the whole word.
  familyRegister({
    address: 1501,
    datatype: DataType.UCHAR,
    name: "hp_operating_mode",
    enumOptions: HP_OPERATING_MODE_OPTIONS,
  });
  // The status words from 1502 on carry their documented MIN/MAX ranges
  // so consumers can reject garbage: Rev.0-era 1.x firmware (documented up
  // to 1501) answers these addresses with uninitialized memory instead of
  // an Illegal Data Address rejection (observed on N1.MLj,
  // idm-heatpump-hass issue #364).
  for (let index = 0; index < 7; index += 1) {
    const letter = "abcdefg"[index] as string;
    // Status Heizkreis A-G: 0-2.
    familyRegister({
      address: 1502 + index,
      datatype: DataType.UINT16,
      name: `hc_${letter}_status`,
      minVal: 0,
      maxVal: 2,
    });
  }
  for (let index = 1; index <= 4; index += 1) {
    // Status Verdichter 1-4: 0 = off, 1 = on. Named like the shared
    // family's compressor_status_N so consumers reuse translations and
    // binary metadata.
    familyRegister({
      address: 1508 + index,
      datatype: DataType.UINT16,
      name: `compressor_status_${String(index)}`,
      binary: true,
      minVal: 0,
      maxVal: 1,
    });
  }
  // Pump statuses share the documented 0/1/2 value set.
  const pumpSpecs: readonly (readonly [number, string])[] = [
    [1513, "charging_pump_status"], // Ladepumpe
    [1514, "heat_source_pump_status"], // Wärmequellenpumpe
    [1515, "intermediate_circuit_pump_status"], // Zwischenkreispumpe
    [1516, "isc_cold_storage_pump_status"], // ISC Kältespeicherpumpe
    [1517, "isc_recooling_pump_status"], // ISC Rückkühlpumpe
  ];
  for (const [address, name] of pumpSpecs) {
    familyRegister({
      address,
      datatype: DataType.UINT16,
      name,
      enumOptions: PUMP_STATUS_OPTIONS,
      minVal: Math.min(...Object.keys(PUMP_STATUS_OPTIONS).map(Number)),
      maxVal: Math.max(...Object.keys(PUMP_STATUS_OPTIONS).map(Number)),
    });
  }
  // Laufende Verdichterstufen (counts 0-12).
  familyRegister({
    address: 1518,
    datatype: DataType.UINT16,
    name: "compressor_stages_heating",
    minVal: 0,
    maxVal: 12,
  });
  familyRegister({
    address: 1519,
    datatype: DataType.UINT16,
    name: "compressor_stages_cooling",
    minVal: 0,
    maxVal: 12,
  });
  // Laufende Verdichterstufen Vorrang gesamt (DHW priority, 0-12).
  familyRegister({
    address: 1520,
    datatype: DataType.UINT16,
    name: "compressor_stages_dhw",
    minVal: 0,
    maxVal: 12,
  });
  // Betriebsart Kaskade / Solar / Smart Grid / IDM Systemkühlung (ISC).
  // Rev.1 documents the ranges but no value meanings, so they stay plain
  // numbers bounded by the documented MIN/MAX.
  familyRegister({
    address: 1521,
    datatype: DataType.UINT16,
    name: "cascade_mode",
    minVal: 0,
    maxVal: 8,
  });
  familyRegister({
    address: 1522,
    datatype: DataType.UINT16,
    name: "solar_mode",
    minVal: 0,
    maxVal: 17,
  });
  familyRegister({
    address: 1523,
    datatype: DataType.UINT16,
    name: "smart_grid_status",
    minVal: 0,
    maxVal: 3,
  });
  familyRegister({
    address: 1524,
    datatype: DataType.UINT16,
    name: "isc_mode",
    minVal: 0,
    maxVal: 8,
  });

  // FC03/FC06 holding block from 2000: the complete RW parameter table of
  // ma_de_812049 Rev.1 (system mode, per-circuit modes, room/flow
  // setpoints, heating curves, limits, bivalence points, solar mode, DHW
  // setpoint). The operating modes were additionally confirmed by a
  // working FHEM configuration against a real Navigator 1.7
  // (idm-heatpump-hass issue #319, September 2026), including daily
  // writes of 2000/2002 and plausible float reads at 2016/2030 (the
  // documented defaults 22/18). The 2000-block floats follow the map-wide
  // low-word-first rule, which section 3.1 of the official document
  // states explicitly (Reg_L first, Reg_H second). Per-circuit
  // parameters reuse the shared family's names: the official ranges are
  // identical, so consumers get the shared metadata for free. The
  // system/circuit/solar modes carry their own names and enum tables
  // because their value sets differ from the shared family. Every
  // register here is writable and EEPROM-sensitive: the official document
  // allows at most 300 000 write cycles per register and skips identical
  // values.
  const holding = (
    input: Omit<RegisterDefInput, "source" | "sourceVersion" | "supportedModels">,
  ) => {
    inputs.push({
      ...input,
      writable: true,
      registerType: RegisterType.HOLDING,
      eepromSensitive: true,
      lastVerified: "2026-09-24",
      source: NAVIGATOR_17_REGISTER_SOURCE,
      sourceVersion: NAVIGATOR_17_HOLDING_SOURCE_VERSION,
      supportedModels: [MODEL_NAVIGATOR_17],
    });
  };

  // Enum modes: Betriebsart System (PROG0) 2000, Betriebsart Heizkreis
  // A-G (HKA01-HKG01) 2002-2014, Betriebsart Solar (SC002) 2150.
  const enumModeSpecs: readonly (readonly [number, string, Readonly<Record<number, string>>])[] = [
    [2000, "system_mode_17", SYSTEM_MODE_17_OPTIONS],
    ...[..."abcdefg"].map(
      (letter, index) =>
        [2002 + index * 2, `hc_${letter}_operating_mode`, HC_OPERATING_MODE_17_OPTIONS] as const,
    ),
    [2150, "solar_operating_mode_17", SOLAR_OPERATING_MODE_17_OPTIONS],
  ];
  for (const [address, name, options] of enumModeSpecs) {
    holding({
      address,
      datatype: DataType.UINT16,
      name,
      enumOptions: options,
      minVal: Math.min(...Object.keys(options).map(Number)),
      maxVal: Math.max(...Object.keys(options).map(Number)),
    });
  }

  // Word-sized parameters: Heizgrenze (HKA08) 2058-2070, Sollvorlauftemperatur
  // Heizen for constant-flow circuits (HKA03) 2072-2084, Kühlgrenze (HKA58)
  // 2114-2126, Sollvorlauftemperatur Kühlen (HKA53) 2128-2140, externe
  // Anforderungstemperaturen (PH003/PC004) 2142/2144. The official table
  // types them as UCHAR; a whole register is reserved per value
  // (2-register spacing), and the FHEM capture read clean small values, so
  // they map as UINT16. FW030 at 2152 is deliberately absent: it is a
  // float pair (see below).
  const wordSpecs: readonly (readonly [number, string, number, number])[] = [
    ...[..."abcdefg"].map(
      (letter, index) => [2058 + index * 2, `hc_${letter}_heating_limit`, 0, 50] as const,
    ),
    ...[..."abcdefg"].map(
      (letter, index) => [2072 + index * 2, `hc_${letter}_setpoint_flow_constant`, 20, 90] as const,
    ),
    ...[..."abcdefg"].map(
      (letter, index) => [2114 + index * 2, `hc_${letter}_cooling_limit`, 0, 36] as const,
    ),
    ...[..."abcdefg"].map(
      (letter, index) => [2128 + index * 2, `hc_${letter}_setpoint_flow_cooling`, 8, 30] as const,
    ),
    [2142, "external_demand_temp_heating", 20, 65],
    [2144, "external_demand_temp_cooling", 10, 25],
  ];
  for (const [address, name, minVal, maxVal] of wordSpecs) {
    holding({ address, datatype: DataType.UINT16, name, unit: "°C", minVal, maxVal });
  }

  // Frischwasser-Solltemperatur (FW030) 2152. The Rev.1 table types it as
  // a single-byte value like the other word parameters above, but a
  // hardware capture on firmware N1.MLj (idm-heatpump-hass issue #364,
  // September 2026) proved the firmware-specific exception: 2152/2153
  // answer (0, 0x4238), which is exactly 46.0 °C as an IEEE-754 float,
  // low word first — matching the Frischwasser-Solltemperatur shown on
  // the controller. Reading 2152 as a word yields 0, and moving the
  // setpoint on the controller or writing it over Modbus changes the pair
  // accordingly, in both directions. FW030 therefore maps as a float
  // spanning 2152-2153; the address after it (2154) times out and stays
  // unused.
  holding({
    address: 2152,
    datatype: DataType.FLOAT,
    name: "dhw_setpoint",
    unit: "°C",
    minVal: 35.0,
    maxVal: 60.0,
  });

  // Float parameters (low word first): Raumsolltemperatur Heizen Normal
  // (HKA04) 2016-2028 and ECO (HKA05) 2030-2042, Heizkurve (HKA10)
  // 2044-2056, Raumsolltemperatur Kühlen Normal (HKA50) 2086-2098 and
  // ECO (HKA51) 2100-2112.
  const floatParamSpecs: readonly (readonly [
    number,
    string,
    number,
    number,
    string | null,
    number | null,
  ])[] = [
    ...[..."abcdefg"].map(
      (letter, index) =>
        [
          2016 + index * 2,
          `hc_${letter}_room_setpoint_heat_normal`,
          15.0,
          30.0,
          "°C",
          null,
        ] as const,
    ),
    ...[..."abcdefg"].map(
      (letter, index) =>
        [2030 + index * 2, `hc_${letter}_room_setpoint_heat_eco`, 10.0, 25.0, "°C", null] as const,
    ),
    ...[..."abcdefg"].map(
      (letter, index) =>
        // Controller precision 0.05: the capture on firmware N1.MLj
        // (idm-heatpump-hass issue #364) shows 0.35, off the old 0.1
        // hint grid, and the controller UI steps by 0.05.
        [2044 + index * 2, `hc_${letter}_heating_curve`, 0.1, 3.5, null, 0.05] as const,
    ),
    ...[..."abcdefg"].map(
      (letter, index) =>
        [
          2086 + index * 2,
          `hc_${letter}_room_setpoint_cool_normal`,
          15.0,
          30.0,
          "°C",
          null,
        ] as const,
    ),
    ...[..."abcdefg"].map(
      (letter, index) =>
        [2100 + index * 2, `hc_${letter}_room_setpoint_cool_eco`, 15.0, 30.0, "°C", null] as const,
    ),
  ];
  for (const [address, name, minVal, maxVal, unit, step] of floatParamSpecs) {
    holding({ address, datatype: DataType.FLOAT, name, unit, minVal, maxVal, step });
  }

  // Signed words: Bivalenzpunkt 1/2 (BV002/BV003) 2146/2148, -20..20 °C.
  for (const [address, name] of [
    [2146, "bivalence_point_1_17"],
    [2148, "bivalence_point_2_17"],
  ] as const) {
    holding({
      address,
      datatype: DataType.INT16,
      name,
      unit: "°C",
      minVal: -20,
      maxVal: 20,
    });
  }

  // FC01/FC05 coil block from 3000 (ma_de_812049 Rev.1): Störungsmeldung
  // quittieren (3000) and Anforderung Vorrangladung (3003). c3000
  // deliberately reuses the shared family's error_acknowledge name —
  // the action (a write-only acknowledge pulse) is identical, and
  // consumers (the Home Assistant acknowledge button) resolve it by name
  // on both families. c3003 carries the _17 suffix instead, because the
  // shared family's identically named demand registers are writable GLT
  // demand *inputs* — different semantics must not share a name.
  //
  // The coils are momentary command bits, not status signals: the
  // controller executes a request the moment the bit is set and the bit
  // immediately falls back to 0 (idm-heatpump-hass issue #319, verified
  // on real 1.7 hardware). Anforderung Heizen/Kühlen (3001/3002) are
  // therefore not mapped at all — requesting heating or cooling is what
  // the operating-mode holding registers are for. c3003 is documented
  // read/write (Vorrangladung anfordern — the 1.x "DHW boost" bit,
  // written daily by a working FHEM configuration, idm-heatpump-hass
  // issue #319) and becomes a write-only command here: the integration's
  // button writes ON exactly once, and nothing may ever write 0 to a
  // running demand.
  for (const [address, name] of [
    [3000, "error_acknowledge"],
    [3003, "demand_dhw_17"],
  ] as const) {
    inputs.push({
      address,
      datatype: DataType.BOOL,
      registerType: RegisterType.COIL,
      binary: true,
      name,
      writable: true,
      writeOnly: true,
      source: NAVIGATOR_17_REGISTER_SOURCE,
      sourceVersion: NAVIGATOR_17_COIL_SOURCE_VERSION,
      supportedModels: [MODEL_NAVIGATOR_17],
    });
  }

  if (hasPv) {
    // Post-2016 PV supplement (see NAVIGATOR_17_PV_SOURCE_VERSION). The
    // data points and semantics match the shared family's PV block at
    // the same addresses; the writes are volatile GLT values like there.
    for (const [address, name] of [
      [74, "pv_surplus"],
      [76, "electric_heater_power"],
      [78, "pv_production"],
      [82, "house_consumption"],
    ] as const) {
      inputs.push({
        address,
        datatype: DataType.FLOAT,
        name,
        unit: "kW",
        writable: true,
        source: NAVIGATOR_17_REGISTER_SOURCE,
        sourceVersion: NAVIGATOR_17_PV_SOURCE_VERSION,
        supportedModels: [MODEL_NAVIGATOR_17],
      });
    }
    inputs.push({
      address: 4122,
      datatype: DataType.FLOAT,
      name: "power_consumption_hp",
      unit: "kW",
      stateClass: "measurement",
      source: NAVIGATOR_17_REGISTER_SOURCE,
      sourceVersion: NAVIGATOR_17_PV_SOURCE_VERSION,
      supportedModels: [MODEL_NAVIGATOR_17],
    });
  }

  return buildRegisterDefinitions(inputs);
}
