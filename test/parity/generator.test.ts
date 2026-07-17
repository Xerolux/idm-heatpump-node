import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");
const UPSTREAM_SOURCE = resolve(ROOT, "../idm-heatpump-api");
const GENERATOR = resolve(ROOT, "scripts/generate-python-contract.py");
const ORCHESTRATOR = resolve(ROOT, "scripts/check-parity.mjs");
const MANIFEST = resolve(ROOT, "UPSTREAM-PARITY.json");
const PYTHON =
  process.env.IDM_CONTRACT_PYTHON ??
  (process.platform === "win32" && process.env.LOCALAPPDATA !== undefined
    ? join(process.env.LOCALAPPDATA, "Programs/Python/Python313/python.exe")
    : "python3.12");
const PINNED_COMMIT = "ad121ebf34a5f5e37204371c026927d77efcd15c";
const CANONICAL_ORIGIN = "https://github.com/Xerolux/idm-heatpump-api";
const FIXTURE_NAMES = [
  "public-api.json",
  "public-classes.json",
  "codec-vectors.json",
  "register-schema.json",
  "behavior-contract.json",
  "web-contract.json",
  "transport-behavior.json",
  "write-behavior.json",
] as const;

const temporaryDirectories: string[] = [];

function temporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function run(
  command: string,
  args: readonly string[],
  cwd = ROOT,
  environment: NodeJS.ProcessEnv = process.env,
): SpawnSyncReturns<string> {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: environment,
    maxBuffer: 32 * 1024 * 1024,
    shell: false,
    timeout: 120_000,
  });
}

function requireSuccess(result: SpawnSyncReturns<string>, purpose: string): void {
  if (result.status !== 0) {
    throw new Error(
      `${purpose} failed\n${result.error?.message ?? ""}\n${result.stdout}\n${result.stderr}`,
    );
  }
}

interface DisposableCheckout {
  readonly root: string;
  readonly checkout: string;
  readonly output: string;
}

interface FixtureRoot {
  readonly schema_version: number;
  readonly generator_version: string;
  readonly baseline: {
    readonly repository: string;
    readonly python_package: string;
    readonly python_version: string;
    readonly git_tag: string;
    readonly git_commit: string;
    readonly parity_schema_version: number;
  };
  readonly [key: string]: unknown;
}

interface TransportScenarioFixture extends FixtureRoot {
  readonly operation_kinds: readonly string[];
  readonly scenarios: readonly {
    readonly name: string;
    readonly configuration: Readonly<Record<string, unknown>>;
    readonly transport_responses: readonly Record<string, unknown>[];
    readonly clock: readonly number[];
    readonly operation: Readonly<Record<string, unknown>>;
    readonly expected_result: unknown;
    readonly expected_requests: readonly Record<string, unknown>[];
    readonly expected_state: Readonly<Record<string, unknown>>;
  }[];
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function fixturePath(checkout: DisposableCheckout, name: (typeof FIXTURE_NAMES)[number]): string {
  return join(checkout.output, "test/fixtures", name);
}

function fixtureSnapshot(
  checkout: DisposableCheckout,
): Readonly<Record<string, { readonly bytes: Buffer; readonly mtimeMs: number }>> {
  return Object.fromEntries(
    FIXTURE_NAMES.map((name) => {
      const path = fixturePath(checkout, name);
      return [name, { bytes: readFileSync(path), mtimeMs: statSync(path).mtimeMs }];
    }),
  );
}

function collectObjectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectObjectKeys(item, keys);
    }
  } else if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      keys.add(key);
      collectObjectKeys(item, keys);
    }
  }
  return keys;
}

function collectErrorProjections(
  value: unknown,
  projections: { readonly errorType: string; readonly message: string }[] = [],
): readonly { readonly errorType: string; readonly message: string }[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectErrorProjections(item, projections);
    }
  } else if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record.errorType === "string" && typeof record.message === "string") {
      projections.push({ errorType: record.errorType, message: record.message });
    }
    for (const item of Object.values(record)) {
      collectErrorProjections(item, projections);
    }
  }
  return projections;
}

