import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BaselineValidationCode,
  parseUpstreamParity,
  type UpstreamParity,
} from "../../src/internal/parity-metadata.js";

function readManifest(): unknown {
  return JSON.parse(readFileSync(resolve("UPSTREAM-PARITY.json"), "utf8")) as unknown;
}

function validManifest(): Record<string, unknown> {
  return { ...(readManifest() as Record<string, unknown>) };
}

function expectValidationCode(value: unknown, code: string): void {
  try {
    parseUpstreamParity(value);
  } catch (error: unknown) {
    expect(error).toMatchObject({ code });
    return;
  }

  throw new Error(`Expected baseline validation code ${code}`);
}

type InvalidManifestCase = readonly [
  name: string,
  value: () => unknown,
  code: (typeof BaselineValidationCode)[keyof typeof BaselineValidationCode],
];

describe("upstream parity baseline manifest", () => {
  it("parses the exact pinned identity into a frozen runtime contract", () => {
    const parsed = parseUpstreamParity(readManifest());

    expect(parsed).toEqual({
      schema_version: 1,
      repository: "https://github.com/Xerolux/idm-heatpump-api",
      python_package: "idm-heatpump-api",
      python_version: "0.7.6",
      git_tag: "v0.7.6",
      git_commit: "ad121ebf34a5f5e37204371c026927d77efcd15c",
      parity_status: "planned",
      verified_on: "2026-07-14",
    } satisfies UpstreamParity);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(() => {
      (parsed as { repository: string }).repository = "https://example.invalid/repository";
    }).toThrow(TypeError);
  });

  const invalidShapeCases: readonly InvalidManifestCase[] = [
    ["null", () => null, BaselineValidationCode.NOT_OBJECT],
    ["an array", () => [], BaselineValidationCode.NOT_OBJECT],
    [
      "an unknown field",
      () => ({ ...validManifest(), branch: "main" }),
      BaselineValidationCode.UNKNOWN_FIELD,
    ],
    [
      "a missing field",
      () => {
        const value = validManifest();
        delete value.verified_on;
        return value;
      },
      BaselineValidationCode.MISSING_FIELD,
    ],
  ];

  it.each(invalidShapeCases)("rejects %s", (_name, value, code) => {
    expectValidationCode(value(), code);
  });

  const invalidValueCases: readonly InvalidManifestCase[] = [
    [
      "an unsupported schema",
      () => ({ ...validManifest(), schema_version: 2 }),
      BaselineValidationCode.INVALID_SCHEMA,
    ],
    [
      "a string schema",
      () => ({ ...validManifest(), schema_version: "1" }),
      BaselineValidationCode.INVALID_SCHEMA,
    ],
    [
      "a non-allowlisted repository",
      () => ({ ...validManifest(), repository: "https://example.invalid/idm-heatpump-api" }),
      BaselineValidationCode.INVALID_REPOSITORY,
    ],
    [
      "an overlong repository",
      () => ({ ...validManifest(), repository: `https://github.com/${"x".repeat(300)}` }),
      BaselineValidationCode.INVALID_REPOSITORY,
    ],
    [
      "a different package",
      () => ({ ...validManifest(), python_package: "other-package" }),
      BaselineValidationCode.INVALID_PACKAGE,
    ],
    [
      "a malformed version",
      () => ({ ...validManifest(), python_version: "release" }),
      BaselineValidationCode.INVALID_VERSION,
    ],
    [
      "a different well-formed version",
      () => ({ ...validManifest(), python_version: "0.7.7", git_tag: "v0.7.7" }),
      BaselineValidationCode.BASELINE_MISMATCH,
    ],
    [
      "a branch name as tag",
      () => ({ ...validManifest(), git_tag: "main" }),
      BaselineValidationCode.INVALID_TAG,
    ],
    [
      "a mismatched tag and version",
      () => ({ ...validManifest(), git_tag: "v0.7.5" }),
      BaselineValidationCode.INVALID_TAG,
    ],
    [
      "a short commit",
      () => ({ ...validManifest(), git_commit: "ad121eb" }),
      BaselineValidationCode.INVALID_COMMIT,
    ],
    [
      "an uppercase commit",
      () => ({ ...validManifest(), git_commit: "A".repeat(40) }),
      BaselineValidationCode.INVALID_COMMIT,
    ],
    [
      "a different well-formed commit",
      () => ({ ...validManifest(), git_commit: "f".repeat(40) }),
      BaselineValidationCode.BASELINE_MISMATCH,
    ],
    [
      "an unknown parity status",
      () => ({ ...validManifest(), parity_status: "branch" }),
      BaselineValidationCode.INVALID_STATUS,
    ],
    [
      "a malformed verification date",
      () => ({ ...validManifest(), verified_on: "14.07.2026" }),
      BaselineValidationCode.INVALID_VERIFIED_ON,
    ],
    [
      "an impossible verification date",
      () => ({ ...validManifest(), verified_on: "2026-02-30" }),
      BaselineValidationCode.INVALID_VERIFIED_ON,
    ],
  ];

  it.each(invalidValueCases)("rejects %s", (_name, value, code) => {
    expectValidationCode(value(), code);
  });
});
