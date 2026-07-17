export const DEFAULT_NAVIGATOR10_PORT = 61220;
export const DEFAULT_NAVIGATOR10_REQUEST_DELAY = 0.05;
export const RECOMMENDED_WEB_SCAN_INTERVAL = 30;
export const DEFAULT_NAVIGATOR10_SETTING_IDS = Object.freeze([
  "4768",
  "4775",
  "4782",
  "4789",
  "4754",
  "13259",
] as const);
export const DEFAULT_NAVIGATOR20_PATHS = Object.freeze([
  "/data/settings.php",
  "/data/heatpump.php",
  "/data/info.php",
  "/data/state.php",
  "/data/status.php",
  "/data/values.php",
] as const);

export class IdmWebError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}
export class IdmWebDependencyError extends IdmWebError {}
export class IdmWebConnectionError extends IdmWebError {}
export class IdmWebTimeoutError extends IdmWebConnectionError {}
export class IdmWebAuthenticationError extends IdmWebError {}
export class IdmWebPinRejectedError extends IdmWebAuthenticationError {}
export class IdmWebCsrfError extends IdmWebAuthenticationError {}
export class IdmWebProtocolError extends IdmWebError {}
export class IdmWebWebSocketError extends IdmWebProtocolError {}
export class IdmWebResponseError extends IdmWebProtocolError {}

export {
  IdmWebAuthenticationError as AuthenticationError,
  IdmWebConnectionError as ConnectionError,
  IdmWebCsrfError as CsrfError,
  IdmWebPinRejectedError as PinRejectedError,
  IdmWebProtocolError as ProtocolError,
  IdmWebTimeoutError as TimeoutError,
  IdmWebWebSocketError as WebSocketError,
};

export type NavigatorWebModel = "Navigator 2.0 Web" | "Navigator 10 Web";

export interface IdmWebValueInput {
  readonly name: string;
  readonly value: string;
  readonly rawKey: string;
  readonly rawDescription?: string;
  readonly unit?: string | null;
  readonly numericValue?: number | null;
}
export interface IdmWebValue {
  readonly name: string;
  readonly value: string;
  readonly rawKey: string;
  readonly rawDescription: string;
  readonly unit: string | null;
  readonly numericValue: number | null;
}
export const IdmWebValue = Object.freeze({
  create(input: IdmWebValueInput): IdmWebValue {
    return Object.freeze({
      name: input.name,
      value: input.value,
      rawKey: input.rawKey,
      rawDescription: input.rawDescription ?? "",
      unit: input.unit ?? null,
      numericValue: input.numericValue ?? null,
    });
  },
});

export interface IdmWebValueDescriptionInput {
  readonly key: string;
  readonly preferredUnit?: string | null;
  readonly deviceClass?: string | null;
  readonly stateClass?: string | null;
  readonly enabledByDefault?: boolean;
}
export interface IdmWebValueDescription {
  readonly key: string;
  readonly preferredUnit: string | null;
  readonly deviceClass: string | null;
  readonly stateClass: string | null;
  readonly enabledByDefault: boolean;
}
export const IdmWebValueDescription = Object.freeze({
  create(input: IdmWebValueDescriptionInput): IdmWebValueDescription {
    return Object.freeze({
      key: input.key,
      preferredUnit: input.preferredUnit ?? null,
      deviceClass: input.deviceClass ?? null,
      stateClass: input.stateClass ?? null,
      enabledByDefault: input.enabledByDefault ?? true,
    });
  },
});

