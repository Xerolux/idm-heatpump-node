import {
  attachInternalModbusTransport,
  getInternalClientSnapshot,
  IdmModbusClient,
  readInternalModbusRegisters,
  seedInternalReadState,
  type IdmModbusClientOptions,
  type InternalClientDependencies,
  type InternalClientSnapshot,
  type InternalReadRegistersOptions,
  type InternalReadStateSeed,
  type InternalTransportFactoryConfiguration,
  withInternalClientDependencies,
} from "./idm-modbus-client.js";

export {
  attachInternalModbusTransport,
  getInternalClientSnapshot,
  readInternalModbusRegisters,
  seedInternalReadState,
};
export type {
  InternalClientDependencies,
  InternalClientSnapshot,
  InternalReadRegistersOptions,
  InternalReadStateSeed,
  InternalTransportFactoryConfiguration,
};

export function createInternalIdmModbusClient(
  host: string,
  options: IdmModbusClientOptions | undefined,
  dependencies: InternalClientDependencies,
): IdmModbusClient {
  return new IdmModbusClient(host, withInternalClientDependencies(options, dependencies));
}
