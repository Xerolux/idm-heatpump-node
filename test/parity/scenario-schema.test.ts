import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  SCENARIO_CONTRACT_LIMITS,
  ScenarioContractError,
  parseScenarioContract,
} from "../../src/contracts/scenario.js";
import {
  ContractValueError,
  TAGGED_VALUE_LIMITS,
  createContractSetSnapshot,
  normalizeTaggedValue,
  parseTaggedValue,
} from "../../src/contracts/tagged-values.js";
import {
  canonicalContractJson,
  compareUnicodeCodePoints,
} from "../../src/contracts/canonical-order.js";

function expectContractCode(callback: () => unknown, code: ContractValueError["code"]): void {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(ContractValueError);
    expect((error as ContractValueError).code).toBe(code);
    return;
  }
  throw new Error(`Expected contract error ${code}`);
}

function expectScenarioCode(callback: () => unknown, code: ScenarioContractError["code"]): void {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(ScenarioContractError);
    expect((error as ScenarioContractError).code).toBe(code);
    return;
  }
  throw new Error(`Expected scenario error ${code}`);
}

function readBehaviorFixture(): Record<string, unknown> {
  return JSON.parse(
    readFileSync(resolve("test/fixtures/behavior-contract.json"), "utf8"),
  ) as Record<string, unknown>;
}

function clonedFixture(): Record<string, unknown> {
  return structuredClone(readBehaviorFixture());
}

function scenariosOf(fixture: Record<string, unknown>): Record<string, unknown>[] {
  const scenarios = fixture.scenarios;
  if (!Array.isArray(scenarios)) {
    throw new Error("Expected generated scenarios array");
  }
  return scenarios as Record<string, unknown>[];
}

