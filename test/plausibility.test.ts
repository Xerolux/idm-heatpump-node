import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { isUninitializedTemperature, UNINITIALIZED_TEMPERATURE_C } from "../src/plausibility.js";

interface ApiMappingRow {
  readonly python_symbol: string;
  readonly status: string;
  readonly contract_test: string;
}

interface ApiMapping {
  readonly mappings: readonly ApiMappingRow[];
}

const mapping = JSON.parse(readFileSync("contracts/api-mapping.json", "utf8")) as ApiMapping;

const rows = mapping.mappings.filter((row) => row.contract_test === "test/plausibility.test.ts");

describe("uninitialized-temperature plausibility", () => {
  it("covers the mapped contract rows as complete", () => {
    expect(
      rows
        .filter((row) => row.status === "complete")
        .map((row) => row.python_symbol)
        .sort(),
    ).toEqual(["UNINITIALIZED_TEMPERATURE_C", "is_uninitialized_temperature"]);
  });

  it("publishes the documented band boundary", () => {
    expect(UNINITIALIZED_TEMPERATURE_C).toBe(-300);
  });

  it("classifies the documented low band as uninitialized memory", () => {
    // Field observations: -327.33 °C and -327.22 °C on Navigator 2.0
    // register 1364 (idm-heatpump-hass issues #504 and #668); scaled INT16
    // garbage bottoms out at -327.68 °C.
    expect(isUninitializedTemperature(-327.33)).toBe(true);
    expect(isUninitializedTemperature(-327.22)).toBe(true);
    expect(isUninitializedTemperature(-327.68)).toBe(true);
    expect(isUninitializedTemperature(UNINITIALIZED_TEMPERATURE_C)).toBe(true);
    expect(isUninitializedTemperature(-400)).toBe(true);
  });

  it("keeps real measurements and the sentinel band visible", () => {
    expect(isUninitializedTemperature(-40)).toBe(false);
    expect(isUninitializedTemperature(0)).toBe(false);
    expect(isUninitializedTemperature(21.5)).toBe(false);
    // The FLOAT -1.0 "not present" sentinel is not uninitialized memory:
    // consumers handle it through their own sentinel rules.
    expect(isUninitializedTemperature(-1)).toBe(false);
    expect(isUninitializedTemperature(-299.99)).toBe(false);
  });

  it("never classifies non-numeric or non-finite input", () => {
    expect(isUninitializedTemperature(Number.NaN)).toBe(false);
    expect(isUninitializedTemperature(Number.NEGATIVE_INFINITY)).toBe(false);
    expect(isUninitializedTemperature(null)).toBe(false);
    expect(isUninitializedTemperature(undefined)).toBe(false);
    expect(isUninitializedTemperature("-327.33")).toBe(false);
    expect(isUninitializedTemperature(true)).toBe(false);
    expect(isUninitializedTemperature(false)).toBe(false);
  });
});
