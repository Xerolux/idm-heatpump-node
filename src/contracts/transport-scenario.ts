import {
  TAGGED_VALUE_LIMITS,
  type ParsedContractValue,
  parseTaggedValue,
} from "./tagged-values.js";
import {
  createModbusReadRequest,
  MODBUS_READ_LIMITS,
  type ModbusReadRequest,
} from "../transport/types.js";
import { RegisterType } from "../types.js";

export const TransportScenarioContractCode = Object.freeze({
  INVALID_SCENARIO: "scenario_invalid",
  INVALID_FIXTURE: "fixture_invalid",
} as const);

export type TransportScenarioContractCode =
  (typeof TransportScenarioContractCode)[keyof typeof TransportScenarioContractCode];

export class TransportScenarioContractError extends Error {
  public readonly code: TransportScenarioContractCode;

  public constructor(code: TransportScenarioContractCode, message: string) {
    super(message.slice(0, 240));
    this.name = "TransportScenarioContractError";
    this.code = code;
  }
}

export const TRANSPORT_SCENARIO_LIMITS = Object.freeze({
  maxScenarios: 64,
  maxNameLength: 128,
  maxTextLength: 1_024,
  maxDiagnosticLength: 1_024,
  maxEnvelopeEntries: 1_024,
  maxClockEvents: 4_096,
  maxOperationItems: 1_024,
  maxDepth: TAGGED_VALUE_LIMITS.maxDepth,
  maxNodes: TAGGED_VALUE_LIMITS.maxNodes,
} as const);

export const TransportOperationKind = Object.freeze({
  LIFECYCLE: "lifecycle",
  READ_REGISTER: "read_register",
  READ_BATCH: "read_batch",
  PROBE: "probe",
  DETECT_MODEL: "detect_model",
  DIAGNOSTICS: "diagnostics",
  RESET_FAILED_REGISTERS: "reset_failed_registers",
} as const);

export type TransportOperationKind =
  (typeof TransportOperationKind)[keyof typeof TransportOperationKind];

export const NormalizedTransportErrorType = Object.freeze({
  TIMEOUT: "timeout",
  DISCONNECTED: "disconnected",
  SOCKET: "socket",
  NO_RESPONSE: "no_response",
  MODBUS: "modbus",
  ILLEGAL_ADDRESS: "illegal_address",
  INVALID_RESPONSE: "invalid_response",
} as const);

export type NormalizedTransportErrorType =
  (typeof NormalizedTransportErrorType)[keyof typeof NormalizedTransportErrorType];

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

const EXPECTED_BASELINE = Object.freeze({
  repository: "https://github.com/Xerolux/idm-heatpump-api",
  python_package: "idm-heatpump-api",
  python_version: "0.8.0",
  git_tag: "v0.8.0",
  git_commit: "a5d44ed06e5bd317946ca41720f37151631bc9c6",
  parity_schema_version: 1,
} as const);

const TRANSPORT_OPERATION_KINDS = Object.freeze([
  TransportOperationKind.LIFECYCLE,
  TransportOperationKind.READ_REGISTER,
  TransportOperationKind.READ_BATCH,
  TransportOperationKind.PROBE,
  TransportOperationKind.DETECT_MODEL,
  TransportOperationKind.DIAGNOSTICS,
  TransportOperationKind.RESET_FAILED_REGISTERS,
] as const);

const NORMALIZED_ERROR_TYPES = new Set<NormalizedTransportErrorType>(
  Object.values(NormalizedTransportErrorType),
);

const LIFECYCLE_ACTIONS = new Set(["connect", "disconnect", "force_reconnect"]);
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const SYNTHETIC_HOST = "example.invalid";

