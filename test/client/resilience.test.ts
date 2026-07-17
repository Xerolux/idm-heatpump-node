import { describe, expect, it } from "vitest";

import type { IdmModbusClient } from "../../src/client/index.js";
import {
  createInternalIdmModbusClient,
  getInternalWriteStateSnapshot,
  seedInternalReadState,
  seedInternalWriteState,
  writeInternalRegister,
  type InternalClientDependencies,
} from "../../src/client/internal-create.js";
import {
  createNormalizedTransportFailure,
  IllegalAddressError,
  NormalizedTransportFailure,
  NormalizedTransportFailureKind,
  type RetryableTransportFailureKind,
} from "../../src/transport/errors.js";
import { createRegisterDef } from "../../src/registers/definitions.js";
import type {
  ModbusReadRequest,
  ModbusTransport,
  ModbusWriteRequest,
} from "../../src/transport/types.js";
import { DataType, RegisterType } from "../../src/types.js";
import { FakeClock } from "../support/fake-clock.js";
import { FakeModbusTransport } from "../support/fake-modbus-transport.js";

type ScriptedRead =
  | Readonly<{ readonly kind: "error"; readonly error: unknown }>
  | Readonly<{ readonly kind: "words"; readonly words: readonly number[] }>;

class LooseScriptedTransport implements ModbusTransport {
  readonly #responses: ScriptedRead[];
  readonly #connectError: unknown;
  readonly requests: ModbusReadRequest[] = [];
  connectCalls = 0;
  closeCalls = 0;
  #connected = false;

  public constructor(responses: readonly ScriptedRead[], connectError?: unknown) {
    this.#responses = [...responses];
    this.#connectError = connectError;
  }

  public get connected(): boolean {
    return this.#connected;
  }

  public async connect(): Promise<void> {
    this.connectCalls += 1;
    if (this.#connectError !== undefined) {
      throw this.#connectError;
    }
    this.#connected = true;
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
    this.#connected = false;
  }

  public async destroy(): Promise<void> {
    this.#connected = false;
  }

  public async read(request: ModbusReadRequest): Promise<readonly number[]> {
    if (!this.#connected) {
      throw new Error("Loose scripted transport is disconnected");
    }
    this.requests.push(request);
    const response = this.#responses.shift();
    if (response === undefined) {
      throw new Error("Loose scripted response script is exhausted");
    }
    if (response.kind === "error") {
      throw response.error;
    }
    return response.words;
  }

  public async write(request: ModbusWriteRequest): Promise<void> {
    void request;
    throw new Error("LooseScriptedTransport does not provide writes");
  }
}

function failure(
  kind: RetryableTransportFailureKind,
  message = `${kind} at example.invalid:502`,
): NormalizedTransportFailure {
  return createNormalizedTransportFailure(kind, message);
}

function createSequenceClient(
  transports: readonly ModbusTransport[],
  clock: FakeClock,
  options: ConstructorParameters<typeof IdmModbusClient>[1] = {},
  dependencyOverrides: Partial<InternalClientDependencies> = {},
): Readonly<{
  client: IdmModbusClient;
  factoryCalls: () => number;
}> {
  const remaining = [...transports];
  let calls = 0;
  const client = createInternalIdmModbusClient("example.invalid", options, {
    transportFactory: () => {
      calls += 1;
      const transport = remaining.shift();
      if (transport === undefined) {
        throw new Error("Synthetic transport factory exhausted");
      }
      return transport;
    },
    now: dependencyOverrides.now ?? (() => clock.now()),
    sleep: dependencyOverrides.sleep ?? ((seconds) => clock.sleep(seconds)),
  });
  return Object.freeze({ client, factoryCalls: () => calls });
}

function fakeReadRequests(transport: FakeModbusTransport): readonly ModbusReadRequest[] {
  return transport.events.flatMap((event) => (event.kind === "read" ? [event.request] : []));
}

function fakeEventKinds(transport: FakeModbusTransport): readonly string[] {
  return transport.events.map((event) => event.kind);
}

