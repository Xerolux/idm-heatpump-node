import { encodeValue } from "../codec.js";
import { compareUnicodeCodePoints } from "../contracts/canonical-order.js";
import { SemanticValidationError } from "../errors.js";
import type { RegisterDef } from "../registers/definitions.js";
import { buildRegisterMap, getRegister } from "../registers/registry.js";
import {
  DataType,
  WriteClass,
  type DataType as DataTypeValue,
  type IdmModelInfo,
} from "../types.js";

const EEPROM_WRITE_INTERVAL_SECONDS = 60;
const DEFAULT_CYCLIC_WRITE_TTL_SECONDS = 300;

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

export interface SimulateWriteOptions {
  readonly dryRun?: boolean;
  readonly allowCustomRegister?: boolean;
}

export interface WriteRegisterOptions {
  readonly allowCustomRegister?: boolean;
}

export interface SetValueOptions {
  readonly dryRun?: boolean;
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

export interface InternalWriteSafetyStateSeed {
  readonly writeThrottle?: Readonly<Record<string, number>>;
  readonly cyclicWrites?: Readonly<Record<string, number>>;
}

export interface InternalWriteSafetyStateSnapshot {
  readonly writeThrottle: Readonly<Record<string, number>>;
  readonly cyclicWrites: Readonly<Record<string, number>>;
  readonly activeCyclicWrites: Readonly<Record<string, number>>;
  readonly expiredCyclicWrites: ReadonlySet<string>;
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

function requireMonotonicSeconds(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || Object.is(value, -0)) {
    throw new RangeError(`${field} must be a finite non-negative number`);
  }
}

/** Match CPython's correctly rounded binary64 ``format(value, ".1f")``. */
function formatPythonBinary64OneDecimal(value: number): string {
  if (!Number.isFinite(value)) {
    throw new RangeError("One-decimal diagnostics require a finite number");
  }

  const negative = value < 0 || Object.is(value, -0);
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, Math.abs(value), false);
  const high = view.getUint32(0, false);
  const low = view.getUint32(4, false);
  const exponentBits = (high >>> 20) & 0x7ff;
  const fractionBits = (BigInt(high & 0x000f_ffff) << 32n) | BigInt(low);
  const significand = exponentBits === 0 ? fractionBits : (1n << 52n) | fractionBits;
  const binaryExponent = exponentBits === 0 ? -1074 : exponentBits - 1023 - 52;

  let numerator = significand * 10n;
  let denominator = 1n;
  if (binaryExponent >= 0) {
    numerator <<= BigInt(binaryExponent);
  } else {
    denominator <<= BigInt(-binaryExponent);
  }

  let rounded = numerator / denominator;
  const remainder = numerator % denominator;
  const comparison = remainder * 2n - denominator;
  if (comparison > 0n || (comparison === 0n && rounded % 2n !== 0n)) {
    rounded += 1n;
  }

  const whole = rounded / 10n;
  const fraction = rounded % 10n;
  return `${negative ? "-" : ""}${whole.toString()}.${fraction.toString()}`;
}

function sortedEntries(source: ReadonlyMap<string, number>): readonly [string, number][] {
  return [...source].sort(([left], [right]) => compareUnicodeCodePoints(left, right));
}

function immutableTimestampRecord(
  source: ReadonlyMap<string, number>,
  predicate: (value: number) => boolean = () => true,
): Readonly<Record<string, number>> {
  return Object.freeze(
    Object.fromEntries(sortedEntries(source).filter(([, value]) => predicate(value))),
  );
}

function immutableStringSet(values: Iterable<string>): ReadonlySet<string> {
  const backing = new Set(values);
  const view: ReadonlySet<string> = {
    get size(): number {
      return backing.size;
    },
    has: (value): boolean => backing.has(value),
    entries: (): SetIterator<[string, string]> => backing.entries(),
    keys: (): SetIterator<string> => backing.keys(),
    values: (): SetIterator<string> => backing.values(),
    forEach(callback, thisArg): void {
      for (const value of backing) callback.call(thisArg, value, value, view);
    },
    [Symbol.iterator]: (): SetIterator<string> => backing[Symbol.iterator](),
  };
  return Object.freeze(view);
}