export interface TransportScenarioBaseline {
  readonly repository: typeof EXPECTED_BASELINE.repository;
  readonly python_package: typeof EXPECTED_BASELINE.python_package;
  readonly python_version: typeof EXPECTED_BASELINE.python_version;
  readonly git_tag: typeof EXPECTED_BASELINE.git_tag;
  readonly git_commit: typeof EXPECTED_BASELINE.git_commit;
  readonly parity_schema_version: typeof EXPECTED_BASELINE.parity_schema_version;
}

export interface LifecycleOperation {
  readonly kind: typeof TransportOperationKind.LIFECYCLE;
  readonly actions: readonly ("connect" | "disconnect" | "force_reconnect")[];
}

export interface ReadRegisterOperation {
  readonly kind: typeof TransportOperationKind.READ_REGISTER;
  readonly register: string;
  readonly concurrency: number;
}

export interface ReadBatchOperation {
  readonly kind: typeof TransportOperationKind.READ_BATCH;
  readonly registers: readonly string[];
  readonly concurrency: number;
}

export interface ProbeOperation {
  readonly kind: typeof TransportOperationKind.PROBE;
  readonly address: number;
  readonly count: number;
  readonly registerType: RegisterType;
  readonly maxRetries: number;
  readonly timeout: number;
}

export interface DetectModelOperation {
  readonly kind: typeof TransportOperationKind.DETECT_MODEL;
  readonly includeFirmware: boolean;
}

export interface DiagnosticsOperation {
  readonly kind: typeof TransportOperationKind.DIAGNOSTICS;
}

export interface ResetFailedRegistersOperation {
  readonly kind: typeof TransportOperationKind.RESET_FAILED_REGISTERS;
}

export type TransportOperation =
  | LifecycleOperation
  | ReadRegisterOperation
  | ReadBatchOperation
  | ProbeOperation
  | DetectModelOperation
  | DiagnosticsOperation
  | ResetFailedRegistersOperation;

export type TransportResponseScript =
  | Readonly<{ readonly kind: "words"; readonly words: readonly number[] }>
  | Readonly<{
      readonly kind: "error";
      readonly errorType: NormalizedTransportErrorType;
      readonly message: string;
    }>;

export type ExpectedTransportRequest =
  | Readonly<{ readonly kind: "connect" | "close" | "destroy" }>
  | Readonly<{ readonly kind: "read"; readonly request: ModbusReadRequest }>;

export interface TransportScenarioEntry {
  readonly name: string;
  readonly configuration: Readonly<Record<string, ParsedContractValue>>;
  readonly transport_responses: readonly TransportResponseScript[];
  readonly clock: readonly number[];
  readonly operation: TransportOperation;
  readonly expected_result: ParsedContractValue;
  readonly expected_requests: readonly ExpectedTransportRequest[];
  readonly expected_state: Readonly<Record<string, ParsedContractValue>>;
}

export interface TransportScenarioContract {
  readonly schema_version: 1;
  readonly generator_version: "1";
  readonly baseline: TransportScenarioBaseline;
  readonly operation_kinds: readonly TransportOperationKind[];
  readonly scenarios: readonly TransportScenarioEntry[];
}

type ParsedRecord = Readonly<Record<string, ParsedContractValue>>;

function fail(code: TransportScenarioContractCode, message: string): never {
  throw new TransportScenarioContractError(code, message);
}

function failFixture(message: string): never {
  fail(TransportScenarioContractCode.INVALID_FIXTURE, message);
}

function failScenario(message: string): never {
  fail(TransportScenarioContractCode.INVALID_SCENARIO, message);
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

function requireExactOptionalFields(
  value: ParsedRecord,
  required: readonly string[],
  optional: readonly string[],
  subject: string,
): void {
  const allowed = [...required, ...optional];
  const unknown = Object.keys(value).find((field) => !allowed.includes(field));
  if (unknown !== undefined) {
    failScenario(`${subject} contains unknown field: ${unknown}`);
  }
  const missing = required.find((field) => !Object.prototype.hasOwnProperty.call(value, field));
  if (missing !== undefined) {
    failScenario(`${subject} is missing field: ${missing}`);
  }
}

function requiredField(value: ParsedRecord, field: string): ParsedContractValue {
  const item = value[field];
  if (item === undefined) {
    failScenario(`Validated transport scenario field is unexpectedly absent: ${field}`);
  }
  return item;
}

function requireBoundedString(value: ParsedContractValue, path: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > TRANSPORT_SCENARIO_LIMITS.maxTextLength
  ) {
    failScenario(`${path} must be a non-empty bounded string`);
  }
  return value;
}

