import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import * as rootExports from "../../src/index.js";
import * as webExports from "../../src/web/index.js";

const ROOT = resolve(import.meta.dirname, "../..");
const GENERATOR = "scripts/generate-api-parity.mjs";
const GENERATOR_INPUTS = [
  GENERATOR,
  "contracts/api-mapping.json",
  "test/fixtures/public-api.json",
  "test/fixtures/public-classes.json",
  "test/semantic/constants-and-types.test.ts",
  "test/codec.test.ts",
  "test/registers/builders.test.ts",
  "test/registers/register-def.test.ts",
  "UPSTREAM-PARITY.json",
] as const;
const temporaryDirectories: string[] = [];

interface PublicSymbol {
  readonly export_boundary: "." | "./web";
  readonly name: string;
  readonly python_kind: "class" | "constant" | "function";
  readonly source_group: "client" | "const" | "registers" | "web";
}

interface PublicApiFixture {
  readonly aliases: readonly { readonly name: string; readonly target: string }[];
  readonly counts: { readonly root: number; readonly total: number; readonly web: number };
  readonly symbols: readonly PublicSymbol[];
}

interface PythonClassFact {
  readonly constructor: {
    readonly parameters: readonly { readonly name: string }[];
  };
  readonly members: readonly { readonly kind: string; readonly name: string }[];
  readonly public_names: readonly string[];
  readonly python_name: string;
  readonly validation_boundaries: readonly unknown[];
}

interface PublicClassesFixture {
  readonly classes: readonly PythonClassFact[];
}

interface MappingRepresentation {
  readonly form: string;
  readonly python_class?: string;
  readonly alias_of?: string;
  readonly constructor: "class" | "factory" | "not_constructible" | "value";
  readonly member_naming?: "preserve" | "snake_case_to_camelCase";
  readonly member_overrides?: Readonly<Record<string, string>>;
  readonly validation: "python_fixture" | "constant_fixture" | "function_fixture";
}

interface ApiMappingRow {
  readonly python_symbol: string;
  readonly typescript_symbol: string;
  readonly export_path: "." | "./web";
  readonly kind: "class" | "constant" | "function";
  readonly owner_phase: 1 | 2 | 3 | 4;
  readonly status: "planned" | "partial" | "complete" | "not_applicable";
  readonly evidence_category: string;
  readonly contract_test: string;
  readonly normalizations: readonly string[];
  readonly representation: MappingRepresentation;
  readonly not_applicable_rationale?: string;
}

interface ApiMapping {
  readonly baseline: {
    readonly repository: string;
    readonly python_package: string;
    readonly python_version: string;
    readonly git_tag: string;
    readonly git_commit: string;
    readonly parity_schema_version: number;
  };
  readonly mappings: readonly ApiMappingRow[];
  readonly schema_version: number;
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, relativePath), "utf8")) as T;
}

const publicApi = readJson<PublicApiFixture>("test/fixtures/public-api.json");
const publicClasses = readJson<PublicClassesFixture>("test/fixtures/public-classes.json");
const apiMapping = readJson<ApiMapping>("contracts/api-mapping.json");

function camelCase(name: string): string {
  return name.replace(/_([a-z0-9])/g, (_, character: string) => character.toUpperCase());
}

function counterpart(row: ApiMappingRow, pythonName: string): string {
  const override = row.representation.member_overrides?.[pythonName];
  if (override !== undefined) {
    return override;
  }
  return row.representation.member_naming === "snake_case_to_camelCase"
    ? camelCase(pythonName)
    : pythonName;
}

