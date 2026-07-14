export interface UpstreamParity {
  readonly schema_version: number;
  readonly repository: string;
  readonly python_package: string;
  readonly python_version: string;
  readonly git_tag: string;
  readonly git_commit: string;
  readonly parity_status: string;
  readonly verified_on: string;
}

export const BaselineValidationCode = Object.freeze({
  NOT_OBJECT: "baseline_not_object",
  UNKNOWN_FIELD: "baseline_unknown_field",
  MISSING_FIELD: "baseline_missing_field",
  INVALID_SCHEMA: "baseline_invalid_schema",
  INVALID_REPOSITORY: "baseline_invalid_repository",
  INVALID_PACKAGE: "baseline_invalid_package",
  INVALID_VERSION: "baseline_invalid_version",
  INVALID_TAG: "baseline_invalid_tag",
  INVALID_COMMIT: "baseline_invalid_commit",
  INVALID_STATUS: "baseline_invalid_status",
  INVALID_VERIFIED_ON: "baseline_invalid_verified_on",
  BASELINE_MISMATCH: "baseline_identity_mismatch",
} as const);

export type BaselineValidationCode =
  (typeof BaselineValidationCode)[keyof typeof BaselineValidationCode];

export class BaselineValidationError extends Error {
  public readonly code: BaselineValidationCode;

  public constructor(code: BaselineValidationCode, message: string) {
    super(message);
    this.name = "BaselineValidationError";
    this.code = code;
  }
}

const EXPECTED_FIELDS = Object.freeze([
  "schema_version",
  "repository",
  "python_package",
  "python_version",
  "git_tag",
  "git_commit",
  "parity_status",
  "verified_on",
] as const);

const SUPPORTED_BASELINE = Object.freeze({
  schema_version: 1,
  repository: "https://github.com/Xerolux/idm-heatpump-api",
  python_package: "idm-heatpump-api",
  python_version: "0.7.6",
  git_tag: "v0.7.6",
  git_commit: "ad121ebf34a5f5e37204371c026927d77efcd15c",
} as const);

const PARITY_STATUSES = new Set(["planned", "partial", "complete"]);
const MAX_FIELD_LENGTH = 256;

function fail(code: BaselineValidationCode, message: string): never {
  throw new BaselineValidationError(code, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_FIELD_LENGTH;
}

function isRealIsoDate(value: string): boolean {
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

export function parseUpstreamParity(value: unknown): UpstreamParity {
  if (!isRecord(value)) {
    fail(BaselineValidationCode.NOT_OBJECT, "Upstream parity must be a JSON object");
  }

  const actualFields = Object.keys(value);
  const unknownField = actualFields.find(
    (field) => !EXPECTED_FIELDS.includes(field as (typeof EXPECTED_FIELDS)[number]),
  );
  if (unknownField !== undefined) {
    fail(BaselineValidationCode.UNKNOWN_FIELD, `Unknown upstream parity field: ${unknownField}`);
  }

  const missingField = EXPECTED_FIELDS.find(
    (field) => !Object.prototype.hasOwnProperty.call(value, field),
  );
  if (missingField !== undefined) {
    fail(BaselineValidationCode.MISSING_FIELD, `Missing upstream parity field: ${missingField}`);
  }

  if (value.schema_version !== SUPPORTED_BASELINE.schema_version) {
    fail(BaselineValidationCode.INVALID_SCHEMA, "Unsupported upstream parity schema");
  }
  if (!isBoundedString(value.repository) || value.repository !== SUPPORTED_BASELINE.repository) {
    fail(BaselineValidationCode.INVALID_REPOSITORY, "Upstream repository is not allowlisted");
  }
  if (
    !isBoundedString(value.python_package) ||
    value.python_package !== SUPPORTED_BASELINE.python_package
  ) {
    fail(BaselineValidationCode.INVALID_PACKAGE, "Upstream Python package does not match");
  }
  if (
    !isBoundedString(value.python_version) ||
    !/^\d+\.\d+\.\d+(?:[a-zA-Z0-9.-]+)?$/u.test(value.python_version)
  ) {
    fail(BaselineValidationCode.INVALID_VERSION, "Upstream Python version is malformed");
  }
  if (!isBoundedString(value.git_tag) || value.git_tag !== `v${value.python_version}`) {
    fail(BaselineValidationCode.INVALID_TAG, "Upstream Python tag and version do not match");
  }
  if (!isBoundedString(value.git_commit) || !/^[0-9a-f]{40}$/u.test(value.git_commit)) {
    fail(
      BaselineValidationCode.INVALID_COMMIT,
      "Upstream parity must pin a full lowercase Git commit SHA",
    );
  }
  if (!isBoundedString(value.parity_status) || !PARITY_STATUSES.has(value.parity_status)) {
    fail(BaselineValidationCode.INVALID_STATUS, "Upstream parity status is unsupported");
  }
  if (!isBoundedString(value.verified_on) || !isRealIsoDate(value.verified_on)) {
    fail(BaselineValidationCode.INVALID_VERIFIED_ON, "Upstream verification date is invalid");
  }

  if (
    value.python_version !== SUPPORTED_BASELINE.python_version ||
    value.git_tag !== SUPPORTED_BASELINE.git_tag ||
    value.git_commit !== SUPPORTED_BASELINE.git_commit
  ) {
    fail(BaselineValidationCode.BASELINE_MISMATCH, "Upstream baseline identity does not match");
  }

  return Object.freeze({
    schema_version: value.schema_version,
    repository: value.repository,
    python_package: value.python_package,
    python_version: value.python_version,
    git_tag: value.git_tag,
    git_commit: value.git_commit,
    parity_status: value.parity_status,
    verified_on: value.verified_on,
  });
}

export interface CompatibilityMatrix {
  readonly schema_version: number;
  readonly development_baseline: {
    readonly python_version: string;
    readonly python_commit: string;
    readonly status: string;
  };
  readonly releases: readonly unknown[];
}

export function assertParityMetadataConsistency(
  upstream: UpstreamParity,
  matrix: CompatibilityMatrix,
): void {
  if (!/^[0-9a-f]{40}$/u.test(upstream.git_commit)) {
    throw new Error("Upstream parity must pin a full lowercase Git commit SHA");
  }
  if (upstream.git_tag !== `v${upstream.python_version}`) {
    throw new Error("Upstream Python tag and version do not match");
  }
  if (matrix.schema_version !== upstream.schema_version) {
    throw new Error("Parity schema versions do not match");
  }
  if (matrix.development_baseline.python_version !== upstream.python_version) {
    throw new Error("Development baseline Python versions do not match");
  }
  if (matrix.development_baseline.python_commit !== upstream.git_commit) {
    throw new Error("Development baseline Python commits do not match");
  }
  if (matrix.development_baseline.status !== upstream.parity_status) {
    throw new Error("Development baseline parity statuses do not match");
  }
}
