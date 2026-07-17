import { type SemanticValidationErrorCode } from "../errors.js";
import { createRegisterDef, type RegisterDefInput } from "../registers/definitions.js";
import {
  createModbusWriteRequest,
  MODBUS_WRITE_LIMITS,
  type ModbusWriteRequest,
} from "../transport/types.js";
import {
  DataType,
  RegisterType,
  type DataType as DataTypeValue,
  type RegisterType as RegisterTypeValue,
} from "../types.js";
import {
  TAGGED_VALUE_LIMITS,
  type ParsedContractValue,
  parseTaggedValue,
} from "./tagged-values.js";

export const WriteScenarioContractCode = Object.freeze({
  INVALID_SCENARIO: "scenario_invalid",
  INVALID_FIXTURE: "fixture_invalid",
} as const);

export type WriteScenarioContractCode =
  (typeof WriteScenarioContractCode)[keyof typeof WriteScenarioContractCode];

export class WriteScenarioContractError extends Error {
  public readonly code: WriteScenarioContractCode;

  public constructor(code: WriteScenarioContractCode, message: string) {
    super(message.slice(0, 240));
    this.name = "WriteScenarioContractError";
    this.code = code;
  }
}

export const WRITE_SCENARIO_LIMITS = Object.freeze({
  maxSourceBytes: 2 * 1_024 * 1_024,
  maxScenarios: 128,
  maxNameLength: 128,
  maxTextLength: 1_024,
  maxDiagnosticLength: 1_024,
  maxActions: 1_024,
  maxResponses: 1_024,
  maxRequests: 4_096,
  maxClockEvents: 4_096,
  maxRegisterDefinitions: 256,
  maxWords: MODBUS_WRITE_LIMITS.maximumCount,
  maxDepth: TAGGED_VALUE_LIMITS.maxDepth,
  maxNodes: TAGGED_VALUE_LIMITS.maxNodes,
} as const);

export const WriteScenarioActionKind = Object.freeze({
  SIMULATE_WRITE: "simulate_write",
  WRITE_REGISTER: "write_register",
  SET_VALUE: "set_value",
  ADVANCE_TIME: "advance_time",
  RESET_WRITE_THROTTLE: "reset_write_throttle",
  GET_ACTIVE_CYCLIC_WRITES: "get_active_cyclic_writes",
  GET_EXPIRED_CYCLIC_WRITES: "get_expired_cyclic_writes",
  RESET_CYCLIC_WRITE_STATE: "reset_cyclic_write_state",
} as const);

export type WriteScenarioActionKind =
  (typeof WriteScenarioActionKind)[keyof typeof WriteScenarioActionKind];

const WRITE_ACTION_KINDS = Object.freeze([
  WriteScenarioActionKind.SIMULATE_WRITE,
  WriteScenarioActionKind.WRITE_REGISTER,
  WriteScenarioActionKind.SET_VALUE,
  WriteScenarioActionKind.ADVANCE_TIME,
  WriteScenarioActionKind.RESET_WRITE_THROTTLE,
  WriteScenarioActionKind.GET_ACTIVE_CYCLIC_WRITES,
  WriteScenarioActionKind.GET_EXPIRED_CYCLIC_WRITES,
  WriteScenarioActionKind.RESET_CYCLIC_WRITE_STATE,
] as const);

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
const CONFIGURATION_FIELDS = Object.freeze([
  "detectedModel",
  "host",
  "maxGroupSize",
  "maxRetries",
  "port",
  "registerDefinitions",
  "slaveId",
  "timeout",
] as const);
const STATE_FIELDS = Object.freeze([
  "activeCyclicWrites",
  "connected",
  "connectionSuspect",
  "cyclicWrites",
  "expiredCyclicWrites",
  "lastError",
  "maxActiveRequests",
  "unsupportedRegisters",
  "writeThrottle",
] as const);
const LAST_ERROR_FIELDS = Object.freeze([
  "address",
  "attempt",
  "count",
  "errorType",
  "message",
  "operation",
  "registerType",
] as const);
const CUSTOM_REGISTER_REQUIRED_FIELDS = Object.freeze([
  "address",
  "datatype",
  "name",
  "source",
  "sourceVersion",
  "supportedModels",
  "writable",
] as const);
const CUSTOM_REGISTER_OPTIONAL_FIELDS = Object.freeze([
  "binary",
  "cyclicRequired",
  "cyclicWriteTtl",
  "eepromSensitive",
  "enabledByDefault",
  "enumOptions",
  "excludeFromWrite",
  "icon",
  "lastVerified",
  "maxVal",
  "minVal",
  "multiplier",
  "registerType",
  "sentinelValues",
  "stateClass",
  "unit",
  "writeOnly",
] as const);

const EXPECTED_BASELINE = Object.freeze({
  repository: "https://github.com/Xerolux/idm-heatpump-api",
  python_package: "idm-heatpump-api",
  python_version: "0.8.0",
  git_tag: "v0.8.0",
  git_commit: "a5d44ed06e5bd317946ca41720f37151631bc9c6",
  parity_schema_version: 1,
} as const);

const SYNTHETIC_HOST = "example.invalid";
const SYNTHETIC_REGISTER_SOURCE = "synthetic_contract";
const SYNTHETIC_REGISTER_SOURCE_VERSION = "1";
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const NORMALIZED_ERROR_TYPES = new Set([
  "timeout",
  "disconnected",
  "socket",
  "no_response",
  "modbus",
  "illegal_address",
  "invalid_response",
]);
const VALIDATION_CODES = new Set<string>([
  "write_unknown_register",
  "write_read_only",
  "write_model_unavailable",
  "write_boolean_required",
  "write_boolean_for_numeric",
  "write_not_numeric",
  "write_nonfinite",
  "write_integer_required",
  "write_excluded",
  "write_below_minimum",
  "write_above_maximum",
  "write_enum_unsupported",
  "write_eeprom_throttled",
  "codec_input_empty",
  "codec_input_short",
  "codec_word_range",
  "codec_not_numeric",
  "codec_nonfinite",
  "codec_float_overflow",
  "codec_uchar_range",
  "codec_int8_range",
  "codec_int16_range",
  "codec_uint16_range",
] satisfies readonly (SemanticValidationErrorCode | `codec_${string}`)[]);

