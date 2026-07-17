import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import type { IdmModbusClient } from "../../src/client/index.js";
import {
  createInternalIdmModbusClient,
  getInternalActiveCyclicWrites,
  getInternalExpiredCyclicWrites,
  getInternalWriteStateSnapshot,
  readInternalModbusRegisters,
  resetInternalCyclicWriteState,
  resetInternalWriteThrottle,
  seedInternalReadState,
  seedInternalWriteState,
  setInternalValue,
  simulateInternalWrite,
  writeInternalRegister,
  type InternalClientDependencies,
} from "../../src/client/internal-create.js";
import { createRegisterDef, type RegisterDef } from "../../src/registers/definitions.js";
import {
  createNormalizedTransportFailure,
  IllegalAddressError,
  NormalizedTransportFailureKind,
} from "../../src/transport/errors.js";
import type {
  ModbusTransport,
  ModbusWriteRequest,
  ModbusWriteTransport,
} from "../../src/transport/types.js";
import { DataType, RegisterType } from "../../src/types.js";
import { FakeClock } from "../support/fake-clock.js";
import { FakeModbusTransport } from "../support/fake-modbus-transport.js";

function eepromRegister(name = "synthetic_eeprom", address = 4_206): RegisterDef {
  return createRegisterDef({
    address,
    datatype: DataType.UCHAR,
    name,
    writable: true,
    eepromSensitive: true,
    minVal: 0,
    maxVal: 10,
  });
}

function cyclicRegister(name = "synthetic_cyclic", address = 4_210): RegisterDef {
  return createRegisterDef({
    address,
    datatype: DataType.FLOAT,
    name,
    writable: true,
    cyclicRequired: true,
    cyclicWriteTtl: 30,
  });
}

function readRegister(name = "synthetic_read", address = 4_300): RegisterDef {
  return createRegisterDef({ address, datatype: DataType.UCHAR, name });
}

function writeRequests(transport: FakeModbusTransport): readonly ModbusWriteRequest[] {
  return transport.events.flatMap((event) => (event.kind === "write" ? [event.request] : []));
}

function eventKinds(transport: FakeModbusTransport): readonly string[] {
  return transport.events.map((event) => event.kind);
}

function clientFromTransports(
  transports: readonly ModbusTransport[],
  clock: FakeClock,
  options: ConstructorParameters<typeof IdmModbusClient>[1] = {},
  overrides: Partial<InternalClientDependencies> = {},
): Readonly<{ client: IdmModbusClient; factoryCalls: () => number }> {
  const remaining = [...transports];
  let calls = 0;
  const client = createInternalIdmModbusClient("example.invalid", options, {
    transportFactory: () => {
      calls += 1;
      const transport = remaining.shift();
      if (transport === undefined) throw new Error("Synthetic transport factory exhausted");
      return transport;
    },
    now: overrides.now ?? (() => clock.now()),
    sleep: overrides.sleep ?? ((seconds) => clock.sleep(seconds)),
  });
  return Object.freeze({ client, factoryCalls: () => calls });
}