export const WEB_VALUE_DESCRIPTIONS: Readonly<Record<string, IdmWebValueDescription>> =
  Object.freeze({
    flowmeter: IdmWebValueDescription.create({
      key: "flowmeter",
      preferredUnit: "l/min",
      stateClass: "measurement",
    }),
    hotgas_temperature: IdmWebValueDescription.create({
      key: "hotgas_temperature",
      preferredUnit: "°C",
      deviceClass: "temperature",
      stateClass: "measurement",
    }),
    verdamper_pressure: IdmWebValueDescription.create({
      key: "verdamper_pressure",
      preferredUnit: "bar",
      deviceClass: "pressure",
      stateClass: "measurement",
    }),
    condenser_pressure: IdmWebValueDescription.create({
      key: "condenser_pressure",
      preferredUnit: "bar",
      deviceClass: "pressure",
      stateClass: "measurement",
    }),
    board_temperature: IdmWebValueDescription.create({
      key: "board_temperature",
      preferredUnit: "°C",
      deviceClass: "temperature",
      stateClass: "measurement",
    }),
    battery_voltage_central_unit: IdmWebValueDescription.create({
      key: "battery_voltage_central_unit",
      preferredUnit: "V",
      deviceClass: "voltage",
      stateClass: "measurement",
    }),
    software_version: IdmWebValueDescription.create({ key: "software_version" }),
    heatpump_model: IdmWebValueDescription.create({ key: "heatpump_model" }),
    myidm_id: IdmWebValueDescription.create({ key: "myidm_id", enabledByDefault: false }),
    hotwater_tapping_heat_quantity: IdmWebValueDescription.create({
      key: "hotwater_tapping_heat_quantity",
      preferredUnit: "kWh",
      deviceClass: "energy",
      stateClass: "total",
    }),
    hotwater_circulation_heat_quantity: IdmWebValueDescription.create({
      key: "hotwater_circulation_heat_quantity",
      preferredUnit: "kWh",
      deviceClass: "energy",
      stateClass: "total",
    }),
  });

function frozenRecord<T>(input: Readonly<Record<string, T>>): Readonly<Record<string, T>> {
  return Object.freeze(Object.fromEntries(Object.entries(input)));
}

export interface IdmWebDataInput {
  readonly model: NavigatorWebModel;
  readonly values: Readonly<Record<string, IdmWebValue>>;
  readonly rawResponses?: Readonly<Record<string, string>>;
}
export interface IdmWebData {
  readonly model: NavigatorWebModel;
  readonly values: Readonly<Record<string, IdmWebValue>>;
  readonly rawResponses: Readonly<Record<string, string>>;
  readonly simpleValues: Readonly<Record<string, string>>;
  readonly navigatorVersion: string;
  readonly softwareVersion: string | null;
  readonly heatpumpModel: string | null;
  getValue(name: string, defaultValue?: string | null): string | null;
  getNumeric(name: string, defaultValue?: number | null): number | null;
}
export const IdmWebData = Object.freeze({
  create(input: IdmWebDataInput): IdmWebData {
    const values = frozenRecord(input.values);
    const rawResponses = frozenRecord(input.rawResponses ?? {});
    const simpleValues = frozenRecord(
      Object.fromEntries(Object.entries(values).map(([name, value]) => [name, value.value])),
    );
    const getValue = (name: string, defaultValue: string | null = null): string | null =>
      values[name]?.value ?? defaultValue;
    const getNumeric = (name: string, defaultValue: number | null = null): number | null =>
      values[name]?.numericValue ?? defaultValue;
    return Object.freeze({
      model: input.model,
      values,
      rawResponses,
      simpleValues,
      navigatorVersion: input.model.replace(/ Web$/u, ""),
      softwareVersion: values.software_version?.value ?? null,
      heatpumpModel: values.heatpump_model?.value ?? null,
      getValue,
      getNumeric,
    });
  },
});

export interface IdmWebNotificationInput {
  readonly code: string;
  readonly message: string;
  readonly timestamp?: number | null;
  readonly severity?: string | null;
  readonly quitType?: number | null;
  readonly deferrable?: boolean | null;
  readonly raw?: Readonly<Record<string, unknown>>;
}
export interface IdmWebNotification {
  readonly code: string;
  readonly message: string;
  readonly timestamp: number | null;
  readonly severity: string | null;
  readonly quitType: number | null;
  readonly deferrable: boolean | null;
  readonly raw: Readonly<Record<string, unknown>>;
}
export const IdmWebNotification = Object.freeze({
  create(input: IdmWebNotificationInput): IdmWebNotification {
    return Object.freeze({
      code: input.code,
      message: input.message,
      timestamp: input.timestamp ?? null,
      severity: input.severity ?? null,
      quitType: input.quitType ?? null,
      deferrable: input.deferrable ?? null,
      raw: frozenRecord(input.raw ?? {}),
    });
  },
});

