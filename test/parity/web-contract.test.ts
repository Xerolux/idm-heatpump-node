import { readFileSync } from "node:fs";

import * as webModule from "../../src/web/index.js";
import apiMappingDocument from "../../contracts/api-mapping.json" with { type: "json" };

const web = webModule;
const apiMapping = apiMappingDocument as {
  readonly mappings: readonly {
    readonly export_path: string;
    readonly python_symbol: string;
    readonly status: string;
    readonly typescript_symbol: string;
  }[];
};
import { describe, expect, it } from "vitest";

import {
  IdmNavigator10WebClient,
  IdmNavigator20WebClient,
  IdmWebAuthenticationError,
  IdmWebData,
  IdmWebResponseError,
  IdmWebValue,
  WEB_VALUE_DESCRIPTIONS,
  createOptionalNavigator10WebClient,
  createOptionalNavigator20WebClient,
  webPinConfigured,
  type Navigator10Socket,
  type Navigator20Request,
  type Navigator20Response,
  type Navigator20Session,
} from "../../src/web/index.js";
import {
  extractCsrfToken,
  parseIdmHtmlTableValues,
  parseNavigatorNotificationsResponse,
  parseNavigatorSettingResponse,
  parseNavigatorStatisticResponse,
} from "../../src/web/core.js";

const SENSOR_HTML = `
<table>
<tr><td>B32</td><td>Außentemperatur</td><td>21.7°C</td></tr>
<tr><td>B71</td><td>Heißgastemperatur</td><td>31.0°C</td></tr>
<tr><td>B2</td><td>Durchfluss</td><td>0.0l/min</td></tr>
<tr><td> </td><td>Platinentemperatur</td><td>28.7°C</td></tr>
<tr><td>Modell</td><td></td><td>iDM ALM 6-15</td></tr>
<tr><td>Laufzeit Stufe&nbsp;1</td><td>24.5h</td></tr>
<tr><td></td><td>Wärmemenge Zapfung</td><td>1653.1</td><td>kWh</td></tr>
</table>`;

class FakeSocket implements Navigator10Socket {
  readonly sent: Readonly<Record<string, unknown>>[] = [];
  closed = false;
  readonly #responses: string[];
  constructor(responses: readonly string[]) {
    this.#responses = [...responses];
  }
  async sendJson(payload: Readonly<Record<string, unknown>>): Promise<void> {
    this.sent.push(payload);
  }
  async receiveText(): Promise<string> {
    const value = this.#responses.shift();
    if (value === undefined) throw new Error("script exhausted");
    return value;
  }
  async close(): Promise<void> {
    this.closed = true;
  }
}

class FakeHttpSession implements Navigator20Session {
  readonly requests: Navigator20Request[] = [];
  readonly #responses: Map<string, Navigator20Response[]>;
  constructor(responses: Readonly<Record<string, readonly Navigator20Response[]>>) {
    this.#responses = new Map(Object.entries(responses).map(([key, values]) => [key, [...values]]));
  }
  async request(request: Navigator20Request): Promise<Navigator20Response> {
    this.requests.push(request);
    const response = this.#responses
      .get(`${request.method} ${new URL(request.url).pathname}`)
      ?.shift();
    return response ?? { status: 404, text: "" };
  }
}