type ParsedRecord = Readonly<Record<string, ParsedContractValue>>;

export interface WriteScenarioBaseline {
  readonly repository: typeof EXPECTED_BASELINE.repository;
  readonly python_package: typeof EXPECTED_BASELINE.python_package;
  readonly python_version: typeof EXPECTED_BASELINE.python_version;
  readonly git_tag: typeof EXPECTED_BASELINE.git_tag;
  readonly git_commit: typeof EXPECTED_BASELINE.git_commit;
  readonly parity_schema_version: typeof EXPECTED_BASELINE.parity_schema_version;
}

export type WriteScenarioRegister = string | ParsedRecord;

export interface SimulateWriteScenarioAction {
  readonly kind: typeof WriteScenarioActionKind.SIMULATE_WRITE;
  readonly register: WriteScenarioRegister;
  readonly value: ParsedContractValue;
  readonly dryRun: boolean;
  readonly allowCustomRegister: boolean;
}

export interface WriteRegisterScenarioAction {
  readonly kind: typeof WriteScenarioActionKind.WRITE_REGISTER;
  readonly register: WriteScenarioRegister;
  readonly value: ParsedContractValue;
  readonly allowCustomRegister: boolean;
}

export interface SetValueScenarioAction {
  readonly kind: typeof WriteScenarioActionKind.SET_VALUE;
  readonly key: string;
  readonly value: ParsedContractValue;
  readonly dryRun: boolean;
}

export interface AdvanceTimeScenarioAction {
  readonly kind: typeof WriteScenarioActionKind.ADVANCE_TIME;
  readonly seconds: number;
}

export interface ResetWriteThrottleScenarioAction {
  readonly kind: typeof WriteScenarioActionKind.RESET_WRITE_THROTTLE;
  readonly register?: WriteScenarioRegister;
}

export interface GetActiveCyclicWritesScenarioAction {
  readonly kind: typeof WriteScenarioActionKind.GET_ACTIVE_CYCLIC_WRITES;
}

export interface GetExpiredCyclicWritesScenarioAction {
  readonly kind: typeof WriteScenarioActionKind.GET_EXPIRED_CYCLIC_WRITES;
}

export interface ResetCyclicWriteStateScenarioAction {
  readonly kind: typeof WriteScenarioActionKind.RESET_CYCLIC_WRITE_STATE;
  readonly register?: WriteScenarioRegister;
}

export type WriteScenarioAction =
  | SimulateWriteScenarioAction
  | WriteRegisterScenarioAction
  | SetValueScenarioAction
  | AdvanceTimeScenarioAction
  | ResetWriteThrottleScenarioAction
  | GetActiveCyclicWritesScenarioAction
  | GetExpiredCyclicWritesScenarioAction
  | ResetCyclicWriteStateScenarioAction;

export interface WriteBehaviorScenario {
  readonly name: string;
  readonly configuration: ParsedRecord;
  readonly transport_responses: readonly ParsedRecord[];
  readonly clock: readonly number[];
  readonly operation: Readonly<{
    readonly kind: "sequence";
    readonly actions: readonly WriteScenarioAction[];
  }>;
  readonly expected_result: ParsedRecord;
  readonly expected_requests: readonly ParsedRecord[];
  readonly expected_state: ParsedRecord;
}

export interface WriteBehaviorFixture {
  readonly schema_version: 1;
  readonly generator_version: "1";
  readonly baseline: WriteScenarioBaseline;
  readonly operation_kinds: readonly WriteScenarioActionKind[];
  readonly scenarios: readonly WriteBehaviorScenario[];
}

function fail(code: WriteScenarioContractCode, message: string): never {
  throw new WriteScenarioContractError(code, message);
}

function failFixture(message: string): never {
  fail(WriteScenarioContractCode.INVALID_FIXTURE, message);
}

function failScenario(message: string): never {
  fail(WriteScenarioContractCode.INVALID_SCENARIO, message);
}

function isRecord(value: ParsedContractValue): value is ParsedRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(
  value: ParsedContractValue,
  message: string,
  failure: (message: string) => never = failScenario,
): ParsedRecord {
  if (!isRecord(value)) failure(message);
  return value;
}

function requireArray(
  value: ParsedContractValue,
  message: string,
  failure: (message: string) => never = failScenario,
): readonly ParsedContractValue[] {
  if (!Array.isArray(value)) failure(message);
  return value;
}

function requireExactFields(
  value: ParsedRecord,
  fields: readonly string[],
  subject: string,
  failure: (message: string) => never = failScenario,
): void {
  const actual = Object.keys(value);
  const unknown = actual.find((field) => !fields.includes(field));
  if (unknown !== undefined) failure(`${subject} contains unknown field: ${unknown}`);
  const missing = fields.find((field) => !Object.prototype.hasOwnProperty.call(value, field));
  if (missing !== undefined) failure(`${subject} is missing field: ${missing}`);
}

function requireExactOptionalFields(
  value: ParsedRecord,
  required: readonly string[],
  optional: readonly string[],
  subject: string,
): void {
  const allowed = [...required, ...optional];
  const unknown = Object.keys(value).find((field) => !allowed.includes(field));
  if (unknown !== undefined) failScenario(`${subject} contains unknown field: ${unknown}`);
  const missing = required.find((field) => !Object.prototype.hasOwnProperty.call(value, field));
  if (missing !== undefined) failScenario(`${subject} is missing field: ${missing}`);
}

