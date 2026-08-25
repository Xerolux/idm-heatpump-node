import { describe, expect, it } from "vitest";

import { IdmModbusClient } from "../../src/index.js";
import { seedInternalModelInfo } from "../../src/client/internal-create.js";
import { IdmModelInfo } from "../../src/types.js";
import { buildRegisterMap } from "../../src/registers/registry.js";
import { createRegisterDef } from "../../src/registers/definitions.js";
import { DataType } from "../../src/types.js";
import {
  FakeModbusTransport,
  type FakeModbusTransportEvent,
} from "../support/fake-modbus-transport.js";

function eventKinds(events: readonly FakeModbusTransportEvent[]): readonly string[] {
  return Object.freeze(events.map((event) => event.kind));
}

function recordedModel(): IdmModelInfo {
  return IdmModelInfo.create({
    modelName: "Navigator 10",
    activeHeatingCircuits: ["A", "D"],
    zoneModules: 2,
    hasSolar: true,
    hasIsc: false,
    hasPv: false,
    hasCascade: false,
  });
}

describe("public transport injection", () => {
  it("uses an injected transport and keeps it across disconnect and reconnect", async () => {
    const transport = new FakeModbusTransport([], { initiallyConnected: true });
    const client = new IdmModbusClient("example.invalid", { transport });

    expect(client.isConnected).toBe(true);
    expect(() => client.connect()).not.toThrow();
    await client.connect();

    await client.disconnect();
    expect(client.isConnected).toBe(false);
    expect(eventKinds(transport.events)).toEqual(["close"]);

    await client.forceReconnect();
    expect(client.isConnected).toBe(true);
    expect(eventKinds(transport.events)).toEqual(["close", "close", "connect"]);
  });

  it("rejects objects that do not satisfy the transport protocol", () => {
    expect(() => new IdmModbusClient("example.invalid", { transport: {} as never })).toThrowError(
      /must satisfy the ModbusTransport protocol/u,
    );
    expect(
      () =>
        new IdmModbusClient("example.invalid", {
          transport: { connected: true } as never,
        }),
    ).toThrowError(TypeError);
  });

  it("keeps the closed option surface and rejects unknown keys", () => {
    const hostileOptions = { transportFactory: () => ({}) } as unknown as ConstructorParameters<
      typeof IdmModbusClient
    >[1];
    expect(() => new IdmModbusClient("example.invalid", hostileOptions)).toThrowError(
      /Unknown IdmModbusClient option/u,
    );
  });
});

describe("public eeprom write interval", () => {
  it("defaults to 60 seconds and validates assignments", () => {
    const client = new IdmModbusClient("example.invalid");

    expect(client.eepromWriteInterval).toBe(60);
    client.eepromWriteInterval = 12.5;
    expect(client.eepromWriteInterval).toBe(12.5);
    expect(() => {
      client.eepromWriteInterval = 0;
    }).toThrowError(/eeprom_write_interval must be finite and positive/u);
    expect(() => {
      client.eepromWriteInterval = Number.POSITIVE_INFINITY;
    }).toThrowError(/eeprom_write_interval must be finite and positive/u);
    expect(client.eepromWriteInterval).toBe(12.5);
  });

  it("governs the EEPROM throttle window of real writes", async () => {
    const transport = new FakeModbusTransport([], {
      initiallyConnected: true,
      writeResponses: [{ kind: "write_ok" }, { kind: "write_ok" }, { kind: "write_ok" }],
    });
    const client = new IdmModbusClient("example.invalid", { transport });
    const register = createRegisterDef({
      address: 4_500,
      datatype: DataType.UCHAR,
      name: "interval_governed_eeprom",
      writable: true,
      eepromSensitive: true,
    });

    await client.writeRegister(register, 1);

    await expect(client.writeRegister(register, 2)).rejects.toThrowError(/written too recently/u);

    client.eepromWriteInterval = 1e-9;
    await expect(client.writeRegister(register, 2)).resolves.toBeUndefined();
  });
});

describe("public setModelInfo", () => {
  it("overrides detection state and rebuilds the model register map", () => {
    const client = new IdmModbusClient("example.invalid");
    seedInternalModelInfo(
      client,
      IdmModelInfo.create({
        modelName: "Navigator 2.0",
        activeHeatingCircuits: ["A"],
        zoneModules: 0,
        hasSolar: false,
        hasIsc: false,
        hasPv: false,
        hasCascade: false,
      }),
    );
    expect(client.modelName).toBe("Navigator 2.0");

    const info = recordedModel();
    client.setModelInfo(info);

    expect(client.modelInfo).toBe(info);
    expect(client.modelName).toBe("Navigator 10");
    expect(client.readValue).toBeInstanceOf(Function);
    const map = buildRegisterMap({ modelInfo: info });
    expect(map.size).toBeGreaterThan(0);
  });
});