describe("internal IdmModbusClient write execution", () => {
  it("preserves all three dry-run defaults without factory, FIFO traffic, or state", async () => {
    const clock = new FakeClock();
    const { client, factoryCalls } = clientFromTransports([], clock);

    const simulated = simulateInternalWrite(client, "system_mode", 1);
    const metadataOnly = simulateInternalWrite(client, "system_mode", 1, { dryRun: false });
    const drySet = await setInternalValue(client, "system_mode", 1, { dryRun: true });

    expect(simulated.dryRun).toBe(true);
    expect(metadataOnly.dryRun).toBe(false);
    expect(drySet.dryRun).toBe(true);
    expect(factoryCalls()).toBe(0);
    expect(client.isConnected).toBe(false);
    expect(getInternalWriteStateSnapshot(client)).toMatchObject({
      writeThrottle: {},
      cyclicWrites: {},
    });
  });

  it("emits exact one- and two-word holding FC16 requests and commits only after success", async () => {
    const clock = new FakeClock(10);
    const first = new FakeModbusTransport([], {
      writeResponses: [{ kind: "write_ok" }],
    });
    const { client: setClient } = clientFromTransports([first], clock);

    const setResult = await setInternalValue(setClient, "system_mode", 1);
    expect(setResult.dryRun).toBe(false);
    expect(writeRequests(first)).toEqual([
      {
        unitId: 1,
        registerType: RegisterType.HOLDING,
        functionCode: 16,
        address: 1_005,
        count: 1,
        words: [1],
      },
    ]);
    expect(getInternalWriteStateSnapshot(setClient).writeThrottle).toEqual({ system_mode: 10 });

    const second = new FakeModbusTransport([], {
      writeResponses: [{ kind: "write_ok" }],
    });
    const { client: floatClient } = clientFromTransports([second], clock);
    const register = createRegisterDef({
      address: 4_200,
      datatype: DataType.FLOAT,
      name: "synthetic_float",
      writable: true,
    });
    await writeInternalRegister(floatClient, register, 42.5);
    expect(writeRequests(second)).toEqual([
      {
        unitId: 1,
        registerType: RegisterType.HOLDING,
        functionCode: 16,
        address: 4_200,
        count: 2,
        words: [0, 16_938],
      },
    ]);
  });

  it("accepts an explicit custom register without a detected model and preserves identity", async () => {
    const clock = new FakeClock();
    const transport = new FakeModbusTransport([], {
      writeResponses: [{ kind: "write_ok" }],
    });
    const { client } = clientFromTransports([transport], clock);
    const register = createRegisterDef({
      address: 4_202,
      datatype: DataType.BOOL,
      name: "synthetic_bool",
      writable: true,
    });

    expect(simulateInternalWrite(client, register, true).register).toBe(register);
    await expect(writeInternalRegister(client, register, true)).resolves.toBeUndefined();
    expect(writeRequests(transport)[0]?.words).toEqual([1]);
  });

  it("serializes two first EEPROM writes from validation through commit", async () => {
    const clock = new FakeClock();
    const transport = new FakeModbusTransport([], {
      pauseWrites: true,
      writeResponses: [{ kind: "write_ok" }],
    });
    const { client } = clientFromTransports([transport], clock);
    const register = eepromRegister();

    const first = writeInternalRegister(client, register, 1);
    await transport.waitForPendingWrites(1);
    const second = writeInternalRegister(client, register, 2);
    await Promise.resolve();
    expect(writeRequests(transport)).toHaveLength(1);

    transport.releaseNextWrite();
    await expect(first).resolves.toBeUndefined();
    await expect(second).rejects.toMatchObject({ code: "write_eeprom_throttled" });
    expect(writeRequests(transport)).toHaveLength(1);
    expect(transport.maxActiveRequests).toBe(1);
  });

  it("serializes mixed write/read traffic and continues the queue after rejection", async () => {
    const clock = new FakeClock();
    const transport = new FakeModbusTransport([{ kind: "words", words: [7] }], {
      pauseWrites: true,
      writeResponses: [{ kind: "write_ok" }],
    });
    const { client } = clientFromTransports([transport], clock);
    const eeprom = eepromRegister();
    const read = readRegister();

    const first = writeInternalRegister(client, eeprom, 1);
    await transport.waitForPendingWrites(1);
    const rejected = writeInternalRegister(client, eeprom, 2);
    const followingRead = client.readRegister(read);
    await Promise.resolve();
    expect(transport.pendingReads).toBe(0);

    transport.releaseNextWrite();
    await expect(first).resolves.toBeUndefined();
    await expect(rejected).rejects.toMatchObject({ code: "write_eeprom_throttled" });
    await expect(followingRead).resolves.toBe(7);
    expect(transport.maxActiveRequests).toBe(1);
    expect(eventKinds(transport)).toEqual(["connect", "write", "read"]);
  });

  it("applies synchronous resets immediately while an acknowledgement is in flight", async () => {
    const clock = new FakeClock(60);
    const eepromTransport = new FakeModbusTransport([], {
      pauseWrites: true,
      writeResponses: [{ kind: "write_ok" }],
    });
    const { client: eepromClient } = clientFromTransports([eepromTransport], clock);
    const eeprom = eepromRegister();
    seedInternalWriteState(eepromClient, { writeThrottle: { [eeprom.name]: 0 } });

    const eepromWrite = writeInternalRegister(eepromClient, eeprom, 1);
    await eepromTransport.waitForPendingWrites(1);
    resetInternalWriteThrottle(eepromClient, eeprom);
    expect(getInternalWriteStateSnapshot(eepromClient).writeThrottle).toEqual({});
    eepromTransport.releaseNextWrite();
    await eepromWrite;
    expect(getInternalWriteStateSnapshot(eepromClient).writeThrottle).toEqual({
      [eeprom.name]: 60,
    });

    const cyclicTransport = new FakeModbusTransport([], {
      pauseWrites: true,
      writeResponses: [{ kind: "write_ok" }],
    });
    const { client: cyclicClient } = clientFromTransports([cyclicTransport], clock);
    const cyclic = cyclicRegister();
    seedInternalWriteState(cyclicClient, { cyclicWrites: { [cyclic.name]: 70 } });
    const cyclicWrite = writeInternalRegister(cyclicClient, cyclic, 42.5);
    await cyclicTransport.waitForPendingWrites(1);
    resetInternalCyclicWriteState(cyclicClient, cyclic);
    expect(getInternalActiveCyclicWrites(cyclicClient)).toEqual({});
    expect([...getInternalExpiredCyclicWrites(cyclicClient)]).toEqual([]);
    cyclicTransport.releaseNextWrite();
    await cyclicWrite;
    expect(getInternalActiveCyclicWrites(cyclicClient)).toEqual({ [cyclic.name]: 90 });
  });

  it("preserves prior cyclic state when every write attempt fails", async () => {
    const clock = new FakeClock(10);
    const failure = createNormalizedTransportFailure(
      NormalizedTransportFailureKind.MODBUS,
      "write at example.invalid:502 failed",
    );
    const transport = new FakeModbusTransport([], {
      writeResponses: [
        { kind: "error", error: failure },
        { kind: "error", error: failure },
        { kind: "error", error: failure },
      ],
    });
    const { client } = clientFromTransports([transport], clock, { maxRetries: 3 });
    const register = cyclicRegister();
    seedInternalWriteState(client, { cyclicWrites: { [register.name]: 30 } });

    await expect(writeInternalRegister(client, register, 21)).rejects.toMatchObject({
      kind: NormalizedTransportFailureKind.MODBUS,
    });
    expect(clock.delays).toEqual([0.5, 1]);
    expect(getInternalWriteStateSnapshot(client).cyclicWrites).toEqual({ [register.name]: 30 });
    expect(client.getUnsupportedRegisters()).toEqual([]);
    expect(client.getDiagnostics().permanentlyFailedRegisters).toEqual([]);
  });

  it("keeps ordinary write Code 2 retryable but structured IllegalAddressError immediate", async () => {
    const clock = new FakeClock();
    const codeTwo = createNormalizedTransportFailure(
      NormalizedTransportFailureKind.MODBUS,
      "Modbus Code 2 writing example.invalid:502",
    );
    const retrying = new FakeModbusTransport([], {
      writeResponses: [{ kind: "error", error: codeTwo }, { kind: "write_ok" }],
    });
    const { client: retryingClient } = clientFromTransports([retrying], clock, { maxRetries: 3 });
    await writeInternalRegister(retryingClient, eepromRegister(), 1);
    expect(writeRequests(retrying)).toHaveLength(2);
    expect(clock.delays).toEqual([0.5]);
    expect(retryingClient.getUnsupportedRegisters()).toEqual([]);

    const structured = new FakeModbusTransport([], {
      writeResponses: [
        { kind: "error", error: new IllegalAddressError("address example.invalid:502") },
      ],
    });
    const { client: structuredClient } = clientFromTransports([structured], new FakeClock(), {
      maxRetries: 3,
    });
    seedInternalReadState(structuredClient, {
      unsupportedRegisters: ["existing"],
      permanentlyFailedRegisters: ["existing"],
    });
    await expect(
      writeInternalRegister(structuredClient, eepromRegister(), 1),
    ).rejects.toBeInstanceOf(IllegalAddressError);
    expect(writeRequests(structured)).toHaveLength(1);
    expect(structuredClient.getUnsupportedRegisters()).toEqual(["existing"]);
    expect(structuredClient.getDiagnostics().permanentlyFailedRegisters).toEqual(["existing"]);
  });

  it("records bounded redacted payload-free write context and retains it after success", async () => {
    const clock = new FakeClock();
    const failure = createNormalizedTransportFailure(
      NormalizedTransportFailureKind.MODBUS,
      "write at example.invalid:502 failed",
    );
    const transport = new FakeModbusTransport([], {
      writeResponses: [
        { kind: "error", error: failure },
        { kind: "write_ok" },
        { kind: "write_ok" },
      ],
    });
    const { client } = clientFromTransports([transport], clock, { maxRetries: 3 });
    const register = cyclicRegister();

    await writeInternalRegister(client, register, 42.5);
    const context = client.getLastErrorContext();
    expect(context).toEqual({
      operation: "write",
      address: register.address,
      count: 2,
      registerType: "holding",
      errorType: "modbus",
      message: "write at <endpoint> failed",
      attempt: 1,
    });
    await writeInternalRegister(client, register, 43);
    expect(client.getLastErrorContext()).toBe(context);
    expect(client.getDiagnostics().connectionSuspect).toBe(false);

    const serialized = JSON.stringify(context);
    expect(serialized).not.toContain("16938");
    expect(serialized).not.toContain("example.invalid");
    expect(serialized).not.toMatch(/cause|response|words|payload/u);
    expect(Object.isFrozen(context)).toBe(true);
  });

  it.each([
    NormalizedTransportFailureKind.TIMEOUT,
    NormalizedTransportFailureKind.DISCONNECTED,
    NormalizedTransportFailureKind.SOCKET,
    NormalizedTransportFailureKind.NO_RESPONSE,
  ] as const)("reconnects %s writes before retrying on a fresh transport", async (kind) => {
    const clock = new FakeClock();
    const failed = new FakeModbusTransport([], {
      writeResponses: [
        {
          kind: "error",
          error: createNormalizedTransportFailure(kind, `${kind} at example.invalid:502`),
        },
      ],
    });
    const recovered = new FakeModbusTransport([], {
      writeResponses: [{ kind: "write_ok" }],
    });
    const { client, factoryCalls } = clientFromTransports([failed, recovered], clock, {
      maxRetries: 2,
    });

    await writeInternalRegister(client, eepromRegister(), 1);
    expect(factoryCalls()).toBe(2);
    expect(eventKinds(failed)).toEqual(["connect", "write", "close"]);
    expect(eventKinds(recovered)).toEqual(["connect", "write"]);
    expect(clock.delays).toEqual([0.5]);
    expect(client.getDiagnostics().connectionSuspect).toBe(false);
  });

  it("does not enter the attempt loop after initial connect failure", async () => {
    class FailingConnectTransport implements ModbusWriteTransport {
      public readonly connected = false;
      public connectCalls = 0;
      public async connect(): Promise<void> {
        this.connectCalls += 1;
        throw createNormalizedTransportFailure(
          NormalizedTransportFailureKind.DISCONNECTED,
          "connect example.invalid:502 failed",
        );
      }
      public close(): Promise<void> {
        return Promise.resolve();
      }
      public destroy(): Promise<void> {
        return Promise.resolve();
      }
      public read(): Promise<readonly number[]> {
        return Promise.reject(new Error("unexpected read"));
      }
      public write(): Promise<void> {
        return Promise.reject(new Error("unexpected write"));
      }
    }
    const transport = new FailingConnectTransport();
    const clock = new FakeClock();
    const { client, factoryCalls } = clientFromTransports([transport], clock, { maxRetries: 3 });

    await expect(writeInternalRegister(client, eepromRegister(), 1)).rejects.toMatchObject({
      kind: NormalizedTransportFailureKind.DISCONNECTED,
    });
    expect(factoryCalls()).toBe(1);
    expect(transport.connectCalls).toBe(1);
    expect(clock.delays).toEqual([]);
    expect(client.getLastErrorContext()).toBeNull();
    expect(getInternalWriteStateSnapshot(client).writeThrottle).toEqual({});
  });

  it("keeps the Phase-2 public 22/7 partition and all internal controls out of root exports", async () => {
    const mapping = JSON.parse(
      await readFile(new URL("../../contracts/api-mapping.json", import.meta.url), "utf8"),
    ) as {
      readonly mappings: readonly {
        readonly python_symbol: string;
        readonly partial_class?: {
          readonly implemented_members: readonly string[];
          readonly omitted_members: readonly string[];
        };
      }[];
    };
    const clientMapping = mapping.mappings.find(
      ({ python_symbol }) => python_symbol === "IdmModbusClient",
    );
    expect(clientMapping?.partial_class?.implemented_members).toHaveLength(22);
    expect(clientMapping?.partial_class?.omitted_members).toEqual([
      "getActiveCyclicWrites",
      "getExpiredCyclicWrites",
      "resetCyclicWriteState",
      "resetWriteThrottle",
      "setValue",
      "simulateWrite",
      "writeRegister",
    ]);

    const root = (await import("../../src/index.js")) as Record<string, unknown>;
    for (const name of [
      "simulateInternalWrite",
      "writeInternalRegister",
      "setInternalValue",
      "seedInternalWriteState",
    ]) {
      expect(root).not.toHaveProperty(name);
    }
    const client = createInternalIdmModbusClient("example.invalid", undefined, {
      transportFactory: () => new FakeModbusTransport([]),
      now: () => 0,
      sleep: () => Promise.resolve(),
    });
    for (const name of clientMapping?.partial_class?.omitted_members ?? []) {
      expect(name in (client as unknown as Record<string, unknown>)).toBe(false);
    }
  });

  it("exposes the internal raw read seam without creating a second queue", async () => {
    const clock = new FakeClock();
    const transport = new FakeModbusTransport([{ kind: "words", words: [9] }]);
    const { client } = clientFromTransports([transport], clock);
    await expect(
      readInternalModbusRegisters(client, {
        address: 4_400,
        count: 1,
        maxRetries: 1,
        registerType: RegisterType.INPUT,
      }),
    ).resolves.toEqual([9]);
  });
});
