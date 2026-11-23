<!-- GENERATED FILE — DO NOT EDIT. Run `node scripts/generate-api-parity.mjs` to regenerate. -->

# Public API parity

The Python matrix is generated from `contracts/api-mapping.json` and the pinned Python-only public inventories.
Additive Node-only types are governed separately by `contracts/typescript-extensions.json` and never alter Python coverage.
It documents development intent; only `complete` rows with passing evidence may be exported or released.

## Pinned baseline

- Repository: `https://github.com/Xerolux/idm-heatpump-api`
- Python package: `idm-heatpump-api`
- Python version/tag: `2.17.0rc1` / `v2.17.0rc1`
- Full commit: `6d6174fabc49cef765249358f4308102ef35391b`
- Parity schema: `1`
- Development status: `complete`

**162 public symbols: 77 root, 85 web.**

## Symbol matrix

| Python symbol | TypeScript counterpart | Export path | Owner | Status | Representation | Normalizations | Contract evidence |
| --- | --- | --- | ---: | --- | --- | --- | --- |
| `ACTIVE_HC_MODE_OPTIONS` | `ACTIVE_HC_MODE_OPTIONS` | `.` | 1 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `BINARY_REGISTER_METADATA` | `BINARY_REGISTER_METADATA` | `.` | 3 | `complete` | `readonly_map` | `mapping_to_readonly_map_or_record` | `binary_metadata`: `test/semantic/binary-metadata.test.ts` |
| `BIVALENCE_STATE_OPTIONS` | `BIVALENCE_STATE_OPTIONS` | `.` | 1 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `BOOSTER_FAULT_OPTIONS` | `BOOSTER_FAULT_OPTIONS` | `.` | 1 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `CIRCUIT_MODE_OPTIONS` | `CIRCUIT_MODE_OPTIONS` | `.` | 1 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `CORE_REGISTERS` | `CORE_REGISTERS` | `.` | 1 | `complete` | `readonly_map` | `mapping_to_readonly_map_or_record` | `registers`: `test/registers/builders.test.ts` |
| `DEFAULT_PORT` | `DEFAULT_PORT` | `.` | 1 | `complete` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `DEFAULT_SLAVE_ID` | `DEFAULT_SLAVE_ID` | `.` | 1 | `complete` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `DEFAULT_TIMEOUT` | `DEFAULT_TIMEOUT` | `.` | 1 | `complete` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `EEPROM_SENSITIVE_ADDRESSES` | `EEPROM_SENSITIVE_ADDRESSES` | `.` | 1 | `complete` | `frozen_constant` | `set_to_immutable_set_like` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `EVU_LOCK_OPTIONS` | `EVU_LOCK_OPTIONS` | `.` | 1 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `VALVE_HC_HEAT_COOL_OPTIONS` | `VALVE_HC_HEAT_COOL_OPTIONS` | `.` | 1 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `FEATURE_CASCADE` | `FEATURE_CASCADE` | `.` | 1 | `complete` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `FEATURE_HEATING_CIRCUITS` | `FEATURE_HEATING_CIRCUITS` | `.` | 1 | `complete` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `FEATURE_ISC` | `FEATURE_ISC` | `.` | 1 | `complete` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `FEATURE_PV` | `FEATURE_PV` | `.` | 1 | `complete` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `FEATURE_SOLAR` | `FEATURE_SOLAR` | `.` | 1 | `complete` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `FEATURE_ZONE_MODULES` | `FEATURE_ZONE_MODULES` | `.` | 1 | `complete` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `HEATING_CIRCUIT_LETTERS` | `HEATING_CIRCUIT_LETTERS` | `.` | 1 | `complete` | `frozen_constant` | `tuple_to_readonly_array` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `HP_OPERATING_MODE_OPTIONS` | `HP_OPERATING_MODE_OPTIONS` | `.` | 1 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `ISC_MODE_OPTIONS` | `ISC_MODE_OPTIONS` | `.` | 1 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `MAX_HEATING_CIRCUITS` | `MAX_HEATING_CIRCUITS` | `.` | 1 | `complete` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `MAX_ROOMS_PER_ZONE` | `MAX_ROOMS_PER_ZONE` | `.` | 1 | `complete` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `MAX_RETRIES` | `MAX_RETRIES` | `.` | 1 | `complete` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `MAX_ZONE_MODULES` | `MAX_ZONE_MODULES` | `.` | 1 | `complete` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `MODEL_DETECTION_MAX_RETRIES` | `MODEL_DETECTION_MAX_RETRIES` | `.` | 1 | `complete` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `MODEL_DETECTION_TIMEOUT` | `MODEL_DETECTION_TIMEOUT` | `.` | 1 | `complete` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `MODEL_NAVIGATOR_10` | `MODEL_NAVIGATOR_10` | `.` | 1 | `complete` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `MODEL_NAVIGATOR_17` | `MODEL_NAVIGATOR_17` | `.` | 1 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `MODEL_NAVIGATOR_20` | `MODEL_NAVIGATOR_20` | `.` | 1 | `complete` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `MODEL_NAVIGATOR_PRO` | `MODEL_NAVIGATOR_PRO` | `.` | 1 | `complete` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `MODEL_UNKNOWN` | `MODEL_UNKNOWN` | `.` | 1 | `complete` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `PUMP_STATUS_OPTIONS` | `PUMP_STATUS_OPTIONS` | `.` | 1 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `RETRY_BACKOFF_BASE` | `RETRY_BACKOFF_BASE` | `.` | 1 | `complete` | `frozen_constant` | — | `constants`: `test/semantic/constants-and-types.test.ts` |
| `ROOM_MODE_OPTIONS` | `ROOM_MODE_OPTIONS` | `.` | 1 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `SMART_GRID_OPTIONS` | `SMART_GRID_OPTIONS` | `.` | 1 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `SOLAR_MODE_OPTIONS` | `SOLAR_MODE_OPTIONS` | `.` | 1 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `SYSTEM_MODE_OPTIONS` | `SYSTEM_MODE_OPTIONS` | `.` | 1 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `UNINITIALIZED_TEMPERATURE_C` | `UNINITIALIZED_TEMPERATURE_C` | `.` | 1 | `complete` | `frozen_constant` | — | `plausibility`: `test/plausibility.test.ts` |
| `VARIABLE_INPUT_OPTIONS` | `VARIABLE_INPUT_OPTIONS` | `.` | 1 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `ZONE_MODULE_MODE_OPTIONS` | `ZONE_MODULE_MODE_OPTIONS` | `.` | 1 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `constants`: `test/semantic/constants-and-types.test.ts` |
| `AuthenticationError` | `AuthenticationError` | `./web` | 4 | `complete` | `alias` | `python_alias_to_typescript_alias`, `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `BinaryDeviceClass` | `BinaryDeviceClass` | `.` | 3 | `complete` | `frozen_const_and_union` | — | `binary_metadata`: `test/semantic/binary-metadata.test.ts` |
| `BinaryRegisterMetadata` | `BinaryRegisterMetadata` | `.` | 3 | `complete` | `readonly_object_factory` | `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase`, `tuple_to_readonly_array` | `binary_metadata`: `test/semantic/binary-metadata.test.ts` |
| `BinaryValue` | `BinaryValue` | `.` | 3 | `complete` | `frozen_const_and_union` | — | `binary_metadata`: `test/semantic/binary-metadata.test.ts` |
| `ConnectionError` | `ConnectionError` | `./web` | 4 | `complete` | `alias` | `python_alias_to_typescript_alias`, `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `CsrfError` | `CsrfError` | `./web` | 4 | `complete` | `alias` | `python_alias_to_typescript_alias`, `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `ErrorCodeInfo` | `ErrorCodeInfo` | `.` | 1 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `error_codes`: `test/error-codes.test.ts` |
| `AdaptiveBackoff` | `AdaptiveBackoff` | `.` | 1 | `complete` | `class` | `snake_case_to_camelCase` | `timing`: `test/semantic/constants-and-types.test.ts` |
| `DataType` | `DataType` | `.` | 1 | `complete` | `frozen_const_and_union` | `enum_to_const_union` | `domain_types`: `test/semantic/constants-and-types.test.ts` |
| `FeatureFlags` | `FeatureFlags` | `.` | 1 | `complete` | `readonly_object_factory` | `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `domain_types`: `test/semantic/constants-and-types.test.ts` |
| `IdmClientDiagnostics` | `IdmClientDiagnostics` | `.` | 2 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase`, `tuple_to_readonly_array` | `transport_diagnostics`: `test/client/diagnostics.test.ts` |
| `IdmNavigator10WebClient` | `IdmNavigator10WebClient` | `./web` | 4 | `complete` | `class` | `none_to_null`, `snake_case_to_camelCase`, `tuple_to_readonly_array` | `web_client`: `test/parity/web-contract.test.ts` |
| `IdmNavigator20WebClient` | `IdmNavigator20WebClient` | `./web` | 4 | `complete` | `class` | `mapping_to_readonly_map_or_record`, `none_to_null`, `snake_case_to_camelCase`, `tuple_to_readonly_array` | `web_client`: `test/parity/web-contract.test.ts` |
| `IdmModelInfo` | `IdmModelInfo` | `.` | 1 | `complete` | `readonly_object_factory` | `list_to_readonly_array`, `none_to_null`, `python_dataclass_to_readonly_object_factory`, `set_to_immutable_set_like`, `snake_case_to_camelCase` | `domain_types`: `test/semantic/constants-and-types.test.ts` |
| `IdmModbusClient` | `IdmModbusClient` | `.` | 2 | `complete` | `class` | `diagnostic_message_redaction`, `idm_modbus_client_options`, `internal_adapter_retries_zero`, `mapping_to_readonly_map_or_record`, `none_to_null`, `set_to_immutable_set_like`, `snake_case_to_camelCase`, `transport_error_type_to_closed_kind`, `tuple_to_readonly_array` | `transport_client`: `test/parity/transport-contract.test.ts` |
| `IdmCoilTransportExtension` | `IdmCoilTransportExtension` | `.` | 3 | `complete` | `readonly_object_factory` | `snake_case_to_camelCase` | `transport_protocol`: `test/client/coils.test.ts` |
| `IdmModbusTransport` | `ModbusTransport` | `.` | 3 | `complete` | `class` | `snake_case_to_camelCase` | `transport_client`: `test/parity/transport-contract.test.ts` |
| `IdmConnectionError` | `IdmConnectionError` | `.` | 2 | `complete` | `error_class` | `python_exception_to_error_class`, `snake_case_to_camelCase` | `transport_errors`: `test/client/errors.test.ts` |
| `IdmDeviceError` | `IdmDeviceError` | `.` | 2 | `complete` | `error_class` | `python_exception_to_error_class`, `snake_case_to_camelCase` | `transport_errors`: `test/client/errors.test.ts` |
| `IdmModbusError` | `IdmModbusError` | `.` | 2 | `complete` | `error_class` | `python_exception_to_error_class`, `snake_case_to_camelCase` | `transport_errors`: `test/client/errors.test.ts` |
| `IdmTransportError` | `IdmTransportError` | `.` | 2 | `complete` | `error_class` | `python_exception_to_error_class`, `snake_case_to_camelCase` | `transport_errors`: `test/client/errors.test.ts` |
| `IllegalAddressError` | `IllegalAddressError` | `.` | 2 | `complete` | `error_class` | `python_exception_to_error_class`, `snake_case_to_camelCase` | `transport_errors`: `test/client/errors.test.ts` |
| `ModbusCodec` | `ModbusCodec` | `.` | 1 | `complete` | `class` | `snake_case_to_camelCase` | `codec`: `test/codec.test.ts` |
| `IdmWebAuthenticationError` | `IdmWebAuthenticationError` | `./web` | 4 | `complete` | `error_class` | `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `IdmWebConnectionError` | `IdmWebConnectionError` | `./web` | 4 | `complete` | `error_class` | `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `IdmWebCsrfError` | `IdmWebCsrfError` | `./web` | 4 | `complete` | `error_class` | `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `IdmWebData` | `IdmWebData` | `./web` | 4 | `complete` | `readonly_object_factory` | `mapping_to_readonly_map_or_record`, `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebDemandReason` | `IdmWebDemandReason` | `./web` | 4 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebDependencyError` | `IdmWebDependencyError` | `./web` | 4 | `complete` | `error_class` | `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `IdmWebDiagnostics` | `IdmWebDiagnostics` | `./web` | 4 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase`, `tuple_to_readonly_array` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebEnergyflow` | `IdmWebEnergyflow` | `./web` | 4 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebError` | `IdmWebError` | `./web` | 4 | `complete` | `error_class` | `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `IdmWebFreshwater` | `IdmWebFreshwater` | `./web` | 4 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebIon` | `IdmWebIon` | `./web` | 4 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebPerformance` | `IdmWebPerformance` | `./web` | 4 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebHomeDetail` | `IdmWebHomeDetail` | `./web` | 4 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebHomeOverview` | `IdmWebHomeOverview` | `./web` | 4 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebStatus` | `IdmWebStatus` | `./web` | 4 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebHeatingCircuit` | `IdmWebHeatingCircuit` | `./web` | 4 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebHeatingCircuitChoice` | `IdmWebHeatingCircuitChoice` | `./web` | 4 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebHeatingCircuitRef` | `IdmWebHeatingCircuitRef` | `./web` | 4 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebHeatingCircuitValue` | `IdmWebHeatingCircuitValue` | `./web` | 4 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebSettingParameter` | `IdmWebSettingParameter` | `./web` | 4 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `parse_navigator_heatingcircuit_response` | `parseNavigatorHeatingcircuitResponse` | `./web` | 4 | `complete` | `function` | `none_to_null`, `snake_case_to_camelCase` | `web_parsers`: `test/parity/web-contract.test.ts` |
| `IdmWebSystemCircuit` | `IdmWebSystemCircuit` | `./web` | 4 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebSystemMode` | `IdmWebSystemMode` | `./web` | 4 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebSystemOverview` | `IdmWebSystemOverview` | `./web` | 4 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebNotification` | `IdmWebNotification` | `./web` | 4 | `complete` | `readonly_object_factory` | `mapping_to_readonly_map_or_record`, `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebNotifications` | `IdmWebNotifications` | `./web` | 4 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase`, `tuple_to_readonly_array` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebPinRejectedError` | `IdmWebPinRejectedError` | `./web` | 4 | `complete` | `error_class` | `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `IdmWebProtocolError` | `IdmWebProtocolError` | `./web` | 4 | `complete` | `error_class` | `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `IdmWebResponseError` | `IdmWebResponseError` | `./web` | 4 | `complete` | `error_class` | `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `IdmWebHeatingCircuitUnavailableError` | `IdmWebHeatingCircuitUnavailableError` | `./web` | 4 | `complete` | `error_class` | `python_exception_to_error_class`, `snake_case_to_camelCase` | `web_errors`: `test/parity/web-contract.test.ts` |
| `IdmWebTimeoutError` | `IdmWebTimeoutError` | `./web` | 4 | `complete` | `error_class` | `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `IdmWebWebSocketError` | `IdmWebWebSocketError` | `./web` | 4 | `complete` | `error_class` | `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `PinRejectedError` | `PinRejectedError` | `./web` | 4 | `complete` | `alias` | `python_alias_to_typescript_alias`, `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `ProtocolError` | `ProtocolError` | `./web` | 4 | `complete` | `alias` | `python_alias_to_typescript_alias`, `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `TimeoutError` | `TimeoutError` | `./web` | 4 | `complete` | `alias` | `python_alias_to_typescript_alias`, `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `WebSocketError` | `WebSocketError` | `./web` | 4 | `complete` | `alias` | `python_alias_to_typescript_alias`, `python_exception_to_error_class` | `web_errors`: `test/parity/web-contract.test.ts` |
| `IdmWebValue` | `IdmWebValue` | `./web` | 4 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebValueDescription` | `IdmWebValueDescription` | `./web` | 4 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebWeatherDay` | `IdmWebWeatherDay` | `./web` | 4 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `IdmWebWeatherDetail` | `IdmWebWeatherDetail` | `./web` | 4 | `complete` | `readonly_object_factory` | `none_to_null`, `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `web_data`: `test/parity/web-contract.test.ts` |
| `ModbusErrorContext` | `ModbusErrorContext` | `.` | 2 | `complete` | `readonly_object_factory` | `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase` | `transport_errors`: `test/client/diagnostics.test.ts` |
| `PollRateLimiter` | `PollRateLimiter` | `.` | 1 | `complete` | `class` | — | `timing`: `test/semantic/constants-and-types.test.ts` |
| `RECOMMENDED_WEB_SCAN_INTERVAL` | `RECOMMENDED_WEB_SCAN_INTERVAL` | `./web` | 4 | `complete` | `frozen_constant` | — | `web_constants`: `test/parity/web-contract.test.ts` |
| `RegisterDef` | `RegisterDef` | `.` | 1 | `complete` | `readonly_object_factory` | `mapping_to_readonly_map_or_record`, `none_to_null`, `python_dataclass_to_readonly_object_factory`, `set_to_immutable_set_like`, `snake_case_to_camelCase`, `tuple_to_readonly_array` | `register_definition`: `test/registers/register-def.test.ts` |
| `RegisterRegistry` | `RegisterRegistry` | `.` | 1 | `complete` | `class` | `mapping_to_readonly_map_or_record`, `none_to_null`, `snake_case_to_camelCase` | `registers`: `test/registers/builders.test.ts` |
| `RegisterType` | `RegisterType` | `.` | 1 | `complete` | `frozen_const_and_union` | `enum_to_const_union` | `domain_types`: `test/semantic/constants-and-types.test.ts` |
| `NAVIGATOR10_DHW_DEMAND_REASON_BITS` | `NAVIGATOR10_DHW_DEMAND_REASON_BITS` | `./web` | 4 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `web_constants`: `test/parity/web-contract.test.ts` |
| `NAVIGATOR10_HEATING_DEMAND_REASON_BITS` | `NAVIGATOR10_HEATING_DEMAND_REASON_BITS` | `./web` | 4 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `web_constants`: `test/parity/web-contract.test.ts` |
| `NAVIGATOR10_STATISTIC_EMHP` | `NAVIGATOR10_STATISTIC_EMHP` | `./web` | 4 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `web_constants`: `test/parity/web-contract.test.ts` |
| `NAVIGATOR10_STATISTIC_EMEH` | `NAVIGATOR10_STATISTIC_EMEH` | `./web` | 4 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `web_constants`: `test/parity/web-contract.test.ts` |
| `NAVIGATOR10_STATISTIC_ENERGY_FLOW` | `NAVIGATOR10_STATISTIC_ENERGY_FLOW` | `./web` | 4 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `web_constants`: `test/parity/web-contract.test.ts` |
| `NAVIGATOR10_STATISTIC_HEAT_QUANTITIES` | `NAVIGATOR10_STATISTIC_HEAT_QUANTITIES` | `./web` | 4 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `web_constants`: `test/parity/web-contract.test.ts` |
| `NAVIGATOR10_STATISTIC_PERIOD_DAILY` | `NAVIGATOR10_STATISTIC_PERIOD_DAILY` | `./web` | 4 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `web_constants`: `test/parity/web-contract.test.ts` |
| `NAVIGATOR10_STATISTIC_PERIOD_TODAY` | `NAVIGATOR10_STATISTIC_PERIOD_TODAY` | `./web` | 4 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `web_constants`: `test/parity/web-contract.test.ts` |
| `NAVIGATOR10_STATISTIC_PERIOD_TOTAL` | `NAVIGATOR10_STATISTIC_PERIOD_TOTAL` | `./web` | 4 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `web_constants`: `test/parity/web-contract.test.ts` |
| `NAVIGATOR10_STATISTIC_RUNTIME_BIVALENCE` | `NAVIGATOR10_STATISTIC_RUNTIME_BIVALENCE` | `./web` | 4 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `web_constants`: `test/parity/web-contract.test.ts` |
| `NAVIGATOR10_STATISTIC_RUNTIME_HEATPUMP` | `NAVIGATOR10_STATISTIC_RUNTIME_HEATPUMP` | `./web` | 4 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `web_constants`: `test/parity/web-contract.test.ts` |
| `NAVIGATOR10_SYSTEM_MODE_AWAY` | `NAVIGATOR10_SYSTEM_MODE_AWAY` | `./web` | 4 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `web_constants`: `test/parity/web-contract.test.ts` |
| `NAVIGATOR10_SYSTEM_MODE_AUTOMATIC` | `NAVIGATOR10_SYSTEM_MODE_AUTOMATIC` | `./web` | 4 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `web_constants`: `test/parity/web-contract.test.ts` |
| `NAVIGATOR10_SYSTEM_MODE_HEATING_COOLING_ONLY` | `NAVIGATOR10_SYSTEM_MODE_HEATING_COOLING_ONLY` | `./web` | 4 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `web_constants`: `test/parity/web-contract.test.ts` |
| `NAVIGATOR10_SYSTEM_MODE_HOLIDAY` | `NAVIGATOR10_SYSTEM_MODE_HOLIDAY` | `./web` | 4 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `web_constants`: `test/parity/web-contract.test.ts` |
| `NAVIGATOR10_SYSTEM_MODE_HOT_WATER_ONLY` | `NAVIGATOR10_SYSTEM_MODE_HOT_WATER_ONLY` | `./web` | 4 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `web_constants`: `test/parity/web-contract.test.ts` |
| `NAVIGATOR10_SYSTEM_MODE_STANDBY` | `NAVIGATOR10_SYSTEM_MODE_STANDBY` | `./web` | 4 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `web_constants`: `test/parity/web-contract.test.ts` |
| `NAVIGATOR10_WRITABLE_SYSTEM_MODES` | `NAVIGATOR10_WRITABLE_SYSTEM_MODES` | `./web` | 4 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `web_constants`: `test/parity/web-contract.test.ts` |
| `NAVIGATOR10_DHW_SETPOINT_PARAM` | `NAVIGATOR10_DHW_SETPOINT_PARAM` | `./web` | 4 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `web_constants`: `test/parity/web-contract.test.ts` |
| `NAVIGATOR10_DATETIME_SETTING_ID` | `NAVIGATOR10_DATETIME_SETTING_ID` | `./web` | 4 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `web_constants`: `test/parity/web-contract.test.ts` |
| `parse_navigator20_response` | `parseNavigator20Response` | `./web` | 4 | `complete` | `function` | `none_to_null`, `snake_case_to_camelCase` | `web_parsers`: `test/parity/web-contract.test.ts` |
| `parse_navigator20_statistics_response` | `parseNavigator20StatisticsResponse` | `./web` | 4 | `complete` | `function` | `none_to_null`, `snake_case_to_camelCase` | `web_parsers`: `test/parity/web-contract.test.ts` |
| `NAVIGATOR10_DHW_SETPOINT_SETTING_ID` | `NAVIGATOR10_DHW_SETPOINT_SETTING_ID` | `./web` | 4 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `web_constants`: `test/parity/web-contract.test.ts` |
| `parse_navigator_energyflow_response` | `parseNavigatorEnergyflowResponse` | `./web` | 4 | `complete` | `function` | `none_to_null`, `snake_case_to_camelCase` | `web_parsers`: `test/parity/web-contract.test.ts` |
| `parse_navigator_home_overview_response` | `parseNavigatorHomeOverviewResponse` | `./web` | 4 | `complete` | `function` | `none_to_null`, `snake_case_to_camelCase` | `web_parsers`: `test/parity/web-contract.test.ts` |
| `parse_navigator_setting_parameter` | `parseNavigatorSettingParameter` | `./web` | 4 | `complete` | `function` | `none_to_null`, `snake_case_to_camelCase` | `web_parsers`: `test/parity/web-contract.test.ts` |
| `parse_navigator_save_response` | `parseNavigatorSaveResponse` | `./web` | 4 | `complete` | `function` | `none_to_null`, `snake_case_to_camelCase` | `web_parsers`: `test/parity/web-contract.test.ts` |
| `WEB_VALUE_DESCRIPTIONS` | `WEB_VALUE_DESCRIPTIONS` | `./web` | 4 | `complete` | `frozen_constant` | `mapping_to_readonly_map_or_record` | `web_constants`: `test/parity/web-contract.test.ts` |
| `decode_navigator10_demand_reason` | `decodeNavigator10DemandReason` | `./web` | 4 | `complete` | `function` | `none_to_null`, `snake_case_to_camelCase` | `web_parsers`: `test/parity/web-contract.test.ts` |
| `parse_navigator_freshwater_response` | `parseNavigatorFreshwaterResponse` | `./web` | 4 | `complete` | `function` | `none_to_null`, `snake_case_to_camelCase` | `web_parsers`: `test/parity/web-contract.test.ts` |
| `parse_navigator_home_response` | `parseNavigatorHomeResponse` | `./web` | 4 | `complete` | `function` | `none_to_null`, `snake_case_to_camelCase` | `web_parsers`: `test/parity/web-contract.test.ts` |
| `parse_navigator_ion_response` | `parseNavigatorIonResponse` | `./web` | 4 | `complete` | `function` | `none_to_null`, `snake_case_to_camelCase` | `web_parsers`: `test/parity/web-contract.test.ts` |
| `parse_navigator_performance_response` | `parseNavigatorPerformanceResponse` | `./web` | 4 | `complete` | `function` | `none_to_null`, `snake_case_to_camelCase` | `web_parsers`: `test/parity/web-contract.test.ts` |
| `parse_navigator_status_response` | `parseNavigatorStatusResponse` | `./web` | 4 | `complete` | `function` | `none_to_null`, `snake_case_to_camelCase` | `web_parsers`: `test/parity/web-contract.test.ts` |
| `parse_navigator_system_overview_response` | `parseNavigatorSystemOverviewResponse` | `./web` | 4 | `complete` | `function` | `none_to_null`, `snake_case_to_camelCase` | `web_parsers`: `test/parity/web-contract.test.ts` |
| `parse_navigator_weather_response` | `parseNavigatorWeatherResponse` | `./web` | 4 | `complete` | `function` | `none_to_null`, `snake_case_to_camelCase` | `web_parsers`: `test/parity/web-contract.test.ts` |
| `WriteClass` | `WriteClass` | `.` | 1 | `complete` | `frozen_const_and_union` | `enum_to_const_union` | `domain_types`: `test/semantic/constants-and-types.test.ts` |
| `WriteSafetyResult` | `WriteSafetyResult` | `.` | 3 | `complete` | `readonly_object_factory` | `python_dataclass_to_readonly_object_factory`, `snake_case_to_camelCase`, `tuple_to_readonly_array` | `writes`: `test/parity/write-contract.test.ts` |
| `build_register_map` | `buildRegisterMap` | `.` | 1 | `complete` | `function` | `mapping_to_readonly_map_or_record`, `snake_case_to_camelCase` | `registers`: `test/registers/builders.test.ts` |
| `create_optional_navigator10_web_client` | `createOptionalNavigator10WebClient` | `./web` | 4 | `complete` | `function` | `none_to_null`, `snake_case_to_camelCase` | `web_factory`: `test/parity/web-contract.test.ts` |
| `create_optional_navigator20_web_client` | `createOptionalNavigator20WebClient` | `./web` | 4 | `complete` | `function` | `none_to_null`, `snake_case_to_camelCase` | `web_factory`: `test/parity/web-contract.test.ts` |
| `get_all_registers` | `getAllRegisters` | `.` | 1 | `complete` | `function` | `mapping_to_readonly_map_or_record`, `snake_case_to_camelCase` | `registers`: `test/registers/builders.test.ts` |
| `get_binary_register_metadata` | `getBinaryRegisterMetadata` | `.` | 3 | `complete` | `function` | `none_to_null`, `snake_case_to_camelCase` | `binary_metadata`: `test/semantic/binary-metadata.test.ts` |
| `get_detection_registers` | `getDetectionRegisters` | `.` | 1 | `complete` | `function` | `list_to_readonly_array`, `snake_case_to_camelCase` | `registers`: `test/registers/builders.test.ts` |
| `get_error_code_info` | `getErrorCodeInfo` | `.` | 1 | `complete` | `function` | `none_to_null`, `snake_case_to_camelCase` | `error_codes`: `test/error-codes.test.ts` |
| `get_heating_circuit_registers` | `getHeatingCircuitRegisters` | `.` | 1 | `complete` | `function` | `mapping_to_readonly_map_or_record`, `snake_case_to_camelCase` | `registers`: `test/registers/builders.test.ts` |
| `get_register` | `getRegister` | `.` | 1 | `complete` | `function` | `none_to_null`, `snake_case_to_camelCase` | `registers`: `test/registers/builders.test.ts` |
| `get_register_registry` | `getRegisterRegistry` | `.` | 1 | `complete` | `function` | `snake_case_to_camelCase` | `registers`: `test/registers/builders.test.ts` |
| `get_zone_module_registers` | `getZoneModuleRegisters` | `.` | 1 | `complete` | `function` | `mapping_to_readonly_map_or_record`, `snake_case_to_camelCase` | `registers`: `test/registers/builders.test.ts` |
| `is_uninitialized_temperature` | `isUninitializedTemperature` | `.` | 1 | `complete` | `function` | `none_to_null`, `snake_case_to_camelCase` | `plausibility`: `test/plausibility.test.ts` |
| `quiet_pymodbus_logging` | `quietPymodbusLogging` | `.` | 2 | `complete` | `function` | `snake_case_to_camelCase` | `transport_logging`: `test/client/errors.test.ts` |
| `web_pin_configured` | `webPinConfigured` | `./web` | 4 | `complete` | `function` | `snake_case_to_camelCase` | `web_configuration`: `test/parity/web-contract.test.ts` |

