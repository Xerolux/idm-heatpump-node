import { MAX_ROOMS_PER_ZONE, ROOM_MODE_OPTIONS, ZONE_MODULE_MODE_OPTIONS } from "../constants.js";
import { SemanticValidationError } from "../errors.js";
import { DataType } from "../types.js";
import type { RegisterDef, RegisterDefInput } from "./definitions.js";
import { buildRegisterDefinitions } from "./map-utils.js";

export function getZoneModuleRegisters(
  zoneIndex: number,
  roomCount = 6,
): ReadonlyMap<string, RegisterDef> {
  if (!(zoneIndex >= 1 && zoneIndex <= 10)) {
    throw new SemanticValidationError(
      "zone_invalid",
      `Zone index must be 1-10, got ${String(zoneIndex)}`,
    );
  }
  if (!(roomCount >= 1 && roomCount <= MAX_ROOMS_PER_ZONE)) {
    throw new SemanticValidationError(
      "room_invalid",
      `Room count must be 1-${String(MAX_ROOMS_PER_ZONE)}, got ${String(roomCount)}`,
    );
  }

  const base = 2000 + (zoneIndex - 1) * 65;
  const inputs: RegisterDefInput[] = [
    {
      address: base,
      datatype: DataType.UCHAR,
      name: `zm${String(zoneIndex)}_mode_heat_cool`,
      enumOptions: ZONE_MODULE_MODE_OPTIONS,
    },
    {
      address: base + 1,
      datatype: DataType.UCHAR,
      name: `zm${String(zoneIndex)}_dehumidification`,
    },
  ];

  for (let room = 1; room <= roomCount; room += 1) {
    const roomBase = base + 2 + (room - 1) * 7;
    const prefix = `zm${String(zoneIndex)}_room${String(room)}`;
    inputs.push(
      {
        address: roomBase,
        datatype: DataType.FLOAT,
        name: `${prefix}_temp`,
        unit: "°C",
        writable: true,
        minVal: 15,
        maxVal: 30,
      },
      {
        address: roomBase + 2,
        datatype: DataType.FLOAT,
        name: `${prefix}_setpoint`,
        unit: "°C",
        writable: true,
      },
      {
        address: roomBase + 4,
        datatype: DataType.UCHAR,
        name: `${prefix}_humidity`,
        unit: "%",
        writable: true,
        minVal: 0,
        maxVal: 100,
      },
      {
        address: roomBase + 5,
        datatype: DataType.UCHAR,
        name: `${prefix}_mode`,
        writable: true,
        minVal: 0,
        maxVal: 4,
        enumOptions: ROOM_MODE_OPTIONS,
      },
      {
        address: roomBase + 6,
        datatype: DataType.UCHAR,
        name: `${prefix}_relay`,
      },
    );
  }

  return buildRegisterDefinitions(inputs);
}
