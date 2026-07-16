import { describe, expect, it } from "vitest";

import { ModbusCodec } from "../../src/codec.js";
import type { IdmModbusClient } from "../../src/client/index.js";
import { createInternalIdmModbusClient } from "../../src/client/internal-create.js";
import { groupRegisters } from "../../src/client/read-groups.js";
import { createRegisterDef, type RegisterDef } from "../../src/registers/definitions.js";
import {
  IllegalAddressError,
  NormalizedTransportFailure,
  NormalizedTransportFailureKind,
} from "../../src/transport/errors.js";
import type { ModbusReadRequest, ModbusTransport } from "../../src/transport/types.js";
import {
  DataType,
  RegisterType,
  type DataType as DataTypeValue,
  type RegisterType as RegisterTypeValue,
} from "../../src/types.js";
import { FakeClock } from "../support/fake-clock.js";
import { FakeModbusTransport } from "../support/fake-modbus-transport.js";

function register(
  name: string,
  address: number,
  datatype: DataTypeValue = DataType.UCHAR,
  registerType: RegisterTypeValue = RegisterType.INPUT,
): RegisterDef {
  return createRegisterDef({ address, datatype, name, registerType });
}

function names(groups: readonly (readonly RegisterDef[])[]): readonly (readonly string[])[] {
  return groups.map((group) => group.map((definition) => definition.name));
}