function requireBoundedInteger(
  value: ParsedContractValue,
  minimum: number,
  maximum: number,
  path: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    failScenario(`${path} must be an integer in ${minimum}..${maximum}`);
  }
  return value;
}

function validateGraphSafety(value: ParsedContractValue, path: string): void {
  if (typeof value === "string") {
    if (value.length > TRANSPORT_SCENARIO_LIMITS.maxTextLength) {
      failScenario(`${path} contains text above the transport contract bound`);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      validateGraphSafety(item, `${path}[${index}]`);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }

  for (const [key, item] of Object.entries(value)) {
    if (DANGEROUS_KEYS.has(key)) {
      failScenario(`${path} contains a forbidden object key: ${key}`);
    }
    validateGraphSafety(item, `${path}.${key}`);
  }
}

function validateBaseline(value: ParsedContractValue): void {
  const baseline = requireRecord(value, "Transport baseline must be an object", failFixture);
  requireExactFields(baseline, BASELINE_FIELDS, "Transport baseline", failFixture);
  for (const field of BASELINE_FIELDS) {
    if (baseline[field] !== EXPECTED_BASELINE[field]) {
      failFixture(`Transport baseline does not match pinned field: ${field}`);
    }
  }
}

function validateOperationKinds(
  value: ParsedContractValue,
): asserts value is readonly TransportOperationKind[] {
  const kinds = requireArray(value, "Transport operation kinds must be an array", failFixture);
  if (kinds.length !== TRANSPORT_OPERATION_KINDS.length) {
    failFixture("Transport operation kinds must contain the complete closed Phase-2 set");
  }
  for (const [index, expected] of TRANSPORT_OPERATION_KINDS.entries()) {
    if (kinds[index] !== expected) {
      failFixture("Transport operation kinds must match the ordered closed Phase-2 set");
    }
  }
  if (new Set(kinds).size !== kinds.length) {
    failFixture("Transport operation kinds must be unique");
  }
}

function requireRegisterNames(value: ParsedContractValue, path: string): readonly string[] {
  const names = requireArray(value, `${path} must be an array`, failScenario);
  if (names.length === 0 || names.length > TRANSPORT_SCENARIO_LIMITS.maxOperationItems) {
    failScenario(`${path} must contain a bounded non-empty collection`);
  }

  const result = names.map((name, index) => requireBoundedString(name, `${path}[${index}]`));
  if (new Set(result).size !== result.length) {
    failScenario(`${path} must contain unique canonical names`);
  }
  return result;
}

function validateOperation(value: ParsedContractValue): void {
  const operation = requireRecord(value, "operation must be an object", failScenario);
  const kind = requiredField(operation, "kind");

  switch (kind) {
    case TransportOperationKind.LIFECYCLE: {
      requireExactFields(operation, ["actions", "kind"], "lifecycle operation", failScenario);
      const actions = requireArray(
        requiredField(operation, "actions"),
        "lifecycle actions must be an array",
        failScenario,
      );
      if (actions.length === 0 || actions.length > TRANSPORT_SCENARIO_LIMITS.maxOperationItems) {
        failScenario("lifecycle actions must contain a bounded non-empty collection");
      }
      for (const action of actions) {
        if (typeof action !== "string" || !LIFECYCLE_ACTIONS.has(action)) {
          failScenario("lifecycle action is not part of the closed Phase-2 set");
        }
      }
      return;
    }
    case TransportOperationKind.READ_REGISTER:
      requireExactFields(
        operation,
        ["concurrency", "kind", "register"],
        "read-register operation",
        failScenario,
      );
      requireBoundedString(
        requiredField(operation, "register"),
        "read-register operation register",
      );
      requireBoundedInteger(
        requiredField(operation, "concurrency"),
        1,
        64,
        "read-register operation concurrency",
      );
      return;
    case TransportOperationKind.READ_BATCH:
      requireExactFields(
        operation,
        ["concurrency", "kind", "registers"],
        "read-batch operation",
        failScenario,
      );
      requireRegisterNames(requiredField(operation, "registers"), "read-batch operation registers");
      requireBoundedInteger(
        requiredField(operation, "concurrency"),
        1,
        64,
        "read-batch operation concurrency",
      );
      return;
    case TransportOperationKind.PROBE: {
      requireExactFields(
        operation,
        ["address", "count", "kind", "maxRetries", "registerType", "timeout"],
        "probe operation",
        failScenario,
      );
      const registerType = requiredField(operation, "registerType");
      if (registerType !== RegisterType.INPUT && registerType !== RegisterType.HOLDING) {
        failScenario("probe operation registerType is invalid");
      }
      requireBoundedInteger(
        requiredField(operation, "address"),
        MODBUS_READ_LIMITS.minimumAddress,
        MODBUS_READ_LIMITS.maximumAddress,
        "probe operation address",
      );
      requireBoundedInteger(
        requiredField(operation, "count"),
        MODBUS_READ_LIMITS.minimumCount,
        MODBUS_READ_LIMITS.maximumCount,
        "probe operation count",
      );
      requireBoundedInteger(
        requiredField(operation, "maxRetries"),
        1,
        64,
        "probe operation maxRetries",
      );
      const timeout = requiredField(operation, "timeout");
      if (
        typeof timeout !== "number" ||
        !Number.isFinite(timeout) ||
        timeout <= 0 ||
        timeout > 86_400
      ) {
        failScenario("probe operation timeout must be a finite positive number");
      }
      return;
    }
    case TransportOperationKind.DETECT_MODEL:
      requireExactFields(
        operation,
        ["includeFirmware", "kind"],
        "detect-model operation",
        failScenario,
      );
      if (typeof requiredField(operation, "includeFirmware") !== "boolean") {
        failScenario("detect-model operation includeFirmware must be boolean");
      }
      return;
    case TransportOperationKind.DIAGNOSTICS:
      requireExactFields(operation, ["kind"], "diagnostics operation", failScenario);
      return;
    case TransportOperationKind.RESET_FAILED_REGISTERS:
      requireExactFields(operation, ["kind"], "reset operation", failScenario);
      return;
    default:
      failScenario("operation kind is not part of the closed Phase-2 transport contract");
  }
}

function configuredEndpointCandidates(configuration: ParsedRecord): readonly string[] {
  const hostValue = configuration.host;
  if (hostValue === undefined) {
    return Object.freeze([]);
  }
  if (typeof hostValue !== "string") {
    failScenario("configuration.host must be a string");
  }
  if (hostValue !== "" && hostValue !== SYNTHETIC_HOST) {
    failScenario("configuration.host must use the synthetic example.invalid endpoint");
  }
  if (hostValue === "") {
    return Object.freeze([]);
  }

  const portValue = configuration.port;
  if (portValue === undefined) {
    return Object.freeze([hostValue]);
  }
  if (
    typeof portValue !== "number" ||
    !Number.isFinite(portValue) ||
    !Number.isInteger(portValue)
  ) {
    failScenario("configuration.port must be an integer when present");
  }

  return Object.freeze(
    [...new Set([`${hostValue}:${portValue}`, `[${hostValue}]:${portValue}`, hostValue])].sort(
      (left, right) => right.length - left.length,
    ),
  );
}

function validateErrorProjection(
  value: ParsedContractValue,
  path: string,
  endpoints: readonly string[],
): void {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      validateErrorProjection(item, `${path}[${index}]`, endpoints);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }

  if (Object.prototype.hasOwnProperty.call(value, "errorType")) {
    const errorType = value.errorType;
    if (
      typeof errorType !== "string" ||
      !NORMALIZED_ERROR_TYPES.has(errorType as NormalizedTransportErrorType)
    ) {
      failScenario(`${path}.errorType is not a closed normalized transport error`);
    }
    const message = value.message;
    if (
      typeof message !== "string" ||
      message.length > TRANSPORT_SCENARIO_LIMITS.maxDiagnosticLength
    ) {
      failScenario(`${path}.message must be a bounded normalized diagnostic`);
    }
    for (const endpoint of endpoints) {
      if (message.includes(endpoint)) {
        failScenario(`${path}.message contains an unredacted configured endpoint`);
      }
    }
    const placeholders = message.match(/<[^>]+>/gu) ?? [];
    if (placeholders.some((placeholder) => placeholder !== "<endpoint>")) {
      failScenario(`${path}.message uses a non-contract redaction placeholder`);
    }
    if (
      Object.prototype.hasOwnProperty.call(value, "cause") ||
      Object.prototype.hasOwnProperty.call(value, "payload")
    ) {
      failScenario(`${path} cannot include raw causes or payloads`);
    }
  }

  for (const [key, item] of Object.entries(value)) {
    validateErrorProjection(item, `${path}.${key}`, endpoints);
  }
}

