import { describe, expect, it } from "vitest";

import {
  TRANSPORT_SCENARIO_LIMITS,
  TransportOperationKind,
  TransportScenarioContractError,
  parseTransportScenarioContract,
} from "../../src/contracts/transport-scenario.js";
import { parseScenarioContract } from "../../src/contracts/scenario.js";
import {
  createModbusReadRequest,
  type ModbusReadRequest,
  type ModbusTransport,
} from "../../src/transport/types.js";
import { RegisterType } from "../../src/types.js";
import { FakeClock } from "../support/fake-clock.js";
import { FakeModbusTransport } from "../support/fake-modbus-transport.js";

function inputRequest(
  address = 1_000,
  count = 2,
  timeoutMs: number | undefined = undefined,
): ModbusReadRequest {
  return createModbusReadRequest({
    unitId: 1,
    registerType: RegisterType.INPUT,
    functionCode: 4,
    address,
    count,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });
}

describe("adapter-neutral transport contract", () => {
  it("accepts only exact FC03 holding and FC04 input request identities", () => {
    expect(
      createModbusReadRequest({
        unitId: 247,
        registerType: RegisterType.HOLDING,
        functionCode: 3,
        address: 65_535,
        count: 1,
        timeoutMs: 2_000,
      }),
    ).toEqual({
      unitId: 247,
      registerType: "holding",
      functionCode: 3,
      address: 65_535,
      count: 1,
      timeoutMs: 2_000,
    });
    expect(inputRequest()).toEqual({
      unitId: 1,
      registerType: "input",
      functionCode: 4,
      address: 1_000,
      count: 2,
    });

    for (const invalid of [
      {
        unitId: 1,
        registerType: RegisterType.INPUT,
        functionCode: 3,
        address: 0,
        count: 1,
      },
      {
        unitId: 1,
        registerType: RegisterType.HOLDING,
        functionCode: 4,
        address: 0,
        count: 1,
      },
    ] as const) {
      expect(() => createModbusReadRequest(invalid)).toThrow(RangeError);
    }
  });

  it("rejects non-finite, fractional, and out-of-domain request values", () => {
    const base = {
      unitId: 1,
      registerType: RegisterType.INPUT,
      functionCode: 4 as const,
      address: 0,
      count: 1,
    };

    for (const patch of [
      { unitId: 0 },
      { unitId: 248 },
      { unitId: 1.5 },
      { address: -1 },
      { address: 65_536 },
      { address: Number.NaN },
      { count: 0 },
      { count: 126 },
      { count: 1.5 },
      { timeoutMs: 0 },
      { timeoutMs: -1 },
      { timeoutMs: 1.5 },
      { timeoutMs: Number.POSITIVE_INFINITY },
      { timeoutMs: 2_147_483_648 },
    ]) {
      expect(() => createModbusReadRequest({ ...base, ...patch })).toThrow(RangeError);
    }
  });

  it("implements the contract without exposing adapter response or client types", async () => {
    const transport: ModbusTransport = new FakeModbusTransport([{ kind: "words", words: [1, 2] }]);

    await transport.connect();
    await expect(transport.read(inputRequest())).resolves.toEqual([1, 2]);
    await transport.close();
    await transport.destroy();
  });
});

