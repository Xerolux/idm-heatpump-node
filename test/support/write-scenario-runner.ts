import {
  attachInternalModbusTransport,
  createInternalIdmModbusClient,
  getInternalWriteStateSnapshot,
  getInternalActiveCyclicWrites,
  getInternalExpiredCyclicWrites,
  resetInternalCyclicWriteState,
  resetInternalWriteThrottle,
  seedInternalModelInfo,
  setInternalValue,
  simulateInternalWrite,
  writeInternalRegister,
} from "../../src/client/internal-create.js";
import type { WriteSafetyResult } from "../../src/client/write-safety.js";
import type {
  WriteBehaviorFixture,
  WriteBehaviorScenario,
  WriteScenarioAction,
  WriteScenarioRegister,
} from "../../src/contracts/write-scenario.js";
import {
  createRegisterDef,
  type RegisterDef,
  type RegisterDefInput,
} from "../../src/registers/definitions.js";
import { getRegister } from "../../src/registers/registry.js";
import {
  IllegalAddressError,
  NormalizedTransportFailure,
  NormalizedTransportFailureKind,
} from "../../src/transport/errors.js";
import {
  createModbusSerialTransport,
  type ModbusSerialClientBoundary,
} from "../../src/transport/modbus-serial-adapter.js";
import { createModbusWriteRequest } from "../../src/transport/types.js";
import { IdmModelInfo, type IdmModelInfo as IdmModelInfoValue } from "../../src/types.js";
import { SemanticValidationError } from "../../src/errors.js";
import { FakeClock } from "./fake-clock.js";
import {
  FakeModbusTransport,
  type FakeModbusWriteResponse,
  type FakeModbusTransportEvent,
} from "./fake-modbus-transport.js";

type ContractRecord = Readonly<Record<string, unknown>>;

export interface WriteBehaviorScenarioExecution {
  readonly name: string;
  readonly result: Readonly<{ readonly steps: readonly ContractRecord[] }>;
  readonly requests: readonly FakeModbusTransportEvent[];
  readonly clock: readonly number[];
  readonly state: ContractRecord;
}

function requireRecord(value: unknown, subject: string): ContractRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${subject} must be an object`);
  }
  return value as ContractRecord;
}

function requireNumber(record: ContractRecord, field: string, subject: string): number {
  const value = record[field];
  if (typeof value !== "number") throw new TypeError(`${subject}.${field} must be numeric`);
  return value;
}

function requireString(record: ContractRecord, field: string, subject: string): string {
  const value = record[field];
  if (typeof value !== "string") throw new TypeError(`${subject}.${field} must be text`);
  return value;
}

function createScenarioRegister(value: WriteScenarioRegister): RegisterDef | string {
  if (typeof value === "string") return value;
  const raw = value as ContractRecord;
  const excluded = raw.excludeFromWrite;
  const input = {
    ...raw,
    ...(Array.isArray(excluded)
      ? { excludeFromWrite: new Set(excluded as readonly number[]) }
      : {}),
  } as unknown as RegisterDefInput;
  return createRegisterDef(input);
}

function createDetectedModel(value: unknown): IdmModelInfoValue | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new TypeError("configuration.detectedModel is invalid");
  return IdmModelInfo.create({
    modelName: value,
    activeHeatingCircuits: ["A"],
    zoneModules: 0,
    hasSolar: false,
    hasIsc: false,
    hasPv: false,
    hasCascade: false,
  });
}

function writeScriptMessage(errorType: string, message: string): string {
  if (errorType === NormalizedTransportFailureKind.DISCONNECTED) {
    return `Modbus Error: [Connection] ${message}`;
  }
  if (errorType === NormalizedTransportFailureKind.NO_RESPONSE) {
    return `Modbus Error: [Input/Output] ${message}`;
  }
  if (errorType === NormalizedTransportFailureKind.MODBUS) {
    const codeTwo = /^Illegal Data Address writing address (\d+): (.*)$/u.exec(message);
    if (codeTwo !== null) {
      return `Modbus Error: Modbus error writing address ${codeTwo[1]}: ${codeTwo[2]}`;
    }
    return `Modbus Error: ${message}`;
  }
  return message;
}

function writeScriptError(response: ContractRecord): Error {
  const errorType = requireString(response, "errorType", "transport response");
  const message = writeScriptMessage(
    errorType,
    requireString(response, "message", "transport response"),
  );
  if (errorType === NormalizedTransportFailureKind.ILLEGAL_ADDRESS) {
    return new IllegalAddressError(message);
  }
  if (
    errorType !== NormalizedTransportFailureKind.TIMEOUT &&
    errorType !== NormalizedTransportFailureKind.DISCONNECTED &&
    errorType !== NormalizedTransportFailureKind.SOCKET &&
    errorType !== NormalizedTransportFailureKind.NO_RESPONSE &&
    errorType !== NormalizedTransportFailureKind.MODBUS &&
    errorType !== NormalizedTransportFailureKind.INVALID_RESPONSE
  ) {
    throw new TypeError(`Unknown write transport error: ${errorType}`);
  }
  return new NormalizedTransportFailure(errorType, message);
}

function writeResponses(scenario: WriteBehaviorScenario): readonly FakeModbusWriteResponse[] {
  return scenario.transport_responses.map((raw) => {
    const response = raw as ContractRecord;
    return response.kind === "ack"
      ? Object.freeze({ kind: "write_ok" as const })
      : Object.freeze({ kind: "error" as const, error: writeScriptError(response) });
  });
}

class ScenarioModbusSerialClient implements ModbusSerialClientBoundary {
  readonly #transport: FakeModbusTransport;
  readonly #responses: ContractRecord[];
  #unitId = 1;

  public constructor(scenario: WriteBehaviorScenario) {
    this.#transport = new FakeModbusTransport([], {
      initiallyConnected: true,
      writeResponses: writeResponses(scenario),
    });
    this.#responses = [...scenario.transport_responses] as ContractRecord[];
  }

  public get isOpen(): boolean {
    return this.#transport.connected;
  }

  public get events(): readonly FakeModbusTransportEvent[] {
    return this.#transport.events;
  }

  public get maxActiveRequests(): number {
    return this.#transport.maxActiveRequests;
  }

  public setID(unitId: number): void {
    this.#unitId = unitId;
  }

  public setTimeout(timeoutMs: number): void {
    void timeoutMs;
  }

  public async connectTCP(
    host: string,
    options: Readonly<{ readonly port: number }>,
  ): Promise<void> {
    void host;
    void options;
    await this.#transport.connect();
  }

  public async readHoldingRegisters(address: number, count: number): Promise<unknown> {
    void address;
    void count;
    throw new TypeError("Write scenario runner cannot issue holding-register reads");
  }

  public async readInputRegisters(address: number, count: number): Promise<unknown> {
    void address;
    void count;
    throw new TypeError("Write scenario runner cannot issue input-register reads");
  }

  public async writeRegisters(address: number, values: number[]): Promise<unknown> {
    const response = this.#responses.shift();
    if (response === undefined) throw new TypeError("Write acknowledgement script is exhausted");
    await this.#transport.write(
      createModbusWriteRequest({
        unitId: this.#unitId,
        registerType: "holding",
        functionCode: 16,
        address,
        count: values.length,
        words: values,
      }),
    );
    if (response.kind !== "ack") {
      throw new TypeError("Scripted write error unexpectedly resolved");
    }
    return Object.freeze({
      address: requireNumber(response, "address", "write acknowledgement"),
      length: requireNumber(response, "count", "write acknowledgement"),
    });
  }

  public close(callback: (status?: unknown) => void): void {
    void this.#transport.close().then(() => callback(), callback);
  }

  public destroy(callback: (status?: unknown) => void): void {
    void this.#transport.destroy().then(() => callback(), callback);
  }

  public assertResponsesConsumed(): void {
    this.#transport.assertResponsesConsumed();
    if (this.#responses.length !== 0) {
      throw new TypeError(`${String(this.#responses.length)} acknowledgements remain unconsumed`);
    }
  }
}