describe("generated-source read-only web parity", () => {
  it("parses Python-equivalent tables and immutable value helpers", () => {
    const values = parseIdmHtmlTableValues(SENSOR_HTML);
    expect(values.outside_air_temperature).toMatchObject({ numericValue: 21.7, unit: "°C" });
    expect(values.board_temperature?.value).toBe("28.7°C");
    expect(values.runtime_stage_1_hours?.value).toBe("24.5h");
    expect(values.hotwater_tapping_heat_quantity).toMatchObject({
      value: "1653.1kWh",
      numericValue: 1653.1,
      unit: "kWh",
    });
    const data = IdmWebData.create({ model: "Navigator 10 Web", values });
    expect(data.navigatorVersion).toBe("Navigator 10");
    expect(data.heatpumpModel).toBe("iDM ALM 6-15");
    expect(data.getNumeric("outside_air_temperature")).toBe(21.7);
    expect(data.getValue("missing", "fallback")).toBe("fallback");
    expect(WEB_VALUE_DESCRIPTIONS.flowmeter?.preferredUnit).toBe("l/min");
    expect(Object.isFrozen(data.values)).toBe(true);
  });

  it("parses settings, statistics, notifications and rejects invalid responses", () => {
    const setting = parseNavigatorSettingResponse(
      JSON.stringify({ settingDetail: { id: "4768", value: SENSOR_HTML } }),
    );
    expect(setting.flowmeter?.value).toBe("0.0l/min");
    const digital = parseNavigatorSettingResponse(
      JSON.stringify({
        settingDetail: {
          id: "4789",
          value:
            "<table><tr><td>M1</td><td>Verdichter</td><td>0</td></tr><tr><td>M64</td><td>Zirkulation</td><td>Aus</td></tr></table>",
        },
      }),
    );
    expect(digital.compressor_1?.value).toBe("0");
    expect(digital.hotwater_circulation_pump?.value).toBe("Aus");
    const statistics = parseNavigatorStatisticResponse(
      JSON.stringify({
        statisticDetail: {
          data: {
            total: { heating: 142.98 },
            yearly: [{ date: "2026", idx: 1, heating: 12 }],
          },
        },
      }),
      "runtime",
    );
    expect(statistics.runtime_total_heating?.value).toBe("142.98");
    expect(statistics.runtime_current_year_heating?.value).toBe("12");
    const notifications = parseNavigatorNotificationsResponse(
      JSON.stringify({
        notification: {
          current: [{ code: "E123", textEnum: "RD_EXAMPLE", type: "danger", quitType: 1 }],
        },
      }),
      true,
    );
    expect(notifications.summary).toBe("E123: RD_EXAMPLE");
    expect(notifications.current[0]?.raw.code).toBe("E123");
    expect(() => parseNavigatorSettingResponse("invalid")).toThrow(IdmWebResponseError);
  });

  it("keeps optional factories disabled without a trimmed PIN", () => {
    for (const pin of [null, "", "   "]) {
      expect(webPinConfigured(pin)).toBe(false);
      expect(createOptionalNavigator10WebClient("192.0.2.10", pin)).toBeNull();
      expect(createOptionalNavigator20WebClient("192.0.2.10", pin)).toBeNull();
    }
    expect(createOptionalNavigator10WebClient("192.0.2.10", " 1234 ")).toBeInstanceOf(
      IdmNavigator10WebClient,
    );
    expect(createOptionalNavigator20WebClient("192.0.2.10", " 1234 ")).toBeInstanceOf(
      IdmNavigator20WebClient,
    );
  });

  it("extracts common CSRF variants", () => {
    expect(extractCsrfToken('<input name="csrf_token" value="abc123">')).toBe("abc123");
    expect(extractCsrfToken('<meta name="csrf-token" content="abc123">')).toBe("abc123");
    expect(extractCsrfToken('<script>csrfToken = "abc123"</script>')).toBe("abc123");
    expect(extractCsrfToken("<html>none</html>")).toBeNull();
  });

  it("reads Navigator 10 settings over an injected read-only socket", async () => {
    const socket = new FakeSocket([
      '{"authorized":true}',
      JSON.stringify({ settingDetail: { id: "4768", value: SENSOR_HTML } }),
    ]);
    const urls: string[] = [];
    const client = new IdmNavigator10WebClient("2001:db8::10", "1234", {
      requestDelay: 0,
      socketFactory: async (url) => {
        urls.push(url);
        return socket;
      },
    });
    const data = await client.readData(["4768"]);
    expect(urls).toEqual(["ws://[2001:db8::10]:61220/?auth_code=1234"]);
    expect(data.getValue("flowmeter")).toBe("0.0l/min");
    expect(socket.sent).toEqual([
      { controller: "setting", command: "detail", data: { settingId: "4768" } },
    ]);
    expect(client.diagnostics()).toMatchObject({
      navigatorType: "nav10",
      websocketConnected: true,
      cached: true,
    });
  });

  it("rejects Navigator 10 authentication without retry", async () => {
    const socket = new FakeSocket(['{"authorized":false}']);
    const client = new IdmNavigator10WebClient("192.0.2.10", "bad", {
      socketFactory: async () => socket,
    });
    await expect(client.connect()).rejects.toBeInstanceOf(IdmWebAuthenticationError);
    expect(socket.closed).toBe(true);
  });

  it("logs into Navigator 2.0, reuses probe data and exposes capabilities", async () => {
    const table = "<table><tr><td>B33</td><td>21.5 °C</td></tr></table>";
    const session = new FakeHttpSession({
      "GET /": [{ status: 200, text: '<input name="csrf_token" value="abc">' }],
      "POST /": [{ status: 200, text: "OK" }],
      "GET /data/heatpump.php": [{ status: 200, text: table }],
    });
    const client = new IdmNavigator20WebClient("192.0.2.10", "1234", { session });
    const data = await client.readData(["/data/heatpump.php"], { includeRaw: true });
    expect(data.getValue("flow_temperature")).toBe("21.5 °C");
    expect(
      session.requests.filter((request) => request.url.endsWith("/data/heatpump.php")),
    ).toHaveLength(1);
    expect(client.capabilities()).toMatchObject({ web_data: true, heatpump: true });
    expect(client.diagnostics()).toMatchObject({
      navigatorType: "nav2",
      webDataEnabled: true,
      cached: true,
    });
    expect(session.requests.some((request) => request.headers["CSRF-Token"] === "abc")).toBe(true);
  });

  it("fails closed when Navigator 2.0 returns login pages", async () => {
    const login = '<html><form><input type="password" name="pin"></form></html>';
    const session = new FakeHttpSession({
      "GET /": [{ status: 200, text: login }],
      "POST /": [{ status: 200, text: login }],
      "POST /index.php": [{ status: 200, text: login }],
      "POST /login.php": [{ status: 200, text: login }],
      "GET /data/heatpump.php": [{ status: 200, text: login }],
    });
    const client = new IdmNavigator20WebClient("192.0.2.10", "bad", { session });
    await expect(client.connect()).rejects.toBeInstanceOf(IdmWebAuthenticationError);
  });

  it("freezes value factories", () => {
    expect(Object.isFrozen(IdmWebValue.create({ name: "x", value: "1", rawKey: "X" }))).toBe(true);
  });
});

