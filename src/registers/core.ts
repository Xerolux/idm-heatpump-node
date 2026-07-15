import { DataType } from "../types.js";
import type { RegisterDefInput } from "./definitions.js";
import { buildRegisterDefinitions, mergeRegisterMaps } from "./map-utils.js";

const CORE_INPUTS = [
  {
    address: 1000,
    datatype: DataType.FLOAT,
    name: "outdoor_temp",
    unit: "°C",
  },
  {
    address: 1005,
    datatype: DataType.UCHAR,
    name: "system_mode",
    writable: true,
    minVal: 0,
    maxVal: 5,
    enumOptions: {
      0: "Standby",
      1: "Automatic",
      2: "Absent",
      4: "Hot Water Only",
      5: "Heating/Cooling Only",
    },
    eepromSensitive: true,
  },
  {
    address: 1008,
    datatype: DataType.FLOAT,
    name: "storage_temp",
    unit: "°C",
  },
  {
    address: 1090,
    datatype: DataType.UCHAR,
    name: "hp_operating_mode",
    enumOptions: { 0: "Standby", 1: "Heating", 2: "Cooling", 4: "DHW", 8: "Defrost" },
  },
  {
    address: 1999,
    datatype: DataType.UCHAR,
    name: "error_acknowledge",
    writable: true,
    writeOnly: true,
  },
] satisfies readonly RegisterDefInput[];

const SYSTEM_INPUTS = [
  {
    address: 1000,
    datatype: DataType.FLOAT,
    name: "outdoor_temp",
    unit: "°C",
  },
  {
    address: 1002,
    datatype: DataType.FLOAT,
    name: "outdoor_temp_avg",
    unit: "°C",
  },
  {
    address: 1004,
    datatype: DataType.UINT16,
    name: "internal_message",
  },
  {
    address: 1005,
    datatype: DataType.UCHAR,
    name: "system_mode",
    writable: true,
    minVal: 0,
    maxVal: 5,
    enumOptions: {
      0: "Standby",
      1: "Automatic",
      2: "Absent",
      4: "Hot Water Only",
      5: "Heating/Cooling Only",
    },
    eepromSensitive: true,
  },
  {
    address: 90,
    datatype: DataType.UCHAR,
    name: "smart_grid_status",
    enumOptions: { 0: "Red", 1: "Yellow", 2: "Green", 4: "Supergreen" },
  },
  {
    address: 1006,
    datatype: DataType.UCHAR,
    name: "variable_input",
    enumOptions: {
      0: "Not configured",
      1: "External DHW Charging",
      2: "PV / Digital Input",
      3: "External Heat/Cool Switch",
    },
    sentinelValues: [255],
    lastVerified: "2026-07-10",
  },
  {
    address: 1008,
    datatype: DataType.FLOAT,
    name: "storage_temp",
    unit: "°C",
  },
  {
    address: 1010,
    datatype: DataType.FLOAT,
    name: "cold_storage_temp",
    unit: "°C",
  },
  {
    address: 1012,
    datatype: DataType.FLOAT,
    name: "dhw_temp_bottom",
    unit: "°C",
  },
  {
    address: 1014,
    datatype: DataType.FLOAT,
    name: "dhw_temp_top",
    unit: "°C",
  },
  {
    address: 1030,
    datatype: DataType.FLOAT,
    name: "dhw_tapping_temp",
    unit: "°C",
  },
  {
    address: 1032,
    datatype: DataType.UCHAR,
    name: "dhw_setpoint",
    unit: "°C",
    writable: true,
    minVal: 35,
    maxVal: 95,
    eepromSensitive: true,
  },
  {
    address: 1033,
    datatype: DataType.UCHAR,
    name: "dhw_charge_on_temp",
    unit: "°C",
    writable: true,
    minVal: 30,
    maxVal: 50,
    eepromSensitive: true,
  },
  {
    address: 1034,
    datatype: DataType.UCHAR,
    name: "dhw_charge_off_temp",
    unit: "°C",
    writable: true,
    minVal: 46,
    maxVal: 53,
    eepromSensitive: true,
  },
  {
    address: 1048,
    datatype: DataType.FLOAT,
    name: "current_electricity_price",
    unit: "€/MWh",
  },
  {
    address: 1050,
    datatype: DataType.FLOAT,
    name: "hp_flow_temp",
    unit: "°C",
  },
  {
    address: 1052,
    datatype: DataType.FLOAT,
    name: "hp_return_temp",
    unit: "°C",
  },
  {
    address: 1054,
    datatype: DataType.FLOAT,
    name: "hgl_flow_temp",
    unit: "°C",
  },
  {
    address: 1056,
    datatype: DataType.FLOAT,
    name: "heat_source_inlet_temp",
    unit: "°C",
  },
  {
    address: 1058,
    datatype: DataType.FLOAT,
    name: "heat_source_outlet_temp",
    unit: "°C",
  },
  {
    address: 1060,
    datatype: DataType.FLOAT,
    name: "air_intake_temp",
    unit: "°C",
  },
  {
    address: 1062,
    datatype: DataType.FLOAT,
    name: "air_heat_exchanger_temp",
    unit: "°C",
  },
  {
    address: 1064,
    datatype: DataType.FLOAT,
    name: "air_intake_temp_2",
    unit: "°C",
  },
  {
    address: 1066,
    datatype: DataType.FLOAT,
    name: "charging_sensor_temp",
    unit: "°C",
  },
] satisfies readonly RegisterDefInput[];

