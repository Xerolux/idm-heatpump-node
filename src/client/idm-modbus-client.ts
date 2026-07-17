import { performance } from "node:perf_hooks";

import {
  DEFAULT_PORT,
  DEFAULT_SLAVE_ID,
  DEFAULT_TIMEOUT,
  MAX_RETRIES,
  MODEL_DETECTION_MAX_RETRIES,
  MODEL_DETECTION_TIMEOUT,
  MODEL_NAVIGATOR_20,
  MODEL_UNKNOWN,
  RETRY_BACKOFF_BASE,
} from "../constants.js";
import { decodeValue, encodeValue } from "../codec.js";
import { compareUnicodeCodePoints } from "../contracts/canonical-order.js";
import type { RegisterDef } from "../registers/definitions.js";
import { buildRegisterMap, getRegister } from "../registers/registry.js";
import {
  createNormalizedTransportFailure,
  IllegalAddressError,
  isKnownTransportFailure,
  NormalizedTransportFailure,
  NormalizedTransportFailureKind,
  redactDiagnosticMessage,
  type DiagnosticEndpoint,
  type NormalizedTransportFailureKind as NormalizedTransportFailureKindValue,
} from "../transport/errors.js";
import { createModbusSerialTransport } from "../transport/modbus-serial-adapter.js";
import {
  createModbusReadRequest,
  createModbusWriteRequest,
  MODBUS_READ_LIMITS,
  type ModbusReadRequest,
  type ModbusTransport,
  type ModbusWriteRequest,
  validateModbusWords,
} from "../transport/types.js";
import { RegisterType, type IdmModelInfo } from "../types.js";
import { IdmClientDiagnostics, ModbusErrorContext } from "./diagnostics.js";
import type {
  IdmClientDiagnostics as IdmClientDiagnosticsValue,
  ModbusErrorContext as ModbusErrorContextValue,
} from "./diagnostics.js";
import { detectModel, type DetectModelOptions } from "./detection.js";
import { FifoGate } from "./fifo-gate.js";
import { groupRegisters } from "./read-groups.js";
import {
  createWritePlan,
  WriteSafetyState,
  type InternalWriteSafetyStateSeed,
  type InternalWriteSafetyStateSnapshot,
  type SetValueOptions,
  type SimulateWriteOptions,
  type WriteRegisterOptions,
  type WriteSafetyResult,
} from "./write-safety.js";

const DEFAULT_MAX_GROUP_SIZE = 40;
const PERMANENT_FAILURE_THRESHOLD = 3;
const INTERNAL_DEPENDENCIES = Symbol("IdmModbusClient.internalDependencies");

export interface IdmModbusClientOptions {
  readonly port?: number;
  readonly slaveId?: number;
  readonly timeout?: number;
  readonly maxRetries?: number;
  readonly maxGroupSize?: number;
}

export interface ProbeRegisterOptions {
  readonly maxRetries?: number;
  readonly timeout?: number;
}

export interface InternalTransportFactoryConfiguration {
  readonly host: string;
  readonly port: number;
  readonly unitId: number;
  readonly timeout: number;
  readonly adapterRetries: 0;
}

export interface InternalClientDependencies {
  readonly transportFactory: (
    configuration: InternalTransportFactoryConfiguration,
  ) => ModbusTransport;
  readonly now: () => number;
  readonly sleep: (seconds: number) => Promise<void>;
}

export interface InternalReadStateSeed {
  readonly batchUnsafeRegisters?: readonly string[];
  readonly permanentlyFailedRegisters?: readonly string[];
  readonly transientFailures?: Readonly<Record<string, number>>;
  readonly unsupportedRegisters?: readonly string[];
}

export interface InternalClientSnapshot {
  readonly configuration: Readonly<{
    readonly adapterRetries: 0;
    readonly host: string;
    readonly maxGroupSize: number;
    readonly maxRetries: number;
    readonly modelName: string;
    readonly port: number;
    readonly slaveId: number;
    readonly timeout: number;
  }>;
  readonly transientFailures: Readonly<Record<string, number>>;
}

export interface InternalReadRegistersOptions {
  readonly address: number;
  readonly count: number;
  readonly maxRetries: number;
  readonly registerType: RegisterType;
  readonly timeout?: number;
}

export type InternalWriteStateSeed = InternalWriteSafetyStateSeed;
export type InternalWriteStateSnapshot = InternalWriteSafetyStateSnapshot;