// ---- Python 2.x web expansion (2.6.0–2.16.1) ----

interface SmokeCase {
  readonly fn: string;
  readonly args: readonly unknown[];
}

const smokeCases = JSON.parse(
  readFileSync(new URL("../fixtures/web-smoke-cases.json", import.meta.url), "utf8"),
) as Record<string, SmokeCase>;

function runCase(testCase: SmokeCase): unknown {
  const fn = (web as unknown as Record<string, unknown>)[testCase.fn];
  if (typeof fn !== "function") {
    throw new Error(`missing export ${testCase.fn}`);
  }
  return (fn as (...args: readonly unknown[]) => unknown)(...testCase.args);
}

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const camel = key.replace(/_([a-z0-9])/gu, (_, character: string) => character.toUpperCase());
    out[camel] = normalizeValue(item);
  }
  return out;
}

describe("web supplement parity (Python 2.x expansion)", () => {
  it("maps every web symbol complete with this evidence file", () => {
    const webRows = apiMapping.mappings.filter((row) => row.export_path === "./web");
    const staged = webRows.filter((row) => row.status !== "complete");
    expect(staged.map((row) => row.python_symbol)).toEqual([]);
    expect(webRows).toHaveLength(84);
  });

  it("decodes the pinned status frame", () => {
    const status = normalizeValue(runCase(smokeCases.status as SmokeCase)) as Record<
      string,
      unknown
    >;
    expect(status).toMatchObject({ jsonVersion: 11, userlevel: 0, language: "de" });
  });

  it("parses defensively: absent keys stay null", () => {
    const defensive = normalizeValue(runCase(smokeCases.status_defensive as SmokeCase)) as Record<
      string,
      unknown
    >;
    expect(defensive.jsonVersion).toBeNull();
    // A payload without the status object is the documented rejection.
    expect(() => runCase(smokeCases.status_missing as SmokeCase)).toThrow(
      /does not contain a status object/,
    );
  });

  it("decodes the freshwater frame with circulation state", () => {
    const freshwater = normalizeValue(runCase(smokeCases.freshwater as SmokeCase)) as Record<
      string,
      unknown
    >;
    expect(freshwater.circulationActive).toBe(true);
  });

  it("decodes home widgets into demand reasons", () => {
    const home = normalizeValue(runCase(smokeCases.home as SmokeCase)) as Record<string, unknown>;
    const reasons = home.demandReasons as readonly Record<string, unknown>[];
    expect(Array.isArray(reasons)).toBe(true);
    expect(reasons.length).toBeGreaterThan(0);
    const multi = normalizeValue(runCase(smokeCases.home_multi_bit as SmokeCase)) as Record<
      string,
      unknown
    >;
    expect(Array.isArray(multi.demandReasons)).toBe(true);
  });

  it("decodes every remaining pinned frame without throwing", () => {
    const covered = new Set([
      "status",
      "status_defensive",
      "status_missing",
      "freshwater",
      "home",
      "home_multi_bit",
      // Rejection paths: danger notes and missing save frames
      // (Python 2.8.0 / defensive parsing).
      "save_danger",
      "save_danger_notext",
      "save_missing",
    ]);
    for (const [name, testCase] of Object.entries(smokeCases)) {
      if (covered.has(name)) continue;
      expect(() => runCase(testCase), name).not.toThrow();
    }
    // The danger note must surface as IdmWebResponseError, never as success.
    expect(() => runCase(smokeCases.save_danger as SmokeCase)).toThrow(
      /Navigator 10 rejected the write/,
    );
  });
});