function projectWriteResult(result: WriteSafetyResult): ContractRecord {
  return Object.freeze({
    dryRun: result.dryRun,
    encodedRegisters: result.encodedRegisters,
    register: Object.freeze({ address: result.register.address, name: result.register.name }),
    requestedValue: result.requestedValue,
  });
}

function projectError(error: unknown): ContractRecord {
  if (
    error instanceof SemanticValidationError ||
    (typeof error === "object" &&
      error !== null &&
      (error as ContractRecord).category === "validation" &&
      typeof (error as ContractRecord).code === "string" &&
      typeof (error as ContractRecord).diagnostic === "string")
  ) {
    const validation = error as SemanticValidationError;
    return Object.freeze({
      category: "validation",
      code: validation.code,
      diagnostic: validation.diagnostic,
      kind: "error",
    });
  }
  if (error instanceof IllegalAddressError) {
    return Object.freeze({
      category: "transport",
      errorType: NormalizedTransportFailureKind.ILLEGAL_ADDRESS,
      kind: "error",
      message: error.message,
    });
  }
  if (error instanceof NormalizedTransportFailure) {
    return Object.freeze({
      category: "transport",
      errorType: error.kind,
      kind: "error",
      message: error.message,
    });
  }
  throw error;
}

function resolveRegister(
  operand: WriteScenarioRegister,
  modelInfo: IdmModelInfoValue | null,
): RegisterDef {
  const register = createScenarioRegister(operand);
  return typeof register === "string" ? getRegister(register, { modelInfo }) : register;
}

function projectState(
  client: ReturnType<typeof createInternalIdmModbusClient>,
  boundary: ScenarioModbusSerialClient,
): ContractRecord {
  const writeState = getInternalWriteStateSnapshot(client);
  return Object.freeze({
    activeCyclicWrites: writeState.activeCyclicWrites,
    connected: client.isConnected,
    connectionSuspect: client.getDiagnostics().connectionSuspect,
    cyclicWrites: writeState.cyclicWrites,
    expiredCyclicWrites: Object.freeze([...writeState.expiredCyclicWrites]),
    lastError: client.getLastErrorContext(),
    maxActiveRequests: boundary.maxActiveRequests,
    unsupportedRegisters: client.getUnsupportedRegisters(),
    writeThrottle: writeState.writeThrottle,
  });
}

