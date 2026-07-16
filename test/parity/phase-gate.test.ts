import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getRegister, IdmModbusClient } from "../../src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const orchestrator = resolve(root, "scripts/check-parity.mjs");
const upstreamSource = resolve(root, "../idm-heatpump-api");
const canonicalRepository = "https://github.com/Xerolux/idm-heatpump-api";
const pinnedCommit = "ad121ebf34a5f5e37204371c026927d77efcd15c";
const pinnedTag = "v0.7.6";
const temporaryPrefix = "idm-heatpump-contract-";
const phase2RuntimeSymbols = [
  "IdmClientDiagnostics",
  "IdmModbusClient",
  "IllegalAddressError",
  "ModbusErrorContext",
  "quietPymodbusLogging",
] as const;
const phase2OmittedWriteMembers = [
  "getActiveCyclicWrites",
  "getExpiredCyclicWrites",
  "resetCyclicWriteState",
  "resetWriteThrottle",
  "setValue",
  "simulateWrite",
  "writeRegister",
] as const;
const generatedPaths = [
  "test/fixtures/public-api.json",
  "test/fixtures/public-classes.json",
  "test/fixtures/codec-vectors.json",
  "test/fixtures/register-schema.json",
  "test/fixtures/behavior-contract.json",
  "test/fixtures/web-contract.json",
  "test/fixtures/transport-behavior.json",
  "docs/API-PARITY.md",
  "docs/BASELINE.md",
] as const;

interface CommandResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

interface FileSnapshot {
  readonly bytes: Buffer;
  readonly mtimeNs: bigint;
}

function run(
  command: string,
  args: readonly string[],
  cwd = root,
  environment: NodeJS.ProcessEnv = process.env,
  timeout = 180_000,
): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: environment,
    maxBuffer: 128 * 1024,
    shell: false,
    timeout,
    windowsHide: true,
  });

  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function git(args: readonly string[], cwd = root): string {
  const result = run("git", args, cwd, process.env, 30_000);
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout.trim();
}

function runOrchestrator(
  mode: "generate" | "check",
  checkout?: string,
  environment: NodeJS.ProcessEnv = process.env,
): CommandResult {
  const args = [orchestrator, mode];
  if (checkout !== undefined) {
    args.push("--upstream-dir", checkout);
  }
  return run(process.execPath, args, root, environment);
}

function createExactCheckout(parent: string, name: string): string {
  const checkout = join(parent, name);
  git(["clone", "--no-local", upstreamSource, checkout]);
  git(["checkout", "--detach", pinnedCommit], checkout);
  git(["remote", "set-url", "origin", canonicalRepository], checkout);
  return checkout;
}

function cloneRewriteEnvironment(): NodeJS.ProcessEnv {
  const sourceUrl = `${pathToFileURL(upstreamSource).href.replace(/\/$/u, "")}/`;
  return {
    ...process.env,
    IDM_HEATPUMP_API_DIR: resolve(tmpdir(), "must-not-be-read"),
    GIT_CONFIG_COUNT: "2",
    GIT_CONFIG_KEY_0: `url.${sourceUrl}.insteadOf`,
    GIT_CONFIG_VALUE_0: canonicalRepository,
    GIT_CONFIG_KEY_1: "protocol.file.allow",
    GIT_CONFIG_VALUE_1: "always",
  };
}

function parityTemporaryEntries(): ReadonlySet<string> {
  return new Set(readdirSync(tmpdir()).filter((name) => name.startsWith(temporaryPrefix)));
}

function expectNoNewTemporaryEntries(before: ReadonlySet<string>): void {
  const after = parityTemporaryEntries();
  expect([...after].filter((name) => !before.has(name))).toEqual([]);
}

function snapshotGenerated(): ReadonlyMap<string, FileSnapshot> {
  return new Map(
    generatedPaths.map((relativePath) => {
      const absolutePath = resolve(root, relativePath);
      const stats = statSync(absolutePath, { bigint: true });
      return [relativePath, { bytes: readFileSync(absolutePath), mtimeNs: stats.mtimeNs }];
    }),
  );
}