function requireDefined<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Missing test fixture value: ${label}`);
  }
  return value;
}

function collectKeys(value: unknown, target = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, target);
    }
  } else if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      target.add(key);
      collectKeys(item, target);
    }
  }
  return target;
}

function createGeneratorProject(): string {
  const project = mkdtempSync(join(tmpdir(), "idm-api-parity-test-"));
  temporaryDirectories.push(project);
  mkdirSync(resolve(project, "docs"));

  for (const relativePath of GENERATOR_INPUTS) {
    const target = resolve(project, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(resolve(ROOT, relativePath), target);
  }

  return project;
}

function runGenerator(
  project: string,
  args: readonly string[] = [],
  environment: NodeJS.ProcessEnv = process.env,
): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [GENERATOR, ...args], {
    cwd: project,
    encoding: "utf8",
    env: environment,
    maxBuffer: 8 * 1024 * 1024,
    shell: false,
    timeout: 30_000,
  });
}

function requireSuccess(result: SpawnSyncReturns<string>, purpose: string): void {
  if (result.status !== 0) {
    throw new Error(
      `${purpose} failed\n${result.error?.message ?? ""}\n${result.stdout}\n${result.stderr}`,
    );
  }
}

function mutateProjectJson<T>(
  project: string,
  relativePath: string,
  mutate: (value: T) => void,
): void {
  const path = resolve(project, relativePath);
  const value = JSON.parse(readFileSync(path, "utf8")) as T;
  mutate(value);
  writeFileSync(path, `${JSON.stringify(value, undefined, 2)}\n`);
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("API mapping inventory", () => {
  it("mapping has exact one-to-one coverage of the 89 pinned Python exports", () => {
    expect(publicApi.counts).toEqual({ root: 59, total: 89, web: 30 });
    expect(apiMapping.schema_version).toBe(1);
    expect(apiMapping.baseline).toEqual(
      readJson<{ readonly baseline: ApiMapping["baseline"] }>("test/fixtures/public-api.json")
        .baseline,
    );

    const expectedSymbols = publicApi.symbols.map(({ name }) => name);
    const mappedSymbols = apiMapping.mappings.map(({ python_symbol }) => python_symbol);

    expect(apiMapping.mappings).toHaveLength(89);
    expect(new Set(mappedSymbols)).toHaveLength(89);
    expect(mappedSymbols).toEqual(expectedSymbols);
  });

  it("mapping boundary keeps 59 root and 30 web rows including every alias", () => {
    const fixtureByName = new Map(publicApi.symbols.map((symbol) => [symbol.name, symbol]));
    const aliases = new Map(publicApi.aliases.map((alias) => [alias.name, alias.target]));

    expect(apiMapping.mappings.filter(({ export_path }) => export_path === ".")).toHaveLength(59);
    expect(apiMapping.mappings.filter(({ export_path }) => export_path === "./web")).toHaveLength(
      30,
    );

    for (const row of apiMapping.mappings) {
      const source = fixtureByName.get(row.python_symbol);
      expect(source, row.python_symbol).toBeDefined();
      expect(row.export_path, row.python_symbol).toBe(source?.export_boundary);
      expect(row.kind, row.python_symbol).toBe(source?.python_kind);
      if (source?.source_group === "web") {
        expect(row.export_path, row.python_symbol).toBe("./web");
        expect(row.owner_phase, row.python_symbol).toBe(4);
      }
    }

    for (const [alias, target] of aliases) {
      const row = apiMapping.mappings.find(({ python_symbol }) => python_symbol === alias);
      expect(row?.representation.form, alias).toBe("alias");
      expect(row?.representation.alias_of, alias).toBe(target);
    }
  });

  it("mapping promotion completes exactly the fully evidenced Phase-1 semantic surface", () => {
    const allowedNormalizations = new Set([
      "enum_to_const_union",
      "list_to_readonly_array",
      "mapping_to_readonly_map_or_record",
      "none_to_null",
      "python_alias_to_typescript_alias",
      "python_dataclass_to_readonly_object_factory",
      "python_exception_to_error_class",
      "set_to_immutable_set_like",
      "snake_case_to_camelCase",
      "tuple_to_readonly_array",
    ]);
    const counterpartKeys = new Set<string>();
    const completedRows = apiMapping.mappings.filter(({ status }) => status === "complete");

    expect(completedRows).toHaveLength(53);
    expect(completedRows.map(({ python_symbol }) => python_symbol)).toEqual(
      apiMapping.mappings
        .filter(({ owner_phase }) => owner_phase === 1)
        .map(({ python_symbol }) => python_symbol),
    );

    for (const row of apiMapping.mappings) {
      expect(row.status, row.python_symbol).toBe(row.owner_phase === 1 ? "complete" : "planned");
      expect(row.typescript_symbol, row.python_symbol).toMatch(/^[A-Za-z][A-Za-z0-9_]*$/);
      expect([1, 2, 3, 4], row.python_symbol).toContain(row.owner_phase);
      expect(row.evidence_category, row.python_symbol).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(row.contract_test, row.python_symbol).toMatch(/^test\/.+\.test\.ts$/);
      if (row.status === "complete") {
        expect(existsSync(resolve(ROOT, row.contract_test)), row.python_symbol).toBe(true);
      }
      expect(row.normalizations, row.python_symbol).toEqual([...new Set(row.normalizations)]);
      expect(
        row.normalizations.every((normalization) => allowedNormalizations.has(normalization)),
        row.python_symbol,
      ).toBe(true);

      const key = `${row.export_path}:${row.typescript_symbol}`;
      expect(counterpartKeys.has(key), key).toBe(false);
      counterpartKeys.add(key);

      if (row.python_symbol !== row.typescript_symbol && row.kind === "function") {
        expect(row.typescript_symbol, row.python_symbol).toBe(camelCase(row.python_symbol));
        expect(row.normalizations, row.python_symbol).toContain("snake_case_to_camelCase");
      }
      if (row.kind === "class") {
        expect(row.typescript_symbol, row.python_symbol).toMatch(/^[A-Z]/);
      }
      expect(row.not_applicable_rationale, row.python_symbol).toBeUndefined();
    }
  });
});

describe("Phase-1 class representation mapping", () => {
  it("mapping closes constructor, member, default, and validation inventory from Python-only facts", () => {
    const factsByPublicName = new Map(
      publicClasses.classes.flatMap((classFact) =>
        classFact.public_names.map((name) => [name, classFact] as const),
      ),
    );

    for (const row of apiMapping.mappings.filter(
      ({ kind, owner_phase, status }) =>
        kind === "class" && owner_phase === 1 && status === "complete",
    )) {
      const facts = factsByPublicName.get(row.python_symbol);
      expect(facts, row.python_symbol).toBeDefined();
      expect(row.representation.python_class, row.python_symbol).toBe(facts?.python_name);
      expect(row.representation.validation, row.python_symbol).toBe("python_fixture");
      expect(facts?.validation_boundaries.length, row.python_symbol).toBeGreaterThan(0);

      for (const parameter of facts?.constructor.parameters ?? []) {
        const mappedName = counterpart(row, parameter.name);
        expect(mappedName, `${row.python_symbol} constructor ${parameter.name}`).toMatch(
          /^[A-Za-z][A-Za-z0-9]*$/,
        );
      }
      for (const member of facts?.members ?? []) {
        const mappedName = counterpart(row, member.name);
        expect(mappedName, `${row.python_symbol}.${member.name}`).toMatch(/^[A-Za-z][A-Za-z0-9]*$/);
      }
    }

    const pollRateLimiter = apiMapping.mappings.find(
      ({ python_symbol }) => python_symbol === "PollRateLimiter",
    );
    expect(counterpart(requireDefined(pollRateLimiter, "PollRateLimiter"), "interval")).toBe(
      "interval",
    );
    expect(counterpart(requireDefined(pollRateLimiter, "PollRateLimiter"), "remaining")).toBe(
      "remaining",
    );

    const registry = apiMapping.mappings.find(
      ({ python_symbol }) => python_symbol === "RegisterRegistry",
    );
    expect(
      ["get", "require", "by_address", "writable", "to_schema"].map((member) =>
        counterpart(requireDefined(registry, "RegisterRegistry"), member),
      ),
    ).toEqual(["get", "require", "byAddress", "writable", "toSchema"]);
  });

  it("public class facts contain no Node naming, ownership, status, export, or representation decisions", () => {
    const fixtureKeys = collectKeys(publicClasses);
    const forbiddenKeys = [
      "alias_of",
      "contract_test",
      "evidence_category",
      "export_path",
      "member_naming",
      "member_overrides",
      "normalizations",
      "not_applicable_rationale",
      "owner_phase",
      "representation",
      "status",
      "typescript_name",
      "typescript_symbol",
    ];

    for (const key of forbiddenKeys) {
      expect(fixtureKeys.has(key), key).toBe(false);
    }
  });

  it("later-owned runtime classes remain planned and absent from both package entry points", () => {
    const rootSource = readFileSync(resolve(ROOT, "src/index.ts"), "utf8");
    const webSource = readFileSync(resolve(ROOT, "src/web/index.ts"), "utf8");
    const laterRows = apiMapping.mappings.filter(({ owner_phase }) => owner_phase > 1);

    expect(laterRows.length).toBeGreaterThan(0);
    for (const row of laterRows) {
      expect(row.status, row.python_symbol).toBe("planned");
      expect(rootSource, row.typescript_symbol).not.toContain(row.typescript_symbol);
      expect(webSource, row.typescript_symbol).not.toContain(row.typescript_symbol);
    }
  });
});

describe("checked mapping export closure", () => {
  it("exports exactly the complete Phase-1 root runtime symbols from the checked mapping", () => {
    const expectedRuntimeSymbols = apiMapping.mappings
      .filter(({ export_path, status }) => export_path === "." && status === "complete")
      .map(({ typescript_symbol }) => typescript_symbol)
      .sort();

    expect(Object.keys(rootExports).sort()).toEqual(expectedRuntimeSymbols);
    expect(Object.keys(webExports)).toEqual([]);
    expect(expectedRuntimeSymbols).toHaveLength(53);
  });

  it("keeps internal or later symbols unexported", () => {
    const rootSource = readFileSync(resolve(ROOT, "src/index.ts"), "utf8");
    const webSource = readFileSync(resolve(ROOT, "src/web/index.ts"), "utf8");
    const forbiddenSymbols = [
      "createRegisterDef",
      "decodeValue",
      "encodeValue",
      "serializeRegisterDef",
      "getCommonRegisters",
      "getSystemRegisters",
    ];

    expect(rootExports.RegisterDef.create).toBeTypeOf("function");
    expect(rootSource).toContain('export { RegisterDef } from "./registers/definitions.js";');
    expect(rootSource).toContain(
      'export type { RegisterDefInput } from "./registers/definitions.js";',
    );
    for (const symbol of forbiddenSymbols) {
      expect(rootExports, symbol).not.toHaveProperty(symbol);
      expect(rootSource, symbol).not.toContain(symbol);
    }
    for (const row of apiMapping.mappings.filter(({ status }) => status === "planned")) {
      expect(rootExports, row.typescript_symbol).not.toHaveProperty(row.typescript_symbol);
      expect(webExports, row.typescript_symbol).not.toHaveProperty(row.typescript_symbol);
      expect(rootSource, row.typescript_symbol).not.toContain(row.typescript_symbol);
      expect(webSource, row.typescript_symbol).not.toContain(row.typescript_symbol);
    }
  });
});

describe("generated API and baseline documentation", () => {
  it("generator rejects mapping, inventory, class, baseline, and release status drift", () => {
    const cases: readonly {
      readonly code: string;
      readonly mutate: (project: string) => void;
      readonly args?: readonly string[];
    }[] = [
      {
        code: "mapping_duplicate_python_symbol",
        mutate(project) {
          mutateProjectJson<ApiMapping>(project, "contracts/api-mapping.json", (mapping) => {
            (mapping.mappings as ApiMappingRow[]).push(
              requireDefined(mapping.mappings[0], "first mapping row"),
            );
          });
        },
      },
      {
        code: "mapping_inventory_mismatch",
        mutate(project) {
          mutateProjectJson<ApiMapping>(project, "contracts/api-mapping.json", (mapping) => {
            (mapping.mappings as ApiMappingRow[]).pop();
          });
        },
      },
      {
        code: "mapping_export_boundary_mismatch",
        mutate(project) {
          mutateProjectJson<ApiMapping>(project, "contracts/api-mapping.json", (mapping) => {
            (mapping.mappings[0] as { export_path: string }).export_path = "./web";
          });
        },
      },
      {
        code: "mapping_class_inventory_mismatch",
        mutate(project) {
          mutateProjectJson<ApiMapping>(project, "contracts/api-mapping.json", (mapping) => {
            const row = requireDefined(
              mapping.mappings.find(({ python_symbol }) => python_symbol === "PollRateLimiter"),
              "PollRateLimiter mapping row",
            );
            (row.representation as { python_class?: string }).python_class = "WrongClass";
          });
        },
      },
      {
        code: "mapping_not_applicable_rationale_missing",
        mutate(project) {
          mutateProjectJson<ApiMapping>(project, "contracts/api-mapping.json", (mapping) => {
            (mapping.mappings[0] as { status: string }).status = "not_applicable";
          });
        },
      },
      {
        args: ["--release"],
        code: "mapping_release_status_incomplete",
        mutate: () => undefined,
      },
      {
        code: "baseline_inventory_mismatch",
        mutate(project) {
          mutateProjectJson<{ baseline: { git_commit: string } }>(
            project,
            "test/fixtures/public-api.json",
            (fixture) => {
              fixture.baseline.git_commit = "0".repeat(40);
            },
          );
        },
      },
    ];

    for (const testCase of cases) {
      const project = createGeneratorProject();
      testCase.mutate(project);
      const result = runGenerator(project, testCase.args);
      expect(result.status, testCase.code).not.toBe(0);
      expect(result.stderr, testCase.code).toContain(testCase.code);
    }
  });

  it("generator renders all 89 mapping rows and complete Phase-1 class member evidence", () => {
    const project = createGeneratorProject();
    requireSuccess(runGenerator(project), "documentation generation");

    const apiDocument = readFileSync(resolve(project, "docs/API-PARITY.md"), "utf8");
    const baselineDocument = readFileSync(resolve(project, "docs/BASELINE.md"), "utf8");

    expect(apiDocument).toMatch(/^<!-- GENERATED FILE/u);
    expect(apiDocument).toContain("ad121ebf34a5f5e37204371c026927d77efcd15c");
    expect(apiDocument).toContain("89 public symbols: 59 root, 30 web");
    for (const row of apiMapping.mappings) {
      expect(apiDocument, row.python_symbol).toContain(`| \`${row.python_symbol}\` |`);
    }
    expect(apiDocument).toContain("`PollRateLimiter.interval` → `interval`");
    expect(apiDocument).toContain("`RegisterRegistry.by_address` → `byAddress`");
    expect(apiDocument).toContain("`RegisterRegistry.to_schema` → `toSchema`");

    expect(baselineDocument).toMatch(/^<!-- GENERATED FILE/u);
    expect(baselineDocument).toContain("| Python version | `0.7.6` |");
    expect(baselineDocument).toContain("| Parity status | `planned` |");
    expect(baselineDocument).toContain("| Verified on | `2026-07-14` |");
    expect(baselineDocument).not.toContain("PollRateLimiter");
  });

  it("check mode is non-mutating, reports drift, and generation is byte-stable", () => {
    const project = createGeneratorProject();
    requireSuccess(runGenerator(project), "initial generation");
    const apiPath = resolve(project, "docs/API-PARITY.md");
    const baselinePath = resolve(project, "docs/BASELINE.md");
    const firstApi = readFileSync(apiPath);
    const firstBaseline = readFileSync(baselinePath);

    requireSuccess(runGenerator(project), "repeat generation");
    expect(readFileSync(apiPath)).toEqual(firstApi);
    expect(readFileSync(baselinePath)).toEqual(firstBaseline);

    const beforeCheck = {
      apiBytes: readFileSync(apiPath),
      apiMtime: statSync(apiPath).mtimeMs,
      baselineBytes: readFileSync(baselinePath),
      baselineMtime: statSync(baselinePath).mtimeMs,
    };
    requireSuccess(runGenerator(project, ["--check"]), "fresh check");
    expect(readFileSync(apiPath)).toEqual(beforeCheck.apiBytes);
    expect(readFileSync(baselinePath)).toEqual(beforeCheck.baselineBytes);
    expect(statSync(apiPath).mtimeMs).toBe(beforeCheck.apiMtime);
    expect(statSync(baselinePath).mtimeMs).toBe(beforeCheck.baselineMtime);

    writeFileSync(apiPath, `${readFileSync(apiPath, "utf8")}manual drift\n`);
    const driftBytes = readFileSync(apiPath);
    const driftMtime = statSync(apiPath).mtimeMs;
    const result = runGenerator(project, ["--check"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("generated_document_stale");
    expect(readFileSync(apiPath)).toEqual(driftBytes);
    expect(statSync(apiPath).mtimeMs).toBe(driftMtime);
  });

  it("generation rolls back both allowlisted documents after an injected replacement failure", () => {
    const project = createGeneratorProject();
    mkdirSync(resolve(project, "docs"), { recursive: true });
    const apiPath = resolve(project, "docs/API-PARITY.md");
    const baselinePath = resolve(project, "docs/BASELINE.md");
    writeFileSync(apiPath, "prior api\n");
    writeFileSync(baselinePath, "prior baseline\n");

    const result = runGenerator(project, [], {
      ...process.env,
      IDM_API_GENERATOR_TEST_FAIL_AFTER_REPLACE: "1",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("generated_document_write_failed");
    expect(readFileSync(apiPath, "utf8")).toBe("prior api\n");
    expect(readFileSync(baselinePath, "utf8")).toBe("prior baseline\n");
  });

  it("generator uses fixed local paths and no shell, child process, network, or dynamic output", () => {
    const source = readFileSync(resolve(ROOT, GENERATOR), "utf8");

    expect(source).not.toMatch(/node:child_process|spawn|execFile|\bfetch\s*\(|https?:\/\//u);
    expect(source).not.toMatch(/process\.cwd|--root|--output/u);
    expect(source).toContain('"contracts/api-mapping.json"');
    expect(source).toContain('"docs/API-PARITY.md"');
    expect(source).toContain('"docs/BASELINE.md"');
  });
});
