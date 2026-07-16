import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { IdmModbusClient } from "../../src/client/index.js";
import { createInternalIdmModbusClient } from "../../src/client/internal-create.js";
import type {
  ModbusReadRequest,
  ModbusTransport,
  ModbusTransportFactoryConfiguration,
} from "../../src/transport/types.js";
import { RegisterType } from "../../src/types.js";

interface ActivityTracker {
  active: number;
  maxActive: number;
  readonly events: string[];
}

class LifecycleTransport implements ModbusTransport {
  readonly #id: number;
  readonly #tracker: ActivityTracker;
  readonly #connectError: Error | undefined;
  #connected = false;

  public constructor(id: number, tracker: ActivityTracker, connectError?: Error) {
    this.#id = id;
    this.#tracker = tracker;
    this.#connectError = connectError;
  }

  public get connected(): boolean {
    return this.#connected;
  }

  public async connect(): Promise<void> {
    await this.#record("connect");
    if (this.#connectError !== undefined) {
      throw this.#connectError;
    }
    this.#connected = true;
  }

  public async close(): Promise<void> {
    await this.#record("close");
    this.#connected = false;
  }

  public async destroy(): Promise<void> {
    await this.#record("destroy");
    this.#connected = false;
  }

  public async read(_request: ModbusReadRequest): Promise<readonly number[]> {
    throw new Error("LifecycleTransport does not provide reads");
  }

  async #record(operation: string): Promise<void> {
    this.#tracker.active += 1;
    this.#tracker.maxActive = Math.max(this.#tracker.maxActive, this.#tracker.active);
    try {
      await Promise.resolve();
      this.#tracker.events.push(`${String(this.#id)}:${operation}`);
    } finally {
      this.#tracker.active -= 1;
    }
  }
}

function createTracker(): ActivityTracker {
  return { active: 0, maxActive: 0, events: [] };
}

function createClient(
  transportFactory: (
    configuration: ModbusTransportFactoryConfiguration,
  ) => ModbusTransport,
  options: ConstructorParameters<typeof IdmModbusClient>[1] = {},
): IdmModbusClient {
  return createInternalIdmModbusClient("example.invalid", options, {
    transportFactory,
    now: () => 0,
    sleep: async () => undefined,
  });
}

