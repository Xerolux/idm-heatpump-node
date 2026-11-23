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
import {
  createNormalizedTransportFailure,
  IllegalAddressError,
  NormalizedTransportFailureKind,
} from "../../src/transport/errors.js";
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
      `Illegal Data Address reading address ${String(address)}: ExceptionResponse(exception_code=2)`,
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

/**
 * Python 2.14.5 detection request shape: the first slot of each signal is
 * probed individually; when it answers, one adjacent batch per signal
 * (1350-1363 / 1498-1504) fetches the remaining slots. `flowFirst` and
 * `modeFirst` provide the gate answers; `flowRest`/`modeRest` provide the
 * words the batch serves for slots 1-6 (slot 0 repeats its gate answer).
 */
function heatingSignals(
  flowFirst: readonly number[],
  flowRest: readonly number[],
  modeFirst: readonly number[],
  modeRest: readonly number[],
): readonly FakeModbusResponse[] {
  const flowBatch = [...flowFirst, ...flowRest].slice(0, 14);
  const modeBatch = [...modeFirst, ...modeRest].slice(0, 7);
  return [words(flowFirst), words(flowBatch), words(modeFirst), words(modeBatch)];
}

/** All heating-circuit probes rejected: gates fail, seven individual slots each. */
function heatingAllMissing(): readonly FakeModbusResponse[] {
  return [
    missing(1_350),
    ...Array.from({ length: 7 }, (_, index) => missing(1_350 + index * 2)),
    missing(1_498),
    ...Array.from({ length: 7 }, (_, index) => missing(1_498 + index)),
  ];
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
  it("rejects a model even when a later probe succeeds after an unanswered probe", async () => {
    const timeout = createNormalizedTransportFailure(
      NormalizedTransportFailureKind.TIMEOUT,
      "probe timed out",
    );
    const { client } = clientWithResponses([
      ...heatingAllMissing(),
      missing(2_000),
      missing(2_065),
      missing(1_850),
      missing(1_870),
      { kind: "error", error: timeout },
      words([0]),
      missing(4_108),
      missing(4_001),
      missing(4_122),
      missing(1_000),
      words(ModbusCodec.encodeFloat32(20.23)),
    ]);

    await expect(client.detectModel()).rejects.toThrow("Connection lost during model detection");
    expect(client.modelInfo).toBeNull();
  });
  it("uses one two-second attempt in exact order and preserves read-failure state", async () => {
    const responses = [
      ...heatingAllMissing(),
      missing(2_000),
      missing(2_065),
      missing(1_850),
      missing(1_870),
      missing(74),
      missing(1_147),
      missing(4_108),
      missing(4_001),
      missing(4_122),
      missing(1_000),
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
      ...Array.from({ length: 7 }, (_, index) => expectedProbe(1_350 + index * 2, 2)),
      expectedProbe(1_498, 1),
      ...Array.from({ length: 7 }, (_, index) => expectedProbe(1_498 + index, 1)),
      expectedProbe(2_000, 1),
      expectedProbe(2_065, 1),
      expectedProbe(1_850, 2),
      expectedProbe(1_870, 2),
      expectedProbe(74, 2),
      expectedProbe(1_147, 1),
      expectedProbe(4_108, 2),
      expectedProbe(4_001, 1),
      expectedProbe(4_122, 2),
      expectedProbe(1_000, 2),
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
      ...heatingSignals(
        ModbusCodec.encodeFloat32(25),
        Array.from({ length: 6 }, () => ModbusCodec.encodeFloat32(-1)).flat(2),
        [0],
        [0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
      ),
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
    expect(client.getDiagnostics()).toMatchObject({
      navigatorType: MODEL_NAVIGATOR_10,
      modbusConnected: true,
      firmware: "7.45",
    });
    expect(map.size).toBe(203);
    expect(map.has("power_limit_hp")).toBe(true);
    expect(map.has("hc_a_flow_temp")).toBe(true);
    expect(map.has("zm1_room1_temp")).toBe(true);
    expect(map.has("solar_collector_temp")).toBe(true);
    expect(map.has("isc_mode")).toBe(true);
    expect(map.has("pv_production")).toBe(true);
    expect(map.has("cascade_req_heating_temp")).toBe(true);
    expect(
      [...map].some(([name, register]) => name === "humidity_sensor" && register.address === 1_046),
    ).toBe(false);
    expect([...map.keys()].some((name) => /navigator.?1/iu.test(name))).toBe(false);
    expect(readRequests(transport.events)).toEqual([
      expectedProbe(1_350, 2),
      expectedProbe(1_350, 14),
      expectedProbe(1_498, 1),
      expectedProbe(1_498, 7),
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

  it("ignores non-finite and sentinel temperatures while retaining finite out-of-range circuits", async () => {
    const responses = [
      words([0, 32_704]),
      words([
        0,
        32_704,
        ...ModbusCodec.encodeFloat32(123.5),
        ...ModbusCodec.encodeFloat32(-1),
        ...ModbusCodec.encodeFloat32(-1),
        ...ModbusCodec.encodeFloat32(-1),
        ...ModbusCodec.encodeFloat32(-1),
        ...ModbusCodec.encodeFloat32(-1),
      ]),
      missing(1_498),
      missing(1_498),
      missing(1_499),
      ...Array.from({ length: 5 }, () => words([0xffff])),
      missing(2_000),
      missing(2_065),
      words([0, 32_704]),
      words([0, 32_704]),
      words([0, 0]),
      words([0xffff]),
      missing(4_108),
      missing(4_001),
      missing(4_122),
    ];
    const { client, transport } = clientWithResponses(responses);

    const info = await client.detectModel({ readFirmware: false });

    expect(info).toMatchObject({
      modelName: MODEL_NAVIGATOR_20,
      activeHeatingCircuits: ["B"],
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
    expect(requests.slice(0, 4).map(({ address, count }) => ({ address, count }))).toEqual([
      { address: 1_350, count: 2 },
      { address: 1_350, count: 14 },
      { address: 1_498, count: 1 },
      { address: 1_498, count: 1 },
    ]);
    // The mode batch was rejected; the individual fallback probed every slot.
    expect(
      requests.filter(({ count, address }) => count === 1 && address >= 1_498 && address <= 1_504)
        .length,
    ).toBe(8);
    // The flow batch covered the whole 1350-1363 span (slot G included).
    expect(requests).toContainEqual(expectedProbe(1_350, 14));
    expect(requests.some(({ address }) => address === 4_120)).toBe(false);
    transport.assertResponsesConsumed();
  });

  it("gives zone evidence Navigator Pro priority over heating-circuit evidence", async () => {
    const responses = [
      ...heatingSignals(
        ModbusCodec.encodeFloat32(25),
        Array.from({ length: 6 }, () => ModbusCodec.encodeFloat32(-1)).flat(2),
        [0],
        [0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
      ),
      words([1]),
      missing(2_065),
      missing(2_130),
      missing(1_850),
      missing(1_870),
      missing(74),
      words([0]),
      missing(4_108),
      missing(4_001),
      missing(4_122),
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

  it("detects non-contiguous circuits through the active-mode fallback", async () => {
    // Gate flow(25) answered, flow batch served (-1 for the rest); the mode
    // gate answered, but the mode batch is rejected by the controller, so
    // the per-slot fallback reads every slot and reveals circuit D's
    // configured mode 2.
    const responses = [
      words(ModbusCodec.encodeFloat32(25)),
      words([
        ...ModbusCodec.encodeFloat32(25),
        ...Array.from({ length: 6 }, () => ModbusCodec.encodeFloat32(-1)).flat(2),
      ]),
      words([0]),
      missing(1_498),
      words([0]),
      words([0xffff]),
      words([0xffff]),
      words([2]),
      words([0xffff]),
      words([0xffff]),
      words([0xffff]),
      missing(2_000),
      missing(2_065),
      missing(1_850),
      missing(1_870),
      missing(74),
      missing(1_147),
      missing(4_108),
      missing(4_001),
      missing(4_122),
    ];
    const { client, transport } = clientWithResponses(responses);

    const info = await client.detectModel({ readFirmware: false });

    expect(info.activeHeatingCircuits).toEqual(["A", "D"]);
    expect(info.features.has(FEATURE_HEATING_CIRCUITS)).toBe(true);
    expect(readRequests(transport.events).some(({ address }) => address === 1_504)).toBe(true);
    transport.assertResponsesConsumed();
  });

  it("returns null for non-finite firmware and emits no firmware request when disabled", async () => {
    const invalidFirmware = [
      ...heatingAllMissing(),
      missing(2_000),
      missing(2_065),
      missing(1_850),
      missing(1_870),
      missing(74),
      missing(1_147),
      missing(4_108),
      missing(4_001),
      missing(4_122),
      missing(1_000),
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
    expect(
      readRequests(disabledFirmware.transport.events).some(({ address }) => address === 4_120),
    ).toBe(false);
    disabledFirmware.transport.assertResponsesConsumed();
  });
});