export interface IdmWebNotificationsInput {
  readonly current: readonly IdmWebNotification[];
  readonly rawResponse?: string | null;
}
export interface IdmWebNotifications {
  readonly current: readonly IdmWebNotification[];
  readonly rawResponse: string | null;
  readonly count: number;
  readonly summary: string;
}
export const IdmWebNotifications = Object.freeze({
  create(input: IdmWebNotificationsInput): IdmWebNotifications {
    const current = Object.freeze([...input.current]);
    return Object.freeze({
      current,
      rawResponse: input.rawResponse ?? null,
      count: current.length,
      summary:
        current.length === 0
          ? "Keine aktiven Meldungen"
          : current
              .map((item) => (item.code ? `${item.code}: ${item.message}` : item.message))
              .join(" | "),
    });
  },
});

export interface IdmWebDiagnosticsInput {
  readonly navigatorType: string;
  readonly websocketConnected?: boolean;
  readonly webDataEnabled?: boolean;
  readonly firmware?: string | null;
  readonly apiVersion?: string | null;
  readonly model?: string | null;
  readonly serialNumber?: string | null;
  readonly lastSuccessMonotonic?: number | null;
  readonly lastError?: string | null;
  readonly lastReconnectMonotonic?: number | null;
  readonly reconnectAttempts?: number;
  readonly usedEndpoints?: readonly string[];
  readonly cached?: boolean;
}
export interface IdmWebDiagnostics {
  readonly navigatorType: string;
  readonly websocketConnected: boolean;
  readonly webDataEnabled: boolean;
  readonly firmware: string | null;
  readonly apiVersion: string | null;
  readonly model: string | null;
  readonly serialNumber: string | null;
  readonly lastSuccessMonotonic: number | null;
  readonly lastError: string | null;
  readonly lastReconnectMonotonic: number | null;
  readonly reconnectAttempts: number;
  readonly usedEndpoints: readonly string[];
  readonly cached: boolean;
}
export const IdmWebDiagnostics = Object.freeze({
  create(input: IdmWebDiagnosticsInput): IdmWebDiagnostics {
    return Object.freeze({
      navigatorType: input.navigatorType,
      websocketConnected: input.websocketConnected ?? false,
      webDataEnabled: input.webDataEnabled ?? false,
      firmware: input.firmware ?? null,
      apiVersion: input.apiVersion ?? null,
      model: input.model ?? null,
      serialNumber: input.serialNumber ?? null,
      lastSuccessMonotonic: input.lastSuccessMonotonic ?? null,
      lastError: input.lastError ?? null,
      lastReconnectMonotonic: input.lastReconnectMonotonic ?? null,
      reconnectAttempts: input.reconnectAttempts ?? 0,
      usedEndpoints: Object.freeze([...(input.usedEndpoints ?? [])]),
      cached: input.cached ?? false,
    });
  },
});