describe("IdmModbusClient constructor and lifecycle", () => {
  it("keeps the exact mapped defaults and internalizes adapter retries at zero", async () => {
    const tracker = createTracker();
    const configurations: ModbusTransportFactoryConfiguration[] = [];
    const client = createClient((configuration) => {
      configurations.push(configuration);
      return new LifecycleTransport(1, tracker);
    });

    expect(client.host).toBe("example.invalid");
    expect(client.port).toBe(502);
    expect(client.isConnected).toBe(false);
    expect(client.modelInfo).toBeNull();
    expect(client.modelName).toBe("Navigator 2.0");

    await client.connect();

    expect(configurations).toEqual([
      {
        host: "example.invalid",
        port: 502,
        unitId: 1,
        timeout: 10,
        adapterRetries: 0,
      },
    ]);
    expect(Object.isFrozen(configurations[0])).toBe(true);
    expect(client.isConnected).toBe(true);
  });

  it("accepts the five mapped camelCase options and preserves Python's timeout number domain", async () => {
    for (const timeout of [-1, -0, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
      const configurations: ModbusTransportFactoryConfiguration[] = [];
      const client = createClient(
        (configuration) => {
          configurations.push(configuration);
          return new LifecycleTransport(1, createTracker());
        },
        {
          port: 15_020,
          slaveId: 247,
          timeout,
          maxRetries: 7,
          maxGroupSize: 125,
        },
      );

      await client.connect();

      expect(configurations).toHaveLength(1);
      expect(configurations[0]).toMatchObject({
        port: 15_020,
        unitId: 247,
        maxRetries: undefined,
        adapterRetries: 0,
      });
      expect(Object.is(configurations[0]?.timeout, timeout)).toBe(true);
    }
  });

  it("rejects invalid mapped configuration before creating a transport", () => {
    const invalidCases: readonly [
      string,
      ConstructorParameters<typeof IdmModbusClient>[1],
    ][] = [
      ["", {}],
      ["example.invalid", { port: 0 }],
      ["example.invalid", { port: 65_536 }],
      ["example.invalid", { port: 1.5 }],
      ["example.invalid", { slaveId: 0 }],
      ["example.invalid", { slaveId: 248 }],
      ["example.invalid", { maxRetries: 0 }],
      ["example.invalid", { maxRetries: 1.5 }],
      ["example.invalid", { maxGroupSize: 0 }],
      ["example.invalid", { maxGroupSize: 1.5 }],
    ];

    for (const [host, options] of invalidCases) {
      let creations = 0;
      expect(() =>
        createInternalIdmModbusClient(host, options, {
          transportFactory: () => {
            creations += 1;
            return new LifecycleTransport(1, createTracker());
          },
          now: () => 0,
          sleep: async () => undefined,
        }),
      ).toThrow();
      expect(creations).toBe(0);
    }
  });

  it("reuses healthy state, disconnects only the connection, and force-reconnects freshly", async () => {
    const tracker = createTracker();
    let creations = 0;
    const client = createClient(() => {
      creations += 1;
      return new LifecycleTransport(creations, tracker);
    });

    await client.connect();
    await client.connect();
    expect(creations).toBe(1);

    await client.disconnect();
    expect(client.isConnected).toBe(false);
    expect(client.modelInfo).toBeNull();
    expect(client.modelName).toBe("Navigator 2.0");

    await client.forceReconnect();
    expect(creations).toBe(2);
    expect(client.isConnected).toBe(true);

    await client.forceReconnect();
    expect(creations).toBe(3);
    expect(client.isConnected).toBe(true);
    expect(tracker.events).toEqual([
      "1:connect",
      "1:close",
      "2:connect",
      "2:close",
      "3:connect",
    ]);
  });

  it("discards a failed connection and releases the FIFO for the next operation", async () => {
    const tracker = createTracker();
    let creations = 0;
    const client = createClient(() => {
      creations += 1;
      return new LifecycleTransport(
        creations,
        tracker,
        creations === 1 ? new Error("synthetic connect failure") : undefined,
      );
    });

    const first = client.connect();
    const second = client.connect();

    await expect(first).rejects.toThrow("synthetic connect failure");
    await expect(second).resolves.toBeUndefined();
    expect(creations).toBe(2);
    expect(client.isConnected).toBe(true);
    expect(tracker.maxActive).toBe(1);
  });

  it("serializes 21 mixed lifecycle operations in FIFO completion order", async () => {
    const tracker = createTracker();
    let creations = 0;
    const client = createClient(() => {
      creations += 1;
      return new LifecycleTransport(creations, tracker);
    });
    const completionOrder: number[] = [];
    const operations: Promise<void>[] = [];

    for (let index = 0; index < 21; index += 1) {
      const operation =
        index % 3 === 0
          ? client.connect()
          : index % 3 === 1
            ? client.forceReconnect()
            : client.disconnect();
      operations.push(
        operation.then(() => {
          completionOrder.push(index);
        }),
      );
    }

    await Promise.all(operations);

    expect(completionOrder).toEqual(Array.from({ length: 21 }, (_, index) => index));
    expect(tracker.maxActive).toBe(1);
    expect(client.isConnected).toBe(false);
  });
});

describe("internal dependency seam and public closure", () => {
  it("keeps dependencies and internal creation out of both package barrels", async () => {
    const clientBarrelPath = fileURLToPath(new URL("../../src/client/index.ts", import.meta.url));
    const rootBarrelPath = fileURLToPath(new URL("../../src/index.ts", import.meta.url));
    const [clientBarrel, rootBarrel] = await Promise.all([
      readFile(clientBarrelPath, "utf8"),
      readFile(rootBarrelPath, "utf8"),
    ]);

    expect(clientBarrel).toContain("IdmModbusClient");
    expect(clientBarrel).not.toMatch(
      /InternalClientDependencies|createInternalIdmModbusClient|transportFactory|clock|sleep|token|pymodbusRetries/u,
    );
    expect(rootBarrel).not.toMatch(
      /IdmModbusClient|InternalClientDependencies|createInternalIdmModbusClient|transportFactory|clock|sleep|token|pymodbusRetries/u,
    );
  });

  it("keeps the public constructor type closed to mapped options", () => {
    const client = new IdmModbusClient("example.invalid", {
      port: 502,
      slaveId: 1,
      timeout: 10,
      maxRetries: 3,
      maxGroupSize: 40,
    });

    if (false) {
      // @ts-expect-error transportFactory is an internal direct-path concern.
      new IdmModbusClient("example.invalid", { transportFactory: () => undefined });
      // @ts-expect-error clock is an internal direct-path concern.
      new IdmModbusClient("example.invalid", { clock: () => 0 });
      // @ts-expect-error sleep is an internal direct-path concern.
      new IdmModbusClient("example.invalid", { sleep: async () => undefined });
      // @ts-expect-error pymodbusRetries is fixed internally to zero.
      new IdmModbusClient("example.invalid", { pymodbusRetries: 1 });
      // @ts-expect-error no third constructor argument is public.
      new IdmModbusClient("example.invalid", {}, Symbol("internal"));
    }

    expect(client.isConnected).toBe(false);
    expect(RegisterType.INPUT).toBe("input");
  });
});