interface InternalTestControl {
  readonly attachTransport: (transport: ModbusTransport) => void;
  readonly getActiveCyclicWrites: () => Readonly<Record<string, number>>;
  readonly getExpiredCyclicWrites: () => ReadonlySet<string>;
  readonly readRegisters: (options: InternalReadRegistersOptions) => Promise<readonly number[]>;
  readonly resetCyclicWriteState: (register?: RegisterDef | null) => void;
  readonly resetWriteThrottle: (register?: RegisterDef | null) => void;
  readonly seedReadState: (seed: InternalReadStateSeed) => void;
  readonly seedModelInfo: (modelInfo: IdmModelInfo | null) => void;
  readonly seedWriteState: (seed: InternalWriteStateSeed) => void;
  readonly setValue: (
    key: string,
    value: unknown,
    options?: SetValueOptions,
  ) => Promise<WriteSafetyResult>;
  readonly simulateWrite: (
    register: RegisterDef | string,
    value: unknown,
    options?: SimulateWriteOptions,
  ) => WriteSafetyResult;
  readonly snapshot: () => InternalClientSnapshot;
  readonly writeRegister: (
    register: RegisterDef,
    value: unknown,
    options?: WriteRegisterOptions,
  ) => Promise<void>;
  readonly writeStateSnapshot: () => InternalWriteStateSnapshot;
}

const internalTestControls = new WeakMap<IdmModbusClient, InternalTestControl>();

function requireInternalTestControl(client: IdmModbusClient): InternalTestControl {
  const control = internalTestControls.get(client);
  if (control === undefined) {
    throw new TypeError("IdmModbusClient internal test control is unavailable");
  }
  return control;
}

interface InternalIdmModbusClientOptions extends IdmModbusClientOptions {
  readonly [INTERNAL_DEPENDENCIES]?: InternalClientDependencies;
}

const allowedOptionKeys = new Set(["port", "slaveId", "timeout", "maxRetries", "maxGroupSize"]);
const reconnectFailureKinds: ReadonlySet<NormalizedTransportFailureKindValue> = new Set([
  NormalizedTransportFailureKind.TIMEOUT,
  NormalizedTransportFailureKind.DISCONNECTED,
  NormalizedTransportFailureKind.SOCKET,
  NormalizedTransportFailureKind.NO_RESPONSE,
]);

const defaultDependencies: InternalClientDependencies = Object.freeze({
  transportFactory: createModbusSerialTransport,
  now: () => performance.now() / 1_000,
  sleep: async (seconds: number): Promise<void> => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, seconds * 1_000);
    });
  },
});

function requireIntegerAtLeast(value: number, minimum: number, field: string): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new RangeError(`${field} must be an integer greater than or equal to ${String(minimum)}`);
  }
}

function requireIntegerRange(value: number, minimum: number, maximum: number, field: string): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(
      `${field} must be an integer between ${String(minimum)} and ${String(maximum)}`,
    );
  }
}

function requireClosedOptions(options: IdmModbusClientOptions): void {
  for (const key of Object.keys(options)) {
    if (!allowedOptionKeys.has(key)) {
      throw new RangeError(`Unknown IdmModbusClient option: ${key}`);
    }
  }
}

function normalizeRetryCount(value: number | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isFinite(value)) {
    throw new RangeError("maxRetries override must be finite");
  }
  // Pinned Python 0.7.6 applies max(1, int(value)) without an upper bound.
  // This is trusted local configuration, so preserving that domain takes
  // precedence over silently changing the requested retry behavior.
  return Math.max(1, Math.trunc(value));
}

function roundHalfEvenInteger(value: number): number {
  const lower = Math.floor(value);
  const fraction = value - lower;
  if (fraction < 0.5) {
    return lower;
  }
  if (fraction > 0.5) {
    return lower + 1;
  }
  return lower % 2 === 0 ? lower : lower + 1;
}

function timeoutMilliseconds(timeout: number | undefined): number | undefined {
  if (timeout === undefined) {
    return undefined;
  }
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new RangeError("timeout override must be finite and positive");
  }
  const scaled = timeout * 1_000;
  if (scaled <= MODBUS_READ_LIMITS.minimumTimeoutMs) {
    return MODBUS_READ_LIMITS.minimumTimeoutMs;
  }
  if (scaled >= MODBUS_READ_LIMITS.maximumTimeoutMs) {
    return MODBUS_READ_LIMITS.maximumTimeoutMs;
  }
  return roundHalfEvenInteger(scaled);
}

function mergeResultEntries(
  target: Map<string, unknown>,
  source: Readonly<Record<string, unknown>>,
): void {
  for (const [name, value] of Object.entries(source)) {
    target.set(name, value);
  }
}

function freezeResultEntries(
  entries: ReadonlyMap<string, unknown>,
): Readonly<Record<string, unknown>> {
  return Object.freeze(Object.fromEntries(entries));
}