describe("tagged contract numbers", () => {
  it("round-trips the four exceptional number tags without null or zero conflation", () => {
    const values = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0] as const;
    const tags = ["NaN", "+Infinity", "-Infinity", "-0"] as const;

    for (const [index, value] of values.entries()) {
      const normalized = normalizeTaggedValue(value);
      expect(normalized).toEqual({ $number: tags[index] });
      expect(JSON.stringify(normalized)).not.toBe("null");

      const parsed = parseTaggedValue(normalized);
      if (Number.isNaN(value)) {
        expect(Number.isNaN(parsed)).toBe(true);
      } else {
        expect(Object.is(parsed, value)).toBe(true);
      }
    }

    expect(normalizeTaggedValue(0)).toBe(0);
    expect(Object.is(parseTaggedValue(0), -0)).toBe(false);
  });

  it("normalizes approved map and set differences deterministically", () => {
    const value = new Map<string | number, unknown>([
      ["z", new Set([3, 1, 2])],
      [2, { value: true }],
    ]);

    expect(normalizeTaggedValue(value)).toEqual({
      "2": { value: true },
      z: [1, 2, 3],
    });
  });

  it("preserves source-set negative zero and distinct NaN members through snapshots", () => {
    expect(normalizeTaggedValue(createContractSetSnapshot([-0]))).toEqual([{ $number: "-0" }]);
    expect(normalizeTaggedValue(createContractSetSnapshot([0]))).toEqual([0]);
    expect(normalizeTaggedValue(createContractSetSnapshot([Number.NaN]))).toEqual([
      { $number: "NaN" },
    ]);
    expect(normalizeTaggedValue(createContractSetSnapshot([Number.NaN, Number.NaN]))).toEqual([
      { $number: "NaN" },
      { $number: "NaN" },
    ]);

    expect(normalizeTaggedValue(new Set([-0]))).toEqual([0]);
    expect(normalizeTaggedValue(new Set([Number.NaN, Number.NaN]))).toEqual([{ $number: "NaN" }]);
  });

  it("normalizes ordinary and nested contract-set snapshots with structural ordering", () => {
    expect(
      normalizeTaggedValue(
        createContractSetSnapshot([["nested", -0], createContractSetSnapshot([3, 1]), "ordinary"]),
      ),
    ).toEqual(["ordinary", [1, 3], ["nested", { $number: "-0" }]]);
  });

  it("rejects bigint and unsafe numeric map keys while retaining finite float values", () => {
    expect(normalizeTaggedValue(1e20)).toBe(1e20);
    expectContractCode(() => normalizeTaggedValue(1n), "invalid_contract_value");
    expectContractCode(
      () => normalizeTaggedValue(new Map([[Number.MAX_SAFE_INTEGER + 1, "value"]])),
      "invalid_contract_value",
    );
    expectContractCode(
      () => normalizeTaggedValue(new Map([[BigInt(Number.MAX_SAFE_INTEGER) + 1n, "value"]])),
      "invalid_contract_value",
    );
    expect(normalizeTaggedValue(new Map([[Number.MAX_SAFE_INTEGER, "value"]]))).toEqual({
      [String(Number.MAX_SAFE_INTEGER)]: "value",
    });
    expect(normalizeTaggedValue(new Map([[Number.MIN_SAFE_INTEGER, "value"]]))).toEqual({
      [String(Number.MIN_SAFE_INTEGER)]: "value",
    });
  });

  it("matches Python code-point and recursively canonical JSON ordering", () => {
    const strings = ["😀", "z", "ä", "a", "Z", "2", "10", "!", "_", "\uE000"];
    expect([...strings].sort(compareUnicodeCodePoints)).toEqual([
      "!",
      "10",
      "2",
      "Z",
      "_",
      "a",
      "z",
      "ä",
      "\uE000",
      "😀",
    ]);

    const nested = normalizeTaggedValue(
      new Map<string, unknown>([
        ["2", "two"],
        ["10", "ten"],
        [
          "😀",
          new Map([
            ["2", 2],
            ["10", 10],
          ]),
        ],
        ["\uE000", true],
      ]),
    );
    expect(canonicalContractJson(nested)).toBe(
      '{"10":"ten","2":"two","":true,"😀":{"10":10,"2":2}}',
    );
    expect(normalizeTaggedValue(new Set(strings))).toEqual([
      "!",
      "10",
      "2",
      "Z",
      "_",
      "a",
      "z",
      "ä",
      "\uE000",
      "😀",
    ]);
  });

  it("uses one structural order for finite numbers, nesting, and exceptional envelopes", () => {
    const finiteValues = [
      -1e21, -1e20, -1e16, -1e15, -42.5, -1e-4, -1e-5, -1e-6, -1e-7, -1e-9, -1e-10, 1e-10, 1e-9,
      1e-7, 1e-6, 1e-5, 1e-4, 42.5, 1e15, 1e16, 1e20, 1e21,
    ] as const;

    expect(normalizeTaggedValue(new Set([...finiteValues].reverse()))).toEqual(finiteValues);

    expect(
      normalizeTaggedValue(
        new Set<unknown>([
          { "10": -1e-10 },
          { "2": 1e-10, "10": -1e-10 },
          { "10": 1e-10 },
          { "2": 0 },
          ["nested"],
          ["nested", { exponent: 1e-10 }],
          ["nested", { exponent: 1e-9 }],
          Number.NaN,
          Number.NEGATIVE_INFINITY,
          Number.POSITIVE_INFINITY,
          { $number: "-0" },
          "a",
          1e-10,
          -1e9,
          true,
          false,
          null,
        ]),
      ),
    ).toEqual([
      null,
      false,
      true,
      -1e9,
      1e-10,
      "a",
      ["nested"],
      ["nested", { exponent: 1e-10 }],
      ["nested", { exponent: 1e-9 }],
      { $number: "+Infinity" },
      { $number: "-0" },
      { $number: "-Infinity" },
      { $number: "NaN" },
      { "10": -1e-10 },
      { "10": -1e-10, "2": 1e-10 },
      { "10": 1e-10 },
      { "2": 0 },
    ]);
  });

  it("rejects malformed tagged number envelopes with a stable code", () => {
    const inheritedEnvelope = Object.assign(Object.create({ inherited: true }) as object, {
      $number: "NaN",
    });

    for (const malformed of [
      { $number: "Other" },
      { $number: "NaN", extra: true },
      { $number: 0 },
      inheritedEnvelope,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -0,
    ]) {
      expectContractCode(() => parseTaggedValue(malformed), "invalid_number_tag");
    }
  });

  it("rejects unsupported and prototype-bearing contract values", () => {
    class UnsupportedValue {
      public readonly value = 1;
    }

    const getterValue = {} as Record<string, unknown>;
    Object.defineProperty(getterValue, "unsafe", {
      enumerable: true,
      get: () => 1,
    });

    for (const unsupported of [
      undefined,
      1n,
      Symbol("value"),
      () => 1,
      new Date(0),
      new UnsupportedValue(),
      getterValue,
      Object.assign(Object.create({ inherited: true }) as object, { own: true }),
    ]) {
      expectContractCode(() => parseTaggedValue(unsupported), "invalid_contract_value");
    }
  });
});

