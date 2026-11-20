import { describe, expect, it } from "vitest";

import {
  BINARY_REGISTER_METADATA,
  BinaryRegisterMetadata,
  getBinaryRegisterMetadata,
} from "../../src/index.js";

describe("binary register metadata", () => {
  it("exposes the neutral device-class catalog", () => {
    expect(Object.keys(BINARY_REGISTER_METADATA).sort()).toEqual([
      "compressor_status_1",
      "compressor_status_2",
      "compressor_status_3",
      "compressor_status_4",
      "cooling_demand",
      "dhw_demand",
      "heating_demand",
      "hp_sum_alarm",
    ]);
  });

  it("resolves dynamic zone-room relay names", () => {
    const metadata = getBinaryRegisterMetadata("zm2_room3_relay");
    expect(metadata?.deviceClass).toBe("running");
    expect(getBinaryRegisterMetadata("zm9_room8_relay")).not.toBeNull();
  });

  it("returns null for unknown names", () => {
    expect(getBinaryRegisterMetadata("outdoor_temp")).toBeNull();
  });

  it("rejects overlapping on/off values and non-positive bitmasks", () => {
    expect(() => BinaryRegisterMetadata.create({ onValues: [1, 0], offValues: [0] })).toThrowError(
      /must not overlap/u,
    );
    expect(() => BinaryRegisterMetadata.create({ bitmask: 0 })).toThrowError(/must be positive/u);
  });
});
