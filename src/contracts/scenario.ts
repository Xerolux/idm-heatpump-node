import { type ParsedContractValue, parseTaggedValue } from "./tagged-values.js";

export const ScenarioContractCode = Object.freeze({
  INVALID_SCENARIO: "scenario_invalid",
  INVALID_FIXTURE: "fixture_invalid",
} as const);

export type ScenarioContractCode = (typeof ScenarioContractCode)[keyof typeof ScenarioContractCode];

export class ScenarioContractError extends Error {
  public readonly code: ScenarioContractCode;

  public constructor(code: ScenarioContractCode, message: string) {
    super(message.slice(0, 240));
    this.name = "ScenarioContractError";
    this.code = code;
  }
}

export const SCENARIO_CONTRACT_LIMITS = Object.freeze({
  maxScenarios: 256,
  maxNameLength: 128,
  maxClockEvents: 1_024,
} as const);

export const PhaseOneOperationKind = Object.freeze({
  NORMALIZE_VALUE: "normalize_value",
  CODEC_ENCODE_FLOAT32: "codec_encode_float32",
  BUILD_REGISTER_MAP: "build_register_map",
  REGISTER_OVERLAP: "register_overlap",
} as const);

export type PhaseOneOperationKind =
  (typeof PhaseOneOperationKind)[keyof typeof PhaseOneOperationKind];

const ROOT_FIELDS = Object.freeze([
  "baseline",
  "generator_version",
  "operation_kinds",
  "scenarios",
  "schema_version",
] as const);

const BASELINE_FIELDS = Object.freeze([
  "git_commit",
  "git_tag",
  "parity_schema_version",
  "python_package",
  "python_version",
  "repository",
] as const);

const SCENARIO_FIELDS = Object.freeze([
  "clock",
  "configuration",
  "expected_requests",
  "expected_result",
  "expected_state",
  "name",
  "operation",
  "transport_responses",
] as const);

const PHASE_ONE_OPERATION_KINDS = Object.freeze([
  PhaseOneOperationKind.NORMALIZE_VALUE,
  PhaseOneOperationKind.CODEC_ENCODE_FLOAT32,
  PhaseOneOperationKind.BUILD_REGISTER_MAP,
  PhaseOneOperationKind.REGISTER_OVERLAP,
] as const);

const EXPECTED_BASELINE = Object.freeze({
  repository: "https://github.com/Xerolux/idm-heatpump-api",
  python_package: "idm-heatpump-api",
  python_version: "0.8.0",
  git_tag: "v0.8.0",
  git_commit: "a5d44ed06e5bd317946ca41720f37151631bc9c6",
  parity_schema_version: 1,
} as const);

export interface ScenarioBaseline {
  readonly repository: typeof EXPECTED_BASELINE.repository;
  readonly python_package: typeof EXPECTED_BASELINE.python_package;
  readonly python_version: typeof EXPECTED_BASELINE.python_version;
  readonly git_tag: typeof EXPECTED_BASELINE.git_tag;
  readonly git_commit: typeof EXPECTED_BASELINE.git_commit;
  readonly parity_schema_version: typeof EXPECTED_BASELINE.parity_schema_version;
}

export interface NormalizeValueOperation {
  readonly kind: typeof PhaseOneOperationKind.NORMALIZE_VALUE;
  readonly values: readonly ParsedContractValue[];
}

export interface CodecEncodeFloat32Operation {
  readonly kind: typeof PhaseOneOperationKind.CODEC_ENCODE_FLOAT32;
  readonly value: ParsedContractValue;
}

export interface BuildRegisterMapOperation {
  readonly kind: typeof PhaseOneOperationKind.BUILD_REGISTER_MAP;
}

export interface RegisterOverlapOperation {
  readonly kind: typeof PhaseOneOperationKind.REGISTER_OVERLAP;
  readonly address: number;
}

export type PhaseOneOperation =
  | NormalizeValueOperation
  | CodecEncodeFloat32Operation
  | BuildRegisterMapOperation
  | RegisterOverlapOperation;

export interface ScenarioEntry {
  readonly name: string;
  readonly configuration: Readonly<Record<string, ParsedContractValue>>;
  readonly transport_responses: readonly Readonly<Record<string, ParsedContractValue>>[];
  readonly clock: readonly number[];
  readonly operation: PhaseOneOperation;
  readonly expected_result: ParsedContractValue;
  readonly expected_requests: readonly Readonly<Record<string, ParsedContractValue>>[];
  readonly expected_state: Readonly<Record<string, ParsedContractValue>>;
}