describe("tagged contract value bounds", () => {
  it("rejects excessive strings, arrays, objects, depth, and total nodes", () => {
    const deepValue: Record<string, unknown> = {};
    let cursor = deepValue;
    for (let depth = 0; depth <= TAGGED_VALUE_LIMITS.maxDepth; depth += 1) {
      const child: Record<string, unknown> = {};
      cursor.next = child;
      cursor = child;
    }

    const tooManyKeys = Object.fromEntries(
      Array.from({ length: TAGGED_VALUE_LIMITS.maxObjectKeys + 1 }, (_, index) => [
        `key-${index}`,
        index,
      ]),
    );
    const tooManyNodes = Array.from({ length: TAGGED_VALUE_LIMITS.maxArrayLength }, () =>
      Array.from({ length: 3 }, () => 0),
    );

    for (const excessive of [
      "x".repeat(TAGGED_VALUE_LIMITS.maxStringLength + 1),
      Array.from({ length: TAGGED_VALUE_LIMITS.maxArrayLength + 1 }, () => 0),
      tooManyKeys,
      deepValue,
      tooManyNodes,
    ]) {
      expectContractCode(() => parseTaggedValue(excessive), "invalid_contract_value");
    }
  });

  it("rejects circular values deterministically", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expectContractCode(() => normalizeTaggedValue(circular), "invalid_contract_value");
    expectContractCode(() => parseTaggedValue(circular), "invalid_contract_value");
  });

  it("applies dense-array, cycle, depth, node, and collection bounds to set snapshots", () => {
    const sparse = Array(1) as unknown[];
    const extra = [1] as unknown[] & { extra?: number };
    extra.extra = 2;
    const getter = [] as unknown[];
    let getterCalls = 0;
    Object.defineProperty(getter, "0", {
      configurable: true,
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return 1;
      },
    });
    Object.defineProperty(getter, "length", { value: 1 });
    class ArraySubclass extends Array<unknown> {}
    const subclass = new ArraySubclass();
    subclass.push(1);
    const symbolProperty = [1] as unknown[];
    Object.defineProperty(symbolProperty, Symbol("extra"), { value: 2 });

    for (const invalidMembers of [
      sparse,
      extra,
      getter,
      subclass,
      symbolProperty,
      Array.from({ length: TAGGED_VALUE_LIMITS.maxArrayLength + 1 }, () => 0),
    ]) {
      expectContractCode(() => createContractSetSnapshot(invalidMembers), "invalid_contract_value");
    }
    expect(getterCalls).toBe(0);

    const circularMember: Record<string, unknown> = {};
    const circularSnapshot = createContractSetSnapshot([circularMember]);
    circularMember.snapshot = circularSnapshot;
    expectContractCode(() => normalizeTaggedValue(circularSnapshot), "invalid_contract_value");

    let deepSnapshot = createContractSetSnapshot([0]);
    for (let depth = 0; depth <= TAGGED_VALUE_LIMITS.maxDepth; depth += 1) {
      deepSnapshot = createContractSetSnapshot([deepSnapshot]);
    }
    expectContractCode(() => normalizeTaggedValue(deepSnapshot), "invalid_contract_value");

    const nodeHeavySnapshot = createContractSetSnapshot(
      Array.from({ length: TAGGED_VALUE_LIMITS.maxArrayLength }, () => [0, 0]),
    );
    expectContractCode(() => normalizeTaggedValue(nodeHeavySnapshot), "invalid_contract_value");
  });
});

