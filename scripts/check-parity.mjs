import { spawnSync } from "node:child_process";
import {
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateEvidencePath } from "./evidence-path.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = resolve(ROOT, "UPSTREAM-PARITY.json");
const VERIFIER_PATH = resolve(ROOT, "scripts/check-upstream-version.mjs");
const PYTHON_GENERATOR_PATH = resolve(ROOT, "scripts/generate-python-contract.py");
const API_GENERATOR_PATH = resolve(ROOT, "scripts/generate-api-parity.mjs");
const EVIDENCE_VALIDATOR_PATH = resolve(ROOT, "scripts/evidence-path.mjs");
const MAPPING_PATH = resolve(ROOT, "contracts/api-mapping.json");
const EXTENSIONS_PATH = resolve(ROOT, "contracts/typescript-extensions.json");
const NORMALIZATION_PATH = resolve(ROOT, "contracts/normalization.md");

const EXPECTED_MANIFEST_FIELDS = Object.freeze([
  "schema_version",
  "repository",
  "python_package",
  "python_version",
  "git_tag",
  "git_commit",
  "parity_status",
  "verified_on",
]);
const EXPECTED_BASELINE = Object.freeze({
  schema_version: 1,
  repository: "https://github.com/Xerolux/idm-heatpump-api",
  python_package: "idm-heatpump-api",
  python_version: "0.7.6",
  git_tag: "v0.7.6",
  git_commit: "ad121ebf34a5f5e37204371c026927d77efcd15c",
});
const GENERATED_PATHS = Object.freeze([
  "test/fixtures/public-api.json",
  "test/fixtures/public-classes.json",
  "test/fixtures/codec-vectors.json",
  "test/fixtures/register-schema.json",
  "test/fixtures/behavior-contract.json",
  "test/fixtures/web-contract.json",
  "docs/API-PARITY.md",
  "docs/BASELINE.md",
]);
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_PROCESS_OUTPUT_BYTES = 64 * 1024;
const MAX_ARTIFACT_BYTES = 16 * 1024 * 1024;
const GIT_TIMEOUT_MS = 120_000;
const PYTHON_TIMEOUT_MS = 180_000;
const SHORT_TIMEOUT_MS = 30_000;
const TEST_FORWARD_ENVIRONMENT = Object.freeze([
  "IDM_CONTRACT_TEST_FAIL_AFTER_STAGE",
  "IDM_CONTRACT_TEST_FAIL_AFTER_REPLACE",
]);
const REFERENCE_ENVIRONMENT_ALLOWLIST = new Set(
  [
    "COMSPEC",
    "HOME",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "NO_PROXY",
    "PATH",
    "PATHEXT",
    "REQUESTS_CA_BUNDLE",
    "SSL_CERT_DIR",
    "SSL_CERT_FILE",
    "SYSTEMROOT",
    "TEMP",
    "TMP",
    "TMPDIR",
    "TZ",
    "USERPROFILE",
    "WINDIR",
    "WSLENV",
    "WSL_DISTRO_NAME",
    "WSL_INTEROP",
  ].map((name) => name.toUpperCase()),
);

class ParityError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = "ParityError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new ParityError(code, message.slice(0, MAX_PROCESS_OUTPUT_BYTES));
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedDiagnostic(result) {
  return [result.error?.message, result.stderr, result.stdout]
    .filter((value) => typeof value === "string" && value.length > 0)
    .join("\n")
    .slice(0, MAX_PROCESS_OUTPUT_BYTES);
}

function referenceEnvironment() {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) =>
      REFERENCE_ENVIRONMENT_ALLOWLIST.has(name.toUpperCase()),
    ),
  );
  for (const name of TEST_FORWARD_ENVIRONMENT) {
    if (process.env[name] === "1") environment[name] = "1";
  }
  return environment;
}

function runProcess(command, args, purpose, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    encoding: "utf8",
    env: options.env ?? process.env,
    maxBuffer: MAX_PROCESS_OUTPUT_BYTES,
    shell: false,
    timeout: options.timeout ?? SHORT_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.status !== 0) {
    const diagnostic = boundedDiagnostic(result);
    fail(
      options.code ?? "process_failed",
      `${purpose} failed${diagnostic === "" ? "" : `: ${diagnostic}`}`,
    );
  }
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

