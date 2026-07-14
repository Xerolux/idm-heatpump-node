import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync, statSync } from "node:fs";

const EXPECTED_FIELDS = Object.freeze([
  "schema_version",
  "repository",
  "python_package",
  "python_version",
  "git_tag",
  "git_commit",
  "parity_status",
  "verified_on",
]);
const SUPPORTED_BASELINE = Object.freeze({
  schema_version: 1,
  repository: "https://github.com/Xerolux/idm-heatpump-api",
  python_package: "idm-heatpump-api",
  python_version: "0.7.6",
  git_tag: "v0.7.6",
  git_commit: "ad121ebf34a5f5e37204371c026927d77efcd15c",
});
const PARITY_STATUSES = new Set(["planned", "partial", "complete"]);
const MAX_FIELD_LENGTH = 256;
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_PROCESS_OUTPUT_BYTES = 64 * 1024;
const GIT_TIMEOUT_MS = 10_000;

function fail(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  throw error;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedString(value) {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_FIELD_LENGTH;
}

function isRealIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function parseUpstreamParity(value) {
  if (!isRecord(value)) {
    fail("baseline_not_object", "Upstream parity must be a JSON object");
  }

  const actualFields = Object.keys(value);
  const unknownField = actualFields.find((field) => !EXPECTED_FIELDS.includes(field));
  if (unknownField !== undefined) {
    fail("baseline_unknown_field", `Unknown upstream parity field: ${unknownField}`);
  }

  const missingField = EXPECTED_FIELDS.find(
    (field) => !Object.prototype.hasOwnProperty.call(value, field),
  );
  if (missingField !== undefined) {
    fail("baseline_missing_field", `Missing upstream parity field: ${missingField}`);
  }

  if (value.schema_version !== SUPPORTED_BASELINE.schema_version) {
    fail("baseline_invalid_schema", "Unsupported upstream parity schema");
  }
  if (!isBoundedString(value.repository) || value.repository !== SUPPORTED_BASELINE.repository) {
    fail("baseline_invalid_repository", "Upstream repository is not allowlisted");
  }
  if (
    !isBoundedString(value.python_package) ||
    value.python_package !== SUPPORTED_BASELINE.python_package
  ) {
    fail("baseline_invalid_package", "Upstream Python package does not match");
  }
  if (
    !isBoundedString(value.python_version) ||
    !/^\d+\.\d+\.\d+(?:[a-zA-Z0-9.-]+)?$/u.test(value.python_version)
  ) {
    fail("baseline_invalid_version", "Upstream Python version is malformed");
  }
  if (!isBoundedString(value.git_tag) || value.git_tag !== `v${value.python_version}`) {
    fail("baseline_invalid_tag", "Upstream Python tag and version do not match");
  }
  if (!isBoundedString(value.git_commit) || !/^[0-9a-f]{40}$/u.test(value.git_commit)) {
    fail("baseline_invalid_commit", "Upstream parity must pin a full lowercase Git commit SHA");
  }
  if (!isBoundedString(value.parity_status) || !PARITY_STATUSES.has(value.parity_status)) {
    fail("baseline_invalid_status", "Upstream parity status is unsupported");
  }
  if (!isBoundedString(value.verified_on) || !isRealIsoDate(value.verified_on)) {
    fail("baseline_invalid_verified_on", "Upstream verification date is invalid");
  }
  if (
    value.python_version !== SUPPORTED_BASELINE.python_version ||
    value.git_tag !== SUPPORTED_BASELINE.git_tag ||
    value.git_commit !== SUPPORTED_BASELINE.git_commit
  ) {
    fail("baseline_identity_mismatch", "Upstream baseline identity does not match");
  }

  return Object.freeze({ ...value });
}

function parseArguments(args) {
  if (args.length !== 4) {
    fail(
      "invalid_arguments",
      "Usage: node scripts/check-upstream-version.mjs --manifest <file> --upstream-dir <directory>",
    );
  }

  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if ((option !== "--manifest" && option !== "--upstream-dir") || !isBoundedString(value)) {
      fail("invalid_arguments", "Only --manifest and --upstream-dir are accepted");
    }
    if (values.has(option)) {
      fail("invalid_arguments", `Duplicate argument: ${option}`);
    }
    values.set(option, value);
  }

  const manifest = values.get("--manifest");
  const upstreamDirectory = values.get("--upstream-dir");
  if (manifest === undefined || upstreamDirectory === undefined) {
    fail("invalid_arguments", "Both --manifest and --upstream-dir are required");
  }

  return { manifest, upstreamDirectory };
}

function canonicalFile(path, kind) {
  let canonicalPath;
  let stats;
  try {
    canonicalPath = realpathSync(path);
    stats = statSync(canonicalPath);
  } catch (error) {
    fail("invalid_path", `${kind} path cannot be resolved: ${error.message}`);
  }

  return { canonicalPath, stats };
}

