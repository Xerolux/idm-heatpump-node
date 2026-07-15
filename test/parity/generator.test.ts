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
        "'numbers': [float('nan'), float('inf'), float('-inf'), -0.0]})",
    );
    requireSuccess(result, "normalization probe");

    expect(JSON.parse(result.stdout)).toEqual({
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

  it("atomically rolls back every prior fixture when transaction replacement fails", () => {
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