const reconnectKinds = [
  NormalizedTransportFailureKind.TIMEOUT,
  NormalizedTransportFailureKind.DISCONNECTED,
  NormalizedTransportFailureKind.SOCKET,
  NormalizedTransportFailureKind.NO_RESPONSE,
] as const;

describe("IdmModbusClient retry and reconnect behavior", () => {
  for (const kind of reconnectKinds) {
    it(`hard reconnects ${kind} failures with exact attempts and delays`, async () => {
      const clock = new FakeClock();
      const first = new FakeModbusTransport([{ kind: "error", error: failure(kind) }]);
      const second = new FakeModbusTransport([{ kind: "error", error: failure(kind) }]);
      const third = new FakeModbusTransport([{ kind: "words", words: [7] }]);
      const { client, factoryCalls } = createSequenceClient([first, second, third], clock, {
        maxRetries: 3,
      });

      await expect(client.probeRegister(1_000)).resolves.toEqual([7]);

      expect(factoryCalls()).toBe(3);
      expect(clock.delays).toEqual([0.5, 1]);
      expect(fakeEventKinds(first)).toEqual(["connect", "read", "close"]);
      expect(fakeEventKinds(second)).toEqual(["connect", "read", "close"]);
      expect(fakeEventKinds(third)).toEqual(["connect", "read"]);
      expect(client.getDiagnostics().connectionSuspect).toBe(false);
      expect(client.getLastErrorContext()).toEqual({
        operation: "read",
        address: 1_000,
        count: 1,
        registerType: "input",
        errorType: kind,
        message: `${kind} at <endpoint>`,
        attempt: 2,
      });
    });
  }

  it("retries generic Modbus failures on the same connection", async () => {
    const clock = new FakeClock();
    const transport = new FakeModbusTransport([
      { kind: "error", error: failure(NormalizedTransportFailureKind.MODBUS) },
      { kind: "error", error: failure(NormalizedTransportFailureKind.MODBUS) },
      { kind: "words", words: [9] },
    ]);
    const { client, factoryCalls } = createSequenceClient([transport], clock, {
      maxRetries: 3,
    });

    await expect(client.probeRegister(1_001)).resolves.toEqual([9]);

    expect(factoryCalls()).toBe(1);
    expect(clock.delays).toEqual([0.5, 1]);
    expect(fakeEventKinds(transport)).toEqual(["connect", "read", "read", "read"]);
    expect(client.getDiagnostics().connectionSuspect).toBe(false);
    expect(client.getLastErrorContext()?.attempt).toBe(2);
  });

  it("normalizes malformed responses and retries them on the same connection", async () => {
    const clock = new FakeClock();
    const transport = new LooseScriptedTransport([
      { kind: "words", words: [1] },
      { kind: "words", words: [1, 70_000] },
      { kind: "words", words: [1, 2] },
    ]);
    const { client, factoryCalls } = createSequenceClient([transport], clock, {
      maxRetries: 3,
    });

    await expect(client.probeRegister(1_002, 2)).resolves.toEqual([1, 2]);

    expect(factoryCalls()).toBe(1);
    expect(transport.connectCalls).toBe(1);
    expect(transport.closeCalls).toBe(0);
    expect(transport.requests).toHaveLength(3);
    expect(clock.delays).toEqual([0.5, 1]);
    expect(client.getLastErrorContext()).toMatchObject({
      errorType: NormalizedTransportFailureKind.INVALID_RESPONSE,
      attempt: 2,
    });
  });

  it("keeps suspect true after exhausted transport failures", async () => {
    const clock = new FakeClock();
    const transports = Array.from(
      { length: 3 },
      () =>
        new FakeModbusTransport([
          {
            kind: "error",
            error: failure(NormalizedTransportFailureKind.TIMEOUT),
          },
        ]),
    );
    const { client, factoryCalls } = createSequenceClient(transports, clock, {
      maxRetries: 3,
    });

    await expect(client.probeRegister(1_003)).resolves.toBeNull();

    expect(factoryCalls()).toBe(3);
    expect(clock.delays).toEqual([0.5, 1]);
    expect(client.getDiagnostics().connectionSuspect).toBe(true);
    expect(client.getLastErrorContext()).toMatchObject({
      errorType: NormalizedTransportFailureKind.TIMEOUT,
      attempt: 3,
    });
  });

  it("keeps suspect through a failed reconnect and retries from a fresh factory", async () => {
    const clock = new FakeClock();
    const first = new FakeModbusTransport([
      { kind: "error", error: failure(NormalizedTransportFailureKind.TIMEOUT) },
    ]);
    const failedReconnect = new LooseScriptedTransport(
      [],
      failure(NormalizedTransportFailureKind.DISCONNECTED, "connect example.invalid:502 failed"),
    );
    const working = new FakeModbusTransport([{ kind: "words", words: [11] }]);
    const { client, factoryCalls } = createSequenceClient(
      [first, failedReconnect, working],
      clock,
      { maxRetries: 3 },
    );

    await expect(client.probeRegister(1_004)).resolves.toEqual([11]);

    expect(factoryCalls()).toBe(3);
    expect(failedReconnect.connectCalls).toBe(1);
    expect(fakeReadRequests(first)).toHaveLength(1);
    expect(fakeReadRequests(working)).toHaveLength(1);
    expect(clock.delays).toEqual([0.5, 1]);
    expect(client.getDiagnostics().connectionSuspect).toBe(false);
    expect(client.getLastErrorContext()).toMatchObject({
      errorType: NormalizedTransportFailureKind.DISCONNECTED,
      attempt: 2,
    });
  });

  it("never retries, reconnects, or delays Illegal Data Address", async () => {
    const clock = new FakeClock();
    const transport = new FakeModbusTransport([
      {
        kind: "error",
        error: new IllegalAddressError("Illegal address at example.invalid:502"),
      },
    ]);
    const { client, factoryCalls } = createSequenceClient([transport], clock, {
      maxRetries: 3,
    });

    await expect(client.probeRegister(1_005)).resolves.toBeNull();

    expect(factoryCalls()).toBe(1);
    expect(fakeEventKinds(transport)).toEqual(["connect", "read"]);
    expect(clock.delays).toEqual([]);
    expect(client.getDiagnostics().connectionSuspect).toBe(false);
    expect(client.getLastErrorContext()).toEqual({
      operation: "read",
      address: 1_005,
      count: 1,
      registerType: "input",
      errorType: NormalizedTransportFailureKind.ILLEGAL_ADDRESS,
      message: "Illegal address at <endpoint>",
      attempt: 1,
    });
  });
});