const SENSOR_NAME_MAP: Readonly<Record<string, string>> = Object.freeze({
  B2: "flowmeter",
  B5: "dewpoint_humidity_alarm",
  B10: "high_pressure_error",
  B15: "failure_eheating",
  B32: "outside_air_temperature",
  B33: "flow_temperature",
  B34: "return_temperature",
  B37: "airsource_temperature",
  B38: "heatstore_temperature",
  B41: "water_temp_bottom",
  B42: "hotwater_temperature",
  B45: "loading_temperature",
  B48: "water_temp_top",
  B51: "flow_temp_HK_A",
  B52: "flow_temp_HK_B",
  B53: "flow_temp_HK_C",
  B54: "flow_temp_HK_D",
  B55: "flow_temp_HK_E",
  B56: "flow_temp_HK_F",
  B57: "flow_temp_HK_G",
  B61: "room_temperature_HK_A",
  B71: "hotgas_temperature",
  B78: "verdamper_pressure",
  B78v: "evaporation_temperature",
  B79: "evaporator_outlet_temperature",
  B86: "condenser_pressure",
  B86v: "condenser_temperature",
  B87: "liquid_line_temperature",
  B108: "hotwater_station_flowmeter",
  B110: "heating_water_outlet_temperature",
  B121: "cold_water_temperature",
  Platinentemperatur: "board_temperature",
  "board temperature": "board_temperature",
  "Batteriespannung Zentraleinheit": "battery_voltage_central_unit",
  "Battery voltage central unit": "battery_voltage_central_unit",
  "Software Version": "software_version",
  myIDMID: "myidm_id",
  Modell: "heatpump_model",
  Model: "heatpump_model",
  Gerätetyp: "heatpump_model",
  Geraetetyp: "heatpump_model",
  "Device type": "heatpump_model",
  Wärmepumpe: "heatpump_model",
  Waermepumpe: "heatpump_model",
  "Heat pump": "heatpump_model",
  Typ: "heatpump_model",
  Type: "heatpump_model",
  "Regler Online": "controller_online_hours",
  "Controller Online": "controller_online_hours",
  "Laufzeit Stufe 1": "runtime_stage_1_hours",
  "Runtime Stage 1": "runtime_stage_1_hours",
  "Schaltzyklen Stufe 1": "switch_cycles_stage_1",
  "Starts Stage 1": "switch_cycles_stage_1",
  "Laufzeit 2.Wärmeerzeuger": "runtime_second_heat_generator_hours",
  "Runtime 2nd Stage": "runtime_second_heat_generator_hours",
  "Schaltzyklen 2.Wärmeerzeuger": "switch_cycles_second_heat_generator",
  "Starts 2nd Stage": "switch_cycles_second_heat_generator",
  "Laufzeit Heizen": "runtime_heating_hours",
  "Runtime Heating": "runtime_heating_hours",
  "Laufzeit Kühlen": "runtime_cooling_hours",
  "Runtime Cooling": "runtime_cooling_hours",
  "Laufzeit Warmwasser": "runtime_hotwater_hours",
  "Runtime Domestic Hot Water": "runtime_hotwater_hours",
  "Laufzeit Abtauen": "runtime_defrosting_hours",
  "Runtime Defrost": "runtime_defrosting_hours",
  "mom./prog. Leistung Heizen": "current_expected_power_heating",
  "mom./prog. Leistung Kühlen": "current_expected_power_cooling",
  "mom./prog. Leistung Vorrang": "current_expected_power_hotwater",
  "Wärmepumpe Aufnahmeleistung": "current_electrical_power",
  "Wärmemenge Zapfung": "hotwater_tapping_heat_quantity",
  "Heat quantity tapping": "hotwater_tapping_heat_quantity",
  "Wärmemenge Zirkulation": "hotwater_circulation_heat_quantity",
  "Heat quantity circulation": "hotwater_circulation_heat_quantity",
});

