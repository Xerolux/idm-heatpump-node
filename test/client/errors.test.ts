import { describe, expect, it, vi } from "vitest";

import {
  SemanticValidationError,
  type SemanticValidationErrorCode,
} from "../../src/errors.js";
import {
  createModbusFailure,
  createNormalizedTransportFailure,
  IllegalAddressError,
  NormalizedTransportFailure,
  NormalizedTransportFailureKind,
  redactDiagnosticMessage,
} from "../../src/transport/errors.js";
import { quietPymodbusLogging, registerPymodbusLoggingHook } from "../../src/transport/logging.js";

const ENDPOINT = Object.freeze({ host: "example.invalid", port: 502 });

const WRITE_VALIDATION_CODES = Object.freeze([
  "write_unknown_register",
  "write_read_only",
  "write_model_unavailable",
  "write_boolean_required",
  "write_boolean_for_numeric",
  "write_not_numeric",
  "write_nonfinite",
  "write_integer_required",
  "write_excluded",
  "write_below_minimum",
  "write_above_maximum",
  "write_enum_unsupported",
  "write_eeprom_throttled",
] as const satisfies readonly SemanticValidationErrorCode[]);

function semanticOwnProperties(error: Error): readonly string[] {
  return Object.freeze(
    Object.getOwnPropertyNames(error)
      .filter((name) => name !== "stack")
      .sort(),
  );
}

describe("write semantic validation failures", () => {
  it("keeps the reviewed thirteen-code vocabulary structured and finite", () => {
    expect(WRITE_VALIDATION_CODES).toHaveLength(13);
    expect(new Set(WRITE_VALIDATION_CODES).size).toBe(13);

    for (const code of WRITE_VALIDATION_CODES) {
      const error = new SemanticValidationError(code, `synthetic ${code}`);
      expect(error).toMatchObject({
        category: "validation",
        code,
        diagnostic: `synthetic ${code}`,
      });
    }
  });
});

describe("normalized transport failures", () => {
  it("creates the six retryable closed kinds without retaining raw adapter state", () => {
    const kinds = [
      NormalizedTransportFailureKind.TIMEOUT,
      NormalizedTransportFailureKind.DISCONNECTED,
      NormalizedTransportFailureKind.SOCKET,
      NormalizedTransportFailureKind.NO_RESPONSE,
      NormalizedTransportFailureKind.MODBUS,
      NormalizedTransportFailureKind.INVALID_RESPONSE,
    ] as const;

    for (const kind of kinds) {
      const rawAdapterError = {
        adapter: "modbus-serial",
        cause: new Error("raw cause"),
        response: { words: [1234] },
        secret: "must-not-leak",
      };
      const failure = createNormalizedTransportFailure(
        kind,
        `Failure from [example.invalid]:502 via example.invalid:502 and example.invalid`,
        ENDPOINT,
      );

      expect(failure).toBeInstanceOf(NormalizedTransportFailure);
      expect(failure).toMatchObject({
        name: "NormalizedTransportFailure",
        kind,
        message: "Failure from <endpoint> via <endpoint> and <endpoint>",
      });
      expect(semanticOwnProperties(failure)).toEqual(["kind", "message", "name"]);
      for (const forbidden of ["adapter", "cause", "code", "raw", "response", "secret"]) {
        expect(forbidden in failure).toBe(false);
      }
      expect(JSON.stringify(failure)).not.toContain(JSON.stringify(rawAdapterError));
    }
  });

  it("uses numeric Modbus code 2 as the sole raw illegal-address classifier", () => {
    const illegal = createModbusFailure(2, "Illegal Data Address at example.invalid:502", ENDPOINT);

    expect(illegal).toBeInstanceOf(IllegalAddressError);
    expect(illegal).toMatchObject({
      name: "IllegalAddressError",
      isIllegalAddress: true,
      message: "Illegal Data Address at <endpoint>",
    });
    expect(semanticOwnProperties(illegal)).toEqual(["isIllegalAddress", "message", "name"]);
    for (const forbidden of ["adapter", "cause", "code", "raw", "response"]) {
      expect(forbidden in illegal).toBe(false);
    }

    for (const forged of [
      "exception_code=2",
      "Illegal Data Address",
      "Adresse de données illégale 2",
      "Modbus exception 2",
    ]) {
      const ordinary = createModbusFailure(undefined, forged, ENDPOINT);
      expect(ordinary).toBeInstanceOf(NormalizedTransportFailure);
      expect(ordinary).toMatchObject({
        kind: NormalizedTransportFailureKind.MODBUS,
        message: forged,
      });
      expect(ordinary).not.toBeInstanceOf(IllegalAddressError);
    }

    const numericString = createModbusFailure(
      "2" as unknown as number,
      "forged numeric string",
      ENDPOINT,
    );
    expect(numericString).toBeInstanceOf(NormalizedTransportFailure);
    expect(numericString).not.toBeInstanceOf(IllegalAddressError);
  });

  it("redacts endpoint candidates longest-first and rejects overlong output", () => {
    expect(
      redactDiagnosticMessage(
        "[example.invalid]:502|example.invalid:502|example.invalid|tail",
        ENDPOINT,
      ),
    ).toBe("<endpoint>|<endpoint>|<endpoint>|tail");
    expect(redactDiagnosticMessage("x".repeat(1_024), ENDPOINT)).toBe("x".repeat(1_024));
    expect(() => redactDiagnosticMessage("x".repeat(1_025), ENDPOINT)).toThrowError(/1024/);
  });
});

describe("quietPymodbusLogging", () => {
  it.each([
    ["CRITICAL", 50],
    ["FATAL", 50],
    ["ERROR", 40],
    ["WARNING", 30],
    ["WARN", 30],
    ["INFO", 20],
    ["DEBUG", 10],
    ["NOTSET", 0],
    ["critical", 50],
    ["FaTaL", 50],
    ["eRrOr", 40],
    ["wArNiNg", 30],
    ["warn", 30],
    ["Info", 20],
    ["debug", 10],
    ["nOtSeT", 0],
  ] as const)("maps Python logging name %s to %i", (name, expected) => {
    const hook = vi.fn<(level: number) => void>();
    const unregister = registerPymodbusLoggingHook(hook);
    try {
      quietPymodbusLogging(name);
      expect(hook).toHaveBeenCalledExactlyOnceWith(expected);
    } finally {
      unregister();
    }
  });

  it("passes integer numeric levels through and defaults to WARNING", () => {
    const hook = vi.fn<(level: number) => void>();
    const unregister = registerPymodbusLoggingHook(hook);
    try {
      quietPymodbusLogging(17);
      quietPymodbusLogging();
      expect(hook.mock.calls).toEqual([[17], [30]]);
    } finally {
      unregister();
    }
  });

  it("is a no-op without a hook and rejects unknown strings", () => {
    expect(() => quietPymodbusLogging("WARNING")).not.toThrow();

    const hook = vi.fn<(level: number) => void>();
    const unregister = registerPymodbusLoggingHook(hook);
    try {
      expect(() => quietPymodbusLogging("not-a-level")).toThrowError(/Unknown log level/);
      expect(hook).not.toHaveBeenCalled();
    } finally {
      unregister();
    }
  });
});