function expectGeneratedUnchanged(before: ReadonlyMap<string, FileSnapshot>): void {
  for (const relativePath of generatedPaths) {
    const expected = before.get(relativePath);
    expect(expected).toBeDefined();
    const absolutePath = resolve(root, relativePath);
    expect(readFileSync(absolutePath)).toEqual(expected?.bytes);
    expect(statSync(absolutePath, { bigint: true }).mtimeNs).toBe(expected?.mtimeNs);
  }
}

describe.sequential("parity orchestrator phase gate", () => {
  let temporaryDirectory = "";
  let exactCheckout = "";

  beforeAll(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "idm-phase-gate-tests-"));
    exactCheckout = createExactCheckout(temporaryDirectory, "exact checkout ; $literal");
  }, 45_000);

  afterAll(() => {
    if (temporaryDirectory !== "") {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it("self-provisions a full-tag exact baseline without an ambient upstream directory", () => {
    const beforeTemporary = parityTemporaryEntries();
    const beforeGenerated = snapshotGenerated();

    const result = runOrchestrator("check", undefined, cloneRewriteEnvironment());

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Self-provisioned exact upstream checkout");
    expect(result.stdout).toContain(pinnedCommit);
    expect(result.stdout).toContain(pinnedTag);
    expect(result.stdout).toContain("Parity check passed");
    expectGeneratedUnchanged(beforeGenerated);
    expectNoNewTemporaryEntries(beforeTemporary);
  }, 180_000);

  it("accepts an explicit exact checkout whose path contains shell metacharacters literally", () => {
    const beforeTemporary = parityTemporaryEntries();
    const beforeGenerated = snapshotGenerated();

    const result = runOrchestrator("check", exactCheckout, {
      ...process.env,
      IDM_HEATPUMP_API_DIR: resolve(tmpdir(), "ignored-ambient-checkout"),
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Verified explicit exact upstream checkout");
    expect(result.stdout).toContain("Parity check passed");
    expectGeneratedUnchanged(beforeGenerated);
    expectNoNewTemporaryEntries(beforeTemporary);
  }, 180_000);

  it("rejects a shallow checkout with the exact commit but no pinned tag before generation", () => {
    const checkout = join(temporaryDirectory, "shallow-missing-tag");
    git(["clone", "--depth", "1", "--no-tags", pathToFileURL(upstreamSource).href, checkout]);
    git(["fetch", "--depth", "1", "origin", pinnedCommit], checkout);
    git(["checkout", "--detach", pinnedCommit], checkout);
    git(["remote", "set-url", "origin", canonicalRepository], checkout);
    expect(git(["rev-parse", "--is-shallow-repository"], checkout)).toBe("true");
    expect(
      run("git", ["rev-parse", "--verify", `${pinnedTag}^{commit}`], checkout).status,
    ).not.toBe(0);

    const beforeGenerated = snapshotGenerated();
    const result = runOrchestrator("check", checkout);

    expect(result.status).not.toBe(0);
    expect(result.stderr.toLowerCase()).toContain("tag");
    expect(result.stderr).not.toContain("Generated 7 pinned semantic fixtures");
    expectGeneratedUnchanged(beforeGenerated);
  }, 45_000);

  it("rejects wrong and dirty exact-checkout candidates before importing upstream code", () => {
    const wrongOrigin = join(temporaryDirectory, "wrong-origin");
    cpSync(exactCheckout, wrongOrigin, { recursive: true });
    git(["remote", "set-url", "origin", "https://example.invalid/not-allowlisted"], wrongOrigin);
    const wrongResult = runOrchestrator("check", wrongOrigin);
    expect(wrongResult.status).not.toBe(0);
    expect(wrongResult.stderr.toLowerCase()).toContain("origin");

    const importSentinel = join(temporaryDirectory, "upstream-imported.txt");
    const dirtyCheckout = join(temporaryDirectory, "dirty-import-sentinel");
    cpSync(exactCheckout, dirtyCheckout, { recursive: true });
    writeFileSync(
      join(dirtyCheckout, "idm_heatpump", "__init__.py"),
      `${readFileSync(join(dirtyCheckout, "idm_heatpump", "__init__.py"), "utf8")}\n` +
        `from pathlib import Path\nPath(${JSON.stringify(importSentinel)}).write_text("imported")\n`,
    );

    const dirtyResult = runOrchestrator("check", dirtyCheckout);
    expect(dirtyResult.status).not.toBe(0);
    expect(dirtyResult.stderr.toLowerCase()).toContain("clean");
    expect(existsSync(importSentinel)).toBe(false);
  }, 45_000);

  it("detects drift in check mode without changing bytes or mtimes and cleans temporary state", () => {
    const target = resolve(root, "test/fixtures/transport-behavior.json");
    const original = readFileSync(target);
    writeFileSync(target, Buffer.concat([original, Buffer.from(" \n")]));
    const drifted = snapshotGenerated();
    const beforeTemporary = parityTemporaryEntries();
    try {
      const result = runOrchestrator("check", exactCheckout);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("contract_drift");
      expectGeneratedUnchanged(drifted);
      expectNoNewTemporaryEntries(beforeTemporary);
    } finally {
      writeFileSync(target, original);
    }
  }, 180_000);

  it.skipIf(process.platform === "win32")(
    "rejects symlinked committed artifacts without changing the nine generated artifacts",
    () => {
      const target = resolve(root, "test/fixtures/transport-behavior.json");
      const preserved = join(temporaryDirectory, "preserved-transport-behavior.json");
      writeFileSync(preserved, readFileSync(target));
      rmSync(target);
      symlinkSync(preserved, target, "file");
      const beforeTemporary = parityTemporaryEntries();
      try {
        const result = runOrchestrator("check", exactCheckout);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain("artifact_invalid");
        expect(lstatSync(target).isSymbolicLink()).toBe(true);
        expectNoNewTemporaryEntries(beforeTemporary);
      } finally {
        rmSync(target, { force: true });
        writeFileSync(target, readFileSync(preserved));
      }
    },
    180_000,
  );

  it("rejects extra staged generated paths without mutating committed artifacts", () => {
    const beforeGenerated = snapshotGenerated();
    const beforeTemporary = parityTemporaryEntries();

    const result = runOrchestrator("check", exactCheckout, {
      ...process.env,
      IDM_PARITY_TEST_EXTRA_ARTIFACT: "1",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("artifact_invalid");
    expectGeneratedUnchanged(beforeGenerated);
    expectNoNewTemporaryEntries(beforeTemporary);
  }, 180_000);

  it("rolls back all nine artifacts after an injected replacement failure", () => {
    const beforeGenerated = snapshotGenerated();
    const beforeTemporary = parityTemporaryEntries();

    const result = runOrchestrator("generate", exactCheckout, {
      ...process.env,
      IDM_PARITY_TEST_FAIL_AFTER_REPLACE: "7",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("artifact_replace_failed");
    expectGeneratedUnchanged(beforeGenerated);
    expectNoNewTemporaryEntries(beforeTemporary);
  }, 180_000);

  it("rolls back an injected mid-generation failure and always cleans owned paths", () => {
    const beforeGenerated = snapshotGenerated();
    const beforeTemporary = parityTemporaryEntries();

    const result = runOrchestrator("generate", exactCheckout, {
      ...process.env,
      IDM_CONTRACT_TEST_FAIL_AFTER_STAGE: "1",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("injected_failure");
    expectGeneratedUnchanged(beforeGenerated);
    expectNoNewTemporaryEntries(beforeTemporary);
  }, 180_000);

  it("ignores poisoned Python import state and never executes sitecustomize or shadow modules", () => {
    const poisonRoot = join(temporaryDirectory, "poisoned-python-environment");
    const siteSentinel = join(temporaryDirectory, "sitecustomize-executed.txt");
    const moduleSentinel = join(temporaryDirectory, "shadow-pymodbus-imported.txt");
    mkdirSync(join(poisonRoot, "pymodbus"), { recursive: true });
    writeFileSync(
      join(poisonRoot, "sitecustomize.py"),
      `from pathlib import Path\nPath(${JSON.stringify(siteSentinel)}).write_text("executed")\n`,
    );
    writeFileSync(
      join(poisonRoot, "pymodbus", "__init__.py"),
      `from pathlib import Path\nPath(${JSON.stringify(moduleSentinel)}).write_text("imported")\nraise RuntimeError("shadow pymodbus must not load")\n`,
    );

    const result = runOrchestrator("check", exactCheckout, {
      ...process.env,
      PYTHONHOME: poisonRoot,
      PYTHONPATH: poisonRoot,
      PYTHONSTARTUP: join(poisonRoot, "sitecustomize.py"),
      PYTHONUSERBASE: poisonRoot,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Parity check passed");
    expect(existsSync(siteSentinel)).toBe(false);
    expect(existsSync(moduleSentinel)).toBe(false);
  }, 180_000);

  it("uses bounded shell-free fixed process invocations and no ambient checkout fallback", () => {
    const source = readFileSync(orchestrator, "utf8");

    expect(source).toContain("MAX_PROCESS_OUTPUT_BYTES");
    expect(source).toContain("shell: false");
    expect(source).toContain('spawnSync("git"');
    expect(source).toContain('"pymodbus==3.12.1"');
    expect(source).toContain('"-I"');
    expect(source).toContain('"-i"');
    expect(source).toContain("REFERENCE_ENVIRONMENT_ALLOWLIST");
    expect(source).toContain('"scripts/generate-python-contract.py"');
    expect(source).toContain('"scripts/generate-api-parity.mjs"');
    expect(source).not.toContain("IDM_HEATPUMP_API_DIR");
    expect(source).not.toMatch(/\bexecSync\b|\bexecFileSync\b/u);
  });
});

describe("npm parity entry points and private package boundary", () => {
  it("keeps Phase-2 mapping promotion API-only before the non-mutating Python fixture check", () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      readonly scripts?: Readonly<Record<string, string>>;
    };
    const mapping = JSON.parse(
      readFileSync(resolve(root, "contracts/api-mapping.json"), "utf8"),
    ) as {
      readonly mappings: readonly {
        readonly owner_phase: number;
        readonly python_symbol: string;
        readonly status: string;
        readonly typescript_symbol: string;
      }[];
    };
    const apiDocument = readFileSync(resolve(root, "docs/API-PARITY.md"), "utf8");
    const completeRows = mapping.mappings.filter(({ status }) => status === "complete");

    expect(packageJson.scripts?.["parity:api"]).toBe("node scripts/generate-api-parity.mjs");
    expect(packageJson.scripts?.["parity:check"]).toBe("node scripts/check-parity.mjs check");
    expect(completeRows).toHaveLength(57);
    expect(completeRows.filter(({ owner_phase }) => owner_phase === 1)).toHaveLength(53);
    expect(completeRows.filter(({ owner_phase }) => owner_phase === 2)).toHaveLength(4);
    for (const row of completeRows) {
      expect(apiDocument, row.python_symbol).toContain(
        `| \`${row.python_symbol}\` | \`${row.typescript_symbol}\` | \`.\` | ${String(row.owner_phase)} | \`complete\` |`,
      );
    }
    expect(mapping.mappings.filter(({ status }) => status === "planned")).toHaveLength(31);
    expect(
      mapping.mappings.filter(
        ({ python_symbol, status }) => python_symbol === "IdmModbusClient" && status === "partial",
      ),
    ).toHaveLength(1);
  });

  it("wires all npm parity commands to fixed repository scripts", () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      readonly private?: boolean;
      readonly scripts?: Readonly<Record<string, string>>;
    };

    expect(packageJson.scripts?.["parity:generate"]).toBe("node scripts/check-parity.mjs generate");
    expect(packageJson.scripts?.["parity:api"]).toBe("node scripts/generate-api-parity.mjs");
    expect(packageJson.scripts?.["parity:check"]).toBe("node scripts/check-parity.mjs check");
    expect(packageJson.private).toBe(true);
  });

  it("keeps package exports behind complete checked mapping and generated documentation", () => {
    const mapping = JSON.parse(
      readFileSync(resolve(root, "contracts/api-mapping.json"), "utf8"),
    ) as {
      readonly mappings: readonly {
        readonly export_path: "." | "./web";
        readonly python_symbol: string;
        readonly status: string;
        readonly typescript_symbol: string;
      }[];
    };
    const apiDocument = readFileSync(resolve(root, "docs/API-PARITY.md"), "utf8");
    const rootSource = readFileSync(resolve(root, "src/index.ts"), "utf8");
    const webSource = readFileSync(resolve(root, "src/web/index.ts"), "utf8");

    for (const row of mapping.mappings) {
      const documentedStatus = `| \`${row.python_symbol}\` | \`${row.typescript_symbol}\` | \`${row.export_path}\` |`;
      expect(apiDocument, row.python_symbol).toContain(documentedStatus);
      if (row.status === "complete" || row.python_symbol === "IdmModbusClient") {
        expect(row.export_path, row.python_symbol).toBe(".");
        expect(rootSource, row.typescript_symbol).toContain(row.typescript_symbol);
      } else {
        expect(rootSource, row.typescript_symbol).not.toContain(row.typescript_symbol);
        expect(webSource, row.typescript_symbol).not.toContain(row.typescript_symbol);
      }
    }
    expect(webSource).toMatch(/export \{\};/u);
    expect(rootSource).not.toMatch(
      /createRegisterDef|decodeValue|encodeValue|serializeRegisterDef|getCommonRegisters/u,
    );
  });

  it("keeps Python, Git, contracts, fixtures, and tooling outside runtime dependencies and package", () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      readonly dependencies?: Readonly<Record<string, string>>;
      readonly devDependencies?: Readonly<Record<string, string>>;
      readonly files?: readonly string[];
      readonly private?: boolean;
      readonly scripts?: Readonly<Record<string, string>>;
    };
    expect(packageJson.private).toBe(true);
    expect(packageJson.dependencies ?? {}).toEqual({ "modbus-serial": "8.0.25" });
    expect(packageJson.files).toEqual(["dist"]);
    expect(packageJson.devDependencies).not.toHaveProperty("pymodbus");
    expect(packageJson.scripts).toMatchObject({
      build: "tsup",
      check:
        "npm run format:check && npm run lint && npm run typecheck && npm run test:coverage && npm run build && npm run pack:check",
      "pack:check": "npm run build && node scripts/check-package.mjs",
      prepack: "npm run build",
    });

    const npmCli = process.env.npm_execpath;
    expect(npmCli).toBeDefined();
    const packed = run(process.execPath, [
      npmCli ?? "",
      "pack",
      "--dry-run",
      "--json",
      "--ignore-scripts",
    ]);
    expect(packed.status, packed.stderr).toBe(0);
    const report = JSON.parse(packed.stdout) as readonly [
      { readonly files: readonly { readonly path: string }[] },
    ];
    const paths = report[0].files.map(({ path }) => path);
    expect(paths).toContain("dist/index.js");
    expect(paths).toContain("dist/web/index.js");
    expect(
      paths.filter((path) =>
        /^(?:scripts|test|contracts|docs|\.planning|UPSTREAM-PARITY\.json)(?:\/|$)/u.test(path),
      ),
    ).toEqual([]);
    expect(paths.sort()).toEqual(
      [
        "LICENSE",
        "README.md",
        "dist/index.cjs",
        "dist/index.cjs.map",
        "dist/index.d.cts",
        "dist/index.d.ts",
        "dist/index.js",
        "dist/index.js.map",
        "dist/web/index.cjs",
        "dist/web/index.cjs.map",
        "dist/web/index.d.cts",
        "dist/web/index.d.ts",
        "dist/web/index.js",
        "dist/web/index.js.map",
        "package.json",
      ].sort(),
    );
  }, 30_000);

  it("requires the package tarball ESM CommonJS declaration smoke to cover Phase 2 without connecting", () => {
    const source = readFileSync(resolve(root, "scripts/check-package.mjs"), "utf8");

    for (const symbol of phase2RuntimeSymbols) {
      expect(source, symbol).toContain(symbol);
    }
    expect(source).toContain("ModbusTransport");
    expect(source).toContain("EXPECTED_TARBALL_FILES");
    expect(source).toContain('"modbus-serial": "8.0.25"');
    expect(source).toContain("@ts-expect-error");
    for (const member of phase2OmittedWriteMembers) {
      expect(source, member).toContain(member);
    }
    expect(source).not.toMatch(
      /\.(?:connect|readRegister|readBatch|probeRegister|detectModel)\s*\(/u,
    );
  });
});

describe("GitHub Actions workflow contract", () => {
  const workflow = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");

  it("keeps read-only Node 22 and Node 24 validation with SHA-pinned actions", () => {
    expect(workflow).toMatch(/permissions:\s*\n\s+contents: read/u);
    expect(workflow).not.toMatch(/contents:\s*write|id-token:\s*write|packages:\s*write/u);
    expect(workflow).toMatch(/matrix:[\s\S]*?node:\s*\n\s+- 22\s*\n\s+- 24/u);

    const actionReferences = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+).*$/gmu)]
      .map((match) => match[1])
      .filter((reference): reference is string => reference !== undefined);
    expect(actionReferences.length).toBeGreaterThanOrEqual(5);
    expect(actionReferences.every((reference) => /@[0-9a-f]{40}$/u.test(reference))).toBe(true);
  });

  it("runs exact Python 3.12 parity:check from a full-tag workflow checkout", () => {
    const manifest = JSON.parse(readFileSync(resolve(root, "UPSTREAM-PARITY.json"), "utf8")) as {
      readonly git_commit: string;
      readonly git_tag: string;
      readonly python_version: string;
    };
    const parityJob = workflow.match(/^\s{2}parity:\s*$([\s\S]*)/mu)?.[1] ?? "";

    expect(manifest).toMatchObject({
      python_version: "0.7.6",
      git_tag: pinnedTag,
      git_commit: pinnedCommit,
    });
    expect(parityJob).toMatch(/python-version:\s*["']?3\.12["']?/u);
    expect(parityJob).toMatch(/fetch-depth:\s*0/u);
    expect(parityJob).toMatch(/fetch-tags:\s*true/u);
    expect(parityJob).toMatch(/run:\s*npm ci/u);
    expect(parityJob.match(/run:\s*npm run parity:check/gu)).toHaveLength(1);
    expect(parityJob).not.toMatch(
      /parity:generate|generate-python-contract|generate-api-parity|pip\s+install/u,
    );
  });

  it("keeps the workflow free of secrets, environments, and device inputs", () => {
    expect(workflow).not.toMatch(/\bsecrets\.|^\s*environment:|IDM_(?:HOST|PORT|SLAVE|PIN)/mu);
    expect(workflow).not.toMatch(/workflow_call:|repository_dispatch:|schedule:/u);
  });
});

describe("Phase 2 truthful documentation and closure", () => {
  it("README documents the exact private Phase 2 read, detection, and resilience scope", () => {
    const readme = readFileSync(resolve(root, "README.md"), "utf8");

    expect(readme).toMatch(/Phase 2[\s\S]*(?:implementiert|abgeschlossen)/u);
    expect(readme).toContain("private: true");
    expect(readme).toContain("0.7.6");
    expect(readme).toContain(pinnedTag);
    expect(readme).toContain(pinnedCommit);
    expect(readme).toContain("npm run parity:check");
    expect(readme).toContain("npm run parity:generate");
    for (const implementedArea of [
      "Modbus TCP",
      "FC03",
      "FC04",
      "Batching",
      "Erkennung",
      "Retry",
      "Reconnect",
      "Diagnostik",
    ]) {
      expect(readme, implementedArea).toContain(implementedArea);
    }
    for (const pendingArea of ["Writes", "Web-Supplement", "Veröffentlichung", "Gesamtparität"]) {
      expect(readme, pendingArea).toContain(pendingArea);
    }
    expect(readme).toMatch(/Navigator 1\.0\/1\.7[\s\S]*(?:nicht unterstützt|ausgeschlossen)/u);
    expect(readme).toContain("keine integrierte TLS-Verschlüsselung");
    expect(readme).toContain("keine Modbus-Authentifizierung");
    expect(readme).toMatch(/vertrauenswürdigen\s+lokalen Netzwerk/u);
    expect(readme).toMatch(/Keine\s+Node-Hardwarevalidierung durchgeführt\./u);
    expect(readme).not.toMatch(/noch keinen Modbus-Transport|Phase 2[^\n]*(?:geplant|Transport)/u);
    expect(readme).toMatch(/nicht (?:auf npm )?veröffentlicht/u);
  });

  it("README register examples use canonical keys exposed by the public API", () => {
    const readme = readFileSync(resolve(root, "README.md"), "utf8");
    const documentedKeys = [...readme.matchAll(/\bgetRegister\(\s*["']([^"']+)["']\s*\)/gu)].map(
      (match) => match[1],
    );

    expect(documentedKeys).toContain("outdoor_temp");
    expect(readme).not.toContain('getRegister("outdoor_temperature")');
    for (const key of documentedKeys) {
      expect(key).toBeDefined();
      expect(getRegister(key ?? "").name).toBe(key);
    }
  });

  it("CHANGELOG records exact Phase 2 evidence, pending scope, and no Node hardware validation", () => {
    const changelogPath = resolve(root, "CHANGELOG.md");
    expect(existsSync(changelogPath)).toBe(true);
    const changelog = readFileSync(changelogPath, "utf8");

    expect(changelog).toContain("## [Unreleased]");
    expect(changelog).toContain("0.7.6");
    expect(changelog).toContain(pinnedTag);
    expect(changelog).toContain(pinnedCommit);
    expect(changelog).toContain("private: true");
    expect(changelog).toContain("Keine Node-Hardwarevalidierung durchgeführt.");
    expect(changelog).toContain("ModbusTransport");
    expect(changelog).toMatch(/FC03[\s\S]*FC04/u);
    expect(changelog).toMatch(/Batch|Fallback|Quarantäne/u);
    expect(changelog).toMatch(/Modell|Erkennung/u);
    expect(changelog).toMatch(/Retry|Reconnect/u);
    expect(changelog).toMatch(/Diagnostik/u);
    expect(changelog).toMatch(/Writes[\s\S]*Web-Supplement[\s\S]*Veröffentlichung/u);
    expect(changelog).toContain("Gesamtparität");
    expect(changelog).toContain("Navigator 1.0/1.7");
    expect(changelog).toContain("keine integrierte TLS-Verschlüsselung");
    expect(changelog).toMatch(/keine\s+Modbus-Authentifizierung/u);
  });

  it("keeps exactly seven fixtures plus two documents as nine generated artifacts", () => {
    const fixtures = generatedPaths.filter((path) => path.startsWith("test/fixtures/"));
    const documents = generatedPaths.filter((path) => path.startsWith("docs/"));

    expect(fixtures).toHaveLength(7);
    expect(documents).toHaveLength(2);
    expect(generatedPaths).toHaveLength(9);
    expect(new Set(generatedPaths).size).toBe(9);
    for (const relativePath of generatedPaths) {
      expect(existsSync(resolve(root, relativePath)), relativePath).toBe(true);
    }
  });

  it("closes only the Phase-2 read clauses while umbrella and write clauses stay pending", () => {
    const requirements = readFileSync(resolve(root, ".planning/REQUIREMENTS.md"), "utf8");
    const roadmap = readFileSync(resolve(root, ".planning/ROADMAP.md"), "utf8");
    const checked = (id: string): boolean => {
      const escapedId = id.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      const match = requirements.match(
        new RegExp(`^- \\[([ xX])\\] \\*\\*${escapedId}(?: \\(umbrella\\))?\\*\\*:`, "mu"),
      );
      expect(match, `requirement checkbox ${id}`).not.toBeNull();
      return match?.[1]?.toLowerCase() === "x";
    };

    for (const id of ["TRN-01", "TRN-02", "TRN-03R", "DET-01", "DET-02", "ERR-01R"]) {
      expect(checked(id), id).toBe(true);
    }
    for (const id of ["TRN-03", "TRN-03W", "ERR-01", "ERR-01W"]) {
      expect(checked(id), id).toBe(false);
    }
    expect(requirements).toContain("| TRN-03R     | Phase 2  | Complete");
    expect(requirements).toContain("| ERR-01R     | Phase 2  | Complete");
    expect(requirements).toContain(
      "| TRN-03      | Umbrella | Pending until TRN-03R and TRN-03W complete |",
    );
    expect(requirements).toContain(
      "| ERR-01      | Umbrella | Pending until ERR-01R and ERR-01W complete |",
    );
    expect(requirements).toContain("| TRN-03W     | Phase 3  | Pending");
    expect(requirements).toContain("| ERR-01W     | Phase 3  | Pending");
    expect(roadmap).toContain("**Requirements**: TRN-01, TRN-02, TRN-03R, DET-01, DET-02, ERR-01R");
    expect(roadmap).toContain("**Requirements**: WRT-01, WRT-02, TRN-03W, ERR-01W");
  });

  it("full gate keeps the package private, web-empty, covered, packaged, and parity-checked", () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      readonly files?: readonly string[];
      readonly private?: boolean;
      readonly scripts?: Readonly<Record<string, string>>;
    };
    const mapping = JSON.parse(
      readFileSync(resolve(root, "contracts/api-mapping.json"), "utf8"),
    ) as {
      readonly mappings: readonly {
        readonly export_path: string;
        readonly owner_phase: number;
        readonly partial_class?: {
          readonly implemented_members: readonly string[];
          readonly omitted_members: readonly string[];
        };
        readonly python_symbol: string;
        readonly status: string;
        readonly typescript_symbol: string;
      }[];
    };
    const extensions = JSON.parse(
      readFileSync(resolve(root, "contracts/typescript-extensions.json"), "utf8"),
    ) as {
      readonly extensions: readonly {
        readonly export_path: string;
        readonly kind: string;
        readonly no_python_counterpart: boolean;
        readonly owner_phase: number;
        readonly status: string;
        readonly typescript_symbol: string;
      }[];
    };
    const coverageConfig = readFileSync(resolve(root, "vitest.config.ts"), "utf8");
    const rootSource = readFileSync(resolve(root, "src/index.ts"), "utf8");
    const webSource = readFileSync(resolve(root, "src/web/index.ts"), "utf8");
    const workflow = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
    const completeRows = mapping.mappings.filter(({ status }) => status === "complete");
    const plannedRows = mapping.mappings.filter(({ status }) => status === "planned");
    const partialRows = mapping.mappings.filter(({ status }) => status === "partial");

    expect(packageJson.private).toBe(true);
    expect(packageJson.files).toEqual(["dist"]);
    expect(packageJson.scripts?.check).toBe(
      "npm run format:check && npm run lint && npm run typecheck && npm run test:coverage && npm run build && npm run pack:check",
    );
    expect(packageJson.scripts?.["pack:check"]).toContain("scripts/check-package.mjs");
    expect(packageJson.scripts?.["parity:check"]).toBe("node scripts/check-parity.mjs check");
    for (const threshold of ["branches", "functions", "lines", "statements"]) {
      expect(coverageConfig).toMatch(new RegExp("\\b" + threshold + ":\\s*80\\b", "u"));
    }
    expect(completeRows).toHaveLength(57);
    expect(
      completeRows.every(
        ({ export_path, owner_phase }) =>
          export_path === "." && (owner_phase === 1 || owner_phase === 2),
      ),
    ).toBe(true);
    expect(plannedRows).toHaveLength(31);
    expect(plannedRows.every(({ owner_phase }) => owner_phase >= 3)).toBe(true);
    expect(partialRows).toEqual([
      expect.objectContaining({ export_path: ".", owner_phase: 2, status: "partial" }),
    ]);
    const clientMapping = mapping.mappings.find(
      ({ python_symbol: pythonSymbol }) => pythonSymbol === "IdmModbusClient",
    );
    expect(clientMapping?.partial_class?.implemented_members).toHaveLength(22);
    expect(clientMapping?.partial_class?.omitted_members).toEqual(phase2OmittedWriteMembers);
    expect(extensions.extensions).toEqual([
      expect.objectContaining({
        typescript_symbol: "ModbusTransport",
        export_path: ".",
        kind: "type",
        owner_phase: 2,
        status: "complete",
        no_python_counterpart: true,
      }),
    ]);
    const prototypeMembers = Object.getOwnPropertyNames(IdmModbusClient.prototype)
      .filter((member) => member !== "constructor")
      .sort();
    expect(prototypeMembers).toEqual(
      [...(clientMapping?.partial_class?.implemented_members ?? [])].sort(),
    );
    for (const member of phase2OmittedWriteMembers) {
      expect(rootSource, member).not.toContain(member);
      expect(prototypeMembers, member).not.toContain(member);
    }
    for (const internalName of [
      "createModbusSerialTransport",
      "modbus-serial-adapter",
      "withInternalClientDependencies",
      "attachInternalModbusTransport",
      "registerPymodbusLoggingHook",
    ]) {
      expect(rootSource, internalName).not.toContain(internalName);
    }
    expect(webSource).toMatch(/export \{\};/u);
    expect(webSource).not.toMatch(/export\s+(?:const|class|function|type)\b/u);
    expect(workflow).toContain("run: npm run check");
    expect(workflow).toContain("run: npm run parity:check");
    const releaseGate = run(process.execPath, ["scripts/generate-api-parity.mjs", "--release"]);
    expect(releaseGate.status).not.toBe(0);
    expect(releaseGate.stderr).toContain("mapping_release_status_incomplete");
  });
});
