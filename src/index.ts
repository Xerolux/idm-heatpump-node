export { IdmClientDiagnostics, ModbusErrorContext } from "./client/index.js";
export { IdmModbusClient } from "./client/index.js";
export { IllegalAddressError } from "./transport/errors.js";
export { quietPymodbusLogging } from "./transport/logging.js";
export type { ModbusTransport } from "./transport/types.js";
export {
  ACTIVE_HC_MODE_OPTIONS,
  BIVALENCE_STATE_OPTIONS,
  BOOSTER_FAULT_OPTIONS,
  CIRCUIT_MODE_OPTIONS,
  DEFAULT_PORT,
  DEFAULT_SLAVE_ID,
  DEFAULT_TIMEOUT,
  EEPROM_SENSITIVE_ADDRESSES,
  EVU_LOCK_OPTIONS,
  FEATURE_CASCADE,
  FEATURE_HEATING_CIRCUITS,
  FEATURE_ISC,
  FEATURE_PV,
  FEATURE_SOLAR,
  FEATURE_ZONE_MODULES,
  HEATING_CIRCUIT_LETTERS,
  HP_OPERATING_MODE_OPTIONS,
  ISC_MODE_OPTIONS,
  MAX_HEATING_CIRCUITS,
  MAX_RETRIES,
  MAX_ROOMS_PER_ZONE,
  MAX_ZONE_MODULES,
  MODEL_DETECTION_MAX_RETRIES,
  MODEL_DETECTION_TIMEOUT,
  MODEL_NAVIGATOR_10,
  MODEL_NAVIGATOR_20,
  MODEL_NAVIGATOR_PRO,
  MODEL_UNKNOWN,
  RETRY_BACKOFF_BASE,
  ROOM_MODE_OPTIONS,
  SMART_GRID_OPTIONS,
  SOLAR_MODE_OPTIONS,
  SYSTEM_MODE_OPTIONS,
  VARIABLE_INPUT_OPTIONS,
  ZONE_MODULE_MODE_OPTIONS,
} from "./constants.js";
export { ModbusCodec } from "./codec.js";
export { AdaptiveBackoff, PollRateLimiter } from "./timing.js";
export { DataType, FeatureFlags, IdmModelInfo, RegisterType, WriteClass } from "./types.js";
export { RegisterDef } from "./registers/definitions.js";
export type { RegisterDefInput } from "./registers/definitions.js";
export {
  buildRegisterMap,
  CORE_REGISTERS,
  getAllRegisters,
  getDetectionRegisters,
  getHeatingCircuitRegisters,
  getRegister,
  getRegisterRegistry,
  getZoneModuleRegisters,
  RegisterRegistry,
} from "./registers/index.js";