function runGit(cwd, args, purpose, acceptedStatuses = new Set([0])) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: MAX_PROCESS_OUTPUT_BYTES,
    shell: false,
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
  });

  if (!acceptedStatuses.has(result.status)) {
    const diagnostics = [result.error?.message, result.stderr, result.stdout]
      .filter((part) => typeof part === "string" && part.length > 0)
      .join("\n")
      .slice(0, MAX_PROCESS_OUTPUT_BYTES);
    fail(
      "git_verification_failed",
      `${purpose} failed${diagnostics === "" ? "" : `: ${diagnostics}`}`,
    );
  }

  return {
    status: result.status,
    stdout: result.stdout.trim(),
  };
}

function parsePinnedProject(toml) {
  const projectHeader = /^\[project\]\s*$/mu.exec(toml);
  if (projectHeader === null) {
    fail("invalid_pyproject", "Pinned pyproject.toml has no [project] section");
  }

  const projectRemainder = toml.slice(projectHeader.index + projectHeader[0].length);
  const nextSectionIndex = projectRemainder.search(/^\[/mu);
  const projectSection =
    nextSectionIndex === -1 ? projectRemainder : projectRemainder.slice(0, nextSectionIndex);

  const name = projectSection.match(/^\s*name\s*=\s*"([^"]+)"\s*$/mu)?.[1];
  const version = projectSection.match(/^\s*version\s*=\s*"([^"]+)"\s*$/mu)?.[1];
  if (name === undefined || version === undefined) {
    fail("invalid_pyproject", "Pinned pyproject.toml has no project name or version");
  }
  return { name, version };
}

function verifyCheckout(manifest, checkout) {
  const insideWorktree = runGit(
    checkout,
    ["rev-parse", "--is-inside-work-tree"],
    "Git worktree check",
  ).stdout;
  if (insideWorktree !== "true") {
    fail("invalid_checkout", "Upstream path is not a Git worktree");
  }

  const topLevelOutput = runGit(
    checkout,
    ["rev-parse", "--show-toplevel"],
    "Git top-level check",
  ).stdout;
  const topLevel = realpathSync(topLevelOutput);
  if (topLevel !== checkout) {
    fail("invalid_checkout", "Upstream path must be the checkout top-level directory");
  }

  const origins = runGit(
    checkout,
    ["remote", "get-url", "--all", "origin"],
    "Git origin check",
  ).stdout.split(/\r?\n/u);
  if (origins.length !== 1 || origins[0] !== manifest.repository) {
    fail("origin_mismatch", "Git origin does not match the allowlisted repository");
  }

  const status = runGit(
    checkout,
    ["status", "--porcelain=v1", "--untracked-files=normal"],
    "Git cleanliness check",
  ).stdout;
  if (status !== "") {
    fail("dirty_checkout", "Upstream checkout must be clean");
  }

  const symbolicHead = runGit(
    checkout,
    ["symbolic-ref", "--quiet", "HEAD"],
    "Git detached-HEAD check",
    new Set([0, 1]),
  );
  if (symbolicHead.status === 0) {
    fail("branch_checkout", "Upstream checkout must use a detached HEAD, not a branch");
  }

  const head = runGit(
    checkout,
    ["rev-parse", "--verify", "HEAD^{commit}"],
    "Git HEAD check",
  ).stdout;
  if (head !== manifest.git_commit) {
    fail("head_mismatch", "Git HEAD does not match the pinned full commit SHA");
  }

  const tagTarget = runGit(
    checkout,
    ["rev-parse", "--verify", `${manifest.git_tag}^{commit}`],
    `Git tag ${manifest.git_tag} check`,
  ).stdout;
  if (tagTarget !== manifest.git_commit) {
    fail("tag_mismatch", `Git tag ${manifest.git_tag} does not resolve to the pinned commit`);
  }

  const project = parsePinnedProject(
    runGit(
      checkout,
      ["show", `${manifest.git_commit}:pyproject.toml`],
      "Pinned pyproject.toml check",
    ).stdout,
  );
  if (project.name !== manifest.python_package) {
    fail("package_mismatch", "Pinned pyproject.toml package name does not match the manifest");
  }
  if (project.version !== manifest.python_version) {
    fail("version_mismatch", "Pinned pyproject.toml version does not match the manifest");
  }
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  const manifestFile = canonicalFile(args.manifest, "Manifest");
  if (!manifestFile.stats.isFile() || manifestFile.stats.size > MAX_MANIFEST_BYTES) {
    fail("invalid_manifest", "Manifest must be a bounded regular file");
  }

  let manifestValue;
  try {
    manifestValue = JSON.parse(readFileSync(manifestFile.canonicalPath, "utf8"));
  } catch (error) {
    fail("invalid_manifest", `Manifest is not valid JSON: ${error.message}`);
  }
  const manifest = parseUpstreamParity(manifestValue);

  const upstream = canonicalFile(args.upstreamDirectory, "Upstream checkout");
  if (!upstream.stats.isDirectory()) {
    fail("invalid_path", "Upstream checkout must be a directory");
  }

  verifyCheckout(manifest, upstream.canonicalPath);
  console.log(
    `Verified ${manifest.repository} ${manifest.python_package}@${manifest.python_version} ${manifest.git_tag} ${manifest.git_commit} schema ${manifest.schema_version}`,
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.slice(0, MAX_PROCESS_OUTPUT_BYTES));
  process.exitCode = 1;
}
