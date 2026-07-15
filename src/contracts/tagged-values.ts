export const ContractValueCode = Object.freeze({
  INVALID_NUMBER_TAG: "invalid_number_tag",
  INVALID_CONTRACT_VALUE: "invalid_contract_value",
} as const);

export type ContractValueCode = (typeof ContractValueCode)[keyof typeof ContractValueCode];

export class ContractValueError extends Error {
  public readonly code: ContractValueCode;

  public constructor(code: ContractValueCode, message: string) {
    super(message);
    this.name = "ContractValueError";
    this.code = code;
  }
}

export const TAGGED_VALUE_LIMITS = Object.freeze({
  maxDepth: 32,
  maxNodes: 10_000,
  maxArrayLength: 4_096,
  maxObjectKeys: 1_024,
  maxStringLength: 16_384,
} as const);

const NUMBER_TAGS = Object.freeze(["NaN", "+Infinity", "-Infinity", "-0"] as const);

export type NumberTag = (typeof NUMBER_TAGS)[number];

export type TaggedNumber = Readonly<{
  readonly $number: NumberTag;
}>;

export type NormalizedContractValue =
  | null
  | boolean
  | string
  | number
  | TaggedNumber
  | readonly NormalizedContractValue[]
  | { readonly [key: string]: NormalizedContractValue };

export type ParsedContractValue =
  | null
  | boolean
  | string
  | number
  | readonly ParsedContractValue[]
  | { readonly [key: string]: ParsedContractValue };

interface TraversalState {
  nodes: number;
  readonly active: WeakSet<object>;
}

type TransformMode = "normalize" | "parse";

const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

function fail(code: ContractValueCode, message: string): never {
  throw new ContractValueError(code, message);
}

function failInvalidValue(message: string): never {
  fail(ContractValueCode.INVALID_CONTRACT_VALUE, message);
}

function visitNode(state: TraversalState, depth: number): void {
  state.nodes += 1;
  if (state.nodes > TAGGED_VALUE_LIMITS.maxNodes) {
    failInvalidValue("Contract value exceeds the maximum node count");
  }
  if (depth > TAGGED_VALUE_LIMITS.maxDepth) {
    failInvalidValue("Contract value exceeds the maximum depth");
  }
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function ownDataEntries(value: object): readonly (readonly [string, unknown])[] {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key === "symbol")) {
    failInvalidValue("Contract objects cannot contain symbol keys");
  }

  const descriptors = Object.getOwnPropertyDescriptors(value);
  return (keys as string[]).map((key) => {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor)) {
      failInvalidValue("Contract objects must contain data properties only");
    }
    return [key, descriptor.value] as const;
  });
}

function withActiveObject<T>(state: TraversalState, value: object, callback: () => T): T {
  if (state.active.has(value)) {
    failInvalidValue("Contract values cannot contain circular references");
  }

  state.active.add(value);
  try {
    return callback();
  } finally {
    state.active.delete(value);
  }
}

function readTaggedNumber(value: object): NumberTag {
  if (!isPlainObject(value)) {
    fail(ContractValueCode.INVALID_NUMBER_TAG, "Reserved number envelopes must be plain objects");
  }

  let entries: readonly (readonly [string, unknown])[];
  try {
    entries = ownDataEntries(value);
  } catch (error) {
    if (error instanceof ContractValueError) {
      fail(ContractValueCode.INVALID_NUMBER_TAG, error.message);
    }
    throw error;
  }

  if (entries.length !== 1 || entries[0]?.[0] !== "$number") {
    fail(
      ContractValueCode.INVALID_NUMBER_TAG,
      "Reserved number envelopes must contain only $number",
    );
  }

  const tag = entries[0][1];
  if (typeof tag !== "string" || !NUMBER_TAGS.includes(tag as NumberTag)) {
    fail(ContractValueCode.INVALID_NUMBER_TAG, "Reserved number envelope has an unknown tag");
  }
  return tag as NumberTag;
}

function taggedNumber(tag: NumberTag): TaggedNumber {
  return Object.freeze({ $number: tag });
}

function parsedNumber(tag: NumberTag): number {
  switch (tag) {
    case "NaN":
      return Number.NaN;
    case "+Infinity":
      return Number.POSITIVE_INFINITY;
    case "-Infinity":
      return Number.NEGATIVE_INFINITY;
    case "-0":
      return -0;
  }
}

function normalizeNumber(value: number): number | TaggedNumber {
  if (Number.isNaN(value)) {
    return taggedNumber("NaN");
  }
  if (value === Number.POSITIVE_INFINITY) {
    return taggedNumber("+Infinity");
  }
  if (value === Number.NEGATIVE_INFINITY) {
    return taggedNumber("-Infinity");
  }
  if (Object.is(value, -0)) {
    return taggedNumber("-0");
  }
  return value;
}

function parseNumber(value: number): number {
  if (!Number.isFinite(value) || Object.is(value, -0)) {
    fail(
      ContractValueCode.INVALID_NUMBER_TAG,
      "Exceptional numbers must use the reserved number envelope",
    );
  }
  return value;
}

function normalizeMapKey(key: unknown): string {
  if (typeof key === "string") {
    if (key.length > TAGGED_VALUE_LIMITS.maxStringLength) {
      failInvalidValue("Contract mapping key exceeds the maximum string length");
    }
    return key;
  }
  if (typeof key === "number" && Number.isSafeInteger(key)) {
    return String(key);
  }
  failInvalidValue("Contract mapping keys must be strings or safe integers");
}

function defineFrozenRecord(
  entries: readonly (readonly [string, NormalizedContractValue | ParsedContractValue])[],
): Readonly<Record<string, NormalizedContractValue | ParsedContractValue>> {
  const result: Record<string, NormalizedContractValue | ParsedContractValue> = {};
  for (const [key, item] of entries) {
    Object.defineProperty(result, key, {
      configurable: false,
      enumerable: true,
      value: item,
      writable: false,
    });
  }
  return Object.freeze(result);
}

