import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  BaselineValidationCode,
  parseUpstreamParity,
  type UpstreamParity,
} from "../../src/internal/parity-metadata.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const verifier = resolve(root, "scripts/check-upstream-version.mjs");
const upstreamSource = resolve(root, "../idm-heatpump-api");
const pinnedCommit = "a5d44ed06e5bd317946ca41720f37151631bc9c6";
const pinnedTag = "v0.8.0";
const canonicalRepository = "https://github.com/Xerolux/idm-heatpump-api";

function readManifest(): unknown {
  return JSON.parse(readFileSync(resolve("UPSTREAM-PARITY.json"), "utf8")) as unknown;
}

function validManifest(): Record<string, unknown> {
  return { ...(readManifest() as Record<string, unknown>) };
}

function expectValidationCode(value: unknown, code: string): void {
  try {
    parseUpstreamParity(value);
  } catch (error: unknown) {
    expect(error).toMatchObject({ code });
    return;
  }

  throw new Error(`Expected baseline validation code ${code}`);
}

type InvalidManifestCase = readonly [
  name: string,
  value: () => unknown,
  code: (typeof BaselineValidationCode)[keyof typeof BaselineValidationCode],
];

describe("upstream parity baseline manifest", () => {
  it("parses the exact pinned identity into a frozen runtime contract", () => {
    const parsed = parseUpstreamParity(readManifest());

    expect(parsed).toEqual({
      schema_version: 1,
      repository: "https://github.com/Xerolux/idm-heatpump-api",
      python_package: "idm-heatpump-api",
      python_version: "0.8.0",
      git_tag: "v0.8.0",
      git_commit: "a5d44ed06e5bd317946ca41720f37151631bc9c6",
      parity_status: "complete",
      verified_on: "2026-07-16",
    } satisfies UpstreamParity);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(() => {
      (parsed as { repository: string }).repository = "https://example.invalid/repository";
    }).toThrow(TypeError);
  });

  const invalidShapeCases: readonly InvalidManifestCase[] = [
    ["null", () => null, BaselineValidationCode.NOT_OBJECT],
    ["an array", () => [], BaselineValidationCode.NOT_OBJECT],
    [
      "an unknown field",
      () => ({ ...validManifest(), branch: "main" }),
      BaselineValidationCode.UNKNOWN_FIELD,
    ],
    [
      "a missing field",
      () => {
        const value = validManifest();
        delete value.verified_on;
        return value;
      },
      BaselineValidationCode.MISSING_FIELD,
    ],
  ];

  it.each(invalidShapeCases)("rejects %s", (_name, value, code) => {
    expectValidationCode(value(), code);
  });

  const invalidValueCases: readonly InvalidManifestCase[] = [
    [
      "an unsupported schema",
      () => ({ ...validManifest(), schema_version: 2 }),
      BaselineValidationCode.INVALID_SCHEMA,
    ],
    [
      "a string schema",
      () => ({ ...validManifest(), schema_version: "1" }),
      BaselineValidationCode.INVALID_SCHEMA,
    ],
    [
      "a non-allowlisted repository",
      () => ({ ...validManifest(), repository: "https://example.invalid/idm-heatpump-api" }),
      BaselineValidationCode.INVALID_REPOSITORY,
    ],
    [
      "an overlong repository",
      () => ({ ...validManifest(), repository: `https://github.com/${"x".repeat(300)}` }),
      BaselineValidationCode.INVALID_REPOSITORY,
    ],
    [
      "a different package",
      () => ({ ...validManifest(), python_package: "other-package" }),
      BaselineValidationCode.INVALID_PACKAGE,
    ],
    [
      "a malformed version",
      () => ({ ...validManifest(), python_version: "release" }),
      BaselineValidationCode.INVALID_VERSION,
    ],
    [
      "a different well-formed version",
      () => ({ ...validManifest(), python_version: "0.7.7", git_tag: "v0.7.7" }),
      BaselineValidationCode.BASELINE_MISMATCH,
    ],
    [
      "a branch name as tag",
      () => ({ ...validManifest(), git_tag: "main" }),
      BaselineValidationCode.INVALID_TAG,
    ],
    [
      "a mismatched tag and version",
      () => ({ ...validManifest(), git_tag: "v0.7.5" }),
      BaselineValidationCode.INVALID_TAG,
    ],
    [
      "a short commit",
      () => ({ ...validManifest(), git_commit: "ad121eb" }),
      BaselineValidationCode.INVALID_COMMIT,
    ],
    [
      "an uppercase commit",
      () => ({ ...validManifest(), git_commit: "A".repeat(40) }),
      BaselineValidationCode.INVALID_COMMIT,
    ],
    [
      "a different well-formed commit",
      () => ({ ...validManifest(), git_commit: "f".repeat(40) }),
      BaselineValidationCode.BASELINE_MISMATCH,
    ],
    [
      "an unknown parity status",
      () => ({ ...validManifest(), parity_status: "branch" }),
      BaselineValidationCode.INVALID_STATUS,
    ],
    [
      "a malformed verification date",
      () => ({ ...validManifest(), verified_on: "14.07.2026" }),
      BaselineValidationCode.INVALID_VERIFIED_ON,
    ],
    [
      "an impossible verification date",
      () => ({ ...validManifest(), verified_on: "2026-02-30" }),
      BaselineValidationCode.INVALID_VERIFIED_ON,
    ],
  ];

  it.each(invalidValueCases)("rejects %s", (_name, value, code) => {
    expectValidationCode(value(), code);
  });
});

