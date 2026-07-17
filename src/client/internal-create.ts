import {
  attachInternalModbusTransport,
  getInternalActiveCyclicWrites,
  getInternalClientSnapshot,
  getInternalExpiredCyclicWrites,
  getInternalWriteStateSnapshot,
  IdmModbusClient,
  readInternalModbusRegisters,
  resetInternalCyclicWriteState,
  resetInternalWriteThrottle,
  seedInternalModelInfo,
  seedInternalReadState,
  seedInternalWriteState,
  setInternalValue,
  simulateInternalWrite,
  writeInternalRegister,
  type IdmModbusClientOptions,
  type InternalClientDependencies,
  type InternalClientSnapshot,
  type InternalReadRegistersOptions,
  type InternalReadStateSeed,
  type InternalTransportFactoryConfiguration,
  type InternalWriteStateSeed,
  type InternalWriteStateSnapshot,
  withInternalClientDependencies,
} from "./idm-modbus-client.js";

export {
  attachInternalModbusTransport,
  getInternalActiveCyclicWrites,
  getInternalClientSnapshot,
  getInternalExpiredCyclicWrites,
  getInternalWriteStateSnapshot,
  readInternalModbusRegisters,
  resetInternalCyclicWriteState,
  resetInternalWriteThrottle,
  seedInternalModelInfo,
  seedInternalReadState,
  seedInternalWriteState,
  setInternalValue,
  simulateInternalWrite,
  writeInternalRegister,
};
export type {
  InternalClientDependencies,
  InternalClientSnapshot,
  InternalReadRegistersOptions,
  InternalReadStateSeed,
  InternalTransportFactoryConfiguration,
  InternalWriteStateSeed,
  InternalWriteStateSnapshot,
};

export function createInternalIdmModbusClient(
  host: string,
  options: IdmModbusClientOptions | undefined,
  dependencies: InternalClientDependencies,
): IdmModbusClient {
  return new IdmModbusClient(host, withInternalClientDependencies(options, dependencies));
}
