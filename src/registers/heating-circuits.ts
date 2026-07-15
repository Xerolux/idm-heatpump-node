import { ACTIVE_HC_MODE_OPTIONS, CIRCUIT_MODE_OPTIONS } from "../constants.js";
import { SemanticValidationError } from "../errors.js";
import { DataType } from "../types.js";
import type { RegisterDefInput } from "./definitions.js";
import { buildRegisterDefinitions } from "./map-utils.js";

export function getHeatingCircuitRegisters(
  circuitLetter: string,
): ReadonlyMap<string, import("./definitions.js").RegisterDef> {
  if (typeof circuitLetter !== "string") {
    throw new SemanticValidationError(
      "circuit_invalid",
      `Invalid circuit letter: ${String(circuitLetter)}`,
    );
  }
  if (circuitLetter.length !== 1) {
    throw new SemanticValidationError(
      "circuit_invalid",
      `ord() expected a character, but string of length ${String(circuitLetter.length)} found`,
    );
  }

  const upper = circuitLetter.toUpperCase();
  const index = upper.charCodeAt(0) - "A".charCodeAt(0);
  if (index < 0 || index > 6) {
    throw new SemanticValidationError(
      "circuit_invalid",
      `Invalid circuit letter: ${circuitLetter}`,
    );
  }

  const circuit = upper.toLowerCase();
  const name = (suffix: string): string => `hc_${circuit}_${suffix}`;
  const inputs: readonly RegisterDefInput[] = [
    {
      address: 1350 + index * 2,
      datatype: DataType.FLOAT,
      name: name("flow_temp"),
      unit: "°C",
    },
    {
      address: 1364 + index * 2,
      datatype: DataType.FLOAT,
      name: name("room_temp"),
      unit: "°C",
    },
    {
      address: 1378 + index * 2,
      datatype: DataType.FLOAT,
      name: name("setpoint_flow_temp"),
      unit: "°C",
    },
    {
      address: 1393 + index,
      datatype: DataType.UCHAR,
      name: name("mode"),
      writable: true,
      minVal: 0,
      maxVal: 5,
      enumOptions: CIRCUIT_MODE_OPTIONS,
      eepromSensitive: true,
      excludeFromWrite: new Set([255]),
    },
    {
      address: 1401 + index * 2,
      datatype: DataType.FLOAT,
      name: name("room_setpoint_heat_normal"),
      unit: "°C",
      writable: true,
      minVal: 15,
      maxVal: 30,
      eepromSensitive: true,
    },
    {
      address: 1415 + index * 2,
      datatype: DataType.FLOAT,
      name: name("room_setpoint_heat_eco"),
      unit: "°C",
      writable: true,
      minVal: 10,
      maxVal: 25,
      eepromSensitive: true,
    },
    {
      address: 1429 + index * 2,
      datatype: DataType.FLOAT,
      name: name("heating_curve"),
      writable: true,
      minVal: 0.1,
      maxVal: 3.5,
      eepromSensitive: true,
    },
    {
      address: 1442 + index,
      datatype: DataType.UCHAR,
      name: name("heating_limit"),
      unit: "°C",
      writable: true,
      minVal: 0,
      maxVal: 50,
      eepromSensitive: true,
    },
    {
      address: 1449 + index,
      datatype: DataType.UCHAR,
      name: name("setpoint_flow_constant"),
      unit: "°C",
      writable: true,
      minVal: 20,
      maxVal: 90,
      eepromSensitive: true,
    },
    {
      address: 1457 + index * 2,
      datatype: DataType.FLOAT,
      name: name("room_setpoint_cool_normal"),
      unit: "°C",
      writable: true,
      minVal: 15,
      maxVal: 30,
      eepromSensitive: true,
    },
    {
      address: 1471 + index * 2,
      datatype: DataType.FLOAT,
      name: name("room_setpoint_cool_eco"),
      unit: "°C",
      writable: true,
      minVal: 15,
      maxVal: 30,
      eepromSensitive: true,
    },
    {
      address: 1484 + index,
      datatype: DataType.UCHAR,
      name: name("cooling_limit"),
      unit: "°C",
      writable: true,
      minVal: 0,
      maxVal: 36,
      eepromSensitive: true,
    },
    {
      address: 1491 + index,
      datatype: DataType.UCHAR,
      name: name("setpoint_flow_cooling"),
      unit: "°C",
      writable: true,
      minVal: 8,
      maxVal: 30,
      eepromSensitive: true,
    },
    {
      address: 1498 + index,
      datatype: DataType.UCHAR,
      name: name("active_mode"),
      enumOptions: ACTIVE_HC_MODE_OPTIONS,
    },
    {
      address: 1505 + index,
      datatype: DataType.UCHAR,
      name: name("parallel_shift"),
      unit: "°C",
      writable: true,
      minVal: 0,
      maxVal: 30,
      eepromSensitive: true,
    },
    {
      address: 1650 + index * 2,
      datatype: DataType.FLOAT,
      name: name("ext_room_temp"),
      unit: "°C",
      writable: true,
      minVal: 15,
      maxVal: 30,
      sentinelValues: [-1],
      lastVerified: "2026-07-10",
    },
  ];

  return buildRegisterDefinitions(inputs);
}
