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
  PinRejectedError,
  ProtocolError,
  RECOMMENDED_WEB_SCAN_INTERVAL,
  TimeoutError,
  WEB_VALUE_DESCRIPTIONS,
  WebSocketError,
  webPinConfigured,
} from "./core.js";
export { IdmNavigator10WebClient } from "./navigator10.js";
export { IdmNavigator20WebClient } from "./navigator20.js";

export type {
  IdmWebDataInput,
  IdmWebDiagnosticsInput,
  IdmWebNotificationInput,
  IdmWebNotificationsInput,
  IdmWebValueDescriptionInput,
  IdmWebValueInput,
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