const HP_INPUTS = [
  {
    address: 1090,
    datatype: DataType.UCHAR,
    name: "hp_operating_mode",
    enumOptions: { 0: "Standby", 1: "Heating", 2: "Cooling", 4: "DHW", 8: "Defrost" },
  },
  {
    address: 1091,
    datatype: DataType.UCHAR,
    name: "heating_demand",
    binary: true,
  },
  {
    address: 1092,
    datatype: DataType.UCHAR,
    name: "cooling_demand",
    binary: true,
  },
  {
    address: 1093,
    datatype: DataType.UCHAR,
    name: "dhw_demand",
    binary: true,
  },
  {
    address: 1098,
    datatype: DataType.UCHAR,
    name: "evu_lock",
    enumOptions: { 0: "Locked", 1: "Not Locked" },
  },
  {
    address: 1099,
    datatype: DataType.UCHAR,
    name: "hp_sum_alarm",
    binary: true,
  },
  {
    address: 1100,
    datatype: DataType.UCHAR,
    name: "compressor_status_1",
    binary: true,
  },
  {
    address: 1101,
    datatype: DataType.UCHAR,
    name: "compressor_status_2",
    binary: true,
  },
  {
    address: 1102,
    datatype: DataType.UCHAR,
    name: "compressor_status_3",
    binary: true,
  },
  {
    address: 1103,
    datatype: DataType.UCHAR,
    name: "compressor_status_4",
    binary: true,
  },
  {
    address: 1104,
    datatype: DataType.INT16,
    name: "charging_pump_status",
    unit: "%",
    stateClass: "measurement",
  },
  {
    address: 1105,
    datatype: DataType.INT16,
    name: "brine_pump_status",
    unit: "%",
    stateClass: "measurement",
  },
  {
    address: 1106,
    datatype: DataType.INT16,
    name: "heat_source_pump_status",
    unit: "%",
    stateClass: "measurement",
  },
  {
    address: 1108,
    datatype: DataType.INT16,
    name: "isc_cold_storage_pump_status",
    unit: "%",
    stateClass: "measurement",
  },
  {
    address: 1109,
    datatype: DataType.INT16,
    name: "isc_recooling_pump_status",
    unit: "%",
    stateClass: "measurement",
  },
  {
    address: 1110,
    datatype: DataType.UINT16,
    name: "valve_hc_heat_cool",
  },
  {
    address: 1111,
    datatype: DataType.UINT16,
    name: "valve_storage_heat_cool",
  },
  {
    address: 1112,
    datatype: DataType.UINT16,
    name: "valve_heat_dhw",
  },
  {
    address: 1113,
    datatype: DataType.UINT16,
    name: "valve_heat_source_heat_cool",
  },
  {
    address: 1114,
    datatype: DataType.UINT16,
    name: "valve_solar_heat_dhw",
  },
  {
    address: 1115,
    datatype: DataType.UINT16,
    name: "valve_solar_storage_heat_source",
  },
  {
    address: 1116,
    datatype: DataType.UINT16,
    name: "valve_isc_heat_source_cold_storage",
  },
  {
    address: 1117,
    datatype: DataType.UINT16,
    name: "valve_isc_storage_bypass",
  },
  {
    address: 1118,
    datatype: DataType.UINT16,
    name: "circulation_pump",
  },
  {
    address: 1120,
    datatype: DataType.INT16,
    name: "bivalence_point_1_2nd_gen",
    unit: "°C",
    writable: true,
    minVal: -40,
    maxVal: 40,
    eepromSensitive: true,
  },
  {
    address: 1121,
    datatype: DataType.INT16,
    name: "bivalence_point_2_2nd_gen",
    unit: "°C",
    writable: true,
    minVal: -40,
    maxVal: 40,
    eepromSensitive: true,
  },
  {
    address: 1122,
    datatype: DataType.INT16,
    name: "bivalence_point_1_3rd_gen",
    unit: "°C",
    writable: true,
    minVal: -40,
    maxVal: 40,
    eepromSensitive: true,
  },
  {
    address: 1123,
    datatype: DataType.INT16,
    name: "bivalence_point_2_3rd_gen",
    unit: "°C",
    writable: true,
    minVal: -40,
    maxVal: 40,
    eepromSensitive: true,
  },
  {
    address: 1124,
    datatype: DataType.UCHAR,
    name: "bivalence_state",
    enumOptions: {
      0: "Off",
      1: "Bivalence 1 Active",
      2: "Bivalence 2 Active",
      3: "Bivalence 1+2 Active",
    },
  },
  {
    address: 1147,
    datatype: DataType.UCHAR,
    name: "cascade_available_heating",
    sentinelValues: [255],
    lastVerified: "2026-07-10",
  },
  {
    address: 1148,
    datatype: DataType.UCHAR,
    name: "cascade_available_cooling",
  },
  {
    address: 1149,
    datatype: DataType.UCHAR,
    name: "cascade_available_dhw",
  },
  {
    address: 1150,
    datatype: DataType.UCHAR,
    name: "cascade_running_heating",
  },
  {
    address: 1151,
    datatype: DataType.UCHAR,
    name: "cascade_running_cooling",
  },
  {
    address: 1152,
    datatype: DataType.UCHAR,
    name: "cascade_running_dhw",
  },
] satisfies readonly RegisterDefInput[];

