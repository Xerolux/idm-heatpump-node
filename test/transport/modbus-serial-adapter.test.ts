import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import { IdmModbusClient } from "../../src/client/idm-modbus-client.js";
import { createInternalIdmModbusClient } from "../../src/client/internal-create.js";
import {
  createModbusSerialTransport,
  type ModbusSerialClientBoundary,
  type ModbusSerialTransportConfiguration,
} from "../../src/transport/modbus-serial-adapter.js";
import {
  IllegalAddressError,
  NormalizedTransportFailure,
  NormalizedTransportFailureKind,
} from "../../src/transport/errors.js";
import type { ModbusReadRequest, ModbusTransport } from "../../src/transport/types.js";
import { RegisterType } from "../../src/types.js";

type MockOutcome =
  | Readonly<{ readonly kind: "error"; readonly error: unknown }>
  | Readonly<{ readonly kind: "result"; readonly result: unknown }>;

type MockEvent =
  | Readonly<{ readonly kind: "close" }>
  | Readonly<{ readonly kind: "connect"; readonly host: string; readonly port: number }>
  | Readonly<{ readonly kind: "destroy" }>
  | Readonly<{
      readonly kind: "read_holding" | "read_input";
      readonly address: number;
      readonly count: number;
    }>
  | Readonly<{ readonly kind: "set_id"; readonly unitId: number }>
  | Readonly<{ readonly kind: "set_timeout"; readonly timeoutMs: number }>;

class MockModbusSerialClient implements ModbusSerialClientBoundary {
  readonly events: MockEvent[] = [];
  readonly #holding: MockOutcome[] = [];
  readonly #input: MockOutcome[] = [];
  connectError: unknown;
  closeError: unknown = false;
  destroyError: unknown = false;
  isOpen = false;

  public queueHolding(...outcomes: readonly MockOutcome[]): void {
    this.#holding.push(...outcomes);
  }

  public queueInput(...outcomes: readonly MockOutcome[]): void {
    this.#input.push(...outcomes);
  }

  public setID(unitId: number): void {
    this.events.push({ kind: "set_id", unitId });
  }

  public setTimeout(timeoutMs: number): void {
    this.events.push({ kind: "set_timeout", timeoutMs });
  }

  public async connectTCP(
    host: string,
    options: Readonly<{ readonly port: number }>,
  ): Promise<void> {
    this.events.push({ kind: "connect", host, port: options.port });
    if (this.connectError !== undefined) {
      throw this.connectError;
    }
    this.isOpen = true;
  }

  public async readHoldingRegisters(address: number, count: number): Promise<unknown> {
    this.events.push({ kind: "read_holding", address, count });
    return this.#consume(this.#holding);
  }

  public async readInputRegisters(address: number, count: number): Promise<unknown> {
    this.events.push({ kind: "read_input", address, count });
    return this.#consume(this.#input);
  }

  public close(callback: (error?: unknown) => void): void {
    this.events.push({ kind: "close" });
    this.isOpen = false;
    queueMicrotask(() => {
      callback(this.closeError);
    });
  }

  public destroy(callback: (error?: unknown) => void): void {
    this.events.push({ kind: "destroy" });
    this.isOpen = false;
    queueMicrotask(() => {
      callback(this.destroyError);
    });
  }

  #consume(outcomes: MockOutcome[]): unknown {
    const outcome = outcomes.shift();
    if (outcome === undefined) {
      throw new Error("Mock Modbus read script exhausted");
    }
    if (outcome.kind === "error") {
      throw outcome.error;
    }
    return outcome.result;
  }
}

const configuration: ModbusSerialTransportConfiguration = Object.freeze({
  host: "example.invalid",
  port: 15_020,
  unitId: 7,
  timeout: 12.5,
  adapterRetries: 0 as const,
});

function inputRequest(overrides: Partial<ModbusReadRequest> = {}): ModbusReadRequest {
  return Object.freeze({
    unitId: 7,
    registerType: RegisterType.INPUT,
    functionCode: 4,
    address: 1_392,
    count: 2,
    ...overrides,
  });
}

