import { describe, expect, it } from "vitest";

import { groupRegisters } from "../../src/client/read-groups.js";
import { createRegisterDef, type RegisterDef } from "../../src/registers/definitions.js";
import { DataType, RegisterType } from "../../src/types.js";

function register(
  name: string,
  address: number,
  datatype = DataType.UCHAR,
  registerType = RegisterType.INPUT,
): RegisterDef {
  return createRegisterDef({ address, datatype, name, registerType });
}

function names(groups: readonly (readonly RegisterDef[])[]): readonly (readonly string[])[] {
  return groups.map((group) => group.map((definition) => definition.name));
}

describe("groupRegisters", () => {
  it("returns an immutable empty group list for empty input", () => {
    const groups = groupRegisters([], 40);

    expect(groups).toEqual([]);
    expect(Object.isFrozen(groups)).toBe(true);
  });

  it("stable-sorts by register type value and address", () => {
    const firstAtAddress = register("first_equal", 1_000);
    const secondAtAddress = register("second_equal", 1_000);
    const holding = register("holding_first", 2_000, DataType.UCHAR, RegisterType.HOLDING);

    expect(names(groupRegisters([secondAtAddress, firstAtAddress, holding], 40))).toEqual([
      ["holding_first"],
      ["second_equal"],
      ["first_equal"],
    ]);
  });

  it("groups only strict same-type adjacency", () => {
    const adjacent = [
      register("float", 1_000, DataType.FLOAT),
      register("uchar", 1_002),
      register("next", 1_003),
    ];

    expect(names(groupRegisters(adjacent, 40))).toEqual([["float", "uchar", "next"]]);
    expect(names(groupRegisters([register("left", 1_000), register("gap", 1_002)], 40))).toEqual([
      ["left"],
      ["gap"],
    ]);
    expect(
      names(
        groupRegisters(
          [
            register("input", 1_000),
            register("holding", 1_001, DataType.UCHAR, RegisterType.HOLDING),
          ],
          40,
        ),
      ),
    ).toEqual([["holding"], ["input"]]);
  });

  it("splits when the complete group span exceeds maxGroupSize", () => {
    expect(
      names(
        groupRegisters(
          [register("a", 1_000), register("b", 1_001), register("c", 1_002)],
          2,
        ),
      ),
    ).toEqual([["a", "b"], ["c"]]);
  });

  it("keeps humidity 1392/2 and mode 1393/1 in separate overlap groups", () => {
    expect(
      names(
        groupRegisters(
          [
            register("humidity_sensor", 1_392, DataType.FLOAT),
            register("hc_a_mode", 1_393),
          ],
          40,
        ),
      ),
    ).toEqual([["humidity_sensor"], ["hc_a_mode"]]);
  });

  it("keeps the official 1442 and 1484 overlaps in separate groups", () => {
    expect(
      names(
        groupRegisters(
          [
            register("hc_g_heating_curve", 1_441, DataType.FLOAT),
            register("hc_a_heating_limit", 1_442),
            register("hc_g_room_setpoint_cool_eco", 1_483, DataType.FLOAT),
            register("hc_a_cooling_limit", 1_484),
          ],
          40,
        ),
      ),
    ).toEqual([
      ["hc_g_heating_curve"],
      ["hc_a_heating_limit"],
      ["hc_g_room_setpoint_cool_eco"],
      ["hc_a_cooling_limit"],
    ]);
  });

  it("rejects a non-positive or non-integer maximum span", () => {
    expect(() => groupRegisters([register("a", 1_000)], 0)).toThrow(RangeError);
    expect(() => groupRegisters([register("a", 1_000)], 1.5)).toThrow(RangeError);
  });
});
