import {
  FEATURE_CASCADE,
  FEATURE_HEATING_CIRCUITS,
  FEATURE_ISC,
  FEATURE_PV,
  FEATURE_SOLAR,
  FEATURE_ZONE_MODULES,
  HEATING_CIRCUIT_LETTERS,
  MAX_HEATING_CIRCUITS,
  MAX_ZONE_MODULES,
  MODEL_NAVIGATOR_10,
  MODEL_NAVIGATOR_20,
  MODEL_NAVIGATOR_PRO,
  MODEL_UNKNOWN,
} from "../constants.js";
import { decodeValue, ModbusCodec } from "../codec.js";
import { createRegisterDef } from "../registers/definitions.js";
import { DataType, IdmModelInfo, type IdmModelInfo as IdmModelInfoValue } from "../types.js";

const HEATING_CIRCUIT_BASE = 1_350;
const HEATING_CIRCUIT_STEP = 2;
const HEATING_CIRCUIT_UNAVAILABLE = -1;
const HEATING_CIRCUIT_ACTIVE_MODE_BASE = 1_498;
const HEATING_CIRCUIT_ACTIVE_MODE_UNAVAILABLE = 0xff;
const ZONE_MODULE_BASE = 2_000;
const ZONE_MODULE_STEP = 65;
const EMPTY_SLOT_STOP_THRESHOLD = 2;

const FIRMWARE_PROBE = createRegisterDef({
  address: 4_120,
  datatype: DataType.FLOAT,
  name: "detect_firmware",
});

export interface DetectModelOptions {
  readonly readFirmware?: boolean;
}

export type DetectionProbe = (address: number, count: number) => Promise<readonly number[] | null>;

function exactWords(response: readonly number[] | null, count: number): readonly number[] | null {
  return response !== null && response.length === count ? response : null;
}

function probeFloat(
  response: readonly number[] | null,
  minimum?: number,
  maximum?: number,
): number | null {
  const values = exactWords(response, 2);
  if (values === null) {
    return null;
  }
  try {
    const value = ModbusCodec.decodeFloat32(values);
    if (!Number.isFinite(value)) {
      return null;
    }
    if (minimum !== undefined && value < minimum) {
      return null;
    }
    if (maximum !== undefined && value > maximum) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function firmwareVersion(response: readonly number[] | null): number | null {
  const values = exactWords(response, 2);
  if (values === null) {
    return null;
  }
  try {
    const value = decodeValue(values, FIRMWARE_PROBE);
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Convert one exact ordered IDM probe stream into immutable model information.
 *
 * The callback owns transport/retry policy. This service owns only the pinned
 * probe order, presence/sentinel rules, model priority, and feature projection.
 */
export async function detectModel(
  probe: DetectionProbe,
  options: DetectModelOptions = {},
): Promise<IdmModelInfoValue> {
  const activeHeatingCircuits: string[] = [];
  for (let index = 0; index < MAX_HEATING_CIRCUITS; index += 1) {
    const response = await probe(HEATING_CIRCUIT_BASE + index * HEATING_CIRCUIT_STEP, 2);
    const exact = exactWords(response, 2);
    const value = probeFloat(exact, -50, 80);
    const unavailable = value === HEATING_CIRCUIT_UNAVAILABLE;
    const mode = exactWords(await probe(HEATING_CIRCUIT_ACTIVE_MODE_BASE + index, 1), 1);
    const modeConfigured =
      mode !== null && ((mode[0] as number) & 0xff) !== HEATING_CIRCUIT_ACTIVE_MODE_UNAVAILABLE;
    if ((value !== null && !unavailable) || modeConfigured || (exact !== null && !unavailable)) {
      const circuit = HEATING_CIRCUIT_LETTERS[index];
      if (circuit !== undefined) {
        activeHeatingCircuits.push(circuit);
      }
    }
  }

  let zoneModules = 0;
  let missingZoneSlots = 0;
  for (let index = 0; index < MAX_ZONE_MODULES; index += 1) {
    const response = exactWords(await probe(ZONE_MODULE_BASE + index * ZONE_MODULE_STEP, 1), 1);
    if (response !== null) {
      zoneModules = index + 1;
      missingZoneSlots = 0;
    } else {
      missingZoneSlots += 1;
    }
    if (missingZoneSlots >= EMPTY_SLOT_STOP_THRESHOLD) {
      break;
    }
  }

  const hasSolar = exactWords(await probe(1_850, 2), 2) !== null;
  const hasIsc = exactWords(await probe(1_870, 2), 2) !== null;
  const hasPv = exactWords(await probe(74, 2), 2) !== null;

  const cascadeResponse = exactWords(await probe(1_147, 1), 1);
  const hasCascade = cascadeResponse !== null && ((cascadeResponse[0] as number) & 0xff) !== 0xff;

  const hasNavigator10 = exactWords(await probe(4_108, 2), 2) !== null;
  const modelName = hasNavigator10
    ? MODEL_NAVIGATOR_10
    : zoneModules > 0
      ? MODEL_NAVIGATOR_PRO
      : activeHeatingCircuits.length > 0
        ? MODEL_NAVIGATOR_20
        : MODEL_UNKNOWN;

  const features: string[] = [];
  if (activeHeatingCircuits.length > 0) features.push(FEATURE_HEATING_CIRCUITS);
  if (zoneModules > 0) features.push(FEATURE_ZONE_MODULES);
  if (hasSolar) features.push(FEATURE_SOLAR);
  if (hasIsc) features.push(FEATURE_ISC);
  if (hasPv) features.push(FEATURE_PV);
  if (hasCascade) features.push(FEATURE_CASCADE);

  const readFirmware = options.readFirmware ?? true;
  const detectedFirmware = readFirmware ? firmwareVersion(await probe(4_120, 2)) : null;

  return IdmModelInfo.create({
    modelName,
    activeHeatingCircuits,
    zoneModules,
    hasSolar,
    hasIsc,
    hasPv,
    hasCascade,
    features,
    firmwareVersion: detectedFirmware,
  });
}