async function executeAction(
  action: WriteScenarioAction,
  client: ReturnType<typeof createInternalIdmModbusClient>,
  clock: FakeClock,
  modelInfo: IdmModelInfoValue | null,
): Promise<unknown> {
  switch (action.kind) {
    case "simulate_write":
      return projectWriteResult(
        simulateInternalWrite(client, createScenarioRegister(action.register), action.value, {
          dryRun: action.dryRun,
          allowCustomRegister: action.allowCustomRegister,
        }),
      );
    case "write_register":
      await writeInternalRegister(
        client,
        resolveRegister(action.register, modelInfo),
        action.value,
        {
          allowCustomRegister: action.allowCustomRegister,
        },
      );
      return null;
    case "set_value":
      return projectWriteResult(
        await setInternalValue(client, action.key, action.value, { dryRun: action.dryRun }),
      );
    case "advance_time":
      clock.advance(action.seconds);
      return null;
    case "reset_write_throttle":
      resetInternalWriteThrottle(
        client,
        action.register === undefined ? null : resolveRegister(action.register, modelInfo),
      );
      return null;
    case "get_active_cyclic_writes":
      return getInternalActiveCyclicWrites(client);
    case "get_expired_cyclic_writes":
      return Object.freeze([...getInternalExpiredCyclicWrites(client)]);
    case "reset_cyclic_write_state":
      resetInternalCyclicWriteState(
        client,
        action.register === undefined ? null : resolveRegister(action.register, modelInfo),
      );
      return null;
    default: {
      const exhaustive: never = action;
      throw new TypeError(`Unknown write action: ${String(exhaustive)}`);
    }
  }
}

export async function executeWriteBehaviorScenario(
  scenario: WriteBehaviorScenario,
): Promise<WriteBehaviorScenarioExecution> {
  const configuration = scenario.configuration as ContractRecord;
  const host = requireString(configuration, "host", "configuration");
  if (host !== "example.invalid") throw new TypeError("Write runner requires example.invalid");
  const clock = new FakeClock();
  const boundary = new ScenarioModbusSerialClient(scenario);
  const transportFactory = (
    runtimeConfiguration: Parameters<typeof createModbusSerialTransport>[0],
  ) => createModbusSerialTransport(runtimeConfiguration, () => boundary);
  const client = createInternalIdmModbusClient(
    host,
    {
      port: requireNumber(configuration, "port", "configuration"),
      slaveId: requireNumber(configuration, "slaveId", "configuration"),
      timeout: requireNumber(configuration, "timeout", "configuration"),
      maxRetries: requireNumber(configuration, "maxRetries", "configuration"),
      maxGroupSize: requireNumber(configuration, "maxGroupSize", "configuration"),
    },
    {
      transportFactory,
      now: () => clock.now(),
      sleep: (seconds) => clock.sleep(seconds),
    },
  );
  attachInternalModbusTransport(
    client,
    transportFactory({
      host,
      port: requireNumber(configuration, "port", "configuration"),
      unitId: requireNumber(configuration, "slaveId", "configuration"),
      timeout: requireNumber(configuration, "timeout", "configuration"),
      adapterRetries: 0,
    }),
  );
  const modelInfo = createDetectedModel(configuration.detectedModel);
  seedInternalModelInfo(client, modelInfo);

  const definitions = configuration.registerDefinitions;
  if (!Array.isArray(definitions)) throw new TypeError("registerDefinitions must be an array");
  for (const definition of definitions) {
    createScenarioRegister(requireRecord(definition, "register") as WriteScenarioRegister);
  }

  const steps: ContractRecord[] = [];
  for (const action of scenario.operation.actions) {
    let result: ContractRecord;
    try {
      result = Object.freeze({
        kind: "value",
        value: await executeAction(action, client, clock, modelInfo),
      });
    } catch (error) {
      result = projectError(error);
    }
    steps.push(Object.freeze({ result, state: projectState(client, boundary) }));
  }

  boundary.assertResponsesConsumed();
  return Object.freeze({
    name: scenario.name,
    result: Object.freeze({ steps: Object.freeze(steps) }),
    requests: boundary.events,
    clock: clock.observations,
    state: projectState(client, boundary),
  });
}

export async function executeWriteBehaviorFixture(
  fixture: WriteBehaviorFixture,
): Promise<readonly WriteBehaviorScenarioExecution[]> {
  const executions: WriteBehaviorScenarioExecution[] = [];
  const executed = new Set<string>();
  for (const scenario of fixture.scenarios) {
    if (executed.has(scenario.name)) throw new TypeError(`Duplicate scenario: ${scenario.name}`);
    executed.add(scenario.name);
    executions.push(await executeWriteBehaviorScenario(scenario));
  }
  if (executed.size !== fixture.scenarios.length) {
    throw new TypeError("Write scenario execution inventory is incomplete");
  }
  return Object.freeze(executions);
}
