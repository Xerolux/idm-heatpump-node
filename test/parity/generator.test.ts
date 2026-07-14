import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
});

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
      run("git", ["remote", "set-url", "origin", "https://example.invalid/wrong"], wrongOrigin.checkout),
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
});
