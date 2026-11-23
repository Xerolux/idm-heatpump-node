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
export class IdmWebHeatingCircuitUnavailableError extends IdmWebResponseError {
  readonly hcId: string;

  constructor(hcId: string) {
    super(`Navigator 10 heating circuit ${hcId} is unavailable`);
    this.hcId = hcId;
  }
}

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

function temperatureDescription(key: string): IdmWebValueDescription {
  return IdmWebValueDescription.create({
    key,
    preferredUnit: "°C",
    deviceClass: "temperature",
    stateClass: "measurement",
  });
}

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
    flow_temp_HK_A: temperatureDescription("flow_temp_HK_A"),
    flow_temp_HK_B: temperatureDescription("flow_temp_HK_B"),
    flow_temp_HK_C: temperatureDescription("flow_temp_HK_C"),
    flow_temp_HK_D: temperatureDescription("flow_temp_HK_D"),
    flow_temp_HK_E: temperatureDescription("flow_temp_HK_E"),
    flow_temp_HK_F: temperatureDescription("flow_temp_HK_F"),
    flow_temp_HK_G: temperatureDescription("flow_temp_HK_G"),
    room_temperature_HK_A: temperatureDescription("room_temperature_HK_A"),
    room_temperature_HK_B: temperatureDescription("room_temperature_HK_B"),
    room_temperature_HK_C: temperatureDescription("room_temperature_HK_C"),
    room_temperature_HK_D: temperatureDescription("room_temperature_HK_D"),
    room_temperature_HK_E: temperatureDescription("room_temperature_HK_E"),
    room_temperature_HK_F: temperatureDescription("room_temperature_HK_F"),
    room_temperature_HK_G: temperatureDescription("room_temperature_HK_G"),
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
  "B33/B113": "flow_temperature",
  B34: "return_temperature",
  "B34/B114": "return_temperature",
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
  // Heating-circuit room temperatures. Linear sequence B61+i for circuits A-G:
  // B61=A, B62=B, B63=C, B64=D (verified live on a Navigator 10 ALM with
  // circuits A+D), B65=E, B66=F, B67=G.
  B61: "room_temperature_HK_A",
  B62: "room_temperature_HK_B",
  B63: "room_temperature_HK_C",
  B64: "room_temperature_HK_D",
  B65: "room_temperature_HK_E",
  B66: "room_temperature_HK_F",
  B67: "room_temperature_HK_G",
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
  // Navigator 10 sends M125 ("Ladepumpe 1 Zwischenkreis Steuersignal",
  // verified live on an AERO ALM 6-15, T_NAV10_20.24): keep M124 too in
  // case earlier firmware generations label the output that way (#151).
  ["4782\u0000M125", "heat_sink_intermediate_circuit_pump_signal"],
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

// The exact Python `html.entities.html5` table (names without their
// semicolons) plus the legacy subset that may appear without a semicolon.
// Numeric references follow the HTML5 invalid-codepoint replacements of
// CPython's `html.unescape`, including the Windows-1252 repair table.
import htmlEntitiesData from "./html-entities-data.json" with { type: "json" };
const HTML5_ENTITY_NAMES: Readonly<Record<string, string>> = Object.freeze(
  htmlEntitiesData.entities as Record<string, string>,
);
const HTML5_INVALID_CHARREFS: Readonly<Record<string, string>> = Object.freeze(
  htmlEntitiesData.invalid as Record<string, string>,
);
function replaceCharRef(match: string, reference: string): string {
  if (reference.startsWith("#")) {
    const semicolonFree = reference.replace(/;$/u, "");
    const code =
      reference[1] === "x" || reference[1] === "X"
        ? Number.parseInt(semicolonFree.slice(2), 16)
        : Number.parseInt(semicolonFree.slice(1), 10);
    if (Number.isNaN(code)) return match;
    const invalid = HTML5_INVALID_CHARREFS[String(code)];
    if (invalid !== undefined) return invalid;
    if ((code >= 0xd800 && code <= 0xdfff) || code > 0x10ffff) return "\uFFFD";
    return String.fromCodePoint(code);
  }
  const exact = HTML5_ENTITY_NAMES[reference];
  if (exact !== undefined) return exact;
  // Find the longest matching name as defined by the standard.
  for (let length = reference.length - 1; length >= 2; length -= 1) {
    const prefix = HTML5_ENTITY_NAMES[reference.slice(0, length)];
    if (prefix !== undefined) return prefix + reference.slice(length);
  }
  return `&${reference}`;
}