export function withInternalClientDependencies(
  options: IdmModbusClientOptions | undefined,
  dependencies: InternalClientDependencies,
): IdmModbusClientOptions {
  const internalOptions: InternalIdmModbusClientOptions = { ...(options ?? {}) };
  Object.defineProperty(internalOptions, INTERNAL_DEPENDENCIES, {
    configurable: false,
    enumerable: false,
    value: Object.freeze({ ...dependencies }),
    writable: false,
  });
  return internalOptions;
}

export function attachInternalModbusTransport(
  client: IdmModbusClient,
  transport: ModbusTransport,
): void {
  requireInternalTestControl(client).attachTransport(transport);
}

export function seedInternalReadState(client: IdmModbusClient, seed: InternalReadStateSeed): void {
  requireInternalTestControl(client).seedReadState(seed);
}

export function seedInternalModelInfo(
  client: IdmModbusClient,
  modelInfo: IdmModelInfo | null,
): void {
  requireInternalTestControl(client).seedModelInfo(modelInfo);
}

export function getInternalClientSnapshot(client: IdmModbusClient): InternalClientSnapshot {
  return requireInternalTestControl(client).snapshot();
}

export async function readInternalModbusRegisters(
  client: IdmModbusClient,
  options: InternalReadRegistersOptions,
): Promise<readonly number[]> {
  return requireInternalTestControl(client).readRegisters(options);
}

export function simulateInternalWrite(
  client: IdmModbusClient,
  register: RegisterDef | string,
  value: unknown,
  options?: SimulateWriteOptions,
): WriteSafetyResult {
  return requireInternalTestControl(client).simulateWrite(register, value, options);
}

export async function writeInternalRegister(
  client: IdmModbusClient,
  register: RegisterDef,
  value: unknown,
  options?: WriteRegisterOptions,
): Promise<void> {
  await requireInternalTestControl(client).writeRegister(register, value, options);
}

export async function setInternalValue(
  client: IdmModbusClient,
  key: string,
  value: unknown,
  options?: SetValueOptions,
): Promise<WriteSafetyResult> {
  return requireInternalTestControl(client).setValue(key, value, options);
}

export function resetInternalWriteThrottle(
  client: IdmModbusClient,
  register: RegisterDef | null = null,
): void {
  requireInternalTestControl(client).resetWriteThrottle(register);
}

export function getInternalActiveCyclicWrites(
  client: IdmModbusClient,
): Readonly<Record<string, number>> {
  return requireInternalTestControl(client).getActiveCyclicWrites();
}

export function getInternalExpiredCyclicWrites(client: IdmModbusClient): ReadonlySet<string> {
  return requireInternalTestControl(client).getExpiredCyclicWrites();
}

export function resetInternalCyclicWriteState(
  client: IdmModbusClient,
  register: RegisterDef | null = null,
): void {
  requireInternalTestControl(client).resetCyclicWriteState(register);
}

export function seedInternalWriteState(
  client: IdmModbusClient,
  seed: InternalWriteStateSeed,
): void {
  requireInternalTestControl(client).seedWriteState(seed);
}

export function getInternalWriteStateSnapshot(client: IdmModbusClient): InternalWriteStateSnapshot {
  return requireInternalTestControl(client).writeStateSnapshot();
}

export class IdmModbusClient {
  readonly #gate = new FifoGate();
  readonly #host: string;
  readonly #port: number;
  readonly #slaveId: number;
  readonly #timeout: number;
  readonly #maxRetries: number;
  readonly #maxGroupSize: number;
  readonly #dependencies: InternalClientDependencies;
  readonly #endpoint: DiagnosticEndpoint;
  #transport: ModbusTransport | null = null;
  #modelInfo: IdmModelInfo | null = null;
  #registerMap: ReadonlyMap<string, RegisterDef> | null = null;
  #connectionSuspect = false;
  #lastErrorContext: ModbusErrorContextValue | null = null;
  readonly #permanentlyFailedRegisters = new Set<string>();
  readonly #unsupportedRegisters = new Set<string>();
  readonly #batchUnsafeRegisters = new Set<string>();
  readonly #registerFailures = new Map<string, number>();
  readonly #writeSafetyState = new WriteSafetyState();