function validateWords(value: ParsedContractValue, path: string): readonly number[] {
  const words = requireArray(value, `${path} must be an array`, failScenario);
  if (words.length > MODBUS_READ_LIMITS.maximumCount) {
    failScenario(`${path} exceeds the maximum Modbus read word count`);
  }
  return words.map((word, index) => requireBoundedInteger(word, 0, 0xffff, `${path}[${index}]`));
}

function validateTransportResponses(value: ParsedContractValue): void {
  const responses = requireArray(value, "transport_responses must be an array", failScenario);
  if (responses.length > TRANSPORT_SCENARIO_LIMITS.maxEnvelopeEntries) {
    failScenario("transport_responses exceeds the maximum entry count");
  }

  for (const [index, item] of responses.entries()) {
    const response = requireRecord(
      item,
      `transport_responses[${index}] must be an object`,
      failScenario,
    );
    const kind = requiredField(response, "kind");
    if (kind === "words") {
      requireExactFields(
        response,
        ["kind", "words"],
        `transport_responses[${index}]`,
        failScenario,
      );
      validateWords(requiredField(response, "words"), `transport_responses[${index}].words`);
      continue;
    }
    if (kind === "error") {
      requireExactFields(
        response,
        ["errorType", "kind", "message"],
        `transport_responses[${index}]`,
        failScenario,
      );
      continue;
    }
    failScenario(`transport_responses[${index}] has an unknown script kind`);
  }
}