function unescapeHtml(value: string): string {
  return value.replace(/&(#[0-9]+;?|#[xX][0-9a-fA-F]+;?|[^\t\n\f <&#;]{1,32};?)/gu, replaceCharRef);
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new IdmWebResponseError(`${description} is not valid JSON`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new IdmWebResponseError(`${description} is not a JSON object`);
  return parsed as Record<string, unknown>;
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function optionalBool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function optionalStr(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalFloat(value: unknown): number | null {
  if (typeof value === "boolean") return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function optionalNumber(value: unknown): number | null {
  if (typeof value === "boolean") return null;
  return typeof value === "number" ? value : null;
}

function pythonStr(value: unknown): string {
  if (typeof value === "boolean") return value ? "True" : "False";
  if (value === null || value === undefined) return "None";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function pythonFloat(text: string): number | null {
  const parsed = Number(text);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Format a finite number like Python's `%g` (6 significant digits). */
function formatG(value: number): string {
  const precision = 6;
  if (value === 0) return Object.is(value, -0) ? "-0" : "0";
  const negative = value < 0;
  const exponential = Math.abs(value).toExponential(precision - 1);
  const [mantissa, exponentText] = exponential.split("e");
  const exponent = Number(exponentText);
  const digits = (mantissa ?? "0").replace(".", "");
  if (exponent >= -4 && exponent < precision) {
    const point = exponent + 1;
    let text: string;
    if (point <= 0) text = `0.${"0".repeat(-point)}${digits}`;
    else if (digits.length > point) text = `${digits.slice(0, point)}.${digits.slice(point)}`;
    else text = digits.padEnd(point, "0");
    if (text.includes(".")) text = text.replace(/0+$/u, "").replace(/\.$/u, "");
    return negative ? `-${text}` : text;
  }
  const [whole, fraction = ""] = (mantissa ?? "0").split(".");
  const strippedFraction = fraction.replace(/0+$/u, "");
  const scientific = strippedFraction.length > 0 ? `${whole}.${strippedFraction}` : (whole ?? "0");
  const signedExponent =
    exponent < 0
      ? `-${String(-exponent).padStart(2, "0")}`
      : `+${String(exponent).padStart(2, "0")}`;
  return `${negative ? "-" : ""}${scientific}e${signedExponent}`;
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
  const today = (data as Record<string, unknown>).today;
  if (typeof today === "object" && today !== null && !Array.isArray(today))
    for (const [key, value] of Object.entries(today)) {
      if (key === "date" || key === "idx" || key === "typeDict" || key === "groupDict") continue;
      add(`${prefix}_today_${key}`, value, key);
    }
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
  return (
    Object.keys(parseNavigator20Response(stripped)).length > 0 ||
    ["<table", "setting", "heatpump", "value"].some((marker) => lowered.includes(marker))
  );
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

// ---------------------------------------------------------------------------
// Python 2.6.0 → 2.16.1 web expansion: Navigator 10 read frames, demand
// reason decoding, the write (save) response contract and the Navigator 2.0
// JSON statistics schema.
// ---------------------------------------------------------------------------

// Operating-mode values of ``home/save`` — identical to the Modbus
// system_mode register numbering, confirmed frame by frame on a live
// Navigator 10 (jsonVersion 11, September 2026). ``-1`` (unknown) appears in
// the device's option list but is never a write target.
export const NAVIGATOR10_SYSTEM_MODE_STANDBY = 0;
export const NAVIGATOR10_SYSTEM_MODE_AUTOMATIC = 1;
export const NAVIGATOR10_SYSTEM_MODE_AWAY = 2;
export const NAVIGATOR10_SYSTEM_MODE_HOLIDAY = 3;
export const NAVIGATOR10_SYSTEM_MODE_HOT_WATER_ONLY = 4;
export const NAVIGATOR10_SYSTEM_MODE_HEATING_COOLING_ONLY = 5;
export const NAVIGATOR10_WRITABLE_SYSTEM_MODES: readonly number[] = Object.freeze([
  0, 1, 2, 3, 4, 5,
]);

// Domestic-hot-water setpoint (tap temperature). The settings-tree item and
// its system.freshwater parameter alias were confirmed on a live Navigator 10
// (jsonVersion 11, September 2026); the device declares the value range
// itself (30..60 degrees Celsius in increments of 0.5 there) and the write is
// validated against exactly that declaration.
export const NAVIGATOR10_DHW_SETPOINT_SETTING_ID = "13256";
export const NAVIGATOR10_DATETIME_SETTING_ID = "4537";
export const NAVIGATOR10_DHW_SETPOINT_PARAM = "FW030";

// Navigator 10 statistic/detail selectors, verified against a live controller
// (jsonVersion 11, September 2026). ``statisticType`` selects the value block:
// 0 heat-pump runtimes (heating / DHW "priority" / defrost), 2 second-stage
// bivalence runtime, 3 energy-management heat pump, 4 energy-management
// heating element, 5 energy flow, 6 heat quantities (heating / DHW). Type 1
// was reported by the web UI analysis but the controller answers "not
// available" on this firmware. ``periodType`` selects the aggregation: 0 the
// daily history rows, 1 today plus the key dictionary, 7 lifetime totals.
export const NAVIGATOR10_STATISTIC_RUNTIME_HEATPUMP = 0;
export const NAVIGATOR10_STATISTIC_RUNTIME_BIVALENCE = 2;
export const NAVIGATOR10_STATISTIC_EMHP = 3;
export const NAVIGATOR10_STATISTIC_EMEH = 4;
export const NAVIGATOR10_STATISTIC_ENERGY_FLOW = 5;
export const NAVIGATOR10_STATISTIC_HEAT_QUANTITIES = 6;
export const NAVIGATOR10_STATISTIC_PERIOD_DAILY = 0;
export const NAVIGATOR10_STATISTIC_PERIOD_TODAY = 1;
export const NAVIGATOR10_STATISTIC_PERIOD_TOTAL = 7;

// Navigator 10 demand reason tables, decoded from the web UI's JavaScript
// (firmware jsonVersion 11, verified September 2026 against live frames).
// ``operationMode`` selects the table: 1 heating, 4 domestic hot water,
// 0 "no information", 8 "off". The check order is the SPA's priority order;
// the first matching bit wins, and more than one set bit (ignoring bit 0)
// means "more demands". Bit 32 is PV in both tables.
const NAVIGATOR10_HEATING_DEMAND_REASON_TABLE: readonly (readonly [number, string])[] = [
  [2, "no_info"],
  [4, "external_input"],
  [8, "external_bus"],
  [16, "isc"],
  [32, "pv"],
  [64, "frost_protection"],
  [128, "hc_a"],
  [256, "hc_b"],
  [512, "hc_c"],
  [1024, "hc_d"],
  [2048, "hc_e"],
  [4096, "hc_f"],
  [8192, "hc_g"],
  [16384, "system_off"],
  [32768, "ion"],
];
const NAVIGATOR10_DHW_DEMAND_REASON_TABLE: readonly (readonly [number, string])[] = [
  [2, "single_loading"],
  [4, "single_loading_boost"],
  [8, "external_input"],
  [16, "external_bus"],
  [32, "pv"],
  [64, "isc"],
  [128, "schedule"],
  [256, "schedule_boost"],
  [512, "system_off"],
  [1024, "dhw_comfort"],
  [2048, "ion"],
  [4096, "cascade"],
  [8192, "dhw_booster"],
];

function frozenBitRecord(
  table: readonly (readonly [number, string])[],
): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(table.map(([bit, reason]) => [String(bit), reason])),
  ) as Readonly<Record<string, string>>;
}

export const NAVIGATOR10_HEATING_DEMAND_REASON_BITS: Readonly<Record<string, string>> =
  frozenBitRecord(NAVIGATOR10_HEATING_DEMAND_REASON_TABLE);
export const NAVIGATOR10_DHW_DEMAND_REASON_BITS: Readonly<Record<string, string>> = frozenBitRecord(
  NAVIGATOR10_DHW_DEMAND_REASON_TABLE,
);

function bitIsSet(value: number, bit: number): boolean {
  return Math.floor(value / bit) % 2 === 1;
}

function countBitsAboveBitZero(value: number): number {
  let count = 0;
  let rest = Math.floor(value / 2);
  while (rest > 0) {
    count += rest % 2;
    rest = Math.floor(rest / 2);
  }
  return count;
}

export function decodeNavigator10DemandReason(
  operationMode: number | null,
  info: number | null,
): string | null {
  if (operationMode === 0) return "no_info";
  if (operationMode === 8) return "off";
  if (operationMode === null || info === null) return null;
  if (countBitsAboveBitZero(info) > 1) return "more_demands";
  const table =
    operationMode === 1
      ? NAVIGATOR10_HEATING_DEMAND_REASON_TABLE
      : operationMode === 4
        ? NAVIGATOR10_DHW_DEMAND_REASON_TABLE
        : null;
  if (table === null) return null;
  for (const [bit, reason] of table) {
    if (bitIsSet(info, bit)) return reason;
  }
  return null;
}

export interface IdmWebDemandReasonInput {
  readonly path: string;
  readonly operationMode: number | null;
  readonly info: number | null;
  readonly reason: string | null;
}
export interface IdmWebDemandReason {
  readonly path: string;
  readonly operationMode: number | null;
  readonly info: number | null;
  readonly reason: string | null;
}
export const IdmWebDemandReason = Object.freeze({
  create(input: IdmWebDemandReasonInput): IdmWebDemandReason {
    return Object.freeze({ ...input });
  },
});

export interface IdmWebStatusInput {
  readonly jsonVersion?: number | null;
  readonly userlevel?: number | null;
  readonly language?: string | null;
  readonly notificationCount?: number | null;
  readonly timestampMs?: number | null;
  readonly frostProtectionActive?: boolean | null;
  readonly network?: boolean | null;
  readonly authenticationEnabled?: boolean | null;
  readonly rawResponse?: string | null;
}
export interface IdmWebStatus {
  readonly jsonVersion: number | null;
  readonly userlevel: number | null;
  readonly language: string | null;
  readonly notificationCount: number | null;
  readonly timestampMs: number | null;
  readonly frostProtectionActive: boolean | null;
  readonly network: boolean | null;
  readonly authenticationEnabled: boolean | null;
  readonly rawResponse: string | null;
}
export const IdmWebStatus = Object.freeze({
  create(input: IdmWebStatusInput): IdmWebStatus {
    return Object.freeze({
      jsonVersion: input.jsonVersion ?? null,
      userlevel: input.userlevel ?? null,
      language: input.language ?? null,
      notificationCount: input.notificationCount ?? null,
      timestampMs: input.timestampMs ?? null,
      frostProtectionActive: input.frostProtectionActive ?? null,
      network: input.network ?? null,
      authenticationEnabled: input.authenticationEnabled ?? null,
      rawResponse: input.rawResponse ?? null,
    });
  },
});

export function parseNavigatorStatusResponse(
  rawResponse: string,
  includeRaw = false,
): IdmWebStatus {
  const payload = jsonObject(rawResponse, "Navigator 10 status response");
  const status = payload.status;
  if (!isJsonObject(status))
    throw new IdmWebResponseError("Navigator 10 response does not contain a status object");
  const frost = status.frostProtectionInfo;
  const frostActive = isJsonObject(frost) ? optionalBool(frost.active) : null;
  return IdmWebStatus.create({
    jsonVersion: optionalInt(status.jsonVersion),
    userlevel: optionalInt(status.userlevel),
    language: optionalStr(status.language),
    notificationCount: optionalInt(status.notificationCount),
    timestampMs: optionalInt(status.timestamp),
    frostProtectionActive: frostActive,
    network: optionalBool(status.network),
    authenticationEnabled: optionalBool(status.authenticationEnabled),
    rawResponse: includeRaw ? rawResponse : null,
  });
}

function parseFreshwaterTemperature(value: unknown, name: string): IdmWebValue | null {
  if (value === null || value === undefined) return null;
  return IdmWebValue.create({
    name,
    value: pythonStr(value),
    rawKey: name,
    unit: "°C",
    numericValue: pythonFloat(pythonStr(value)),
  });
}

export interface IdmWebFreshwaterInput {
  readonly circulationActive?: boolean | null;
  readonly status?: number | null;
  readonly systemMode?: number | null;
  readonly temperatureTop?: IdmWebValue | null;
  readonly temperatureBottom?: IdmWebValue | null;
  readonly rawResponse?: string | null;
}
export interface IdmWebFreshwater {
  readonly circulationActive: boolean | null;
  readonly status: number | null;
  readonly systemMode: number | null;
  readonly temperatureTop: IdmWebValue | null;
  readonly temperatureBottom: IdmWebValue | null;
  readonly rawResponse: string | null;
}
export const IdmWebFreshwater = Object.freeze({
  create(input: IdmWebFreshwaterInput): IdmWebFreshwater {
    return Object.freeze({
      circulationActive: input.circulationActive ?? null,
      status: input.status ?? null,
      systemMode: input.systemMode ?? null,
      temperatureTop: input.temperatureTop ?? null,
      temperatureBottom: input.temperatureBottom ?? null,
      rawResponse: input.rawResponse ?? null,
    });
  },
});

export function parseNavigatorFreshwaterResponse(
  rawResponse: string,
  includeRaw = false,
): IdmWebFreshwater {
  const payload = jsonObject(rawResponse, "Navigator 10 freshwater response");
  const freshwater = payload.freshwater;
  if (!isJsonObject(freshwater))
    throw new IdmWebResponseError("Navigator 10 response does not contain a freshwater object");
  const circulation = freshwater.circulation;
  const circulationActive = isJsonObject(circulation) ? optionalBool(circulation.active) : null;
  const statusInfo = freshwater.statusInfo;
  const status = isJsonObject(statusInfo) ? optionalInt(statusInfo.status) : null;
  const temperatures = freshwater.temperatures;
  return IdmWebFreshwater.create({
    circulationActive,
    status,
    systemMode: optionalInt(freshwater.systemMode),
    temperatureTop: isJsonObject(temperatures)
      ? parseFreshwaterTemperature(temperatures.top, "freshwater_temp_top")
      : null,
    temperatureBottom: isJsonObject(temperatures)
      ? parseFreshwaterTemperature(temperatures.bottom, "freshwater_temp_bottom")
      : null,
    rawResponse: includeRaw ? rawResponse : null,
  });
}

function parseHomePower(value: unknown, name: string): IdmWebValue | null {
  if (!isJsonObject(value)) return null;
  const raw = value.value;
  if (raw === null || raw === undefined) return null;
  return IdmWebValue.create({
    name,
    value: pythonStr(raw),
    rawKey: name,
    unit: "kW",
    numericValue: pythonFloat(pythonStr(raw)),
  });
}

export interface IdmWebHomeDetailInput {
  readonly demandReasons?: readonly IdmWebDemandReason[];
  readonly pvPower?: IdmWebValue | null;
  readonly gridPower?: IdmWebValue | null;
  readonly rawResponse?: string | null;
}
export interface IdmWebHomeDetail {
  readonly demandReasons: readonly IdmWebDemandReason[];
  readonly pvPower: IdmWebValue | null;
  readonly gridPower: IdmWebValue | null;
  readonly rawResponse: string | null;
  readonly pvDemandActive: boolean;
}
export const IdmWebHomeDetail = Object.freeze({
  create(input: IdmWebHomeDetailInput): IdmWebHomeDetail {
    const demandReasons = Object.freeze([...(input.demandReasons ?? [])]);
    return Object.freeze({
      demandReasons,
      pvPower: input.pvPower ?? null,
      gridPower: input.gridPower ?? null,
      rawResponse: input.rawResponse ?? null,
      pvDemandActive: demandReasons.some((node) => node.reason === "pv"),
    });
  },
});

export function parseNavigatorHomeResponse(
  rawResponse: string,
  includeRaw = false,
): IdmWebHomeDetail {
  const payload = jsonObject(rawResponse, "Navigator 10 home response");
  const demandReasons: IdmWebDemandReason[] = [];
  let pvPower: IdmWebValue | null = null;
  let gridPower: IdmWebValue | null = null;
  const walk = (node: unknown, path: string): void => {
    if (isJsonObject(node)) {
      if ("operationMode" in node || "info" in node) {
        const mode = node.operationMode;
        const info = node.info;
        const modeInt = optionalInt(mode);
        const infoInt = optionalInt(info);
        demandReasons.push(
          IdmWebDemandReason.create({
            path,
            operationMode: modeInt,
            info: infoInt,
            reason: decodeNavigator10DemandReason(modeInt, infoInt),
          }),
        );
      }
      if ("pv" in node && pvPower === null) pvPower = parseHomePower(node.pv, "home_pv_power");
      if ("grid" in node && gridPower === null)
        gridPower = parseHomePower(node.grid, "home_grid_power");
      for (const [key, value] of Object.entries(node)) walk(value, `${path}/${key}`);
    } else if (Array.isArray(node)) {
      for (const [index, value] of node.entries()) walk(value, `${path}[${index}]`);
    }
  };
  walk(payload, "home");
  return IdmWebHomeDetail.create({
    demandReasons,
    pvPower,
    gridPower,
    rawResponse: includeRaw ? rawResponse : null,
  });
}

export interface IdmWebSystemModeInput {
  readonly value?: number | null;
  readonly options?: readonly number[];
  readonly coolingConfigured?: boolean | null;
}
export interface IdmWebSystemMode {
  readonly value: number | null;
  readonly options: readonly number[];
  readonly coolingConfigured: boolean | null;
}
export const IdmWebSystemMode = Object.freeze({
  create(input: IdmWebSystemModeInput): IdmWebSystemMode {
    return Object.freeze({
      value: input.value ?? null,
      options: Object.freeze([...(input.options ?? [])]),
      coolingConfigured: input.coolingConfigured ?? null,
    });
  },
});

export interface IdmWebHomeOverviewInput {
  readonly systemMode?: IdmWebSystemMode | null;
  readonly rawResponse?: string | null;
}
export interface IdmWebHomeOverview {
  readonly systemMode: IdmWebSystemMode | null;
  readonly rawResponse: string | null;
}
export const IdmWebHomeOverview = Object.freeze({
  create(input: IdmWebHomeOverviewInput): IdmWebHomeOverview {
    return Object.freeze({
      systemMode: input.systemMode ?? null,
      rawResponse: input.rawResponse ?? null,
    });
  },
});

export function parseNavigatorHomeOverviewResponse(
  rawResponse: string,
  includeRaw = false,
): IdmWebHomeOverview {
  const payload = jsonObject(rawResponse, "Navigator 10 home/overview response");
  let systemMode: IdmWebSystemMode | null = null;
  const walk = (node: unknown): void => {
    if (systemMode !== null) return;
    if (isJsonObject(node)) {
      const mode = node.systemMode;
      if (isJsonObject(mode) && ("value" in mode || "options" in mode)) {
        const rawOptions = mode.options;
        const options: number[] = [];
        if (Array.isArray(rawOptions)) {
          for (const option of rawOptions) {
            if (!isJsonObject(option)) continue;
            const item = option.value;
            if (typeof item === "number" && Number.isInteger(item)) options.push(item);
          }
        }
        systemMode = IdmWebSystemMode.create({
          value: optionalInt(mode.value),
          options,
          coolingConfigured: optionalBool(mode.coolingConfigured),
        });
        return;
      }
      for (const child of Object.values(node)) walk(child);
    } else if (Array.isArray(node)) {
      for (const child of node) walk(child);
    }
  };
  walk(payload);
  return IdmWebHomeOverview.create({
    systemMode,
    rawResponse: includeRaw ? rawResponse : null,
  });
}

export function parseNavigatorSaveResponse(rawResponse: string, responseKey: string): string {
  const payload = jsonObject(rawResponse, "Navigator 10 save response");
  const block = Object.hasOwn(payload, responseKey) ? payload[responseKey] : undefined;
  if (!isJsonObject(block))
    throw new IdmWebResponseError(`Navigator 10 response does not contain ${responseKey}`);
  const note = block.note;
  const noteType = isJsonObject(note) ? note.type : null;
  const noteText = isJsonObject(note) ? note.text : null;
  if (noteType !== "success") {
    const detail =
      typeof noteText === "string" && noteText.length > 0 ? noteText : pythonStr(noteType);
    throw new IdmWebResponseError(`Navigator 10 rejected the write: ${detail}`);
  }
  return typeof noteText === "string" && noteText.length > 0 ? noteText : "success";
}

export interface IdmWebHeatingCircuitRefInput {
  readonly hcId: string;
  readonly displayName?: string | null;
  readonly mode?: number | null;
}
export interface IdmWebHeatingCircuitRef {
  readonly hcId: string;
  readonly displayName: string | null;
  readonly mode: number | null;
}
export const IdmWebHeatingCircuitRef = Object.freeze({
  create(input: IdmWebHeatingCircuitRefInput): IdmWebHeatingCircuitRef {
    return Object.freeze({
      hcId: input.hcId,
      displayName: input.displayName ?? null,
      mode: input.mode ?? null,
    });
  },
});

export interface IdmWebHeatingCircuitChoiceInput {
  readonly key: number;
  readonly name?: string | null;
}
export interface IdmWebHeatingCircuitChoice {
  readonly key: number;
  readonly name: string | null;
}
export const IdmWebHeatingCircuitChoice = Object.freeze({
  create(input: IdmWebHeatingCircuitChoiceInput): IdmWebHeatingCircuitChoice {
    return Object.freeze({ key: input.key, name: input.name ?? null });
  },
});

export interface IdmWebHeatingCircuitValueInput {
  readonly parameterId: string;
  readonly value?: number | null;
  readonly minValue?: number | null;
  readonly maxValue?: number | null;
  readonly increment?: string | null;
}
export interface IdmWebHeatingCircuitValue {
  readonly parameterId: string;
  readonly value: number | null;
  readonly minValue: number | null;
  readonly maxValue: number | null;
  readonly increment: string | null;
}
export const IdmWebHeatingCircuitValue = Object.freeze({
  create(input: IdmWebHeatingCircuitValueInput): IdmWebHeatingCircuitValue {
    return Object.freeze({
      parameterId: input.parameterId,
      value: input.value ?? null,
      minValue: input.minValue ?? null,
      maxValue: input.maxValue ?? null,
      increment: input.increment ?? null,
    });
  },
});

export interface IdmWebHeatingCircuitInput {
  readonly hcId: string;
  readonly displayName?: string | null;
  readonly modeValue?: number | null;
  readonly modeParameterId?: string | null;
  readonly modeOptions?: readonly IdmWebHeatingCircuitChoice[];
  readonly setpointNormal?: IdmWebHeatingCircuitValue | null;
  readonly setpointEco?: IdmWebHeatingCircuitValue | null;
  readonly roomTemperature?: number | null;
  readonly flowSetpoint?: number | null;
  readonly pumpActive?: boolean | null;
  readonly availableCircuits?: readonly IdmWebHeatingCircuitRef[];
  readonly rawResponse?: string | null;
}
export interface IdmWebHeatingCircuit {
  readonly hcId: string;
  readonly displayName: string | null;
  readonly modeValue: number | null;
  readonly modeParameterId: string | null;
  readonly modeOptions: readonly IdmWebHeatingCircuitChoice[];
  readonly setpointNormal: IdmWebHeatingCircuitValue | null;
  readonly setpointEco: IdmWebHeatingCircuitValue | null;
  readonly roomTemperature: number | null;
  readonly flowSetpoint: number | null;
  readonly pumpActive: boolean | null;
  readonly availableCircuits: readonly IdmWebHeatingCircuitRef[];
  readonly rawResponse: string | null;
}
export const IdmWebHeatingCircuit = Object.freeze({
  create(input: IdmWebHeatingCircuitInput): IdmWebHeatingCircuit {
    return Object.freeze({
      hcId: input.hcId,
      displayName: input.displayName ?? null,
      modeValue: input.modeValue ?? null,
      modeParameterId: input.modeParameterId ?? null,
      modeOptions: Object.freeze([...(input.modeOptions ?? [])]),
      setpointNormal: input.setpointNormal ?? null,
      setpointEco: input.setpointEco ?? null,
      roomTemperature: input.roomTemperature ?? null,
      flowSetpoint: input.flowSetpoint ?? null,
      pumpActive: input.pumpActive ?? null,
      availableCircuits: Object.freeze([...(input.availableCircuits ?? [])]),
      rawResponse: input.rawResponse ?? null,
    });
  },
});

function parseHeatingCircuitValue(block: unknown): IdmWebHeatingCircuitValue | null {
  if (!isJsonObject(block)) return null;
  const parameterId = block.id;
  if (typeof parameterId !== "string" || parameterId.length === 0) return null;
  return IdmWebHeatingCircuitValue.create({
    parameterId,
    value: optionalNumber(block.value),
    minValue: optionalNumber(block.min),
    maxValue: optionalNumber(block.max),
    increment: optionalStr(block.increment),
  });
}

function optionalIntFromNumber(value: unknown): number | null {
  const number = optionalNumber(value);
  return number === null ? null : Math.trunc(number);
}

export function parseNavigatorHeatingcircuitResponse(
  rawResponse: string,
  includeRaw = false,
): IdmWebHeatingCircuit {
  const payload = jsonObject(rawResponse, "Navigator 10 heatingcircuit response");
  const detail = payload.heatingcircuitDetail;
  if (!isJsonObject(detail))
    throw new IdmWebResponseError("Navigator 10 response does not contain heatingcircuitDetail");
  const note = detail.note;
  if (Object.keys(detail).length === 1 && isJsonObject(note) && note.type === "danger") {
    const circuit =
      /^no heating circuit available for specified heating circuit id \[([A-G])\]!$/u.exec(
        typeof note.text === "string" ? note.text : "",
      )?.[1];
    if (circuit !== undefined) throw new IdmWebHeatingCircuitUnavailableError(circuit);
  }
  const hcId = detail.id;
  if (typeof hcId !== "string" || hcId.length === 0)
    throw new IdmWebResponseError("Navigator 10 heatingcircuitDetail carries no id");

  const modeBlock = detail.mode;
  let modeValue: number | null = null;
  let modeParameterId: string | null = null;
  let modeOptions: IdmWebHeatingCircuitChoice[] = [];
  if (isJsonObject(modeBlock)) {
    modeParameterId = optionalStr(modeBlock.id);
    modeValue = optionalIntFromNumber(modeBlock.value);
    const rawTypes = modeBlock.types;
    if (Array.isArray(rawTypes)) {
      modeOptions = rawTypes.flatMap((entry) => {
        if (!isJsonObject(entry)) return [];
        const key = optionalNumber(entry.key);
        if (key === null) return [];
        return [
          IdmWebHeatingCircuitChoice.create({
            key: Math.trunc(key),
            name: optionalStr(entry.name),
          }),
        ];
      });
    }
  }

  const temperatures = detail.temperatures;
  let setpointNormal: IdmWebHeatingCircuitValue | null = null;
  let setpointEco: IdmWebHeatingCircuitValue | null = null;
  if (isJsonObject(temperatures)) {
    const heating = temperatures.heating;
    if (isJsonObject(heating)) {
      setpointNormal = parseHeatingCircuitValue(heating.normal);
      setpointEco = parseHeatingCircuitValue(heating.eco);
    }
  }

  let flowSetpoint: number | null = null;
  if (isJsonObject(temperatures)) {
    const rawSet = temperatures.set;
    if (typeof rawSet === "number") flowSetpoint = rawSet;
    else if (typeof rawSet === "string") flowSetpoint = pythonFloat(rawSet);
  }

  const room = detail.room;
  let roomTemperature: number | null = null;
  if (isJsonObject(room)) {
    const roomTemperatures = room.temperatures;
    if (isJsonObject(roomTemperatures)) {
      const rawActual = roomTemperatures.actual;
      roomTemperature =
        typeof rawActual === "string" ? pythonFloat(rawActual) : optionalNumber(rawActual);
    }
  }

  const available = detail.availableHeatingCircuits;
  let availableCircuits: IdmWebHeatingCircuitRef[] = [];
  if (Array.isArray(available)) {
    availableCircuits = available.flatMap((entry) => {
      if (!isJsonObject(entry)) return [];
      const entryId = entry.id;
      if (typeof entryId !== "string" || entryId.length === 0) return [];
      return [
        IdmWebHeatingCircuitRef.create({
          hcId: entryId,
          displayName: optionalStr(entry.displayName),
          mode: optionalIntFromNumber(entry.mode),
        }),
      ];
    });
  }

  const pump = detail.pumpActive;
  return IdmWebHeatingCircuit.create({
    hcId,
    displayName: optionalStr(detail.displayName),
    modeValue,
    modeParameterId,
    modeOptions,
    setpointNormal,
    setpointEco,
    roomTemperature,
    flowSetpoint,
    pumpActive: optionalBool(pump),
    availableCircuits,
    rawResponse: includeRaw ? rawResponse : null,
  });
}

export interface IdmWebSettingParameterInput {
  readonly settingId: string;
  readonly name?: string | null;
  readonly param?: string | null;
  readonly type?: string | null;
  readonly value?: number | string | null;
  readonly minValue?: number | null;
  readonly maxValue?: number | null;
  readonly increment?: string | null;
  readonly unit?: string | null;
  readonly default?: number | string | boolean | null;
}
export interface IdmWebSettingParameter {
  readonly settingId: string;
  readonly name: string | null;
  readonly param: string | null;
  readonly type: string | null;
  readonly value: number | string | null;
  readonly minValue: number | null;
  readonly maxValue: number | null;
  readonly increment: string | null;
  readonly unit: string | null;
  readonly default: number | string | boolean | null;
}
export const IdmWebSettingParameter = Object.freeze({
  create(input: IdmWebSettingParameterInput): IdmWebSettingParameter {
    return Object.freeze({
      settingId: input.settingId,
      name: input.name ?? null,
      param: input.param ?? null,
      type: input.type ?? null,
      value: input.value ?? null,
      minValue: input.minValue ?? null,
      maxValue: input.maxValue ?? null,
      increment: input.increment ?? null,
      unit: input.unit ?? null,
      default: input.default ?? null,
    });
  },
});

export function parseNavigatorSettingParameter(rawResponse: string): IdmWebSettingParameter {
  const payload = jsonObject(rawResponse, "Navigator 10 setting response");
  const detail = payload.settingDetail;
  if (!isJsonObject(detail))
    throw new IdmWebResponseError("Navigator 10 response does not contain settingDetail");
  const settingId = detail.id;
  if (typeof settingId !== "string" || settingId.length === 0)
    throw new IdmWebResponseError("Navigator 10 settingDetail carries no id");
  const rawValue = detail.value;
  let value: number | string | null;
  if (typeof rawValue === "boolean" || rawValue === null || rawValue === undefined) value = null;
  else if (typeof rawValue === "number") value = rawValue;
  else value = pythonStr(rawValue);
  const rawDefault = detail.def;
  return IdmWebSettingParameter.create({
    settingId,
    name: optionalStr(detail.name),
    param: optionalStr(detail.param),
    type: optionalStr(detail.type),
    value,
    minValue: optionalNumber(detail.min),
    maxValue: optionalNumber(detail.max),
    increment: optionalStr(detail.increment),
    unit: optionalStr(detail.unit),
    default:
      typeof rawDefault === "number" ||
      typeof rawDefault === "string" ||
      typeof rawDefault === "boolean"
        ? rawDefault
        : null,
  });
}

export interface IdmWebPerformanceInput {
  readonly consumptionPower?: number | null;
  readonly consumptionSource?: number | null;
  readonly consumptionBattery?: boolean | null;
  readonly environmentPower?: number | null;
  readonly environmentSource?: number | null;
  readonly environmentTemperatureIn?: number | null;
  readonly productionFlowTemperature?: number | null;
  readonly heatingRod?: boolean | null;
  readonly mode?: number | null;
  readonly systemMode?: number | null;
  readonly rawResponse?: string | null;
}
export interface IdmWebPerformance {
  readonly consumptionPower: number | null;
  readonly consumptionSource: number | null;
  readonly consumptionBattery: boolean | null;
  readonly environmentPower: number | null;
  readonly environmentSource: number | null;
  readonly environmentTemperatureIn: number | null;
  readonly productionFlowTemperature: number | null;
  readonly heatingRod: boolean | null;
  readonly mode: number | null;
  readonly systemMode: number | null;
  readonly rawResponse: string | null;
}
export const IdmWebPerformance = Object.freeze({
  create(input: IdmWebPerformanceInput): IdmWebPerformance {
    return Object.freeze({
      consumptionPower: input.consumptionPower ?? null,
      consumptionSource: input.consumptionSource ?? null,
      consumptionBattery: input.consumptionBattery ?? null,
      environmentPower: input.environmentPower ?? null,
      environmentSource: input.environmentSource ?? null,
      environmentTemperatureIn: input.environmentTemperatureIn ?? null,
      productionFlowTemperature: input.productionFlowTemperature ?? null,
      heatingRod: input.heatingRod ?? null,
      mode: input.mode ?? null,
      systemMode: input.systemMode ?? null,
      rawResponse: input.rawResponse ?? null,
    });
  },
});

function nestedFloat(node: unknown, dictKey: string, valueKey: string): number | null {
  if (!isJsonObject(node)) return null;
  const inner = node[dictKey];
  if (!isJsonObject(inner)) return null;
  return optionalFloat(inner[valueKey]);
}

export function parseNavigatorPerformanceResponse(
  rawResponse: string,
  includeRaw = false,
): IdmWebPerformance {
  const payload = jsonObject(rawResponse, "Navigator 10 performance response");
  const detail = payload.performanceDetail;
  if (!isJsonObject(detail))
    throw new IdmWebResponseError(
      "Navigator 10 response does not contain a performanceDetail object",
    );
  const consumption = detail.consumption;
  const environment = detail.environment;
  const production = detail.production;
  return IdmWebPerformance.create({
    consumptionPower: isJsonObject(consumption) ? optionalFloat(consumption.power) : null,
    consumptionSource: isJsonObject(consumption) ? optionalInt(consumption.source) : null,
    consumptionBattery: isJsonObject(consumption) ? optionalBool(consumption.battery) : null,
    environmentPower: isJsonObject(environment) ? optionalFloat(environment.power) : null,
    environmentSource: isJsonObject(environment) ? optionalInt(environment.source) : null,
    environmentTemperatureIn: nestedFloat(environment, "temperatures", "in"),
    productionFlowTemperature: nestedFloat(production, "temperatures", "flow"),
    heatingRod: optionalBool(detail.heatingRod),
    mode: optionalInt(detail.mode),
    systemMode: optionalInt(detail.systemMode),
    rawResponse: includeRaw ? rawResponse : null,
  });
}

export interface IdmWebWeatherDayInput {
  readonly date?: string | null;
  readonly dayOfWeek?: string | null;
  readonly cloudCover?: number | null;
  readonly rainProbability?: number | null;
  readonly sunSeconds?: number | null;
  readonly symbol?: number | null;
  readonly temperature?: number | null;
  readonly temperatureMin?: number | null;
  readonly temperatureMax?: number | null;
  readonly temperatureAvgLabel?: string | null;
  readonly windSpeedMin?: number | null;
  readonly windSpeedMax?: number | null;
}
export interface IdmWebWeatherDay {
  readonly date: string | null;
  readonly dayOfWeek: string | null;
  readonly cloudCover: number | null;
  readonly rainProbability: number | null;
  readonly sunSeconds: number | null;
  readonly symbol: number | null;
  readonly temperature: number | null;
  readonly temperatureMin: number | null;
  readonly temperatureMax: number | null;
  readonly temperatureAvgLabel: string | null;
  readonly windSpeedMin: number | null;
  readonly windSpeedMax: number | null;
}
export const IdmWebWeatherDay = Object.freeze({
  create(input: IdmWebWeatherDayInput): IdmWebWeatherDay {
    return Object.freeze({
      date: input.date ?? null,
      dayOfWeek: input.dayOfWeek ?? null,
      cloudCover: input.cloudCover ?? null,
      rainProbability: input.rainProbability ?? null,
      sunSeconds: input.sunSeconds ?? null,
      symbol: input.symbol ?? null,
      temperature: input.temperature ?? null,
      temperatureMin: input.temperatureMin ?? null,
      temperatureMax: input.temperatureMax ?? null,
      temperatureAvgLabel: input.temperatureAvgLabel ?? null,
      windSpeedMin: input.windSpeedMin ?? null,
      windSpeedMax: input.windSpeedMax ?? null,
    });
  },
});

export interface IdmWebWeatherDetailInput {
  readonly today?: IdmWebWeatherDay | null;
  readonly forecasts?: readonly IdmWebWeatherDay[];
  readonly rawResponse?: string | null;
}
export interface IdmWebWeatherDetail {
  readonly today: IdmWebWeatherDay | null;
  readonly forecasts: readonly IdmWebWeatherDay[];
  readonly rawResponse: string | null;
}
export const IdmWebWeatherDetail = Object.freeze({
  create(input: IdmWebWeatherDetailInput): IdmWebWeatherDetail {
    return Object.freeze({
      today: input.today ?? null,
      forecasts: Object.freeze([...(input.forecasts ?? [])]),
      rawResponse: input.rawResponse ?? null,
    });
  },
});

function parseWeatherDay(node: unknown): IdmWebWeatherDay {
  if (!isJsonObject(node)) return IdmWebWeatherDay.create({});
  const temperature = node.temperature;
  const wind = node.windSpeed;
  return IdmWebWeatherDay.create({
    date: optionalStr(node.date),
    dayOfWeek: optionalStr(node.dayofweek),
    cloudCover: optionalFloat(node.cloudCover),
    rainProbability: optionalFloat(node.rainProbability),
    sunSeconds: optionalInt(node.sun),
    symbol: optionalInt(node.sym_w50),
    temperature: isJsonObject(temperature) ? optionalFloat(temperature.act) : null,
    temperatureMin: isJsonObject(temperature) ? optionalFloat(temperature.min) : null,
    temperatureMax: isJsonObject(temperature) ? optionalFloat(temperature.max) : null,
    temperatureAvgLabel: isJsonObject(temperature) ? optionalStr(temperature.avg) : null,
    windSpeedMin: isJsonObject(wind) ? optionalFloat(wind.min) : null,
    windSpeedMax: isJsonObject(wind) ? optionalFloat(wind.max) : null,
  });
}

export function parseNavigatorWeatherResponse(
  rawResponse: string,
  includeRaw = false,
): IdmWebWeatherDetail {
  const payload = jsonObject(rawResponse, "Navigator 10 weather response");
  const detail = payload.weatherDetail;
  if (!isJsonObject(detail))
    throw new IdmWebResponseError("Navigator 10 response does not contain a weatherDetail object");
  const forecasts: IdmWebWeatherDay[] = [];
  for (let index = 1; index <= 6; index += 1) {
    const dayNode = detail[`forecast${index}`];
    if (dayNode === null || dayNode === undefined) continue;
    forecasts.push(parseWeatherDay(dayNode));
  }
  const todayNode = detail.today;
  return IdmWebWeatherDetail.create({
    today: todayNode === null || todayNode === undefined ? null : parseWeatherDay(todayNode),
    forecasts,
    rawResponse: includeRaw ? rawResponse : null,
  });
}

export interface IdmWebIonInput {
  readonly active?: boolean | null;
  readonly enabledSettingId?: string | null;
  readonly enabledValue?: number | null;
  readonly subscriptionStatus?: number | null;
  readonly rawResponse?: string | null;
}
export interface IdmWebIon {
  readonly active: boolean | null;
  readonly enabledSettingId: string | null;
  readonly enabledValue: number | null;
  readonly subscriptionStatus: number | null;
  readonly rawResponse: string | null;
}
export const IdmWebIon = Object.freeze({
  create(input: IdmWebIonInput): IdmWebIon {
    return Object.freeze({
      active: input.active ?? null,
      enabledSettingId: input.enabledSettingId ?? null,
      enabledValue: input.enabledValue ?? null,
      subscriptionStatus: input.subscriptionStatus ?? null,
      rawResponse: input.rawResponse ?? null,
    });
  },
});

export function parseNavigatorIonResponse(rawResponse: string, includeRaw = false): IdmWebIon {
  const payload = jsonObject(rawResponse, "Navigator 10 ion response");
  const ion = payload.ion;
  if (!isJsonObject(ion))
    throw new IdmWebResponseError("Navigator 10 response does not contain an ion object");
  const enabled = ion.enabled;
  return IdmWebIon.create({
    active: optionalBool(ion.active),
    enabledSettingId: isJsonObject(enabled) ? optionalStr(enabled.id) : null,
    enabledValue: isJsonObject(enabled) ? optionalInt(enabled.value) : null,
    subscriptionStatus: optionalInt(ion.ionSubscriptionStatus),
    rawResponse: includeRaw ? rawResponse : null,
  });
}

export interface IdmWebEnergyflowInput {
  readonly gridPower?: number | null;
  readonly pvPower?: number | null;
  readonly housePower?: number | null;
  readonly signal?: number | null;
  readonly type?: number | null;
  readonly rawResponse?: string | null;
}
export interface IdmWebEnergyflow {
  readonly gridPower: number | null;
  readonly pvPower: number | null;
  readonly housePower: number | null;
  readonly signal: number | null;
  readonly type: number | null;
  readonly rawResponse: string | null;
}
export const IdmWebEnergyflow = Object.freeze({
  create(input: IdmWebEnergyflowInput): IdmWebEnergyflow {
    return Object.freeze({
      gridPower: input.gridPower ?? null,
      pvPower: input.pvPower ?? null,
      housePower: input.housePower ?? null,
      signal: input.signal ?? null,
      type: input.type ?? null,
      rawResponse: input.rawResponse ?? null,
    });
  },
});

export function parseNavigatorEnergyflowResponse(
  rawResponse: string,
  includeRaw = false,
): IdmWebEnergyflow {
  const payload = jsonObject(rawResponse, "Navigator 10 energyflow response");
  const flow = payload.energyflow;
  if (!isJsonObject(flow))
    throw new IdmWebResponseError("Navigator 10 response does not contain an energyflow object");
  const channelPower = (name: string): number | null => {
    const node = flow[name];
    if (!isJsonObject(node)) return null;
    return optionalFloat(node.value);
  };
  return IdmWebEnergyflow.create({
    gridPower: channelPower("grid"),
    pvPower: channelPower("pv"),
    housePower: channelPower("house"),
    signal: optionalInt(flow.signal),
    type: optionalInt(flow.type),
    rawResponse: includeRaw ? rawResponse : null,
  });
}

export interface IdmWebSystemCircuitInput {
  readonly circuitId: string;
  readonly displayName?: string | null;
  readonly type?: number | null;
  readonly mode?: number | null;
  readonly activeMode?: number | null;
  readonly pumpActive?: boolean | null;
  readonly roomTemperature?: number | null;
  readonly roomSetpoint?: number | null;
  readonly flowTemperature?: number | null;
  readonly flowSetpoint?: number | null;
}
export interface IdmWebSystemCircuit {
  readonly circuitId: string;
  readonly displayName: string | null;
  readonly type: number | null;
  readonly mode: number | null;
  readonly activeMode: number | null;
  readonly pumpActive: boolean | null;
  readonly roomTemperature: number | null;
  readonly roomSetpoint: number | null;
  readonly flowTemperature: number | null;
  readonly flowSetpoint: number | null;
}
export const IdmWebSystemCircuit = Object.freeze({
  create(input: IdmWebSystemCircuitInput): IdmWebSystemCircuit {
    return Object.freeze({
      circuitId: input.circuitId,
      displayName: input.displayName ?? null,
      type: input.type ?? null,
      mode: input.mode ?? null,
      activeMode: input.activeMode ?? null,
      pumpActive: input.pumpActive ?? null,
      roomTemperature: input.roomTemperature ?? null,
      roomSetpoint: input.roomSetpoint ?? null,
      flowTemperature: input.flowTemperature ?? null,
      flowSetpoint: input.flowSetpoint ?? null,
    });
  },
});

export interface IdmWebSystemOverviewInput {
  readonly bufferSystemMode?: number | null;
  readonly bufferHeatingTemperature?: number | null;
  readonly gridPower?: number | null;
  readonly energyflowSignal?: number | null;
  readonly energyflowType?: number | null;
  readonly freshwaterSystemMode?: number | null;
  readonly freshwaterTemperatureTop?: number | null;
  readonly freshwaterTemperatureBottom?: number | null;
  readonly freshwaterCirculationActive?: boolean | null;
  readonly freshwaterStatusInfo?: number | null;
  readonly heatpumpActive?: boolean | null;
  readonly heatpumpSystemMode?: number | null;
  readonly heatpumpOperationMode?: number | null;
  readonly heatpumpFlowTemperature?: number | null;
  readonly heatpumpReturnTemperature?: number | null;
  readonly heatpumpSourceActive?: boolean | null;
  readonly heatpumpSourceType?: number | null;
  readonly heatpumpSourceTemperatureIn?: number | null;
  readonly heatingCircuits?: readonly IdmWebSystemCircuit[];
  readonly rawResponse?: string | null;
}
export interface IdmWebSystemOverview {
  readonly bufferSystemMode: number | null;
  readonly bufferHeatingTemperature: number | null;
  readonly gridPower: number | null;
  readonly energyflowSignal: number | null;
  readonly energyflowType: number | null;
  readonly freshwaterSystemMode: number | null;
  readonly freshwaterTemperatureTop: number | null;
  readonly freshwaterTemperatureBottom: number | null;
  readonly freshwaterCirculationActive: boolean | null;
  readonly freshwaterStatusInfo: number | null;
  readonly heatpumpActive: boolean | null;
  readonly heatpumpSystemMode: number | null;
  readonly heatpumpOperationMode: number | null;
  readonly heatpumpFlowTemperature: number | null;
  readonly heatpumpReturnTemperature: number | null;
  readonly heatpumpSourceActive: boolean | null;
  readonly heatpumpSourceType: number | null;
  readonly heatpumpSourceTemperatureIn: number | null;
  readonly heatingCircuits: readonly IdmWebSystemCircuit[];
  readonly rawResponse: string | null;
}
export const IdmWebSystemOverview = Object.freeze({
  create(input: IdmWebSystemOverviewInput): IdmWebSystemOverview {
    return Object.freeze({
      bufferSystemMode: input.bufferSystemMode ?? null,
      bufferHeatingTemperature: input.bufferHeatingTemperature ?? null,
      gridPower: input.gridPower ?? null,
      energyflowSignal: input.energyflowSignal ?? null,
      energyflowType: input.energyflowType ?? null,
      freshwaterSystemMode: input.freshwaterSystemMode ?? null,
      freshwaterTemperatureTop: input.freshwaterTemperatureTop ?? null,
      freshwaterTemperatureBottom: input.freshwaterTemperatureBottom ?? null,
      freshwaterCirculationActive: input.freshwaterCirculationActive ?? null,
      freshwaterStatusInfo: input.freshwaterStatusInfo ?? null,
      heatpumpActive: input.heatpumpActive ?? null,
      heatpumpSystemMode: input.heatpumpSystemMode ?? null,
      heatpumpOperationMode: input.heatpumpOperationMode ?? null,
      heatpumpFlowTemperature: input.heatpumpFlowTemperature ?? null,
      heatpumpReturnTemperature: input.heatpumpReturnTemperature ?? null,
      heatpumpSourceActive: input.heatpumpSourceActive ?? null,
      heatpumpSourceType: input.heatpumpSourceType ?? null,
      heatpumpSourceTemperatureIn: input.heatpumpSourceTemperatureIn ?? null,
      heatingCircuits: Object.freeze([...(input.heatingCircuits ?? [])]),
      rawResponse: input.rawResponse ?? null,
    });
  },
});

function systemTemperature(node: unknown, key: string): number | null {
  if (!isJsonObject(node)) return null;
  const temperatures = node.temperatures;
  if (!isJsonObject(temperatures)) return null;
  return optionalFloat(temperatures[key]);
}

export function parseNavigatorSystemOverviewResponse(
  rawResponse: string,
  includeRaw = false,
): IdmWebSystemOverview {
  const payload = jsonObject(rawResponse, "Navigator 10 system response");
  const system = payload.system;
  if (!isJsonObject(system))
    throw new IdmWebResponseError("Navigator 10 response does not contain a system object");

  const bufferBlock = system.buffer;
  const bufferSystemMode = isJsonObject(bufferBlock) ? optionalInt(bufferBlock.systemMode) : null;
  const bufferHeatingTemperature = systemTemperature(bufferBlock, "heating");

  const energyflowBlock = system.energyflow;
  let gridPower: number | null = null;
  let energyflowSignal: number | null = null;
  let energyflowType: number | null = null;
  if (isJsonObject(energyflowBlock)) {
    energyflowSignal = optionalInt(energyflowBlock.signal);
    energyflowType = optionalInt(energyflowBlock.type);
    const gridNode = energyflowBlock.grid;
    if (isJsonObject(gridNode)) gridPower = optionalFloat(gridNode.value);
  }

  const freshwaterBlock = system.freshwater;
  let freshwaterCirculationActive: boolean | null = null;
  if (isJsonObject(freshwaterBlock)) {
    const circulation = freshwaterBlock.circulation;
    if (isJsonObject(circulation)) freshwaterCirculationActive = optionalBool(circulation.active);
  }
  let freshwaterStatusInfo: number | null = null;
  if (isJsonObject(freshwaterBlock)) {
    const statusInfo = freshwaterBlock.statusInfo;
    if (isJsonObject(statusInfo)) freshwaterStatusInfo = optionalInt(statusInfo.status);
  }

  const heatpumpBlock = system.heatpump;
  let heatpumpSourceActive: boolean | null = null;
  let heatpumpSourceType: number | null = null;
  let heatpumpSourceTemperatureIn: number | null = null;
  if (isJsonObject(heatpumpBlock)) {
    const source = heatpumpBlock.source;
    if (isJsonObject(source)) {
      heatpumpSourceActive = optionalBool(source.active);
      heatpumpSourceType = optionalInt(source.type);
      heatpumpSourceTemperatureIn = systemTemperature(source, "in");
    }
  }

  const circuits: IdmWebSystemCircuit[] = [];
  const rawCircuits = system.heatingcircuit;
  if (Array.isArray(rawCircuits)) {
    for (const entry of rawCircuits) {
      if (!isJsonObject(entry)) continue;
      const circuitId = entry.id;
      if (typeof circuitId !== "string" || circuitId.length === 0) continue;
      circuits.push(
        IdmWebSystemCircuit.create({
          circuitId,
          displayName: optionalStr(entry.displayName),
          type: optionalInt(entry.type),
          mode: optionalInt(entry.mode),
          activeMode: optionalInt(entry.activeMode),
          pumpActive: optionalBool(entry.pumpActive),
          roomTemperature: systemTemperature(entry.room, "actual"),
          roomSetpoint: systemTemperature(entry.room, "set"),
          flowTemperature: systemTemperature(entry, "actual"),
          flowSetpoint: systemTemperature(entry, "set"),
        }),
      );
    }
  }

  return IdmWebSystemOverview.create({
    bufferSystemMode,
    bufferHeatingTemperature,
    gridPower,
    energyflowSignal,
    energyflowType,
    freshwaterSystemMode: isJsonObject(freshwaterBlock)
      ? optionalInt(freshwaterBlock.systemMode)
      : null,
    freshwaterTemperatureTop: systemTemperature(freshwaterBlock, "top"),
    freshwaterTemperatureBottom: systemTemperature(freshwaterBlock, "bottom"),
    freshwaterCirculationActive,
    freshwaterStatusInfo,
    heatpumpActive: isJsonObject(heatpumpBlock) ? optionalBool(heatpumpBlock.active) : null,
    heatpumpSystemMode: isJsonObject(heatpumpBlock) ? optionalInt(heatpumpBlock.systemMode) : null,
    heatpumpOperationMode: isJsonObject(heatpumpBlock)
      ? optionalInt(heatpumpBlock.operationMode)
      : null,
    heatpumpFlowTemperature: systemTemperature(heatpumpBlock, "flow"),
    heatpumpReturnTemperature: systemTemperature(heatpumpBlock, "return"),
    heatpumpSourceActive,
    heatpumpSourceType,
    heatpumpSourceTemperatureIn,
    heatingCircuits: circuits,
    rawResponse: includeRaw ? rawResponse : null,
  });
}

// Localized category names of the Navigator 2.0 statistics JSON (confirmed
// German and English firmwares); mapped onto the stable English slugs.
const STATISTICS_CATEGORY_NAMES: Readonly<Record<string, string>> = Object.freeze({
  heizen: "heating",
  kühlen: "cooling",
  kühlung: "cooling",
  warmwasser: "hotwater",
  abtauung: "defrost",
  heating: "heating",
  cooling: "cooling",
  "hot water": "hotwater",
  "domestic hot water": "hotwater",
  defrost: "defrost",
});

export function parseNavigator20StatisticsResponse(
  rawResponse: string,
  statType: string,
): Readonly<Record<string, IdmWebValue>> {
  let payload = jsonObject(rawResponse, "Navigator 2.0 statistics response");
  // Version 2 wraps the same totals/units in data; older firmware is flat.
  if (!Object.hasOwn(payload, "total") && isJsonObject(payload.data)) {
    payload = payload.data;
  }
  const unit = payload.unitTotal;
  let factor = 1;
  if (typeof unit === "string") {
    const unitClean = unit
      .trim()
      .replace(/^[" ,]+|[" ,]+$/gu, "")
      .toLowerCase();
    const factors: Readonly<Record<string, number>> = Object.freeze({
      wh: 0.001,
      kwh: 1,
      mwh: 1000,
      gwh: 1_000_000,
      h: 1,
      min: 1 / 60,
    });
    if (unitClean !== "") {
      const scale = Object.hasOwn(factors, unitClean) ? factors[unitClean] : undefined;
      if (scale === undefined) {
        throw new IdmWebResponseError(
          `Navigator 2.0 statistics uses an unknown unitTotal ${JSON.stringify(unit)}`,
        );
      }
      factor = scale;
    }
  }
  const values: Record<string, IdmWebValue> = Object.create(null);
  const total = payload.total;
  if (!Array.isArray(total)) return frozenRecord(values);
  for (const entry of total) {
    if (!isJsonObject(entry)) continue;
    const rawName = entry.name;
    const rawValue = entry.value;
    if (typeof rawName !== "string" || typeof rawValue !== "number" || !Number.isFinite(rawValue))
      continue;
    const category = STATISTICS_CATEGORY_NAMES[rawName.trim().toLowerCase()];
    if (category === undefined) continue;
    const value = rawValue * factor;
    const name = `stat_${statType}_total_${category}`;
    values[name] = IdmWebValue.create({
      name,
      value: formatG(value),
      rawKey: rawName,
      unit: statType === "runtime" ? "h" : "kWh",
      numericValue: value,
    });
  }
  return frozenRecord(values);
}

export function parseNavigator20Response(
  rawResponse: string,
): Readonly<Record<string, IdmWebValue>> {
  const values: Record<string, IdmWebValue> = Object.create(null);
  Object.assign(values, parseIdmHtmlTableValues(rawResponse));
  let payload: unknown;
  try {
    payload = JSON.parse(rawResponse);
  } catch {
    return frozenRecord(values);
  }
  if (!isJsonObject(payload)) return frozenRecord(values);
  // settings.php can wrap its legacy table in a JSON string. Decode that
  // string before parsing so JSON escapes do not become part of labels/units.
  for (const text of Object.values(payload)) {
    if (typeof text === "string" && text.toLowerCase().includes("<table"))
      Object.assign(values, parseIdmHtmlTableValues(text));
  }

  const temperature = (name: string, node: unknown, path: readonly string[]): void => {
    let current: unknown = node;
    for (const component of path) {
      if (!isJsonObject(current)) return;
      current = current[component];
    }
    const numeric = optionalFloat(current);
    if (numeric === null || !Number.isFinite(numeric)) return;
    values[name] = IdmWebValue.create({
      name,
      value: `${formatG(numeric)} °C`,
      rawKey: path.join("."),
      unit: "°C",
      numericValue: numeric,
    });
  };

  temperature("outside_air_temperature", payload, ["out"]);
  temperature("flow_temperature", payload, ["system", "temperatures", "hpout"]);
  temperature("return_temperature", payload, ["system", "temperatures", "hpin"]);
  const circuits = payload.hk;
  if (Array.isArray(circuits)) {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const circuit of circuits) {
      if (!isJsonObject(circuit)) continue;
      const letter = circuit.hk;
      if (typeof letter !== "string" || letter.length !== 1 || !"ABCDEFG".includes(letter))
        continue;
      if (seen.has(letter)) {
        duplicates.add(letter);
        Reflect.deleteProperty(values, `flow_temp_HK_${letter}`);
        Reflect.deleteProperty(values, `room_temperature_HK_${letter}`);
      }
      if (duplicates.has(letter)) continue;
      seen.add(letter);
      temperature(`flow_temp_HK_${letter}`, circuit, ["flow", "temperatures", "act"]);
      temperature(`room_temperature_HK_${letter}`, circuit, ["room", "temperatures", "act"]);
    }
  }
  return frozenRecord(values);
}