function createTransport(
  client: MockModbusSerialClient,
  overrides: Partial<typeof configuration> = {},
): ModbusTransport {
  return createModbusSerialTransport(
    Object.freeze({ ...configuration, ...overrides }),
    () => client,
  );
}

function eventTimeouts(client: MockModbusSerialClient): readonly number[] {
  return client.events.flatMap((event) => (event.kind === "set_timeout" ? [event.timeoutMs] : []));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("../../src/transport/modbus-serial-adapter.js");
});

describe("audited modbus-serial runtime dependency", () => {
  it("keeps the package private with exactly modbus-serial 8.0.25 as a direct dependency", async () => {
    const packagePath = fileURLToPath(new URL("../../package.json", import.meta.url));
    const lockPath = fileURLToPath(new URL("../../package-lock.json", import.meta.url));
    const packageJson = JSON.parse(await readFile(packagePath, "utf8")) as {
      readonly private?: unknown;
      readonly dependencies?: Readonly<Record<string, unknown>>;
    };
    const packageLock = JSON.parse(await readFile(lockPath, "utf8")) as {
      readonly packages?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
    };

    expect(packageJson.private).toBe(true);
    expect(packageJson.dependencies).toEqual({ "modbus-serial": "8.0.25" });
    expect(packageLock.packages?.["node_modules/modbus-serial"]).toMatchObject({
      version: "8.0.25",
      integrity:
        "sha512-T6OHW80k7DtYZF96onavw84IXNu44EW+fybgVftWAGOraL8vTmMZod8w6thOrWj2I2qHC9Gsn2nitVTUDih+6A==",
    });
  });
});