function requiredField(value: ParsedRecord, field: string): ParsedContractValue {
  const item = value[field];
  if (item === undefined) {
    failScenario(`Validated write scenario field is unexpectedly absent: ${field}`);
  }
  return item;
}

function requireBoundedString(value: ParsedContractValue, path: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > WRITE_SCENARIO_LIMITS.maxTextLength
  ) {
    failScenario(`${path} must be a non-empty bounded string`);
  }
  return value;
}

function requireBoolean(value: ParsedContractValue, path: string): boolean {
  if (typeof value !== "boolean") failScenario(`${path} must be boolean`);
  return value;
}

function requireInteger(
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

function requireFiniteNumber(
  value: ParsedContractValue,
  minimum: number,
  maximum: number,
  path: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Object.is(value, -0) ||
    value < minimum ||
    value > maximum
  ) {
    failScenario(`${path} must be a finite number in ${minimum}..${maximum}`);
  }
  return value;
}

function validateGraphSafety(value: ParsedContractValue, path: string): void {
  if (typeof value === "string") {
    if (value.length > WRITE_SCENARIO_LIMITS.maxTextLength) {
      failScenario(`${path} contains text above the write contract bound`);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) validateGraphSafety(item, `${path}[${index}]`);
    return;
  }
  if (!isRecord(value)) return;

  for (const [key, item] of Object.entries(value)) {
    if (DANGEROUS_KEYS.has(key)) failScenario(`${path} contains a forbidden object key: ${key}`);
    if (key === "cause" || key === "payload") {
      failScenario(`${path} cannot include raw causes or payloads`);
    }
    validateGraphSafety(item, `${path}.${key}`);
  }
}

function validateBaseline(value: ParsedContractValue): void {
  const baseline = requireRecord(value, "Write baseline must be an object", failFixture);
  requireExactFields(baseline, BASELINE_FIELDS, "Write baseline", failFixture);
  for (const field of BASELINE_FIELDS) {
    if (baseline[field] !== EXPECTED_BASELINE[field]) {
      failFixture(`Write baseline does not match pinned field: ${field}`);
    }
  }
}

function validateOperationKinds(value: ParsedContractValue): void {
  const kinds = requireArray(value, "Write action kinds must be an array", failFixture);
  if (kinds.length !== WRITE_ACTION_KINDS.length) {
    failFixture("Write action kinds must contain the complete closed Phase-3 set");
  }
  for (const [index, expected] of WRITE_ACTION_KINDS.entries()) {
    if (kinds[index] !== expected) {
      failFixture("Write action kinds must match the ordered closed Phase-3 set");
    }
  }
  if (new Set(kinds).size !== kinds.length) failFixture("Write action kinds must be unique");
}

function validateStringArray(value: ParsedContractValue, path: string): readonly string[] {
  const items = requireArray(value, `${path} must be an array`);
  if (items.length > WRITE_SCENARIO_LIMITS.maxRegisterDefinitions) {
    failScenario(`${path} exceeds the maximum item count`);
  }
  const strings = items.map((item, index) => requireBoundedString(item, `${path}[${index}]`));
  if (new Set(strings).size !== strings.length) failScenario(`${path} must be unique`);
  return strings;
}

function optionalNullableString(
  record: ParsedRecord,
  field: string,
  path: string,
): string | null | undefined {
  const value = record[field];
  if (value === undefined) return undefined;
  if (value === null) return null;
  return requireBoundedString(value, `${path}.${field}`);
}

function optionalNullableFiniteNumber(
  record: ParsedRecord,
  field: string,
  path: string,
): number | null | undefined {
  const value = record[field];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    failScenario(`${path}.${field} must be finite or null`);
  }
  return value;
}

function optionalBoolean(record: ParsedRecord, field: string, path: string): boolean | undefined {
  const value = record[field];
  return value === undefined ? undefined : requireBoolean(value, `${path}.${field}`);
}

function validateEnumOptions(value: ParsedContractValue, path: string): Record<number, string> {
  const options = requireRecord(value, `${path} must be an object`);
  const result: Record<number, string> = {};
  for (const [key, label] of Object.entries(options)) {
    const numeric = Number(key);
    if (!/^-?(?:0|[1-9]\d*)$/u.test(key) || !Number.isSafeInteger(numeric)) {
      failScenario(`${path} contains a non-integer enum key`);
    }
    result[numeric] = requireBoundedString(label, `${path}.${key}`);
  }
  return result;
}

