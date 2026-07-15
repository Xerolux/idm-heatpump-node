import { MODEL_NAVIGATOR_10, MODEL_NAVIGATOR_20, MODEL_NAVIGATOR_PRO } from "../constants.js";
import { SemanticValidationError } from "../errors.js";
import {
  DATA_TYPE_SIZE,
  DataType,
  RegisterType,
  WriteClass,
  type DataType as DataTypeValue,
  type RegisterType as RegisterTypeValue,
  type WriteClass as WriteClassValue,
} from "../types.js";

const DEFAULT_REGISTER_SOURCE = "official_idm_modbus";
const DEFAULT_REGISTER_SOURCE_VERSION =
  "MODBUS TCP NAVIGATOR 10 2025-06-18 plus Navigator 2.0/Pro legacy docs";
const DEFAULT_SUPPORTED_MODELS = Object.freeze([
  MODEL_NAVIGATOR_10,
  MODEL_NAVIGATOR_20,
  MODEL_NAVIGATOR_PRO,
]);

type SentinelValue = number | string;

export interface RegisterDefInput {
  readonly address: number;
  readonly datatype: DataTypeValue;
  readonly name: string;
  readonly unit?: string | null;
  readonly writable?: boolean;
  readonly minVal?: number | null;
  readonly maxVal?: number | null;
  readonly enumOptions?: Readonly<Record<number, string>> | null;
  readonly multiplier?: number;
  readonly registerType?: RegisterTypeValue;
  readonly eepromSensitive?: boolean;
  readonly cyclicRequired?: boolean;
  readonly cyclicWriteTtl?: number | null;
  readonly binary?: boolean;
  readonly enabledByDefault?: boolean;
  readonly stateClass?: string | null;
  readonly icon?: string | null;
  readonly writeOnly?: boolean;
  readonly excludeFromWrite?: ReadonlySet<number> | null;
  readonly source?: string;
  readonly sourceVersion?: string;
  readonly supportedModels?: readonly string[];
  readonly sentinelValues?: readonly SentinelValue[];
  readonly lastVerified?: string | null;
}

export interface RegisterDef {
  readonly address: number;
  readonly datatype: DataTypeValue;
  readonly name: string;
  readonly unit: string | null;
  readonly writable: boolean;
  readonly minVal: number | null;
  readonly maxVal: number | null;
  readonly enumOptions: Readonly<Record<number, string>> | null;
  readonly multiplier: number;
  readonly registerType: RegisterTypeValue;
  readonly eepromSensitive: boolean;
  readonly cyclicRequired: boolean;
  readonly cyclicWriteTtl: number | null;
  readonly binary: boolean;
  readonly enabledByDefault: boolean;
  readonly stateClass: string | null;
  readonly icon: string | null;
  readonly writeOnly: boolean;
  readonly writeClass: WriteClassValue;
  readonly excludeFromWrite: ReadonlySet<number> | null;
  readonly source: string;
  readonly sourceVersion: string;
  readonly supportedModels: readonly string[];
  readonly sentinelValues: readonly SentinelValue[];
  readonly lastVerified: string | null;
  readonly size: 1 | 2;
}

function invalid(diagnostic: string): never {
  throw new SemanticValidationError("register_invalid", diagnostic);
}

function immutableSet<T>(
  source: Iterable<T>,
  seen = new WeakMap<object, unknown>(),
): ReadonlySet<T> {
  const backing = new Set<T>();
  const view: ReadonlySet<T> = {
    get size(): number {
      return backing.size;
    },
    has: (value: T): boolean => backing.has(value),
    entries: (): SetIterator<[T, T]> => backing.entries(),
    keys: (): SetIterator<T> => backing.keys(),
    values: (): SetIterator<T> => backing.values(),
    forEach(callback: (value: T, value2: T, set: ReadonlySet<T>) => void, thisArg?: unknown): void {
      for (const value of backing) {
        callback.call(thisArg, value, value, view);
      }
    },
    [Symbol.iterator]: (): SetIterator<T> => backing[Symbol.iterator](),
  };
  if (typeof source === "object" && source !== null) {
    seen.set(source, view);
  }
  for (const value of source) {
    backing.add(cloneAndFreeze(value, seen));
  }
  return Object.freeze(view);
}

function cloneAndFreeze<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) {
    return value;
  }

  const existing = seen.get(value);
  if (existing !== undefined) {
    return existing as T;
  }

  if (Array.isArray(value)) {
    const clone: unknown[] = [];
    seen.set(value, clone);
    for (const item of value) {
      clone.push(cloneAndFreeze(item, seen));
    }
    return Object.freeze(clone) as T;
  }

  if (value instanceof Set) {
    return immutableSet(value, seen) as T;
  }

  if (value instanceof Date) {
    const clone = new Date(value.getTime());
    seen.set(value, clone);
    return Object.freeze(clone) as T;
  }

  const clone = Object.create(Object.getPrototypeOf(value)) as object;
  seen.set(value, clone);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) {
      continue;
    }
    if ("value" in descriptor) {
      descriptor.value = cloneAndFreeze(descriptor.value, seen);
    }
    Object.defineProperty(clone, key, descriptor);
  }
  return Object.freeze(clone) as T;
}

