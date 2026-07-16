import { describe, expect, it } from "vitest";

import {
  attachInternalModbusTransport,
  createInternalIdmModbusClient,
  seedInternalReadState,
} from "../../src/client/internal-create.js";
import {
  FEATURE_CASCADE,
  FEATURE_HEATING_CIRCUITS,
  FEATURE_ISC,
  FEATURE_PV,
  FEATURE_SOLAR,
  FEATURE_ZONE_MODULES,
  MODEL_NAVIGATOR_10,
  MODEL_NAVIGATOR_20,
  MODEL_NAVIGATOR_PRO,
  MODEL_UNKNOWN,
} from "../../src/constants.js";
import { buildRegisterMap } from "../../src/registers/registry.js";
import { IllegalAddressError } from "../../src/transport/errors.js";
import type { ModbusReadRequest } from "../../src/transport/types.js";
import { ModbusCodec } from "../../src/codec.js";
import {
  FakeModbusTransport,
  type FakeModbusResponse,
  type FakeModbusTransportEvent,
} from "../support/fake-modbus-transport.js";

function words(values: readonly number[]): FakeModbusResponse {
  return Object.freeze({ kind: "words", words: Object.freeze([...values]) });
}

function missing(address: number): FakeModbusResponse {
  return Object.freeze({
    kind: "error",
    error: new IllegalAddressError(
      `Modbus Error: Illegal Data Address reading address ${String(address)}: ExceptionResponse(exception_code=2)`,
    ),
  });
}

function readRequests(events: readonly FakeModbusTransportEvent[]): readonly ModbusReadRequest[] {
  return events.flatMap((event) => (event.kind === "read" ? [event.request] : []));
}

function expectedProbe(address: number, count: number): ModbusReadRequest {
  return Object.freeze({
    unitId: 1,
    registerType: "input",
    functionCode: 4,
    address,
    count,
    timeoutMs: 2_000,
  });
}

function clientWithResponses(responses: readonly FakeModbusResponse[]) {
  const transport = new FakeModbusTransport(responses, { initiallyConnected: true });
  const client = createInternalIdmModbusClient(
    "example.invalid",
    { maxRetries: 3 },
    {
      transportFactory: () => transport,
      now: () => 0,
      sleep: async () => undefined,
    },
  );
  attachInternalModbusTransport(client, transport);
  return { client, transport };
}

function featureNames(features: ReadonlySet<string>): readonly string[] {
  return Object.freeze([...features].sort());
}