function validateCustomRegister(value: ParsedRecord, path: string): void {
  requireExactOptionalFields(
    value,
    CUSTOM_REGISTER_REQUIRED_FIELDS,
    CUSTOM_REGISTER_OPTIONAL_FIELDS,
    path,
  );

  const datatype = requiredField(value, "datatype");
  if (
    typeof datatype !== "string" ||
    !(Object.values(DataType) as readonly string[]).includes(datatype)
  ) {
    failScenario(`${path}.datatype is invalid`);
  }
  const address = requireInteger(
    requiredField(value, "address"),
    MODBUS_WRITE_LIMITS.minimumAddress,
    MODBUS_WRITE_LIMITS.maximumAddress,
    `${path}.address`,
  );
  const name = requireBoundedString(requiredField(value, "name"), `${path}.name`);
  const writable = requireBoolean(requiredField(value, "writable"), `${path}.writable`);
  const source = requireBoundedString(requiredField(value, "source"), `${path}.source`);
  const sourceVersion = requireBoundedString(
    requiredField(value, "sourceVersion"),
    `${path}.sourceVersion`,
  );
  if (source !== SYNTHETIC_REGISTER_SOURCE || sourceVersion !== SYNTHETIC_REGISTER_SOURCE_VERSION) {
    failScenario(`${path} must use the reviewed synthetic register provenance`);
  }
  const supportedModels = validateStringArray(
    requiredField(value, "supportedModels"),
    `${path}.supportedModels`,
  );
  if (supportedModels.length === 0) failScenario(`${path}.supportedModels cannot be empty`);

  const registerTypeValue = value.registerType;
  if (
    registerTypeValue !== undefined &&
    (typeof registerTypeValue !== "string" ||
      !(Object.values(RegisterType) as readonly string[]).includes(registerTypeValue))
  ) {
    failScenario(`${path}.registerType is invalid`);
  }
  const enumOptionsValue = value.enumOptions;
  const enumOptions =
    enumOptionsValue === undefined || enumOptionsValue === null
      ? enumOptionsValue
      : validateEnumOptions(enumOptionsValue, `${path}.enumOptions`);
  const excludedValue = value.excludeFromWrite;
  let excludeFromWrite: ReadonlySet<number> | null | undefined;
  if (excludedValue === null) excludeFromWrite = null;
  else if (excludedValue !== undefined) {
    const items = requireArray(excludedValue, `${path}.excludeFromWrite must be an array`);
    const numbers = items.map((item, index) =>
      requireInteger(
        item,
        Number.MIN_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER,
        `${path}.excludeFromWrite[${index}]`,
      ),
    );
    if (new Set(numbers).size !== numbers.length) {
      failScenario(`${path}.excludeFromWrite must be unique`);
    }
    excludeFromWrite = new Set(numbers);
  }
  const sentinelsValue = value.sentinelValues;
  let sentinelValues: readonly (number | string)[] | undefined;
  if (sentinelsValue !== undefined) {
    const items = requireArray(sentinelsValue, `${path}.sentinelValues must be an array`);
    sentinelValues = items.map((item, index) => {
      if (typeof item === "string")
        return requireBoundedString(item, `${path}.sentinelValues[${index}]`);
      if (typeof item !== "number" || !Number.isFinite(item)) {
        failScenario(`${path}.sentinelValues[${index}] must be finite numeric or text`);
      }
      return item;
    });
  }

  const input: RegisterDefInput = {
    address,
    datatype: datatype as DataTypeValue,
    name,
    writable,
    source,
    sourceVersion,
    supportedModels,
    ...(registerTypeValue === undefined
      ? {}
      : { registerType: registerTypeValue as RegisterTypeValue }),
    ...(enumOptions === undefined ? {} : { enumOptions }),
    ...(excludeFromWrite === undefined ? {} : { excludeFromWrite }),
    ...(sentinelValues === undefined ? {} : { sentinelValues }),
  };

  const nullableStrings = ["unit", "stateClass", "icon", "lastVerified"] as const;
  for (const field of nullableStrings) {
    const checked = optionalNullableString(value, field, path);
    if (checked !== undefined) Object.assign(input, { [field]: checked });
  }
  const nullableNumbers = ["minVal", "maxVal", "cyclicWriteTtl"] as const;
  for (const field of nullableNumbers) {
    const checked = optionalNullableFiniteNumber(value, field, path);
    if (checked !== undefined) Object.assign(input, { [field]: checked });
  }
  if (value.multiplier !== undefined) {
    if (typeof value.multiplier !== "number" || !Number.isFinite(value.multiplier)) {
      failScenario(`${path}.multiplier must be finite`);
    }
    Object.assign(input, { multiplier: value.multiplier });
  }
  for (const field of [
    "binary",
    "cyclicRequired",
    "eepromSensitive",
    "enabledByDefault",
    "writeOnly",
  ] as const) {
    const checked = optionalBoolean(value, field, path);
    if (checked !== undefined) Object.assign(input, { [field]: checked });
  }

  try {
    const register = createRegisterDef(input);
    createModbusWriteRequest({
      unitId: 1,
      registerType: RegisterType.HOLDING,
      functionCode: 16,
      address: register.address,
      count: register.size,
      words: Array.from({ length: register.size }, () => 0),
    });
  } catch {
    failScenario(`${path} is not a valid bounded synthetic RegisterDef`);
  }
}

function validateRegisterOperand(value: ParsedContractValue, path: string): void {
  if (typeof value === "string") {
    requireBoundedString(value, path);
    return;
  }
  validateCustomRegister(requireRecord(value, `${path} must be a key or custom definition`), path);
}

function validateConfiguration(value: ParsedContractValue): readonly string[] {
  const configuration = requireRecord(value, "configuration must be an object");
  requireExactFields(configuration, CONFIGURATION_FIELDS, "configuration");
  if (requiredField(configuration, "host") !== SYNTHETIC_HOST) {
    failScenario("configuration.host must use example.invalid");
  }
  requireInteger(requiredField(configuration, "port"), 1, 65_535, "configuration.port");
  requireInteger(requiredField(configuration, "slaveId"), 1, 247, "configuration.slaveId");
  requireFiniteNumber(
    requiredField(configuration, "timeout"),
    Number.MIN_VALUE,
    86_400,
    "configuration.timeout",
  );
  requireInteger(requiredField(configuration, "maxRetries"), 1, 64, "configuration.maxRetries");
  requireInteger(
    requiredField(configuration, "maxGroupSize"),
    1,
    125,
    "configuration.maxGroupSize",
  );
  const detectedModel = requiredField(configuration, "detectedModel");
  if (detectedModel !== null) requireBoundedString(detectedModel, "configuration.detectedModel");

  const definitions = requireArray(
    requiredField(configuration, "registerDefinitions"),
    "configuration.registerDefinitions must be an array",
  );
  if (definitions.length > WRITE_SCENARIO_LIMITS.maxRegisterDefinitions) {
    failScenario("configuration.registerDefinitions exceeds the maximum count");
  }
  const names: string[] = [];
  for (const [index, item] of definitions.entries()) {
    const definition = requireRecord(
      item,
      `configuration.registerDefinitions[${index}] must be an object`,
    );
    validateCustomRegister(definition, `configuration.registerDefinitions[${index}]`);
    names.push(
      requireBoundedString(
        requiredField(definition, "name"),
        `configuration.registerDefinitions[${index}].name`,
      ),
    );
  }
  if (new Set(names).size !== names.length) {
    failScenario("configuration.registerDefinitions names must be unique");
  }
  return Object.freeze([
    `${SYNTHETIC_HOST}:${String(configuration.port)}`,
    `[${SYNTHETIC_HOST}]:${String(configuration.port)}`,
    SYNTHETIC_HOST,
  ]);
}

