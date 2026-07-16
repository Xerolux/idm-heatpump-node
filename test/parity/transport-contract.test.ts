import { describe, expect, it } from "vitest";

import {
  createModbusReadRequest,
  type ModbusReadRequest,
  type ModbusTransport,
} from "../../src/transport/types.js";
import { RegisterType } from "../../src/types.js";
import { FakeClock } from "../support/fake-clock.js";
import { FakeModbusTransport } from "../support/fake-modbus-transport.js";

function inputRequest(
  address = 1_000,
  count = 2,
  timeoutMs: number | undefined = undefined,
): ModbusReadRequest {
  return createModbusReadRequest({
    unitId: 1,
    registerType: RegisterType.INPUT,
    functionCode: 4,
    address,
    count,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });
}

describe("adapter-neutral transport contract", () => {
  it("accepts only exact FC03 holding and FC04 input request identities", () => {
    expect(
      createModbusReadRequest({
        unitId: 247,
        registerType: RegisterType.HOLDING,
        functionCode: 3,
        address: 65_535,
        count: 1,
        timeoutMs: 2_000,
      }),
    ).toEqual({
      unitId: 247,
      registerType: "holding",
      functionCode: 3,
      address: 65_535,
      count: 1,
      timeoutMs: 2_000,
    });
    expect(inputRequest()).toEqual({
      unitId: 1,
      registerType: "input",
      functionCode: 4,
      address: 1_000,
      count: 2,
    });

    for (const invalid of [
      {
        unitId: 1,
        registerType: RegisterType.INPUT,
        functionCode: 3,
        address: 0,
        count: 1,
      },
      {
        unitId: 1,
        registerType: RegisterType.HOLDING,
        functionCode: 4,
        address: 0,
        count: 1,
      },
    ] as const) {
      expect(() => createModbusReadRequest(invalid)).toThrow(RangeError);
    }
  });

  it("rejects non-finite, fractional, and out-of-domain request values", () => {
    const base = {
      unitId: 1,
      registerType: RegisterType.INPUT,
      functionCode: 4 as const,
      address: 0,
      count: 1,
    };

    for (const patch of [
      { unitId: 0 },
      { unitId: 248 },
      { unitId: 1.5 },
      { address: -1 },
      { address: 65_536 },
      { address: Number.NaN },
      { count: 0 },
      { count: 126 },
      { count: 1.5 },
      { timeoutMs: 0 },
      { timeoutMs: -1 },
      { timeoutMs: 1.5 },
      { timeoutMs: Number.POSITIVE_INFINITY },
      { timeoutMs: 2_147_483_648 },
    ]) {
      expect(() => createModbusReadRequest({ ...base, ...patch })).toThrow(RangeError);
    }
  });

  it("implements the contract without exposing adapter response or client types", async () => {
    const transport: ModbusTransport = new FakeModbusTransport([{ kind: "words", words: [1, 2] }]);

    await transport.connect();
    await expect(transport.read(inputRequest())).resolves.toEqual([1, 2]);
    await transport.close();
    await transport.destroy();
  });
});

