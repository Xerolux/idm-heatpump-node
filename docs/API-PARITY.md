<!-- GENERATED FILE — DO NOT EDIT. Run `node scripts/generate-api-parity.mjs` to regenerate. -->

# Public API parity

This matrix is generated from `contracts/api-mapping.json` and the pinned Python-only public inventories.
It documents development intent; only `complete` rows with passing evidence may be exported or released.

## Pinned baseline

- Repository: `https://github.com/Xerolux/idm-heatpump-api`
- Python package: `idm-heatpump-api`
- Python version/tag: `0.7.6` / `v0.7.6`
- Full commit: `ad121ebf34a5f5e37204371c026927d77efcd15c`
- Parity schema: `1`
- Development status: `planned`

**89 public symbols: 59 root, 30 web.**

## Symbol matrix

| Python symbol | TypeScript counterpart | Export path | Owner | Status | Representation | Normalizations | Contract evidence |
| --- | --- | --- | ---: | --- | --- | --- | --- |
| `ACTIVE_HC_MODE_OPTIONS` | `ACTIVE_HC_MODE_OPTIONS` | `.` | 1 | `planned` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `BIVALENCE_STATE_OPTIONS` | `BIVALENCE_STATE_OPTIONS` | `.` | 1 | `planned` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `BOOSTER_FAULT_OPTIONS` | `BOOSTER_FAULT_OPTIONS` | `.` | 1 | `planned` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `CIRCUIT_MODE_OPTIONS` | `CIRCUIT_MODE_OPTIONS` | `.` | 1 | `planned` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `CORE_REGISTERS` | `CORE_REGISTERS` | `.` | 1 | `planned` | `readonly_map` | `mapping_to_readonly_map_or_record` | `registers`: `test/registers/builders.test.ts` |
| `DEFAULT_PORT` | `DEFAULT_PORT` | `.` | 1 | `planned` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `DEFAULT_SLAVE_ID` | `DEFAULT_SLAVE_ID` | `.` | 1 | `planned` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `DEFAULT_TIMEOUT` | `DEFAULT_TIMEOUT` | `.` | 1 | `planned` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `EEPROM_SENSITIVE_ADDRESSES` | `EEPROM_SENSITIVE_ADDRESSES` | `.` | 1 | `planned` | `frozen_constant` | `set_to_immutable_set_like` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `EVU_LOCK_OPTIONS` | `EVU_LOCK_OPTIONS` | `.` | 1 | `planned` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `FEATURE_CASCADE` | `FEATURE_CASCADE` | `.` | 1 | `planned` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `FEATURE_HEATING_CIRCUITS` | `FEATURE_HEATING_CIRCUITS` | `.` | 1 | `planned` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `FEATURE_ISC` | `FEATURE_ISC` | `.` | 1 | `planned` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `FEATURE_PV` | `FEATURE_PV` | `.` | 1 | `planned` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `FEATURE_SOLAR` | `FEATURE_SOLAR` | `.` | 1 | `planned` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `FEATURE_ZONE_MODULES` | `FEATURE_ZONE_MODULES` | `.` | 1 | `planned` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `HEATING_CIRCUIT_LETTERS` | `HEATING_CIRCUIT_LETTERS` | `.` | 1 | `planned` | `frozen_constant` | `tuple_to_readonly_array` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `HP_OPERATING_MODE_OPTIONS` | `HP_OPERATING_MODE_OPTIONS` | `.` | 1 | `planned` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `ISC_MODE_OPTIONS` | `ISC_MODE_OPTIONS` | `.` | 1 | `planned` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `MAX_HEATING_CIRCUITS` | `MAX_HEATING_CIRCUITS` | `.` | 1 | `planned` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `MAX_ROOMS_PER_ZONE` | `MAX_ROOMS_PER_ZONE` | `.` | 1 | `planned` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `MAX_RETRIES` | `MAX_RETRIES` | `.` | 1 | `planned` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `MAX_ZONE_MODULES` | `MAX_ZONE_MODULES` | `.` | 1 | `planned` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `MODEL_DETECTION_MAX_RETRIES` | `MODEL_DETECTION_MAX_RETRIES` | `.` | 1 | `planned` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `MODEL_DETECTION_TIMEOUT` | `MODEL_DETECTION_TIMEOUT` | `.` | 1 | `planned` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `MODEL_NAVIGATOR_10` | `MODEL_NAVIGATOR_10` | `.` | 1 | `planned` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `MODEL_NAVIGATOR_20` | `MODEL_NAVIGATOR_20` | `.` | 1 | `planned` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `MODEL_NAVIGATOR_PRO` | `MODEL_NAVIGATOR_PRO` | `.` | 1 | `planned` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `MODEL_UNKNOWN` | `MODEL_UNKNOWN` | `.` | 1 | `planned` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `RETRY_BACKOFF_BASE` | `RETRY_BACKOFF_BASE` | `.` | 1 | `planned` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `ROOM_MODE_OPTIONS` | `ROOM_MODE_OPTIONS` | `.` | 1 | `planned` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `SMART_GRID_OPTIONS` | `SMART_GRID_OPTIONS` | `.` | 1 | `planned` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `SOLAR_MODE_OPTIONS` | `SOLAR_MODE_OPTIONS` | `.` | 1 | `planned` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `SYSTEM_MODE_OPTIONS` | `SYSTEM_MODE_OPTIONS` | `.` | 1 | `planned` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `VARIABLE_INPUT_OPTIONS` | `VARIABLE_INPUT_OPTIONS` | `.` | 1 | `planned` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `ZONE_MODULE_MODE_OPTIONS` | `ZONE_MODULE_MODE_OPTIONS` | `.` | 1 | `planned` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `AuthenticationError` | `AuthenticationError` | `./web` | 4 | `planned` | `alias` | `python_alias_to_typescript_alias`, `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `ConnectionError` | `ConnectionError` | `./web` | 4 | `planned` | `alias` | `python_alias_to_typescript_alias`, `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `CsrfError` | `CsrfError` | `./web` | 4 | `planned` | `alias` | `python_alias_to_typescript_alias`, `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `AdaptiveBackoff` | `AdaptiveBackoff` | `.` | 1 | `planned` | `class` | `snake_case_to_camelCase` | `timing`: `test/semantic/constants-and-types.test.ts` |
| `DataType` | `DataType` | `.` | 1 | `planned` | `frozen_const_and_union` | `enum_to_const_union` | `domain_types`: `test/semantic/constants-and-types.test.ts` |
| `FeatureFlags` | `FeatureFlags` | `.` | 1 | `planned` | `readonly_object_factory` | `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `domain_types`: `test/semantic/constants-and-types.test.ts` |
| `IdmClientDiagnostics` | `IdmClientDiagnostics` | `.` | 2 | `planned` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase`, `tuple_to_readonly_array` | `transport_diagnostics`: `test/parity/transport-contract.test.ts` |
| `IdmNavigator10WebClient` | `IdmNavigator10WebClient` | `./web` | 4 | `planned` | `class` | `none_to_null`, `snake_case_to_camelCase`, `tuple_to_readonly_array` | `web_client`: `test/parity/web-contract.test.ts` |
| `IdmNavigator20WebClient` | `IdmNavigator20WebClient` | `./web` | 4 | `planned` | `class` | `mapping_to_readonly_map_or_record`, `none_to_null`, `snake_case_to_camelCase`, `tuple_to_readonly_array` | `web_client`: `test/parity/web-contract.test.ts` |
| `IdmModelInfo` | `IdmModelInfo` | `.` | 1 | `planned` | `readonly_object_factory` | `list_to_readonly_array`, `none_to_null`, `python_dataclass_to_readonly_object_factory`, `set_to_immutable_set_like`, `snake_case_to_camelCase` | `domain_types`: `test/semantic/constants-and-types.test.ts` |
| `IdmModbusClient` | `IdmModbusClient` | `.` | 2 | `planned` | `class` | `mapping_to_readonly_map_or_record`, `none_to_null`, `set_to_immutable_set_like`, `snake_case_to_camelCase`, `tuple_to_readonly_array` | `transport_client`: `test/parity/transport-contract.test.ts` |
| `IllegalAddressError` | `IllegalAddressError` | `.` | 2 | `planned` | `error_class` | `python_exception_to_error_class` | `transport_errors`: `test/parity/transport-contract.test.ts` |
| `ModbusCodec` | `ModbusCodec` | `.` | 1 | `planned` | `class` | `snake_case_to_camelCase` | `codec`: `test/codec.test.ts` |
| `IdmWebAuthenticationError` | `IdmWebAuthenticationError` | `./web` | 4 | `planned` | `error_class` | `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `IdmWebConnectionError` | `IdmWebConnectionError` | `./web` | 4 | `planned` | `error_class` | `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `IdmWebCsrfError` | `IdmWebCsrfError` | `./web` | 4 | `planned` | `error_class` | `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `IdmWebData` | `IdmWebData` | `./web` | 4 | `planned` | `readonly_object_factory` | `mapping_to_readonly_map_or_record`, `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebDependencyError` | `IdmWebDependencyError` | `./web` | 4 | `planned` | `error_class` | `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `IdmWebDiagnostics` | `IdmWebDiagnostics` | `./web` | 4 | `planned` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase`, `tuple_to_readonly_array` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebError` | `IdmWebError` | `./web` | 4 | `planned` | `error_class` | `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `IdmWebNotification` | `IdmWebNotification` | `./web` | 4 | `planned` | `readonly_object_factory` | `mapping_to_readonly_map_or_record`, `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebNotifications` | `IdmWebNotifications` | `./web` | 4 | `planned` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase`, `tuple_to_readonly_array` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebPinRejectedError` | `IdmWebPinRejectedError` | `./web` | 4 | `planned` | `error_class` | `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `IdmWebProtocolError` | `IdmWebProtocolError` | `./web` | 4 | `planned` | `error_class` | `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `IdmWebResponseError` | `IdmWebResponseError` | `./web` | 4 | `planned` | `error_class` | `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `IdmWebTimeoutError` | `IdmWebTimeoutError` | `./web` | 4 | `planned` | `error_class` | `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `IdmWebWebSocketError` | `IdmWebWebSocketError` | `./web` | 4 | `planned` | `error_class` | `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `PinRejectedError` | `PinRejectedError` | `./web` | 4 | `planned` | `alias` | `python_alias_to_typescript_alias`, `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `ProtocolError` | `ProtocolError` | `./web` | 4 | `planned` | `alias` | `python_alias_to_typescript_alias`, `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `TimeoutError` | `TimeoutError` | `./web` | 4 | `planned` | `alias` | `python_alias_to_typescript_alias`, `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `WebSocketError` | `WebSocketError` | `./web` | 4 | `planned` | `alias` | `python_alias_to_typescript_alias`, `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `IdmWebValue` | `IdmWebValue` | `./web` | 4 | `planned` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebValueDescription` | `IdmWebValueDescription` | `./web` | 4 | `planned` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `ModbusErrorContext` | `ModbusErrorContext` | `.` | 2 | `planned` | `readonly_object_factory` | `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `transport_errors`: `test/parity/transport-contract.test.ts` |
| `PollRateLimiter` | `PollRateLimiter` | `.` | 1 | `planned` | `class` | — | `timing`: `test/semantic/constants-and-types.test.ts` |
| `RECOMMENDED_WEB_SCAN_INTERVAL` | `RECOMMENDED_WEB_SCAN_INTERVAL` | `./web` | 4 | `planned` | `frozen_constant` | — | `web_constants`: `test/parity/web-contract.test.ts` |
| `RegisterDef` | `RegisterDef` | `.` | 1 | `planned` | `readonly_object_factory` | `mapping_to_readonly_map_or_record`, `none_to_null`, `python_dataclass_to_readonly_object_factory`, `set_to_immutable_set_like`, `snake_case_to_camelCase`, `tuple_to_readonly_array` | `register_definition`: `test/registers/register-def.test.ts` |
| `RegisterRegistry` | `RegisterRegistry` | `.` | 1 | `planned` | `class` | `mapping_to_readonly_map_or_record`, `none_to_null`, `snake_case_to_camelCase` | `registers`: `test/registers/builders.test.ts` |
| `RegisterType` | `RegisterType` | `.` | 1 | `planned` | `frozen_const_and_union` | `enum_to_const_union` | `domain_types`: `test/semantic/constants-and-types.test.ts` |
| `WEB_VALUE_DESCRIPTIONS` | `WEB_VALUE_DESCRIPTIONS` | `./web` | 4 | `planned` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `web_constants`: `test/parity/web-contract.test.ts` |
| `WriteClass` | `WriteClass` | `.` | 1 | `planned` | `frozen_const_and_union` | `enum_to_const_union` | `domain_types`: `test/semantic/constants-and-types.test.ts` |
| `WriteSafetyResult` | `WriteSafetyResult` | `.` | 3 | `planned` | `readonly_object_factory` | `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase`, `tuple_to_readonly_array` | `writes`: `test/parity/write-contract.test.ts` |
| `build_register_map` | `buildRegisterMap` | `.` | 1 | `planned` | `function` | `mapping_to_readonly_map_or_record`, `snake_case_to_camelCase` | `registers`: `test/registers/builders.test.ts` |
| `create_optional_navigator10_web_client` | `createOptionalNavigator10WebClient` | `./web` | 4 | `planned` | `function` | `none_to_null`, `snake_case_to_camelCase` | `web_factory`: `test/parity/web-contract.test.ts` |
| `create_optional_navigator20_web_client` | `createOptionalNavigator20WebClient` | `./web` | 4 | `planned` | `function` | `none_to_null`, `snake_case_to_camelCase` | `web_factory`: `test/parity/web-contract.test.ts` |
| `get_all_registers` | `getAllRegisters` | `.` | 1 | `planned` | `function` | `mapping_to_readonly_map_or_record`, `snake_case_to_camelCase` | `registers`: `test/registers/builders.test.ts` |
| `get_detection_registers` | `getDetectionRegisters` | `.` | 1 | `planned` | `function` | `list_to_readonly_array`, `snake_case_to_camelCase` | `registers`: `test/registers/builders.test.ts` |
| `get_heating_circuit_registers` | `getHeatingCircuitRegisters` | `.` | 1 | `planned` | `function` | `mapping_to_readonly_map_or_record`, `snake_case_to_camelCase` | `registers`: `test/registers/builders.test.ts` |
| `get_register` | `getRegister` | `.` | 1 | `planned` | `function` | `none_to_null`, `snake_case_to_camelCase` | `registers`: `test/registers/builders.test.ts` |
| `get_register_registry` | `getRegisterRegistry` | `.` | 1 | `planned` | `function` | `snake_case_to_camelCase` | `registers`: `test/registers/builders.test.ts` |
| `get_zone_module_registers` | `getZoneModuleRegisters` | `.` | 1 | `planned` | `function` | `mapping_to_readonly_map_or_record`, `snake_case_to_camelCase` | `registers`: `test/registers/builders.test.ts` |
| `quiet_pymodbus_logging` | `quietPymodbusLogging` | `.` | 2 | `planned` | `function` | `snake_case_to_camelCase` | `transport_logging`: `test/parity/transport-contract.test.ts` |
| `web_pin_configured` | `webPinConfigured` | `./web` | 4 | `planned` | `function` | `snake_case_to_camelCase` | `web_configuration`: `test/parity/web-contract.test.ts` |

## Phase 1 class/member contract

Constructor defaults, exact Python signatures, and validation boundaries remain authoritative in `test/fixtures/public-classes.json`.
The TypeScript naming and representation decisions below are derived only from mapping rows.

### AdaptiveBackoff

- Representation: `class`
- Python constructor: `(*, initial: 'float' = 5.0, multiplier: 'float' = 3.0, maximum: 'float' = 300.0) -> 'None'`
- Validation boundaries: 3
- Counterparts:
  - `AdaptiveBackoff.constructor.initial` → `initial`
  - `AdaptiveBackoff.constructor.multiplier` → `multiplier`
  - `AdaptiveBackoff.constructor.maximum` → `maximum`
  - `AdaptiveBackoff.next_delay` → `nextDelay` (method)
  - `AdaptiveBackoff.reset` → `reset` (method)

### DataType

- Representation: `frozen_const_and_union`
- Python constructor: `(*values)`
- Validation boundaries: 1
- Counterparts:
  - `DataType.constructor.values` → `values`
  - no public class members in the Python fact inventory

### FeatureFlags

- Representation: `readonly_object_factory`
- Python constructor: `(enable_nav2_web: 'bool' = True, enable_nav10_ws: 'bool' = True, enable_experimental_features: 'bool' = False, enable_write_support: 'bool' = True, enable_debug_endpoints: 'bool' = False) -> None`
- Validation boundaries: 1
- Counterparts:
  - `FeatureFlags.constructor.enable_nav2_web` → `enableNav2Web`
  - `FeatureFlags.constructor.enable_nav10_ws` → `enableNav10Ws`
  - `FeatureFlags.constructor.enable_experimental_features` → `enableExperimentalFeatures`
  - `FeatureFlags.constructor.enable_write_support` → `enableWriteSupport`
  - `FeatureFlags.constructor.enable_debug_endpoints` → `enableDebugEndpoints`
  - `FeatureFlags.enable_debug_endpoints` → `enableDebugEndpoints` (attribute)
  - `FeatureFlags.enable_experimental_features` → `enableExperimentalFeatures` (attribute)
  - `FeatureFlags.enable_nav10_ws` → `enableNav10Ws` (attribute)
  - `FeatureFlags.enable_nav2_web` → `enableNav2Web` (attribute)
  - `FeatureFlags.enable_write_support` → `enableWriteSupport` (attribute)

### IdmModelInfo

- Representation: `readonly_object_factory`
- Python constructor: `(model_name: 'str', active_heating_circuits: 'list[str]', zone_modules: 'int', has_solar: 'bool', has_isc: 'bool', has_pv: 'bool', has_cascade: 'bool', features: 'set[str]' = <factory>, firmware_version: 'float \| None' = None) -> None`
- Validation boundaries: 1
- Counterparts:
  - `IdmModelInfo.constructor.model_name` → `modelName`
  - `IdmModelInfo.constructor.active_heating_circuits` → `activeHeatingCircuits`
  - `IdmModelInfo.constructor.zone_modules` → `zoneModules`
  - `IdmModelInfo.constructor.has_solar` → `hasSolar`
  - `IdmModelInfo.constructor.has_isc` → `hasIsc`
  - `IdmModelInfo.constructor.has_pv` → `hasPv`
  - `IdmModelInfo.constructor.has_cascade` → `hasCascade`
  - `IdmModelInfo.constructor.features` → `features`
  - `IdmModelInfo.constructor.firmware_version` → `firmwareVersion`
  - `IdmModelInfo.active_heating_circuits` → `activeHeatingCircuits` (attribute)
  - `IdmModelInfo.features` → `features` (attribute)
  - `IdmModelInfo.firmware_version` → `firmwareVersion` (attribute)
  - `IdmModelInfo.has_cascade` → `hasCascade` (attribute)
  - `IdmModelInfo.has_isc` → `hasIsc` (attribute)
  - `IdmModelInfo.has_pv` → `hasPv` (attribute)
  - `IdmModelInfo.has_solar` → `hasSolar` (attribute)
  - `IdmModelInfo.model_name` → `modelName` (attribute)
  - `IdmModelInfo.zone_modules` → `zoneModules` (attribute)
  - `IdmModelInfo.is_pro` → `isPro` (property)

### ModbusCodec

- Representation: `class`
- Python constructor: `()`
- Validation boundaries: 1
- Counterparts:
  - constructor has no parameters
  - `ModbusCodec.decode_float32` → `decodeFloat32` (staticmethod)
  - `ModbusCodec.decode_int16` → `decodeInt16` (staticmethod)
  - `ModbusCodec.decode_int8` → `decodeInt8` (staticmethod)
  - `ModbusCodec.encode_float32` → `encodeFloat32` (staticmethod)
  - `ModbusCodec.encode_int16` → `encodeInt16` (staticmethod)
  - `ModbusCodec.encode_int8` → `encodeInt8` (staticmethod)

### PollRateLimiter

- Representation: `class`
- Python constructor: `(interval: 'float', *, clock: 'Any' = <built-in function monotonic>) -> 'None'`
- Validation boundaries: 2
- Counterparts:
  - `PollRateLimiter.constructor.interval` → `interval`
  - `PollRateLimiter.constructor.clock` → `clock`
  - `PollRateLimiter.allow` → `allow` (method)
  - `PollRateLimiter.interval` → `interval` (property)
  - `PollRateLimiter.mark` → `mark` (method)
  - `PollRateLimiter.remaining` → `remaining` (method)

### RegisterDef

- Representation: `readonly_object_factory`
- Python constructor: `(address: 'int', datatype: 'DataType', name: 'str', unit: 'str \| None' = None, writable: 'bool' = False, min_val: 'float \| None' = None, max_val: 'float \| None' = None, enum_options: 'dict[int, str] \| None' = None, multiplier: 'float' = 1.0, register_type: 'RegisterType' = <RegisterType.INPUT: 'input'>, eeprom_sensitive: 'bool' = False, cyclic_required: 'bool' = False, cyclic_write_ttl: 'float \| None' = None, binary: 'bool' = False, enabled_by_default: 'bool' = True, state_class: 'str \| None' = None, icon: 'str \| None' = None, write_only: 'bool' = False, exclude_from_write: 'set[int] \| None' = None, source: 'str' = 'official_idm_modbus', source_version: 'str' = 'MODBUS TCP NAVIGATOR 10 2025-06-18 plus Navigator 2.0/Pro legacy docs', supported_models: 'tuple[str, ...]' = <factory>, sentinel_values: 'tuple[int \| float \| str, ...]' = (), last_verified: 'str \| None' = None) -> None`
- Validation boundaries: 3
- Counterparts:
  - `RegisterDef.constructor.address` → `address`
  - `RegisterDef.constructor.datatype` → `datatype`
  - `RegisterDef.constructor.name` → `name`
  - `RegisterDef.constructor.unit` → `unit`
  - `RegisterDef.constructor.writable` → `writable`
  - `RegisterDef.constructor.min_val` → `minVal`
  - `RegisterDef.constructor.max_val` → `maxVal`
  - `RegisterDef.constructor.enum_options` → `enumOptions`
  - `RegisterDef.constructor.multiplier` → `multiplier`
  - `RegisterDef.constructor.register_type` → `registerType`
  - `RegisterDef.constructor.eeprom_sensitive` → `eepromSensitive`
  - `RegisterDef.constructor.cyclic_required` → `cyclicRequired`
  - `RegisterDef.constructor.cyclic_write_ttl` → `cyclicWriteTtl`
  - `RegisterDef.constructor.binary` → `binary`
  - `RegisterDef.constructor.enabled_by_default` → `enabledByDefault`
  - `RegisterDef.constructor.state_class` → `stateClass`
  - `RegisterDef.constructor.icon` → `icon`
  - `RegisterDef.constructor.write_only` → `writeOnly`
  - `RegisterDef.constructor.exclude_from_write` → `excludeFromWrite`
  - `RegisterDef.constructor.source` → `source`
  - `RegisterDef.constructor.source_version` → `sourceVersion`
  - `RegisterDef.constructor.supported_models` → `supportedModels`
  - `RegisterDef.constructor.sentinel_values` → `sentinelValues`
  - `RegisterDef.constructor.last_verified` → `lastVerified`
  - `RegisterDef.address` → `address` (attribute)
  - `RegisterDef.binary` → `binary` (attribute)
  - `RegisterDef.cyclic_required` → `cyclicRequired` (attribute)
  - `RegisterDef.cyclic_write_ttl` → `cyclicWriteTtl` (attribute)
  - `RegisterDef.datatype` → `datatype` (attribute)
  - `RegisterDef.eeprom_sensitive` → `eepromSensitive` (attribute)
  - `RegisterDef.enabled_by_default` → `enabledByDefault` (attribute)
  - `RegisterDef.enum_options` → `enumOptions` (attribute)
  - `RegisterDef.exclude_from_write` → `excludeFromWrite` (attribute)
  - `RegisterDef.icon` → `icon` (attribute)
  - `RegisterDef.last_verified` → `lastVerified` (attribute)
  - `RegisterDef.max_val` → `maxVal` (attribute)
  - `RegisterDef.min_val` → `minVal` (attribute)
  - `RegisterDef.multiplier` → `multiplier` (attribute)
  - `RegisterDef.name` → `name` (attribute)
  - `RegisterDef.register_type` → `registerType` (attribute)
  - `RegisterDef.sentinel_values` → `sentinelValues` (attribute)
  - `RegisterDef.size` → `size` (attribute)
  - `RegisterDef.source` → `source` (attribute)
  - `RegisterDef.source_version` → `sourceVersion` (attribute)
  - `RegisterDef.state_class` → `stateClass` (attribute)
  - `RegisterDef.supported_models` → `supportedModels` (attribute)
  - `RegisterDef.unit` → `unit` (attribute)
  - `RegisterDef.writable` → `writable` (attribute)
  - `RegisterDef.write_only` → `writeOnly` (attribute)
  - `RegisterDef.write_class` → `writeClass` (property)

### RegisterRegistry

- Representation: `class`
- Python constructor: `(registers: 'dict[str, RegisterDef]') -> None`
- Validation boundaries: 1
- Counterparts:
  - `RegisterRegistry.constructor.registers` → `registers`
  - `RegisterRegistry.registers` → `registers` (attribute)
  - `RegisterRegistry.by_address` → `byAddress` (method)
  - `RegisterRegistry.get` → `get` (method)
  - `RegisterRegistry.require` → `require` (method)
  - `RegisterRegistry.to_schema` → `toSchema` (method)
  - `RegisterRegistry.writable` → `writable` (method)

### RegisterType

- Representation: `frozen_const_and_union`
- Python constructor: `(*values)`
- Validation boundaries: 1
- Counterparts:
  - `RegisterType.constructor.values` → `values`
  - no public class members in the Python fact inventory

### WriteClass

- Representation: `frozen_const_and_union`
- Python constructor: `(*values)`
- Validation boundaries: 1
- Counterparts:
  - `WriteClass.constructor.values` → `values`
  - no public class members in the Python fact inventory

## Release rule

`--release` rejects every `planned` or `partial` row, every unjustified `not_applicable` row, and every `complete` row whose contract test is absent.