function deriveWriteClass(
  writable: boolean,
  writeOnly: boolean,
  cyclicRequired: boolean,
  eepromSensitive: boolean,
): WriteClassValue {
  if (!writable) {
    return WriteClass.FORBIDDEN;
  }
  if (writeOnly) {
    return WriteClass.WRITE_ONLY;
  }
  if (cyclicRequired) {
    return WriteClass.CYCLIC;
  }
  if (eepromSensitive) {
    return WriteClass.EEPROM;
  }
  return WriteClass.VOLATILE;
}

export function createRegisterDef(input: RegisterDefInput): RegisterDef {
  if (!(Object.values(DataType) as readonly unknown[]).includes(input.datatype)) {
    invalid(`Invalid datatype: ${String(input.datatype)}`);
  }
  const requestedRegisterType =
    input.registerType === undefined ? RegisterType.INPUT : input.registerType;
  if (!(Object.values(RegisterType) as readonly unknown[]).includes(requestedRegisterType)) {
    invalid(`Invalid register type: ${String(requestedRegisterType)}`);
  }
  if (input.address < 0) {
    invalid(`Register address must be non-negative, got ${String(input.address)}`);
  }

  const unit = input.unit ?? null;
  const writable = input.writable ?? false;
  const minVal = input.minVal ?? null;
  const maxVal = input.maxVal ?? null;
  const enumOptions = input.enumOptions ?? null;
  const multiplier = input.multiplier ?? 1;
  const registerType = requestedRegisterType;
  const eepromSensitive = input.eepromSensitive ?? false;
  const cyclicRequired = input.cyclicRequired ?? false;
  const cyclicWriteTtl = input.cyclicWriteTtl ?? null;
  const binary = input.binary ?? false;
  const enabledByDefault = input.enabledByDefault ?? true;
  const stateClass = input.stateClass ?? null;
  const icon = input.icon ?? null;
  const writeOnly = input.writeOnly ?? false;
  const excludeFromWrite = input.excludeFromWrite ?? null;
  const source = input.source === undefined ? DEFAULT_REGISTER_SOURCE : input.source;
  const sourceVersion =
    input.sourceVersion === undefined ? DEFAULT_REGISTER_SOURCE_VERSION : input.sourceVersion;
  const supportedModels =
    input.supportedModels === undefined ? DEFAULT_SUPPORTED_MODELS : input.supportedModels;
  const sentinelValues = input.sentinelValues ?? [];
  const lastVerified = input.lastVerified ?? null;

  if (!source) {
    invalid(`Register source must not be empty for ${input.name}`);
  }
  if (!sourceVersion) {
    invalid(`Register source version must not be empty for ${input.name}`);
  }
  if (supportedModels.length === 0) {
    invalid(`Register ${input.name} must declare at least one supported model`);
  }
  if (!Number.isFinite(multiplier) || multiplier === 0) {
    invalid(`Multiplier must be finite and non-zero, got ${String(multiplier)}`);
  }
  if (minVal !== null && !Number.isFinite(minVal)) {
    invalid(`Minimum value must be finite, got ${String(minVal)}`);
  }
  if (maxVal !== null && !Number.isFinite(maxVal)) {
    invalid(`Maximum value must be finite, got ${String(maxVal)}`);
  }
  if (minVal !== null && maxVal !== null && minVal > maxVal) {
    invalid(`Minimum value ${String(minVal)} exceeds maximum ${String(maxVal)}`);
  }
  if (
    !writable &&
    (eepromSensitive ||
      cyclicRequired ||
      writeOnly ||
      (excludeFromWrite !== null && excludeFromWrite.size > 0))
  ) {
    invalid(`Write metadata requires writable=True for register ${input.name}`);
  }
  if (eepromSensitive && cyclicRequired) {
    invalid(`Register ${input.name} cannot be both EEPROM-sensitive and cyclic`);
  }
  if (cyclicWriteTtl !== null) {
    if (!cyclicRequired) {
      invalid(`Cyclic write TTL requires cyclic_required=True for ${input.name}`);
    }
    if (!Number.isFinite(cyclicWriteTtl) || cyclicWriteTtl <= 0) {
      invalid(`Cyclic write TTL must be finite and positive for ${input.name}`);
    }
  }

  const definition: RegisterDef = {
    address: input.address,
    datatype: input.datatype,
    name: input.name,
    unit,
    writable,
    minVal,
    maxVal,
    enumOptions: enumOptions === null ? null : cloneAndFreeze(enumOptions),
    multiplier,
    registerType,
    eepromSensitive,
    cyclicRequired,
    cyclicWriteTtl,
    binary,
    enabledByDefault,
    stateClass,
    icon,
    writeOnly,
    writeClass: deriveWriteClass(writable, writeOnly, cyclicRequired, eepromSensitive),
    excludeFromWrite:
      excludeFromWrite === null ? null : immutableSet(excludeFromWrite as Iterable<number>),
    source,
    sourceVersion,
    supportedModels: cloneAndFreeze([...supportedModels]),
    sentinelValues: cloneAndFreeze([...sentinelValues]),
    lastVerified,
    size: DATA_TYPE_SIZE[input.datatype],
  };
  return Object.freeze(definition);
}