describe("tagged contract value ownership", () => {
  it("clones and deeply freezes accepted arrays and objects", () => {
    const input = { nested: [{ value: 1 }] };
    const parsed = parseTaggedValue(input) as Readonly<{
      nested: readonly Readonly<{ value: number }>[];
    }>;
    const parsedFirst = parsed.nested[0];
    const inputFirst = input.nested[0];
    if (parsedFirst === undefined || inputFirst === undefined) {
      throw new Error("Expected one nested fixture value");
    }

    expect(parsed).not.toBe(input);
    expect(parsed.nested).not.toBe(input.nested);
    expect(parsedFirst).not.toBe(inputFirst);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.nested)).toBe(true);
    expect(Object.isFrozen(parsedFirst)).toBe(true);

    inputFirst.value = 9;
    expect(parsedFirst.value).toBe(1);
    expect(() => Object.assign(parsedFirst, { value: 2 })).toThrow(TypeError);
  });

  it("owns immutable snapshot membership and cannot be spoofed", () => {
    const source: unknown[] = [-0, Number.NaN];
    const snapshot = createContractSetSnapshot(source);
    source[0] = 0;
    source.push("later");

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(normalizeTaggedValue(snapshot)).toEqual([{ $number: "-0" }, { $number: "NaN" }]);

    const spoof = Object.freeze(Object.create(null)) as object;
    expect(normalizeTaggedValue(spoof)).toEqual({});
    expectContractCode(() => parseTaggedValue(snapshot), "invalid_contract_value");
  });
});

