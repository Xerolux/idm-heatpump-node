import { encodeValue } from "../codec.js";
import { SemanticValidationError } from "../errors.js";
import type { RegisterDef } from "../registers/definitions.js";
import { buildRegisterMap, getRegister } from "../registers/registry.js";
import { DataType, type DataType as DataTypeValue, type IdmModelInfo } from "../types.js";

const INTEGER_WRITE_TYPES: ReadonlySet<DataTypeValue> = new Set([
  DataType.UCHAR,
  DataType.INT8,
  DataType.INT16,
  DataType.UINT16,
  DataType.BITFLAG,
]);

export interface WriteSafetyResultInput {
  readonly register: RegisterDef;
  readonly requestedValue: unknown;
  readonly encodedRegisters: readonly number[];
  readonly dryRun?: boolean;
}

export interface WriteSafetyResult {
  readonly register: RegisterDef;
  readonly requestedValue: unknown;
  readonly encodedRegisters: readonly number[];
  readonly dryRun: boolean;
}

function ownEncodedWords(words: readonly number[]): readonly number[] {
  const owned = [...words];
  for (const word of owned) {
    if (!Number.isInteger(word) || word < 0 || word > 0xffff) {
      throw new RangeError("Encoded registers must contain only 16-bit unsigned integers");
    }
  }
  return Object.freeze(owned);
}

export const WriteSafetyResult = Object.freeze({
  create(input: WriteSafetyResultInput): WriteSafetyResult {
    return Object.freeze({
      register: input.register,
      requestedValue: input.requestedValue,
      encodedRegisters: ownEncodedWords(input.encodedRegisters),
      dryRun: input.dryRun ?? false,
    });
  },
});

interface WriteSafetyStateGuard {
  assertEepromWriteAllowed(register: RegisterDef, now: number): void;
}

export interface WritePlanInput {
  readonly register: RegisterDef | string;
  readonly value: unknown;
  readonly dryRun?: boolean;
  readonly allowCustomRegister?: boolean;
  readonly modelInfo?: IdmModelInfo | null;
  readonly modelRegisterMap?: ReadonlyMap<string, RegisterDef>;
  readonly writeSafetyState?: WriteSafetyStateGuard;
  readonly now?: number;
}

function reject(
  code: ConstructorParameters<typeof SemanticValidationError>[0],
  diagnostic: string,
): never {
  throw new SemanticValidationError(code, diagnostic);
}

function pythonNumberText(value: number): string {
  if (Number.isNaN(value)) return "nan";
  if (value === Number.POSITIVE_INFINITY) return "inf";
  if (value === Number.NEGATIVE_INFINITY) return "-inf";
  return String(value);
}

function pythonRepr(value: unknown): string {
  if (typeof value === "string") {
    return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
  }
  if (typeof value === "number") return pythonNumberText(value);
  if (typeof value === "boolean") return value ? "True" : "False";
  if (value === null) return "None";
  return String(value);
}

function pythonValueText(value: unknown): string {
  return typeof value === "number" ? pythonNumberText(value) : String(value);
}

function resolveRegister(
  register: RegisterDef | string,
  modelInfo: IdmModelInfo | null,
): RegisterDef {
  if (typeof register !== "string") return register;
  try {
    return getRegister(register, { modelInfo });
  } catch {
    reject("write_unknown_register", `Register '${register}' not found.`);
  }
}

function assertModelMembership(
  register: RegisterDef,
  modelInfo: IdmModelInfo | null,
  modelRegisterMap: ReadonlyMap<string, RegisterDef> | undefined,
): void {
  if (modelInfo === null) return;
  const available = (modelRegisterMap ?? buildRegisterMap({ modelInfo })).get(register.name);
  if (available === undefined || available.address !== register.address) {
    reject(
      "write_model_unavailable",
      `Register '${register.name}' is not available for detected model ${modelInfo.modelName}`,
    );
  }
}

function assertWriteValue(register: RegisterDef, value: unknown): number {
  if (register.datatype === DataType.BOOL) {
    if (!(
      typeof value === "boolean" ||
      (typeof value === "number" && (value === 0 || value === 1))
    )) {
      reject(
        "write_boolean_required",
        `Value ${pythonRepr(value)} for '${register.name}' must be a boolean or integer 0/1`,
      );
    }
    return typeof value === "boolean" ? (value ? 1 : 0) : value;
  }

  if (typeof value === "boolean") {
    reject(
      "write_boolean_for_numeric",
      `Boolean value is not valid for numeric register '${register.name}'`,
    );
  }
  if (typeof value !== "number") {
    reject("write_not_numeric", `Value ${pythonRepr(value)} for '${register.name}' is not numeric`);
  }
  if (!Number.isFinite(value)) {
    reject("write_nonfinite", `Value ${pythonRepr(value)} for '${register.name}' must be finite`);
  }
  if (INTEGER_WRITE_TYPES.has(register.datatype) && !Number.isInteger(value)) {
    reject(
      "write_integer_required",
      `Value ${pythonRepr(value)} for '${register.name}' must be an integer`,
    );
  }
  return value;
}

function assertWriteMetadata(register: RegisterDef, value: unknown, comparableValue: number): void {
  const integerValue = Math.trunc(comparableValue);
  if (register.excludeFromWrite?.has(integerValue) === true) {
    const excluded = [...register.excludeFromWrite].sort((left, right) => left - right);
    const setText = excluded.length === 0 ? "set()" : `{${excluded.join(", ")}}`;
    reject(
      "write_excluded",
      `Value ${pythonValueText(value)} for '${register.name}' is not writable (excluded values: ${setText})`,
    );
  }
  if (register.minVal !== null && comparableValue < register.minVal) {
    reject(
      "write_below_minimum",
      `Value ${pythonValueText(value)} for '${register.name}' is below minimum ${String(register.minVal)}`,
    );
  }
  if (register.maxVal !== null && comparableValue > register.maxVal) {
    reject(
      "write_above_maximum",
      `Value ${pythonValueText(value)} for '${register.name}' exceeds maximum ${String(register.maxVal)}`,
    );
  }
  if (register.enumOptions !== null && !Object.hasOwn(register.enumOptions, integerValue)) {
    const options = Object.keys(register.enumOptions)
      .map(Number)
      .sort((left, right) => left - right);
    reject(
      "write_enum_unsupported",
      `Value ${pythonRepr(value)} for '${register.name}' is not a supported option ([${options.join(", ")}])`,
    );
  }
}

/**
 * Resolve, validate, and encode one write without connecting or sending.
 *
 * The model bypass applies only to name/address membership. Every other guard
 * and the authoritative codec always run in the pinned Python order.
 */
export function createWritePlan(input: WritePlanInput): WriteSafetyResult {
  const modelInfo = input.modelInfo ?? null;
  const register = resolveRegister(input.register, modelInfo);
  if (!register.writable) {
    reject("write_read_only", `Register '${register.name}' is read-only`);
  }
  if (input.allowCustomRegister !== true) {
    assertModelMembership(register, modelInfo, input.modelRegisterMap);
  }

  const comparableValue = assertWriteValue(register, input.value);
  assertWriteMetadata(register, input.value, comparableValue);
  if (input.writeSafetyState !== undefined) {
    if (input.now === undefined) {
      throw new TypeError("Write planning with safety state requires a monotonic timestamp");
    }
    input.writeSafetyState.assertEepromWriteAllowed(register, input.now);
  }

  return WriteSafetyResult.create({
    register,
    requestedValue: input.value,
    encodedRegisters: encodeValue(input.value, register),
    dryRun: input.dryRun ?? true,
  });
}