function validateAction(value: ParsedContractValue, index: number): void {
  const action = requireRecord(value, `operation.actions[${index}] must be an object`);
  const kind = requiredField(action, "kind");
  switch (kind) {
    case WriteScenarioActionKind.SIMULATE_WRITE:
      requireExactFields(
        action,
        ["allowCustomRegister", "dryRun", "kind", "register", "value"],
        `operation.actions[${index}]`,
      );
      validateRegisterOperand(
        requiredField(action, "register"),
        `operation.actions[${index}].register`,
      );
      requireBoolean(requiredField(action, "dryRun"), `operation.actions[${index}].dryRun`);
      requireBoolean(
        requiredField(action, "allowCustomRegister"),
        `operation.actions[${index}].allowCustomRegister`,
      );
      return;
    case WriteScenarioActionKind.WRITE_REGISTER:
      requireExactFields(
        action,
        ["allowCustomRegister", "kind", "register", "value"],
        `operation.actions[${index}]`,
      );
      validateRegisterOperand(
        requiredField(action, "register"),
        `operation.actions[${index}].register`,
      );
      requireBoolean(
        requiredField(action, "allowCustomRegister"),
        `operation.actions[${index}].allowCustomRegister`,
      );
      return;
    case WriteScenarioActionKind.SET_VALUE:
      requireExactFields(action, ["dryRun", "key", "kind", "value"], `operation.actions[${index}]`);
      requireBoundedString(requiredField(action, "key"), `operation.actions[${index}].key`);
      requireBoolean(requiredField(action, "dryRun"), `operation.actions[${index}].dryRun`);
      return;
    case WriteScenarioActionKind.ADVANCE_TIME:
      requireExactFields(action, ["kind", "seconds"], `operation.actions[${index}]`);
      requireFiniteNumber(
        requiredField(action, "seconds"),
        0,
        Number.MAX_VALUE,
        `operation.actions[${index}].seconds`,
      );
      return;
    case WriteScenarioActionKind.RESET_WRITE_THROTTLE:
    case WriteScenarioActionKind.RESET_CYCLIC_WRITE_STATE:
      requireExactOptionalFields(action, ["kind"], ["register"], `operation.actions[${index}]`);
      if (action.register !== undefined) {
        validateRegisterOperand(action.register, `operation.actions[${index}].register`);
      }
      return;
    case WriteScenarioActionKind.GET_ACTIVE_CYCLIC_WRITES:
    case WriteScenarioActionKind.GET_EXPIRED_CYCLIC_WRITES:
      requireExactFields(action, ["kind"], `operation.actions[${index}]`);
      return;
    default:
      failScenario(`operation.actions[${index}] kind is not in the closed Phase-3 set`);
  }
}

function validateOperation(value: ParsedContractValue): readonly ParsedRecord[] {
  const operation = requireRecord(value, "operation must be an object");
  requireExactFields(operation, ["actions", "kind"], "operation");
  if (requiredField(operation, "kind") !== "sequence") {
    failScenario("operation.kind must be sequence");
  }
  const actions = requireArray(
    requiredField(operation, "actions"),
    "operation.actions must be an array",
  );
  if (actions.length === 0 || actions.length > WRITE_SCENARIO_LIMITS.maxActions) {
    failScenario("operation.actions must contain a bounded non-empty collection");
  }
  for (const [index, action] of actions.entries()) validateAction(action, index);
  return actions as readonly ParsedRecord[];
}

function validateDiagnostic(
  message: ParsedContractValue,
  path: string,
  endpoints: readonly string[],
): void {
  if (typeof message !== "string" || message.length > WRITE_SCENARIO_LIMITS.maxDiagnosticLength) {
    failScenario(`${path} must be a bounded diagnostic string`);
  }
  for (const endpoint of endpoints) {
    if (message.includes(endpoint))
      failScenario(`${path} contains an unredacted configured endpoint`);
  }
  const placeholders = message.match(/<[^>]+>/gu) ?? [];
  if (placeholders.some((placeholder) => placeholder !== "<endpoint>")) {
    failScenario(`${path} uses a non-contract redaction placeholder`);
  }
}