function timestampMap(
  source: Readonly<Record<string, number>> | undefined,
  field: string,
): Map<string, number> {
  const result = new Map<string, number>();
  for (const [name, timestamp] of Object.entries(source ?? {})) {
    requireMonotonicSeconds(timestamp, `${field}.${name}`);
    result.set(name, timestamp);
  }
  return result;
}

/** Provider-neutral EEPROM and cyclic state with one explicit success mutation hook. */
export class WriteSafetyState implements WriteSafetyStateGuard {
  #lastEepromWrites = new Map<string, number>();
  #cyclicWriteDeadlines = new Map<string, number>();

  public constructor(seed: InternalWriteSafetyStateSeed = {}) {
    this.seed(seed);
  }

  public seed(seed: InternalWriteSafetyStateSeed): void {
    const writeThrottle = timestampMap(seed.writeThrottle, "writeThrottle");
    const cyclicWrites = timestampMap(seed.cyclicWrites, "cyclicWrites");
    this.#lastEepromWrites = writeThrottle;
    this.#cyclicWriteDeadlines = cyclicWrites;
  }

  public assertEepromWriteAllowed(register: RegisterDef, now: number): void {
    requireMonotonicSeconds(now, "now");
    if (register.writeClass !== WriteClass.EEPROM) return;
    const lastWrite = this.#lastEepromWrites.get(register.name);
    if (lastWrite === undefined) return;
    const elapsed = now - lastWrite;
    if (elapsed < EEPROM_WRITE_INTERVAL_SECONDS) {
      const remaining = EEPROM_WRITE_INTERVAL_SECONDS - elapsed;
      reject(
        "write_eeprom_throttled",
        `EEPROM-sensitive register '${register.name}' was written too recently (try again in ${formatPythonBinary64OneDecimal(remaining)}s)`,
      );
    }
  }

  public recordSuccessfulWrite(register: RegisterDef, now: number): void {
    requireMonotonicSeconds(now, "now");
    if (register.writeClass === WriteClass.EEPROM) {
      this.#lastEepromWrites.set(register.name, now);
    }
    if (register.writeClass === WriteClass.CYCLIC) {
      this.#cyclicWriteDeadlines.set(
        register.name,
        now + (register.cyclicWriteTtl ?? DEFAULT_CYCLIC_WRITE_TTL_SECONDS),
      );
    }
  }

  public resetWriteThrottle(register: RegisterDef | null = null): void {
    if (register === null) this.#lastEepromWrites.clear();
    else this.#lastEepromWrites.delete(register.name);
  }

  public getActiveCyclicWrites(now: number): Readonly<Record<string, number>> {
    requireMonotonicSeconds(now, "now");
    return immutableTimestampRecord(this.#cyclicWriteDeadlines, (deadline) => deadline > now);
  }

  public getExpiredCyclicWrites(now: number): ReadonlySet<string> {
    requireMonotonicSeconds(now, "now");
    return immutableStringSet(
      sortedEntries(this.#cyclicWriteDeadlines)
        .filter(([, deadline]) => deadline <= now)
        .map(([name]) => name),
    );
  }

  public resetCyclicWriteState(register: RegisterDef | null = null): void {
    if (register === null) this.#cyclicWriteDeadlines.clear();
    else this.#cyclicWriteDeadlines.delete(register.name);
  }

  public snapshot(now: number): InternalWriteSafetyStateSnapshot {
    requireMonotonicSeconds(now, "now");
    return Object.freeze({
      writeThrottle: immutableTimestampRecord(this.#lastEepromWrites),
      cyclicWrites: immutableTimestampRecord(this.#cyclicWriteDeadlines),
      activeCyclicWrites: this.getActiveCyclicWrites(now),
      expiredCyclicWrites: this.getExpiredCyclicWrites(now),
    });
  }
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