describe("IdmModbusClient write retry and rollback behavior", () => {
  it("retries invalid write acknowledgements on the same connection", async () => {
    const clock = new FakeClock();
    const invalid = failure(
      NormalizedTransportFailureKind.INVALID_RESPONSE,
      "invalid write acknowledgement at example.invalid:502",
    );
    const transport = new FakeModbusTransport([], {
      writeResponses: [
        { kind: "error", error: invalid },
        { kind: "error", error: invalid },
        { kind: "write_ok" },
      ],
    });
    const { client, factoryCalls } = createSequenceClient([transport], clock, {
      maxRetries: 3,
    });
    const register = createRegisterDef({
      address: 4_500,
      datatype: DataType.FLOAT,
      name: "write_retry_float",
      writable: true,
      cyclicRequired: true,
      cyclicWriteTtl: 30,
    });

    await expect(writeInternalRegister(client, register, 42.5)).resolves.toBeUndefined();

    expect(factoryCalls()).toBe(1);
    expect(fakeEventKinds(transport)).toEqual(["connect", "write", "write", "write"]);
    expect(clock.delays).toEqual([0.5, 1]);
    expect(getInternalWriteStateSnapshot(client).cyclicWrites).toEqual({
      write_retry_float: 31.5,
    });
    expect(client.getLastErrorContext()).toEqual({
      operation: "write",
      address: 4_500,
      count: 2,
      registerType: "holding",
      errorType: NormalizedTransportFailureKind.INVALID_RESPONSE,
      message: "invalid write acknowledgement at <endpoint>",
      attempt: 2,
    });
  });

  it("keeps read failure and write safety state unchanged after Code 2 exhaustion", async () => {
    const clock = new FakeClock(10);
    const codeTwo = failure(
      NormalizedTransportFailureKind.MODBUS,
      "Modbus Code 2 writing example.invalid:502",
    );
    const transport = new FakeModbusTransport([], {
      writeResponses: [
        { kind: "error", error: codeTwo },
        { kind: "error", error: codeTwo },
        { kind: "error", error: codeTwo },
      ],
    });
    const { client } = createSequenceClient([transport], clock, { maxRetries: 3 });
    const register = createRegisterDef({
      address: 4_502,
      datatype: DataType.UCHAR,
      name: "write_code_two_eeprom",
      writable: true,
      eepromSensitive: true,
    });
    seedInternalReadState(client, {
      permanentlyFailedRegisters: ["existing_failed"],
      unsupportedRegisters: ["existing_unsupported"],
    });
    seedInternalWriteState(client, {
      writeThrottle: { prior_eeprom: 5 },
      cyclicWrites: { prior_cyclic: 20 },
    });

    await expect(writeInternalRegister(client, register, 1)).rejects.toMatchObject({
      kind: NormalizedTransportFailureKind.MODBUS,
    });

    expect(fakeEventKinds(transport)).toEqual(["connect", "write", "write", "write"]);
    expect(client.getUnsupportedRegisters()).toEqual(["existing_unsupported"]);
    expect(client.getDiagnostics().permanentlyFailedRegisters).toEqual(["existing_failed"]);
    expect(getInternalWriteStateSnapshot(client)).toMatchObject({
      writeThrottle: { prior_eeprom: 5 },
      cyclicWrites: { prior_cyclic: 20 },
    });
    const serialized = JSON.stringify(client.getLastErrorContext());
    expect(serialized).not.toContain("example.invalid");
    expect(serialized).not.toMatch(/cause|payload|response|words/u);
  });
});

