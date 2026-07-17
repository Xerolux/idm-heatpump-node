import { describe, expect, it } from "vitest";

import {
  WriteSafetyState,
  createWritePlan,
  type InternalWriteSafetyStateSeed,
} from "../../src/client/write-safety.js";
import { createRegisterDef, type RegisterDef } from "../../src/registers/definitions.js";
import { DataType } from "../../src/types.js";
import { FakeClock } from "../support/fake-clock.js";

function eepromRegister(name = "synthetic_eeprom", address = 4_206): RegisterDef {
  return createRegisterDef({
    address,
    datatype: DataType.UCHAR,
    name,
    writable: true,
    eepromSensitive: true,
  });
}

function cyclicRegister(
  name = "synthetic_cyclic",
  address = 4_208,
  cyclicWriteTtl: number | null = null,
): RegisterDef {
  return createRegisterDef({
    address,
    datatype: DataType.FLOAT,
    name,
    writable: true,
    cyclicRequired: true,
    cyclicWriteTtl,
  });
}

function seedSnapshot(state: WriteSafetyState, now: number): InternalWriteSafetyStateSeed {
  const snapshot = state.snapshot(now);
  return {
    writeThrottle: snapshot.writeThrottle,
    cyclicWrites: snapshot.cyclicWrites,
  };
}