## TypeScript-only extensions

These explicitly additive symbols have no Python counterpart and do not count toward the 89-row Python inventory.

| TypeScript symbol | Export path | Owner | Status | Kind | Rationale | Contract evidence |
| --- | --- | ---: | --- | --- | --- | --- |
| `SYSTEM_MODE_17_OPTIONS` | `.` | 1 | `complete` | `type` | Navigator 1.7 enum table consumed by the mapped 1.7 register block; Python keeps it module-private (not in __all__), TypeScript re-exports it for register consumers. | `test/semantic/constants-and-types.test.ts` |
| `HC_OPERATING_MODE_17_OPTIONS` | `.` | 1 | `complete` | `type` | Navigator 1.7 heating-circuit operating-mode table consumed by the mapped 1.7 register block; Python keeps it module-private (not in __all__), TypeScript re-exports it for register consumers. | `test/semantic/constants-and-types.test.ts` |
| `SOLAR_OPERATING_MODE_17_OPTIONS` | `.` | 1 | `complete` | `type` | Navigator 1.7 solar operating-mode table consumed by the mapped 1.7 register block; Python keeps it module-private (not in __all__), TypeScript re-exports it for register consumers. | `test/semantic/constants-and-types.test.ts` |

## Runtime normalization authority

- Public constructor: `host` plus mapped options `port`, `slaveId`, `timeout`, `maxRetries`, `maxGroupSize`, `transport`
- Internal adapter policy: pymodbus adapter retries are internalized at `0`
- Closed error kinds: `timeout`, `disconnected`, `socket`, `no_response`, `modbus`, `illegal_address`, `invalid_response`
- Diagnostic redaction: longest-first endpoint replacement with `<endpoint>`, unchanged remaining text/order, and rejection above 1024 characters
- Error equivalence never uses exception class names, message substrings, case folding, or undocumented fallbacks.