describe("IdmModbusClient probes and error context", () => {
  it("uses exact FC04 request identity and temporary one-attempt/two-second overrides", async () => {
    const clock = new FakeClock();
    const transport = new FakeModbusTransport([{ kind: "words", words: [0, 16_968] }]);
    const { client } = createSequenceClient([transport], clock, { maxRetries: 8 });

    await expect(client.probeRegister(4_108, 2, { maxRetries: 1, timeout: 2 })).resolves.toEqual([
      0, 16_968,
    ]);

    expect(fakeReadRequests(transport)).toEqual([
      {
        unitId: 1,
        registerType: RegisterType.INPUT,
        functionCode: 4,
        address: 4_108,
        count: 2,
        timeoutMs: 2_000,
      },
    ]);
    expect(client.getDiagnostics()).toMatchObject({
      permanentlyFailedRegisters: [],
      batchUnsafeRegisters: [],
      connectionSuspect: false,
    });
  });

  it("normalizes every positive fractional probe timeout with bounded half-even milliseconds", async () => {
    const clock = new FakeClock();
    const transport = new FakeModbusTransport([
      { kind: "words", words: [7] },
      { kind: "words", words: [8] },
      { kind: "words", words: [9] },
    ]);
    const { client } = createSequenceClient([transport], clock);

    await expect(client.probeRegister(4_109, 1, { timeout: 0.0015 })).resolves.toEqual([7]);
    await expect(client.probeRegister(4_110, 1, { timeout: 0.0025 })).resolves.toEqual([8]);
    await expect(client.probeRegister(4_111, 1, { timeout: Number.MIN_VALUE })).resolves.toEqual([
      9,
    ]);

    expect(fakeReadRequests(transport).map(({ timeoutMs }) => timeoutMs)).toEqual([2, 2, 1]);
  });

  it("throws configuration and programming failures instead of swallowing them", async () => {
    const clock = new FakeClock();
    let creations = 0;
    const client = createInternalIdmModbusClient(
      "example.invalid",
      {},
      {
        transportFactory: () => {
          creations += 1;
          throw new TypeError("programming failure");
        },
        now: () => clock.now(),
        sleep: (seconds) => clock.sleep(seconds),
      },
    );

    await expect(client.probeRegister(-1)).rejects.toBeInstanceOf(RangeError);
    await expect(client.probeRegister(0, 0)).rejects.toBeInstanceOf(RangeError);
    await expect(client.probeRegister(0, 1, { timeout: 0 })).rejects.toBeInstanceOf(RangeError);
    await expect(client.probeRegister(0, 1, { timeout: Number.NaN })).rejects.toBeInstanceOf(
      RangeError,
    );
    await expect(client.probeRegister(0, 1, { maxRetries: Number.NaN })).rejects.toBeInstanceOf(
      RangeError,
    );
    await expect(client.probeRegister(0)).rejects.toThrow("programming failure");
    expect(creations).toBe(1);
  });

  it("keeps the latest normalized context immutable until explicit clear", async () => {
    const clock = new FakeClock();
    const transport = new FakeModbusTransport([
      {
        kind: "error",
        error: new NormalizedTransportFailure(
          NormalizedTransportFailureKind.SOCKET,
          "example.invalid:502 reset",
        ),
      },
    ]);
    const { client } = createSequenceClient([transport], clock, { maxRetries: 1 });

    await expect(client.probeRegister(1_006)).resolves.toBeNull();

    const context = client.getLastErrorContext();
    expect(context).toEqual({
      operation: "read",
      address: 1_006,
      count: 1,
      registerType: "input",
      errorType: NormalizedTransportFailureKind.SOCKET,
      message: "<endpoint> reset",
      attempt: 1,
    });
    expect(Object.isFrozen(context)).toBe(true);
    expect(() => {
      (context as { attempt: number }).attempt = 99;
    }).toThrow(TypeError);

    client.clearLastErrorContext();

    expect(client.getLastErrorContext()).toBeNull();
    expect(context?.attempt).toBe(1);
  });

  it("holds the same FIFO gate through reconnect and injected delay", async () => {
    const first = new FakeModbusTransport([
      { kind: "error", error: failure(NormalizedTransportFailureKind.TIMEOUT) },
    ]);
    const second = new FakeModbusTransport([{ kind: "words", words: [13] }]);
    let releaseSleep!: () => void;
    let markSleepStarted!: () => void;
    const sleepStarted = new Promise<void>((resolve) => {
      markSleepStarted = resolve;
    });
    const sleepBlocker = new Promise<void>((resolve) => {
      releaseSleep = resolve;
    });
    const clock = new FakeClock();
    const { client } = createSequenceClient(
      [first, second],
      clock,
      { maxRetries: 2 },
      {
        sleep: async (seconds) => {
          expect(seconds).toBe(0.5);
          markSleepStarted();
          await sleepBlocker;
        },
      },
    );

    const probe = client.probeRegister(1_007);
    await sleepStarted;
    const disconnect = client.disconnect();
    await Promise.resolve();

    expect(fakeEventKinds(second)).toEqual(["connect"]);

    releaseSleep();
    await expect(probe).resolves.toEqual([13]);
    await expect(disconnect).resolves.toBeUndefined();
    expect(fakeEventKinds(second)).toEqual(["connect", "read", "close"]);
  });
});