describe("fake Modbus transport", () => {
  it("records immutable lifecycle and read traces in exact order", async () => {
    const transport = new FakeModbusTransport([{ kind: "words", words: [10, 20] }]);
    const request = inputRequest(1_392, 2, 250);

    expect(transport.connected).toBe(false);
    await transport.connect();
    expect(transport.connected).toBe(true);
    await expect(transport.read(request)).resolves.toEqual([10, 20]);
    await transport.close();
    await transport.connect();
    await transport.destroy();
    expect(transport.connected).toBe(false);

    const events = transport.events;
    expect(events).toEqual([
      { kind: "connect" },
      { kind: "read", request },
      { kind: "close" },
      { kind: "connect" },
      { kind: "destroy" },
    ]);
    expect(Object.isFrozen(events)).toBe(true);
    expect(Object.isFrozen(events[1])).toBe(true);
    expect(Object.isFrozen(events[1]?.kind === "read" ? events[1].request : undefined)).toBe(true);
    expect(() => (events as unknown as unknown[]).push({ kind: "connect" })).toThrow(TypeError);
  });

  it("owns scripts and returned words while exposing unconsumed responses", async () => {
    const sourceWords = [7, 8];
    const scripts = [
      { kind: "words" as const, words: sourceWords },
      { kind: "words" as const, words: [9] },
    ];
    const transport = new FakeModbusTransport(scripts);
    sourceWords[0] = 65_535;
    scripts[0] = { kind: "words", words: [99, 99] };

    await transport.connect();
    const first = await transport.read(inputRequest());
    expect(first).toEqual([7, 8]);
    expect(transport.remainingResponses).toBe(1);
    expect(() => transport.assertResponsesConsumed()).toThrow(/unconsumed/u);

    const copied = [...first];
    copied[0] = 123;
    const trace = transport.events;
    expect(trace[1]).toEqual({ kind: "read", request: inputRequest() });
    expect(first).not.toBe(sourceWords);

    await expect(transport.read(inputRequest(1_001, 1))).resolves.toEqual([9]);
    expect(transport.remainingResponses).toBe(0);
    expect(() => transport.assertResponsesConsumed()).not.toThrow();
    await expect(transport.read(inputRequest(1_002, 1))).rejects.toThrow(/exhausted/u);
  });

  it("rejects invalid requests and words before consuming a scripted response", async () => {
    const transport = new FakeModbusTransport([{ kind: "words", words: [1] }]);
    await transport.connect();

    const invalidRequest = {
      ...inputRequest(1_000, 1),
      count: 0,
    } as ModbusReadRequest;
    await expect(transport.read(invalidRequest)).rejects.toThrow(RangeError);
    expect(transport.remainingResponses).toBe(1);
    expect(transport.events).toEqual([{ kind: "connect" }]);

    const invalidWords = new FakeModbusTransport([{ kind: "words", words: [Number.NaN] }]);
    await expect(invalidWords.connect()).rejects.toThrow(RangeError);
    expect(invalidWords.remainingResponses).toBe(1);
  });

  it("uses deterministic yields to expose transport concurrency without timers", async () => {
    const transport = new FakeModbusTransport(
      [
        { kind: "words", words: [1] },
        { kind: "words", words: [2] },
      ],
      { pauseReads: true },
    );
    await transport.connect();

    const first = transport.read(inputRequest(1_000, 1));
    const second = transport.read(inputRequest(1_001, 1));
    await transport.waitForPendingReads(2);

    expect(transport.activeRequests).toBe(2);
    expect(transport.maxActiveRequests).toBe(2);
    expect(transport.pendingReads).toBe(2);

    transport.releaseNextRead();
    await expect(first).resolves.toEqual([1]);
    expect(transport.activeRequests).toBe(1);
    transport.releaseNextRead();
    await expect(second).resolves.toEqual([2]);
    expect(transport.activeRequests).toBe(0);
    expect(transport.pendingReads).toBe(0);
  });
});

describe("fake monotonic clock", () => {
  it("advances deterministically and returns immutable delay snapshots", async () => {
    const clock = new FakeClock(10);
    expect(clock.now()).toBe(10);

    await clock.sleep(0.5);
    clock.advance(1.25);

    expect(clock.now()).toBe(11.75);
    expect(clock.delays).toEqual([0.5]);
    expect(Object.isFrozen(clock.delays)).toBe(true);
    expect(() => (clock.delays as unknown as number[]).push(1)).toThrow(TypeError);
  });

  it("rejects invalid clock starts, delays, and advances", async () => {
    for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY, -0]) {
      expect(() => new FakeClock(invalid)).toThrow(RangeError);
    }

    const clock = new FakeClock();
    for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY, -0]) {
      await expect(clock.sleep(invalid)).rejects.toThrow(RangeError);
      expect(() => clock.advance(invalid)).toThrow(RangeError);
    }
    expect(clock.now()).toBe(0);
    expect(clock.delays).toEqual([]);
  });
});

