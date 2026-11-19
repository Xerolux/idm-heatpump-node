/**
 * Neutral semantic metadata for IDM binary registers.
 *
 * This module deliberately stays independent of Home Assistant. Consumers map
 * `deviceClass` strings to their own entity model while using the explicit
 * on/off values, bit masks and polarity to decode controller states safely.
 */

export type BinaryValue = boolean | number | string;

export type BinaryDeviceClass =
  "problem" | "connectivity" | "lock" | "cold" | "heat" | "running" | "power";

export interface BinaryRegisterMetadataInput {
  readonly onValues?: readonly BinaryValue[];
  readonly offValues?: readonly BinaryValue[];
  readonly bitmask?: number | null;
  readonly inverted?: boolean;
  readonly deviceClass?: BinaryDeviceClass | null;
}

export interface BinaryRegisterMetadata {
  /** Values a decoded register may carry to count as "on". */
  readonly onValues: readonly BinaryValue[];
  /** Values a decoded register may carry to count as "off". */
  readonly offValues: readonly BinaryValue[];
  /** Optional positive bit mask applied before on/off comparison. */
  readonly bitmask: number | null;
  /** Whether the raw on/off verdict must be inverted. */
  readonly inverted: boolean;
  /** Neutral semantic device class, or null when unclassified. */
  readonly deviceClass: BinaryDeviceClass | null;
}

const DEFAULT_ON_VALUES: readonly BinaryValue[] = Object.freeze([1]);
const DEFAULT_OFF_VALUES: readonly BinaryValue[] = Object.freeze([0]);

function frozenValues(values: readonly BinaryValue[]): readonly BinaryValue[] {
  return Object.freeze([...values]);
}

/**
 * Public runtime counterpart of Python's ``BinaryRegisterMetadata`` dataclass.
 *
 * Rejects overlapping on/off values and non-positive bitmasks so consumers can
 * never build an ambiguous decoder from catalog metadata.
 */
export const BinaryRegisterMetadata = Object.freeze({
  create(input: BinaryRegisterMetadataInput = {}): BinaryRegisterMetadata {
    const onValues = frozenValues(input.onValues ?? DEFAULT_ON_VALUES);
    const offValues = frozenValues(input.offValues ?? DEFAULT_OFF_VALUES);
    const bitmask = input.bitmask ?? null;
    const inverted = input.inverted ?? false;
    const deviceClass = input.deviceClass ?? null;

    const overlaps = onValues.some((value) => offValues.some((other) => Object.is(value, other)));
    if (overlaps) {
      throw new RangeError("Binary on_values and off_values must not overlap");
    }
    if (bitmask !== null && (!Number.isInteger(bitmask) || bitmask <= 0)) {
      throw new RangeError("Binary bitmask must be positive");
    }

    return Object.freeze({
      onValues,
      offValues,
      bitmask,
      inverted,
      deviceClass,
    });
  },
});

function metadataFor(deviceClass: BinaryDeviceClass): BinaryRegisterMetadata {
  return BinaryRegisterMetadata.create({ deviceClass });
}

/** Explicit metadata for the fixed catalog of well-known binary registers. */
export const BINARY_REGISTER_METADATA: Readonly<Record<string, BinaryRegisterMetadata>> =
  Object.freeze({
    heating_demand: metadataFor("heat"),
    cooling_demand: metadataFor("cold"),
    dhw_demand: metadataFor("heat"),
    hp_sum_alarm: metadataFor("problem"),
    compressor_status_1: metadataFor("running"),
    compressor_status_2: metadataFor("running"),
    // 1100-1103 are documented identically and all four are binary=True;
    // only 1 and 2 were listed originally, so getBinaryRegisterMetadata()
    // returned null for 3 and 4 and consumers fell back to name
    // heuristics. All four map to "running" (Python 2.0.1).
    compressor_status_3: metadataFor("running"),
    compressor_status_4: metadataFor("running"),
  });

const ZONE_ROOM_RELAY_PATTERN = /^zm\d+_room\d+_relay$/u;
const ZONE_ROOM_RELAY_METADATA = metadataFor("running");

/** Return explicit metadata for a known binary register name, or null. */
export function getBinaryRegisterMetadata(name: string): BinaryRegisterMetadata | null {
  const metadata = BINARY_REGISTER_METADATA[name];
  if (metadata !== undefined) {
    return metadata;
  }
  if (ZONE_ROOM_RELAY_PATTERN.test(name)) {
    return ZONE_ROOM_RELAY_METADATA;
  }
  return null;
}
