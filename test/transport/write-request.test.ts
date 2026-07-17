import { describe, expect, it } from "vitest";

import {
  createModbusWriteRequest,
  MODBUS_WRITE_LIMITS,
  type ModbusWriteRequest,
  type ModbusWriteRequestInput,
} from "../../src/transport/types.js";
import { RegisterType } from "../../src/types.js";
import {
  FakeModbusTransport,
  type FakeModbusWriteResponse,
} from "../support/fake-modbus-transport.js";

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

function writeRequest(address: number, word: number): ModbusWriteRequest {
  return createModbusWriteRequest(validInput({ address, count: 1, words: [word] }));
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

describe("fake FC16 transport", () => {
  it("records exact immutable successful and failed write events in order", async () => {
    const failure = new Error("synthetic write failure");
    const transport = new FakeModbusTransport([], {
      initiallyConnected: true,
      writeResponses: [{ kind: "write_ok" }, { kind: "error", error: failure }],
    });
    const first = writeRequest(1_200, 42);
    const second = writeRequest(1_201, 43);

    await expect(transport.write(first)).resolves.toBeUndefined();
    await expect(transport.write(second)).rejects.toBe(failure);

    expect(transport.events).toEqual([
      { kind: "write", request: first },
      { kind: "write", request: second },
    ]);
    for (const event of transport.events) {
      expect(Object.isFrozen(event)).toBe(true);
      if (event.kind === "write") {
        expect(Object.isFrozen(event.request)).toBe(true);
        expect(Object.isFrozen(event.request.words)).toBe(true);
      }
    }
    expect(transport.remainingWriteResponses).toBe(0);
    expect(() => transport.assertResponsesConsumed()).not.toThrow();
  });

  it("copies and closes the scripted write response before execution", async () => {
    const originalFailure = new Error("original");
    const replacementFailure = new Error("replacement");
    const response: { error: Error; kind: "error" } = {
      kind: "error",
      error: originalFailure,
    };
    const transport = new FakeModbusTransport([], {
      initiallyConnected: true,
      writeResponses: [response],
    });

    response.error = replacementFailure;

    await expect(transport.write(writeRequest(1_200, 42))).rejects.toBe(originalFailure);
    expect(() => transport.assertResponsesConsumed()).not.toThrow();
  });

  it("rejects disconnected, exhausted, and malformed requests without consuming a script", async () => {
    const scripted = Object.freeze([
      Object.freeze({ kind: "write_ok" }),
    ]) satisfies readonly FakeModbusWriteResponse[];
    const disconnected = new FakeModbusTransport([], { writeResponses: scripted });

    await expect(disconnected.write(writeRequest(1_200, 42))).rejects.toThrow(/disconnected/u);
    expect(disconnected.remainingWriteResponses).toBe(1);
    expect(disconnected.events).toEqual([]);

    const exhausted = new FakeModbusTransport([], { initiallyConnected: true });
    await expect(exhausted.write(writeRequest(1_200, 42))).rejects.toThrow(/exhausted/u);
    expect(exhausted.events).toEqual([]);

    const invalid = new FakeModbusTransport([], {
      initiallyConnected: true,
      writeResponses: scripted,
    });
    const malformed = {
      ...writeRequest(1_200, 42),
      functionCode: 6,
    } as unknown as ModbusWriteRequest;
    await expect(invalid.write(malformed)).rejects.toThrow(RangeError);
    expect(invalid.remainingWriteResponses).toBe(1);
    expect(invalid.events).toEqual([]);
  });

  it("pauses writes independently and exposes deterministic shared concurrency", async () => {
    const transport = new FakeModbusTransport([{ kind: "words", words: [7] }], {
      initiallyConnected: true,
      pauseReads: true,
      pauseWrites: true,
      writeResponses: [{ kind: "write_ok" }, { kind: "write_ok" }],
    });
    const read = transport.read({
      unitId: 1,
      registerType: RegisterType.INPUT,
      functionCode: 4,
      address: 1_000,
      count: 1,
    });
    const firstWrite = transport.write(writeRequest(1_200, 42));
    const secondWrite = transport.write(writeRequest(1_201, 43));

    await Promise.all([transport.waitForPendingReads(1), transport.waitForPendingWrites(2)]);
    expect(transport.pendingReads).toBe(1);
    expect(transport.pendingWrites).toBe(2);
    expect(transport.activeRequests).toBe(3);
    expect(transport.maxActiveRequests).toBe(3);

    transport.releaseNextWrite();
    await firstWrite;
    expect(transport.pendingWrites).toBe(1);
    expect(transport.pendingReads).toBe(1);

    transport.releaseAllWrites();
    await secondWrite;
    expect(transport.pendingWrites).toBe(0);
    expect(transport.pendingReads).toBe(1);

    transport.releaseNextRead();
    await expect(read).resolves.toEqual([7]);
    expect(transport.activeRequests).toBe(0);
    expect(transport.events.map((event) => event.kind)).toEqual(["read", "write", "write"]);
    expect(() => transport.assertResponsesConsumed()).not.toThrow();
  });

  it("requires both read and write scripts to be consumed exactly", async () => {
    const transport = new FakeModbusTransport([{ kind: "words", words: [1] }], {
      initiallyConnected: true,
      writeResponses: [{ kind: "write_ok" }],
    });

    expect(() => transport.assertResponsesConsumed()).toThrow(/2 unconsumed/u);
    await transport.write(writeRequest(1_200, 42));
    expect(() => transport.assertResponsesConsumed()).toThrow(/1 unconsumed/u);
    await transport.read({
      unitId: 1,
      registerType: RegisterType.INPUT,
      functionCode: 4,
      address: 1_000,
      count: 1,
    });
    expect(() => transport.assertResponsesConsumed()).not.toThrow();
  });
});