const TRANSPORT_OPERATION_KINDS = [
  "lifecycle",
  "read_register",
  "read_batch",
  "probe",
  "detect_model",
  "diagnostics",
  "reset_failed_registers",
] as const;

function validTransportScenario(): Record<string, unknown> {
  return {
    baseline: {
      git_commit: "ad121ebf34a5f5e37204371c026927d77efcd15c",
      git_tag: "v0.7.6",
      parity_schema_version: 1,
      python_package: "idm-heatpump-api",
      python_version: "0.7.6",
      repository: "https://github.com/Xerolux/idm-heatpump-api",
    },
    generator_version: "1",
    operation_kinds: [...TRANSPORT_OPERATION_KINDS],
    scenarios: [
      {
        clock: [0, 0.5],
        configuration: {
          host: "example.invalid",
          maxGroupSize: 40,
          maxRetries: 3,
          port: 502,
          slaveId: 1,
          timeout: 10,
        },
        expected_requests: [
          {
            kind: "read",
            request: {
              address: 1_392,
              count: 2,
              functionCode: 4,
              registerType: "input",
              timeoutMs: 2_000,
              unitId: 1,
            },
          },
          {
            kind: "read",
            request: {
              address: 1_393,
              count: 1,
              functionCode: 4,
              registerType: "input",
              unitId: 1,
            },
          },
        ],
        expected_result: {
          hc_a_mode: 2,
          humidity_sensor: 42,
        },
        expected_state: {
          batchUnsafeRegisters: [],
          connectionSuspect: false,
          lastError: null,
          permanentlyFailedRegisters: [],
          unsupportedRegisters: [],
        },
        name: "batch_overlap_humidity_and_mode",
        operation: {
          concurrency: 1,
          kind: "read_batch",
          registers: ["humidity_sensor", "hc_a_mode"],
        },
        transport_responses: [
          { kind: "words", words: [0, 16_936] },
          { kind: "words", words: [2] },
        ],
      },
    ],
    schema_version: 1,
  };
}

function scenariosOf(fixture: Record<string, unknown>): Record<string, unknown>[] {
  const scenarios = fixture.scenarios;
  if (!Array.isArray(scenarios)) {
    throw new Error("Expected transport scenarios");
  }
  return scenarios as Record<string, unknown>[];
}

function firstScenario(fixture: Record<string, unknown>): Record<string, unknown> {
  const scenario = scenariosOf(fixture)[0];
  if (scenario === undefined) {
    throw new Error("Expected one transport scenario");
  }
  return scenario;
}

function expectTransportScenarioError(callback: () => unknown): void {
  expect(callback).toThrow(TransportScenarioContractError);
}