describe("versioned CTR-01 scenario fixture", () => {
  it("parses every generated scenario with exact provenance and all eight fields", () => {
    const raw = readBehaviorFixture();
    const parsed = parseScenarioContract(raw);
    const requiredFields = [
      "name",
      "configuration",
      "transport_responses",
      "clock",
      "operation",
      "expected_result",
      "expected_requests",
      "expected_state",
    ].sort();

    expect(parsed.schema_version).toBe(1);
    expect(parsed.generator_version).toBe("1");
    expect(parsed.baseline).toEqual({
      git_commit: "a5d44ed06e5bd317946ca41720f37151631bc9c6",
      git_tag: "v0.8.0",
      parity_schema_version: 1,
      python_package: "idm-heatpump-api",
      python_version: "0.8.0",
      repository: "https://github.com/Xerolux/idm-heatpump-api",
    });
    expect(parsed.scenarios).toHaveLength(7);
    for (const scenario of parsed.scenarios) {
      expect(Object.keys(scenario).sort()).toEqual(requiredFields);
    }

    const exceptionalResult = parsed.scenarios[0]?.expected_result;
    if (!Array.isArray(exceptionalResult)) {
      throw new Error("Expected exceptional-number scenario result");
    }
    expect(Number.isNaN(exceptionalResult[0])).toBe(true);
    expect(exceptionalResult[1]).toBe(Number.POSITIVE_INFINITY);
    expect(exceptionalResult[2]).toBe(Number.NEGATIVE_INFINITY);
    expect(Object.is(exceptionalResult[3], -0)).toBe(true);

    const orderingResult = parsed.scenarios.find(
      ({ name }) => name === "canonical_unicode_ordering",
    )?.expected_result;
    expect(
      normalizeTaggedValue({
        strings: new Set(["😀", "z", "ä", "a", "Z", "2", "10", "!", "_", "\uE000"]),
        nested: new Map<string, unknown>([
          ["2", "two"],
          ["10", "ten"],
          [
            "😀",
            new Map([
              ["2", 2],
              ["10", 10],
            ]),
          ],
          ["\uE000", true],
        ]),
      }),
    ).toEqual(orderingResult);

    const structuralResult = parsed.scenarios.find(
      ({ name }) => name === "structural_set_ordering",
    )?.expected_result;
    expect(
      parseTaggedValue(
        normalizeTaggedValue({
          finite: new Set([
            1e21, 1e20, 1e16, 1e15, 42.5, 1e-4, 1e-5, 1e-6, 1e-7, 1e-9, 1e-10, -1e-10, -1e-9, -1e-7,
            -1e-6, -1e-5, -1e-4, -42.5, -1e15, -1e16, -1e20, -1e21,
          ]),
          mixed: new Set<unknown>([
            { "10": -1e-10 },
            { "2": 1e-10, "10": -1e-10 },
            { "10": 1e-10 },
            { "2": 0 },
            ["nested"],
            ["nested", { exponent: 1e-10 }],
            ["nested", { exponent: 1e-9 }],
            { $number: "NaN" },
            { $number: "-Infinity" },
            { $number: "+Infinity" },
            { $number: "-0" },
            "a",
            1e-10,
            -1e9,
            true,
            false,
            null,
          ]),
        }),
      ),
    ).toEqual(structuralResult);

    const losslessSetResult = parsed.scenarios.find(
      ({ name }) => name === "lossless_source_set_members",
    )?.expected_result;
    expect(
      parseTaggedValue(
        normalizeTaggedValue({
          negative_zero: createContractSetSnapshot([-0]),
          positive_zero: createContractSetSnapshot([0]),
          one_nan: createContractSetSnapshot([Number.NaN]),
          two_distinct_nans: createContractSetSnapshot([Number.NaN, Number.NaN]),
          ordinary: createContractSetSnapshot([3, 1, 2]),
          nested: createContractSetSnapshot([createContractSetSnapshot([3, 1]), ["nested", -0]]),
        }),
      ),
    ).toEqual(losslessSetResult);
  });

  it("rejects every root and baseline provenance mutation", () => {
    for (const field of [
      "schema_version",
      "generator_version",
      "baseline",
      "operation_kinds",
      "scenarios",
    ]) {
      const fixture = Object.fromEntries(
        Object.entries(clonedFixture()).filter(([key]) => key !== field),
      );
      expectScenarioCode(() => parseScenarioContract(fixture), "fixture_invalid");
    }

    const extraRoot = clonedFixture();
    extraRoot.extra = true;
    expectScenarioCode(() => parseScenarioContract(extraRoot), "fixture_invalid");

    for (const [field, value] of [
      ["repository", "https://example.invalid/reference"],
      ["python_package", "other-package"],
      ["python_version", "9.9.9"],
      ["git_tag", "v9.9.9"],
      ["git_commit", "f".repeat(40)],
      ["parity_schema_version", 2],
    ] as const) {
      const fixture = clonedFixture();
      const baseline = fixture.baseline as Record<string, unknown>;
      baseline[field] = value;
      expectScenarioCode(() => parseScenarioContract(fixture), "fixture_invalid");
    }

    for (const fixture of [
      { ...clonedFixture(), schema_version: 2 },
      { ...clonedFixture(), generator_version: "2" },
      {
        ...clonedFixture(),
        operation_kinds: [
          "normalize_value",
          "codec_encode_float32",
          "build_register_map",
          "later_phase_read",
        ],
      },
      {
        ...clonedFixture(),
        operation_kinds: [
          "normalize_value",
          "codec_encode_float32",
          "build_register_map",
          "build_register_map",
        ],
      },
    ]) {
      expectScenarioCode(() => parseScenarioContract(fixture), "fixture_invalid");
    }
  });

  it("rejects missing, extra, duplicate, and malformed scenario fields", () => {
    const requiredFields = [
      "name",
      "configuration",
      "transport_responses",
      "clock",
      "operation",
      "expected_result",
      "expected_requests",
      "expected_state",
    ] as const;
    for (const field of requiredFields) {
      const fixture = clonedFixture();
      const scenarios = scenariosOf(fixture);
      const first = scenarios[0];
      if (first === undefined) throw new Error("Expected first scenario");
      scenarios[0] = Object.fromEntries(Object.entries(first).filter(([key]) => key !== field));
      expectScenarioCode(() => parseScenarioContract(fixture), "scenario_invalid");
    }

    const extraField = clonedFixture();
    const firstExtra = scenariosOf(extraField)[0];
    if (firstExtra === undefined) throw new Error("Expected first scenario");
    firstExtra.extra = true;
    expectScenarioCode(() => parseScenarioContract(extraField), "scenario_invalid");

    const duplicate = clonedFixture();
    const duplicateScenarios = scenariosOf(duplicate);
    const firstName = duplicateScenarios[0]?.name;
    if (duplicateScenarios[1] === undefined) throw new Error("Expected second scenario");
    duplicateScenarios[1].name = firstName;
    expectScenarioCode(() => parseScenarioContract(duplicate), "scenario_invalid");

    for (const [field, value] of [
      ["name", ""],
      ["configuration", []],
      ["transport_responses", {}],
      ["clock", {}],
      ["operation", []],
      ["expected_requests", {}],
      ["expected_state", []],
    ] as const) {
      const fixture = clonedFixture();
      const first = scenariosOf(fixture)[0];
      if (first === undefined) throw new Error("Expected first scenario");
      first[field] = value;
      expectScenarioCode(() => parseScenarioContract(fixture), "scenario_invalid");
    }
  });

  it("rejects unknown and later-phase operations plus malformed operation shapes", () => {
    for (const operation of [
      { kind: "connect" },
      { kind: "read_register" },
      { kind: "write_register" },
      { kind: "web_fetch" },
      { kind: "build_register_map", extra: true },
      { kind: "codec_encode_float32" },
      { kind: "register_overlap", address: -1 },
    ]) {
      const fixture = clonedFixture();
      const first = scenariosOf(fixture)[0];
      if (first === undefined) throw new Error("Expected first scenario");
      first.operation = operation;
      expectScenarioCode(() => parseScenarioContract(fixture), "scenario_invalid");
    }
  });

  it("validates words only inside transport and request envelopes", () => {
    const valid = clonedFixture();
    const validScenario = scenariosOf(valid)[1];
    if (validScenario === undefined) throw new Error("Expected codec scenario");
    validScenario.transport_responses = [{ words: [0, 65_535] }];
    validScenario.expected_requests = [{ words: [1, 32_768] }];
    validScenario.expected_result = [-1, 65_536, 131_071];
    validScenario.operation = { kind: "codec_encode_float32", value: { $number: "+Infinity" } };

    const parsed = parseScenarioContract(valid);
    const codecOperation = parsed.scenarios[1]?.operation;
    expect(codecOperation?.kind).toBe("codec_encode_float32");
    if (codecOperation?.kind !== "codec_encode_float32") {
      throw new Error("Expected codec operation");
    }
    expect(codecOperation.value).toBe(Number.POSITIVE_INFINITY);
    expect(parsed.scenarios[1]?.expected_result).toEqual([-1, 65_536, 131_071]);

    for (const words of [[-1], [65_536], [1.5], ["1"], "not-an-array"]) {
      for (const field of ["transport_responses", "expected_requests"] as const) {
        const fixture = clonedFixture();
        const first = scenariosOf(fixture)[0];
        if (first === undefined) throw new Error("Expected first scenario");
        first[field] = [{ words }];
        expectScenarioCode(() => parseScenarioContract(fixture), "scenario_invalid");
      }
    }
  });

  it("requires bounded unique names, bounded scenario counts, and valid clock events", () => {
    const longName = clonedFixture();
    const longNameScenario = scenariosOf(longName)[0];
    if (longNameScenario === undefined) throw new Error("Expected first scenario");
    longNameScenario.name = "x".repeat(SCENARIO_CONTRACT_LIMITS.maxNameLength + 1);
    expectScenarioCode(() => parseScenarioContract(longName), "scenario_invalid");

    const excessive = clonedFixture();
    const scenario = scenariosOf(excessive)[0];
    if (scenario === undefined) throw new Error("Expected first scenario");
    excessive.scenarios = Array.from(
      { length: SCENARIO_CONTRACT_LIMITS.maxScenarios + 1 },
      (_, index) => ({ ...structuredClone(scenario), name: `bounded-scenario-${index}` }),
    );
    expectScenarioCode(() => parseScenarioContract(excessive), "scenario_invalid");

    const validClock = clonedFixture();
    const validClockScenario = scenariosOf(validClock)[0];
    if (validClockScenario === undefined) throw new Error("Expected first scenario");
    validClockScenario.clock = [0, 1, 1, 1.5];
    expect(() => parseScenarioContract(validClock)).not.toThrow();

    for (const clock of [[-1], [1, 0], [{ $number: "NaN" }], [{ $number: "+Infinity" }], ["1"]]) {
      const fixture = clonedFixture();
      const first = scenariosOf(fixture)[0];
      if (first === undefined) throw new Error("Expected first scenario");
      first.clock = clock;
      expectScenarioCode(() => parseScenarioContract(fixture), "scenario_invalid");
    }
  });

  it("returns a newly owned recursively frozen scenario graph", () => {
    const raw = readBehaviorFixture();
    const parsed = parseScenarioContract(raw);

    expect(parsed).not.toBe(raw);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.baseline)).toBe(true);
    expect(Object.isFrozen(parsed.operation_kinds)).toBe(true);
    expect(Object.isFrozen(parsed.scenarios)).toBe(true);
    expect(Object.isFrozen(parsed.scenarios[0])).toBe(true);
    expect(Object.isFrozen(parsed.scenarios[0]?.operation)).toBe(true);
    expect(() => Object.assign(parsed.scenarios[0] ?? {}, { name: "changed" })).toThrow(TypeError);

    const rawScenarios = scenariosOf(raw);
    if (rawScenarios[0] === undefined) throw new Error("Expected first raw scenario");
    rawScenarios[0].name = "mutated-after-parse";
    expect(parsed.scenarios[0]?.name).toBe("normalize_exceptional_numbers");
  });
});