function validateExpectedRequests(value: ParsedContractValue): void {
  const requests = requireArray(value, "expected_requests must be an array", failScenario);
  if (requests.length > TRANSPORT_SCENARIO_LIMITS.maxEnvelopeEntries) {
    failScenario("expected_requests exceeds the maximum entry count");
  }

  for (const [index, item] of requests.entries()) {
    const event = requireRecord(
      item,
      `expected_requests[${index}] must be an object`,
      failScenario,
    );
    const kind = requiredField(event, "kind");
    if (kind === "connect" || kind === "close" || kind === "destroy") {
      requireExactFields(event, ["kind"], `expected_requests[${index}]`, failScenario);
      continue;
    }
    if (kind !== "read") {
      failScenario(`expected_requests[${index}] has an unknown trace kind`);
    }

    requireExactFields(event, ["kind", "request"], `expected_requests[${index}]`, failScenario);
    const request = requireRecord(
      requiredField(event, "request"),
      `expected_requests[${index}].request must be an object`,
      failScenario,
    );
    requireExactOptionalFields(
      request,
      ["address", "count", "functionCode", "registerType", "unitId"],
      ["timeoutMs"],
      `expected_requests[${index}].request`,
    );

    try {
      createModbusReadRequest({
        address: requiredField(request, "address") as number,
        count: requiredField(request, "count") as number,
        functionCode: requiredField(request, "functionCode") as 3 | 4,
        registerType: requiredField(request, "registerType") as RegisterType,
        unitId: requiredField(request, "unitId") as number,
        ...(request.timeoutMs === undefined ? {} : { timeoutMs: request.timeoutMs as number }),
      });
    } catch {
      failScenario(`expected_requests[${index}].request has an invalid Modbus identity`);
    }
  }
}

