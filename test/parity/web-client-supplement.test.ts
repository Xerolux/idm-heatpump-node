import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  IdmNavigator10WebClient,
  IdmNavigator20WebClient,
  IdmWebConnectionError,
  IdmWebCsrfError,
  IdmWebPinRejectedError,
  IdmWebResponseError,
  IdmWebTimeoutError,
  IdmWebWebSocketError,
  type IdmNavigator10WebClientOptions,
  type Navigator10Socket,
  type Navigator20Request,
  type Navigator20Response,
  type Navigator20Session,
} from "../../src/web/index.js";
import {
  decodeNavigator10DemandReason,
  extractCsrfToken,
  formatUrlHost,
  isJsonObject,
  looksLikeAuthFailure,
  looksLikeDataResponse,
  looksLikeLoginPage,
  parseIdmHtmlTableValues,
  parseNavigator20Response,
  parseNavigator20StatisticsResponse,
  parseNavigatorEnergyflowResponse,
  parseNavigatorFreshwaterResponse,
  parseNavigatorHeatingcircuitResponse,
  parseNavigatorHomeOverviewResponse,
  parseNavigatorHomeResponse,
  parseNavigatorIonResponse,
  parseNavigatorNotificationsResponse,
  parseNavigatorPerformanceResponse,
  parseNavigatorSettingParameter,
  parseNavigatorStatisticResponse,
  parseNavigatorStatusResponse,
  parseNavigatorSystemOverviewResponse,
  parseNavigatorWeatherResponse,
} from "../../src/web/core.js";

// The pinned smoke frames double as scripted device responses: every client
// method is driven with exactly the payload its parser was verified against.
const smokeCases = JSON.parse(
  readFileSync(new URL("../fixtures/web-smoke-cases.json", import.meta.url), "utf8"),
) as Record<string, { readonly fn: string; readonly args: readonly unknown[] }>;