describe("ModbusSerialTransport", () => {
  it("configures exact host, port, unit ID, and seconds-to-milliseconds timeout once", async () => {
    const client = new MockModbusSerialClient();
    const transport = createTransport(client);

    expect(transport.connected).toBe(false);
    await transport.connect();
    await transport.connect();

    expect(transport.connected).toBe(true);
    expect(client.events).toEqual([
      { kind: "set_id", unitId: 7 },
      { kind: "set_timeout", timeoutMs: 12_500 },
      { kind: "connect", host: "example.invalid", port: 15_020 },
    ]);
  });

  it("maps holding to FC03 and input to FC04 with one library call per attempt", async () => {
    const client = new MockModbusSerialClient();
    const holdingSource = [0, 0x3f80];
    const inputSource = [0xffff];
    client.queueHolding({ kind: "result", result: { data: holdingSource } });
    client.queueInput({ kind: "result", result: { data: inputSource } });
    const transport = createTransport(client);
    await transport.connect();

    const holding = await transport.read(
      Object.freeze({
        unitId: 3,
        registerType: RegisterType.HOLDING,
        functionCode: 3,
        address: 100,
        count: 2,
      }),
    );
    const input = await transport.read(
      Object.freeze({
        unitId: 4,
        registerType: RegisterType.INPUT,
        functionCode: 4,
        address: 200,
        count: 1,
      }),
    );

    holdingSource[0] = 99;
    inputSource[0] = 99;
    expect(holding).toEqual([0, 0x3f80]);
    expect(input).toEqual([0xffff]);
    expect(Object.isFrozen(holding)).toBe(true);
    expect(Object.isFrozen(input)).toBe(true);
    expect(client.events.filter((event) => event.kind.startsWith("read_"))).toEqual([
      { kind: "read_holding", address: 100, count: 2 },
      { kind: "read_input", address: 200, count: 1 },
    ]);
    expect(client.events.filter((event) => event.kind === "set_id")).toEqual([
      { kind: "set_id", unitId: 7 },
      { kind: "set_id", unitId: 3 },
      { kind: "set_id", unitId: 4 },
    ]);
  });

  it("restores the normal timeout in finally after a successful temporary-timeout read", async () => {
    const client = new MockModbusSerialClient();
    client.queueInput({ kind: "result", result: { data: [0, 0x4228] } });
    const transport = createTransport(client, { timeout: 10 });
    await transport.connect();

    await expect(transport.read(inputRequest({ timeoutMs: 2_000 }))).resolves.toEqual([0, 0x4228]);

    expect(eventTimeouts(client)).toEqual([10_000, 2_000, 10_000]);
  });

  it.each([
    {
      name: "numeric Code 2",
      outcome: { kind: "error", error: { modbusCode: 2, message: "device exception" } },
      assertion: (error: unknown): void => {
        expect(error).toBeInstanceOf(IllegalAddressError);
      },
    },
    {
      name: "socket failure",
      outcome: {
        kind: "error",
        error: { code: "ECONNRESET", message: "socket example.invalid:15020 reset" },
      },
      assertion: (error: unknown): void => {
        expect(error).toBeInstanceOf(NormalizedTransportFailure);
        expect(error).toMatchObject({
          kind: NormalizedTransportFailureKind.SOCKET,
          message: "socket <endpoint> reset",
        });
      },
    },
    {
      name: "invalid response",
      outcome: { kind: "result", result: { data: [1] } },
      assertion: (error: unknown): void => {
        expect(error).toBeInstanceOf(NormalizedTransportFailure);
        expect(error).toMatchObject({ kind: NormalizedTransportFailureKind.INVALID_RESPONSE });
      },
    },
  ] as const)("restores the normal timeout after $name", async ({ outcome, assertion }) => {
    const client = new MockModbusSerialClient();
    client.queueInput(outcome);
    const transport = createTransport(client, { timeout: 10 });
    await transport.connect();

    const error = await transport
      .read(inputRequest({ timeoutMs: 2_000 }))
      .catch((caught: unknown) => caught);

    assertion(error);
    expect(eventTimeouts(client)).toEqual([10_000, 2_000, 10_000]);
  });

  it("uses numeric modbusCode 2 as the sole Illegal Address discriminator", async () => {
    const client = new MockModbusSerialClient();
    client.queueInput(
      {
        kind: "error",
        error: { modbusCode: "2", message: "Illegal data address at example.invalid:15020" },
      },
      { kind: "error", error: { modbusCode: 3, message: "device exception 3" } },
    );
    const transport = createTransport(client);
    await transport.connect();

    for (let index = 0; index < 2; index += 1) {
      const error = await transport.read(inputRequest()).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(NormalizedTransportFailure);
      expect(error).toMatchObject({ kind: NormalizedTransportFailureKind.MODBUS });
      expect(error).not.toBeInstanceOf(IllegalAddressError);
    }
  });

  it.each([
    { data: [1], label: "short" },
    { data: [1, 2, 3], label: "long" },
    { data: [1, 1.5], label: "fractional" },
    { data: [1, 65_536], label: "out-of-range" },
  ])("rejects a $label response before words leave the adapter", async ({ data }) => {
    const client = new MockModbusSerialClient();
    client.queueInput({ kind: "result", result: { data } });
    const transport = createTransport(client);
    await transport.connect();

    await expect(transport.read(inputRequest())).rejects.toMatchObject({
      kind: NormalizedTransportFailureKind.INVALID_RESPONSE,
    });
  });

  it("normalizes and redacts connection failures without retaining a raw cause", async () => {
    const client = new MockModbusSerialClient();
    client.connectError = {
      errno: "ETIMEDOUT",
      message: "connect example.invalid:15020 timed out",
      cause: { private: true },
    };
    const transport = createTransport(client);

    const error = await transport.connect().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NormalizedTransportFailure);
    expect(error).toEqual(
      expect.objectContaining({
        kind: NormalizedTransportFailureKind.TIMEOUT,
        message: "connect <endpoint> timed out",
      }),
    );
    expect(error).not.toHaveProperty("cause");
  });

  it("wraps close and destroy callbacks in idempotent Promises", async () => {
    const closeClient = new MockModbusSerialClient();
    const closeTransport = createTransport(closeClient);
    await closeTransport.connect();

    await Promise.all([closeTransport.close(), closeTransport.close(), closeTransport.close()]);
    await closeTransport.close();
    expect(closeClient.events.filter((event) => event.kind === "close")).toHaveLength(1);
    expect(closeTransport.connected).toBe(false);

    const destroyClient = new MockModbusSerialClient();
    const destroyTransport = createTransport(destroyClient);
    await destroyTransport.connect();
    await Promise.all([
      destroyTransport.destroy(),
      destroyTransport.destroy(),
      destroyTransport.destroy(),
    ]);
    await destroyTransport.destroy();
    expect(destroyClient.events.filter((event) => event.kind === "destroy")).toHaveLength(1);
    expect(destroyTransport.connected).toBe(false);
  });

  it("accepts the dependency's false close status during a client-level reconnect", async () => {
    const first = new MockModbusSerialClient();
    first.queueInput({
      kind: "error",
      error: { code: "ETIMEDOUT", message: "timeout at example.invalid:15020" },
    });
    const second = new MockModbusSerialClient();
    second.queueInput({ kind: "result", result: { data: [7] } });
    const clients = [first, second];
    const client = createInternalIdmModbusClient(
      "example.invalid",
      { port: 15_020, slaveId: 7, maxRetries: 2 },
      {
        transportFactory: (runtimeConfiguration) => {
          const boundary = clients.shift();
          if (boundary === undefined) {
            throw new Error("Mock modbus-serial client factory exhausted");
          }
          return createModbusSerialTransport(runtimeConfiguration, () => boundary);
        },
        now: () => 0,
        sleep: async () => undefined,
      },
    );

    await expect(client.probeRegister(1_000, 1, { maxRetries: 2 })).resolves.toEqual([7]);

    expect(first.events.filter((event) => event.kind === "close")).toHaveLength(1);
    expect(second.events.filter((event) => event.kind === "connect")).toHaveLength(1);
    expect(client.isConnected).toBe(true);
  });

  it("rejects the dependency's true close status as a transport failure", async () => {
    const client = new MockModbusSerialClient();
    client.closeError = true;
    const transport = createTransport(client);
    await transport.connect();

    await expect(transport.close()).rejects.toMatchObject({
      kind: NormalizedTransportFailureKind.DISCONNECTED,
      message: "Modbus close failed",
    });
  });

  it("normalizes callback lifecycle errors through the same closed boundary", async () => {
    const client = new MockModbusSerialClient();
    client.closeError = {
      code: "EPIPE",
      message: "close example.invalid:15020 failed",
    };
    const transport = createTransport(client);
    await transport.connect();

    await expect(transport.close()).rejects.toMatchObject({
      kind: NormalizedTransportFailureKind.SOCKET,
      message: "close <endpoint> failed",
    });
  });
});