function canonicalSortKey(value: NormalizedContractValue): string {
  return JSON.stringify(value);
}

function transformArray(
  value: readonly unknown[],
  mode: TransformMode,
  state: TraversalState,
  depth: number,
): readonly (NormalizedContractValue | ParsedContractValue)[] {
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    failInvalidValue("Contract arrays must use the standard array prototype");
  }
  if (value.length > TAGGED_VALUE_LIMITS.maxArrayLength) {
    failInvalidValue("Contract array exceeds the maximum length");
  }

  return withActiveObject(state, value, () => {
    const entries = ownDataEntries(value).filter(([key]) => key !== "length");
    if (entries.length !== value.length) {
      failInvalidValue("Contract arrays must be dense and cannot contain extra properties");
    }

    const result: (NormalizedContractValue | ParsedContractValue)[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const entry = entries[index];
      if (entry?.[0] !== String(index)) {
        failInvalidValue("Contract arrays must contain only ordered index properties");
      }
      result.push(transformValue(entry[1], mode, state, depth + 1));
    }
    return Object.freeze(result);
  });
}

function transformMap(
  value: ReadonlyMap<unknown, unknown>,
  state: TraversalState,
  depth: number,
): NormalizedContractValue {
  if (Object.getPrototypeOf(value) !== Map.prototype) {
    failInvalidValue("Contract maps must use the standard map prototype");
  }
  if (value.size > TAGGED_VALUE_LIMITS.maxObjectKeys) {
    failInvalidValue("Contract map exceeds the maximum key count");
  }

  return withActiveObject(state, value, () => {
    const normalized = new Map<string, NormalizedContractValue>();
    for (const [rawKey, rawItem] of value) {
      const key = normalizeMapKey(rawKey);
      if (normalized.has(key)) {
        failInvalidValue(`Contract mapping contains duplicate normalized key: ${key}`);
      }
      normalized.set(key, transformValue(rawItem, "normalize", state, depth + 1));
    }

    return defineFrozenRecord(
      [...normalized].sort(([left], [right]) => left.localeCompare(right)),
    ) as NormalizedContractValue;
  });
}

function transformSet(
  value: ReadonlySet<unknown>,
  state: TraversalState,
  depth: number,
): NormalizedContractValue {
  if (Object.getPrototypeOf(value) !== Set.prototype) {
    failInvalidValue("Contract sets must use the standard set prototype");
  }
  if (value.size > TAGGED_VALUE_LIMITS.maxArrayLength) {
    failInvalidValue("Contract set exceeds the maximum item count");
  }

  return withActiveObject(state, value, () => {
    const items = [...value].map((item) =>
      transformValue(item, "normalize", state, depth + 1),
    ) as NormalizedContractValue[];
    items.sort((left, right) => canonicalSortKey(left).localeCompare(canonicalSortKey(right)));
    return Object.freeze(items);
  });
}

function transformRecord(
  value: object,
  mode: TransformMode,
  state: TraversalState,
  depth: number,
): NormalizedContractValue | ParsedContractValue {
  if (!isPlainObject(value)) {
    failInvalidValue("Contract objects must be plain objects");
  }

  return withActiveObject(state, value, () => {
    const rawEntries = ownDataEntries(value);
    if (rawEntries.length > TAGGED_VALUE_LIMITS.maxObjectKeys) {
      failInvalidValue("Contract object exceeds the maximum key count");
    }

    const entries = rawEntries
      .map(([key, item]) => {
        if (key.length > TAGGED_VALUE_LIMITS.maxStringLength) {
          failInvalidValue("Contract object key exceeds the maximum string length");
        }
        return [key, transformValue(item, mode, state, depth + 1)] as const;
      })
      .sort(([left], [right]) => left.localeCompare(right));
    return defineFrozenRecord(entries) as NormalizedContractValue | ParsedContractValue;
  });
}

function transformValue(
  value: unknown,
  mode: TransformMode,
  state: TraversalState,
  depth: number,
): NormalizedContractValue | ParsedContractValue {
  visitNode(state, depth);

  if (value === null || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value.length > TAGGED_VALUE_LIMITS.maxStringLength) {
      failInvalidValue("Contract string exceeds the maximum length");
    }
    return value;
  }
  if (typeof value === "number") {
    return mode === "normalize" ? normalizeNumber(value) : parseNumber(value);
  }
  if (typeof value !== "object") {
    failInvalidValue(`Unsupported contract value type: ${typeof value}`);
  }

  try {
    if (hasOwn(value, "$number")) {
      const tag = readTaggedNumber(value);
      return mode === "normalize" ? taggedNumber(tag) : parsedNumber(tag);
    }
    if (Array.isArray(value)) {
      return transformArray(value, mode, state, depth);
    }
    if (mode === "normalize" && value instanceof Map) {
      return transformMap(value, state, depth);
    }
    if (mode === "normalize" && value instanceof Set) {
      return transformSet(value, state, depth);
    }
    return transformRecord(value, mode, state, depth);
  } catch (error) {
    if (error instanceof ContractValueError) {
      throw error;
    }
    failInvalidValue("Contract value could not be inspected safely");
  }
}

function initialState(): TraversalState {
  return { nodes: 0, active: new WeakSet<object>() };
}

export function normalizeTaggedValue(value: unknown): NormalizedContractValue {
  return transformValue(value, "normalize", initialState(), 0) as NormalizedContractValue;
}

export function parseTaggedValue(value: unknown): ParsedContractValue {
  return transformValue(value, "parse", initialState(), 0) as ParsedContractValue;
}
