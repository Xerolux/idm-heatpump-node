import { describe, expect, it } from "vitest";

import {
  createModbusWriteRequest,
  MODBUS_WRITE_LIMITS,
  type ModbusWriteRequestInput,
} from "../../src/transport/types.js";
import { RegisterType } from "../../src/types.js";

function validInput(patch: Partial<ModbusWriteRequestInput> = {}): ModbusWriteRequestInput {
  return {
    unitId: 1,
    registerType: RegisterType.HOLDING,
    functionCode: 16,
    address: 1_696,
    count: 2,
    words: [0, 16_938],
    ...patch,
  };
}

describe("createModbusWriteRequest", () => {
  it("creates exact FC16 requests for one- and two-word writes", () => {
    expect(createModbusWriteRequest(validInput({ address: 1_200, count: 1, words: [42] }))).toEqual(
      {
        unitId: 1,
        registerType: RegisterType.HOLDING,
        functionCode: 16,
        address: 1_200,
        count: 1,
        words: [42],
      },
    );

    expect(createModbusWriteRequest(validInput())).toEqual({
      unitId: 1,
      registerType: RegisterType.HOLDING,
      functionCode: 16,
      address: 1_696,
      count: 2,
      words: [0, 16_938],
    });
  });

  it("owns and deeply freezes the low-word-first payload", () => {
    const sourceWords = [0, 16_938];
    const request = createModbusWriteRequest(validInput({ words: sourceWords }));

    sourceWords[0] = 65_535;
    expect(request.words).toEqual([0, 16_938]);
    expect(Object.isFrozen(request)).toBe(true);
    expect(Object.isFrozen(request.words)).toBe(true);
    expect(() => {
      (request.words as number[])[0] = 1;
    }).toThrow(TypeError);
    expect(() => {
      (request as { address: number }).address = 1;
    }).toThrow(TypeError);
  });

  it("accepts every inclusive protocol boundary", () => {
    const maximumWords = Array.from(
      { length: MODBUS_WRITE_LIMITS.maximumCount },
      (_, index) => index,
    );

    expect(
      createModbusWriteRequest(
        validInput({
          unitId: MODBUS_WRITE_LIMITS.minimumUnitId,
          address: MODBUS_WRITE_LIMITS.minimumAddress,
          count: 1,
          words: [0],
        }),
      ),
    ).toMatchObject({ unitId: 1, address: 0, count: 1, words: [0] });
    expect(
      createModbusWriteRequest(
        validInput({
          unitId: MODBUS_WRITE_LIMITS.maximumUnitId,
          address: MODBUS_WRITE_LIMITS.maximumAddress - MODBUS_WRITE_LIMITS.maximumCount + 1,
          count: MODBUS_WRITE_LIMITS.maximumCount,
          words: maximumWords,
        }),
      ),
    ).toMatchObject({ unitId: 247, count: 123, words: maximumWords });
    expect(
      createModbusWriteRequest(
        validInput({
          address: MODBUS_WRITE_LIMITS.maximumAddress,
          count: 1,
          words: [65_535],
        }),
      ),
    ).toMatchObject({ address: 65_535, count: 1, words: [65_535] });
  });

  it.each([
    ["unit zero", { unitId: 0 }],
    ["unit above maximum", { unitId: 248 }],
    ["fractional unit", { unitId: 1.5 }],
    ["non-finite unit", { unitId: Number.POSITIVE_INFINITY }],
    ["negative address", { address: -1 }],
    ["address above maximum", { address: 65_536 }],
    ["fractional address", { address: 1.5 }],
    ["count zero", { count: 0, words: [] }],
    ["count above FC16 maximum", { count: 124, words: Array(124).fill(0) }],
    ["fractional count", { count: 1.5 }],
    ["mismatched payload length", { count: 1 }],
    ["overflowing address span", { address: 65_535 }],
    ["negative word", { words: [-1, 0] }],
    ["word above maximum", { words: [0, 65_536] }],
    ["fractional word", { words: [0, 1.5] }],
    ["non-finite word", { words: [0, Number.NaN] }],
  ] satisfies readonly [string, Partial<ModbusWriteRequestInput>][])(
    "rejects %s before transport execution",
    (_label, patch) => {
      expect(() => createModbusWriteRequest(validInput(patch))).toThrow();
    },
  );

  it.each([
    ["input register", { registerType: RegisterType.INPUT }],
    ["FC03", { functionCode: 3 }],
    ["FC04", { functionCode: 4 }],
    ["FC06", { functionCode: 6 }],
  ] as const)("rejects %s instead of weakening FC16 holding identity", (_label, patch) => {
    expect(() =>
      createModbusWriteRequest(validInput(patch as unknown as Partial<ModbusWriteRequestInput>)),
    ).toThrow(RangeError);
  });

  it("rejects a non-array payload", () => {
    expect(() =>
      createModbusWriteRequest(
        validInput({ words: "not-an-array" as unknown as readonly number[] }),
      ),
    ).toThrow(TypeError);
  });
});
