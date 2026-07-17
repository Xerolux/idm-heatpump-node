import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  WRITE_SCENARIO_LIMITS,
  WriteScenarioActionKind,
  WriteScenarioContractError,
  parseWriteBehaviorFixture,
} from "../../src/contracts/write-scenario.js";

const WRITE_ACTION_KINDS = [
  "simulate_write",
  "write_register",
  "set_value",
  "advance_time",
  "reset_write_throttle",
  "get_active_cyclic_writes",
  "get_expired_cyclic_writes",
  "reset_cyclic_write_state",
] as const;

const GENERATED_WRITE_FIXTURE = resolve(import.meta.dirname, "../fixtures/write-behavior.json");

const EMPTY_STATE = Object.freeze({
  activeCyclicWrites: Object.freeze({}),
  connected: false,
  connectionSuspect: false,
  cyclicWrites: Object.freeze({}),
  expiredCyclicWrites: Object.freeze([]),
  lastError: null,
  maxActiveRequests: 0,
  unsupportedRegisters: Object.freeze([]),
  writeThrottle: Object.freeze({}),
});

function validFixture(): Record<string, unknown> {
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
    operation_kinds: [...WRITE_ACTION_KINDS],
    scenarios: [
      {
        clock: [],
        configuration: {
          detectedModel: null,
          host: "example.invalid",
          maxGroupSize: 40,
          maxRetries: 3,
          port: 502,
          registerDefinitions: [],
          slaveId: 1,
          timeout: 10,
        },
        expected_requests: [],
        expected_result: {
          steps: [
            {
              result: {
                kind: "value",
                value: {
                  dryRun: true,
                  encodedRegisters: [1],
                  register: { address: 74, name: "system_mode" },
                  requestedValue: 1,
                },
              },
              state: structuredClone(EMPTY_STATE),
            },
          ],
        },
        expected_state: structuredClone(EMPTY_STATE),
        name: "simulate_one_word_no_traffic",
        operation: {
          actions: [
            {
              allowCustomRegister: false,
              dryRun: true,
              kind: "simulate_write",
              register: "system_mode",
              value: 1,
            },
          ],
          kind: "sequence",
        },
        transport_responses: [],
      },
    ],
    schema_version: 1,
  };
}

function scenariosOf(fixture: Record<string, unknown>): Record<string, unknown>[] {
  const scenarios = fixture.scenarios;
  if (!Array.isArray(scenarios)) throw new Error("Expected scenarios");
  return scenarios as Record<string, unknown>[];
}

function firstScenario(fixture: Record<string, unknown>): Record<string, unknown> {
  const scenario = scenariosOf(fixture)[0];
  if (scenario === undefined) throw new Error("Expected one scenario");
  return scenario;
}

function operationOf(fixture: Record<string, unknown>): Record<string, unknown> {
  return firstScenario(fixture).operation as Record<string, unknown>;
}

function actionsOf(fixture: Record<string, unknown>): Record<string, unknown>[] {
  return operationOf(fixture).actions as Record<string, unknown>[];
}

function expectFixtureError(callback: () => unknown): void {
  expect(callback).toThrow(WriteScenarioContractError);
}