describe("IdmModbusClient batch failure state", () => {
  it("propagates transport failures without register counters or unsupported state", async () => {
    const clock = new FakeClock();
    const transport = new FakeModbusTransport([
      {
        kind: "error",
        error: failure(NormalizedTransportFailureKind.TIMEOUT),
      },
    ]);
    const { client } = createSequenceClient([transport], clock, { maxRetries: 1 });
    const register = createRegisterDef({
      address: 2_000,
      datatype: DataType.UCHAR,
      name: "transport_failure_register",
    });

    await expect(client.readBatch([register])).rejects.toMatchObject({
      kind: NormalizedTransportFailureKind.TIMEOUT,
    });
    expect(client.getUnsupportedRegisters()).toEqual([]);
    expect(client.getDiagnostics().permanentlyFailedRegisters).toEqual([]);
  });

  it("marks a generic device failure permanent on exactly the third individual failure", async () => {
    const clock = new FakeClock();
    const deviceFailure = (): ScriptedRead => ({
      kind: "error",
      error: failure(NormalizedTransportFailureKind.MODBUS),
    });
    const transport = new FakeModbusTransport([
      deviceFailure(),
      deviceFailure(),
      deviceFailure(),
      deviceFailure(),
      deviceFailure(),
      deviceFailure(),
    ]);
    const { client } = createSequenceClient([transport], clock, { maxRetries: 1 });
    const register = createRegisterDef({
      address: 2_100,
      datatype: DataType.UCHAR,
      name: "third_failure_register",
    });

    await expect(client.readBatch([register])).resolves.toEqual({});
    await expect(client.readBatch([register])).resolves.toEqual({});
    expect(client.getDiagnostics().permanentlyFailedRegisters).toEqual([]);

    await expect(client.readBatch([register])).resolves.toEqual({});
    expect(client.getDiagnostics().permanentlyFailedRegisters).toEqual(["third_failure_register"]);

    const readsBeforeSkip = fakeReadRequests(transport).length;
    await expect(client.readBatch([register])).resolves.toEqual({});
    expect(fakeReadRequests(transport)).toHaveLength(readsBeforeSkip);
    await expect(client.readRegister(register)).rejects.toThrow("permanently failed");
  });

  it("clears only a register's transient count after an individual success", async () => {
    const clock = new FakeClock();
    const transport = new FakeModbusTransport([
      {
        kind: "error",
        error: failure(NormalizedTransportFailureKind.MODBUS),
      },
      { kind: "words", words: [7] },
      {
        kind: "error",
        error: failure(NormalizedTransportFailureKind.MODBUS),
      },
      {
        kind: "error",
        error: failure(NormalizedTransportFailureKind.MODBUS),
      },
    ]);
    const { client } = createSequenceClient([transport], clock, { maxRetries: 1 });
    const register = createRegisterDef({
      address: 2_200,
      datatype: DataType.UCHAR,
      name: "success_reset_register",
    });
    client.markBatchUnsafe(register);

    await expect(client.readBatch([register])).resolves.toEqual({});
    await expect(client.readBatch([register])).resolves.toEqual({
      success_reset_register: 7,
    });
    await expect(client.readBatch([register])).resolves.toEqual({});
    await expect(client.readBatch([register])).resolves.toEqual({});

    expect(client.getDiagnostics().permanentlyFailedRegisters).toEqual([]);
  });

  it("keeps quarantine and error context while reset clears failure and unsupported state", async () => {
    const clock = new FakeClock();
    const transport = new FakeModbusTransport([
      { kind: "error", error: new IllegalAddressError("reset unsupported") },
    ]);
    const { client } = createSequenceClient([transport], clock, { maxRetries: 1 });
    const register = createRegisterDef({
      address: 2_300,
      datatype: DataType.UCHAR,
      name: "reset_scope_register",
    });
    client.markBatchUnsafe(register, "zeta", "alpha");

    await expect(client.readBatch([register])).resolves.toEqual({});
    const context = client.getLastErrorContext();
    expect(client.getUnsupportedRegisters()).toEqual(["reset_scope_register"]);
    expect(client.getBatchUnsafeRegisters()).toEqual(["alpha", "reset_scope_register", "zeta"]);
    expect(Object.isFrozen(client.getUnsupportedRegisters())).toBe(true);
    expect(Object.isFrozen(client.getBatchUnsafeRegisters())).toBe(true);

    client.resetFailedRegisters();

    expect(client.getUnsupportedRegisters()).toEqual([]);
    expect(client.getDiagnostics().permanentlyFailedRegisters).toEqual([]);
    expect(client.getBatchUnsafeRegisters()).toEqual(["alpha", "reset_scope_register", "zeta"]);
    expect(client.getLastErrorContext()).toBe(context);
  });
});