## Partial class lifecycle

Partial classes are private-development authorities only. Their implemented and omitted member lists are an exact disjoint partition of the pinned Python class fixture, and release mode rejects them.

No partial classes are currently declared.

## Phase 1 class/member contract

Constructor defaults, exact Python signatures, and validation boundaries remain authoritative in `test/fixtures/public-classes.json`.
The TypeScript naming and representation decisions below are derived only from mapping rows.

### ErrorCodeInfo

- Representation: `readonly_object_factory`
- Python constructor: `(code: 'int', is_warning: 'bool', text: 'str \| None', info: 'str \| None', user_description: 'str \| None', service_description: 'str \| None') -> None`
- Validation boundaries: 1
- Counterparts:
  - `ErrorCodeInfo.constructor.code` → `code`
  - `ErrorCodeInfo.constructor.is_warning` → `isWarning`
  - `ErrorCodeInfo.constructor.text` → `text`
  - `ErrorCodeInfo.constructor.info` → `info`
  - `ErrorCodeInfo.constructor.user_description` → `userDescription`
  - `ErrorCodeInfo.constructor.service_description` → `serviceDescription`
  - `ErrorCodeInfo.code` → `code` (attribute)
  - `ErrorCodeInfo.info` → `info` (attribute)
  - `ErrorCodeInfo.is_warning` → `isWarning` (attribute)
  - `ErrorCodeInfo.service_description` → `serviceDescription` (attribute)
  - `ErrorCodeInfo.text` → `text` (attribute)
  - `ErrorCodeInfo.user_description` → `userDescription` (attribute)
  - `ErrorCodeInfo.display_text` → `displayText` (property)

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
- Python constructor: `(interval: 'float', *, clock: 'Callable[[], float]' = <built-in function monotonic>) -> 'None'`
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
- Python constructor: `(address: 'int', datatype: 'DataType', name: 'str', unit: 'str \| None' = None, writable: 'bool' = False, min_val: 'float \| None' = None, max_val: 'float \| None' = None, enum_options: 'dict[int, str] \| None' = None, multiplier: 'float' = 1.0, register_type: 'RegisterType' = <RegisterType.INPUT: 'input'>, eeprom_sensitive: 'bool' = False, cyclic_required: 'bool' = False, cyclic_write_ttl: 'float \| None' = None, binary: 'bool' = False, enabled_by_default: 'bool' = True, state_class: 'str \| None' = None, icon: 'str \| None' = None, write_only: 'bool' = False, exclude_from_write: 'set[int] \| None' = None, source: 'str' = 'official_idm_modbus', source_version: 'str' = 'MODBUS TCP NAVIGATOR 10 2025-06-18 plus Navigator 2.0/Pro legacy docs', supported_models: 'tuple[str, ...]' = <factory>, sentinel_values: 'tuple[int \| float \| str, ...]' = (), last_verified: 'str \| None' = None, step: 'float \| None' = None) -> None`
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
  - `RegisterDef.constructor.step` → `step`
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
  - `RegisterDef.step` → `step` (attribute)
  - `RegisterDef.supported_models` → `supportedModels` (attribute)
  - `RegisterDef.unit` → `unit` (attribute)
  - `RegisterDef.writable` → `writable` (attribute)
  - `RegisterDef.write_only` → `writeOnly` (attribute)
  - `RegisterDef.effective_sentinel_values` → `effectiveSentinelValues` (property)
  - `RegisterDef.matches_request_shape` → `matchesRequestShape` (method)
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

`--release` rejects every `planned` or `partial` Python row, every unjustified `not_applicable` row, every incomplete TypeScript-only extension, and every `complete` authority whose contract test is absent.