function validateTransportResponses(
  value: ParsedContractValue,
  endpoints: readonly string[],
): void {
  const responses = requireArray(value, "transport_responses must be an array");
  if (responses.length > WRITE_SCENARIO_LIMITS.maxResponses) {
    failScenario("transport_responses exceeds the maximum count");
  }
  for (const [index, item] of responses.entries()) {
    const response = requireRecord(item, `transport_responses[${index}] must be an object`);
    const kind = requiredField(response, "kind");
    if (kind === "ack") {
      requireExactFields(response, ["address", "count", "kind"], `transport_responses[${index}]`);
      const address = requireInteger(
        requiredField(response, "address"),
        MODBUS_WRITE_LIMITS.minimumAddress,
        MODBUS_WRITE_LIMITS.maximumAddress,
        `transport_responses[${index}].address`,
      );
      const count = requireInteger(
        requiredField(response, "count"),
        MODBUS_WRITE_LIMITS.minimumCount,
        MODBUS_WRITE_LIMITS.maximumCount,
        `transport_responses[${index}].count`,
      );
      if (address + count > MODBUS_WRITE_LIMITS.maximumAddress + 1) {
        failScenario(`transport_responses[${index}] exceeds the Modbus address space`);
      }
      continue;
    }
    if (kind === "error") {
      requireExactFields(
        response,
        ["errorType", "kind", "message"],
        `transport_responses[${index}]`,
      );
      const errorType = requiredField(response, "errorType");
      if (typeof errorType !== "string" || !NORMALIZED_ERROR_TYPES.has(errorType)) {
        failScenario(`transport_responses[${index}].errorType is not closed`);
      }
      validateDiagnostic(
        requiredField(response, "message"),
        `transport_responses[${index}].message`,
        endpoints,
      );
      continue;
    }
    failScenario(`transport_responses[${index}] has an unknown script kind`);
  }
}

function validateExpectedRequests(value: ParsedContractValue): void {
  const requests = requireArray(value, "expected_requests must be an array");
  if (requests.length > WRITE_SCENARIO_LIMITS.maxRequests) {
    failScenario("expected_requests exceeds the maximum count");
  }
  for (const [index, item] of requests.entries()) {
    const event = requireRecord(item, `expected_requests[${index}] must be an object`);
    const kind = requiredField(event, "kind");
    if (kind === "connect" || kind === "close" || kind === "destroy") {
      requireExactFields(event, ["kind"], `expected_requests[${index}]`);
      continue;
    }
    if (kind !== "write") failScenario(`expected_requests[${index}] has an unknown trace kind`);
    requireExactFields(event, ["kind", "request"], `expected_requests[${index}]`);
    const request = requireRecord(
      requiredField(event, "request"),
      `expected_requests[${index}].request must be an object`,
    );
    requireExactFields(
      request,
      ["address", "count", "functionCode", "registerType", "unitId", "words"],
      `expected_requests[${index}].request`,
    );
    const wordsValue = requireArray(
      requiredField(request, "words"),
      `expected_requests[${index}].request.words must be an array`,
    );
    if (wordsValue.length > WRITE_SCENARIO_LIMITS.maxWords) {
      failScenario(`expected_requests[${index}].request.words exceeds the FC16 word bound`);
    }
    try {
      createModbusWriteRequest({
        address: requiredField(request, "address") as number,
        count: requiredField(request, "count") as number,
        functionCode: requiredField(request, "functionCode") as 16,
        registerType: requiredField(request, "registerType") as typeof RegisterType.HOLDING,
        unitId: requiredField(request, "unitId") as number,
        words: wordsValue as readonly number[],
      });
    } catch {
      failScenario(`expected_requests[${index}].request has an invalid FC16 identity`);
    }
  }
}

function validateTimestampRecord(value: ParsedContractValue, path: string): void {
  const record = requireRecord(value, `${path} must be an object`);
  for (const [key, timestamp] of Object.entries(record)) {
    if (
      DANGEROUS_KEYS.has(key) ||
      key.length === 0 ||
      key.length > WRITE_SCENARIO_LIMITS.maxTextLength
    ) {
      failScenario(`${path} contains an invalid register name`);
    }
    requireFiniteNumber(timestamp, 0, Number.MAX_VALUE, `${path}.${key}`);
  }
}

function validateLastError(
  value: ParsedContractValue,
  path: string,
  endpoints: readonly string[],
): void {
  if (value === null) return;
  const error = requireRecord(value, `${path} must be null or an object`);
  requireExactFields(error, LAST_ERROR_FIELDS, path);
  requireInteger(requiredField(error, "address"), 0, 65_535, `${path}.address`);
  requireInteger(requiredField(error, "count"), 1, 123, `${path}.count`);
  requireInteger(requiredField(error, "attempt"), 1, 64, `${path}.attempt`);
  if (requiredField(error, "operation") !== "write")
    failScenario(`${path}.operation must be write`);
  if (requiredField(error, "registerType") !== RegisterType.HOLDING) {
    failScenario(`${path}.registerType must be holding`);
  }
  const errorType = requiredField(error, "errorType");
  if (typeof errorType !== "string" || !NORMALIZED_ERROR_TYPES.has(errorType)) {
    failScenario(`${path}.errorType is not closed`);
  }
  validateDiagnostic(requiredField(error, "message"), `${path}.message`, endpoints);
}

function validateState(
  value: ParsedContractValue,
  path: string,
  endpoints: readonly string[],
): void {
  const state = requireRecord(value, `${path} must be an object`);
  requireExactFields(state, STATE_FIELDS, path);
  validateTimestampRecord(requiredField(state, "activeCyclicWrites"), `${path}.activeCyclicWrites`);
  validateTimestampRecord(requiredField(state, "cyclicWrites"), `${path}.cyclicWrites`);
  validateTimestampRecord(requiredField(state, "writeThrottle"), `${path}.writeThrottle`);
  validateStringArray(requiredField(state, "expiredCyclicWrites"), `${path}.expiredCyclicWrites`);
  validateStringArray(requiredField(state, "unsupportedRegisters"), `${path}.unsupportedRegisters`);
  requireBoolean(requiredField(state, "connected"), `${path}.connected`);
  requireBoolean(requiredField(state, "connectionSuspect"), `${path}.connectionSuspect`);
  requireInteger(requiredField(state, "maxActiveRequests"), 0, 64, `${path}.maxActiveRequests`);
  validateLastError(requiredField(state, "lastError"), `${path}.lastError`, endpoints);
}