function runGit(args, purpose, cwd = ROOT) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: process.env,
    maxBuffer: MAX_PROCESS_OUTPUT_BYTES,
    shell: false,
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.status !== 0) {
    const diagnostic = boundedDiagnostic(result);
    fail("git_failed", `${purpose} failed${diagnostic === "" ? "" : `: ${diagnostic}`}`);
  }
  return result.stdout.trim();
}

function parseArguments(arguments_) {
  if (arguments_.length !== 1 && arguments_.length !== 3) {
    fail(
      "invalid_arguments",
      "Usage: node scripts/check-parity.mjs <generate|check> [--upstream-dir <directory>]",
    );
  }
  const mode = arguments_[0];
  if (mode !== "generate" && mode !== "check") {
    fail("invalid_arguments", "The first argument must be generate or check");
  }
  if (arguments_.length === 1) {
    return { mode, upstreamDirectory: undefined };
  }
  if (arguments_[1] !== "--upstream-dir" || arguments_[2].length === 0) {
    fail("invalid_arguments", "Only --upstream-dir is accepted after the mode");
  }
  return { mode, upstreamDirectory: arguments_[2] };
}

function isRealIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function readManifest() {
  const stats = statSync(MANIFEST_PATH);
  if (!stats.isFile() || stats.size === 0 || stats.size > MAX_MANIFEST_BYTES) {
    fail("manifest_invalid", "UPSTREAM-PARITY.json must be a bounded regular file");
  }
  let value;
  try {
    value = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } catch (error) {
    fail("manifest_invalid", `UPSTREAM-PARITY.json is invalid JSON: ${String(error)}`);
  }
  if (!isRecord(value)) {
    fail("manifest_invalid", "UPSTREAM-PARITY.json must be an object");
  }
  const fields = Object.keys(value);
  if (
    fields.length !== EXPECTED_MANIFEST_FIELDS.length ||
    fields.some((field) => !EXPECTED_MANIFEST_FIELDS.includes(field)) ||
    EXPECTED_MANIFEST_FIELDS.some((field) => !Object.prototype.hasOwnProperty.call(value, field))
  ) {
    fail("manifest_invalid", "UPSTREAM-PARITY.json fields differ from the closed schema");
  }
  for (const [field, expected] of Object.entries(EXPECTED_BASELINE)) {
    if (value[field] !== expected) {
      fail("manifest_identity_mismatch", `Manifest ${field} differs from the audited baseline`);
    }
  }
  if (
    value.git_tag !== `v${value.python_version}` ||
    !/^[0-9a-f]{40}$/u.test(value.git_commit) ||
    !new Set(["planned", "partial", "complete"]).has(value.parity_status) ||
    !isRealIsoDate(value.verified_on)
  ) {
    fail("manifest_invalid", "UPSTREAM-PARITY.json contains an invalid identity field");
  }
  return Object.freeze({ ...value });
}

function canonicalDirectory(path, label) {
  let canonical;
  try {
    canonical = realpathSync(path);
    if (!statSync(canonical).isDirectory()) {
      fail("invalid_path", `${label} must be a directory`);
    }
  } catch (error) {
    if (error instanceof ParityError) {
      throw error;
    }
    fail("invalid_path", `${label} cannot be resolved: ${String(error)}`);
  }
  return canonical;
}

function provisionCheckout(manifest, ownedRoot) {
  const checkout = resolve(ownedRoot, "upstream");
  runGit(
    [
      "clone",
      "--no-checkout",
      "--no-single-branch",
      "--origin",
      "origin",
      manifest.repository,
      checkout,
    ],
    "Canonical upstream clone",
  );
  runGit(["fetch", "--force", "--tags", "origin"], "Pinned tag fetch", checkout);
  runGit(["checkout", "--detach", manifest.git_commit], "Pinned detached checkout", checkout);
  return canonicalDirectory(checkout, "Owned upstream checkout");
}

function verifyCheckout(checkout) {
  return runProcess(
    process.execPath,
    [VERIFIER_PATH, "--manifest", MANIFEST_PATH, "--upstream-dir", checkout],
    "Exact upstream identity verification",
    {
      code: "upstream_verification_failed",
      env: referenceEnvironment(),
      timeout: GIT_TIMEOUT_MS,
    },
  ).stdout;
}

