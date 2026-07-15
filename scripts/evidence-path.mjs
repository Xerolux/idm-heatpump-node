import { lstatSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

export const MAX_EVIDENCE_BYTES = 16 * 1024 * 1024;
const MAX_EVIDENCE_PATH_LENGTH = 1024;
const EVIDENCE_PATH = /^test\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.test\.ts$/u;

export class EvidencePathError extends Error {
  constructor(message) {
    super(message);
    this.name = "EvidencePathError";
  }
}

export function isEvidenceTestPath(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_EVIDENCE_PATH_LENGTH &&
    EVIDENCE_PATH.test(value) &&
    !value.split("/").includes("..")
  );
}

function evidenceError(message) {
  throw new EvidencePathError(message);
}

export function validateEvidencePath(root, relativePath, maximumBytes = MAX_EVIDENCE_BYTES) {
  if (!isEvidenceTestPath(relativePath)) {
    evidenceError(`Invalid evidence path: ${String(relativePath)}`);
  }
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
    evidenceError("Evidence byte limit must be a positive safe integer");
  }

  const testRoot = resolve(root, "test");
  let rootStats;
  try {
    rootStats = lstatSync(testRoot);
  } catch (error) {
    evidenceError(`Evidence test root is missing: ${String(error)}`);
  }
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    evidenceError("Evidence test root must be a real directory");
  }

  const segments = relativePath.split("/").slice(1);
  let candidate = testRoot;
  for (const [index, segment] of segments.entries()) {
    candidate = resolve(candidate, segment);
    let stats;
    try {
      stats = lstatSync(candidate);
    } catch (error) {
      evidenceError(`Evidence path is missing: ${relativePath}: ${String(error)}`);
    }
    if (stats.isSymbolicLink()) {
      evidenceError(`Evidence path cannot contain symlinks: ${relativePath}`);
    }
    if (index < segments.length - 1 && !stats.isDirectory()) {
      evidenceError(`Evidence parent is not a directory: ${relativePath}`);
    }
    if (
      index === segments.length - 1 &&
      (!stats.isFile() || stats.size === 0 || stats.size > maximumBytes)
    ) {
      evidenceError(`Evidence must be a bounded non-empty regular file: ${relativePath}`);
    }
  }

  const canonicalRoot = realpathSync(testRoot);
  const canonicalCandidate = realpathSync(candidate);
  const fromRoot = relative(canonicalRoot, canonicalCandidate);
  if (
    fromRoot === "" ||
    isAbsolute(fromRoot) ||
    fromRoot === ".." ||
    fromRoot.startsWith(`..${sep}`)
  ) {
    evidenceError(`Evidence path escapes the test root: ${relativePath}`);
  }
  return candidate;
}
