import { describe, expect, it } from "vitest";

import type { IdmModbusClient } from "../../src/client/index.js";
import { createInternalIdmModbusClient } from "../../src/client/internal-create.js";
import { createRegisterDef, type RegisterDef } from "../../src/registers/definitions.js";
import { IllegalAddressError, NormalizedTransportFailureKind } from "../../src/transport/errors.js";
import type {
  ModbusReadRequest,
  ModbusTransport,
  ModbusWriteRequest,
} from "../../src/transport/types.js";
import { DataType, RegisterType } from "../../src/types.js";
import { FakeClock } from "../support/fake-clock.js";
import { FakeModbusTransport } from "../support/fake-modbus-transport.js";

function createClient(
  transport: ModbusTransport,
  options: ConstructorParameters<typeof IdmModbusClient>[1] = {},
): IdmModbusClient {
  const clock = new FakeClock();
  return createInternalIdmModbusClient("example.invalid", options, {
    transportFactory: () => transport,
    now: () => clock.now(),
    sleep: (seconds) => clock.sleep(seconds),
  });
}

function readRequests(transport: FakeModbusTransport): readonly ModbusReadRequest[] {
  return transport.events.flatMap((event) => (event.kind === "read" ? [event.request] : []));
}

class LooseResponseTransport implements ModbusTransport {
  readonly #response: unknown;
  readonly requests: ModbusReadRequest[] = [];
  #connected = false;

  public constructor(response: unknown) {
    this.#response = response;
  }

  public get connected(): boolean {
    return this.#connected;
  }

  public async connect(): Promise<void> {
    this.#connected = true;
  }

  public async close(): Promise<void> {
    this.#connected = false;
  }

  public async destroy(): Promise<void> {
    this.#connected = false;
  }

  public async read(request: ModbusReadRequest): Promise<readonly number[]> {
    this.requests.push(request);
    return this.#response as readonly number[];
  }

  public async write(request: ModbusWriteRequest): Promise<void> {
    void request;
    throw new Error("LooseResponseTransport does not provide writes");
  }
}

describe("IdmModbusClient single reads", () => {
  it("delegates register-aware decode and encode to the Phase-1 codec", () => {
    const client = createClient(new FakeModbusTransport([]));
    const register = createRegisterDef({
      address: 1_000,
      datatype: DataType.FLOAT,
      name: "single_codec",
    });

    expect(client.decodeValue([0, 16_812], register)).toBe(21.5);
    const encoded = client.encodeValue(21.5, register);
    expect(encoded).toEqual([0, 16_812]);
    expect(Object.isFrozen(encoded)).toBe(true);
  });

  it("emits exact FC04 identity and decodes an input register", async () => {
    const transport = new FakeModbusTransport([{ kind: "words", words: [0, 16_812] }]);
    const client = createClient(transport);
    const register = createRegisterDef({
      address: 1_000,
      datatype: DataType.FLOAT,
      name: "single_input",
    });

    await expect(client.readRegister(register)).resolves.toBe(21.5);
    expect(readRequests(transport)).toEqual([
      {
        unitId: 1,
        registerType: RegisterType.INPUT,
        functionCode: 4,
        address: 1_000,
        count: 2,
      },
    ]);
  });

  it("emits exact FC03 identity and decodes a holding register", async () => {
    const transport = new FakeModbusTransport([{ kind: "words", words: [3] }]);
    const client = createClient(transport);
    const register = createRegisterDef({
      address: 1_200,
      datatype: DataType.UCHAR,
      name: "single_holding",
      registerType: RegisterType.HOLDING,
    });

    await expect(client.readRegister(register)).resolves.toBe(3);
    expect(readRequests(transport)).toEqual([
      {
        unitId: 1,
        registerType: RegisterType.HOLDING,
        functionCode: 3,
        address: 1_200,
        count: 1,
      },
    ]);
  });

  it("rejects write-only registers before connecting or reading", async () => {
    const transport = new FakeModbusTransport([]);
    const client = createClient(transport);
    const register = createRegisterDef({
      address: 1_999,
      datatype: DataType.UCHAR,
      name: "single_write_only",
      writable: true,
      writeOnly: true,
    });

    await expect(client.readRegister(register)).rejects.toThrow(
      "Register 'single_write_only' is write-only",
    );
    expect(transport.events).toEqual([]);
  });

  for (const [label, response] of [
    ["short", [1]],
    ["long", [1, 2, 3]],
    ["non-word", [1, 70_000]],
  ] as const) {
    it(`rejects a ${label} response before decoding`, async () => {
      const transport = new LooseResponseTransport(response);
      const client = createClient(transport, { maxRetries: 1 });
      const invalidDatatype = {
        ...createRegisterDef({
          address: 1_300,
          datatype: DataType.FLOAT,
          name: `single_${label}`,
        }),
        datatype: "NOT_A_DATATYPE",
      } as unknown as RegisterDef;

      await expect(client.readRegister(invalidDatatype)).rejects.toMatchObject({
        kind: NormalizedTransportFailureKind.INVALID_RESPONSE,
      });
      expect(transport.requests).toHaveLength(1);
      expect(client.getLastErrorContext()).toMatchObject({
        address: 1_300,
        count: 2,
        errorType: NormalizedTransportFailureKind.INVALID_RESPONSE,
      });
    });
  }

  it("surfaces decoder failures only after a valid exact response", async () => {
    const transport = new FakeModbusTransport([{ kind: "words", words: [1] }]);
    const client = createClient(transport);
    const invalidDatatype = {
      ...createRegisterDef({
        address: 1_301,
        datatype: DataType.UCHAR,
        name: "single_decode_failure",
      }),
      datatype: "NOT_A_DATATYPE",
    } as unknown as RegisterDef;

    await expect(client.readRegister(invalidDatatype)).rejects.toThrow(
      "Unsupported datatype for decoding",
    );
    expect(readRequests(transport)).toHaveLength(1);
  });

  it("resolves canonical registry names without changing request identity", async () => {
    const transport = new FakeModbusTransport([{ kind: "words", words: [0, 16_812] }]);
    const client = createClient(transport);

    await expect(client.readValue("outdoor_temp")).resolves.toBe(21.5);
    expect(readRequests(transport)).toEqual([
      {
        unitId: 1,
        registerType: RegisterType.INPUT,
        functionCode: 4,
        address: 1_000,
        count: 2,
      },
    ]);
    await expect(client.readValue("missing_register")).rejects.toThrow(
      "Register 'missing_register' not found.",
    );
  });

  it("leaves fallback state unchanged after a direct Code-2 failure", async () => {
    const transport = new FakeModbusTransport([
      { kind: "error", error: new IllegalAddressError("single missing") },
    ]);
    const client = createClient(transport, { maxRetries: 3 });
    const register = createRegisterDef({
      address: 1_400,
      datatype: DataType.UCHAR,
      name: "single_code_2",
    });

    await expect(client.readRegister(register)).rejects.toBeInstanceOf(IllegalAddressError);
    expect(readRequests(transport)).toHaveLength(1);
    expect(client.getDiagnostics()).toMatchObject({
      permanentlyFailedRegisters: [],
      batchUnsafeRegisters: [],
    });
  });
});
