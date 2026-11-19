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
  MODEL_NAVIGATOR_17,
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
// booster_fault (4001, UCHAR): "not configured" sentinel 255 (raw word 0xFFFF).
// A non-sentinel answer proves the booster block exists (Navigator 10); a
// sentinel answer is family-neutral because some Navigator 2.0 firmwares answer
// Navigator-10-only registers with a sentinel instead of rejecting them.
const BOOSTER_FAULT_UNAVAILABLE = 0xff;
const NAV10_POWER_LIMIT_PROBE = 4_108;
const NAV10_POWER_LIMIT_MIN = 0.1;
const NAV10_POWER_LIMIT_MAX = 200;
const NAV10_BOOSTER_FAULT_PROBE = 4_001;
const NAV10_STANDBY_POWER_PROBES = [4_122, 4_126] as const;
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
 * View over per-address Illegal-Data-Address rejections recorded by the
 * client's probe seam. Model detection reads it to tell "register not
 * implemented" apart from "no answer at all" (Navigator 1.x signature).
 */
export type ProbeRejectionView = (address: number) => boolean | null;

/**
 * Convert one exact ordered IDM probe stream into immutable model information.
 *
 * The callback owns transport/retry policy. This service owns only the pinned
 * probe order, presence/sentinel rules, model priority, and feature projection.
 *
 * Python 2.14.5 request shape: the first slot of each signal is probed
 * individually (it gates the family signature); when it answers, the
 * remaining slots are fetched with one adjacent batch per signal
 * (1350-1363 and 1498-1504), falling back to per-slot probes whenever a
 * batch fails or returns a wrong length.
 */