describe("normal public client wiring", () => {
  it("selects the hidden real-adapter factory internally without public injection", async () => {
    const fakeTransport: ModbusTransport = {
      connected: false,
      connect: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
      destroy: vi.fn(async () => undefined),
      read: vi.fn(async () => []),
    };
    const factory = vi.fn(() => fakeTransport);
    vi.resetModules();
    vi.doMock("../../src/transport/modbus-serial-adapter.js", () => ({
      createModbusSerialTransport: factory,
    }));
    const clientModule = await import("../../src/client/idm-modbus-client.js");
    const client = new clientModule.IdmModbusClient("example.invalid", {
      port: 15_020,
      slaveId: 7,
      timeout: 12.5,
      maxRetries: 3,
      maxGroupSize: 40,
    });

    await client.connect();

    expect(factory).toHaveBeenCalledOnce();
    expect(factory).toHaveBeenCalledWith({
      host: "example.invalid",
      port: 15_020,
      unitId: 7,
      timeout: 12.5,
      adapterRetries: 0,
    });
    expect(fakeTransport.connect).toHaveBeenCalledOnce();
  });

  it("contains no public constructor injection or adapter/provider declaration", async () => {
    const clientPath = fileURLToPath(
      new URL("../../src/client/idm-modbus-client.ts", import.meta.url),
    );
    const clientSource = await readFile(clientPath, "utf8");
    const publicOptions = clientSource.slice(
      clientSource.indexOf("export interface IdmModbusClientOptions"),
      clientSource.indexOf("export interface ProbeRegisterOptions"),
    );

    expect(publicOptions).not.toMatch(
      /adapter|factory|transport|clock|sleep|modbus-serial|ModbusRTU/u,
    );
    expect(new IdmModbusClient("example.invalid").isConnected).toBe(false);
  });
});