function contractValuesEqual(left: ParsedContractValue, right: ParsedContractValue): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => contractValuesEqual(item, right[index] as ParsedContractValue))
    );
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(right, key) &&
        contractValuesEqual(left[key] as ParsedContractValue, right[key] as ParsedContractValue),
    )
  );
}

function validatePlanResult(value: ParsedContractValue, action: ParsedRecord, path: string): void {
  const plan = requireRecord(value, `${path}.value must be a write plan`);
  requireExactFields(
    plan,
    ["dryRun", "encodedRegisters", "register", "requestedValue"],
    `${path}.value`,
  );
  const dryRun = requireBoolean(requiredField(plan, "dryRun"), `${path}.value.dryRun`);
  if (dryRun !== requiredField(action, "dryRun")) {
    failScenario(`${path}.value.dryRun must equal the action dryRun flag`);
  }
  const words = requireArray(
    requiredField(plan, "encodedRegisters"),
    `${path}.value.encodedRegisters must be an array`,
  );
  if (words.length === 0 || words.length > WRITE_SCENARIO_LIMITS.maxWords) {
    failScenario(`${path}.value.encodedRegisters must contain a bounded FC16 payload`);
  }
  for (const [index, word] of words.entries()) {
    requireInteger(word, 0, 65_535, `${path}.value.encodedRegisters[${index}]`);
  }
  const register = requireRecord(
    requiredField(plan, "register"),
    `${path}.value.register must be an object`,
  );
  requireExactFields(register, ["address", "name"], `${path}.value.register`);
  requireInteger(
    requiredField(register, "address"),
    MODBUS_WRITE_LIMITS.minimumAddress,
    MODBUS_WRITE_LIMITS.maximumAddress,
    `${path}.value.register.address`,
  );
  requireBoundedString(requiredField(register, "name"), `${path}.value.register.name`);
  if (!contractValuesEqual(requiredField(plan, "requestedValue"), requiredField(action, "value"))) {
    failScenario(`${path}.value.requestedValue must equal the action value`);
  }
}

function validateValueResult(value: ParsedContractValue, action: ParsedRecord, path: string): void {
  const actionKind = requiredField(action, "kind");
  if (
    actionKind === WriteScenarioActionKind.SIMULATE_WRITE ||
    actionKind === WriteScenarioActionKind.SET_VALUE
  ) {
    validatePlanResult(value, action, path);
    return;
  }
  if (actionKind === WriteScenarioActionKind.GET_ACTIVE_CYCLIC_WRITES) {
    validateTimestampRecord(value, `${path}.value`);
    return;
  }
  if (actionKind === WriteScenarioActionKind.GET_EXPIRED_CYCLIC_WRITES) {
    validateStringArray(value, `${path}.value`);
    return;
  }
  if (value !== null) failScenario(`${path}.value must be null for action ${String(actionKind)}`);
}

function validateResult(
  value: ParsedContractValue,
  path: string,
  endpoints: readonly string[],
  action: ParsedRecord,
): void {
  const result = requireRecord(value, `${path} must be an object`);
  const kind = requiredField(result, "kind");
  if (kind === "value") {
    requireExactFields(result, ["kind", "value"], path);
    validateValueResult(requiredField(result, "value"), action, path);
    return;
  }
  if (kind !== "error") failScenario(`${path}.kind must be value or error`);
  const actionKind = requiredField(action, "kind");
  if (
    actionKind !== WriteScenarioActionKind.SIMULATE_WRITE &&
    actionKind !== WriteScenarioActionKind.WRITE_REGISTER &&
    actionKind !== WriteScenarioActionKind.SET_VALUE
  ) {
    failScenario(`${path} cannot be an error for action ${String(actionKind)}`);
  }
  const category = requiredField(result, "category");
  if (category === "validation") {
    requireExactFields(result, ["category", "code", "diagnostic", "kind"], path);
    const code = requiredField(result, "code");
    if (typeof code !== "string" || !VALIDATION_CODES.has(code)) {
      failScenario(`${path}.code is not a reviewed write/codec validation code`);
    }
    validateDiagnostic(requiredField(result, "diagnostic"), `${path}.diagnostic`, endpoints);
    return;
  }
  if (category === "transport") {
    if (
      actionKind === WriteScenarioActionKind.SIMULATE_WRITE ||
      (actionKind === WriteScenarioActionKind.SET_VALUE && requiredField(action, "dryRun") === true)
    ) {
      failScenario(`${path} cannot be a transport error for a no-traffic action`);
    }
    requireExactFields(result, ["category", "errorType", "kind", "message"], path);
    const errorType = requiredField(result, "errorType");
    if (typeof errorType !== "string" || !NORMALIZED_ERROR_TYPES.has(errorType)) {
      failScenario(`${path}.errorType is not closed`);
    }
    validateDiagnostic(requiredField(result, "message"), `${path}.message`, endpoints);
    return;
  }
  failScenario(`${path}.category must be validation or transport`);
}

function validateExpectedResult(
  value: ParsedContractValue,
  actions: readonly ParsedRecord[],
  endpoints: readonly string[],
): void {
  const expected = requireRecord(value, "expected_result must be an object");
  requireExactFields(expected, ["steps"], "expected_result");
  const steps = requireArray(
    requiredField(expected, "steps"),
    "expected_result.steps must be an array",
  );
  if (steps.length !== actions.length) {
    failScenario("expected_result.steps must contain exactly one entry per action");
  }
  for (const [index, item] of steps.entries()) {
    const action = actions[index];
    if (action === undefined) failScenario(`expected_result.steps[${index}] has no action`);
    const step = requireRecord(item, `expected_result.steps[${index}] must be an object`);
    requireExactFields(step, ["result", "state"], `expected_result.steps[${index}]`);
    validateResult(
      requiredField(step, "result"),
      `expected_result.steps[${index}].result`,
      endpoints,
      action,
    );
    validateState(requiredField(step, "state"), `expected_result.steps[${index}].state`, endpoints);
  }
}