function createExactCheckout(): DisposableCheckout {
  const root = temporaryDirectory("idm-python-contract-test-");
  const checkout = join(root, "upstream");
  const output = join(root, "output");
  mkdirSync(output);

  requireSuccess(
    run("git", ["clone", "--quiet", "--no-hardlinks", "--no-checkout", UPSTREAM_SOURCE, checkout]),
    "local clone",
  );
  requireSuccess(
    run("git", ["remote", "set-url", "origin", CANONICAL_ORIGIN], checkout),
    "origin rewrite",
  );
  requireSuccess(
    run("git", ["checkout", "--quiet", "--detach", PINNED_COMMIT], checkout),
    "detached checkout",
  );

  return { root, checkout, output };
}

function runGenerator(
  checkout: DisposableCheckout,
  extraArguments: readonly string[] = [],
  environment: NodeJS.ProcessEnv = process.env,
): SpawnSyncReturns<string> {
  return run(
    PYTHON,
    [
      GENERATOR,
      "--manifest",
      MANIFEST,
      "--upstream-dir",
      checkout.checkout,
      "--output-root",
      checkout.output,
      ...extraArguments,
    ],
    ROOT,
    environment,
  );
}

function importGenerator(expression: string): SpawnSyncReturns<string> {
  const source = [
    "import importlib.util, json",
    `spec = importlib.util.spec_from_file_location('contract_generator', ${JSON.stringify(GENERATOR)})`,
    "module = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(module)",
    `print(json.dumps(${expression}, sort_keys=True, separators=(',', ':')))`,
  ].join("\n");
  return run(PYTHON, ["-c", source], ROOT, { ...process.env, PYTHONDONTWRITEBYTECODE: "1" });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
}, 60_000);

