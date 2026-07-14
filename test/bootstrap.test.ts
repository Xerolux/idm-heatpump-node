import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertParityMetadataConsistency,
  type CompatibilityMatrix,
  type UpstreamParity,
} from "../src/internal/parity-metadata.js";

interface PackageManifest {
  readonly name: string;
  readonly private: boolean;
  readonly engines: { readonly node: string };
  readonly exports: Readonly<Record<string, unknown>>;
}

interface CompatibilityMatrixChange {
  readonly schema_version?: number;
  readonly development_baseline?: Partial<CompatibilityMatrix["development_baseline"]>;
}

type InvalidParityCase = readonly [
  name: string,
  upstreamChange: Partial<UpstreamParity>,
  matrixChange: CompatibilityMatrixChange,
  expectedMessage: string,
];

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(file), "utf8")) as T;
}

describe("repository bootstrap contracts", () => {
  it("pins a reproducible Python baseline", () => {
    const parity = readJson<UpstreamParity>("UPSTREAM-PARITY.json");

    expect(parity.schema_version).toBe(1);
    expect(parity.repository).toBe("https://github.com/Xerolux/idm-heatpump-api");
    expect(parity.python_package).toBe("idm-heatpump-api");
    expect(parity.git_tag).toBe(`v${parity.python_version}`);
    expect(parity.git_commit).toMatch(/^[0-9a-f]{40}$/u);
    expect(parity.parity_status).toBe("planned");
  });

  it("keeps the compatibility matrix aligned with the baseline", () => {
    const parity = readJson<UpstreamParity>("UPSTREAM-PARITY.json");
    const matrix = readJson<CompatibilityMatrix>("docs/compatibility-matrix.json");

    expect(matrix.schema_version).toBe(parity.schema_version);
    expect(matrix.development_baseline.python_version).toBe(parity.python_version);
    expect(matrix.development_baseline.python_commit).toBe(parity.git_commit);
    expect(matrix.development_baseline.status).toBe(parity.parity_status);
    expect(matrix.releases).toEqual([]);
    expect(() => assertParityMetadataConsistency(parity, matrix)).not.toThrow();
  });

  const invalidParityCases: readonly InvalidParityCase[] = [
    ["invalid commit", { git_commit: "short" }, {}, "full lowercase Git commit SHA"],
    ["tag mismatch", { git_tag: "v9.9.9" }, {}, "tag and version"],
    ["schema mismatch", {}, { schema_version: 2 }, "schema versions"],
    [
      "version mismatch",
      {},
      { development_baseline: { python_version: "9.9.9" } },
      "Python versions",
    ],
    [
      "commit mismatch",
      {},
      { development_baseline: { python_commit: "f".repeat(40) } },
      "Python commits",
    ],
    ["status mismatch", {}, { development_baseline: { status: "complete" } }, "parity statuses"],
  ];

  it.each(invalidParityCases)(
    "rejects %s",
    (_name, upstreamChange, matrixChange, expectedMessage) => {
      const upstream = {
        ...readJson<UpstreamParity>("UPSTREAM-PARITY.json"),
        ...upstreamChange,
      };
      const originalMatrix = readJson<CompatibilityMatrix>("docs/compatibility-matrix.json");
      const developmentChange = matrixChange.development_baseline ?? {};
      const matrix = {
        ...originalMatrix,
        ...matrixChange,
        development_baseline: {
          ...originalMatrix.development_baseline,
          ...developmentChange,
        },
      };

      expect(() => assertParityMetadataConsistency(upstream, matrix)).toThrow(expectedMessage);
    },
  );

  it("blocks publication while parity is incomplete", () => {
    const manifest = readJson<PackageManifest>("package.json");

    expect(manifest.name).toBe("@xerolux/idm-heatpump");
    expect(manifest.private).toBe(true);
    expect(manifest.engines.node).toBe(">=22");
    expect(Object.keys(manifest.exports).sort()).toEqual([".", "./package.json", "./web"]);
  });
});