function validateResponseRequestCorrelation(
  responsesValue: ParsedContractValue,
  requestsValue: ParsedContractValue,
): void {
  const responses = requireArray(responsesValue, "transport_responses must be an array");
  const requests = requireArray(requestsValue, "expected_requests must be an array");
  const writes = requests.filter(
    (request) => isRecord(request) && request.kind === "write",
  ) as readonly ParsedRecord[];
  if (responses.length !== writes.length) {
    failScenario("transport_responses must contain exactly one script per expected FC16 request");
  }
  for (const [index, responseValue] of responses.entries()) {
    const response = requireRecord(
      responseValue,
      `transport_responses[${index}] must be an object`,
    );
    if (response.kind !== "ack") continue;
    const event = writes[index];
    if (event === undefined) failScenario(`transport_responses[${index}] has no FC16 request`);
    const request = requireRecord(
      requiredField(event, "request"),
      `expected_requests write ${index} must contain a request`,
    );
    if (response.address !== request.address || response.count !== request.count) {
      failScenario(`transport_responses[${index}] acknowledgement does not match its FC16 request`);
    }
  }
}

function validateFinalStateMatchesLastStep(
  expectedResultValue: ParsedContractValue,
  expectedState: ParsedContractValue,
): void {
  const expectedResult = requireRecord(expectedResultValue, "expected_result must be an object");
  const steps = requireArray(
    requiredField(expectedResult, "steps"),
    "expected_result.steps must be an array",
  );
  const last = steps.at(-1);
  if (last === undefined) failScenario("expected_result.steps cannot be empty");
  const step = requireRecord(last, "expected_result final step must be an object");
  if (!contractValuesEqual(requiredField(step, "state"), expectedState)) {
    failScenario("expected_state must equal the final action state snapshot");
  }
}

function validateClock(value: ParsedContractValue): void {
  const clock = requireArray(value, "clock must be an array");
  if (clock.length > WRITE_SCENARIO_LIMITS.maxClockEvents) {
    failScenario("clock exceeds the maximum event count");
  }
  let previous = 0;
  for (const [index, event] of clock.entries()) {
    const timestamp = requireFiniteNumber(event, 0, Number.MAX_VALUE, `clock[${index}]`);
    if (timestamp < previous) failScenario(`clock[${index}] must be monotonic`);
    previous = timestamp;
  }
}

function validateScenario(value: ParsedContractValue, names: Set<string>): void {
  const scenario = requireRecord(value, "Write scenario must be an object");
  requireExactFields(scenario, SCENARIO_FIELDS, "Write scenario");
  validateGraphSafety(scenario, "scenario");
  const name = requiredField(scenario, "name");
  if (
    typeof name !== "string" ||
    name.length === 0 ||
    name.length > WRITE_SCENARIO_LIMITS.maxNameLength
  ) {
    failScenario("Write scenario name must be a non-empty bounded string");
  }
  if (names.has(name)) failScenario(`Write scenario name must be unique: ${name}`);
  names.add(name);

  const endpoints = validateConfiguration(requiredField(scenario, "configuration"));
  validateTransportResponses(requiredField(scenario, "transport_responses"), endpoints);
  validateClock(requiredField(scenario, "clock"));
  const actions = validateOperation(requiredField(scenario, "operation"));
  validateExpectedResult(requiredField(scenario, "expected_result"), actions, endpoints);
  validateExpectedRequests(requiredField(scenario, "expected_requests"));
  validateState(requiredField(scenario, "expected_state"), "expected_state", endpoints);
  validateResponseRequestCorrelation(
    requiredField(scenario, "transport_responses"),
    requiredField(scenario, "expected_requests"),
  );
  validateFinalStateMatchesLastStep(
    requiredField(scenario, "expected_result"),
    requiredField(scenario, "expected_state"),
  );
}

function parseSource(value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (new TextEncoder().encode(value).byteLength > WRITE_SCENARIO_LIMITS.maxSourceBytes) {
    failFixture("Write fixture source exceeds the maximum byte count");
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    failFixture("Write fixture source is not valid JSON");
  }
}

export function parseWriteBehaviorFixture(value: unknown): WriteBehaviorFixture {
  const parsed = parseTaggedValue(parseSource(value));
  const root = requireRecord(parsed, "Write fixture root must be an object", failFixture);
  requireExactFields(root, ROOT_FIELDS, "Write fixture root", failFixture);
  validateGraphSafety(root, "fixture");
  if (requiredField(root, "schema_version") !== 1) {
    failFixture("Write fixture schema version is unsupported");
  }
  if (requiredField(root, "generator_version") !== "1") {
    failFixture("Write fixture generator version is unsupported");
  }
  validateBaseline(requiredField(root, "baseline"));
  validateOperationKinds(requiredField(root, "operation_kinds"));
  const scenarios = requireArray(
    requiredField(root, "scenarios"),
    "Write fixture scenarios must be an array",
    failFixture,
  );
  if (scenarios.length === 0 || scenarios.length > WRITE_SCENARIO_LIMITS.maxScenarios) {
    failScenario("Write fixture scenarios must contain a bounded non-empty collection");
  }
  const names = new Set<string>();
  for (const scenario of scenarios) validateScenario(scenario, names);
  return root as unknown as WriteBehaviorFixture;
}

/** Compile-time assertion that generated expected write requests use the shared FC16 type. */
export type ExpectedWriteRequest = Readonly<{
  readonly kind: "write";
  readonly request: ModbusWriteRequest;
}>;