describe("verified Python contract generator", () => {
  it("keeps a fixed allowlist of eight fixtures, two generated documents, and ten generated artifacts", () => {
    const source = readFileSync(ORCHESTRATOR, "utf8");
    const generatedPathsBlock = source.match(
      /const GENERATED_PATHS = Object\.freeze\(\[(?<paths>[\s\S]*?)\]\);/u,
    )?.groups?.paths;

    expect(generatedPathsBlock).toBeDefined();
    const paths = [...(generatedPathsBlock?.matchAll(/"([^"]+)"/gu) ?? [])].map(
      (match) => match[1],
    );
    expect(paths).toEqual([
      "test/fixtures/public-api.json",
      "test/fixtures/public-classes.json",
      "test/fixtures/codec-vectors.json",
      "test/fixtures/register-schema.json",
      "test/fixtures/behavior-contract.json",
      "test/fixtures/web-contract.json",
      "test/fixtures/transport-behavior.json",
      "test/fixtures/write-behavior.json",
      "docs/API-PARITY.md",
      "docs/BASELINE.md",
    ]);
    expect(source).toContain("eight fixtures");
    expect(source).toContain("two generated documents");
    expect(source).toContain("ten generated artifacts");
    expect(source).toContain("IDM_PARITY_TEST_FAIL_AFTER_REPLACE");
    expect(source).toContain("IDM_PARITY_TEST_EXTRA_ARTIFACT");
    expect(source).toMatch(/lstatSync\(committedPath\)[\s\S]*isSymbolicLink/u);
  });

  it("verifies before import when a dirty module contains an import sentinel", () => {
    const checkout = createExactCheckout();
    const sentinel = join(checkout.root, "import-side-effect");
    const initFile = join(checkout.checkout, "idm_heatpump/__init__.py");
    const original = readFileSync(initFile, "utf8");
    writeFileSync(
      initFile,
      `${original}\nfrom pathlib import Path\nPath(${JSON.stringify(sentinel)}).write_text('imported')\n`,
    );

    const result = runGenerator(checkout);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("dirty_checkout");
    expect(existsSync(sentinel)).toBe(false);
  }, 120_000);

  it("verifies before import for wrong origins and branch-only references", () => {
    const wrongOrigin = createExactCheckout();
    requireSuccess(
      run(
        "git",
        ["remote", "set-url", "origin", "https://example.invalid/wrong"],
        wrongOrigin.checkout,
      ),
      "wrong origin setup",
    );

    const originResult = runGenerator(wrongOrigin);
    expect(originResult.status).not.toBe(0);
    expect(originResult.stderr).toContain("origin_mismatch");

    const branchCheckout = createExactCheckout();
    requireSuccess(
      run("git", ["switch", "--quiet", "--create", "branch-only"], branchCheckout.checkout),
      "branch setup",
    );

    const branchResult = runGenerator(branchCheckout);
    expect(branchResult.status).not.toBe(0);
    expect(branchResult.stderr).toContain("branch_checkout");
  }, 120_000);

  it("rejects arbitrary output roots", () => {
    const checkout = createExactCheckout();
    const arbitrary = resolve(dirname(checkout.root), "not-a-contract-temp-root");
    mkdirSync(arbitrary, { recursive: true });
    temporaryDirectories.push(arbitrary);

    const result = run(PYTHON, [
      GENERATOR,
      "--manifest",
      MANIFEST,
      "--upstream-dir",
      checkout.checkout,
      "--output-root",
      arbitrary,
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("invalid_output_root");
  }, 120_000);

  it("normalization losslessly tags exceptional numbers and sorts sets and mappings", () => {
    const result = importGenerator(
      "module.normalize_contract_value({'set': {3, 1, 2}, 'tuple': (1, None), " +
        "'finite': {1e-9, 1e-10, -1e-9, -1e-10, 1e20, 1e21}, " +
        "'numbers': [float('nan'), float('inf'), float('-inf'), -0.0]})",
    );
    requireSuccess(result, "normalization probe");

    expect(JSON.parse(result.stdout)).toEqual({
      finite: [-1e-9, -1e-10, 1e-10, 1e-9, 1e20, 1e21],
      numbers: [
        { $number: "NaN" },
        { $number: "+Infinity" },
        { $number: "-Infinity" },
        { $number: "-0" },
      ],
      set: [1, 2, 3],
      tuple: [1, null],
    });
  });

  it("normalization rejects unknown or mixed reserved number envelopes", () => {
    for (const expression of [
      "module.validate_contract_value({'$number': 'Other'})",
      "module.validate_contract_value({'$number': 'NaN', 'extra': True})",
    ]) {
      const result = importGenerator(expression);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("invalid_number_tag");
    }
  });

  it("preserves raw Python set identity facts before contract normalization", () => {
    const negativeZero = importGenerator("module.normalize_contract_value({-0.0})");
    requireSuccess(negativeZero, "negative-zero set probe");
    expect(JSON.parse(negativeZero.stdout)).toEqual([{ $number: "-0" }]);

    const twoNaNs = importGenerator(
      "(lambda left, right: {'size': len({left, right}), " +
        "'normalized': module.normalize_contract_value({left, right})})" +
        "(float('nan'), float('nan'))",
    );
    requireSuccess(twoNaNs, "distinct-NaN set probe");
    expect(JSON.parse(twoNaNs.stdout)).toEqual({
      normalized: [{ $number: "NaN" }, { $number: "NaN" }],
      size: 2,
    });
  });

  it("accepts safe Python integers and rejects out-of-domain integer values and keys", () => {
    const boundaries = importGenerator(
      "module.normalize_contract_value({" +
        "'values': [-9007199254740991, 9007199254740991], " +
        "-9007199254740991: 'minimum', 9007199254740991: 'maximum', " +
        "'float': 1e20})",
    );
    requireSuccess(boundaries, "safe integer boundary probe");
    expect(JSON.parse(boundaries.stdout)).toEqual({
      "-9007199254740991": "minimum",
      "9007199254740991": "maximum",
      float: 1e20,
      values: [-9007199254740991, 9007199254740991],
    });

    for (const expression of [
      "module.normalize_contract_value(9007199254740992)",
      "module.normalize_contract_value(-9007199254740992)",
      "module.normalize_contract_value({9007199254740992: 'value'})",
      "module.normalize_contract_value({-9007199254740992: 'value'})",
      "module.validate_contract_value(9007199254740992)",
      "module.validate_contract_value(-9007199254740992)",
    ]) {
      const result = importGenerator(expression);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("invalid_contract_value");
    }
  }, 30_000);

  it("generates complete fixtures with exact API, class, codec, schema, and scenario facts", () => {
    const checkout = createExactCheckout();
    const result = runGenerator(checkout);
    requireSuccess(result, "fixture generation");

    const fixtures = Object.fromEntries(
      FIXTURE_NAMES.map((name) => [name, readJson<FixtureRoot>(fixturePath(checkout, name))]),
    ) as Record<(typeof FIXTURE_NAMES)[number], FixtureRoot>;

    for (const fixture of Object.values(fixtures)) {
      expect(fixture.schema_version).toBe(1);
      expect(fixture.generator_version).toBe("1");
      expect(fixture.baseline).toEqual({
        repository: CANONICAL_ORIGIN,
        python_package: "idm-heatpump-api",
        python_version: "0.7.6",
        git_tag: "v0.7.6",
        git_commit: PINNED_COMMIT,
        parity_schema_version: 1,
      });
    }

    const publicApi = fixtures["public-api.json"] as FixtureRoot & {
      readonly symbols: readonly {
        readonly name: string;
        readonly source_group: string;
        readonly export_boundary: string;
      }[];
      readonly counts: { readonly total: number; readonly root: number; readonly web: number };
      readonly aliases: readonly { readonly name: string; readonly target: string }[];
    };
    expect(publicApi.symbols).toHaveLength(89);
    expect(publicApi.counts).toEqual({ total: 89, root: 59, web: 30 });
    expect(publicApi.symbols.map(({ name }) => name)).toEqual([
      ...new Set(publicApi.symbols.map(({ name }) => name)),
    ]);
    expect(publicApi.aliases.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "AuthenticationError",
        "ConnectionError",
        "CsrfError",
        "PinRejectedError",
        "ProtocolError",
        "TimeoutError",
        "WebSocketError",
      ]),
    );

    const publicClasses = fixtures["public-classes.json"] as FixtureRoot & {
      readonly classes: readonly {
        readonly public_names: readonly string[];
        readonly constructor: {
          readonly signature: string;
          readonly parameters: readonly unknown[];
        };
        readonly members: readonly {
          readonly name: string;
          readonly kind: string;
          readonly signature?: string;
        }[];
        readonly validation_boundaries: readonly unknown[];
      }[];
    };
    const classNames = publicClasses.classes.flatMap(({ public_names }) => public_names);
    expect(classNames).toContain("RegisterDef");
    expect(classNames).toContain("IdmModbusClient");
    expect(classNames).toContain("IdmWebData");
    expect(
      publicClasses.classes.every(({ constructor }) => constructor.parameters.length >= 0),
    ).toBe(true);
    const forbiddenClassKeys = [
      "typescript_symbol",
      "representation",
      "owner_phase",
      "export_path",
      "status",
      "mapping_evidence",
    ];
    const classKeys = collectObjectKeys(publicClasses);
    expect(forbiddenClassKeys.filter((key) => classKeys.has(key))).toEqual([]);

    const codecs = fixtures["codec-vectors.json"] as FixtureRoot & {
      readonly layers: {
        readonly primitive: { readonly cases: readonly { readonly id: string }[] };
        readonly register: { readonly cases: readonly { readonly id: string }[] };
      };
    };
    const codecIds = [...codecs.layers.primitive.cases, ...codecs.layers.register.cases].map(
      ({ id }) => id,
    );
    expect(codecIds).toEqual(
      expect.arrayContaining([
        "primitive_float32_low_word_first",
        "primitive_float32_swapped",
        "primitive_float32_negative_zero",
        "primitive_float32_nan",
        "primitive_float32_positive_infinity",
        "primitive_float32_subnormal",
        "primitive_float32_overflow",
        "primitive_float32_word_below_range",
        "primitive_int8_boundaries",
        "primitive_int16_boundaries",
        "register_float_extra_word",
        "register_float_short",
        "register_uint16_direct_first_word",
        "register_integer_tie_rounding",
        "register_round_two_digits",
        "register_bool_masking",
        "register_bitflag_masking",
      ]),
    );

    const registerSchema = fixtures["register-schema.json"] as FixtureRoot & {
      readonly maps: Readonly<Record<string, Readonly<Record<string, Record<string, unknown>>>>>;
      readonly documented_overlaps: readonly {
        readonly address: number;
        readonly names: readonly string[];
      }[];
      readonly builder_contract: Readonly<Record<string, unknown>>;
    };
    expect(
      Object.fromEntries(
        Object.entries(registerSchema.maps).map(([name, map]) => [name, Object.keys(map).length]),
      ),
    ).toEqual({
      default: 267,
      navigator_10_full: 587,
      navigator_20_circuit_a: 105,
    });
    const expectedRegisterFields = [
      "address",
      "datatype",
      "name",
      "unit",
      "writable",
      "min_val",
      "max_val",
      "enum_options",
      "multiplier",
      "register_type",
      "eeprom_sensitive",
      "cyclic_required",
      "cyclic_write_ttl",
      "binary",
      "enabled_by_default",
      "state_class",
      "icon",
      "write_only",
      "write_class",
      "exclude_from_write",
      "source",
      "source_version",
      "supported_models",
      "sentinel_values",
      "last_verified",
      "size",
    ].sort();
    for (const map of Object.values(registerSchema.maps)) {
      for (const register of Object.values(map)) {
        expect(Object.keys(register).sort()).toEqual(expectedRegisterFields);
      }
    }
    expect(registerSchema.documented_overlaps).toEqual([
      { address: 1393, names: ["hc_a_mode", "humidity_sensor"] },
      { address: 1442, names: ["hc_a_heating_limit", "hc_g_heating_curve"] },
      { address: 1484, names: ["hc_a_cooling_limit", "hc_g_room_setpoint_cool_eco"] },
    ]);
    expect(registerSchema.builder_contract).toHaveProperty("circuits");
    expect(registerSchema.builder_contract).toHaveProperty("zones");
    expect(registerSchema.builder_contract).toHaveProperty("rooms");
    expect(registerSchema.builder_contract).toHaveProperty("models");
    expect(registerSchema.builder_contract).toHaveProperty("features");
    expect(registerSchema.builder_contract).toHaveProperty("registry_surface");

    const behavior = fixtures["behavior-contract.json"] as FixtureRoot & {
      readonly scenarios: readonly Record<string, unknown>[];
    };
    const scenarioFields = [
      "name",
      "configuration",
      "transport_responses",
      "clock",
      "operation",
      "expected_result",
      "expected_requests",
      "expected_state",
    ].sort();
    expect(behavior.scenarios.length).toBeGreaterThan(0);
    for (const scenario of behavior.scenarios) {
      expect(Object.keys(scenario).sort()).toEqual(scenarioFields);
    }

    const allFixtureText = FIXTURE_NAMES.map((name) =>
      readFileSync(fixturePath(checkout, name), "utf8"),
    ).join("\n");
    expect(allFixtureText).toContain('"$number": "-0"');
    expect(allFixtureText).toContain('"$number": "NaN"');
    expect(allFixtureText).not.toMatch(/Navigator 1\.[07]/u);

    expect(fixtures["web-contract.json"]).toMatchObject({
      release_blocking: true,
      deferred_to_phase: 4,
      evidence_kind: "deferred_marker",
    });

    const transport = fixtures["transport-behavior.json"] as TransportScenarioFixture;
    expect(transport.operation_kinds).toEqual([
      "lifecycle",
      "read_register",
      "read_batch",
      "probe",
      "detect_model",
      "diagnostics",
      "reset_failed_registers",
    ]);
    expect(transport.scenarios.length).toBeGreaterThanOrEqual(30);
    const transportNames = transport.scenarios.map(({ name }) => name);
    expect(transportNames).toEqual([...new Set(transportNames)]);
    expect(transportNames).toEqual(
      expect.arrayContaining([
        "lifecycle_connect_disconnect_force_reconnect",
        "serialization_parallel_reads",
        "read_input_fc04",
        "read_holding_fc03",
        "probe_fractional_timeout_half_even",
        "probe_timeout_lower_positive_boundary",
        "batch_adjacent",
        "batch_gap_split",
        "batch_register_type_split",
        "batch_max_span_split",
        "overlap_humidity_and_mode_1393",
        "overlap_heating_curve_and_limit_1442",
        "overlap_cooling_setpoint_and_limit_1484",
        "retry_timeout_reconnect",
        "retry_disconnected_reconnect",
        "retry_socket_reconnect",
        "retry_no_response_reconnect",
        "retry_modbus_same_connection",
        "retry_modbus_three_attempt_backoff",
        "invalid_short_response",
        "batch_device_error_fallback",
        "batch_transport_error_propagates",
        "unsupported_illegal_address",
        "permanent_after_third_modbus_failure",
        "successful_individual_read_clears_failure",
        "batch_suspect_quarantine_and_reread",
        "invalid_individual_value_omitted",
        "consumer_quarantine_order",
        "detect_unknown",
        "detect_navigator_20",
        "detect_navigator_pro",
        "detect_navigator_10_full",
        "detect_unavailable_slots_and_cascade_sentinel",
        "diagnostics_redacted_error",
        "reset_failed_register_state",
      ]),
    );

    const transportScenarioFields = [
      "name",
      "configuration",
      "transport_responses",
      "clock",
      "operation",
      "expected_result",
      "expected_requests",
      "expected_state",
    ].sort();
    for (const scenario of transport.scenarios) {
      expect(Object.keys(scenario).sort()).toEqual(transportScenarioFields);
      expect(scenario.configuration).toMatchObject({ host: "example.invalid" });
    }

    const closedErrors = new Set([
      "timeout",
      "disconnected",
      "socket",
      "no_response",
      "modbus",
      "illegal_address",
      "invalid_response",
    ]);
    const projections = collectErrorProjections(transport);
    expect(new Set(projections.map(({ errorType }) => errorType))).toEqual(closedErrors);
    for (const projection of projections) {
      expect(closedErrors.has(projection.errorType)).toBe(true);
      expect(projection.message.length).toBeLessThanOrEqual(1_024);
      expect(projection.message).not.toContain("example.invalid");
      expect(projection.message).not.toContain("127.0.0.1");
      expect(projection.message.match(/<[^>]+>/gu) ?? []).toEqual(expect.arrayContaining([]));
      expect(
        (projection.message.match(/<[^>]+>/gu) ?? []).every(
          (placeholder) => placeholder === "<endpoint>",
        ),
      ).toBe(true);
    }

    const overlap = Object.fromEntries(
      transport.scenarios
        .filter(({ name }) => name.startsWith("overlap_"))
        .map(({ name, expected_requests }) => [name, expected_requests]),
    );
    expect(overlap).toMatchObject({
      overlap_humidity_and_mode_1393: [
        {
          kind: "read",
          request: { address: 1392, count: 2, functionCode: 4, registerType: "input" },
        },
        {
          kind: "read",
          request: { address: 1393, count: 1, functionCode: 4, registerType: "input" },
        },
      ],
      overlap_heating_curve_and_limit_1442: [
        {
          kind: "read",
          request: { address: 1441, count: 2, functionCode: 4, registerType: "input" },
        },
        {
          kind: "read",
          request: { address: 1442, count: 1, functionCode: 4, registerType: "input" },
        },
      ],
      overlap_cooling_setpoint_and_limit_1484: [
        {
          kind: "read",
          request: { address: 1483, count: 2, functionCode: 4, registerType: "input" },
        },
        {
          kind: "read",
          request: { address: 1484, count: 1, functionCode: 4, registerType: "input" },
        },
      ],
    });

    const serialized = transport.scenarios.find(
      ({ name }) => name === "serialization_parallel_reads",
    );
    expect(serialized?.expected_state).toMatchObject({ maxActiveRequests: 1 });

    const transportText = readFileSync(fixturePath(checkout, "transport-behavior.json"), "utf8");
    expect(transportText.endsWith("\n")).toBe(true);
    expect(transportText).not.toMatch(
      /Navigator 1\.[07]|(?:10|127|169\.254|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}|"(?:pin|serial_number|device_id|raw_capture)"\s*:/iu,
    );

    const write = fixtures["write-behavior.json"] as TransportScenarioFixture;
    expect(write.operation_kinds).toEqual([
      "simulate_write",
      "write_register",
      "set_value",
      "advance_time",
      "reset_write_throttle",
      "get_active_cyclic_writes",
      "get_expired_cyclic_writes",
      "reset_cyclic_write_state",
    ]);
    const writeNames = write.scenarios.map(({ name }) => name);
    expect(writeNames).toEqual([...new Set(writeNames)]);
    expect(writeNames).toEqual(
      expect.arrayContaining([
        "simulate_one_word_default",
        "simulate_float_low_word_first",
        "set_value_dry_run_no_traffic",
        "write_validation_unknown_key",
        "write_validation_model_unavailable",
        "write_validation_custom_bypass",
        "write_validation_boolean_required",
        "write_validation_nonfinite_nan",
        "write_validation_integer_required",
        "write_validation_excluded_precedence",
        "write_validation_below_minimum",
        "write_validation_above_maximum",
        "write_validation_enum_unsupported",
        "write_fc16_one_word",
        "write_fc16_float_low_word_first",
        "eeprom_exact_60_second_boundary",
        "eeprom_reset_scopes",
        "cyclic_default_ttl_boundary",
        "cyclic_custom_ttl_refresh_and_resets",
        "write_retry_modbus_eventual_success",
        "write_retry_code_2_is_modbus",
        "write_retry_transport_reconnect",
        "write_retry_exhaustion_rollback",
        "write_failed_cyclic_refresh_preserves_deadline",
        "write_diagnostics_redacted_and_last_error_retained",
        "write_fifo_ordering",
      ]),
    );
    expect(write.scenarios.length).toBeGreaterThanOrEqual(26);
    for (const scenario of write.scenarios) {
      expect(Object.keys(scenario).sort()).toEqual(transportScenarioFields);
      expect(scenario.configuration).toMatchObject({ host: "example.invalid" });
    }
  }, 120_000);

  it("is deterministic and keeps check mode byte- and mtime-non-mutating", () => {
    const checkout = createExactCheckout();
    requireSuccess(runGenerator(checkout), "initial fixture generation");
    const first = fixtureSnapshot(checkout);

    requireSuccess(runGenerator(checkout), "repeat fixture generation");
    const second = fixtureSnapshot(checkout);
    for (const name of FIXTURE_NAMES) {
      expect(second[name]?.bytes.equals(first[name]?.bytes ?? Buffer.alloc(0))).toBe(true);
      expect(second[name]?.bytes.toString("utf8").endsWith("\n")).toBe(true);
    }

    const cleanCheckBefore = fixtureSnapshot(checkout);
    const cleanCheck = runGenerator(checkout, ["--check"]);
    requireSuccess(cleanCheck, "clean check mode");
    const cleanCheckAfter = fixtureSnapshot(checkout);
    for (const name of FIXTURE_NAMES) {
      expect(
        cleanCheckAfter[name]?.bytes.equals(cleanCheckBefore[name]?.bytes ?? Buffer.alloc(0)),
      ).toBe(true);
      expect(cleanCheckAfter[name]?.mtimeMs).toBe(cleanCheckBefore[name]?.mtimeMs);
    }

    const changedPath = fixturePath(checkout, "public-api.json");
    const changed = readJson<Record<string, unknown>>(changedPath);
    writeFileSync(changedPath, `${JSON.stringify({ ...changed, drift: true }, undefined, 2)}\n`);
    const driftBefore = fixtureSnapshot(checkout);
    const driftCheck = runGenerator(checkout, ["--check"]);
    expect(driftCheck.status).not.toBe(0);
    expect(driftCheck.stderr).toContain("contract_drift");
    expect(driftCheck.stderr).toContain("test/fixtures/public-api.json");
    expect(driftCheck.stderr).toContain("semantic difference");
    const driftAfter = fixtureSnapshot(checkout);
    for (const name of FIXTURE_NAMES) {
      expect(driftAfter[name]?.bytes.equals(driftBefore[name]?.bytes ?? Buffer.alloc(0))).toBe(
        true,
      );
      expect(driftAfter[name]?.mtimeMs).toBe(driftBefore[name]?.mtimeMs);
    }
  }, 120_000);

  it("provides transactional rollback for all ten artifacts when replacement fails", () => {
    const checkout = createExactCheckout();
    requireSuccess(runGenerator(checkout), "initial fixture generation");
    for (const name of FIXTURE_NAMES) {
      writeFileSync(fixturePath(checkout, name), `preserved:${name}\n`);
    }
    const before = fixtureSnapshot(checkout);

    const failed = runGenerator(checkout, [], {
      ...process.env,
      IDM_CONTRACT_TEST_FAIL_AFTER_REPLACE: "1",
    });

    expect(failed.status).not.toBe(0);
    expect(failed.stderr).toContain("injected_failure");
    const after = fixtureSnapshot(checkout);
    for (const name of FIXTURE_NAMES) {
      expect(after[name]?.bytes.equals(before[name]?.bytes ?? Buffer.alloc(0))).toBe(true);
      expect(after[name]?.mtimeMs).toBe(before[name]?.mtimeMs);
    }
  }, 120_000);
});