export interface ScenarioContract {
  readonly schema_version: 1;
  readonly generator_version: "1";
  readonly baseline: ScenarioBaseline;
  readonly operation_kinds: readonly PhaseOneOperationKind[];
  readonly scenarios: readonly ScenarioEntry[];
}

type ParsedRecord = Readonly<Record<string, ParsedContractValue>>;

function fail(code: ScenarioContractCode, message: string): never {
  throw new ScenarioContractError(code, message);
}

function failFixture(message: string): never {
  fail(ScenarioContractCode.INVALID_FIXTURE, message);
}

function failScenario(message: string): never {
  fail(ScenarioContractCode.INVALID_SCENARIO, message);
}

function isRecord(value: ParsedContractValue): value is ParsedRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(
  value: ParsedContractValue,
  message: string,
  failure: (message: string) => never,
): ParsedRecord {
  if (!isRecord(value)) {
    failure(message);
  }
  return value;
}

function requireArray(
  value: ParsedContractValue,
  message: string,
  failure: (message: string) => never,
): readonly ParsedContractValue[] {
  if (!Array.isArray(value)) {
    failure(message);
  }
  return value;
}

function requireExactFields(
  value: ParsedRecord,
  fields: readonly string[],
  subject: string,
  failure: (message: string) => never,
): void {
  const actual = Object.keys(value);
  const unknown = actual.find((field) => !fields.includes(field));
  if (unknown !== undefined) {
    failure(`${subject} contains unknown field: ${unknown}`);
  }
  const missing = fields.find((field) => !Object.prototype.hasOwnProperty.call(value, field));
  if (missing !== undefined) {
    failure(`${subject} is missing field: ${missing}`);
  }
}

function requiredField(value: ParsedRecord, field: string): ParsedContractValue {
  const item = value[field];
  if (item === undefined) {
    failScenario(`Validated contract field is unexpectedly absent: ${field}`);
  }
  return item;
}

function validateBaseline(value: ParsedContractValue): void {
  const baseline = requireRecord(value, "Fixture baseline must be an object", failFixture);
  requireExactFields(baseline, BASELINE_FIELDS, "Fixture baseline", failFixture);

  for (const field of BASELINE_FIELDS) {
    if (baseline[field] !== EXPECTED_BASELINE[field]) {
      failFixture(`Fixture baseline does not match pinned field: ${field}`);
    }
  }
}

function validateOperationKinds(
  value: ParsedContractValue,
): asserts value is readonly PhaseOneOperationKind[] {
  const kinds = requireArray(value, "Operation kinds must be an array", failFixture);
  if (kinds.length !== PHASE_ONE_OPERATION_KINDS.length) {
    failFixture("Operation kinds must contain the complete Phase-1 set");
  }

  for (const [index, expected] of PHASE_ONE_OPERATION_KINDS.entries()) {
    if (kinds[index] !== expected) {
      failFixture("Operation kinds must match the ordered closed Phase-1 set");
    }
  }
  if (new Set(kinds).size !== kinds.length) {
    failFixture("Operation kinds must be unique");
  }
}

function requireModbusWord(value: ParsedContractValue, path: string): void {
  if (!Number.isInteger(value) || typeof value !== "number" || value < 0 || value > 0xffff) {
    failScenario(`${path} must be an integer Modbus word in 0..65535`);
  }
}

function validateEnvelopeWords(value: ParsedContractValue, path: string): void {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      validateEnvelopeWords(item, `${path}[${index}]`);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }

  for (const [key, item] of Object.entries(value)) {
    if (key === "words") {
      const words = requireArray(item, `${path}.words must be an array`, failScenario);
      for (const [index, word] of words.entries()) {
        requireModbusWord(word, `${path}.words[${index}]`);
      }
    } else {
      validateEnvelopeWords(item, `${path}.${key}`);
    }
  }
}

function validateEnvelope(
  value: ParsedContractValue,
  field: "transport_responses" | "expected_requests",
): asserts value is readonly ParsedRecord[] {
  const entries = requireArray(value, `${field} must be an array`, failScenario);
  for (const [index, entry] of entries.entries()) {
    requireRecord(entry, `${field}[${index}] must be an object`, failScenario);
    validateEnvelopeWords(entry, `${field}[${index}]`);
  }
}