describe("write safety state", () => {
  it("blocks below 60 seconds, formats CPython half-even decimals, and allows exactly 60", () => {
    const register = eepromRegister();
    const state = new WriteSafetyState();
    state.recordSuccessfulWrite(register, 100);

    expect(() =>
      createWritePlan({ register, value: 1, writeSafetyState: state, now: 159.999 }),
    ).toThrowError(
      expect.objectContaining({
        code: "write_eeprom_throttled",
        diagnostic:
          "EEPROM-sensitive register 'synthetic_eeprom' was written too recently (try again in 0.0s)",
      }),
    );
    expect(() =>
      createWritePlan({ register, value: 1, writeSafetyState: state, now: 157.75 }),
    ).toThrowError(expect.objectContaining({ diagnostic: expect.stringContaining("2.2s") }));

    expect(
      createWritePlan({ register, value: 1, writeSafetyState: state, now: 160 }).encodedRegisters,
    ).toEqual([1]);
  });

  it("throttles EEPROM names independently and resets one or all", () => {
    const first = eepromRegister("first", 4_206);
    const second = eepromRegister("second", 4_207);
    const state = new WriteSafetyState();
    state.recordSuccessfulWrite(first, 10);
    state.recordSuccessfulWrite(second, 20);

    expect(() => state.assertEepromWriteAllowed(first, 69.999)).toThrow();
    expect(() => state.assertEepromWriteAllowed(second, 79.999)).toThrow();
    state.resetWriteThrottle(first);
    expect(() => state.assertEepromWriteAllowed(first, 20)).not.toThrow();
    expect(() => state.assertEepromWriteAllowed(second, 20)).toThrow();

    state.resetWriteThrottle();
    expect(state.snapshot(20).writeThrottle).toEqual({});
  });

  it("uses default/custom TTL, refreshes deadlines, and expires exactly at the deadline", () => {
    const clock = new FakeClock(10);
    const standard = cyclicRegister();
    const custom = cyclicRegister("synthetic_cyclic_ttl", 4_210, 30);
    const state = new WriteSafetyState();

    state.recordSuccessfulWrite(standard, clock.now());
    state.recordSuccessfulWrite(custom, clock.now());
    expect(state.getActiveCyclicWrites(clock.now())).toEqual({
      synthetic_cyclic: 310,
      synthetic_cyclic_ttl: 40,
    });

    clock.advance(10);
    state.recordSuccessfulWrite(custom, clock.now());
    expect(state.getActiveCyclicWrites(49.999)).toEqual({
      synthetic_cyclic: 310,
      synthetic_cyclic_ttl: 50,
    });
    expect([...state.getExpiredCyclicWrites(50)]).toEqual(["synthetic_cyclic_ttl"]);
    expect(state.getActiveCyclicWrites(50)).toEqual({ synthetic_cyclic: 310 });
  });

  it("resets cyclic state by register or globally", () => {
    const first = cyclicRegister("first", 4_208, 30);
    const second = cyclicRegister("second", 4_210, 40);
    const state = new WriteSafetyState();
    state.recordSuccessfulWrite(first, 0);
    state.recordSuccessfulWrite(second, 0);

    state.resetCyclicWriteState(first);
    expect(state.snapshot(0).cyclicWrites).toEqual({ second: 40 });
    state.resetCyclicWriteState();
    expect(state.snapshot(0).cyclicWrites).toEqual({});
  });

  it("returns frozen Unicode-ordered special-key-safe records and set views", () => {
    const state = new WriteSafetyState({
      cyclicWrites: {
        "😀": 1,
        ä: 1,
        z: 1,
        ["__proto__"]: 1,
      },
    });

    const active = state.getActiveCyclicWrites(0);
    const expired = state.getExpiredCyclicWrites(1);
    expect(Object.keys(active)).toEqual(["__proto__", "z", "ä", "😀"]);
    expect(Object.hasOwn(active, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(active)).toBe(Object.prototype);
    expect([...expired]).toEqual(["__proto__", "z", "ä", "😀"]);
    expect(Object.isFrozen(active)).toBe(true);
    expect(Object.isFrozen(expired)).toBe(true);
    expect(() => Object.assign(active, { later: 2 })).toThrow(TypeError);
    expect((expired as unknown as { add?: (name: string) => void }).add).toBeUndefined();
  });

  it("mutates only through the explicit success hook", () => {
    const eeprom = eepromRegister();
    const cyclic = cyclicRegister();
    const state = new WriteSafetyState({
      writeThrottle: { prior_eeprom: 5 },
      cyclicWrites: { prior_cyclic: 10 },
    });
    const before = seedSnapshot(state, 0);

    expect(() =>
      createWritePlan({ register: eeprom, value: 1.5, writeSafetyState: state, now: 6 }),
    ).toThrow();
    createWritePlan({ register: cyclic, value: 42.5, writeSafetyState: state, now: 6 });
    expect(seedSnapshot(state, 0)).toEqual(before);

    state.recordSuccessfulWrite(eeprom, 6);
    state.recordSuccessfulWrite(cyclic, 6);
    expect(state.snapshot(6)).toMatchObject({
      writeThrottle: { prior_eeprom: 5, synthetic_eeprom: 6 },
      cyclicWrites: { prior_cyclic: 10, synthetic_cyclic: 306 },
    });
  });

  it("owns and validates internal seed data", () => {
    const seed = {
      writeThrottle: { eeprom: 1 },
      cyclicWrites: { cyclic: 2 },
    };
    const state = new WriteSafetyState(seed);
    seed.writeThrottle.eeprom = 9;
    seed.cyclicWrites.cyclic = 9;

    expect(state.snapshot(0)).toMatchObject({
      writeThrottle: { eeprom: 1 },
      cyclicWrites: { cyclic: 2 },
    });
    expect(() => new WriteSafetyState({ writeThrottle: { invalid: Number.NaN } })).toThrow(
      RangeError,
    );
  });

  it("uses synchronous query/reset semantics without requiring transport state", () => {
    const state = new WriteSafetyState({
      writeThrottle: { eeprom: 1 },
      cyclicWrites: { active: 20, expired: 10 },
    });

    expect(state.getActiveCyclicWrites(10)).toEqual({ active: 20 });
    expect([...state.getExpiredCyclicWrites(10)]).toEqual(["expired"]);
    state.resetWriteThrottle();
    state.resetCyclicWriteState();
    expect(state.snapshot(10)).toMatchObject({ writeThrottle: {}, cyclicWrites: {} });
  });
});
