import {
  IdmModbusClient,
  type IdmModbusClientOptions,
  type InternalClientDependencies,
  type InternalTransportFactoryConfiguration,
  withInternalClientDependencies,
} from "./idm-modbus-client.js";

export type { InternalClientDependencies, InternalTransportFactoryConfiguration };

export function createInternalIdmModbusClient(
  host: string,
  options: IdmModbusClientOptions | undefined,
  dependencies: InternalClientDependencies,
): IdmModbusClient {
  return new IdmModbusClient(host, withInternalClientDependencies(options, dependencies));
}