describe("closed write scenario schema parser", () => {
  it("parses the pinned generated write matrix with unique complete categories", () => {
    const parsed = parseWriteBehaviorFixture(readFileSync(GENERATED_WRITE_FIXTURE, "utf8"));
    expect(parsed.operation_kinds).toEqual(WRITE_ACTION_KINDS);
    expect(parsed.scenarios.length).toBeGreaterThanOrEqual(26);
    const names = parsed.scenarios.map(({ name }) => name);
    expect(names).toEqual([...new Set(names)]);
  });

  it("parses a minimal canonical synthetic fixture to a newly owned deeply immutable graph", () => {
    const raw = validFixture();
    const first = parseWriteBehaviorFixture(raw);
    const second = parseWriteBehaviorFixture(raw);

    expect(first.schema_version).toBe(1);
    expect(first.generator_version).toBe("1");
    expect(first.operation_kinds).toEqual(WRITE_ACTION_KINDS);
    expect(WriteScenarioActionKind).toEqual({
      ADVANCE_TIME: "advance_time",
      GET_ACTIVE_CYCLIC_WRITES: "get_active_cyclic_writes",
      GET_EXPIRED_CYCLIC_WRITES: "get_expired_cyclic_writes",
      RESET_CYCLIC_WRITE_STATE: "reset_cyclic_write_state",
      RESET_WRITE_THROTTLE: "reset_write_throttle",
      SET_VALUE: "set_value",
      SIMULATE_WRITE: "simulate_write",
      WRITE_REGISTER: "write_register",
    });
    expect(first).not.toBe(raw);
    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.baseline)).toBe(true);
    expect(Object.isFrozen(first.scenarios)).toBe(true);
    expect(Object.isFrozen(first.scenarios[0])).toBe(true);
    expect(Object.isFrozen(first.scenarios[0]?.operation.actions)).toBe(true);
    expect(Object.isFrozen(first.scenarios[0]?.expected_state)).toBe(true);

    firstScenario(raw).name = "mutated";
    expect(first.scenarios[0]?.name).toBe("simulate_one_word_no_traffic");
    expect(() => Object.assign(first.scenarios[0] ?? {}, { name: "changed" })).toThrow(TypeError);
  });

  it("accepts only the exact eight action kinds and exact action keys", () => {
    const cases = [
      {
        allowCustomRegister: false,
        dryRun: false,
        kind: "simulate_write",
        register: "system_mode",
        value: 1,
      },
      {
        allowCustomRegister: true,
        kind: "write_register",
        register: {
          address: 4_200,
          datatype: "FLOAT",
          name: "synthetic_custom",
          source: "synthetic_contract",
          sourceVersion: "1",
          supportedModels: ["Navigator 10"],
          writable: true,
        },
        value: 42.5,
      },
      { dryRun: true, key: "system_mode", kind: "set_value", value: 1 },
      { kind: "advance_time", seconds: 60 },
      { kind: "reset_write_throttle" },
      { kind: "get_active_cyclic_writes" },
      { kind: "get_expired_cyclic_writes" },
      { kind: "reset_cyclic_write_state", register: "system_mode" },
    ];

    for (const action of cases) {
      const fixture = validFixture();
      operationOf(fixture).actions = [action];
      expect(() => parseWriteBehaviorFixture(fixture), JSON.stringify(action)).not.toThrow();
    }

    for (const action of [
      { kind: "read_register", register: "system_mode" },
      { kind: "simulate_write", register: "system_mode", value: 1, extra: true },
      { kind: "write_register", register: "system_mode", value: 1, dryRun: true },
      { kind: "set_value", register: "system_mode", value: 1 },
      { kind: "advance_time", seconds: -1 },
      { kind: "reset_write_throttle", register: "system_mode", extra: true },
    ]) {
      const fixture = validFixture();
      operationOf(fixture).actions = [action];
      expectFixtureError(() => parseWriteBehaviorFixture(fixture));
    }
  });

  it("rejects every root, baseline, scenario, operation, result, request, and state key mutation", () => {
    const mutations: readonly ((fixture: Record<string, unknown>) => void)[] = [
      (fixture) => {
        fixture.extra = true;
      },
      (fixture) => {
        delete fixture.schema_version;
      },
      (fixture) => {
        fixture.schema_version = 2;
      },
      (fixture) => {
        fixture.generator_version = "2";
      },
      (fixture) => {
        (fixture.baseline as Record<string, unknown>).git_commit = "f".repeat(40);
      },
      (fixture) => {
        (fixture.baseline as Record<string, unknown>).extra = true;
      },
      (fixture) => {
        firstScenario(fixture).extra = true;
      },
      (fixture) => {
        delete firstScenario(fixture).expected_state;
      },
      (fixture) => {
        operationOf(fixture).extra = true;
      },
      (fixture) => {
        const result = firstScenario(fixture).expected_result as Record<string, unknown>;
        result.extra = true;
      },
      (fixture) => {
        const result = firstScenario(fixture).expected_result as Record<string, unknown>;
        const steps = result.steps as Record<string, unknown>[];
        (steps[0] as Record<string, unknown>).extra = true;
      },
      (fixture) => {
        (firstScenario(fixture).expected_state as Record<string, unknown>).extra = true;
      },
      (fixture) => {
        firstScenario(fixture).expected_requests = [{ kind: "connect", extra: true }];
      },
      (fixture) => {
        fixture.operation_kinds = [...WRITE_ACTION_KINDS, "read_register"];
      },
    ];

    for (const mutate of mutations) {
      const fixture = validFixture();
      mutate(fixture);
      expectFixtureError(() => parseWriteBehaviorFixture(fixture));
    }

    const duplicate = validFixture();
    duplicate.scenarios = [firstScenario(duplicate), structuredClone(firstScenario(duplicate))];
    expectFixtureError(() => parseWriteBehaviorFixture(duplicate));
  });

  it("validates every FC16 request through the real request factory", () => {
    const valid = validFixture();
    firstScenario(valid).expected_requests = [
      { kind: "connect" },
      {
        kind: "write",
        request: {
          address: 1_696,
          count: 2,
          functionCode: 16,
          registerType: "holding",
          unitId: 1,
          words: [0, 16_938],
        },
      },
    ];
    expect(() => parseWriteBehaviorFixture(valid)).not.toThrow();

    for (const request of [
      {
        address: 1_696,
        count: 1,
        functionCode: 6,
        registerType: "holding",
        unitId: 1,
        words: [1],
      },
      {
        address: 65_535,
        count: 2,
        functionCode: 16,
        registerType: "holding",
        unitId: 1,
        words: [1, 2],
      },
      {
        address: 1_696,
        count: 1,
        functionCode: 16,
        registerType: "holding",
        unitId: 1,
        words: [65_536],
      },
      {
        address: 1_696,
        count: 2,
        functionCode: 16,
        registerType: "holding",
        unitId: 1,
        words: [1],
      },
    ]) {
      const fixture = validFixture();
      firstScenario(fixture).expected_requests = [{ kind: "write", request }];
      expectFixtureError(() => parseWriteBehaviorFixture(fixture));
    }
  });

  it("rejects malformed response, result, error, diagnostic, and sensitive projections", () => {
    for (const response of [
      { kind: "ack", address: 1_000, count: 1, extra: true },
      { kind: "ack", address: -1, count: 1 },
      { kind: "error", errorType: "unknown", message: "failure" },
      { kind: "error", errorType: "timeout", message: "example.invalid:502 leaked" },
      { kind: "error", errorType: "timeout", message: "<host> failed" },
      { kind: "error", errorType: "timeout", message: "failed", cause: {} },
      { kind: "error", errorType: "timeout", message: "failed", payload: [] },
    ]) {
      const fixture = validFixture();
      firstScenario(fixture).transport_responses = [response];
      expectFixtureError(() => parseWriteBehaviorFixture(fixture));
    }

    for (const result of [
      { kind: "error", category: "validation", code: "unknown", diagnostic: "x" },
      {
        kind: "error",
        category: "transport",
        errorType: "timeout",
        message: "example.invalid failed",
      },
      { kind: "value", value: null, cause: {} },
      { kind: "value", value: null, payload: [] },
    ]) {
      const fixture = validFixture();
      const expected = firstScenario(fixture).expected_result as Record<string, unknown>;
      const steps = expected.steps as Record<string, unknown>[];
      (steps[0] as Record<string, unknown>).result = result;
      expectFixtureError(() => parseWriteBehaviorFixture(fixture));
    }
  });

  it("enforces source, scenario, action, response, clock, word, text, graph, and diagnostic bounds", () => {
    const oversizedSource = JSON.stringify(validFixture()).padEnd(
      WRITE_SCENARIO_LIMITS.maxSourceBytes + 1,
      " ",
    );
    expectFixtureError(() => parseWriteBehaviorFixture(oversizedSource));

    const tooManyScenarios = validFixture();
    const source = firstScenario(tooManyScenarios);
    tooManyScenarios.scenarios = Array.from(
      { length: WRITE_SCENARIO_LIMITS.maxScenarios + 1 },
      (_, index) => ({ ...structuredClone(source), name: `scenario-${String(index)}` }),
    );
    expectFixtureError(() => parseWriteBehaviorFixture(tooManyScenarios));

    const tooManyActions = validFixture();
    operationOf(tooManyActions).actions = Array.from(
      { length: WRITE_SCENARIO_LIMITS.maxActions + 1 },
      () => ({ kind: "get_active_cyclic_writes" }),
    );
    expectFixtureError(() => parseWriteBehaviorFixture(tooManyActions));

    const tooManyResponses = validFixture();
    firstScenario(tooManyResponses).transport_responses = Array.from(
      { length: WRITE_SCENARIO_LIMITS.maxResponses + 1 },
      () => ({ address: 1, count: 1, kind: "ack" }),
    );
    expectFixtureError(() => parseWriteBehaviorFixture(tooManyResponses));

    const tooManyClockEvents = validFixture();
    firstScenario(tooManyClockEvents).clock = Array.from(
      { length: WRITE_SCENARIO_LIMITS.maxClockEvents + 1 },
      (_, index) => index,
    );
    expect(() => parseWriteBehaviorFixture(tooManyClockEvents)).toThrow();

    const tooManyWords = validFixture();
    firstScenario(tooManyWords).expected_requests = [
      {
        kind: "write",
        request: {
          address: 0,
          count: WRITE_SCENARIO_LIMITS.maxWords + 1,
          functionCode: 16,
          registerType: "holding",
          unitId: 1,
          words: Array.from({ length: WRITE_SCENARIO_LIMITS.maxWords + 1 }, () => 0),
        },
      },
    ];
    expectFixtureError(() => parseWriteBehaviorFixture(tooManyWords));

    const longText = validFixture();
    firstScenario(longText).name = "x".repeat(WRITE_SCENARIO_LIMITS.maxNameLength + 1);
    expectFixtureError(() => parseWriteBehaviorFixture(longText));

    const longDiagnostic = validFixture();
    const result = firstScenario(longDiagnostic).expected_result as Record<string, unknown>;
    const steps = result.steps as Record<string, unknown>[];
    (steps[0] as Record<string, unknown>).result = {
      category: "validation",
      code: "write_read_only",
      diagnostic: "x".repeat(WRITE_SCENARIO_LIMITS.maxDiagnosticLength + 1),
      kind: "error",
    };
    expectFixtureError(() => parseWriteBehaviorFixture(longDiagnostic));

    const deep = validFixture();
    let nested: Record<string, unknown> = {};
    firstScenario(deep).expected_state = nested;
    for (let depth = 0; depth <= WRITE_SCENARIO_LIMITS.maxDepth; depth += 1) {
      const child: Record<string, unknown> = {};
      nested.next = child;
      nested = child;
    }
    expect(() => parseWriteBehaviorFixture(deep)).toThrow();

    const nodeHeavy = validFixture();
    firstScenario(nodeHeavy).expected_result = {
      steps: Array.from({ length: WRITE_SCENARIO_LIMITS.maxNodes }, () => [0]),
    };
    expect(() => parseWriteBehaviorFixture(nodeHeavy)).toThrow();
  });

  it("rejects illegal number tags, raw exceptional numbers, cycles, and dangerous keys", () => {
    for (const value of [
      { $number: "unknown" },
      { $number: "NaN", extra: true },
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -0,
    ]) {
      const fixture = validFixture();
      const action = actionsOf(fixture)[0];
      if (action === undefined) throw new Error("Expected one write action");
      action.value = value;
      expect(() => parseWriteBehaviorFixture(fixture)).toThrow();
    }

    const circular = validFixture();
    const result: Record<string, unknown> = {};
    result.self = result;
    firstScenario(circular).expected_state = result;
    expect(() => parseWriteBehaviorFixture(circular)).toThrow();

    for (const key of ["__proto__", "prototype", "constructor"]) {
      const fixture = validFixture();
      firstScenario(fixture).expected_state = JSON.parse(
        `{${JSON.stringify(key)}:{"polluted":true}}`,
      ) as Record<string, unknown>;
      expectFixtureError(() => parseWriteBehaviorFixture(fixture));
    }
    expect((Object.prototype as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it("imports no client or provider implementation and performs no file or network work", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../../src/contracts/write-scenario.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/client\//u);
    expect(source).not.toMatch(/modbus-serial/u);
    expect(source).not.toMatch(/node:(?:fs|net|http|https)/u);
    expect(source).not.toMatch(/readFile|fetch\(|connect\(/u);

    const fixture = validFixture();
    expect(() => parseWriteBehaviorFixture(JSON.stringify(fixture))).not.toThrow();
  });
});