export async function detectModel(
  probe: DetectionProbe,
  options: DetectModelOptions = {},
  probeRejectedIllegalAddress: ProbeRejectionView = () => null,
): Promise<IdmModelInfoValue> {
  const flowSpan = MAX_HEATING_CIRCUITS * HEATING_CIRCUIT_STEP;
  const flowGate = await probe(HEATING_CIRCUIT_BASE, 2);
  const flowSlots: (readonly number[] | null)[] = [];
  if (flowGate !== null) {
    const flowBatch = await probe(HEATING_CIRCUIT_BASE, flowSpan);
    if (flowBatch !== null && flowBatch.length === flowSpan) {
      for (let index = 0; index < MAX_HEATING_CIRCUITS; index += 1) {
        flowSlots.push(
          flowBatch.slice(index * HEATING_CIRCUIT_STEP, (index + 1) * HEATING_CIRCUIT_STEP),
        );
      }
    } else {
      for (let index = 0; index < MAX_HEATING_CIRCUITS; index += 1) {
        flowSlots.push(await probe(HEATING_CIRCUIT_BASE + index * HEATING_CIRCUIT_STEP, 2));
      }
    }
  } else {
    for (let index = 0; index < MAX_HEATING_CIRCUITS; index += 1) {
      flowSlots.push(await probe(HEATING_CIRCUIT_BASE + index * HEATING_CIRCUIT_STEP, 2));
    }
  }

  const modeGate = await probe(HEATING_CIRCUIT_ACTIVE_MODE_BASE, 1);
  const modeSlots: (readonly number[] | null)[] = [];
  if (modeGate !== null) {
    const modeBatch = await probe(HEATING_CIRCUIT_ACTIVE_MODE_BASE, MAX_HEATING_CIRCUITS);
    if (modeBatch !== null && modeBatch.length === MAX_HEATING_CIRCUITS) {
      for (let index = 0; index < MAX_HEATING_CIRCUITS; index += 1) {
        modeSlots.push(modeBatch.slice(index, index + 1));
      }
    } else {
      for (let index = 0; index < MAX_HEATING_CIRCUITS; index += 1) {
        modeSlots.push(await probe(HEATING_CIRCUIT_ACTIVE_MODE_BASE + index, 1));
      }
    }
  } else {
    for (let index = 0; index < MAX_HEATING_CIRCUITS; index += 1) {
      modeSlots.push(await probe(HEATING_CIRCUIT_ACTIVE_MODE_BASE + index, 1));
    }
  }

  const activeHeatingCircuits: string[] = [];
  for (let index = 0; index < MAX_HEATING_CIRCUITS; index += 1) {
    const response = flowSlots[index] ?? null;
    const exact = exactWords(response, 2);
    const value = probeFloat(exact, -50, 80);
    const unavailable = value === HEATING_CIRCUIT_UNAVAILABLE;
    const mode = exactWords(modeSlots[index] ?? null, 1);
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

  // Navigator 10 differentiation. Address 1072 (heat_sink_flow_rate) is NOT a
  // reliable signal (also present on some Navigator 2.0 controllers such as the
  // IDM Terra SWM). Address 4108 (power_limit_hp) counts only when it answers
  // with a plausible, configured power-limit value: some Navigator 2.0
  // controllers answer Navigator-10-only addresses with a sentinel instead of
  // rejecting them. The booster_fault register 4001 is the fallback proof of
  // the Navigator-10-only block (a non-sentinel value), and the always-present
  // power-measurement pair 4122/4126 closes the standby gap where a Navigator
  // 10 without a booster and an inactive power limit was misclassified.
  let hasNavigator10 =
    probeFloat(
      await probe(NAV10_POWER_LIMIT_PROBE, 2),
      NAV10_POWER_LIMIT_MIN,
      NAV10_POWER_LIMIT_MAX,
    ) !== null;

  if (!hasNavigator10) {
    const boosterFault = exactWords(await probe(NAV10_BOOSTER_FAULT_PROBE, 1), 1);
    if (
      boosterFault !== null &&
      ((boosterFault[0] as number) & 0xff) !== BOOSTER_FAULT_UNAVAILABLE
    ) {
      hasNavigator10 = true;
    }
  }

  if (!hasNavigator10) {
    let nav10BlockPresent = true;
    for (const address of NAV10_STANDBY_POWER_PROBES) {
      if (exactWords(await probe(address, 2), 2) === null) {
        nav10BlockPresent = false;
        break;
      }
    }
    if (nav10BlockPresent) {
      hasNavigator10 = true;
    }
  }

  // Navigator 1.0/1.7 (separate protocol family) detection. The 1.x
  // firmware answers the low FC04 input block (from address 1000) while
  // rejecting the shared 2.0/10/Pro family's heating-circuit and
  // zone-module blocks with Modbus exception code 2. A device that
  // answers nothing (offline) or that responds on the heating-circuit
  // block must not classify as Navigator 1.7. Updated 1.x firmware can
  // answer the post-2016 PV supplement and the power registers, so those
  // addresses are deliberately not part of the signature.
  const NAV17_REJECTED_ADDRESSES: readonly number[] = [1_350, 1_498, 2_000];
  let isNavigator17 = false;
  if (probeRejectedIllegalAddress(1_350) === true) {
    // Every shared-family controller (2.0/10/Pro) implements the
    // heating-circuit block; an Illegal Data Address rejection at its
    // base means this is the separate 1.x protocol family. Confirm with
    // the full signature before committing, because the shared family's
    // active-mode probes (1498+) can overlap the 1.x status block
    // (1500+) and would otherwise fake heating circuits.
    const core = await probe(1_000, 2);
    isNavigator17 =
      exactWords(core, 2) !== null &&
      NAV17_REJECTED_ADDRESSES.every((address) => probeRejectedIllegalAddress(address) === true);
  }

  let modelName: string;
  let projectedCircuits = activeHeatingCircuits;
  let projectedZoneModules = zoneModules;
  let projectedHasSolar = hasSolar;
  let projectedHasIsc = hasIsc;
  let projectedHasCascade = hasCascade;
  let projectedFeatures: readonly string[] | null = null;
  if (isNavigator17) {
    modelName = MODEL_NAVIGATOR_17;
    // The 1.x family exposes none of the probed shared-family
    // capabilities; anything apparent came from overlapping probe
    // addresses and must not leak into the model info. The PV probe
    // (74) is the exception: a response there means the post-2016 PV
    // supplement is present and its registers join the 1.7 map.
    projectedCircuits = [];
    projectedZoneModules = 0;
    projectedHasSolar = false;
    projectedHasIsc = false;
    projectedHasCascade = false;
    projectedFeatures = hasPv ? [FEATURE_PV] : [];
  } else {
    modelName = hasNavigator10
      ? MODEL_NAVIGATOR_10
      : projectedZoneModules > 0
        ? MODEL_NAVIGATOR_PRO
        : projectedCircuits.length > 0
          ? MODEL_NAVIGATOR_20
          : MODEL_UNKNOWN;
  }

  const features: string[] = projectedFeatures === null ? [] : [...projectedFeatures];
  if (projectedFeatures === null) {
    if (projectedCircuits.length > 0) features.push(FEATURE_HEATING_CIRCUITS);
    if (projectedZoneModules > 0) features.push(FEATURE_ZONE_MODULES);
    if (projectedHasSolar) features.push(FEATURE_SOLAR);
    if (projectedHasIsc) features.push(FEATURE_ISC);
    if (hasPv) features.push(FEATURE_PV);
    if (projectedHasCascade) features.push(FEATURE_CASCADE);
  }

  const readFirmware = options.readFirmware ?? true;
  const detectedFirmware = readFirmware ? firmwareVersion(await probe(4_120, 2)) : null;

  return IdmModelInfo.create({
    modelName,
    activeHeatingCircuits: projectedCircuits,
    zoneModules: projectedZoneModules,
    hasSolar: projectedHasSolar,
    hasIsc: projectedHasIsc,
    hasPv,
    hasCascade: projectedHasCascade,
    features,
    firmwareVersion: detectedFirmware,
  });
}
