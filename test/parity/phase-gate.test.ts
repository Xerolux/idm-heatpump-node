import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const orchestrator = resolve(root, "scripts/check-parity.mjs");
const upstreamSource = resolve(root, "../idm-heatpump-api");
const canonicalRepository = "https://github.com/Xerolux/idm-heatpump-api";
const pinnedCommit = "ad121ebf34a5f5e37204371c026927d77efcd15c";
const pinnedTag = "v0.7.6";
const temporaryPrefix = "idm-heatpump-contract-";
const generatedPaths = [
  "test/fixtures/public-api.json",
  "test/fixtures/public-classes.json",
  "test/fixtures/codec-vectors.json",
  "test/fixtures/register-schema.json",
  "test/fixtures/behavior-contract.json",
  "test/fixtures/web-contract.json",
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
    expect(result.stderr).not.toContain("Generated 6 pinned semantic fixtures");
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
    const target = resolve(root, generatedPaths[0]);
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

  it("uses bounded shell-free fixed process invocations and no ambient checkout fallback", () => {
    const source = readFileSync(orchestrator, "utf8");

    expect(source).toContain("MAX_PROCESS_OUTPUT_BYTES");
    expect(source).toContain("shell: false");
    expect(source).toContain('spawnSync("git"');
    expect(source).toContain('"pymodbus==3.12.1"');
    expect(source).toContain('"scripts/generate-python-contract.py"');
    expect(source).toContain('"scripts/generate-api-parity.mjs"');
    expect(source).not.toContain("IDM_HEATPUMP_API_DIR");
    expect(source).not.toMatch(/\bexecSync\b|\bexecFileSync\b/u);
  });
});

describe("npm parity entry points and private package boundary", () => {
  it("keeps mapping promotion API-only before the non-mutating Python fixture check", () => {
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
    expect(completeRows).toHaveLength(53);
    expect(completeRows.every(({ owner_phase }) => owner_phase === 1)).toBe(true);
    for (const row of completeRows) {
      expect(apiDocument, row.python_symbol).toContain(
        `| \`${row.python_symbol}\` | \`${row.typescript_symbol}\` | \`.\` | 1 | \`complete\` |`,
      );
    }
    expect(mapping.mappings.filter(({ status }) => status === "planned")).toHaveLength(36);
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
      if (row.status === "complete") {
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
    expect(packageJson.dependencies ?? {}).toEqual({});
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
  });
});

describe("GitHub Actions workflow contract", () => {
  const workflow = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");

  it("keeps read-only Node 22 and Node 24 validation with SHA-pinned actions", () => {
    expect(workflow).toMatch(/permissions:\s*\n\s+contents: read/u);
    expect(workflow).not.toMatch(/contents:\s*write|id-token:\s*write|packages:\s*write/u);
    expect(workflow).toMatch(/matrix:[\s\S]*?node:\s*\n\s+- 22\s*\n\s+- 24/u);

    const actionReferences = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+).*$/gmu)].map(
      (match) => match[1],
    );
    expect(actionReferences.length).toBeGreaterThanOrEqual(5);
    expect(actionReferences.every((reference) => /@[0-9a-f]{40}$/u.test(reference))).toBe(true);
  });

  it("runs exact Python 3.12 parity:check from a full-tag workflow checkout", () => {
    const manifest = JSON.parse(readFileSync(resolve(root, "UPSTREAM-PARITY.json"), "utf8")) as {
      readonly git_commit: string;
      readonly git_tag: string;
      readonly python_version: string;
    };
    const parityJob = workflow.match(/^  parity:\s*$([\s\S]*)/mu)?.[1] ?? "";

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
