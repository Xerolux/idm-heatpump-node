import { describe, expect, it } from "vitest";

import {
  ContractValueError,
  TAGGED_VALUE_LIMITS,
  normalizeTaggedValue,
  parseTaggedValue,
} from "../../src/contracts/tagged-values.js";

function expectContractCode(callback: () => unknown, code: ContractValueError["code"]): void {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(ContractValueError);
    expect((error as ContractValueError).code).toBe(code);
    return;
  }
  throw new Error(`Expected contract error ${code}`);
}

describe("tagged contract numbers", () => {
  it("round-trips the four exceptional number tags without null or zero conflation", () => {
    const values = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0] as const;
    const tags = ["NaN", "+Infinity", "-Infinity", "-0"] as const;

    for (const [index, value] of values.entries()) {
      const normalized = normalizeTaggedValue(value);
      expect(normalized).toEqual({ $number: tags[index] });
      expect(JSON.stringify(normalized)).not.toBe("null");

      const parsed = parseTaggedValue(normalized);
      if (Number.isNaN(value)) {
        expect(Number.isNaN(parsed)).toBe(true);
      } else {
        expect(Object.is(parsed, value)).toBe(true);
      }
    }

    expect(normalizeTaggedValue(0)).toBe(0);
    expect(Object.is(parseTaggedValue(0), -0)).toBe(false);
  });

  it("normalizes approved map and set differences deterministically", () => {
    const value = new Map<string | number, unknown>([
      ["z", new Set([3, 1, 2])],
      [2, { value: true }],
    ]);

    expect(normalizeTaggedValue(value)).toEqual({
      "2": { value: true },
      z: [1, 2, 3],
    });
  });

  it("rejects malformed tagged number envelopes with a stable code", () => {
    const inheritedEnvelope = Object.assign(Object.create({ inherited: true }) as object, {
      $number: "NaN",
    });

    for (const malformed of [
      { $number: "Other" },
      { $number: "NaN", extra: true },
      { $number: 0 },
      inheritedEnvelope,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -0,
    ]) {
      expectContractCode(() => parseTaggedValue(malformed), "invalid_number_tag");
    }
  });

  it("rejects unsupported and prototype-bearing contract values", () => {
    class UnsupportedValue {
      public readonly value = 1;
    }

    const getterValue = {} as Record<string, unknown>;
    Object.defineProperty(getterValue, "unsafe", {
      enumerable: true,
      get: () => 1,
    });

    for (const unsupported of [
      undefined,
      1n,
      Symbol("value"),
      () => 1,
      new Date(0),
      new UnsupportedValue(),
      getterValue,
      Object.assign(Object.create({ inherited: true }) as object, { own: true }),
    ]) {
      expectContractCode(() => parseTaggedValue(unsupported), "invalid_contract_value");
    }
  });
});

describe("tagged contract value bounds", () => {
  it("rejects excessive strings, arrays, objects, depth, and total nodes", () => {
    const deepValue: Record<string, unknown> = {};
    let cursor = deepValue;
    for (let depth = 0; depth <= TAGGED_VALUE_LIMITS.maxDepth; depth += 1) {
      const child: Record<string, unknown> = {};
      cursor.next = child;
      cursor = child;
    }

    const tooManyKeys = Object.fromEntries(
      Array.from({ length: TAGGED_VALUE_LIMITS.maxObjectKeys + 1 }, (_, index) => [
        `key-${index}`,
        index,
      ]),
    );
    const tooManyNodes = Array.from(
      { length: TAGGED_VALUE_LIMITS.maxArrayLength },
      () => Array.from({ length: 3 }, () => 0),
    );

    for (const excessive of [
      "x".repeat(TAGGED_VALUE_LIMITS.maxStringLength + 1),
      Array.from({ length: TAGGED_VALUE_LIMITS.maxArrayLength + 1 }, () => 0),
      tooManyKeys,
      deepValue,
      tooManyNodes,
    ]) {
      expectContractCode(() => parseTaggedValue(excessive), "invalid_contract_value");
    }
  });

  it("rejects circular values deterministically", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expectContractCode(() => normalizeTaggedValue(circular), "invalid_contract_value");
    expectContractCode(() => parseTaggedValue(circular), "invalid_contract_value");
  });
});

describe("tagged contract value ownership", () => {
  it("clones and deeply freezes accepted arrays and objects", () => {
    const input = { nested: [{ value: 1 }] };
    const parsed = parseTaggedValue(input) as Readonly<{
      nested: readonly Readonly<{ value: number }>[];
    }>;

    expect(parsed).not.toBe(input);
    expect(parsed.nested).not.toBe(input.nested);
    expect(parsed.nested[0]).not.toBe(input.nested[0]);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.nested)).toBe(true);
    expect(Object.isFrozen(parsed.nested[0])).toBe(true);

    input.nested[0]!.value = 9;
    expect(parsed.nested[0]!.value).toBe(1);
    expect(() => Object.assign(parsed.nested[0]!, { value: 2 })).toThrow(TypeError);
  });
});
