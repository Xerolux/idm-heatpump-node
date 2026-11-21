export {
  AuthenticationError,
  ConnectionError,
  CsrfError,
  IdmWebAuthenticationError,
  IdmWebConnectionError,
  IdmWebCsrfError,
  IdmWebData,
  IdmWebDependencyError,
  IdmWebDiagnostics,
  IdmWebError,
  IdmWebNotification,
  IdmWebNotifications,
  IdmWebPinRejectedError,
  IdmWebProtocolError,
  IdmWebResponseError,
  IdmWebTimeoutError,
  IdmWebValue,
  IdmWebValueDescription,
  IdmWebWebSocketError,
  NAVIGATOR10_DATETIME_SETTING_ID,
  NAVIGATOR10_DHW_DEMAND_REASON_BITS,
  NAVIGATOR10_DHW_SETPOINT_PARAM,
  NAVIGATOR10_DHW_SETPOINT_SETTING_ID,
  NAVIGATOR10_HEATING_DEMAND_REASON_BITS,
  NAVIGATOR10_STATISTIC_EMEH,
  NAVIGATOR10_STATISTIC_EMHP,
  NAVIGATOR10_STATISTIC_ENERGY_FLOW,
  NAVIGATOR10_STATISTIC_HEAT_QUANTITIES,
  NAVIGATOR10_STATISTIC_PERIOD_DAILY,
  NAVIGATOR10_STATISTIC_PERIOD_TODAY,
  NAVIGATOR10_STATISTIC_PERIOD_TOTAL,
  NAVIGATOR10_STATISTIC_RUNTIME_BIVALENCE,
  NAVIGATOR10_STATISTIC_RUNTIME_HEATPUMP,
  NAVIGATOR10_SYSTEM_MODE_AWAY,
  NAVIGATOR10_SYSTEM_MODE_AUTOMATIC,
  NAVIGATOR10_SYSTEM_MODE_HEATING_COOLING_ONLY,
  NAVIGATOR10_SYSTEM_MODE_HOLIDAY,
  NAVIGATOR10_SYSTEM_MODE_HOT_WATER_ONLY,
  NAVIGATOR10_SYSTEM_MODE_STANDBY,
  NAVIGATOR10_WRITABLE_SYSTEM_MODES,
  PinRejectedError,
  ProtocolError,
  RECOMMENDED_WEB_SCAN_INTERVAL,
  TimeoutError,
  WEB_VALUE_DESCRIPTIONS,
  WebSocketError,
  decodeNavigator10DemandReason,
  parseNavigator20Response,
  parseNavigator20StatisticsResponse,
  parseNavigatorEnergyflowResponse,
  parseNavigatorFreshwaterResponse,
  parseNavigatorHeatingcircuitResponse,
  parseNavigatorHomeOverviewResponse,
  parseNavigatorHomeResponse,
  parseNavigatorIonResponse,
  parseNavigatorPerformanceResponse,
  parseNavigatorSaveResponse,
  parseNavigatorSettingParameter,
  parseNavigatorStatusResponse,
  parseNavigatorSystemOverviewResponse,
  parseNavigatorWeatherResponse,
  webPinConfigured,
} from "./core.js";
export {
  IdmWebDemandReason,
  IdmWebEnergyflow,
  IdmWebFreshwater,
  IdmWebHeatingCircuit,
  IdmWebHeatingCircuitChoice,
  IdmWebHeatingCircuitRef,
  IdmWebHeatingCircuitValue,
  IdmWebHomeDetail,
  IdmWebHomeOverview,
  IdmWebIon,
  IdmWebPerformance,
  IdmWebSettingParameter,
  IdmWebStatus,
  IdmWebSystemCircuit,
  IdmWebSystemMode,
  IdmWebSystemOverview,
  IdmWebWeatherDay,
  IdmWebWeatherDetail,
} from "./core.js";
export { IdmNavigator10WebClient } from "./navigator10.js";
export { IdmNavigator20WebClient } from "./navigator20.js";

export type {
  IdmWebDataInput,
  IdmWebDemandReasonInput,
  IdmWebDiagnosticsInput,
  IdmWebEnergyflowInput,
  IdmWebFreshwaterInput,
  IdmWebHeatingCircuitChoiceInput,
  IdmWebHeatingCircuitInput,
  IdmWebHeatingCircuitRefInput,
  IdmWebHeatingCircuitValueInput,
  IdmWebHomeDetailInput,
  IdmWebHomeOverviewInput,
  IdmWebIonInput,
  IdmWebNotificationInput,
  IdmWebNotificationsInput,
  IdmWebPerformanceInput,
  IdmWebSettingParameterInput,
  IdmWebStatusInput,
  IdmWebSystemCircuitInput,
  IdmWebSystemModeInput,
  IdmWebSystemOverviewInput,
  IdmWebValueDescriptionInput,
  IdmWebValueInput,
  IdmWebWeatherDayInput,
  IdmWebWeatherDetailInput,
  NavigatorWebModel,
} from "./core.js";
export type {
  IdmNavigator10WebClientOptions,
  Navigator10Socket,
  Navigator10SocketFactory,
} from "./navigator10.js";
export type {
  IdmNavigator20WebClientOptions,
  Navigator20Request,
  Navigator20Response,
  Navigator20Session,
} from "./navigator20.js";

import { IdmNavigator10WebClient, type IdmNavigator10WebClientOptions } from "./navigator10.js";
import { IdmNavigator20WebClient, type IdmNavigator20WebClientOptions } from "./navigator20.js";

export function createOptionalNavigator10WebClient(
  host: string,
  pin: string | null | undefined,
  options: IdmNavigator10WebClientOptions = {},
): IdmNavigator10WebClient | null {
  const normalizedPin = pin?.trim();
  if (normalizedPin === undefined || normalizedPin.length === 0) return null;
  return new IdmNavigator10WebClient(host, normalizedPin, options);
}

export function createOptionalNavigator20WebClient(
  host: string,
  pin: string | null | undefined,
  options: IdmNavigator20WebClientOptions = {},
): IdmNavigator20WebClient | null {
  const normalizedPin = pin?.trim();
  if (normalizedPin === undefined || normalizedPin.length === 0) return null;
  return new IdmNavigator20WebClient(host, normalizedPin, options);
}
