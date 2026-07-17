import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  WriteSafetyResult,
  createWritePlan,
} from "../../src/client/write-safety.js";
import { parseWriteBehaviorFixture } from "../../src/contracts/write-scenario.js";
import { SemanticValidationError } from "../../src/errors.js";
import {
  createRegisterDef,
  type RegisterDef,
  type RegisterDefInput,
} from "../../src/registers/definitions.js";
import { DataType, IdmModelInfo, type IdmModelInfo as IdmModelInfoValue } from "../../src/types.js";

const GENERATED_WRITE_FIXTURE = resolve(import.meta.dirname, "../fixtures/write-behavior.json");

function detectedModel(modelName: string | null): IdmModelInfoValue | null {
  if (modelName === null) return null;
  return IdmModelInfo.create({
    modelName,
    activeHeatingCircuits: ["A"],
    zoneModules: 0,
    hasSolar: false,
    hasIsc: false,
    hasPv: false,
    hasCascade: false,
  });
}

function fixtureRegister(value: unknown): RegisterDef | string {
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Expected a fixture register key or definition");
  }
  const raw = value as Readonly<Record<string, unknown>>;
  const excluded = raw.excludeFromWrite;
  const input = {
    ...raw,
    ...(Array.isArray(excluded) ? { excludeFromWrite: new Set(excluded as number[]) } : {}),
  } as unknown as RegisterDefInput;
  return createRegisterDef(input);
}

describe("write plan validation", () => {
  it("creates an owned immutable result with the intentional factory default", () => {
    const register = createRegisterDef({
      address: 1_696,
      datatype: DataType.FLOAT,
      name: "identity_float",
      writable: true,
    });
    const requestedValue = { exact: true };
    const words = [0, 16_938];

    const result = WriteSafetyResult.create({
      register,
      requestedValue,
      encodedRegisters: words,
    });
    words[0] = 1;

    expect(result.register).toBe(register);
    expect(result.requestedValue).toBe(requestedValue);
    expect(result.encodedRegisters).toEqual([0, 16_938]);
    expect(result.dryRun).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.encodedRegisters)).toBe(true);
    expect(Object.isFrozen(requestedValue)).toBe(false);
    expect(() => Object.assign(result, { dryRun: true })).toThrow(TypeError);
  });

  it.each([[1.5], [-1], [65_536], [Number.NaN]])(
    "rejects a non-word factory payload %j",
    (encodedRegisters) => {
      const register = createRegisterDef({
        address: 1,
        datatype: DataType.UCHAR,
        name: "invalid_word",
        writable: true,
      });
      expect(() =>
        WriteSafetyResult.create({ register, requestedValue: 1, encodedRegisters }),
      ).toThrow(RangeError);
    },
  );

  it("returns the first authoritative collision code and bypasses membership only", () => {
    const modelInfo = detectedModel("Navigator 2.0");
    const readOnly = createRegisterDef({
      address: 4_205,
      datatype: DataType.UCHAR,
      name: "missing_read_only",
      writable: false,
    });
    expect(() =>
      createWritePlan({ register: readOnly, value: "bad", modelInfo }),
    ).toThrowError(expect.objectContaining({ code: "write_read_only" }));

    const custom = createRegisterDef({
      address: 4_200,
      datatype: DataType.FLOAT,
      name: "missing_numeric",
      writable: true,
    });
    expect(() => createWritePlan({ register: custom, value: true, modelInfo })).toThrowError(
      expect.objectContaining({ code: "write_model_unavailable" }),
    );
    expect(() =>
      createWritePlan({
        register: custom,
        value: true,
        modelInfo,
        allowCustomRegister: true,
      }),
    ).toThrowError(expect.objectContaining({ code: "write_boolean_for_numeric" }));
  });

  it("keeps simulation metadata transport-free even when dryRun is false", () => {
    const result = createWritePlan({
      register: "glt_temp_demand_heating",
      value: 42.5,
      dryRun: false,
    });

    expect(result.dryRun).toBe(false);
    expect(result.encodedRegisters).toEqual([0, 16_938]);
    expect(result.register.registerType).toBe("input");
  });

  it("matches every generated pure simulation validation and plan case", () => {
    const fixture = parseWriteBehaviorFixture(readFileSync(GENERATED_WRITE_FIXTURE, "utf8"));
    const scenarios = fixture.scenarios.filter(
      ({ operation }) =>
        operation.actions.length === 1 && operation.actions[0]?.kind === "simulate_write",
    );
    expect(scenarios.length).toBeGreaterThanOrEqual(28);

    for (const scenario of scenarios) {
      const action = scenario.operation.actions[0];
      if (action?.kind !== "simulate_write") throw new Error("Expected simulate_write action");
      const expected = scenario.expected_result.steps[0]?.result;
      if (expected === undefined) throw new Error("Expected generated result");
      const register = fixtureRegister(action.register);
      const invoke = (): ReturnType<typeof createWritePlan> =>
        createWritePlan({
          register,
          value: action.value,
          dryRun: action.dryRun,
          allowCustomRegister: action.allowCustomRegister,
          modelInfo: detectedModel(
            (scenario.configuration.detectedModel as string | null | undefined) ?? null,
          ),
        });

      if (expected.kind === "error") {
        try {
          invoke();
          throw new Error(`Expected ${scenario.name} to reject`);
        } catch (error: unknown) {
          expect(error, scenario.name).toBeInstanceOf(SemanticValidationError);
          expect(error, scenario.name).toMatchObject({
            category: expected.category,
            code: expected.code,
          });
        }
        continue;
      }

      const expectedValue = expected.value as Readonly<Record<string, unknown>>;
      const result = invoke();
      expect(result.dryRun, scenario.name).toBe(expectedValue.dryRun);
      expect(result.encodedRegisters, scenario.name).toEqual(expectedValue.encodedRegisters);
      expect(result.requestedValue, scenario.name).toBe(action.value);
      expect(result.register, scenario.name).toBe(register);
      expect({ name: result.register.name, address: result.register.address }, scenario.name).toEqual(
        expectedValue.register,
      );
    }
  });
});