function probe(command, args, environment = referenceEnvironment()) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: environment,
    maxBuffer: MAX_PROCESS_OUTPUT_BYTES,
    shell: false,
    timeout: SHORT_TIMEOUT_MS,
    windowsHide: true,
  });
  return result.status === 0 && result.stdout.trim() === "3.12";
}

function toWslPath(path) {
  return runProcess("wsl.exe", ["--exec", "wslpath", "-a", path], "WSL path conversion", {
    code: "python312_unavailable",
  }).stdout;
}

function pythonEnvironment(temporaryParent) {
  const environment = referenceEnvironment();
  if (process.platform === "win32") {
    environment.TEMP = temporaryParent;
    environment.TMP = temporaryParent;
  } else {
    environment.TMPDIR = temporaryParent;
  }
  return environment;
}

function wslIsolatedEnvironmentArguments(temporaryParent) {
  const assignments = [
    "/usr/bin/env",
    "-i",
    "HOME=/tmp",
    "LANG=C.UTF-8",
    "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    `TMPDIR=${toWslPath(temporaryParent)}`,
  ];
  for (const name of ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY"]) {
    const value = process.env[name] ?? process.env[name.toLowerCase()];
    if (value !== undefined && value.length > 0) assignments.push(`${name}=${value}`);
  }
  for (const name of TEST_FORWARD_ENVIRONMENT) {
    if (process.env[name] === "1") assignments.push(`${name}=1`);
  }
  return assignments;
}

function findPython312() {
  if (process.platform === "win32") {
    if (
      probe("py", [
        "-3.12",
        "-I",
        "-c",
        "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')",
      ])
    ) {
      return Object.freeze({ kind: "native", command: "py", prefix: ["-3.12"] });
    }
    if (
      probe("wsl.exe", [
        "--exec",
        ...wslIsolatedEnvironmentArguments(tmpdir()),
        "python3.12",
        "-I",
        "-c",
        "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')",
      ])
    ) {
      return Object.freeze({ kind: "wsl", command: "wsl.exe", prefix: ["--exec"] });
    }
  } else if (
    probe("python3.12", [
      "-I",
      "-c",
      "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')",
    ])
  ) {
    return Object.freeze({ kind: "native", command: "python3.12", prefix: [] });
  }
  fail("python312_unavailable", "An exact Python 3.12 interpreter is required for parity");
}

function pythonPath(runtime, path) {
  return runtime.kind === "wsl" ? toWslPath(path) : path;
}

function runPython(runtime, executable, args, purpose, temporaryParent) {
  if (runtime.kind === "wsl") {
    const environmentArguments = [
      ...wslIsolatedEnvironmentArguments(temporaryParent),
      executable,
      "-I",
      ...args,
    ];
    return runProcess(runtime.command, [...runtime.prefix, ...environmentArguments], purpose, {
      code: "python_reference_failed",
      env: referenceEnvironment(),
      timeout: PYTHON_TIMEOUT_MS,
    });
  }
  const command = executable === "python3.12" ? runtime.command : executable;
  const commandArguments =
    executable === "python3.12" ? [...runtime.prefix, "-I", ...args] : ["-I", ...args];
  return runProcess(command, commandArguments, purpose, {
    code: "python_reference_failed",
    env: pythonEnvironment(temporaryParent),
    timeout: PYTHON_TIMEOUT_MS,
  });
}

function provisionPython(runtime, ownedRoot) {
  const venv = resolve(ownedRoot, "python-reference");
  const runtimeVenv = pythonPath(runtime, venv);
  runPython(
    runtime,
    "python3.12",
    ["-m", "venv", "--copies", runtimeVenv],
    "Python 3.12 venv creation",
    tmpdir(),
  );
  const interpreter =
    runtime.kind === "wsl"
      ? posix.join(runtimeVenv, "bin", "python")
      : process.platform === "win32"
        ? resolve(venv, "Scripts/python.exe")
        : resolve(venv, "bin/python");
  runPython(
    runtime,
    interpreter,
    [
      "-m",
      "pip",
      "--isolated",
      "install",
      "--disable-pip-version-check",
      "--no-input",
      "--no-deps",
      "--only-binary=:all:",
      "--index-url",
      "https://pypi.org/simple",
      "pymodbus==3.12.1",
    ],
    "Audited Python reference dependency installation",
    tmpdir(),
  );
  runPython(
    runtime,
    interpreter,
    [
      "-c",
      "import importlib.metadata as m,sys; assert sys.version_info[:2] == (3,12); assert m.version('pymodbus') == '3.12.1'",
    ],
    "Python reference environment verification",
    tmpdir(),
  );
  return interpreter;
}