function frame(name: string): string {
  const value = smokeCases[name]?.args?.[0];
  if (typeof value !== "string") throw new Error(`missing smoke frame: ${name}`);
  return value;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

const AUTHORIZED = '{"authorized":true}';
const SETTING_TABLE = "<table><tr><td>B2</td><td>Durchfluss</td><td>0.0l/min</td></tr></table>";
const SETTING_DETAIL_FRAME = JSON.stringify({
  settingDetail: { id: "4768", value: SETTING_TABLE },
});
const NOT_ACCESSIBLE_FRAME = (settingId: string): string =>
  JSON.stringify({ setting: { note: { text: `setting item [${settingId}] is not accessible!` } } });
const SAVE_OK = (key: string, text = "Gespeichert"): string =>
  JSON.stringify({ [key]: { note: { type: "success", text } } });

interface ScriptedSocketOptions {
  readonly failSend?: boolean;
  readonly onSend?: () => void;
  readonly closeAfterReceive?: boolean;
}

class ScriptedSocket implements Navigator10Socket {
  readonly sent: Readonly<Record<string, unknown>>[] = [];
  closed = false;
  readonly #frames: (string | Error)[];
  readonly #options: ScriptedSocketOptions;
  constructor(frames: readonly (string | Error)[], options: ScriptedSocketOptions = {}) {
    this.#frames = [...frames];
    this.#options = options;
  }
  async sendJson(payload: Readonly<Record<string, unknown>>): Promise<void> {
    this.sent.push(payload);
    this.#options.onSend?.();
    if (this.#options.failSend === true) throw new Error("websocket send failed");
  }
  async receiveText(): Promise<string> {
    const next = this.#frames.shift();
    if (next === undefined) throw new Error("script exhausted");
    if (next instanceof Error) throw next;
    if (this.#options.closeAfterReceive === true) this.closed = true;
    return next;
  }
  async close(): Promise<void> {
    this.closed = true;
  }
}

function nav10Client(
  frames: readonly (string | Error)[],
  options: Partial<IdmNavigator10WebClientOptions> = {},
): { readonly client: IdmNavigator10WebClient; readonly socket: ScriptedSocket } {
  const socket = new ScriptedSocket(frames);
  const client = new IdmNavigator10WebClient("192.0.2.10", "1234", {
    requestDelay: 0,
    reconnectBaseDelay: 0,
    socketFactory: async () => socket,
    ...options,
  });
  return { client, socket };
}

// ---------------------------------------------------------------------------
// Navigator 10 read methods over the injected websocket seam
// ---------------------------------------------------------------------------

interface ReadMethodCase {
  readonly name: string;
  readonly controller: string;
  readonly command: string;
  readonly frameName: string;
  readonly call: (client: IdmNavigator10WebClient) => Promise<unknown>;
  readonly check: (result: unknown) => void;
}

const READ_METHOD_CASES: readonly ReadMethodCase[] = [
  {
    name: "readStatusOverview",
    controller: "status",
    command: "overview",
    frameName: "status",
    call: (client) => client.readStatusOverview({ includeRaw: true }),
    check: (result) => {
      expect(asRecord(result).jsonVersion).toBe(11);
      expect(asRecord(result).language).toBe("de");
    },
  },
  {
    name: "readHomeDetail",
    controller: "home",
    command: "detail",
    frameName: "home",
    call: (client) => client.readHomeDetail({ includeRaw: true }),
    check: (result) => {
      const detail = asRecord(result);
      expect(detail.demandReasons).toHaveLength(4);
      expect(detail.pvDemandActive).toBe(true);
      expect(asRecord(detail.pvPower).numericValue).toBe(5900);
      expect(asRecord(detail.gridPower).numericValue).toBe(-123.5);
    },
  },
  {
    name: "readPerformance",
    controller: "system.heatpump.performance",
    command: "detail",
    frameName: "performance",
    call: (client) => client.readPerformance({ includeRaw: true }),
    check: (result) => {
      expect(asRecord(result).consumptionPower).toBe(2.15);
      expect(asRecord(result).environmentTemperatureIn).toBe(3.4);
    },
  },
  {
    name: "readWeather",
    controller: "weather",
    command: "detail",
    frameName: "weather",
    call: (client) => client.readWeather({ includeRaw: true }),
    check: (result) => {
      expect(asRecord(asRecord(result).today).temperature).toBe(8.5);
      expect(asRecord(result).forecasts).toHaveLength(2);
    },
  },
  {
    name: "readIon",
    controller: "ion",
    command: "overview",
    frameName: "ion",
    call: (client) => client.readIon({ includeRaw: true }),
    check: (result) => {
      expect(asRecord(result).active).toBe(true);
      expect(asRecord(result).enabledSettingId).toBe("CE001");
    },
  },
  {
    name: "readEnergyflow",
    controller: "energyflow",
    command: "overview",
    frameName: "energyflow",
    call: (client) => client.readEnergyflow({ includeRaw: true }),
    check: (result) => {
      expect(asRecord(result).pvPower).toBe(5900);
      expect(asRecord(result).signal).toBe(2);
    },
  },
  {
    name: "readSystemOverview",
    controller: "system",
    command: "overview",
    frameName: "system_overview",
    call: (client) => client.readSystemOverview({ includeRaw: true }),
    check: (result) => {
      expect(asRecord(result).gridPower).toBe(-123.5);
      expect(asRecord(result).heatingCircuits).toHaveLength(1);
    },
  },
  {
    name: "readHomeOverview",
    controller: "home",
    command: "overview",
    frameName: "home_overview",
    call: (client) => client.readHomeOverview({ includeRaw: true }),
    check: (result) => {
      expect(asRecord(asRecord(result).systemMode).value).toBe(1);
    },
  },
  {
    name: "readFreshwaterOverview",
    controller: "system.freshwater",
    command: "overview",
    frameName: "freshwater",
    call: (client) => client.readFreshwaterOverview({ includeRaw: true }),
    check: (result) => {
      expect(asRecord(result).circulationActive).toBe(true);
      expect(asRecord(asRecord(result).temperatureTop).numericValue).toBe(47.5);
    },
  },
];

describe("Navigator 10 web client methods (scripted frames)", () => {
  for (const method of READ_METHOD_CASES) {
    it(`${method.name} requests and decodes the pinned frame`, async () => {
      const { client, socket } = nav10Client([AUTHORIZED, frame(method.frameName)]);
      const result = await method.call(client);
      expect(socket.sent).toEqual([{ controller: method.controller, command: method.command }]);
      expect(asRecord(result).rawResponse).toBe(frame(method.frameName));
      method.check(result);
    });
  }

  it("omits rawResponse when includeRaw is not requested", async () => {
    const { client } = nav10Client([AUTHORIZED, frame("ion")]);
    const ion = await client.readIon();
    expect(asRecord(ion).rawResponse).toBeNull();
    expect(asRecord(ion).active).toBe(true);
  });

  it("reads notifications with and without raw evidence", async () => {
    const notificationsFrame = JSON.stringify({
      notification: {
        current: [
          {
            code: "E123",
            textEnum: "RD_EXAMPLE",
            type: "danger",
            quitType: 1,
            timestamp: 1764000000,
          },
          { description: "no code entry" },
          "garbage entry",
        ],
      },
    });
    const withRaw = nav10Client([AUTHORIZED, notificationsFrame]);
    const notifications = await withRaw.client.readNotifications({ includeRaw: true });
    expect(notifications.count).toBe(2);
    expect(notifications.summary).toBe("E123: RD_EXAMPLE | no code entry");
    expect(asRecord(notifications.current[0]).raw).toMatchObject({ code: "E123" });
    expect(notifications.rawResponse).toBe(notificationsFrame);
    expect(asRecord(notifications.current[1]).severity).toBeNull();
    expect(asRecord(notifications.current[1]).code).toBe("");
    const withoutRaw = nav10Client([AUTHORIZED, notificationsFrame]);
    const plain = await withoutRaw.client.readNotifications();
    expect(plain.rawResponse).toBeNull();
    expect(asRecord(plain.current[0]).raw).toEqual({});
    expect(withoutRaw.socket.sent).toEqual([{ controller: "notification", command: "overview" }]);
  });

  it("reads statistics with the selector payload and raw evidence", async () => {
    const statisticFrame = JSON.stringify({
      statisticDetail: {
        data: {
          total: { heating: 142.98 },
          yearly: [{ date: "2026", idx: 1, heating: 12 }],
          today: { date: "x", idx: 2, typeDict: {}, groupDict: {}, heating: 1.5 },
        },
      },
    });
    const { client, socket } = nav10Client([AUTHORIZED, statisticFrame]);
    const data = await client.readStatistics(6, 7, "runtime", { includeRaw: true });
    expect(socket.sent).toEqual([
      {
        controller: "statistic",
        command: "detail",
        data: { statisticType: 6, periodType: 7, statisticSubType: null },
      },
    ]);
    expect(data.getValue("runtime_total_heating")).toBe("142.98");
    expect(data.getValue("runtime_current_year_heating")).toBe("12");
    expect(data.getValue("runtime_today_heating")).toBe("1.5");
    expect(data.rawResponses["statistic:6:7"]).toBe(statisticFrame);
  });

  it("reads a heating circuit and normalizes its id", async () => {
    const { client, socket } = nav10Client([AUTHORIZED, frame("heatingcircuit")]);
    const circuit = await client.readHeatingcircuit(" a ");
    expect(socket.sent).toEqual([
      {
        controller: "system.heatingcircuit",
        command: "detail",
        data: { hcId: "A" },
      },
    ]);
    expect(asRecord(circuit).hcId).toBe("A");
    expect(asRecord(circuit).modeValue).toBe(1);
    expect(asRecord(asRecord(circuit).setpointNormal).minValue).toBe(10);
    expect(asRecord(circuit).roomTemperature).toBe(21.3);
    expect(asRecord(circuit).availableCircuits).toHaveLength(2);
    await expect(client.readHeatingcircuit("   ")).rejects.toThrow(TypeError);
  });

  it("reads a setting parameter and trims its id", async () => {
    const { client, socket } = nav10Client([AUTHORIZED, frame("setting_parameter")]);
    const parameter = await client.readSettingParameter(" 13256 ");
    expect(socket.sent).toEqual([
      { controller: "setting", command: "detail", data: { settingId: "13256" } },
    ]);
    expect(asRecord(parameter).param).toBe("FW030");
    expect(asRecord(parameter).minValue).toBe(30);
    expect(asRecord(parameter).value).toBe(47.5);
    await expect(client.readSettingParameter(" ")).rejects.toThrow(TypeError);
    const bad = nav10Client([AUTHORIZED, frame("setting_parameter_bad_value")]);
    const decoded = await bad.client.readSettingParameter("1");
    expect(asRecord(decoded).value).toBeNull();
  });

  it("reads setting sections and skips firmware-optional ones", async () => {
    const { client, socket } = nav10Client([
      AUTHORIZED,
      SETTING_DETAIL_FRAME,
      NOT_ACCESSIBLE_FRAME("9999"),
    ]);
    const data = await client.readData(["4768", "9999"], { includeRaw: true });
    expect(data.getValue("flowmeter")).toBe("0.0l/min");
    expect(data.rawResponses["setting:4768"]).toBe(SETTING_DETAIL_FRAME);
    expect(socket.sent).toHaveLength(2);
  });

  it("rejects readData when no section is accessible or payloads are malformed", async () => {
    const inaccessible = nav10Client([AUTHORIZED, NOT_ACCESSIBLE_FRAME("9999")]);
    await expect(inaccessible.client.readData(["9999"])).rejects.toThrow(
      /no accessible setting sections/,
    );
    const mismatched = nav10Client([
      AUTHORIZED,
      JSON.stringify({ setting: { note: { text: "different note" } } }),
    ]);
    await expect(mismatched.client.readData(["9999"])).rejects.toThrow(IdmWebResponseError);
    const notJson = nav10Client([AUTHORIZED, "not-json"]);
    await expect(notJson.client.readData(["9999"])).rejects.toThrow(/not valid JSON/);
  });

  it("paces multi-section reads with the configured delay", async () => {
    const sleeps: number[] = [];
    const { client } = nav10Client(
      [AUTHORIZED, SETTING_DETAIL_FRAME, SETTING_DETAIL_FRAME, SETTING_DETAIL_FRAME],
      {
        requestDelay: 1.5,
        sleep: async (seconds) => {
          sleeps.push(seconds);
        },
      },
    );
    await client.readData(["4768", "4768", "4768"]);
    expect(sleeps).toEqual([1.5, 1.5]);
    const single = nav10Client([AUTHORIZED, SETTING_DETAIL_FRAME], {
      requestDelay: 1,
      sleep: async (seconds) => {
        sleeps.push(seconds);
      },
    });
    await single.client.readData(["4768"]);
    expect(sleeps).toHaveLength(2);
  });

  it("keeps the last read cached for diagnostics", async () => {
    const { client } = nav10Client([AUTHORIZED, SETTING_DETAIL_FRAME]);
    const data = await client.readData(["4768"]);
    expect(client.getCachedData()?.getValue("flowmeter")).toBe(data.getValue("flowmeter"));
  });
});

// ---------------------------------------------------------------------------
// Navigator 10 write methods
// ---------------------------------------------------------------------------

describe("Navigator 10 web client writes (scripted frames)", () => {
  it("sets the system mode and validates it first", async () => {
    const { client, socket } = nav10Client([AUTHORIZED, SAVE_OK("homeSave")]);
    await client.setSystemMode(2);
    expect(socket.sent).toEqual([
      { controller: "home", command: "save", data: { systemMode: { value: 2 } } },
    ]);
    await expect(client.setSystemMode(9)).rejects.toThrow(/mode must be one of/);
    await expect(client.setSystemMode(1.5)).rejects.toThrow(/mode must be one of/);
    await expect(client.setSystemMode("1" as unknown as number)).rejects.toThrow(TypeError);
  });

  it("surfaces rejected writes as response errors", async () => {
    const danger = nav10Client([
      AUTHORIZED,
      JSON.stringify({ homeSave: { note: { type: "danger", text: "Mode rejected" } } }),
    ]);
    await expect(danger.client.setSystemMode(1)).rejects.toThrow(
      /Navigator 10 rejected the write: Mode rejected/,
    );
    const missing = nav10Client([AUTHORIZED, "{}"]);
    await expect(missing.client.setSystemMode(1)).rejects.toThrow(/does not contain homeSave/);
    const notJson = nav10Client([AUTHORIZED, "<html>"]);
    await expect(notJson.client.setSystemMode(1)).rejects.toThrow(IdmWebResponseError);
  });

  it("acknowledges all notifications", async () => {
    const { client, socket } = nav10Client([AUTHORIZED, SAVE_OK("notificationSave", "")]);
    await client.acknowledgeAllNotifications();
    expect(socket.sent).toEqual([
      { controller: "notification", command: "save", data: { quitAll: true } },
    ]);
  });

  it("acknowledges a single notification and validates the code", async () => {
    const { client, socket } = nav10Client([AUTHORIZED, SAVE_OK("notificationSave")]);
    await client.acknowledgeNotification(" E123 ", true);
    expect(socket.sent).toEqual([
      {
        controller: "notification",
        command: "save",
        data: { code: "E123", remindMeLater: true },
      },
    ]);
    await expect(client.acknowledgeNotification("  ")).rejects.toThrow(TypeError);
  });

  it("saves a freshwater parameter against the device declaration", async () => {
    const { client, socket } = nav10Client([
      AUTHORIZED,
      frame("setting_parameter"),
      SAVE_OK("freshwaterSave"),
    ]);
    await client.saveFreshwaterParameter("FW030", 47.5, { settingId: "13256" });
    expect(socket.sent).toEqual([
      { controller: "setting", command: "detail", data: { settingId: "13256" } },
      {
        controller: "system.freshwater",
        command: "save",
        data: { parameterId: "FW030", value: 47.5 },
      },
    ]);
  });

  it("rejects freshwater writes that contradict the declaration", async () => {
    const mismatch = nav10Client([AUTHORIZED, frame("setting_parameter")]);
    await expect(
      mismatch.client.saveFreshwaterParameter("FW999", 47.5, { settingId: "13256" }),
    ).rejects.toThrow(/is parameter FW030, not FW999/);
    const tooLow = nav10Client([AUTHORIZED, frame("setting_parameter")]);
    await expect(
      tooLow.client.saveFreshwaterParameter("FW030", 10, { settingId: "13256" }),
    ).rejects.toThrow(/below the device-declared minimum/);
    const tooHigh = nav10Client([AUTHORIZED, frame("setting_parameter")]);
    await expect(
      tooHigh.client.saveFreshwaterParameter("FW030", 90, { settingId: "13256" }),
    ).rejects.toThrow(/above the device-declared maximum/);
    const unchecked = nav10Client([AUTHORIZED, SAVE_OK("freshwaterSave")]);
    await unchecked.client.saveFreshwaterParameter("FW030", 90, { settingId: null });
    expect(unchecked.socket.sent).toHaveLength(1);
    const invalid = nav10Client([AUTHORIZED]);
    await expect(invalid.client.saveFreshwaterParameter("FW030", Number.NaN)).rejects.toThrow(
      TypeError,
    );
    await expect(invalid.client.saveFreshwaterParameter(" ", 1)).rejects.toThrow(TypeError);
  });

  it("saves the DHW setpoint through the declared setting", async () => {
    const { client, socket } = nav10Client([
      AUTHORIZED,
      frame("setting_parameter"),
      SAVE_OK("freshwaterSave"),
    ]);
    await client.saveDhwSetpoint(48);
    expect(socket.sent).toEqual([
      { controller: "setting", command: "detail", data: { settingId: "13256" } },
      {
        controller: "system.freshwater",
        command: "save",
        data: { parameterId: "FW030", value: 48 },
      },
    ]);
  });

  it("sets the clock and validates the input date", async () => {
    const { client, socket } = nav10Client([AUTHORIZED, SAVE_OK("settingSave")]);
    const when = new Date("2026-11-21T10:30:00.000Z");
    await client.setDatetime(when);
    expect(socket.sent).toEqual([
      {
        controller: "setting",
        command: "save",
        data: { settingId: "4537", value: when.toISOString() },
      },
    ]);
    await expect(client.setDatetime(new Date(Number.NaN))).rejects.toThrow(TypeError);
    await expect(client.setDatetime("soon" as unknown as Date)).rejects.toThrow(TypeError);
    const danger = nav10Client([
      AUTHORIZED,
      JSON.stringify({ settingSave: { note: { type: "danger" } } }),
    ]);
    await expect(danger.client.setDatetime(when)).rejects.toThrow(/rejected the write: danger/);
  });

  it("saves heating-circuit parameters with local bounds", async () => {
    const { client, socket } = nav10Client([AUTHORIZED, SAVE_OK("heatingcircuitSave")]);
    await client.saveHeatingcircuitParameter("HKA04", 21.5, { minValue: 10, maxValue: 30 });
    expect(socket.sent).toEqual([
      {
        controller: "system.heatingcircuit",
        command: "save",
        data: { parameterId: "HKA04", value: 21.5 },
      },
    ]);
    const tooLow = nav10Client([AUTHORIZED]);
    await expect(
      tooLow.client.saveHeatingcircuitParameter("HKA04", 5, { minValue: 10 }),
    ).rejects.toThrow(/below the device-declared minimum/);
    const tooHigh = nav10Client([AUTHORIZED]);
    await expect(
      tooHigh.client.saveHeatingcircuitParameter("HKA04", 50, { maxValue: 30 }),
    ).rejects.toThrow(/above the device-declared maximum/);
    const invalid = nav10Client([AUTHORIZED]);
    await expect(
      invalid.client.saveHeatingcircuitParameter("HKA04", Number.POSITIVE_INFINITY),
    ).rejects.toThrow(TypeError);
    await expect(invalid.client.saveHeatingcircuitParameter("", 1)).rejects.toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// Navigator 10 transport behaviour: reconnects, guards, native socket
// ---------------------------------------------------------------------------

describe("Navigator 10 web client transport behaviour", () => {
  it("validates constructor options", () => {
    expect(() => new IdmNavigator10WebClient("192.0.2.10", "")).toThrow(TypeError);
    expect(() => new IdmNavigator10WebClient("192.0.2.10", "1", { port: 0 })).toThrow(
      /Port must be between/,
    );
    expect(() => new IdmNavigator10WebClient("192.0.2.10", "1", { port: 70_000 })).toThrow(
      /Port must be between/,
    );
    expect(() => new IdmNavigator10WebClient("192.0.2.10", "1", { timeout: Number.NaN })).toThrow(
      /timeout/,
    );
    expect(
      () => new IdmNavigator10WebClient("192.0.2.10", "1", { reconnectBaseDelay: -1 }),
    ).not.toThrow();
    const fullyConfigured = new IdmNavigator10WebClient("example.com", "1", {
      port: 61221,
      timeout: 4,
      requestDelay: 0,
      reconnectBaseDelay: 0,
      reconnectMaxDelay: 1,
      maxReconnectAttempts: 2,
      socketFactory: async () => new ScriptedSocket([AUTHORIZED]),
      now: () => 0,
      sleep: () => Promise.resolve(),
    });
    expect(fullyConfigured.modelName).toBe("Navigator 10");
  });

  it("maps authorization frame variants", async () => {
    const notJson = nav10Client(["oops"]);
    await expect(notJson.client.connect()).rejects.toThrow(IdmWebWebSocketError);
    const array = nav10Client(["[1,2]"]);
    await expect(array.client.connect()).rejects.toThrow(
      /authorization response was not recognized/,
    );
    const weird = nav10Client(['{"authorized":"yes"}']);
    await expect(weird.client.connect()).rejects.toThrow(
      /authorization response was not recognized/,
    );
    const timeout = nav10Client([new IdmWebTimeoutError("too slow")]);
    await expect(timeout.client.connect()).rejects.toBeInstanceOf(IdmWebTimeoutError);
    const factoryFailure = new IdmNavigator10WebClient("192.0.2.10", "1234", {
      socketFactory: async () => {
        throw new Error("no route to host");
      },
    });
    await expect(factoryFailure.connect()).rejects.toThrow(IdmWebWebSocketError);
  });

  it("recovers a read after a transient websocket failure", async () => {
    const bad = new ScriptedSocket([AUTHORIZED, new Error("transient failure")]);
    const good = new ScriptedSocket([AUTHORIZED, SETTING_DETAIL_FRAME]);
    const sockets = [bad, good];
    let index = 0;
    const client = new IdmNavigator10WebClient("192.0.2.10", "1234", {
      requestDelay: 0,
      reconnectBaseDelay: 0,
      socketFactory: async () => sockets[index++] ?? good,
    });
    const data = await client.readData(["4768"]);
    expect(data.getValue("flowmeter")).toBe("0.0l/min");
    expect(bad.closed).toBe(true);
    expect(client.diagnostics()).toMatchObject({ websocketConnected: true, lastError: null });
  });

  it("reopens a socket that reports itself closed after authorizing", async () => {
    const flaky = new ScriptedSocket([AUTHORIZED], { closeAfterReceive: true });
    const good = new ScriptedSocket([AUTHORIZED, frame("weather")]);
    const sockets = [flaky, good];
    let index = 0;
    const client = new IdmNavigator10WebClient("192.0.2.10", "1234", {
      requestDelay: 0,
      reconnectBaseDelay: 0,
      socketFactory: async () => sockets[index++] ?? good,
    });
    const weather = await client.readWeather();
    expect(asRecord(weather).forecasts).toHaveLength(2);
  });

  it("never replays an uncertain write", async () => {
    const socket = new ScriptedSocket([AUTHORIZED, new Error("died mid-save")]);
    const client = new IdmNavigator10WebClient("192.0.2.10", "1234", {
      requestDelay: 0,
      socketFactory: async () => socket,
    });
    await expect(client.setDatetime(new Date("2026-11-21T10:30:00.000Z"))).rejects.toThrow(
      /write outcome is unknown; request was not retried/,
    );
    expect(socket.closed).toBe(true);
    expect(client.diagnostics().lastError).toMatch(/write outcome is unknown/);
  });

  it("gives up after the configured reconnect attempts", async () => {
    let attempts = 0;
    const client = new IdmNavigator10WebClient("192.0.2.10", "1234", {
      requestDelay: 0,
      reconnectBaseDelay: 0,
      maxReconnectAttempts: 2,
      socketFactory: async () => {
        attempts += 1;
        return new ScriptedSocket([AUTHORIZED, new Error(`failure ${attempts}`)]);
      },
    });
    await expect(client.readEnergyflow()).rejects.toThrow(IdmWebWebSocketError);
    const diagnostics = client.diagnostics();
    expect(diagnostics.reconnectAttempts).toBe(2);
    expect(diagnostics.lastError).toMatch(/reconnect attempt 2 failed/);
  });

  it("stops reconnecting once the client was closed", async () => {
    const client = new IdmNavigator10WebClient("192.0.2.10", "1234", {
      requestDelay: 0,
      reconnectBaseDelay: 0.05,
      maxReconnectAttempts: 3,
      socketFactory: async () => new ScriptedSocket([AUTHORIZED, new Error("boom")]),
      sleep: async () => {
        await client.close();
      },
    });
    await expect(client.readWeather()).rejects.toThrow(IdmWebWebSocketError);
    expect(client.diagnostics().websocketConnected).toBe(false);
  });

  it("fails the in-flight request when the client is closed mid-request", async () => {
    const socket = new ScriptedSocket([AUTHORIZED], {
      onSend: () => {
        queueMicrotask(() => {
          void client.close();
        });
      },
    });
    const client = new IdmNavigator10WebClient("192.0.2.10", "1234", {
      requestDelay: 0,
      socketFactory: async () => socket,
    });
    await expect(client.readIon()).rejects.toThrow(/was closed during the request/);
    expect(socket.closed).toBe(true);
  });

  it("propagates authentication failures raised while reconnecting", async () => {
    const sockets = [
      new ScriptedSocket([AUTHORIZED, new Error("boom")]),
      new ScriptedSocket(['{"authorized":false}']),
      new ScriptedSocket(['{"authorized":false}']),
    ];
    let index = 0;
    const client = new IdmNavigator10WebClient("192.0.2.10", "1234", {
      requestDelay: 0,
      reconnectBaseDelay: 0,
      socketFactory: async () => {
        const socket = sockets[index];
        if (socket === undefined) throw new Error("no socket scripted");
        index += 1;
        return socket;
      },
    });
    await expect(client.readIon()).rejects.toBeInstanceOf(IdmWebPinRejectedError);
    expect(sockets[0]?.closed).toBe(true);
    expect(sockets[1]?.closed).toBe(true);
  });
});

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  readonly url: string;
  readyState = 0;
  readonly sent: string[] = [];
  readonly #listeners = new Map<string, ((event: { readonly data?: unknown }) => void)[]>();
  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }
  addEventListener(type: string, listener: (event: { readonly data?: unknown }) => void): void {
    const list = this.#listeners.get(type) ?? [];
    list.push(listener);
    this.#listeners.set(type, list);
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    if (this.readyState >= 2) return;
    this.readyState = 3;
    this.#emit("close", {});
  }
  open(): void {
    this.readyState = 1;
    this.#emit("open", {});
  }
  message(data: unknown): void {
    this.#emit("message", { data });
  }
  fail(): void {
    this.#emit("error", {});
  }
  #emit(type: string, event: { readonly data?: unknown }): void {
    for (const listener of [...(this.#listeners.get(type) ?? [])]) listener(event);
  }
}

function installFakeWebSocket(): () => void {
  const previous = (globalThis as { WebSocket?: unknown }).WebSocket;
  FakeWebSocket.instances = [];
  (globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket;
  return () => {
    (globalThis as { WebSocket?: unknown }).WebSocket = previous;
  };
}

function lastSocket(): FakeWebSocket {
  const socket = FakeWebSocket.instances.at(-1);
  if (socket === undefined) throw new Error("no websocket was created");
  return socket;
}

function tick(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

// The adapter attaches its message listener only after the open handshake
// resolved, so the scripted auth frame must follow a macrotask tick.
async function openAndAuthorize(socket: FakeWebSocket): Promise<void> {
  socket.open();
  await tick();
  socket.message(AUTHORIZED);
}

describe("Navigator 10 native websocket adapter", () => {
  it("queues device frames that arrive before the request waits", async () => {
    const restore = installFakeWebSocket();
    try {
      const client = new IdmNavigator10WebClient("192.0.2.10", "1234", { requestDelay: 0 });
      const pending = client.readStatusOverview();
      await tick();
      const socket = lastSocket();
      expect(socket.url).toBe("ws://192.0.2.10:61220/?auth_code=1234");
      await openAndAuthorize(socket);
      socket.message(frame("status"));
      const status = await pending;
      expect(asRecord(status).jsonVersion).toBe(11);
      expect(socket.sent).toEqual([JSON.stringify({ controller: "status", command: "overview" })]);
    } finally {
      restore();
    }
  });

  it("delivers frames to a waiting request and coerces non-string data", async () => {
    const restore = installFakeWebSocket();
    try {
      const client = new IdmNavigator10WebClient("2001:db8::10", "1234", {
        requestDelay: 0,
        reconnectBaseDelay: 0,
      });
      const pending = client.readIon();
      await tick();
      const socket = lastSocket();
      expect(socket.url).toBe("ws://[2001:db8::10]:61220/?auth_code=1234");
      await openAndAuthorize(socket);
      await tick();
      socket.message(new String(frame("ion")));
      const ion = await pending;
      expect(asRecord(ion).active).toBe(true);
    } finally {
      restore();
    }
  });

  it("times out when the device never completes the handshake", async () => {
    const restore = installFakeWebSocket();
    try {
      const client = new IdmNavigator10WebClient("192.0.2.10", "1234", { timeout: 0.02 });
      const pending = client.connect();
      await tick();
      lastSocket();
      await expect(pending).rejects.toBeInstanceOf(IdmWebTimeoutError);
    } finally {
      restore();
    }
  });

  it("reports connection errors from the device", async () => {
    const restore = installFakeWebSocket();
    try {
      const client = new IdmNavigator10WebClient("192.0.2.10", "1234");
      const pending = client.connect();
      await tick();
      lastSocket().fail();
      await expect(pending).rejects.toThrow(IdmWebWebSocketError);
    } finally {
      restore();
    }
  });

  it("fails requests whose reply never arrives and reconnects time out", async () => {
    const restore = installFakeWebSocket();
    try {
      const client = new IdmNavigator10WebClient("192.0.2.10", "1234", {
        timeout: 0.02,
        requestDelay: 0,
        reconnectBaseDelay: 0,
        maxReconnectAttempts: 1,
      });
      const pending = client.readWeather();
      await tick();
      const socket = lastSocket();
      await openAndAuthorize(socket);
      await expect(pending).rejects.toThrow(IdmWebWebSocketError);
    } finally {
      restore();
    }
  });

  it("fails pending waiters when the device closes the socket", async () => {
    const restore = installFakeWebSocket();
    try {
      const client = new IdmNavigator10WebClient("192.0.2.10", "1234", {
        timeout: 0.02,
        requestDelay: 0,
        reconnectBaseDelay: 0,
        maxReconnectAttempts: 1,
      });
      const pending = client.readEnergyflow();
      await tick();
      const socket = lastSocket();
      await openAndAuthorize(socket);
      await tick();
      socket.close();
      await expect(pending).rejects.toThrow(IdmWebWebSocketError);
    } finally {
      restore();
    }
  });

  it("requires a runtime websocket provider", async () => {
    const restore = installFakeWebSocket();
    (globalThis as { WebSocket?: unknown }).WebSocket = undefined;
    try {
      const client = new IdmNavigator10WebClient("192.0.2.10", "1234");
      await expect(client.connect()).rejects.toThrow(/does not provide WebSocket/);
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// Navigator 2.0 client: statistics, clock setting, session handling
// ---------------------------------------------------------------------------

type Nav20ScriptEntry = Navigator20Response | Error;
type Nav20Script = Record<string, readonly Nav20ScriptEntry[]>;

class ScriptedNav20Session implements Navigator20Session {
  readonly requests: Navigator20Request[] = [];
  readonly #queues = new Map<string, Nav20ScriptEntry[]>();
  constructor(script: Nav20Script) {
    for (const [key, values] of Object.entries(script)) this.#queues.set(key, [...values]);
  }
  async request(request: Navigator20Request): Promise<Navigator20Response> {
    this.requests.push(request);
    const url = new URL(request.url);
    const value = this.#queues.get(`${request.method} ${url.pathname}${url.search}`)?.shift();
    if (value === undefined) return { status: 404, text: "" };
    if (value instanceof Error) throw value;
    return value;
  }
}

const NAV2_LOGIN_PAGE = '<html><form><input type="password" name="pin"></form></html>';
const NAV2_TABLE = "<table><tr><td>B33</td><td>21.5 °C</td></tr></table>";
const NAV2_CSRF_PAGE = '<input name="csrf_token" value="abc">';

function loginScript(overrides: Nav20Script = {}): Nav20Script {
  return {
    "GET /": [{ status: 200, text: NAV2_CSRF_PAGE }],
    "POST /": [{ status: 200, text: "OK" }],
    "GET /data/heatpump.php": [{ status: 200, text: NAV2_TABLE }],
    ...overrides,
  };
}

function nav20Client(script: Nav20Script): {
  readonly client: IdmNavigator20WebClient;
  readonly session: ScriptedNav20Session;
} {
  const session = new ScriptedNav20Session(script);
  const client = new IdmNavigator20WebClient("192.0.2.10", "1234", { session });
  return { client, session };
}

describe("Navigator 2.0 statistics and clock (scripted HTTP)", () => {
  it("decodes all three statistics pages with unit scaling", async () => {
    const { client, session } = nav20Client(
      loginScript({
        "GET /data/statistics.php?type=heatpump": [
          { status: 200, text: frame("nav20_stats_nested_runtime") },
        ],
        "GET /data/statistics.php?type=amountofheat": [
          { status: 200, text: frame("nav20_stats_wh") },
        ],
        "GET /data/statistics.php?type=baenergyhp": [
          { status: 200, text: frame("nav20_stats_kwh") },
        ],
      }),
    );
    const data = await client.readStatistics({ includeRaw: true });
    expect(data.getValue("stat_runtime_total_heating")).toBe("1.5");
    expect(data.getNumeric("stat_genheat_total_heating")).toBe(1.234);
    expect(data.getValue("stat_elcons_total_heating")).toBe("1234.56");
    expect(Object.keys(data.rawResponses)).toEqual([
      "/data/statistics.php?type=heatpump",
      "/data/statistics.php?type=amountofheat",
      "/data/statistics.php?type=baenergyhp",
    ]);
    expect(
      session.requests.filter((request) => request.url.includes("statistics.php")),
    ).toHaveLength(3);
  });

  it("reuses an established session without logging in again", async () => {
    const { client, session } = nav20Client(
      loginScript({
        "GET /data/heatpump.php": [
          { status: 200, text: NAV2_TABLE },
          { status: 200, text: NAV2_TABLE },
        ],
        "GET /data/statistics.php?type=heatpump": [{ status: 200, text: frame("nav20_stats_kwh") }],
        "GET /data/statistics.php?type=amountofheat": [
          { status: 200, text: frame("nav20_stats_kwh") },
        ],
        "GET /data/statistics.php?type=baenergyhp": [
          { status: 200, text: frame("nav20_stats_kwh") },
        ],
      }),
    );
    await client.readData();
    const loginsBefore = session.requests.filter((request) => request.method === "POST").length;
    const data = await client.readStatistics();
    expect(data.getNumeric("stat_runtime_total_heating")).toBe(1234.56);
    expect(session.requests.filter((request) => request.method === "POST").length).toBe(
      loginsBefore,
    );
    expect(client.getCachedData()?.getValue("flow_temperature")).toBe("21.5 °C");
    await expect(client.readExtraData()).resolves.toMatchObject({ flow_temperature: "21.5 °C" });
  });

  it("logs in again when a statistics page serves the login form", async () => {
    const { client } = nav20Client({
      "GET /": [
        { status: 200, text: NAV2_CSRF_PAGE },
        { status: 200, text: NAV2_CSRF_PAGE },
      ],
      "POST /": [
        { status: 200, text: "OK" },
        { status: 200, text: "OK" },
      ],
      "GET /data/heatpump.php": [
        { status: 200, text: NAV2_TABLE },
        { status: 200, text: NAV2_TABLE },
      ],
      "GET /data/statistics.php?type=heatpump": [
        { status: 200, text: NAV2_LOGIN_PAGE },
        { status: 200, text: frame("nav20_stats_kwh") },
      ],
      "GET /data/statistics.php?type=amountofheat": [
        { status: 200, text: frame("nav20_stats_kwh") },
      ],
      "GET /data/statistics.php?type=baenergyhp": [{ status: 200, text: frame("nav20_stats_kwh") }],
    });
    const data = await client.readStatistics();
    expect(data.getNumeric("stat_runtime_total_heating")).toBe(1234.56);
  });

  it("rejects statistics reads that keep serving login pages", async () => {
    const { client } = nav20Client({
      "GET /": [
        { status: 200, text: NAV2_CSRF_PAGE },
        { status: 200, text: NAV2_CSRF_PAGE },
      ],
      "POST /": [
        { status: 200, text: "OK" },
        { status: 200, text: "OK" },
      ],
      "GET /data/heatpump.php": [
        { status: 200, text: NAV2_TABLE },
        { status: 200, text: NAV2_TABLE },
      ],
      "GET /data/statistics.php?type=heatpump": [
        { status: 200, text: '{"authorized":false}' },
        { status: 200, text: '{"authorized":false}' },
      ],
    });
    await expect(client.readStatistics()).rejects.toThrow(/statistics returned a login response/);
  });

  it("reports when none of the statistics pages answered", async () => {
    const { client } = nav20Client(
      loginScript({
        "GET /data/statistics.php?type=heatpump": [{ status: 500, text: "" }],
        "GET /data/statistics.php?type=amountofheat": [{ status: 500, text: "" }],
        "GET /data/statistics.php?type=baenergyhp": [{ status: 500, text: "" }],
      }),
    );
    await expect(client.readStatistics()).rejects.toThrow(/answered none of the statistics pages/);
  });

  it("propagates transport errors from statistics reads", async () => {
    const { client } = nav20Client(
      loginScript({
        "GET /data/statistics.php?type=heatpump": [new TypeError("network down")],
      }),
    );
    await expect(client.readStatistics()).rejects.toThrow(TypeError);
  });

  it("sets the clock with CSRF headers and a JSON payload", async () => {
    const { client, session } = nav20Client({
      ...loginScript(),
      "PUT /index.php": [{ status: 200, text: "OK" }],
    });
    const when = new Date("2026-11-21T12:00:00.000Z");
    await client.setDatetime(when);
    const put = session.requests.find((request) => request.method === "PUT");
    if (put === undefined) throw new Error("no PUT request was recorded");
    expect(put.url).toBe("http://192.0.2.10/index.php");
    expect(JSON.parse(put.body ?? "{}")).toMatchObject({
      edesc: "_SETDATETIME",
      id: "SSETDATETIME",
      index: 3,
      type: "setdt",
      value: when.toISOString(),
    });
    expect(put.headers["CSRF-Token"]).toBe("abc");
    expect(put.headers["X-CSRF-Token"]).toBe("abc");
    await expect(client.setDatetime(new Date(Number.NaN))).rejects.toThrow(TypeError);
  });

  it("omits CSRF headers when the login page carried no token", async () => {
    const { client, session } = nav20Client({
      "GET /": [{ status: 200, text: "<html>welcome</html>" }],
      "POST /": [{ status: 200, text: "OK" }],
      "GET /data/heatpump.php": [{ status: 200, text: NAV2_TABLE }],
      "PUT /index.php": [{ status: 200, text: "OK" }],
    });
    await client.setDatetime(new Date("2026-11-21T12:00:00.000Z"));
    const put = session.requests.find((request) => request.method === "PUT");
    if (put === undefined) throw new Error("no PUT request was recorded");
    expect(put.headers["CSRF-Token"]).toBeUndefined();
    expect(put.headers["X-Requested-With"]).toBe("XMLHttpRequest");
  });

  it("maps clock-setting failures onto the error taxonomy", async () => {
    const rejected = nav20Client({
      ...loginScript(),
      "PUT /index.php": [{ status: 401, text: "" }],
    });
    await expect(rejected.client.setDatetime(new Date())).rejects.toBeInstanceOf(
      IdmWebPinRejectedError,
    );
    const forbidden = nav20Client({
      ...loginScript(),
      "PUT /index.php": [{ status: 403, text: "" }],
    });
    await expect(forbidden.client.setDatetime(new Date())).rejects.toBeInstanceOf(
      IdmWebPinRejectedError,
    );
    const csrf = nav20Client({
      ...loginScript(),
      "PUT /index.php": [{ status: 200, text: "Invalid CSRF Token" }],
    });
    await expect(csrf.client.setDatetime(new Date())).rejects.toBeInstanceOf(IdmWebCsrfError);
    const serverError = nav20Client({
      ...loginScript(),
      "PUT /index.php": [{ status: 500, text: "" }],
    });
    await expect(serverError.client.setDatetime(new Date())).rejects.toThrow(/HTTP 500/);
    const timeout = new Error("timed out");
    timeout.name = "TimeoutError";
    const timedOut = nav20Client({
      ...loginScript(),
      "PUT /index.php": [timeout],
    });
    await expect(timedOut.client.setDatetime(new Date())).rejects.toBeInstanceOf(
      IdmWebTimeoutError,
    );
    const aborted = new Error("aborted");
    aborted.name = "AbortError";
    const abortedClient = nav20Client({
      ...loginScript(),
      "PUT /index.php": [aborted],
    });
    await expect(abortedClient.client.setDatetime(new Date())).rejects.toBeInstanceOf(
      IdmWebTimeoutError,
    );
    const broken = nav20Client({
      ...loginScript(),
      "PUT /index.php": [new Error("socket hangup")],
    });
    await expect(broken.client.setDatetime(new Date())).rejects.toBeInstanceOf(
      IdmWebConnectionError,
    );
    const webError = new IdmWebCsrfError("already classified");
    const classified = nav20Client({
      ...loginScript(),
      "PUT /index.php": [webError],
    });
    await expect(classified.client.setDatetime(new Date())).rejects.toThrow(/already classified/);
  });
});

describe("Navigator 2.0 session lifecycle (scripted HTTP)", () => {
  it("retries data reads once after a CSRF rejection", async () => {
    const { client, session } = nav20Client({
      "GET /": [
        { status: 200, text: NAV2_CSRF_PAGE },
        { status: 200, text: NAV2_CSRF_PAGE },
      ],
      "POST /": [
        { status: 200, text: "OK" },
        { status: 200, text: "OK" },
      ],
      "GET /data/heatpump.php": [
        { status: 200, text: NAV2_TABLE },
        { status: 200, text: "Invalid CSRF Token" },
        { status: 200, text: NAV2_TABLE },
      ],
    });
    await client.readData();
    const data = await client.readData(undefined, { includeRaw: true });
    expect(data.getValue("flow_temperature")).toBe("21.5 °C");
    expect(
      session.requests.filter((request) => request.url.endsWith("/data/heatpump.php")),
    ).toHaveLength(3);
  });

  it("relogs in when a data endpoint serves the login form", async () => {
    const { client, session } = nav20Client({
      "GET /": [
        { status: 200, text: NAV2_CSRF_PAGE },
        { status: 200, text: NAV2_CSRF_PAGE },
      ],
      "POST /": [
        { status: 200, text: "OK" },
        { status: 200, text: "OK" },
      ],
      "GET /data/heatpump.php": [
        { status: 200, text: NAV2_TABLE },
        { status: 200, text: NAV2_LOGIN_PAGE },
        { status: 200, text: NAV2_TABLE },
      ],
    });
    await client.readData();
    const data = await client.readData();
    expect(data.getValue("flow_temperature")).toBe("21.5 °C");
    expect(
      session.requests.filter((request) => request.url.endsWith("/data/heatpump.php")),
    ).toHaveLength(3);
  });

  it("falls back to confirmed endpoints for unknown path subsets", async () => {
    const { client, session } = nav20Client(loginScript());
    const data = await client.readData(["/data/nope.php"]);
    expect(data.getValue("flow_temperature")).toBe("21.5 °C");
    expect(session.requests.some((request) => request.url.includes("/data/nope.php"))).toBe(false);
  });

  it("detects the web interface and reports capability flags", async () => {
    const present = nav20Client(
      loginScript({
        "GET /data/heatpump.php": [
          { status: 200, text: frame("nav20_json") },
          { status: 200, text: frame("nav20_json") },
        ],
      }),
    );
    expect(await present.client.detect()).toBe(true);
    await present.client.readData();
    expect(present.client.capabilities()).toMatchObject({
      web_data: true,
      settings: false,
      heatpump: true,
      rooms: true,
      zones: false,
    });
    const absent = nav20Client({});
    expect(await absent.client.detect()).toBe(false);
    expect(absent.client.capabilities().web_data).toBe(false);
  });

  it("closes the session and clears the detected endpoints", async () => {
    const { client } = nav20Client(loginScript());
    await client.readData();
    await client.close();
    expect(client.diagnostics()).toMatchObject({ webDataEnabled: false, cached: true });
    expect(client.diagnostics().usedEndpoints).toEqual([]);
  });

  it("surfaces HTTP auth verdicts from the login and probe phases", async () => {
    const loginRejected = nav20Client({
      "GET /": [{ status: 200, text: NAV2_CSRF_PAGE }],
      "POST /": [{ status: 401, text: "" }],
      "POST /index.php": [{ status: 401, text: "" }],
      "POST /login.php": [{ status: 401, text: "" }],
    });
    await expect(loginRejected.client.connect()).rejects.toBeInstanceOf(IdmWebPinRejectedError);

    const probeRejected = nav20Client({
      "GET /": [{ status: 200, text: NAV2_CSRF_PAGE }],
      "POST /": [{ status: 200, text: "OK" }],
      "GET /data/settings.php": [{ status: 403, text: "" }],
    });
    await expect(probeRejected.client.connect()).rejects.toBeInstanceOf(IdmWebPinRejectedError);
  });

  it("walks the login candidates when the root is unreachable", async () => {
    const { client } = nav20Client({
      "GET /": [{ status: 500, text: "" }],
      "GET /index.php": [{ status: 200, text: NAV2_CSRF_PAGE }],
      "POST /": [
        { status: 200, text: "" },
        { status: 200, text: "OK" },
      ],
      "GET /data/heatpump.php": [{ status: 200, text: NAV2_TABLE }],
    });
    const data = await client.readData();
    expect(data.getValue("flow_temperature")).toBe("21.5 °C");
    const unreachable = nav20Client({
      "GET /": [{ status: 500, text: "" }],
      "GET /index.php": [{ status: 500, text: "" }],
    });
    await expect(unreachable.client.readData()).rejects.toThrow(/was not reachable/);
  });

  it("treats authorization-required bodies and empty bodies defensively", async () => {
    const { client } = nav20Client({
      "GET /": [{ status: 200, text: NAV2_CSRF_PAGE }],
      "POST /": [
        { status: 200, text: "Authorization Required" },
        { status: 200, text: "Authorization Required" },
        { status: 200, text: "Authorization Required" },
        { status: 200, text: "Authorization Required" },
      ],
      "POST /index.php": [{ status: 200, text: "OK" }],
      "GET /data/heatpump.php": [{ status: 200, text: NAV2_TABLE }],
    });
    const data = await client.readData();
    expect(data.getValue("flow_temperature")).toBe("21.5 °C");
  });
});

describe("Navigator 2.0 fetch session (stubbed fetch)", () => {
  it("keeps cookies, encodes forms and JSON bodies", async () => {
    const originalFetch = globalThis.fetch;
    const calls: { url: string; init: RequestInit }[] = [];
    const cookieHeaders = new Headers();
    cookieHeaders.append("set-cookie", "sid=1; Path=/");
    const noCookieHeaders = { get: (): null => null };
    const strayCookieHeaders = {
      get: (name: string): string | null => (name === "set-cookie" ? "lonely" : null),
    };
    try {
      globalThis.fetch = (async (input: unknown, init?: RequestInit): Promise<Response> => {
        const url = String(input);
        calls.push({ url, init: init ?? {} });
        if (url.endsWith("/")) {
          return {
            status: 200,
            text: async () => NAV2_CSRF_PAGE,
            headers: cookieHeaders,
          } as unknown as Response;
        }
        if ((init?.method ?? "GET") === "POST") {
          return {
            status: 200,
            text: async () => "OK",
            headers: noCookieHeaders as unknown as Headers,
          } as unknown as Response;
        }
        if (url.includes("/data/values.php")) {
          return {
            status: 200,
            text: async () => NAV2_TABLE,
            headers: strayCookieHeaders as unknown as Headers,
          } as unknown as Response;
        }
        if ((init?.method ?? "GET") === "PUT") {
          return {
            status: 200,
            text: async () => "OK",
            headers: new Headers(),
          } as unknown as Response;
        }
        return { status: 200, text: async () => "", headers: new Headers() } as unknown as Response;
      }) as typeof fetch;
      const client = new IdmNavigator20WebClient("192.0.2.10", "1234");
      const data = await client.readData();
      expect(data.getValue("flow_temperature")).toBe("21.5 °C");
      await client.setDatetime(new Date("2026-11-21T12:00:00.000Z"));
      const post = calls.find((call) => call.init.method === "POST");
      if (post === undefined) throw new Error("no POST was issued");
      expect(post.init.body).toBeInstanceOf(URLSearchParams);
      expect(asRecord(post.init.headers)["content-type"]).toBe("application/x-www-form-urlencoded");
      const put = calls.find((call) => call.init.method === "PUT");
      if (put === undefined) throw new Error("no PUT was issued");
      expect(JSON.parse(String(put.init.body)).edesc).toBe("_SETDATETIME");
      expect(asRecord(put.init.headers).cookie).toBe("sid=1");
      expect(asRecord(put.init.headers)["content-type"]).toBe("application/json");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ---------------------------------------------------------------------------
// core.ts defensive parsing helpers
// ---------------------------------------------------------------------------

describe("web core defensive parsing", () => {
  it("keeps ill-typed status fields null", () => {
    const status = parseNavigatorStatusResponse(
      JSON.stringify({
        status: {
          jsonVersion: "11",
          userlevel: 1.5,
          language: "   ",
          notificationCount: null,
          timestamp: 12.5,
          frostProtectionInfo: { active: "yes" },
          network: 1,
          authenticationEnabled: "true",
        },
      }),
    );
    expect(status.jsonVersion).toBeNull();
    expect(status.userlevel).toBeNull();
    expect(status.language).toBeNull();
    expect(status.notificationCount).toBeNull();
    expect(status.timestampMs).toBeNull();
    expect(status.frostProtectionActive).toBeNull();
    expect(status.network).toBeNull();
    expect(status.authenticationEnabled).toBeNull();
    const nonObjectFrost = parseNavigatorStatusResponse(
      JSON.stringify({ status: { frostProtectionInfo: 7 } }),
    );
    expect(nonObjectFrost.frostProtectionActive).toBeNull();
    expect(() => parseNavigatorStatusResponse('{"status":5}')).toThrow(
      /does not contain a status object/,
    );
    expect(() => parseNavigatorStatusResponse("nope")).toThrow(/not valid JSON/);
    expect(() => parseNavigatorStatusResponse("[1]")).toThrow(/not a JSON object/);
  });

  it("keeps ill-typed freshwater fields null", () => {
    const freshwater = parseNavigatorFreshwaterResponse(
      JSON.stringify({
        freshwater: {
          circulation: false,
          statusInfo: "n/a",
          temperatures: { top: null, bottom: "42.5", extra: true },
        },
      }),
    );
    expect(freshwater.circulationActive).toBeNull();
    expect(freshwater.status).toBeNull();
    expect(freshwater.systemMode).toBeNull();
    expect(freshwater.temperatureTop).toBeNull();
    expect(freshwater.temperatureBottom).toMatchObject({ numericValue: 42.5, unit: "°C" });
    expect(parseNavigatorFreshwaterResponse('{"freshwater":{}}').temperatureTop).toBeNull();
    expect(() => parseNavigatorFreshwaterResponse("{}")).toThrow(/does not contain a freshwater/);
  });

  it("walks nested home structures and keeps the first power block", () => {
    const detail = parseNavigatorHomeResponse(
      JSON.stringify({
        home: {
          list: [{ operationMode: 2, info: 5 }],
          first: { pv: { value: null } },
          pv: { value: 5 },
          grid: { value: 7 },
          later: { pv: { value: 1 }, grid: { value: 2 } },
        },
      }),
    );
    expect(detail.demandReasons).toHaveLength(1);
    expect(detail.demandReasons[0]?.reason).toBeNull();
    expect(detail.pvPower).toMatchObject({ numericValue: 5 });
    expect(detail.gridPower).toMatchObject({ numericValue: 7 });
    expect(detail.pvDemandActive).toBe(false);
  });

  it("decodes home overviews defensively", () => {
    const nested = parseNavigatorHomeOverviewResponse(
      JSON.stringify({ deep: { list: [{ systemMode: { value: 3 } }] } }),
    );
    expect(nested.systemMode?.value).toBe(3);
    expect(nested.systemMode?.options).toEqual([]);
    const junkOptions = parseNavigatorHomeOverviewResponse(
      JSON.stringify({
        systemMode: { value: 1, options: [5, { value: 2 }, { value: "x" }, null] },
      }),
    );
    expect(junkOptions.systemMode?.options).toEqual([2]);
    expect(parseNavigatorHomeOverviewResponse("{}").systemMode).toBeNull();
  });

  it("decodes heating circuits defensively", () => {
    expect(() => parseNavigatorHeatingcircuitResponse("{}")).toThrow(
      /does not contain heatingcircuitDetail/,
    );
    expect(() =>
      parseNavigatorHeatingcircuitResponse('{"heatingcircuitDetail":{"id":""}}'),
    ).toThrow(/carries no id/);
    const minimal = parseNavigatorHeatingcircuitResponse('{"heatingcircuitDetail":{"id":"B"}}');
    expect(minimal.modeValue).toBeNull();
    expect(minimal.modeOptions).toEqual([]);
    expect(minimal.setpointNormal).toBeNull();
    expect(minimal.availableCircuits).toEqual([]);
    const defensive = parseNavigatorHeatingcircuitResponse(
      JSON.stringify({
        heatingcircuitDetail: {
          id: "B",
          mode: {
            id: "HKB01",
            value: 1.9,
            types: [3, { key: 1, name: "Auto" }, { key: "z" }, null],
          },
          temperatures: {
            heating: { normal: { value: 1 }, eco: 7 },
            set: "35.5",
          },
          room: { temperatures: { actual: 21.3 } },
          availableHeatingCircuits: [
            { id: "" },
            { id: "C", displayName: "Wohn", mode: 2 },
            null,
            5,
          ],
        },
      }),
    );
    expect(defensive.modeValue).toBe(1);
    expect(defensive.modeOptions).toEqual([{ key: 1, name: "Auto" }]);
    expect(defensive.setpointNormal).toBeNull();
    expect(defensive.setpointEco).toBeNull();
    expect(defensive.flowSetpoint).toBe(35.5);
    expect(defensive.roomTemperature).toBe(21.3);
    expect(defensive.availableCircuits).toEqual([{ hcId: "C", displayName: "Wohn", mode: 2 }]);
    const unparseableSet = parseNavigatorHeatingcircuitResponse(
      JSON.stringify({ heatingcircuitDetail: { id: "B", temperatures: { set: "n/a" } } }),
    );
    expect(unparseableSet.flowSetpoint).toBeNull();
  });

  it("decodes setting parameters defensively", () => {
    const parameter = parseNavigatorSettingParameter(
      JSON.stringify({
        settingDetail: { id: "1", value: { a: 1 }, def: true },
      }),
    );
    expect(parameter.value).toBe('{"a":1}');
    expect(parameter.default).toBe(true);
    expect(parameter.minValue).toBeNull();
    const noDefault = parseNavigatorSettingParameter('{"settingDetail":{"id":"1"}}');
    expect(noDefault.default).toBeNull();
    expect(() => parseNavigatorSettingParameter('{"settingDetail":5}')).toThrow(
      /does not contain settingDetail/,
    );
    expect(() => parseNavigatorSettingParameter('{"settingDetail":{"id":""}}')).toThrow(
      /carries no id/,
    );
  });

  it("decodes performance, weather, ion, energyflow and system frames defensively", () => {
    const performance = parseNavigatorPerformanceResponse('{"performanceDetail":{}}');
    expect(performance.consumptionPower).toBeNull();
    expect(performance.environmentTemperatureIn).toBeNull();
    const weather = parseNavigatorWeatherResponse(
      JSON.stringify({
        weatherDetail: {
          forecast1: null,
          forecast2: "str",
          forecast3: { temperature: { act: 1.25 } },
        },
      }),
    );
    expect(weather.today).toBeNull();
    expect(weather.forecasts).toHaveLength(2);
    expect(asRecord(weather.forecasts[0]).date).toBeNull();
    expect(asRecord(weather.forecasts[1]).temperature).toBe(1.25);
    expect(() => parseNavigatorWeatherResponse("{}")).toThrow(/does not contain a weatherDetail/);
    const ion = parseNavigatorIonResponse('{"ion":{"enabled":5}}');
    expect(ion.active).toBeNull();
    expect(ion.enabledSettingId).toBeNull();
    expect(() => parseNavigatorIonResponse("{}")).toThrow(/does not contain an ion object/);
    const energyflow = parseNavigatorEnergyflowResponse(
      JSON.stringify({ energyflow: { grid: 5, pv: { value: "1.5" }, signal: "2", type: 1.5 } }),
    );
    expect(energyflow.gridPower).toBeNull();
    expect(energyflow.pvPower).toBe(1.5);
    expect(energyflow.signal).toBeNull();
    expect(energyflow.type).toBeNull();
    expect(() => parseNavigatorEnergyflowResponse("{}")).toThrow(
      /does not contain an energyflow object/,
    );
    const system = parseNavigatorSystemOverviewResponse(
      JSON.stringify({
        system: {
          heatingcircuit: [
            null,
            { id: "" },
            { id: "Z", room: { temperatures: { actual: "20.1" } } },
          ],
        },
      }),
    );
    expect(system.heatingCircuits).toHaveLength(1);
    expect(asRecord(system.heatingCircuits[0]).roomTemperature).toBe(20.1);
    const empty = parseNavigatorSystemOverviewResponse('{"system":{}}');
    expect(empty.bufferSystemMode).toBeNull();
    expect(empty.freshwaterCirculationActive).toBeNull();
    expect(empty.heatpumpSourceActive).toBeNull();
    expect(() => parseNavigatorSystemOverviewResponse("{}")).toThrow(/does not contain a system/);
  });

  it("decodes statistic frames defensively", () => {
    expect(parseNavigatorStatisticResponse('{"statisticDetail":{}}', "x")).toEqual({});
    const defensive = parseNavigatorStatisticResponse(
      JSON.stringify({
        statisticDetail: {
          data: {
            total: 5,
            yearly: "no",
            today: { date: 1, idx: 2, typeDict: {}, groupDict: {}, heating: 3 },
          },
        },
      }),
      "x",
    );
    expect(Object.keys(defensive)).toEqual(["x_today_heating"]);
    expect(() => parseNavigatorStatisticResponse('{"statisticDetail":5}', "x")).toThrow(
      /does not contain statisticDetail/,
    );
  });

  it("decodes notification frames defensively", () => {
    const notifications = parseNavigatorNotificationsResponse(
      JSON.stringify({
        notification: {
          current: [{ title: "only a title" }, { code: 7, descEnumService: "svc" }],
        },
      }),
    );
    expect(notifications.summary).toBe("only a title | 7: svc");
    expect(asRecord(notifications.current[0]).timestamp).toBeNull();
    expect(() => parseNavigatorNotificationsResponse('{"notification":{"current":5}}')).toThrow(
      /notification.current is not a list/,
    );
    expect(() => parseNavigatorNotificationsResponse("{}")).toThrow(
      /does not contain notification/,
    );
  });

  it("decodes Navigator 2.0 data defensively", () => {
    expect(parseNavigator20Response("<p>no table</p>")).toEqual({});
    expect(parseNavigator20Response("[1,2]")).toEqual({});
    expect(parseNavigator20Response("5")).toEqual({});
    expect(
      parseNavigator20Response(
        '{"html": "<table><tr><td>B32</td><td>7.8&deg;C</td></tr></table>"}',
      ),
    ).toMatchObject({
      outside_air_temperature: { numericValue: 7.8 },
    });
    const junkCircuits = parseNavigator20Response(
      JSON.stringify({ hk: [null, { hk: "X" }, { hk: "AB" }, { hk: "a" }] }),
    );
    expect(junkCircuits).toEqual({});
    const nonFinite = parseNavigator20Response('{"out": 1e999}');
    expect(nonFinite).toEqual({});
  });

  it("scales Navigator 2.0 statistics defensively", () => {
    const flat = parseNavigator20StatisticsResponse(
      JSON.stringify({ total: [{ name: "Heating", value: 0 }] }),
      "runtime",
    );
    expect(flat.stat_runtime_total_heating).toMatchObject({ value: "0", unit: "h" });
    const unknownUnit = parseNavigator20StatisticsResponse(
      JSON.stringify({ unitTotal: "J", total: [{ name: "Heating", value: 2 }] }),
      "elcons",
    );
    expect(unknownUnit.stat_elcons_total_heating?.numericValue).toBe(2);
    const bigNumber = parseNavigator20StatisticsResponse(
      JSON.stringify({ unitTotal: '"Wh",', total: [{ name: "Warmwasser", value: 1234567890 }] }),
      "genheat",
    );
    expect(bigNumber.stat_genheat_total_hotwater?.value).toBe("1.23457e+06");
    const junk = parseNavigator20StatisticsResponse(
      JSON.stringify({
        data: 5,
        total: [null, { name: 5, value: 1 }, { name: "Heating", value: "x" }, { name: "Heating" }],
      }),
      "runtime",
    );
    expect(junk).toEqual({});
    expect(parseNavigator20StatisticsResponse('{"total":5}', "runtime")).toEqual({});
  });

  it("maps HTML entities exactly like Python's html.unescape", () => {
    const values = parseIdmHtmlTableValues(
      "<table>" +
        "<tr><td>A&amp;B</td><td>1</td></tr>" +
        "<tr><td>&#65;&#x43;</td><td>2</td></tr>" +
        "<tr><td>&#X41;&#x42;</td><td>3</td></tr>" +
        "<tr><td>&#65</td><td>4</td></tr>" +
        "<tr><td>&#128;</td><td>5</td></tr>" +
        "<tr><td>&#0;</td><td>6</td></tr>" +
        "<tr><td>&#xD800;</td><td>7</td></tr>" +
        "<tr><td>&#x110000;</td><td>8</td></tr>" +
        "<tr><td>&notit;</td><td>9</td></tr>" +
        "<tr><td>&not</td><td>10</td></tr>" +
        "<tr><td>&zzz;</td><td>11</td></tr>" +
        "</table>",
      {
        nameMap: {
          "A&B": "e_amp",
          AC: "e_decimal",
          AB: "e_hex",
          A: "e_hex_upper",
          "€": "e_windows",
          "¬it;": "e_prefix",
          "¬": "e_legacy",
          "&zzz;": "e_unknown",
        },
      },
    );
    expect(Object.keys(values).sort()).toEqual(
      [
        "e_amp",
        "e_decimal",
        "e_hex",
        "e_hex_upper",
        "e_windows",
        "e_prefix",
        "e_legacy",
        "e_unknown",
      ].sort(),
    );
  });

  it("skips table rows without enough cells and appends separate units", () => {
    expect(parseIdmHtmlTableValues("<table><tr><td>B2</td></tr></table>")).toEqual({});
    const values = parseIdmHtmlTableValues(
      "<table><tr><td>B32</td><td>Außen</td><td>21</td><td>°C</td></tr></table>",
    );
    expect(values.outside_air_temperature).toMatchObject({ numericValue: 21, unit: "°C" });
    expect(values.outside_air_temperature?.value).toBe("21°C");
  });

  it("maps section-scoped setting names", () => {
    const values = parseIdmHtmlTableValues(
      "<table><tr><td>M1</td><td>Verdichter</td><td>1</td></tr></table>",
      { sectionId: "4789" },
    );
    expect(values.compressor_1).toMatchObject({ numericValue: 1 });
    const viaNameMap = parseIdmHtmlTableValues("<table><tr><td>Foo</td><td>1</td></tr></table>", {
      nameMap: { Foo: "custom_value" },
    });
    expect(viaNameMap.custom_value?.value).toBe("1");
  });

  it("extracts CSRF tokens with entities and classifies responses", () => {
    expect(extractCsrfToken('<input name="csrf_token" value="a&amp;b">')).toBe("a&b");
    expect(looksLikeLoginPage("<html>plain</html>")).toBe(false);
    expect(looksLikeLoginPage("no markup")).toBe(false);
    expect(looksLikeLoginPage("<html>passwort field</html>")).toBe(true);
    expect(looksLikeAuthFailure('{"authorized":false}')).toBe(true);
    expect(looksLikeAuthFailure('{"authenticated":false}')).toBe(true);
    expect(looksLikeAuthFailure('{"status":"unauthorized"}')).toBe(true);
    expect(looksLikeAuthFailure('{"status":"ok"}')).toBe(false);
    expect(looksLikeAuthFailure("[1]")).toBe(false);
    expect(looksLikeAuthFailure("PIN REJECTED")).toBe(true);
    expect(looksLikeDataResponse("")).toBe(false);
    expect(looksLikeDataResponse('{"error":"x"}')).toBe(false);
    expect(looksLikeDataResponse("<table></table>")).toBe(true);
    expect(looksLikeDataResponse("<html>setting overview</html>")).toBe(true);
    expect(isJsonObject({})).toBe(true);
    expect(isJsonObject(null)).toBe(false);
    expect(isJsonObject([1])).toBe(false);
    expect(isJsonObject(5)).toBe(false);
  });

  it("validates hosts and decodes demand reasons at the edges", () => {
    expect(formatUrlHost("::1")).toBe("[::1]");
    expect(formatUrlHost("[::1]")).toBe("[::1]");
    expect(formatUrlHost("example.com.")).toBe("example.com.");
    expect(() => formatUrlHost(" ")).toThrow(TypeError);
    expect(() => formatUrlHost("a%b")).toThrow(/Invalid host/);
    expect(() => formatUrlHost("[bad")).toThrow(/Invalid host/);
    expect(() => formatUrlHost("g:h:i")).toThrow(/Invalid host/);
    expect(() => formatUrlHost("-bad.example.com")).toThrow(/Invalid host/);
    expect(() => formatUrlHost(`${"a".repeat(64)}.com`)).toThrow(/Invalid host/);
    expect(() => formatUrlHost("a/b")).toThrow(/Invalid host/);
    expect(decodeNavigator10DemandReason(null, 5)).toBeNull();
    expect(decodeNavigator10DemandReason(4, 8192)).toBe("dhw_booster");
    expect(decodeNavigator10DemandReason(1, 16384)).toBe("system_off");
    expect(decodeNavigator10DemandReason(1, 0)).toBeNull();
    expect(decodeNavigator10DemandReason(2, 2)).toBeNull();
  });
});
