import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { IdmClientDiagnostics, ModbusErrorContext } from "../../src/client/diagnostics.js";
import {
  attachInternalModbusTransport,
  createInternalIdmModbusClient,
  getInternalClientSnapshot,
  seedInternalReadState,
} from "../../src/client/internal-create.js";
import {
  NormalizedTransportFailure,
  NormalizedTransportFailureKind,
} from "../../src/transport/errors.js";
import { FakeModbusTransport } from "../support/fake-modbus-transport.js";

interface ConstructorParameterFact {
  readonly name: string;
}

interface PublicClassFact {
  readonly constructor: {
    readonly parameters: readonly ConstructorParameterFact[];
  };
  readonly members: readonly { readonly name: string }[];
  readonly python_name: string;
}

interface PublicClasses {
  readonly classes: readonly PublicClassFact[];
}

const publicClasses = JSON.parse(
  readFileSync("test/fixtures/public-classes.json", "utf8"),
) as PublicClasses;

function classFact(name: string): PublicClassFact {
  const fact = publicClasses.classes.find((candidate) => candidate.python_name === name);
  if (fact === undefined) {
    throw new Error(`Missing public class facts for ${name}`);
  }
  return fact;
}

function snakeToCamel(name: string): string {
  return name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

describe("ModbusErrorContext factory", () => {
  it("matches the exact seven fixture-derived fields and owns a frozen snapshot", () => {
    const hostileInput = {
      operation: "read",
      address: 1392,
      count: 2,
      registerType: "input",
      errorType: NormalizedTransportFailureKind.TIMEOUT,
      message: "Timeout from <endpoint>",
      attempt: 1,
      adapter: "modbus-serial",
      cause: new Error("raw"),
      host: "example.invalid",
      raw: { words: [1, 2] },
      response: { data: [1, 2] },
      writePayload: [1234],
    };

    const context = ModbusErrorContext.create(hostileInput);
    const fixtureKeys = classFact("ModbusErrorContext").constructor.parameters.map(({ name }) =>
      snakeToCamel(name),
    );

    expect(Object.keys(context)).toEqual(fixtureKeys);
    expect(context).toEqual({
      operation: "read",
      address: 1392,
      count: 2,
      registerType: "input",
      errorType: NormalizedTransportFailureKind.TIMEOUT,
      message: "Timeout from <endpoint>",
      attempt: 1,
    });
    expect(Object.isFrozen(context)).toBe(true);
    expect(Reflect.set(context, "message", "mutated")).toBe(false);

    for (const forbidden of [
      "adapter",
      "cause",
      "code",
      "endpoint",
      "host",
      "raw",
      "response",
      "slaveId",
      "writePayload",
    ]) {
      expect(forbidden in context).toBe(false);
    }
  });

  it("publishes only a frozen same-name create namespace", () => {
    expect(Object.keys(ModbusErrorContext)).toEqual(["create"]);
    expect(Object.isFrozen(ModbusErrorContext)).toBe(true);
    expect(classFact("ModbusErrorContext").members.map(({ name }) => snakeToCamel(name))).toEqual([
      "address",
      "attempt",
      "count",
      "errorType",
      "message",
      "operation",
      "registerType",
    ]);
  });
});

describe("IdmClientDiagnostics factory", () => {
  it("applies the exact pinned defaults with exact runtime keys", () => {
    const diagnostics = IdmClientDiagnostics.create({
      navigatorType: "Navigator 2.0",
      modbusConnected: false,
    });
    const fixtureKeys = classFact("IdmClientDiagnostics").constructor.parameters.map(({ name }) =>
      snakeToCamel(name),
    );

    expect(Object.keys(diagnostics)).toEqual(fixtureKeys);
    expect(diagnostics).toEqual({
      navigatorType: "Navigator 2.0",
      modbusConnected: false,
      firmware: null,
      lastError: null,
      permanentlyFailedRegisters: [],
      connectionSuspect: false,
      batchUnsafeRegisters: [],
    });
    expect(Object.isFrozen(diagnostics)).toBe(true);
    expect(Object.isFrozen(diagnostics.permanentlyFailedRegisters)).toBe(true);
    expect(Object.isFrozen(diagnostics.batchUnsafeRegisters)).toBe(true);
  });

  it("clones arrays without sorting, deduplicating, or losing caller order", () => {
    const permanent = ["zeta", "alpha", "zeta"];
    const batchUnsafe = ["mode", "humidity", "mode"];
    const diagnostics = IdmClientDiagnostics.create({
      navigatorType: "Navigator 10",
      modbusConnected: true,
      firmware: "1.23",
      lastError: "Failure at <endpoint>",
      permanentlyFailedRegisters: permanent,
      connectionSuspect: true,
      batchUnsafeRegisters: batchUnsafe,
    });

    permanent.sort();
    permanent.push("mutated");
    batchUnsafe.reverse();
    batchUnsafe.push("mutated");

    expect(diagnostics).toEqual({
      navigatorType: "Navigator 10",
      modbusConnected: true,
      firmware: "1.23",
      lastError: "Failure at <endpoint>",
      permanentlyFailedRegisters: ["zeta", "alpha", "zeta"],
      connectionSuspect: true,
      batchUnsafeRegisters: ["mode", "humidity", "mode"],
    });
    expect(() =>
      (diagnostics.permanentlyFailedRegisters as unknown as string[]).push("hostile"),
    ).toThrow(TypeError);
    expect(() => (diagnostics.batchUnsafeRegisters as unknown as string[]).sort()).toThrow(
      TypeError,
    );
    expect(Reflect.set(diagnostics, "connectionSuspect", false)).toBe(false);
  });

  it("preserves explicit nulls and excludes unsupported, adapter, endpoint, and write fields", () => {
    const diagnostics = IdmClientDiagnostics.create({
      navigatorType: "Unknown",
      modbusConnected: false,
      firmware: null,
      lastError: null,
      permanentlyFailedRegisters: [],
      connectionSuspect: false,
      batchUnsafeRegisters: [],
      unsupportedRegisters: ["not-a-dataclass-field"],
      adapter: "modbus-serial",
      endpoint: "example.invalid",
      host: "example.invalid",
      rawError: new Error("raw"),
      request: { address: 1 },
      slaveId: 1,
      writePayload: [1234],
    } as Parameters<typeof IdmClientDiagnostics.create>[0] & Record<string, unknown>);

    expect(diagnostics.firmware).toBeNull();
    expect(diagnostics.lastError).toBeNull();
    for (const forbidden of [
      "adapter",
      "endpoint",
      "host",
      "rawError",
      "request",
      "slaveId",
      "unsupportedRegisters",
      "writePayload",
    ]) {
      expect(forbidden in diagnostics).toBe(false);
    }
  });

  it("publishes only a frozen same-name create namespace", () => {
    expect(Object.keys(IdmClientDiagnostics)).toEqual(["create"]);
    expect(Object.isFrozen(IdmClientDiagnostics)).toBe(true);
  });
});

describe("IdmModbusClient diagnostics integration", () => {
  it("sorts owned internal-set snapshots while preserving factory ordering responsibility", () => {
    const client = createInternalIdmModbusClient("example.invalid", undefined, {
      transportFactory: () => new FakeModbusTransport([]),
      now: () => 0,
      sleep: async () => undefined,
    });
    seedInternalReadState(client, {
      permanentlyFailedRegisters: ["zeta", "alpha", "middle"],
      unsupportedRegisters: ["zeta", "alpha"],
      batchUnsafeRegisters: ["zeta", "alpha", "middle"],
    });

    const diagnostics = client.getDiagnostics();

    expect(diagnostics).toMatchObject({
      navigatorType: "Navigator 2.0",
      modbusConnected: false,
      firmware: null,
      lastError: null,
      permanentlyFailedRegisters: ["alpha", "middle", "zeta"],
      connectionSuspect: false,
      batchUnsafeRegisters: ["alpha", "middle", "zeta"],
    });
    expect(client.getUnsupportedRegisters()).toEqual(["alpha", "zeta"]);
    expect(client.getBatchUnsafeRegisters()).toEqual(["alpha", "middle", "zeta"]);
    expect(Object.isFrozen(client.getUnsupportedRegisters())).toBe(true);
    expect(Object.isFrozen(client.getBatchUnsafeRegisters())).toBe(true);
    expect("getPermanentlyFailedRegisters" in client).toBe(false);
  });

  it("retains an immutable latest context after recovery until explicitly cleared", async () => {
    const transport = new FakeModbusTransport(
      [
        {
          kind: "error",
          error: new NormalizedTransportFailure(
            NormalizedTransportFailureKind.TIMEOUT,
            "example.invalid:502 timed out",
          ),
        },
        { kind: "words", words: [7] },
      ],
      { initiallyConnected: true },
    );
    const client = createInternalIdmModbusClient(
      "example.invalid",
      { maxRetries: 1 },
      {
        transportFactory: () => transport,
        now: () => 0,
        sleep: async () => undefined,
      },
    );
    attachInternalModbusTransport(client, transport);

    await expect(client.probeRegister(1_000, 1, { maxRetries: 1 })).resolves.toBeNull();
    const failedContext = client.getLastErrorContext();
    expect(failedContext).toMatchObject({
      address: 1_000,
      count: 1,
      attempt: 1,
      message: "<endpoint> timed out",
    });
    expect(Object.isFrozen(failedContext)).toBe(true);

    await expect(client.probeRegister(1_001, 1, { maxRetries: 1 })).resolves.toEqual([7]);
    expect(client.getLastErrorContext()).toBe(failedContext);
    expect(client.getDiagnostics()).toMatchObject({
      modbusConnected: true,
      connectionSuspect: false,
      lastError: "<endpoint> timed out",
    });

    client.clearLastErrorContext();
    expect(client.getLastErrorContext()).toBeNull();
    expect(client.getDiagnostics().lastError).toBeNull();
    transport.assertResponsesConsumed();
  });

  it("resets only permanent, unsupported, and transient read-failure state", () => {
    const client = createInternalIdmModbusClient("example.invalid", undefined, {
      transportFactory: () => new FakeModbusTransport([]),
      now: () => 0,
      sleep: async () => undefined,
    });
    seedInternalReadState(client, {
      permanentlyFailedRegisters: ["permanent"],
      unsupportedRegisters: ["unsupported"],
      batchUnsafeRegisters: ["batch-unsafe"],
      transientFailures: { transient: 2 },
    });

    client.resetFailedRegisters();

    expect(client.getUnsupportedRegisters()).toEqual([]);
    expect(client.getDiagnostics().permanentlyFailedRegisters).toEqual([]);
    expect(client.getBatchUnsafeRegisters()).toEqual(["batch-unsafe"]);
    expect(getInternalClientSnapshot(client).transientFailures).toEqual({});
    expect(client.modelInfo).toBeNull();
    expect(client.modelName).toBe("Navigator 2.0");
  });

  it("reports disconnected and reconnected snapshots without clearing retained state", async () => {
    const transport = new FakeModbusTransport([]);
    const client = createInternalIdmModbusClient("example.invalid", undefined, {
      transportFactory: () => transport,
      now: () => 0,
      sleep: async () => undefined,
    });
    client.markBatchUnsafe("retained");

    expect(client.getDiagnostics()).toMatchObject({
      modbusConnected: false,
      batchUnsafeRegisters: ["retained"],
    });

    await client.connect();
    expect(client.getDiagnostics()).toMatchObject({
      modbusConnected: true,
      batchUnsafeRegisters: ["retained"],
    });

    await client.disconnect();
    expect(client.getDiagnostics()).toMatchObject({
      modbusConnected: false,
      batchUnsafeRegisters: ["retained"],
    });
  });
});