function validateClock(value: ParsedContractValue): void {
  const clock = requireArray(value, "clock must be an array", failScenario);
  if (clock.length > TRANSPORT_SCENARIO_LIMITS.maxClockEvents) {
    failScenario("clock exceeds the maximum event count");
  }

  let previous = 0;
  for (const [index, event] of clock.entries()) {
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

function validateScenario(value: ParsedContractValue, names: Set<string>): void {
  const scenario = requireRecord(value, "Transport scenario must be an object", failScenario);
  requireExactFields(scenario, SCENARIO_FIELDS, "Transport scenario", failScenario);
  validateGraphSafety(scenario, "scenario");

  const name = requiredField(scenario, "name");
  if (
    typeof name !== "string" ||
    name.length === 0 ||
    name.length > TRANSPORT_SCENARIO_LIMITS.maxNameLength
  ) {
    failScenario("Transport scenario name must be a non-empty bounded string");
  }
  if (names.has(name)) {
    failScenario(`Transport scenario name must be unique: ${name}`);
  }
  names.add(name);

  const configuration = requireRecord(
    requiredField(scenario, "configuration"),
    "configuration must be an object",
    failScenario,
  );
  const endpoints = configuredEndpointCandidates(configuration);
  validateTransportResponses(requiredField(scenario, "transport_responses"));
  validateClock(requiredField(scenario, "clock"));
  validateOperation(requiredField(scenario, "operation"));
  validateExpectedRequests(requiredField(scenario, "expected_requests"));
  requireRecord(
    requiredField(scenario, "expected_state"),
    "expected_state must be an object",
    failScenario,
  );
  validateErrorProjection(scenario, "scenario", endpoints);
}

export function parseTransportScenarioContract(value: unknown): TransportScenarioContract {
  const parsed = parseTaggedValue(value);
  const root = requireRecord(parsed, "Transport fixture root must be an object", failFixture);
  requireExactFields(root, ROOT_FIELDS, "Transport fixture root", failFixture);
  validateGraphSafety(root, "fixture");

  if (requiredField(root, "schema_version") !== 1) {
    failFixture("Transport fixture schema version is unsupported");
  }
  if (requiredField(root, "generator_version") !== "1") {
    failFixture("Transport fixture generator version is unsupported");
  }
  validateBaseline(requiredField(root, "baseline"));
  validateOperationKinds(requiredField(root, "operation_kinds"));

  const scenarios = requireArray(
    requiredField(root, "scenarios"),
    "Transport fixture scenarios must be an array",
    failFixture,
  );
  if (scenarios.length === 0 || scenarios.length > TRANSPORT_SCENARIO_LIMITS.maxScenarios) {
    failScenario("Transport fixture scenarios must contain a bounded non-empty collection");
  }

  const names = new Set<string>();
  for (const scenario of scenarios) {
    validateScenario(scenario, names);
  }

  return root as unknown as TransportScenarioContract;
}
