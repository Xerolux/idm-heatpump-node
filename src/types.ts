export const DataType = Object.freeze({
  FLOAT: "FLOAT",
  UCHAR: "UCHAR",
  INT8: "INT8",
  INT16: "INT16",
  UINT16: "UINT16",
  BOOL: "BOOL",
  BITFLAG: "BITFLAG",
} as const);

export type DataType = (typeof DataType)[keyof typeof DataType];

export const RegisterType = Object.freeze({
  INPUT: "input",
  HOLDING: "holding",
} as const);

export type RegisterType = (typeof RegisterType)[keyof typeof RegisterType];

export const WriteClass = Object.freeze({
  FORBIDDEN: "forbidden",
  VOLATILE: "volatile",
  CYCLIC: "cyclic",
  EEPROM: "eeprom",
  WRITE_ONLY: "write_only",
} as const);

export type WriteClass = (typeof WriteClass)[keyof typeof WriteClass];

export const DATA_TYPE_SIZE: Readonly<Record<DataType, 1 | 2>> = Object.freeze({
  FLOAT: 2,
  UCHAR: 1,
  INT8: 1,
  INT16: 1,
  UINT16: 1,
  BOOL: 1,
  BITFLAG: 1,
});

function immutableSet<T>(values: Iterable<T>): ReadonlySet<T> {
  const backing = new Set(values);
  const view: ReadonlySet<T> = Object.freeze({
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
  });
  return view;
}

export interface FeatureFlagsInput {
  readonly enableNav2Web?: boolean;
  readonly enableNav10Ws?: boolean;
  readonly enableExperimentalFeatures?: boolean;
  readonly enableWriteSupport?: boolean;
  readonly enableDebugEndpoints?: boolean;
}

export interface FeatureFlags {
  readonly enableNav2Web: boolean;
  readonly enableNav10Ws: boolean;
  readonly enableExperimentalFeatures: boolean;
  readonly enableWriteSupport: boolean;
  readonly enableDebugEndpoints: boolean;
}

export const FeatureFlags = Object.freeze({
  create(input: FeatureFlagsInput = {}): FeatureFlags {
    return Object.freeze({
      enableNav2Web: input.enableNav2Web ?? true,
      enableNav10Ws: input.enableNav10Ws ?? true,
      enableExperimentalFeatures: input.enableExperimentalFeatures ?? false,
      enableWriteSupport: input.enableWriteSupport ?? true,
      enableDebugEndpoints: input.enableDebugEndpoints ?? false,
    });
  },
});

export interface IdmModelInfoInput {
  readonly modelName: string;
  readonly activeHeatingCircuits: readonly string[];
  readonly zoneModules: number;
  readonly hasSolar: boolean;
  readonly hasIsc: boolean;
  readonly hasPv: boolean;
  readonly hasCascade: boolean;
  readonly features?: Iterable<string>;
  readonly firmwareVersion?: number | null;
}

export interface IdmModelInfo {
  readonly modelName: string;
  readonly activeHeatingCircuits: readonly string[];
  readonly zoneModules: number;
  readonly hasSolar: boolean;
  readonly hasIsc: boolean;
  readonly hasPv: boolean;
  readonly hasCascade: boolean;
  readonly features: ReadonlySet<string>;
  readonly firmwareVersion: number | null;
  readonly isPro: boolean;
}

export const IdmModelInfo = Object.freeze({
  create(input: IdmModelInfoInput): IdmModelInfo {
    return Object.freeze({
      modelName: input.modelName,
      activeHeatingCircuits: Object.freeze([...input.activeHeatingCircuits]),
      zoneModules: input.zoneModules,
      hasSolar: input.hasSolar,
      hasIsc: input.hasIsc,
      hasPv: input.hasPv,
      hasCascade: input.hasCascade,
      features: immutableSet(input.features ?? []),
      firmwareVersion: input.firmwareVersion ?? null,
      isPro: input.zoneModules > 0,
    });
  },
});
