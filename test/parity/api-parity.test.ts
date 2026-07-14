import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");

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

  it("mapping status starts every implementable row as planned with final ownership and evidence", () => {
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

    for (const row of apiMapping.mappings) {
      expect(row.status, row.python_symbol).toBe("planned");
      expect(row.typescript_symbol, row.python_symbol).toMatch(/^[A-Za-z][A-Za-z0-9_]*$/);
      expect([1, 2, 3, 4], row.python_symbol).toContain(row.owner_phase);
      expect(row.evidence_category, row.python_symbol).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(row.contract_test, row.python_symbol).toMatch(/^test\/.+\.test\.ts$/);
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
      ({ kind, owner_phase }) => kind === "class" && owner_phase === 1,
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
    expect(counterpart(pollRateLimiter!, "interval")).toBe("interval");
    expect(counterpart(pollRateLimiter!, "remaining")).toBe("remaining");

    const registry = apiMapping.mappings.find(
      ({ python_symbol }) => python_symbol === "RegisterRegistry",
    );
    expect(
      ["get", "require", "by_address", "writable", "to_schema"].map((member) =>
        counterpart(registry!, member),
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