const SETTING_NAMES = new Map<string, string>([
  ["4775\u0000Externe Anforderung", "external_request"],
  ["4775\u0000external request", "external_request"],
  ["4775\u0000Ext. Umschaltung H/K", "ext_switch_heating_cooling"],
  ["4775\u0000ext. heat/cool switch", "ext_switch_heating_cooling"],
  ["4775\u0000EW/EVU Sperrkontakt", "ew_evu_lock_contact"],
  ["4775\u0000EW/EVU blocking", "ew_evu_lock_contact"],
  ["4775\u0000ext. Vorrangladung", "ext_hotwater_signal"],
  ["4775\u0000ext. priority request", "ext_hotwater_signal"],
  ["4775\u0000B1", "hotwater_station_flow_switch"],
  ["4775\u0000M73", "flow_pump_on"],
  ["4782\u0000M73", "flow_pump_percentage"],
  ["4782\u0000M13", "ventilator_voltage"],
  ["4782\u0000M22", "hotwater_station_pump_percentage"],
  ["4782\u0000M124", "heat_sink_intermediate_circuit_pump_signal"],
  ["4789\u0000M1", "compressor_1"],
  ["4789\u0000M51", "4way_valve_circuit1"],
  ["4789\u0000E32.1", "siphon_heating"],
  ["4789\u0000M13", "ventilator_direction_1"],
  ["4789\u0000E1", "compressor_heating"],
  ["4789\u0000M73", "flow_pump_output"],
  ...Array.from(
    { length: 7 },
    (_, index) =>
      [`4789\u0000M3${index + 1}`, `pump_heating_circuit${String.fromCharCode(65 + index)}`] as [
        string,
        string,
      ],
  ),
  ...Array.from(
    { length: 7 },
    (_, index) =>
      [`4789\u0000M4${index + 1}`, `mixer_heating_circuit${String.fromCharCode(65 + index)}`] as [
        string,
        string,
      ],
  ),
  ["4789\u00002./3. Wärmeerzeuger", "heat_generator_2nd_3rd"],
  ["4789\u00002. Wärmeerzeuger", "heat_generator_2nd"],
  ["4789\u0000M63", "valve_heating_hotwater"],
  ["4789\u0000M64", "hotwater_circulation_pump"],
]);

function unescapeHtml(value: string): string {
  const named: Readonly<Record<string, string>> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);?/giu, (match, entity: string) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return named[entity.toLowerCase()] ?? match;
  });
}

function normalizeLabel(value: string): string {
  return unescapeHtml(value)
    .replace(/\u00a0/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function stripTags(value: string): string {
  return normalizeLabel(value.replace(/<[^>]*>/gu, " "));
}

function parseValue(rawValue: string): {
  readonly value: string;
  readonly numericValue: number | null;
  readonly unit: string | null;
} {
  const value = normalizeLabel(rawValue);
  const match = /^\s*(-?\d+(?:[.,]\d+)?)\s*([A-Za-z°/%]+(?:\/[A-Za-z]+)?)?\s*$/u.exec(value);
  if (match === null) return { value, numericValue: null, unit: null };
  return {
    value,
    numericValue: Number(match[1]?.replace(",", ".")),
    unit: match[2] ?? null,
  };
}

export interface ParseHtmlOptions {
  readonly nameMap?: Readonly<Record<string, string>>;
  readonly sectionId?: string | null;
}

export function parseIdmHtmlTableValues(
  html: string,
  options: ParseHtmlOptions = {},
): Readonly<Record<string, IdmWebValue>> {
  const values: Record<string, IdmWebValue> = Object.create(null);
  for (const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/giu)) {
    const cells = [...(rowMatch[1] ?? "").matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/giu)].map((match) =>
      stripTags(match[1] ?? ""),
    );
    if (cells.length < 2) continue;
    const rawKey = normalizeLabel(cells[0] ?? "");
    const rawDescription = cells.length > 2 ? normalizeLabel(cells[1] ?? "") : "";
    let rawValue = cells.length > 2 ? (cells[2] ?? "") : (cells[1] ?? "");
    const rawUnit = cells.length > 3 ? normalizeLabel(cells[3] ?? "") : "";
    if (rawUnit && /^\s*-?\d+(?:[.,]\d+)?\s*$/u.test(rawValue)) rawValue += rawUnit;
    const lookupKey = rawKey || rawDescription;
    const sectionName =
      options.sectionId === undefined || options.sectionId === null
        ? undefined
        : SETTING_NAMES.get(`${options.sectionId}\u0000${lookupKey}`);
    const name = sectionName ?? options.nameMap?.[lookupKey] ?? SENSOR_NAME_MAP[lookupKey];
    if (name === undefined) continue;
    const parsed = parseValue(rawValue);
    values[name] = IdmWebValue.create({
      name,
      value: parsed.value,
      rawKey: lookupKey,
      rawDescription,
      unit: parsed.unit,
      numericValue: parsed.numericValue,
    });
  }
  return frozenRecord(values);
}