interface CommandResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function run(command: string, args: readonly string[], cwd = root): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: false,
  });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function git(args: readonly string[], cwd = root): string {
  const result = run("git", args, cwd);
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout.trim();
}

function runVerifier(manifest: string, upstreamDirectory: string): CommandResult {
  return run(process.execPath, [
    verifier,
    "--manifest",
    manifest,
    "--upstream-dir",
    upstreamDirectory,
  ]);
}

describe("exact upstream checkout verifier", () => {
  let temporaryDirectory = "";
  let baselineCheckout = "";
  let manifestPath = "";

  beforeAll(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "idm-baseline-verifier-"));
    baselineCheckout = join(temporaryDirectory, "baseline checkout");
    manifestPath = join(temporaryDirectory, "UPSTREAM-PARITY.json");
    cpSync(resolve(root, "UPSTREAM-PARITY.json"), manifestPath);
    git(["clone", "--no-local", upstreamSource, baselineCheckout]);
    git(["checkout", "--detach", pinnedCommit], baselineCheckout);
    git(["remote", "set-url", "origin", canonicalRepository], baselineCheckout);
  }, 30_000);

  afterAll(() => {
    if (temporaryDirectory !== "") {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  function copyCheckout(name: string): string {
    const target = join(temporaryDirectory, name);
    cpSync(baselineCheckout, target, { recursive: true });
    return target;
  }

  function writeManifest(name: string, changes: Readonly<Record<string, unknown>>): string {
    const target = join(temporaryDirectory, name);
    const value = { ...(readManifest() as Record<string, unknown>), ...changes };
    writeFileSync(target, `${JSON.stringify(value, undefined, 2)}\n`);
    return target;
  }

  it("verifies a clean detached full-history checkout and reports the full identity", () => {
    const result = runVerifier(manifestPath, baselineCheckout);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(canonicalRepository);
    expect(result.stdout).toContain("idm-heatpump-api@0.8.0");
    expect(result.stdout).toContain(pinnedTag);
    expect(result.stdout).toContain(pinnedCommit);
    expect(result.stdout).toContain("schema 1");
    expect(git(["status", "--porcelain=v1"], baselineCheckout)).toBe("");
  });

  type CheckoutMutation = readonly [
    name: string,
    mutate: (checkout: string) => void,
    message: string,
  ];

  const checkoutMutations: readonly CheckoutMutation[] = [
    [
      "wrong origin",
      (checkout) =>
        git(["remote", "set-url", "origin", "https://example.invalid/repository"], checkout),
      "origin",
    ],
    [
      "dirty worktree",
      (checkout) =>
        writeFileSync(join(checkout, "untracked-device-secret.txt"), "synthetic only\n"),
      "clean",
    ],
    [
      "attached branch",
      (checkout) => git(["switch", "-c", "baseline-branch"], checkout),
      "detached",
    ],
    ["wrong HEAD", (checkout) => git(["checkout", "--detach", "HEAD^"], checkout), "HEAD"],
    ["missing tag", (checkout) => git(["tag", "--delete", pinnedTag], checkout), "tag"],
    ["moved tag", (checkout) => git(["tag", "--force", pinnedTag, "HEAD^"], checkout), "tag"],
  ];

  it.each(checkoutMutations)("rejects a %s", (name, mutate, message) => {
    const checkout = copyCheckout(name.replaceAll(" ", "-"));
    mutate(checkout);

    const result = runVerifier(manifestPath, checkout);

    expect(result.status).not.toBe(0);
    expect(result.stderr.toLowerCase()).toContain(message.toLowerCase());
  });

  it("rejects malformed paths and unrecognized CLI arguments", () => {
    const filePath = join(temporaryDirectory, "not-a-directory");
    writeFileSync(filePath, "not a checkout\n");

    expect(runVerifier(manifestPath, join(temporaryDirectory, "missing")).status).not.toBe(0);
    expect(runVerifier(manifestPath, filePath).status).not.toBe(0);
    expect(
      run(process.execPath, [
        verifier,
        "--manifest",
        manifestPath,
        "--upstream-dir",
        baselineCheckout,
        "--branch",
        "main",
      ]).status,
    ).not.toBe(0);
  });

  it("rejects malformed, package-mismatched, version-mismatched, and unsupported manifests", () => {
    const cases = [
      writeManifest("unsupported-schema.json", { schema_version: 2 }),
      writeManifest("wrong-package.json", { python_package: "wrong-package" }),
      writeManifest("wrong-version.json", { python_version: "0.7.7", git_tag: "v0.7.7" }),
      writeManifest("branch-reference.json", { branch: "main" }),
    ];

    for (const candidate of cases) {
      expect(runVerifier(candidate, baselineCheckout).status).not.toBe(0);
    }
  });

  it("treats shell metacharacters in paths as literal characters", () => {
    const checkout = copyCheckout("checkout;touch SHOULD_NOT_EXIST");
    const literalManifest = join(temporaryDirectory, "manifest;touch SHOULD_NOT_EXIST.json");
    cpSync(manifestPath, literalManifest);

    const result = runVerifier(literalManifest, checkout);

    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(literalManifest, "utf8")).toContain(pinnedCommit);
    expect(() => readFileSync(join(temporaryDirectory, "SHOULD_NOT_EXIST"))).toThrow();
  });

  it("fails closed without the manifest tag and succeeds after the exact tag is fetched", () => {
    const bareSource = join(temporaryDirectory, "shallow-source.git");
    const shallowCheckout = join(temporaryDirectory, "shallow checkout");
    git(["clone", "--bare", upstreamSource, bareSource]);
    git(["update-ref", "refs/heads/baseline-shallow", pinnedCommit], bareSource);
    git(["symbolic-ref", "HEAD", "refs/heads/baseline-shallow"], bareSource);
    git([
      "clone",
      "--depth=1",
      "--no-tags",
      "--branch",
      "baseline-shallow",
      pathToFileURL(bareSource).href,
      shallowCheckout,
    ]);
    git(["checkout", "--detach", "HEAD"], shallowCheckout);
    git(["remote", "set-url", "origin", canonicalRepository], shallowCheckout);

    const missingTag = runVerifier(manifestPath, shallowCheckout);
    expect(missingTag.status).not.toBe(0);
    expect(missingTag.stderr.toLowerCase()).toContain("tag");

    git(
      ["fetch", pathToFileURL(bareSource).href, `refs/tags/${pinnedTag}:refs/tags/${pinnedTag}`],
      shallowCheckout,
    );

    const withTag = runVerifier(manifestPath, shallowCheckout);
    expect(withTag.status, withTag.stderr).toBe(0);
    expect(withTag.stdout).toContain(pinnedCommit);
  }, 30_000);
});