function validateClock(value: ParsedContractValue): asserts value is readonly number[] {
  const events = requireArray(value, "clock must be an array", failScenario);
  if (events.length > SCENARIO_CONTRACT_LIMITS.maxClockEvents) {
    failScenario("clock exceeds the maximum event count");
  }

  let previous = 0;
  for (const [index, event] of events.entries()) {
    if (
      typeof event !== "number" ||
      !Number.isFinite(event) ||
      event < 0 ||
      Object.is(event, -0) ||
      event < previous
    ) {
      failScenario(`clock[${index}] must be a finite non-negative monotonic timestamp`);
    }
    previous = event;
  }
}

function validateOperation(value: ParsedContractValue): void {
  const operation = requireRecord(value, "operation must be an object", failScenario);
  const kind = requiredField(operation, "kind");

  switch (kind) {
    case PhaseOneOperationKind.NORMALIZE_VALUE:
      requireExactFields(operation, ["kind", "values"], "normalize operation", failScenario);
      requireArray(
        requiredField(operation, "values"),
        "normalize operation values must be an array",
        failScenario,
      );
      return;
    case PhaseOneOperationKind.CODEC_ENCODE_FLOAT32:
      requireExactFields(operation, ["kind", "value"], "codec operation", failScenario);
      return;
    case PhaseOneOperationKind.BUILD_REGISTER_MAP:
      requireExactFields(operation, ["kind"], "register-map operation", failScenario);
      return;
    case PhaseOneOperationKind.REGISTER_OVERLAP:
      requireExactFields(operation, ["address", "kind"], "overlap operation", failScenario);
      requireModbusWord(requiredField(operation, "address"), "overlap operation address");
      return;
    default:
      failScenario("operation kind is not part of the closed Phase-1 contract");
  }
}

function validateScenario(value: ParsedContractValue, names: Set<string>): void {
  const scenario = requireRecord(value, "Scenario must be an object", failScenario);
  requireExactFields(scenario, SCENARIO_FIELDS, "Scenario", failScenario);
  const name = requiredField(scenario, "name");

  if (
    typeof name !== "string" ||
    name.length === 0 ||
    name.length > SCENARIO_CONTRACT_LIMITS.maxNameLength
  ) {
    failScenario("Scenario name must be a non-empty bounded string");
  }
  if (names.has(name)) {
    failScenario(`Scenario name must be unique: ${name}`);
  }
  names.add(name);

  requireRecord(
    requiredField(scenario, "configuration"),
    "configuration must be an object",
    failScenario,
  );
  validateEnvelope(requiredField(scenario, "transport_responses"), "transport_responses");
  validateClock(requiredField(scenario, "clock"));
  validateOperation(requiredField(scenario, "operation"));
  validateEnvelope(requiredField(scenario, "expected_requests"), "expected_requests");
  requireRecord(
    requiredField(scenario, "expected_state"),
    "expected_state must be an object",
    failScenario,
  );
}

export function parseScenarioContract(value: unknown): ScenarioContract {
  const parsed = parseTaggedValue(value);
  const root = requireRecord(parsed, "Scenario fixture root must be an object", failFixture);
  requireExactFields(root, ROOT_FIELDS, "Scenario fixture root", failFixture);

  if (requiredField(root, "schema_version") !== 1) {
    failFixture("Scenario fixture schema version is unsupported");
  }
  if (requiredField(root, "generator_version") !== "1") {
    failFixture("Scenario fixture generator version is unsupported");
  }
  validateBaseline(requiredField(root, "baseline"));
  validateOperationKinds(requiredField(root, "operation_kinds"));

  const scenarios = requireArray(
    requiredField(root, "scenarios"),
    "Fixture scenarios must be an array",
    failFixture,
  );
  if (scenarios.length === 0 || scenarios.length > SCENARIO_CONTRACT_LIMITS.maxScenarios) {
    failScenario("Fixture scenarios must contain a bounded non-empty collection");
  }

  const names = new Set<string>();
  for (const scenario of scenarios) {
    validateScenario(scenario, names);
  }

  return root as unknown as ScenarioContract;
}