function cleanupOwnedRoot(ownedRoot) {
  try {
    rmSync(ownedRoot, { recursive: true, force: true });
    return;
  } catch (error) {
    if (process.platform !== "win32") {
      fail("cleanup_failed", `Owned parity directory could not be removed: ${String(error)}`);
    }
  }
  const linuxPath = toWslPath(ownedRoot);
  runProcess("wsl.exe", ["--exec", "rm", "-rf", "--", linuxPath], "Owned parity cleanup", {
    code: "cleanup_failed",
    timeout: SHORT_TIMEOUT_MS,
  });
  if (existsSync(ownedRoot)) {
    fail("cleanup_failed", "Owned parity directory remains after cleanup");
  }
}

function prepareShadowRoot(stageRoot) {
  mkdirSync(resolve(stageRoot, "scripts"), { recursive: true });
  mkdirSync(resolve(stageRoot, "contracts"), { recursive: true });
  copyFileSync(API_GENERATOR_PATH, resolve(stageRoot, "scripts/generate-api-parity.mjs"));
  copyFileSync(EVIDENCE_VALIDATOR_PATH, resolve(stageRoot, "scripts/evidence-path.mjs"));
  copyFileSync(MAPPING_PATH, resolve(stageRoot, "contracts/api-mapping.json"));
  copyFileSync(EXTENSIONS_PATH, resolve(stageRoot, "contracts/typescript-extensions.json"));
  copyFileSync(NORMALIZATION_PATH, resolve(stageRoot, "contracts/normalization.md"));
  copyFileSync(MANIFEST_PATH, resolve(stageRoot, "UPSTREAM-PARITY.json"));

  let mapping;
  try {
    mapping = JSON.parse(readFileSync(MAPPING_PATH, "utf8"));
  } catch (error) {
    fail("evidence_invalid", `API mapping cannot be parsed for evidence staging: ${String(error)}`);
  }
  if (!isRecord(mapping) || !Array.isArray(mapping.mappings)) {
    fail("evidence_invalid", "API mapping has no evidence rows");
  }
  let extensions;
  try {
    extensions = JSON.parse(readFileSync(EXTENSIONS_PATH, "utf8"));
  } catch (error) {
    fail(
      "evidence_invalid",
      `TypeScript extensions cannot be parsed for evidence staging: ${String(error)}`,
    );
  }
  if (!isRecord(extensions) || !Array.isArray(extensions.extensions)) {
    fail("evidence_invalid", "TypeScript extensions have no evidence rows");
  }

  const stagedEvidence = new Set();
  for (const row of [...mapping.mappings, ...extensions.extensions]) {
    if (!isRecord(row) || row.status !== "complete") {
      continue;
    }
    const relativePath = row.contract_test;
    if (stagedEvidence.has(relativePath)) {
      continue;
    }

    let source;
    try {
      source = validateEvidencePath(ROOT, relativePath, MAX_ARTIFACT_BYTES);
    } catch (error) {
      fail("evidence_invalid", `Invalid complete evidence: ${String(error)}`);
    }

    const destination = resolve(stageRoot, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    stagedEvidence.add(relativePath);
  }
}

function generateArtifacts(runtime, interpreter, checkout, stageRoot) {
  const pythonArguments = [
    pythonPath(runtime, PYTHON_GENERATOR_PATH),
    "--manifest",
    pythonPath(runtime, MANIFEST_PATH),
    "--upstream-dir",
    pythonPath(runtime, checkout),
    "--output-root",
    pythonPath(runtime, stageRoot),
  ];
  runPython(
    runtime,
    interpreter,
    pythonArguments,
    "Pinned Python semantic contract generation",
    tmpdir(),
  );
  prepareShadowRoot(stageRoot);
  runProcess(
    process.execPath,
    [resolve(stageRoot, "scripts/generate-api-parity.mjs")],
    "API parity document generation",
    { code: "api_generation_failed", cwd: stageRoot, timeout: SHORT_TIMEOUT_MS },
  );
}

function validateStagedArtifacts(stageRoot) {
  for (const relativePath of GENERATED_PATHS) {
    const path = resolve(stageRoot, relativePath);
    let stats;
    try {
      stats = lstatSync(path);
    } catch (error) {
      fail("artifact_invalid", `${relativePath} is missing: ${String(error)}`);
    }
    if (
      !stats.isFile() ||
      stats.isSymbolicLink() ||
      stats.size === 0 ||
      stats.size > MAX_ARTIFACT_BYTES
    ) {
      fail("artifact_invalid", `${relativePath} is not a bounded regular artifact`);
    }
  }
}

function checkArtifacts(stageRoot) {
  validateStagedArtifacts(stageRoot);
  for (const relativePath of GENERATED_PATHS) {
    const expected = readFileSync(resolve(stageRoot, relativePath));
    const committedPath = resolve(ROOT, relativePath);
    if (!existsSync(committedPath) || !readFileSync(committedPath).equals(expected)) {
      fail("contract_drift", `${relativePath} differs from the exact pinned contract`);
    }
  }
}

function durableWrite(path, bytes) {
  writeFileSync(path, bytes, { flag: "wx" });
  const descriptor = openSync(path, "r+");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function replaceArtifacts(stageRoot) {
  validateStagedArtifacts(stageRoot);
  const transactionRoot = mkdtempSync(resolve(ROOT, ".idm-parity-transaction-"));
  const staged = resolve(transactionRoot, "staged");
  const backup = resolve(transactionRoot, "backup");
  mkdirSync(staged);
  mkdirSync(backup);
  const replaced = [];
  try {
    for (const [index, relativePath] of GENERATED_PATHS.entries()) {
      durableWrite(resolve(staged, String(index)), readFileSync(resolve(stageRoot, relativePath)));
    }
    for (const [index, relativePath] of GENERATED_PATHS.entries()) {
      const destination = resolve(ROOT, relativePath);
      const backupPath = resolve(backup, String(index));
      mkdirSync(dirname(destination), { recursive: true });
      const hadPrevious = existsSync(destination);
      if (hadPrevious) {
        renameSync(destination, backupPath);
      }
      try {
        renameSync(resolve(staged, String(index)), destination);
      } catch (error) {
        if (hadPrevious && existsSync(backupPath)) {
          renameSync(backupPath, destination);
        }
        throw error;
      }
      replaced.push({ destination, backupPath: hadPrevious ? backupPath : undefined });
    }
  } catch (error) {
    for (const entry of [...replaced].reverse()) {
      rmSync(entry.destination, { force: true });
      if (entry.backupPath !== undefined && existsSync(entry.backupPath)) {
        renameSync(entry.backupPath, entry.destination);
      }
    }
    fail("artifact_replace_failed", `Atomic parity replacement failed: ${String(error)}`);
  } finally {
    rmSync(transactionRoot, { recursive: true, force: true });
  }
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const manifest = readManifest();
  const ownedRoot = mkdtempSync(join(tmpdir(), "idm-heatpump-contract-"));
  try {
    const checkout =
      options.upstreamDirectory === undefined
        ? provisionCheckout(manifest, ownedRoot)
        : canonicalDirectory(options.upstreamDirectory, "Explicit upstream checkout");
    const verification = verifyCheckout(checkout);
    console.log(
      `${options.upstreamDirectory === undefined ? "Self-provisioned" : "Verified explicit"} exact upstream checkout: ${verification}`,
    );

    const runtime = findPython312();
    const interpreter = provisionPython(runtime, ownedRoot);
    const stageRoot = resolve(ownedRoot, "generated");
    mkdirSync(stageRoot);
    generateArtifacts(runtime, interpreter, checkout, stageRoot);
    if (options.mode === "check") {
      checkArtifacts(stageRoot);
      console.log(`Parity check passed for ${manifest.git_tag} ${manifest.git_commit}`);
    } else {
      replaceArtifacts(stageRoot);
      console.log(
        `Generated exact parity artifacts for ${manifest.git_tag} ${manifest.git_commit}`,
      );
    }
  } finally {
    cleanupOwnedRoot(ownedRoot);
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.slice(0, MAX_PROCESS_OUTPUT_BYTES));
  process.exitCode = 1;
}