function jsonObject(raw: string, description: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new IdmWebResponseError(`${description} is not valid JSON`);
  }
}

export function parseNavigatorSettingResponse(
  rawResponse: string,
): Readonly<Record<string, IdmWebValue>> {
  const payload = jsonObject(rawResponse, "Navigator 10 setting response");
  const detail = payload.settingDetail;
  if (typeof detail !== "object" || detail === null || Array.isArray(detail))
    throw new IdmWebResponseError("Navigator 10 response does not contain settingDetail");
  const object = detail as Record<string, unknown>;
  if (typeof object.value !== "string")
    throw new IdmWebResponseError("Navigator 10 settingDetail.value is not HTML text");
  return parseIdmHtmlTableValues(object.value, {
    sectionId: object.id === undefined || object.id === null ? null : String(object.id),
  });
}

export function parseNavigatorStatisticResponse(
  rawResponse: string,
  prefix: string,
): Readonly<Record<string, IdmWebValue>> {
  const payload = jsonObject(rawResponse, "Navigator 10 statistic response");
  const detail = payload.statisticDetail;
  if (typeof detail !== "object" || detail === null || Array.isArray(detail))
    throw new IdmWebResponseError("Navigator 10 response does not contain statisticDetail");
  const data = (detail as Record<string, unknown>).data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) return Object.freeze({});
  const values: Record<string, IdmWebValue> = Object.create(null);
  const add = (name: string, value: unknown, rawKey: string): void => {
    values[name] = IdmWebValue.create({ name, value: String(value), rawKey });
  };
  const total = (data as Record<string, unknown>).total;
  if (typeof total === "object" && total !== null && !Array.isArray(total))
    for (const [key, value] of Object.entries(total)) add(`${prefix}_total_${key}`, value, key);
  const yearly = (data as Record<string, unknown>).yearly;
  const latest = Array.isArray(yearly) ? yearly.at(-1) : undefined;
  if (typeof latest === "object" && latest !== null && !Array.isArray(latest))
    for (const [key, value] of Object.entries(latest))
      if (key !== "date" && key !== "idx") add(`${prefix}_current_year_${key}`, value, key);
  return frozenRecord(values);
}

export function parseNavigatorNotificationsResponse(
  rawResponse: string,
  includeRaw = false,
): IdmWebNotifications {
  const payload = jsonObject(rawResponse, "Navigator 10 notification response");
  const notification = payload.notification;
  if (typeof notification !== "object" || notification === null || Array.isArray(notification))
    throw new IdmWebResponseError("Navigator 10 response does not contain notification");
  const current = (notification as Record<string, unknown>).current ?? [];
  if (!Array.isArray(current))
    throw new IdmWebResponseError("Navigator 10 notification.current is not a list");
  return IdmWebNotifications.create({
    current: current.flatMap((value) => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
      const item = value as Record<string, unknown>;
      const text =
        item.text ??
        item.textEnum ??
        item.description ??
        item.descEnum ??
        item.descEnumService ??
        item.title ??
        "";
      const timestamp = item.timestamp ?? item.dateTime;
      return [
        IdmWebNotification.create({
          code: item.code === null || item.code === undefined ? "" : String(item.code),
          message: text === null || text === undefined ? "" : String(text),
          timestamp: Number.isInteger(timestamp) ? (timestamp as number) : null,
          severity: "type" in item ? String(item.type) : null,
          quitType: Number.isInteger(item.quitType) ? (item.quitType as number) : null,
          deferrable: typeof item.deferrable === "boolean" ? item.deferrable : null,
          raw: includeRaw ? item : {},
        }),
      ];
    }),
    rawResponse: includeRaw ? rawResponse : null,
  });
}