  public constructor(host: string, options: IdmModbusClientOptions = {}) {
    if (typeof host !== "string" || host.length === 0) {
      throw new RangeError("Host must not be empty");
    }
    if (typeof options !== "object" || options === null || Array.isArray(options)) {
      throw new TypeError("IdmModbusClient options must be an object");
    }
    requireClosedOptions(options);

    const internalOptions = options as InternalIdmModbusClientOptions;
    const port = options.port ?? DEFAULT_PORT;
    const slaveId = options.slaveId ?? DEFAULT_SLAVE_ID;
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    const maxRetries = options.maxRetries ?? MAX_RETRIES;
    const maxGroupSize = options.maxGroupSize ?? DEFAULT_MAX_GROUP_SIZE;

    requireIntegerRange(port, 1, 65_535, "port");
    requireIntegerRange(slaveId, 1, 247, "slaveId");
    if (typeof timeout !== "number") {
      throw new TypeError("timeout must be a number");
    }
    requireIntegerAtLeast(maxRetries, 1, "maxRetries");
    requireIntegerAtLeast(maxGroupSize, 1, "maxGroupSize");

    this.#host = host;
    this.#port = port;
    this.#slaveId = slaveId;
    this.#timeout = timeout;
    this.#maxRetries = maxRetries;
    this.#maxGroupSize = maxGroupSize;
    this.#dependencies = internalOptions[INTERNAL_DEPENDENCIES] ?? defaultDependencies;
    this.#endpoint = Object.freeze({ host: this.#host, port: this.#port });
    internalTestControls.set(
      this,
      Object.freeze({
        attachTransport: (transport: ModbusTransport): void => {
          this.#transport = transport;
        },
        getActiveCyclicWrites: (): Readonly<Record<string, number>> =>
          this.#writeSafetyState.getActiveCyclicWrites(this.#dependencies.now()),
        getExpiredCyclicWrites: (): ReadonlySet<string> =>
          this.#writeSafetyState.getExpiredCyclicWrites(this.#dependencies.now()),
        readRegisters: async (
          readOptions: InternalReadRegistersOptions,
        ): Promise<readonly number[]> => {
          return this.#gate.runExclusive(async () => {
            await this.#ensureConnectedLocked();
            const timeoutMs =
              readOptions.timeout === undefined || readOptions.timeout === this.#timeout
                ? undefined
                : timeoutMilliseconds(readOptions.timeout);
            const holding = readOptions.registerType === RegisterType.HOLDING;
            const requestBase = {
              unitId: this.#slaveId,
              registerType: readOptions.registerType,
              functionCode: holding ? (3 as const) : (4 as const),
              address: readOptions.address,
              count: readOptions.count,
            };
            const request = createModbusReadRequest(
              timeoutMs === undefined ? requestBase : { ...requestBase, timeoutMs },
            );
            return this.#retryReadLocked(
              request,
              normalizeRetryCount(readOptions.maxRetries, this.#maxRetries),
            );
          });
        },
        resetCyclicWriteState: (register: RegisterDef | null = null): void => {
          this.#writeSafetyState.resetCyclicWriteState(register);
        },
        resetWriteThrottle: (register: RegisterDef | null = null): void => {
          this.#writeSafetyState.resetWriteThrottle(register);
        },
        seedReadState: (seed: InternalReadStateSeed): void => {
          for (const register of seed.batchUnsafeRegisters ?? []) {
            this.#batchUnsafeRegisters.add(register);
          }
          for (const register of seed.permanentlyFailedRegisters ?? []) {
            this.#permanentlyFailedRegisters.add(register);
          }
          for (const register of seed.unsupportedRegisters ?? []) {
            this.#unsupportedRegisters.add(register);
          }
          for (const [register, failures] of Object.entries(seed.transientFailures ?? {})) {
            requireIntegerAtLeast(failures, 1, `transient failure count for ${register}`);
            this.#registerFailures.set(register, failures);
          }
        },
        seedModelInfo: (modelInfo: IdmModelInfo | null): void => {
          this.#modelInfo = modelInfo;
          this.#registerMap = modelInfo === null ? null : buildRegisterMap({ modelInfo });
        },
        seedWriteState: (seed: InternalWriteStateSeed): void => {
          this.#writeSafetyState.seed(seed);
        },
        setValue: async (
          key: string,
          value: unknown,
          setOptions?: SetValueOptions,
        ): Promise<WriteSafetyResult> =>
          this.#gate.runExclusive(async () => {
            const plan = this.#createWritePlan(key, value, {
              dryRun: setOptions?.dryRun ?? false,
            });
            if (!plan.dryRun) {
              await this.#executeWritePlanLocked(plan);
            }
            return plan;
          }),
        simulateWrite: (
          register: RegisterDef | string,
          value: unknown,
          simulateOptions?: SimulateWriteOptions,
        ): WriteSafetyResult =>
          this.#createWritePlan(register, value, {
            dryRun: simulateOptions?.dryRun ?? true,
            allowCustomRegister: simulateOptions?.allowCustomRegister ?? false,
          }),
        snapshot: (): InternalClientSnapshot => {
          const transientFailures: Record<string, number> = {};
          for (const [register, failures] of [...this.#registerFailures].sort(([left], [right]) =>
            compareUnicodeCodePoints(left, right),
          )) {
            transientFailures[register] = failures;
          }
          return Object.freeze({
            configuration: Object.freeze({
              adapterRetries: 0,
              host: this.#host,
              maxGroupSize: this.#maxGroupSize,
              maxRetries: this.#maxRetries,
              modelName: this.modelName,
              port: this.#port,
              slaveId: this.#slaveId,
              timeout: this.#timeout,
            }),
            transientFailures: Object.freeze(transientFailures),
          });
        },
        writeRegister: async (
          register: RegisterDef,
          value: unknown,
          writeOptions?: WriteRegisterOptions,
        ): Promise<void> => {
          await this.#gate.runExclusive(async () => {
            const plan = this.#createWritePlan(register, value, {
              dryRun: false,
              allowCustomRegister: writeOptions?.allowCustomRegister ?? false,
            });
            await this.#executeWritePlanLocked(plan);
          });
        },
        writeStateSnapshot: (): InternalWriteStateSnapshot =>
          this.#writeSafetyState.snapshot(this.#dependencies.now()),
      }),
    );
  }

  public get host(): string {
    return this.#host;
  }

  public get port(): number {
    return this.#port;
  }

  public get isConnected(): boolean {
    return this.#transport?.connected ?? false;
  }

  public get modelInfo(): IdmModelInfo | null {
    return this.#modelInfo;
  }

  public get modelName(): string {
    if (this.#modelInfo === null || this.#modelInfo.modelName === MODEL_UNKNOWN) {
      return MODEL_NAVIGATOR_20;
    }
    return this.#modelInfo.modelName;
  }

  public getLastErrorContext(): ModbusErrorContextValue | null {
    return this.#lastErrorContext;
  }

  public clearLastErrorContext(): void {
    this.#lastErrorContext = null;
  }

  public decodeValue(registers: readonly number[], register: RegisterDef): unknown {
    return decodeValue(registers, register);
  }

  public encodeValue(value: unknown, register: RegisterDef): readonly number[] {
    return encodeValue(value, register);
  }

  public getDiagnostics(): IdmClientDiagnosticsValue {
    const firmware =
      this.#modelInfo?.firmwareVersion === null || this.#modelInfo?.firmwareVersion === undefined
        ? null
        : String(this.#modelInfo.firmwareVersion);
    return IdmClientDiagnostics.create({
      navigatorType: this.modelName,
      modbusConnected: this.isConnected,
      firmware,
      lastError: this.#lastErrorContext?.message ?? null,
      permanentlyFailedRegisters: [...this.#permanentlyFailedRegisters].sort(
        compareUnicodeCodePoints,
      ),
      connectionSuspect: this.#connectionSuspect,
      batchUnsafeRegisters: [...this.#batchUnsafeRegisters].sort(compareUnicodeCodePoints),
    });
  }

  public getUnsupportedRegisters(): readonly string[] {
    return Object.freeze([...this.#unsupportedRegisters].sort(compareUnicodeCodePoints));
  }

  public getBatchUnsafeRegisters(): readonly string[] {
    return Object.freeze([...this.#batchUnsafeRegisters].sort(compareUnicodeCodePoints));
  }

  public markBatchUnsafe(...registers: readonly (RegisterDef | string)[]): void {
    for (const register of registers) {
      this.#batchUnsafeRegisters.add(typeof register === "string" ? register : register.name);
    }
  }

  public resetFailedRegisters(): void {
    this.#permanentlyFailedRegisters.clear();
    this.#unsupportedRegisters.clear();
    this.#registerFailures.clear();
  }

  public async connect(): Promise<void> {
    await this.#gate.runExclusive(async () => this.#connectLocked());
  }

  public async disconnect(): Promise<void> {
    await this.#gate.runExclusive(async () => this.#disconnectLocked());
  }

  public async forceReconnect(): Promise<void> {
    await this.#gate.runExclusive(async () => {
      await this.#closeTransportLocked();
      this.#connectionSuspect = false;
      await this.#connectLocked();
    });
  }

  public async readRegister(register: RegisterDef): Promise<unknown> {
    return this.#gate.runExclusive(async () => this.#readRegisterLocked(register));
  }

  public async readValue(key: string): Promise<unknown> {
    return this.#gate.runExclusive(async () => {
      const register =
        this.#registerMap?.get(key) ?? getRegister(key, { modelInfo: this.#modelInfo });
      return this.#readRegisterLocked(register);
    });
  }

  public async readBatch(
    registers: readonly RegisterDef[],
  ): Promise<Readonly<Record<string, unknown>>> {
    return this.#gate.runExclusive(async () => this.#readBatchLocked(registers));
  }

  public async probeRegister(
    address: number,
    count = 1,
    options: ProbeRegisterOptions = {},
  ): Promise<readonly number[] | null> {
    return this.#gate.runExclusive(async () => this.#probeRegisterLocked(address, count, options));
  }

  public async detectModel(options: DetectModelOptions = {}): Promise<IdmModelInfo> {
    return this.#gate.runExclusive(async () => {
      await this.#ensureConnectedLocked();
      const info = await detectModel(
        async (address, count) =>
          this.#probeRegisterLocked(address, count, {
            maxRetries: MODEL_DETECTION_MAX_RETRIES,
            timeout: MODEL_DETECTION_TIMEOUT,
          }),
        options,
      );
      const registerMap = buildRegisterMap({ modelInfo: info });
      this.#modelInfo = info;
      this.#registerMap = registerMap;
      return info;
    });
  }

  async #connectLocked(): Promise<void> {
    if (this.#transport?.connected === true) {
      return;
    }

    const transport = this.#dependencies.transportFactory(
      Object.freeze({
        host: this.#host,
        port: this.#port,
        unitId: this.#slaveId,
        timeout: this.#timeout,
        adapterRetries: 0,
      }),
    );
    this.#transport = transport;
    try {
      await transport.connect();
    } catch (error) {
      if (this.#transport === transport) {
        this.#transport = null;
      }
      throw error;
    }
  }

  async #disconnectLocked(): Promise<void> {
    await this.#closeTransportLocked();
  }

  async #readRegisterLocked(register: RegisterDef): Promise<unknown> {
    if (register.writeOnly) {
      throw new RangeError(`Register '${register.name}' is write-only`);
    }
    if (this.#permanentlyFailedRegisters.has(register.name)) {
      throw new RangeError(
        `Register '${register.name}' is permanently failed; call resetFailedRegisters() to retry`,
      );
    }

    await this.#ensureConnectedLocked();
    const words = await this.#readWordsLocked(
      register.registerType,
      register.address,
      register.size,
    );
    return this.decodeValue(words, register);
  }

  async #readBatchLocked(
    registers: readonly RegisterDef[],
  ): Promise<Readonly<Record<string, unknown>>> {
    if (registers.length === 0) {
      return Object.freeze({});
    }

    const valid = registers.filter(
      (register) => !register.writeOnly && !this.#permanentlyFailedRegisters.has(register.name),
    );
    if (valid.length === 0) {
      return Object.freeze({});
    }

    await this.#ensureConnectedLocked();
    const candidates = valid.filter((register) => !this.#batchUnsafeRegisters.has(register.name));
    const individual = valid.filter((register) => this.#batchUnsafeRegisters.has(register.name));
    const results = new Map<string, unknown>();

    for (const group of groupRegisters(candidates, this.#maxGroupSize)) {
      mergeResultEntries(results, await this.#readGroupLocked(group));
    }
    for (const register of individual) {
      mergeResultEntries(results, await this.#readIndividualFallbackLocked([register]));
    }

    return freezeResultEntries(results);
  }

  async #readGroupLocked(
    group: readonly RegisterDef[],
  ): Promise<Readonly<Record<string, unknown>>> {
    const first = group[0];
    const last = group[group.length - 1];
    if (first === undefined || last === undefined) {
      return Object.freeze({});
    }

    const start = first.address;
    const count = last.address + last.size - start;
    let words: readonly number[];
    try {
      words = await this.#readWordsLocked(first.registerType, start, count);
    } catch (error) {
      if (this.#isGroupFallbackFailure(error)) {
        return this.#readIndividualFallbackLocked(group);
      }
      throw error;
    }

    const data = new Map<string, unknown>();
    const suspect: RegisterDef[] = [];
    for (const register of group) {
      const offset = register.address - start;
      try {
        const value = this.decodeValue(words.slice(offset, offset + register.size), register);
        if (this.#isValueSuspect(register, value)) {
          suspect.push(register);
        } else {
          data.set(register.name, value);
        }
      } catch {
        // Match Python: one undecodable data point does not discard the rest.
      }
    }

    if (suspect.length > 0) {
      for (const register of suspect) {
        this.#batchUnsafeRegisters.add(register.name);
      }
      mergeResultEntries(data, await this.#readIndividualFallbackLocked(suspect));
    }
    return freezeResultEntries(data);
  }

  async #readIndividualFallbackLocked(
    registers: readonly RegisterDef[],
  ): Promise<Readonly<Record<string, unknown>>> {
    const data = new Map<string, unknown>();
    for (const register of registers) {
      let words: readonly number[];
      try {
        words = await this.#readWordsLocked(register.registerType, register.address, register.size);
      } catch (error) {
        if (error instanceof IllegalAddressError) {
          this.#permanentlyFailedRegisters.add(register.name);
          this.#unsupportedRegisters.add(register.name);
          continue;
        }
        if (error instanceof NormalizedTransportFailure) {
          if (
            error.kind !== NormalizedTransportFailureKind.MODBUS &&
            error.kind !== NormalizedTransportFailureKind.INVALID_RESPONSE
          ) {
            throw error;
          }
          const failures = (this.#registerFailures.get(register.name) ?? 0) + 1;
          this.#registerFailures.set(register.name, failures);
          if (failures >= PERMANENT_FAILURE_THRESHOLD) {
            this.#permanentlyFailedRegisters.add(register.name);
          }
          continue;
        }
        throw error;
      }

      try {
        const value = this.decodeValue(words, register);
        if (this.#isValueSuspect(register, value)) {
          continue;
        }
        data.set(register.name, value);
        this.#registerFailures.delete(register.name);
      } catch {
        // Match Python: decode failures are omitted without failure counters.
      }
    }
    return freezeResultEntries(data);
  }

  #isGroupFallbackFailure(error: unknown): boolean {
    return (
      error instanceof IllegalAddressError ||
      (error instanceof NormalizedTransportFailure &&
        (error.kind === NormalizedTransportFailureKind.MODBUS ||
          error.kind === NormalizedTransportFailureKind.INVALID_RESPONSE))
    );
  }

  #isValueSuspect(register: RegisterDef, value: unknown): boolean {
    if (value === null || typeof value === "boolean") {
      return false;
    }
    if (register.sentinelValues.includes(value as number | string)) {
      return false;
    }
    if (register.enumOptions !== null) {
      return typeof value !== "number" || !Object.hasOwn(register.enumOptions, value);
    }
    if (typeof value === "number") {
      if (register.minVal !== null && value < register.minVal) {
        return true;
      }
      if (register.maxVal !== null && value > register.maxVal) {
        return true;
      }
    }
    return false;
  }

  async #ensureConnectedLocked(): Promise<ModbusTransport> {
    if (this.#transport?.connected === true && !this.#connectionSuspect) {
      return this.#transport;
    }
    if (this.#connectionSuspect) {
      await this.#closeTransportLocked();
      this.#connectionSuspect = false;
    }
    await this.#connectLocked();
    return this.#requireTransportLocked();
  }

  #requireTransportLocked(): ModbusTransport {
    if (this.#transport === null || !this.#transport.connected) {
      throw createNormalizedTransportFailure(
        NormalizedTransportFailureKind.DISCONNECTED,
        `Not connected to ${this.#host}:${String(this.#port)}`,
        this.#endpoint,
      );
    }
    return this.#transport;
  }

  async #closeTransportLocked(): Promise<void> {
    const transport = this.#transport;
    if (transport === null) {
      return;
    }
    await transport.close();
    if (this.#transport === transport) {
      this.#transport = null;
    }
  }

  async #probeRegisterLocked(
    address: number,
    count: number,
    options: ProbeRegisterOptions,
  ): Promise<readonly number[] | null> {
    const retries = normalizeRetryCount(options.maxRetries, this.#maxRetries);
    const timeoutMs = timeoutMilliseconds(options.timeout);
    const requestBase = {
      unitId: this.#slaveId,
      registerType: RegisterType.INPUT,
      functionCode: 4,
      address,
      count,
    } as const;
    const request = createModbusReadRequest(
      timeoutMs === undefined ? requestBase : { ...requestBase, timeoutMs },
    );

    try {
      await this.#ensureConnectedLocked();
      return await this.#retryReadLocked(request, retries);
    } catch (error) {
      if (isKnownTransportFailure(error)) {
        return null;
      }
      throw error;
    }
  }

  async #readWordsLocked(
    registerType: RegisterType,
    address: number,
    count: number,
  ): Promise<readonly number[]> {
    const holding = registerType === RegisterType.HOLDING;
    const request = createModbusReadRequest({
      unitId: this.#slaveId,
      registerType,
      functionCode: holding ? 3 : 4,
      address,
      count,
    });
    return this.#retryReadLocked(request, this.#maxRetries);
  }

  async #retryReadLocked(request: ModbusReadRequest, retries: number): Promise<readonly number[]> {
    for (let attemptIndex = 0; attemptIndex < retries; attemptIndex += 1) {
      try {
        const words = await this.#requireTransportLocked().read(request);
        let validated: readonly number[];
        try {
          validated = validateModbusWords(words, request.count);
        } catch {
          throw createNormalizedTransportFailure(
            NormalizedTransportFailureKind.INVALID_RESPONSE,
            `Modbus Error: Incomplete Modbus response at address ${String(request.address)}: got ${String(words.length)} registers, expected ${String(request.count)}`,
          );
        }
        this.#connectionSuspect = false;
        return validated;
      } catch (error) {
        const attempt = attemptIndex + 1;
        if (error instanceof IllegalAddressError) {
          this.#recordErrorContext(request, error, attempt);
          throw error;
        }
        if (!(error instanceof NormalizedTransportFailure)) {
          throw error;
        }

        this.#recordErrorContext(request, error, attempt);
        const reconnect = reconnectFailureKinds.has(error.kind);
        if (reconnect) {
          this.#connectionSuspect = true;
        }
        if (attempt === retries) {
          throw error;
        }
        if (reconnect) {
          await this.#tryReconnectLocked();
        }
        await this.#dependencies.sleep(RETRY_BACKOFF_BASE * 2 ** attemptIndex);
      }
    }
    throw new Error("Unreachable retry state");
  }

  #createWritePlan(
    register: RegisterDef | string,
    value: unknown,
    options: SimulateWriteOptions,
  ): WriteSafetyResult {
    return createWritePlan({
      register,
      value,
      dryRun: options.dryRun ?? true,
      allowCustomRegister: options.allowCustomRegister ?? false,
      modelInfo: this.#modelInfo,
      ...(this.#registerMap === null ? {} : { modelRegisterMap: this.#registerMap }),
      writeSafetyState: this.#writeSafetyState,
      now: this.#dependencies.now(),
    });
  }

  async #executeWritePlanLocked(plan: WriteSafetyResult): Promise<void> {
    await this.#ensureConnectedLocked();
    const request = createModbusWriteRequest({
      unitId: this.#slaveId,
      registerType: RegisterType.HOLDING,
      functionCode: 16,
      address: plan.register.address,
      count: plan.encodedRegisters.length,
      words: plan.encodedRegisters,
    });
    await this.#retryWriteLocked(request, this.#maxRetries);
    this.#writeSafetyState.recordSuccessfulWrite(plan.register, this.#dependencies.now());
  }

  async #retryWriteLocked(request: ModbusWriteRequest, retries: number): Promise<void> {
    for (let attemptIndex = 0; attemptIndex < retries; attemptIndex += 1) {
      try {
        await this.#requireTransportLocked().write(request);
        this.#connectionSuspect = false;
        return;
      } catch (error) {
        const attempt = attemptIndex + 1;
        if (error instanceof IllegalAddressError) {
          this.#recordWriteErrorContext(request, error, attempt);
          throw error;
        }
        if (!(error instanceof NormalizedTransportFailure)) {
          throw error;
        }

        this.#recordWriteErrorContext(request, error, attempt);
        const reconnect = reconnectFailureKinds.has(error.kind);
        if (reconnect) {
          this.#connectionSuspect = true;
        }
        if (attempt === retries) {
          throw error;
        }
        if (reconnect) {
          await this.#tryReconnectLocked();
        }
        await this.#dependencies.sleep(RETRY_BACKOFF_BASE * 2 ** attemptIndex);
      }
    }
    throw new Error("Unreachable retry state");
  }

  async #tryReconnectLocked(): Promise<void> {
    await this.#closeTransportLocked();
    try {
      await this.#connectLocked();
    } catch (error) {
      if (error instanceof NormalizedTransportFailure && reconnectFailureKinds.has(error.kind)) {
        return;
      }
      throw error;
    }
  }

  #recordErrorContext(
    request: ModbusReadRequest,
    error: IllegalAddressError | NormalizedTransportFailure,
    attempt: number,
  ): void {
    this.#lastErrorContext = ModbusErrorContext.create({
      operation: "read",
      address: request.address,
      count: request.count,
      registerType: request.registerType,
      errorType:
        error instanceof IllegalAddressError
          ? NormalizedTransportFailureKind.ILLEGAL_ADDRESS
          : error.kind,
      message: redactDiagnosticMessage(error.message, this.#endpoint),
      attempt,
    });
  }

  #recordWriteErrorContext(
    request: ModbusWriteRequest,
    error: IllegalAddressError | NormalizedTransportFailure,
    attempt: number,
  ): void {
    this.#lastErrorContext = ModbusErrorContext.create({
      operation: "write",
      address: request.address,
      count: request.count,
      registerType: RegisterType.HOLDING,
      errorType:
        error instanceof IllegalAddressError
          ? NormalizedTransportFailureKind.ILLEGAL_ADDRESS
          : error.kind,
      message: redactDiagnosticMessage(error.message, this.#endpoint),
      attempt,
    });
  }
}