describe("ordered IDM model detection", () => {
  it("uses one two-second attempt in exact order and preserves read-failure state", async () => {
    const responses = [
      missing(1_350),
      missing(1_352),
      missing(2_000),
      missing(2_065),
      missing(1_850),
      missing(1_870),
      missing(74),
      missing(1_147),
      missing(4_108),
      missing(4_120),
    ];
    const { client, transport } = clientWithResponses(responses);
    seedInternalReadState(client, {
      unsupportedRegisters: ["unsupported-before-detection"],
      permanentlyFailedRegisters: ["permanent-before-detection"],
      batchUnsafeRegisters: ["batch-unsafe-before-detection"],
      transientFailures: { "transient-before-detection": 2 },
    });

    const info = await client.detectModel();

    expect(info).toMatchObject({
      modelName: MODEL_UNKNOWN,
      activeHeatingCircuits: [],
      zoneModules: 0,
      hasSolar: false,
      hasIsc: false,
      hasPv: false,
      hasCascade: false,
      firmwareVersion: null,
      isPro: false,
    });
    expect(Object.isFrozen(info)).toBe(true);
    expect(Object.isFrozen(info.activeHeatingCircuits)).toBe(true);
    expect(featureNames(info.features)).toEqual([]);
    expect(client.modelName).toBe(MODEL_NAVIGATOR_20);
    expect(readRequests(transport.events)).toEqual([
      expectedProbe(1_350, 2),
      expectedProbe(1_352, 2),
      expectedProbe(2_000, 1),
      expectedProbe(2_065, 1),
      expectedProbe(1_850, 2),
      expectedProbe(1_870, 2),
      expectedProbe(74, 2),
      expectedProbe(1_147, 1),
      expectedProbe(4_108, 2),
      expectedProbe(4_120, 2),
    ]);
    expect(client.getUnsupportedRegisters()).toEqual(["unsupported-before-detection"]);
    expect(client.getBatchUnsafeRegisters()).toEqual(["batch-unsafe-before-detection"]);
    expect(client.getDiagnostics().permanentlyFailedRegisters).toEqual([
      "permanent-before-detection",
    ]);
    transport.assertResponsesConsumed();
  });

  it("detects Navigator 10 with every capability, firmware, and exact model map", async () => {
    const responses = [
      words(ModbusCodec.encodeFloat32(25)),
      missing(1_352),
      missing(1_354),
      words([1]),
      missing(2_065),
      missing(2_130),
      words(ModbusCodec.encodeFloat32(10)),
      words(ModbusCodec.encodeFloat32(11)),
      words(ModbusCodec.encodeFloat32(12)),
      words([0]),
      words(ModbusCodec.encodeFloat32(100)),
      words(ModbusCodec.encodeFloat32(7.445)),
    ];
    const { client, transport } = clientWithResponses(responses);

    const info = await client.detectModel();
    const map = buildRegisterMap({ modelInfo: info });

    expect(info).toMatchObject({
      modelName: MODEL_NAVIGATOR_10,
      activeHeatingCircuits: ["A"],
      zoneModules: 1,
      hasSolar: true,
      hasIsc: true,
      hasPv: true,
      hasCascade: true,
      firmwareVersion: 7.45,
      isPro: true,
    });
    expect(featureNames(info.features)).toEqual([
      FEATURE_CASCADE,
      FEATURE_HEATING_CIRCUITS,
      FEATURE_ISC,
      FEATURE_PV,
      FEATURE_SOLAR,
      FEATURE_ZONE_MODULES,
    ]);
    expect(client.modelInfo).toBe(info);
    expect(client.modelName).toBe(MODEL_NAVIGATOR_10);
    expect(map.size).toBe(203);
    expect(map.has("power_limit_hp")).toBe(true);
    expect(map.has("hc_a_flow_temp")).toBe(true);
    expect(map.has("zm1_room1_temp")).toBe(true);
    expect(map.has("solar_collector_temp")).toBe(true);
    expect(map.has("isc_mode")).toBe(true);
    expect(map.has("pv_production")).toBe(true);
    expect(map.has("cascade_req_heating_temp")).toBe(true);
    expect(
      [...map].some(
        ([name, register]) => name === "humidity_sensor" && register.address === 1_046,
      ),
    ).toBe(false);
    expect([...map.keys()].some((name) => /navigator.?1/iu.test(name))).toBe(false);
    expect(readRequests(transport.events)).toEqual([
      expectedProbe(1_350, 2),
      expectedProbe(1_352, 2),
      expectedProbe(1_354, 2),
      expectedProbe(2_000, 1),
      expectedProbe(2_065, 1),
      expectedProbe(2_130, 1),
      expectedProbe(1_850, 2),
      expectedProbe(1_870, 2),
      expectedProbe(74, 2),
      expectedProbe(1_147, 1),
      expectedProbe(4_108, 2),
      expectedProbe(4_120, 2),
    ]);
    transport.assertResponsesConsumed();
  });

  it("treats exact undecodable/out-of-range circuit pairs as active and -1 as missing", async () => {
    const responses = [
      words([0, 32_704]),
      words(ModbusCodec.encodeFloat32(123.5)),
      words(ModbusCodec.encodeFloat32(-1)),
      words(ModbusCodec.encodeFloat32(-1)),
      missing(2_000),
      missing(2_065),
      words([0, 32_704]),
      words([0, 32_704]),
      words([0, 0]),
      words([0xffff]),
      missing(4_108),
    ];
    const { client, transport } = clientWithResponses(responses);

    const info = await client.detectModel({ readFirmware: false });

    expect(info).toMatchObject({
      modelName: MODEL_NAVIGATOR_20,
      activeHeatingCircuits: ["A", "B"],
      zoneModules: 0,
      hasSolar: true,
      hasIsc: true,
      hasPv: true,
      hasCascade: false,
      firmwareVersion: null,
    });
    expect(featureNames(info.features)).toEqual([
      FEATURE_HEATING_CIRCUITS,
      FEATURE_ISC,
      FEATURE_PV,
      FEATURE_SOLAR,
    ]);
    const requests = readRequests(transport.events);
    expect(requests.map(({ address }) => address)).toEqual([
      1_350, 1_352, 1_354, 1_356, 2_000, 2_065, 1_850, 1_870, 74, 1_147, 4_108,
    ]);
    expect(requests.some(({ address }) => address === 1_358)).toBe(false);
    expect(requests.some(({ address }) => address === 4_120)).toBe(false);
    transport.assertResponsesConsumed();
  });

  it("gives zone evidence Navigator Pro priority over heating-circuit evidence", async () => {
    const responses = [
      words(ModbusCodec.encodeFloat32(25)),
      missing(1_352),
      missing(1_354),
      words([1]),
      missing(2_065),
      missing(2_130),
      missing(1_850),
      missing(1_870),
      missing(74),
      words([0]),
      missing(4_108),
    ];
    const { client, transport } = clientWithResponses(responses);

    const info = await client.detectModel({ readFirmware: false });

    expect(info.modelName).toBe(MODEL_NAVIGATOR_PRO);
    expect(info.activeHeatingCircuits).toEqual(["A"]);
    expect(info.zoneModules).toBe(1);
    expect(info.hasCascade).toBe(true);
    expect(client.modelName).toBe(MODEL_NAVIGATOR_PRO);
    transport.assertResponsesConsumed();
  });

  it("returns null for non-finite firmware and emits no firmware request when disabled", async () => {
    const invalidFirmware = [
      missing(1_350),
      missing(1_352),
      missing(2_000),
      missing(2_065),
      missing(1_850),
      missing(1_870),
      missing(74),
      missing(1_147),
      missing(4_108),
      words([0, 32_704]),
    ];
    const first = clientWithResponses(invalidFirmware);

    await expect(first.client.detectModel()).resolves.toMatchObject({ firmwareVersion: null });
    expect(readRequests(first.transport.events).at(-1)).toEqual(expectedProbe(4_120, 2));
    first.transport.assertResponsesConsumed();

    const disabledFirmware = clientWithResponses(invalidFirmware.slice(0, -1));
    await expect(
      disabledFirmware.client.detectModel({ readFirmware: false }),
    ).resolves.toMatchObject({ firmwareVersion: null });
    expect(readRequests(disabledFirmware.transport.events).some(({ address }) => address === 4_120))
      .toBe(false);
    disabledFirmware.transport.assertResponsesConsumed();
  });
});