function createClient(
  transport: ModbusTransport,
  options: ConstructorParameters<typeof IdmModbusClient>[1] = { maxRetries: 1 },
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

class LooseScriptedTransport implements ModbusTransport {
  readonly #responses: readonly unknown[];
  readonly requests: ModbusReadRequest[] = [];
  #nextResponse = 0;
  #connected = false;

  public constructor(responses: readonly unknown[]) {
    this.#responses = [...responses];
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
    const response = this.#responses[this.#nextResponse];
    this.#nextResponse += 1;
    if (response instanceof Error) {
      throw response;
    }
    return response as readonly number[];
  }
}

describe("groupRegisters", () => {
  it("returns an immutable empty group list for empty input", () => {
    const groups = groupRegisters([], 40);

    expect(groups).toEqual([]);
    expect(Object.isFrozen(groups)).toBe(true);
  });

  it("stable-sorts by register type value and address", () => {
    const firstAtAddress = register("first_equal", 1_000);
    const secondAtAddress = register("second_equal", 1_000);
    const holding = register("holding_first", 2_000, DataType.UCHAR, RegisterType.HOLDING);

    expect(names(groupRegisters([secondAtAddress, firstAtAddress, holding], 40))).toEqual([
      ["holding_first"],
      ["second_equal"],
      ["first_equal"],
    ]);
  });

  it("groups only strict same-type adjacency", () => {
    const adjacent = [
      register("float", 1_000, DataType.FLOAT),
      register("uchar", 1_002),
      register("next", 1_003),
    ];

    expect(names(groupRegisters(adjacent, 40))).toEqual([["float", "uchar", "next"]]);
    expect(names(groupRegisters([register("left", 1_000), register("gap", 1_002)], 40))).toEqual([
      ["left"],
      ["gap"],
    ]);
    expect(
      names(
        groupRegisters(
          [
            register("input", 1_000),
            register("holding", 1_001, DataType.UCHAR, RegisterType.HOLDING),
          ],
          40,
        ),
      ),
    ).toEqual([["holding"], ["input"]]);
  });

  it("splits when the complete group span exceeds maxGroupSize", () => {
    expect(
      names(groupRegisters([register("a", 1_000), register("b", 1_001), register("c", 1_002)], 2)),
    ).toEqual([["a", "b"], ["c"]]);
  });

  it("keeps humidity 1392/2 and mode 1393/1 in separate overlap groups", () => {
    expect(
      names(
        groupRegisters(
          [register("humidity_sensor", 1_392, DataType.FLOAT), register("hc_a_mode", 1_393)],
          40,
        ),
      ),
    ).toEqual([["humidity_sensor"], ["hc_a_mode"]]);
  });

  it("keeps the official 1442 and 1484 overlaps in separate groups", () => {
    expect(
      names(
        groupRegisters(
          [
            register("hc_g_heating_curve", 1_441, DataType.FLOAT),
            register("hc_a_heating_limit", 1_442),
            register("hc_g_room_setpoint_cool_eco", 1_483, DataType.FLOAT),
            register("hc_a_cooling_limit", 1_484),
          ],
          40,
        ),
      ),
    ).toEqual([
      ["hc_g_heating_curve"],
      ["hc_a_heating_limit"],
      ["hc_g_room_setpoint_cool_eco"],
      ["hc_a_cooling_limit"],
    ]);
  });

  it("rejects a non-positive or non-integer maximum span", () => {
    expect(() => groupRegisters([register("a", 1_000)], 0)).toThrow(RangeError);
    expect(() => groupRegisters([register("a", 1_000)], 1.5)).toThrow(RangeError);
  });
});

describe("IdmModbusClient batch reads", () => {
  it("returns immutable empty results without traffic for empty or all-filtered input", async () => {
    const transport = new FakeModbusTransport([]);
    const client = createClient(transport);
    const writeOnly = createRegisterDef({
      address: 1_999,
      datatype: DataType.UCHAR,
      name: "batch_write_only",
      writable: true,
      writeOnly: true,
    });

    const empty = await client.readBatch([]);
    const filtered = await client.readBatch([writeOnly]);

    expect(empty).toEqual({});
    expect(filtered).toEqual({});
    expect(Object.isFrozen(empty)).toBe(true);
    expect(Object.isFrozen(filtered)).toBe(true);
    expect(transport.events).toEqual([]);
  });

  it("reads sorted adjacent candidates as one exact request", async () => {
    const transport = new FakeModbusTransport([{ kind: "words", words: [1, 2] }]);
    const client = createClient(transport);
    const first = register("batch_first", 1_000);
    const second = register("batch_second", 1_001);

    await expect(client.readBatch([second, first])).resolves.toEqual({
      batch_first: 1,
      batch_second: 2,
    });
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

  it("executes humidity 1392/2 and mode 1393/1 as separate exact requests", async () => {
    const humidityWords = ModbusCodec.encodeFloat32(54.75);
    const transport = new FakeModbusTransport([
      { kind: "words", words: humidityWords },
      { kind: "words", words: [2] },
    ]);
    const client = createClient(transport);
    const humidity = createRegisterDef({
      address: 1_392,
      datatype: DataType.FLOAT,
      name: "humidity_sensor",
      minVal: 0,
      maxVal: 100,
      sentinelValues: [-1],
    });
    const mode = createRegisterDef({
      address: 1_393,
      datatype: DataType.UCHAR,
      name: "hc_a_mode",
      enumOptions: { 0: "off", 2: "normal" },
    });

    await expect(client.readBatch([mode, humidity])).resolves.toEqual({
      humidity_sensor: 54.75,
      hc_a_mode: 2,
    });
    expect(
      readRequests(transport).map(({ functionCode, address, count }) => ({
        functionCode,
        address,
        count,
      })),
    ).toEqual([
      { functionCode: 4, address: 1_392, count: 2 },
      { functionCode: 4, address: 1_393, count: 1 },
    ]);
  });

  it("falls back in register order after an exhausted device-side group error", async () => {
    const transport = new FakeModbusTransport([
      {
        kind: "error",
        error: new NormalizedTransportFailure(
          NormalizedTransportFailureKind.MODBUS,
          "synthetic group failure",
        ),
      },
      { kind: "words", words: [7] },
      { kind: "words", words: [8] },
    ]);
    const client = createClient(transport);
    const first = register("fallback_first", 1_100);
    const second = register("fallback_second", 1_101);

    await expect(client.readBatch([first, second])).resolves.toEqual({
      fallback_first: 7,
      fallback_second: 8,
    });
    expect(readRequests(transport).map(({ address, count }) => ({ address, count }))).toEqual([
      { address: 1_100, count: 2 },
      { address: 1_100, count: 1 },
      { address: 1_101, count: 1 },
    ]);
  });

  it("falls back after an invalid group response and validates every individual result", async () => {
    const transport = new LooseScriptedTransport([[7], [7], [8]]);
    const client = createClient(transport);
    const first = register("invalid_group_first", 1_200);
    const second = register("invalid_group_second", 1_201);

    await expect(client.readBatch([first, second])).resolves.toEqual({
      invalid_group_first: 7,
      invalid_group_second: 8,
    });
    expect(transport.requests.map(({ address, count }) => ({ address, count }))).toEqual([
      { address: 1_200, count: 2 },
      { address: 1_200, count: 1 },
      { address: 1_201, count: 1 },
    ]);
  });

  it("isolates individual Code 2 and marks only that register unsupported and permanent", async () => {
    const transport = new FakeModbusTransport([
      { kind: "error", error: new IllegalAddressError("group unsupported") },
      { kind: "words", words: [7] },
      { kind: "error", error: new IllegalAddressError("register unsupported") },
    ]);
    const client = createClient(transport);
    const good = register("supported_register", 1_300);
    const missing = register("unsupported_register", 1_301);

    await expect(client.readBatch([good, missing])).resolves.toEqual({
      supported_register: 7,
    });
    expect(client.getUnsupportedRegisters()).toEqual(["unsupported_register"]);
    expect(client.getDiagnostics().permanentlyFailedRegisters).toEqual(["unsupported_register"]);
  });

  it("quarantines a suspect enum value and exposes only the validated individual reread", async () => {
    const transport = new FakeModbusTransport([
      { kind: "words", words: [255, 0] },
      { kind: "words", words: [1] },
    ]);
    const client = createClient(transport);
    const mode = createRegisterDef({
      address: 1_401,
      datatype: DataType.UCHAR,
      name: "suspect_mode",
      enumOptions: { 0: "off", 1: "on" },
    });
    const relay = register("suspect_relay", 1_402);

    await expect(client.readBatch([mode, relay])).resolves.toEqual({
      suspect_relay: 0,
      suspect_mode: 1,
    });
    expect(client.getBatchUnsafeRegisters()).toEqual(["suspect_mode"]);
    expect(readRequests(transport).map(({ address, count }) => ({ address, count }))).toEqual([
      { address: 1_401, count: 2 },
      { address: 1_401, count: 1 },
    ]);
  });

  it("omits a suspect value when the individual reread is still invalid", async () => {
    const invalidWords = ModbusCodec.encodeFloat32(188);
    const transport = new FakeModbusTransport([
      { kind: "words", words: invalidWords },
      { kind: "words", words: invalidWords },
    ]);
    const client = createClient(transport);
    const humidity = createRegisterDef({
      address: 1_500,
      datatype: DataType.FLOAT,
      name: "invalid_humidity",
      minVal: 0,
      maxVal: 100,
    });

    await expect(client.readBatch([humidity])).resolves.toEqual({});
    expect(client.getBatchUnsafeRegisters()).toEqual(["invalid_humidity"]);
  });

  it("accepts null, boolean, and declared sentinels without quarantine", async () => {
    const nanWords = ModbusCodec.encodeFloat32(Number.NaN);
    const transport = new FakeModbusTransport([{ kind: "words", words: [...nanWords, 1, 255] }]);
    const client = createClient(transport);
    const unavailableFloat = createRegisterDef({
      address: 1_600,
      datatype: DataType.FLOAT,
      name: "null_float",
      minVal: 0,
      maxVal: 100,
    });
    const flag = createRegisterDef({
      address: 1_602,
      datatype: DataType.BOOL,
      name: "boolean_flag",
      enumOptions: { 0: "off" },
    });
    const sentinel = createRegisterDef({
      address: 1_603,
      datatype: DataType.UCHAR,
      name: "declared_sentinel",
      maxVal: 100,
      sentinelValues: [255],
    });

    await expect(client.readBatch([unavailableFloat, flag, sentinel])).resolves.toEqual({
      null_float: null,
      boolean_flag: true,
      declared_sentinel: 255,
    });
    expect(client.getBatchUnsafeRegisters()).toEqual([]);
    expect(readRequests(transport)).toHaveLength(1);
  });

  it("reads pre-quarantined definitions after groups in original filtered-input order", async () => {
    const transport = new FakeModbusTransport([
      { kind: "words", words: [2] },
      { kind: "words", words: [3] },
      { kind: "words", words: [1] },
    ]);
    const client = createClient(transport);
    const firstUnsafe = register("pre_unsafe_first", 1_701);
    const grouped = register("pre_grouped", 1_702);
    const secondUnsafe = register("pre_unsafe_second", 1_703);
    client.markBatchUnsafe(firstUnsafe, secondUnsafe);

    await expect(client.readBatch([secondUnsafe, grouped, firstUnsafe])).resolves.toEqual({
      pre_grouped: 2,
      pre_unsafe_second: 3,
      pre_unsafe_first: 1,
    });
    expect(readRequests(transport).map(({ address }) => address)).toEqual([1_702, 1_703, 1_701]);
  });
});
