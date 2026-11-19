import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ErrorCodeInfo, getErrorCodeInfo } from "../src/error-codes.js";

interface ApiMappingRow {
  readonly python_symbol: string;
  readonly typescript_symbol: string;
  readonly status: string;
  readonly contract_test: string;
}

interface ApiMapping {
  readonly mappings: readonly ApiMappingRow[];
}

const mapping = JSON.parse(readFileSync("contracts/api-mapping.json", "utf8")) as ApiMapping;

const rows = mapping.mappings.filter((row) => row.contract_test === "test/error-codes.test.ts");
const completeRows = rows.filter((row) => row.status === "complete");

describe("error-code database parity", () => {
  it("covers the mapped contract rows as complete", () => {
    expect(completeRows.map((row) => row.python_symbol).sort()).toEqual([
      "ErrorCodeInfo",
      "get_error_code_info",
    ]);
  });

  it("returns null for unknown codes", () => {
    expect(getErrorCodeInfo(1)).toBeNull();
    expect(getErrorCodeInfo(999999)).toBeNull();
    expect(getErrorCodeInfo(-5)).toBeNull();
  });

  it("decodes the documented entry shapes", () => {
    // "no error" placeholder: empty texts.
    expect(getErrorCodeInfo(0)).toEqual({
      code: 0,
      isWarning: false,
      text: null,
      info: null,
      userDescription: null,
      serviceDescription: null,
    });

    // A controller error with component and error kind (German texts).
    const entry = getErrorCodeInfo(20);
    expect(entry).not.toBeNull();
    expect(entry?.isWarning).toBe(true);
    expect(entry?.text).toBe("Wärmepumpenvorlauf");
    expect(entry?.info).toBe("Maximaltemperatur");
    expect(entry?.userDescription).toContain("Automatische Quittierung");
    expect(typeof entry?.serviceDescription).toBe("string");

    // A sensor fault with remediation texts.
    const sensor = getErrorCodeInfo(100);
    expect(sensor?.text).toBe("Außentemperatur");
    expect(sensor?.info).toBe("Kurzschluss");
    expect(sensor?.isWarning).toBe(false);
  });

  it("joins component and error kind like the controller display", () => {
    const warning = getErrorCodeInfo(20);
    expect(warning).not.toBeNull();
    expect(ErrorCodeInfo.displayText(warning as ErrorCodeInfo)).toBe(
      "Wärmepumpenvorlauf Maximaltemperatur",
    );
    // Entries with an info keep both phrases, exactly like the display.
    const checksum = getErrorCodeInfo(10);
    expect(checksum).not.toBeNull();
    expect(ErrorCodeInfo.displayText(checksum as ErrorCodeInfo)).toBe(
      "Prüfsummen - Fehler Parameter laut Werk!",
    );
    // Entries without an info keep the bare component text.
    const bare = [...Array(1000).keys()]
      .map((code) => getErrorCodeInfo(code))
      .find((entry) => entry !== null && entry.info === null && entry.text !== null);
    expect(bare).toBeDefined();
    expect(bare?.text).toBeDefined();
    expect(ErrorCodeInfo.displayText(bare as ErrorCodeInfo)).toBe(bare?.text);
  });

  it("serves the full decoded vendor database", () => {
    // 2005 codes decoded from the Windows service tool configuration
    // ("IDM Smart Navigator" 2.3.118).
    let count = 0;
    let warnings = 0;
    let withUserService = 0;
    for (let code = 0; code <= 100000; code += 1) {
      const entry = getErrorCodeInfo(code);
      if (entry === null) continue;
      count += 1;
      if (entry.isWarning) warnings += 1;
      if (entry.userDescription !== null || entry.serviceDescription !== null) {
        withUserService += 1;
      }
    }
    expect(count).toBe(2005);
    expect(warnings).toBeGreaterThan(0);
    expect(withUserService).toBeGreaterThan(1000);

    // The device-side error blocks resolve too.
    expect(getErrorCodeInfo(20000)?.code).toBe(20000);
    expect(getErrorCodeInfo(30000)?.code).toBe(30000);
  });
});
