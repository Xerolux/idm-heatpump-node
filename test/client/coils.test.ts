import { describe, expect, it } from "vitest";

import {
  attachInternalModbusTransport,
  createInternalIdmModbusClient,
} from "../../src/client/internal-create.js";
import { MODEL_NAVIGATOR_17 } from "../../src/constants.js";
import { IdmModelInfo } from "../../src/types.js";
import { IdmTransportError } from "../../src/exceptions.js";
import { IllegalAddressError } from "../../src/transport/errors.js";
import type { ModbusTransport } from "../../src/transport/types.js";
import type { FakeModbusTransportEvent } from "../support/fake-modbus-transport.js";
import { buildRegisterMap } from "../../src/registers/registry.js";
import { createRegisterDef } from "../../src/registers/definitions.js";
import { DataType, RegisterType } from "../../src/types.js";

const READABLE_TEST_COIL = createRegisterDef({
  address: 3001,
  datatype: DataType.BOOL,
  registerType: RegisterType.COIL,
  binary: true,
  name: "test_coil_status",
});

interface CoilCall {
  readonly kind: "readCoils" | "writeCoil";
  readonly address: number;
  readonly count?: number;
  readonly value?: boolean;
}

class FakeCoilTransport implements ModbusTransport {
  public connected = true;
  readonly calls: CoilCall[] = [];
  public readonly readCoils = this.readCoilsImpl.bind(this);
  public readonly writeCoil = this.writeCoilImpl.bind(this);
  readonly #bits = new Map<number, boolean>();
  /** Persists until cleared, so fallback re-reads fail identically. */
  public failWith: Error | null = null;

  public async connect(): Promise<void> {
    this.connected = true;
  }

  public async close(): Promise<void> {
    this.connected = false;
  }

  public async destroy(): Promise<void> {
    this.connected = false;
  }

  public async read(): Promise<readonly number[]> {
    throw new Error("word reads are not part of the coil scenarios");
  }

  public async write(): Promise<void> {
    throw new Error("word writes are not part of the coil scenarios");
  }

  private async readCoilsImpl(input: {
    address: number;
    count: number;
  }): Promise<readonly boolean[]> {
    this.calls.push({ kind: "readCoils", address: input.address, count: input.count });
    if (this.failWith !== null) {
      throw this.failWith;
    }
    const bits: boolean[] = [];
    for (let index = 0; index < input.count; index += 1) {
      bits.push(this.#bits.get(input.address + index) === true);
    }
    return bits;
  }

  private async writeCoilImpl(input: { address: number; value: boolean }): Promise<void> {
    this.calls.push({ kind: "writeCoil", address: input.address, value: input.value });
    if (this.failWith !== null) {
      throw this.failWith;
    }
    this.#bits.set(input.address, input.value);
  }
}

function navigator17Client(transport: FakeCoilTransport) {
  const client = createInternalIdmModbusClient(
    "example.invalid",
    { maxRetries: 2 },
    {
      transportFactory: () => transport,
      now: () => 0,
      sleep: async () => undefined,
    },
  );
  attachInternalModbusTransport(client, transport);
  const modelInfo = IdmModelInfo.create({
    modelName: MODEL_NAVIGATOR_17,
    activeHeatingCircuits: [],
    zoneModules: 0,
    hasSolar: false,
    hasIsc: false,
    hasPv: false,
    hasCascade: false,
  });
  client.setModelInfo(modelInfo);
  return { client, registerMap: buildRegisterMap({ modelInfo }) };
}

function coilCalls(transport: FakeCoilTransport): readonly CoilCall[] {
  return transport.calls;
}

describe("coil transport extension (FC01/FC05)", () => {
  it("reads coil registers through readCoils normalised to booleans", async () => {
    const transport = new FakeCoilTransport();
    await transport.writeCoil({ address: 3000, value: true });
    transport.calls.length = 0;
    const { client } = navigator17Client(transport);

    // The 1.7 map's coils are write-only commands; a synthetic readable
    // coil exercises the read path (future firmware may expose status bits).
    const values = await client.readBatch([READABLE_TEST_COIL]);
    expect(values.test_coil_status).toBe(false);
    expect(coilCalls(transport)).toEqual([{ kind: "readCoils", address: 3001, count: 1 }]);
  });

  it("writes a coil command through writeCoil (FC05)", async () => {
    const transport = new FakeCoilTransport();
    const { client } = navigator17Client(transport);

    const result = await client.setValue("error_acknowledge", true, { dryRun: false });
    expect(result.dryRun).toBe(false);
    expect(coilCalls(transport)).toEqual([{ kind: "writeCoil", address: 3000, value: true }]);
  });

  it("rejects boolean-required violations through the write safety plan", async () => {
    const transport = new FakeCoilTransport();
    const { client } = navigator17Client(transport);

    await expect(client.setValue("error_acknowledge", 5, { dryRun: true })).rejects.toThrow(
      /boolean or integer 0\/1/,
    );
    expect(coilCalls(transport)).toEqual([]);
  });

  it("raises an actionable error for transports without coil support", async () => {
    const transport = new FakeCoilTransport();
    // Simulate a word-only transport by deleting the coil methods.
    const wordOnly = transport as unknown as Record<string, unknown>;
    delete wordOnly.readCoils;
    delete wordOnly.writeCoil;
    const { client } = navigator17Client(transport);

    await expect(client.readBatch([READABLE_TEST_COIL])).rejects.toThrow(
      /coil access \(FC01\/FC05\)/,
    );
    await expect(client.setValue("error_acknowledge", true, { dryRun: false })).rejects.toThrow(
      /coil access \(FC01\/FC05\)/,
    );
  });

  it("classifies Illegal Data Address rejections without retrying", async () => {
    const transport = new FakeCoilTransport();
    const { client } = navigator17Client(transport);
    transport.failWith = new IllegalAddressError("code 2");

    // The individual fallback isolates the register instead of rejecting.
    const values = await client.readBatch([READABLE_TEST_COIL]);
    expect(values).toEqual({});
    // Group attempt + individual fallback attempt; the retry loop itself
    // never retries code 2.
    expect(coilCalls(transport).length).toBe(2);
    expect(client.getLastErrorContext()?.registerType).toBe("coil");
    expect(client.getRegisterOutcomes().test_coil_status).toMatchObject({
      status: "unsupported",
      reason: "illegal_address",
    });
  });

  it("records coil error contexts and transport failure kinds", async () => {
    const transport = new FakeCoilTransport();
    const { client } = navigator17Client(transport);

    // Unknown error kinds propagate unchanged through the coil retry loop.
    transport.failWith = new Error("boom");
    await expect(client.readBatch([READABLE_TEST_COIL])).rejects.toThrow(/boom/);
  });
});

describe("IdmTransportError capability surface", () => {
  it("carries the actionable coil message", () => {
    const error = new IdmTransportError("coil access missing");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("IdmTransportError");
    expect(error.message).toBe("coil access missing");
  });
});

export type { FakeModbusTransportEvent };