export function extractCsrfToken(html: string): string | null {
  const patterns = [
    /<input\b[^>]*\bname=["']csrf_token["'][^>]*\bvalue=["']([^"']+)["']/iu,
    /<input\b[^>]*\bvalue=["']([^"']+)["'][^>]*\bname=["']csrf_token["']/iu,
    /<meta\b[^>]*\bname=["']csrf-token["'][^>]*\bcontent=["']([^"']+)["']/iu,
    /<meta\b[^>]*\bcontent=["']([^"']+)["'][^>]*\bname=["']csrf-token["']/iu,
    /\bcsrf(?:_t|T)oken\s*=\s*["']([^"']+)["']/iu,
  ];
  for (const pattern of patterns) {
    const value = pattern.exec(html)?.[1];
    if (value) return unescapeHtml(value);
  }
  return null;
}

export function looksLikeLoginPage(text: string): boolean {
  const lowered = text.toLowerCase();
  if (!lowered.includes("<html")) return false;
  return (
    (/<form\b/iu.test(text) &&
      /<input\b[^>]*(?:type=["']password["']|name=["'](?:pin|password|pass)["'])/iu.test(text)) ||
    ["login", "pin", "password", "passwort", "csrf"].some((marker) => lowered.includes(marker))
  );
}

export function looksLikeAuthFailure(text: string): boolean {
  const lowered = text.trim().toLowerCase();
  try {
    const payload: unknown = JSON.parse(text);
    if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
      const object = payload as Record<string, unknown>;
      if (object.authorized === false || object.authenticated === false) return true;
      if (["unauthorized", "forbidden", "authentication_failed"].includes(String(object.status)))
        return true;
    }
  } catch {
    // Text response.
  }
  return [
    "authorization required",
    "authentication failed",
    "invalid pin",
    "pin rejected",
    "unauthorized",
    "forbidden",
  ].some((marker) => lowered.includes(marker));
}

export function looksLikeDataResponse(text: string): boolean {
  const stripped = text.trim();
  if (!stripped || looksLikeLoginPage(stripped) || looksLikeAuthFailure(stripped)) return false;
  try {
    const payload: unknown = JSON.parse(stripped);
    if (
      typeof payload === "object" &&
      payload !== null &&
      !Array.isArray(payload) &&
      Object.keys(payload).some((key) =>
        ["error", "errors", "exception"].includes(key.toLowerCase()),
      )
    )
      return false;
  } catch {
    // HTML data response.
  }
  const lowered = stripped.toLowerCase();
  return ["<table", "setting", "heatpump", "value"].some((marker) => lowered.includes(marker));
}

export function formatUrlHost(host: string): string {
  if (!host || host !== host.trim())
    throw new TypeError("Host must not be empty or contain surrounding whitespace");
  if (host.includes("%") || /[/?#@]/u.test(host)) throw new TypeError(`Invalid host: ${host}`);
  if (host.startsWith("[") || host.endsWith("]")) {
    if (!/^\[[0-9a-f:]+\]$/iu.test(host)) throw new TypeError(`Invalid host: ${host}`);
    return host;
  }
  if (host.includes(":")) {
    if (!/^[0-9a-f:]+$/iu.test(host)) throw new TypeError(`Invalid host: ${host}`);
    return `[${host}]`;
  }
  if (
    host.length > 253 ||
    host
      .replace(/\.$/u, "")
      .split(".")
      .some(
        (label) =>
          !label ||
          label.length > 63 ||
          !/^[A-Za-z0-9_](?:[A-Za-z0-9_-]*[A-Za-z0-9_])?$/u.test(label),
      )
  )
    throw new TypeError(`Invalid host: ${host}`);
  return host;
}

export function webPinConfigured(pin: string | null | undefined): boolean {
  return typeof pin === "string" && pin.trim().length > 0;
}