const ENERGY_INPUTS = [
  {
    address: 1748,
    datatype: DataType.FLOAT,
    name: "energy_heating",
    unit: "kWh",
    stateClass: "total_increasing",
  },
  {
    address: 1750,
    datatype: DataType.FLOAT,
    name: "energy_total",
    unit: "kWh",
    stateClass: "total_increasing",
  },
  {
    address: 1752,
    datatype: DataType.FLOAT,
    name: "energy_cooling",
    unit: "kWh",
    stateClass: "total_increasing",
  },
  {
    address: 1754,
    datatype: DataType.FLOAT,
    name: "energy_dhw",
    unit: "kWh",
    stateClass: "total_increasing",
  },
  {
    address: 1756,
    datatype: DataType.FLOAT,
    name: "energy_defrost",
    unit: "kWh",
    stateClass: "total_increasing",
  },
  {
    address: 1758,
    datatype: DataType.FLOAT,
    name: "energy_passive_cooling",
    unit: "kWh",
    stateClass: "total_increasing",
  },
  {
    address: 1760,
    datatype: DataType.FLOAT,
    name: "energy_solar",
    unit: "kWh",
    stateClass: "total_increasing",
  },
  {
    address: 1762,
    datatype: DataType.FLOAT,
    name: "energy_electric_heater",
    unit: "kWh",
    stateClass: "total_increasing",
  },
  {
    address: 1790,
    datatype: DataType.FLOAT,
    name: "current_power",
    unit: "kW",
    stateClass: "measurement",
  },
  {
    address: 1792,
    datatype: DataType.FLOAT,
    name: "current_power_solar",
    unit: "kW",
    stateClass: "measurement",
  },
  {
    address: 4122,
    datatype: DataType.FLOAT,
    name: "power_consumption_hp",
    unit: "kW",
    stateClass: "measurement",
  },
  {
    address: 4120,
    datatype: DataType.FLOAT,
    name: "firmware_version",
    enabledByDefault: false,
  },
  {
    address: 4126,
    datatype: DataType.FLOAT,
    name: "thermal_power_flow_sensor",
    unit: "kW",
    stateClass: "measurement",
  },
  {
    address: 4128,
    datatype: DataType.FLOAT,
    name: "total_heat_energy",
    unit: "kWh",
    stateClass: "total_increasing",
  },
] satisfies readonly RegisterDefInput[];

export const CORE_REGISTERS = buildRegisterDefinitions(CORE_INPUTS);

export function getSystemRegisters() {
  return buildRegisterDefinitions(SYSTEM_INPUTS);
}
export function getHpStatusRegisters() {
  return buildRegisterDefinitions(HP_INPUTS);
}
export function getEnergyRegisters() {
  return buildRegisterDefinitions(ENERGY_INPUTS);
}
export function getCommonRegisters() {
  return mergeRegisterMaps(getSystemRegisters(), getHpStatusRegisters(), getEnergyRegisters());
}