describe("separate transport scenario schema parser", () => {
  it("parses exact provenance, closed operations, and semantic request order", () => {
    const raw = validTransportScenario();
    const parsed = parseTransportScenarioContract(raw);

    expect(parsed.schema_version).toBe(1);
    expect(parsed.generator_version).toBe("1");
    expect(parsed.operation_kinds).toEqual(TRANSPORT_OPERATION_KINDS);
    expect(TransportOperationKind).toEqual({
      LIFECYCLE: "lifecycle",
      READ_REGISTER: "read_register",
      READ_BATCH: "read_batch",
      PROBE: "probe",
      DETECT_MODEL: "detect_model",
      DIAGNOSTICS: "diagnostics",
      RESET_FAILED_REGISTERS: "reset_failed_registers",
    });
    expect(parsed.scenarios[0]?.operation).toEqual({
      concurrency: 1,
      kind: "read_batch",
      registers: ["humidity_sensor", "hc_a_mode"],
    });
    expect(parsed.scenarios[0]?.expected_requests).toEqual(
      firstScenario(raw).expected_requests,
    );

    const phaseOneFixture = {
      ...validTransportScenario(),
      operation_kinds: [
        "normalize_value",
        "codec_encode_float32",
        "build_register_map",
        "register_overlap",
      ],
    };
    expect(() => parseScenarioContract(phaseOneFixture)).toThrow();
  });

  it("accepts only closed lifecycle, read, probe, detect, diagnostic, and reset operations", () => {
    for (const operation of [
      { actions: ["connect", "disconnect", "force_reconnect"], kind: "lifecycle" },
      { concurrency: 2, kind: "read_register", register: "humidity_sensor" },
      {
        concurrency: 1,
        kind: "read_batch",
        registers: ["humidity_sensor", "hc_a_mode"],
      },
      {
        address: 1_000,
        count: 2,
        kind: "probe",
        maxRetries: 1,
        registerType: "input",
        timeout: 2,
      },
      { includeFirmware: true, kind: "detect_model" },
      { kind: "diagnostics" },
      { kind: "reset_failed_registers" },
    ]) {
      const fixture = validTransportScenario();
      firstScenario(fixture).operation = operation;
      expect(() => parseTransportScenarioContract(fixture)).not.toThrow();
    }

    for (const operation of [
      { kind: "write_register", register: "system_mode", value: 1 },
      { kind: "web_fetch" },
      { kind: "read_value" },
      { kind: "read_batch", registers: [], concurrency: 1 },
      { kind: "lifecycle", actions: ["connect", "write"] },
      { kind: "detect_model", includeFirmware: true, extra: true },
    ]) {
      const fixture = validTransportScenario();
      firstScenario(fixture).operation = operation;
      expectTransportScenarioError(() => parseTransportScenarioContract(fixture));
    }
  });

  it("rejects schema, baseline, root, scenario, and duplicate-name asymmetry", () => {
    for (const mutation of [
      (fixture: Record<string, unknown>) => {
        fixture.schema_version = 2;
      },
      (fixture: Record<string, unknown>) => {
        fixture.generator_version = "2";
      },
      (fixture: Record<string, unknown>) => {
        fixture.extra = true;
      },
      (fixture: Record<string, unknown>) => {
        (fixture.baseline as Record<string, unknown>).git_commit = "f".repeat(40);
      },
      (fixture: Record<string, unknown>) => {
        firstScenario(fixture).extra = true;
      },
      (fixture: Record<string, unknown>) => {
        delete firstScenario(fixture).expected_state;
      },
      (fixture: Record<string, unknown>) => {
        fixture.operation_kinds = [...TRANSPORT_OPERATION_KINDS, "write_register"];
      },
    ]) {
      const fixture = validTransportScenario();
      mutation(fixture);
      expectTransportScenarioError(() => parseTransportScenarioContract(fixture));
    }

    const duplicate = validTransportScenario();
    duplicate.scenarios = [
      firstScenario(duplicate),
      structuredClone(firstScenario(duplicate)),
    ];
    expectTransportScenarioError(() => parseTransportScenarioContract(duplicate));
  });

  it("enforces parser bounds for words, strings, arrays, scenarios, depth, and nodes", () => {
    for (const words of [[-1], [65_536], [1.5], [Number.NaN], ["1"]]) {
      const fixture = validTransportScenario();
      firstScenario(fixture).transport_responses = [{ kind: "words", words }];
      expect(() => parseTransportScenarioContract(fixture)).toThrow();
    }

    const longName = validTransportScenario();
    firstScenario(longName).name = "x".repeat(TRANSPORT_SCENARIO_LIMITS.maxNameLength + 1);
    expectTransportScenarioError(() => parseTransportScenarioContract(longName));

    const longText = validTransportScenario();
    firstScenario(longText).expected_result = "x".repeat(
      TRANSPORT_SCENARIO_LIMITS.maxTextLength + 1,
    );
    expectTransportScenarioError(() => parseTransportScenarioContract(longText));

    const tooManyResponses = validTransportScenario();
    firstScenario(tooManyResponses).transport_responses = Array.from(
      { length: TRANSPORT_SCENARIO_LIMITS.maxEnvelopeEntries + 1 },
      () => ({ kind: "words", words: [0] }),
    );
    expectTransportScenarioError(() => parseTransportScenarioContract(tooManyResponses));

    const tooManyScenarios = validTransportScenario();
    const source = firstScenario(tooManyScenarios);
    tooManyScenarios.scenarios = Array.from(
      { length: TRANSPORT_SCENARIO_LIMITS.maxScenarios + 1 },
      (_, index) => ({ ...structuredClone(source), name: `scenario-${index}` }),
    );
    expectTransportScenarioError(() => parseTransportScenarioContract(tooManyScenarios));

    const deep = validTransportScenario();
    let nested: Record<string, unknown> = {};
    firstScenario(deep).expected_result = nested;
    for (let depth = 0; depth <= TRANSPORT_SCENARIO_LIMITS.maxDepth; depth += 1) {
      const child: Record<string, unknown> = {};
      nested.next = child;
      nested = child;
    }
    expect(() => parseTransportScenarioContract(deep)).toThrow();

    const nodeHeavy = validTransportScenario();
    firstScenario(nodeHeavy).expected_result = Array.from(
      { length: TRANSPORT_SCENARIO_LIMITS.maxNodes },
      () => [0],
    );
    expect(() => parseTransportScenarioContract(nodeHeavy)).toThrow();
  });

  it("rejects cycles, raw exceptional values, and prototype-pollution keys", () => {
    const circular = validTransportScenario();
    const result: Record<string, unknown> = {};
    result.self = result;
    firstScenario(circular).expected_result = result;
    expect(() => parseTransportScenarioContract(circular)).toThrow();

    for (const exceptional of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -0,
    ]) {
      const fixture = validTransportScenario();
      firstScenario(fixture).expected_result = exceptional;
      expect(() => parseTransportScenarioContract(fixture)).toThrow();
    }

    const polluted = validTransportScenario();
    firstScenario(polluted).expected_state = JSON.parse(
      '{"__proto__":{"polluted":true}}',
    ) as Record<string, unknown>;
    expectTransportScenarioError(() => parseTransportScenarioContract(polluted));
    expect((Object.prototype as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it("accepts only closed normalized errors and exact endpoint redaction", () => {
    for (const errorType of [
      "timeout",
      "disconnected",
      "socket",
      "no_response",
      "modbus",
      "illegal_address",
      "invalid_response",
    ]) {
      const fixture = validTransportScenario();
      firstScenario(fixture).expected_state = {
        lastError: {
          address: 1_000,
          attempt: 1,
          count: 1,
          errorType,
          message: "read from <endpoint> failed",
          operation: "read",
          registerType: "input",
        },
      };
      expect(() => parseTransportScenarioContract(fixture)).not.toThrow();
    }

    for (const error of [
      { errorType: "unknown", message: "read from <endpoint> failed" },
      { errorType: "timeout", message: "read from example.invalid:502 failed" },
      { errorType: "timeout", message: "read from [example.invalid]:502 failed" },
      { errorType: "timeout", message: "read from <host> failed" },
      {
        errorType: "timeout",
        message: "x".repeat(TRANSPORT_SCENARIO_LIMITS.maxDiagnosticLength + 1),
      },
    ]) {
      const fixture = validTransportScenario();
      firstScenario(fixture).transport_responses = [{ kind: "error", ...error }];
      expectTransportScenarioError(() => parseTransportScenarioContract(fixture));
    }
  });

  it("returns newly owned deeply immutable parser graphs with independent state", () => {
    const raw = validTransportScenario();
    const first = parseTransportScenarioContract(raw);
    const second = parseTransportScenarioContract(raw);
    const rawScenario = firstScenario(raw);

    expect(first).not.toBe(raw);
    expect(first).not.toBe(second);
    expect(first.scenarios).not.toBe(second.scenarios);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.baseline)).toBe(true);
    expect(Object.isFrozen(first.operation_kinds)).toBe(true);
    expect(Object.isFrozen(first.scenarios)).toBe(true);
    expect(Object.isFrozen(first.scenarios[0])).toBe(true);
    expect(Object.isFrozen(first.scenarios[0]?.expected_requests)).toBe(true);
    expect(Object.isFrozen(first.scenarios[0]?.operation)).toBe(true);

    rawScenario.name = "mutated_after_parse";
    expect(first.scenarios[0]?.name).toBe("batch_overlap_humidity_and_mode");
    expect(second.scenarios[0]?.name).toBe("batch_overlap_humidity_and_mode");
    expect(() => Object.assign(first.scenarios[0] ?? {}, { name: "changed" })).toThrow(
      TypeError,
    );
  });
});