describe("fake Modbus transport", () => {
  it("records immutable lifecycle and read traces in exact order", async () => {
    const transport = new FakeModbusTransport([{ kind: "words", words: [10, 20] }]);
    const request = inputRequest(1_392, 2, 250);

    expect(transport.connected).toBe(false);
    await transport.connect();
    expect(transport.connected).toBe(true);
    await expect(transport.read(request)).resolves.toEqual([10, 20]);
    await transport.close();
    await transport.connect();
    await transport.destroy();
    expect(transport.connected).toBe(false);

    const events = transport.events;
    expect(events).toEqual([
      { kind: "connect" },
      { kind: "read", request },
      { kind: "close" },
      { kind: "connect" },
      { kind: "destroy" },
    ]);
    expect(Object.isFrozen(events)).toBe(true);
    expect(Object.isFrozen(events[1])).toBe(true);
    expect(Object.isFrozen(events[1]?.kind === "read" ? events[1].request : undefined)).toBe(true);
    expect(() => (events as unknown as unknown[]).push({ kind: "connect" })).toThrow(TypeError);
  });

  it("owns scripts and returned words while exposing unconsumed responses", async () => {
    const sourceWords = [7, 8];
    const scripts = [
      { kind: "words" as const, words: sourceWords },
      { kind: "words" as const, words: [9] },
    ];
    const transport = new FakeModbusTransport(scripts);
    sourceWords[0] = 65_535;
    scripts[0] = { kind: "words", words: [99, 99] };

    await transport.connect();
    const first = await transport.read(inputRequest());
    expect(first).toEqual([7, 8]);
    expect(transport.remainingResponses).toBe(1);
    expect(() => transport.assertResponsesConsumed()).toThrow(/unconsumed/u);

    const copied = [...first];
    copied[0] = 123;
    const trace = transport.events;
    expect(trace[1]).toEqual({ kind: "read", request: inputRequest() });
    expect(first).not.toBe(sourceWords);

    await expect(transport.read(inputRequest(1_001, 1))).resolves.toEqual([9]);
    expect(transport.remainingResponses).toBe(0);
    expect(() => transport.assertResponsesConsumed()).not.toThrow();
    await expect(transport.read(inputRequest(1_002, 1))).rejects.toThrow(/exhausted/u);
  });

  it("rejects invalid requests and words before consuming a scripted response", async () => {
    const transport = new FakeModbusTransport([{ kind: "words", words: [1] }]);
    await transport.connect();

    const invalidRequest = {
      ...inputRequest(1_000, 1),
      count: 0,
    } as ModbusReadRequest;
    await expect(transport.read(invalidRequest)).rejects.toThrow(RangeError);
    expect(transport.remainingResponses).toBe(1);
    expect(transport.events).toEqual([{ kind: "connect" }]);

    const invalidWords = new FakeModbusTransport([{ kind: "words", words: [Number.NaN] }]);
    await expect(invalidWords.connect()).rejects.toThrow(RangeError);
    expect(invalidWords.remainingResponses).toBe(1);
  });

  it("uses deterministic yields to expose transport concurrency without timers", async () => {
    const transport = new FakeModbusTransport(
      [
        { kind: "words", words: [1] },
        { kind: "words", words: [2] },
      ],
      { pauseReads: true },
    );
    await transport.connect();

    const first = transport.read(inputRequest(1_000, 1));
    const second = transport.read(inputRequest(1_001, 1));
    await transport.waitForPendingReads(2);

    expect(transport.activeRequests).toBe(2);
    expect(transport.maxActiveRequests).toBe(2);
    expect(transport.pendingReads).toBe(2);

    transport.releaseNextRead();
    await expect(first).resolves.toEqual([1]);
    expect(transport.activeRequests).toBe(1);
    transport.releaseNextRead();
    await expect(second).resolves.toEqual([2]);
    expect(transport.activeRequests).toBe(0);
    expect(transport.pendingReads).toBe(0);
  });
});

describe("fake monotonic clock", () => {
  it("advances deterministically and returns immutable delay snapshots", async () => {
    const clock = new FakeClock(10);
    expect(clock.now()).toBe(10);

    await clock.sleep(0.5);
    clock.advance(1.25);

    expect(clock.now()).toBe(11.75);
    expect(clock.delays).toEqual([0.5]);
    expect(Object.isFrozen(clock.delays)).toBe(true);
    expect(() => (clock.delays as unknown as number[]).push(1)).toThrow(TypeError);
  });

  it("rejects invalid clock starts, delays, and advances", async () => {
    for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY, -0]) {
      expect(() => new FakeClock(invalid)).toThrow(RangeError);
    }

    const clock = new FakeClock();
    for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY, -0]) {
      await expect(clock.sleep(invalid)).rejects.toThrow(RangeError);
      expect(() => clock.advance(invalid)).toThrow(RangeError);
    }
    expect(clock.now()).toBe(0);
    expect(clock.delays).toEqual([]);
  });
});
