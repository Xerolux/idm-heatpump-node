import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  truncateSync,
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
  "scripts/evidence-path.mjs",
  "contracts/api-mapping.json",
  "contracts/normalization.md",
  "contracts/typescript-extensions.json",
  "test/fixtures/public-api.json",
  "test/fixtures/public-classes.json",
  "test/semantic/constants-and-types.test.ts",
  "test/codec.test.ts",
  "test/registers/builders.test.ts",
  "test/registers/register-def.test.ts",
  "test/client/diagnostics.test.ts",
  "test/client/errors.test.ts",
  "test/parity/transport-contract.test.ts",
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

interface PartialClassAuthority {
  readonly implemented_members: readonly string[];
  readonly omitted_members: readonly string[];
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
  readonly partial_class?: PartialClassAuthority;
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

interface TypeScriptExtensionRow {
  readonly typescript_symbol: string;
  readonly export_path: "." | "./web";
  readonly kind: "type";
  readonly owner_phase: 1 | 2 | 3 | 4;
  readonly status: "planned" | "complete";
  readonly rationale: string;
  readonly contract_test: string;
  readonly no_python_counterpart: true;
}

interface TypeScriptExtensions {
  readonly schema_version: number;
  readonly extensions: readonly TypeScriptExtensionRow[];
}

interface RuntimeNormalizationAuthority {
  readonly schema_version: 1;
  readonly constructor_options: {
    readonly code: "idm_modbus_client_options";
    readonly python_parameters: readonly string[];
    readonly typescript_required: readonly string[];
    readonly typescript_options: readonly string[];
    readonly internalized: {
      readonly code: "internal_adapter_retries_zero";
      readonly pymodbusRetries: 0;
    };
    readonly forbidden_public_options: readonly string[];
  };
  readonly transport_error_type_to_closed_kind: {
    readonly code: "transport_error_type_to_closed_kind";
    readonly kinds: readonly string[];
    readonly rules: readonly {
      readonly source: string;
      readonly kind: string;
    }[];
    readonly forbidden_equivalence: readonly string[];
  };
  readonly diagnostic_message_redaction: {
    readonly code: "diagnostic_message_redaction";
    readonly python_candidates: readonly string[];
    readonly typescript_candidates: readonly string[];
    readonly order: "longest_first";
    readonly placeholder: "<endpoint>";
    readonly preserve_remaining_text_and_order: true;
    readonly maximum_output_length: 1024;
    readonly overlong_behavior: "reject";
    readonly include_raw_cause: false;
    readonly include_raw_payload: false;
  };
}

const RUNTIME_NORMALIZATION_START = "<!-- runtime-normalization-contract:start -->";
const RUNTIME_NORMALIZATION_END = "<!-- runtime-normalization-contract:end -->";
const RUNTIME_NORMALIZATION_AUTHORITY: RuntimeNormalizationAuthority = {
  schema_version: 1,
  constructor_options: {
    code: "idm_modbus_client_options",
    python_parameters: [
      "host",
      "port",
      "slave_id",
      "timeout",
      "max_retries",
      "pymodbus_retries",
      "max_group_size",
    ],
    typescript_required: ["host"],
    typescript_options: ["port", "slaveId", "timeout", "maxRetries", "maxGroupSize"],
    internalized: {
      code: "internal_adapter_retries_zero",
      pymodbusRetries: 0,
    },
    forbidden_public_options: [
      "transport",
      "transportFactory",
      "clock",
      "sleep",
      "pymodbusRetries",
    ],
  },
  transport_error_type_to_closed_kind: {
    code: "transport_error_type_to_closed_kind",
    kinds: [
      "timeout",
      "disconnected",
      "socket",
      "no_response",
      "modbus",
      "illegal_address",
      "invalid_response",
    ],
    rules: [
      { source: "numeric_modbus_exception_code_2", kind: "illegal_address" },
      { source: "structured_illegal_address_marker", kind: "illegal_address" },
      { source: "timeout_exception", kind: "timeout" },
      { source: "connection_exception", kind: "disconnected" },
      { source: "socket_or_os_error", kind: "socket" },
      {
        source: "modbus_io_exception_or_structured_no_response",
        kind: "no_response",
      },
      { source: "other_modbus_exception", kind: "modbus" },
      { source: "malformed_response", kind: "invalid_response" },
    ],
    forbidden_equivalence: [
      "exception_class_name",
      "message_substring",
      "case_folding",
      "undocumented_fallback",
    ],
  },
  diagnostic_message_redaction: {
    code: "diagnostic_message_redaction",
    python_candidates: [
      "configured_host:configured_port",
      "[configured_host]:configured_port",
      "configured_host",
    ],
    typescript_candidates: [
      "configured_host:configured_port",
      "[configured_host]:configured_port",
      "configured_host",
    ],
    order: "longest_first",
    placeholder: "<endpoint>",
    preserve_remaining_text_and_order: true,
    maximum_output_length: 1024,
    overlong_behavior: "reject",
    include_raw_cause: false,
    include_raw_payload: false,
  },
};

const MODBUS_TRANSPORT_EXTENSION: TypeScriptExtensions = {
  schema_version: 1,
  extensions: [
    {
      typescript_symbol: "ModbusTransport",
      export_path: ".",
      kind: "type",
      owner_phase: 2,
      status: "complete",
      rationale:
        "Node transport abstraction required for deterministic runtime parity without exposing the concrete adapter.",
      contract_test: "test/parity/transport-contract.test.ts",
      no_python_counterpart: true,
    },
  ],
};
const IDM_MODBUS_IMPLEMENTED_MEMBERS = [
  "clearLastErrorContext",
  "connect",
  "decodeValue",
  "detectModel",
  "disconnect",
  "encodeValue",
  "forceReconnect",
  "getBatchUnsafeRegisters",
  "getDiagnostics",
  "getLastErrorContext",
  "getUnsupportedRegisters",
  "host",
  "isConnected",
  "markBatchUnsafe",
  "modelInfo",
  "modelName",
  "port",
  "probeRegister",
  "readBatch",
  "readRegister",
  "readValue",
  "resetFailedRegisters",
] as const;
const IDM_MODBUS_OMITTED_MEMBERS = [
  "getActiveCyclicWrites",
  "getExpiredCyclicWrites",
  "resetCyclicWriteState",
  "resetWriteThrottle",
  "setValue",
  "simulateWrite",
  "writeRegister",
] as const;

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

function prepareReleaseMapping(project: string, contractTest: string): void {
  mutateProjectJson<ApiMapping>(project, "contracts/api-mapping.json", (mapping) => {
    for (const row of mapping.mappings as ApiMappingRow[]) {
      if (row.status === "planned" || row.status === "partial") {
        (row as { status: string }).status = "not_applicable";
        (row as { not_applicable_rationale?: string }).not_applicable_rationale =
          "Test-only reviewed release fixture for standalone evidence validation.";
        delete (row as unknown as Record<string, unknown>).partial_class;
      }
    }
    const complete = requireDefined(
      mapping.mappings.find(({ status }) => status === "complete"),
      "complete mapping row",
    );
    (complete as { contract_test: string }).contract_test = contractTest;
  });
  mutateProjectJson<{ parity_status: string }>(project, "UPSTREAM-PARITY.json", (manifest) => {
    manifest.parity_status = "complete";
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

function writeExtensionAuthority(
  project: string,
  extensions: TypeScriptExtensions = MODBUS_TRANSPORT_EXTENSION,
): void {
  const path = resolve(project, "contracts/typescript-extensions.json");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(extensions, undefined, 2)}\n`);
}

function preparePartialIdmModbusClient(project: string): void {
  mutateProjectJson<ApiMapping>(project, "contracts/api-mapping.json", (mapping) => {
    const client = requireDefined(
      mapping.mappings.find(({ python_symbol }) => python_symbol === "IdmModbusClient"),
      "IdmModbusClient mapping row",
    );
    (client as { status: string }).status = "partial";
    (client as { partial_class?: PartialClassAuthority }).partial_class = {
      implemented_members: [...IDM_MODBUS_IMPLEMENTED_MEMBERS],
      omitted_members: [...IDM_MODBUS_OMITTED_MEMBERS],
    };
  });
}

function writeRuntimeNormalizationAuthority(
  project: string,
  authority: RuntimeNormalizationAuthority = RUNTIME_NORMALIZATION_AUTHORITY,
): void {
  const path = resolve(project, "contracts/normalization.md");
  const source = readFileSync(path, "utf8");
  const block = [
    RUNTIME_NORMALIZATION_START,
    "```json",
    JSON.stringify(authority, undefined, 2),
    "```",
    RUNTIME_NORMALIZATION_END,
  ].join("\n");
  const start = source.indexOf(RUNTIME_NORMALIZATION_START);
  const end = source.indexOf(RUNTIME_NORMALIZATION_END);
  const next =
    start === -1 || end === -1
      ? `${source.trimEnd()}\n\n${block}\n`
      : `${source.slice(0, start)}${block}${source.slice(end + RUNTIME_NORMALIZATION_END.length)}`;
  writeFileSync(path, next);
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

  it("mapping promotion completes the exact fully evidenced Phase-1 and Phase-2 surface", () => {
    const allowedNormalizations = new Set([
      "diagnostic_message_redaction",
      "enum_to_const_union",
      "idm_modbus_client_options",
      "internal_adapter_retries_zero",
      "list_to_readonly_array",
      "mapping_to_readonly_map_or_record",
      "none_to_null",
      "python_alias_to_typescript_alias",
      "python_dataclass_to_readonly_object_factory",
      "python_exception_to_error_class",
      "set_to_immutable_set_like",
      "snake_case_to_camelCase",
      "transport_error_type_to_closed_kind",
      "tuple_to_readonly_array",
    ]);
    const counterpartKeys = new Set<string>();
    const completedRows = apiMapping.mappings.filter(({ status }) => status === "complete");

    expect(completedRows).toHaveLength(57);
    expect(completedRows.map(({ python_symbol }) => python_symbol)).toEqual(
      apiMapping.mappings
        .filter(
          ({ owner_phase, python_symbol }) =>
            owner_phase === 1 ||
            (owner_phase === 2 && python_symbol !== "IdmModbusClient"),
        )
        .map(({ python_symbol }) => python_symbol),
    );

    for (const row of apiMapping.mappings) {
      const expectedStatus =
        row.owner_phase <= 2
          ? row.python_symbol === "IdmModbusClient"
            ? "partial"
            : "complete"
          : "planned";
      expect(row.status, row.python_symbol).toBe(expectedStatus);
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

  it("uses exact focused evidence for every completed Phase-2 Python row", () => {
    const phaseTwo = Object.fromEntries(
      apiMapping.mappings
        .filter(({ owner_phase }) => owner_phase === 2)
        .map((row) => [row.python_symbol, row]),
    );

    expect(Object.keys(phaseTwo)).toEqual([
      "IdmClientDiagnostics",
      "IdmModbusClient",
      "IllegalAddressError",
      "ModbusErrorContext",
      "quiet_pymodbus_logging",
    ]);
    expect(phaseTwo.IdmClientDiagnostics).toMatchObject({
      status: "complete",
      contract_test: "test/client/diagnostics.test.ts",
    });
    expect(phaseTwo.IllegalAddressError).toMatchObject({
      status: "complete",
      contract_test: "test/client/errors.test.ts",
    });
    expect(phaseTwo.ModbusErrorContext).toMatchObject({
      status: "complete",
      contract_test: "test/client/diagnostics.test.ts",
    });
    expect(phaseTwo.quiet_pymodbus_logging).toMatchObject({
      status: "complete",
      contract_test: "test/client/errors.test.ts",
    });
    expect(phaseTwo.IdmModbusClient).toMatchObject({
      status: "partial",
      contract_test: "test/parity/transport-contract.test.ts",
    });
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

  it("later-owned runtime classes remain planned and absent from package entry points", () => {
    const rootSource = readFileSync(resolve(ROOT, "src/index.ts"), "utf8");
    const webSource = readFileSync(resolve(ROOT, "src/web/index.ts"), "utf8");
    const laterRows = apiMapping.mappings.filter(({ owner_phase }) => owner_phase > 2);

    expect(laterRows.length).toBeGreaterThan(0);
    for (const row of laterRows) {
      expect(row.status, row.python_symbol).toBe("planned");
      expect(rootSource, row.typescript_symbol).not.toContain(row.typescript_symbol);
      expect(webSource, row.typescript_symbol).not.toContain(row.typescript_symbol);
    }
  });
});

describe("checked mapping export closure", () => {
  it("keeps the existing Phase-1 runtime surface before final Phase-2 promotion", () => {
    const expectedRuntimeSymbols = apiMapping.mappings
      .filter(({ export_path, owner_phase }) => export_path === "." && owner_phase === 1)
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
    for (const row of apiMapping.mappings.filter(
      ({ owner_phase, python_symbol }) =>
        owner_phase > 1 && python_symbol !== "IdmModbusClient",
    )) {
      expect(rootExports, row.typescript_symbol).not.toHaveProperty(row.typescript_symbol);
      expect(webExports, row.typescript_symbol).not.toHaveProperty(row.typescript_symbol);
      expect(rootSource, row.typescript_symbol).not.toContain(row.typescript_symbol);
      expect(webSource, row.typescript_symbol).not.toContain(row.typescript_symbol);
    }
  });
});

describe("generated API and baseline documentation", () => {
  it("keeps the exact 89-row Python inventory separate from additive extension and partial authorities", () => {
    const project = createGeneratorProject();
    writeExtensionAuthority(project);
    preparePartialIdmModbusClient(project);

    requireSuccess(runGenerator(project), "partial and extension development generation");

    const mapping = JSON.parse(
      readFileSync(resolve(project, "contracts/api-mapping.json"), "utf8"),
    ) as ApiMapping;
    const apiDocument = readFileSync(resolve(project, "docs/API-PARITY.md"), "utf8");

    expect(mapping.mappings).toHaveLength(89);
    expect(mapping.mappings.map(({ python_symbol }) => python_symbol)).toEqual(
      publicApi.symbols.map(({ name }) => name),
    );
    expect(apiDocument).toContain("## TypeScript-only extensions");
    expect(apiDocument).toContain("`ModbusTransport`");
    expect(apiDocument).toContain("no Python counterpart");
    expect(apiDocument).toContain("## Partial class lifecycle");
    expect(apiDocument).toContain("`IdmModbusClient`");
    expect(apiDocument).toContain("22 implemented, 7 omitted");
  });

  it("rejects unknown, missing, duplicate, fabricated, and invalid-evidence extensions", () => {
    const cases: readonly {
      readonly code: string;
      readonly mutate: (extensions: TypeScriptExtensions) => void;
    }[] = [
      {
        code: "extension_schema_invalid",
        mutate(extensions) {
          (
            extensions.extensions[0] as TypeScriptExtensionRow & { unexpected?: boolean }
          ).unexpected = true;
        },
      },
      {
        code: "extension_schema_invalid",
        mutate(extensions) {
          delete (extensions.extensions[0] as unknown as Record<string, unknown>).rationale;
        },
      },
      {
        code: "extension_duplicate_typescript_symbol",
        mutate(extensions) {
          (extensions.extensions as TypeScriptExtensionRow[]).push({
            ...requireDefined(extensions.extensions[0], "first extension row"),
          });
        },
      },
      {
        code: "extension_python_inventory_collision",
        mutate(extensions) {
          (extensions.extensions[0] as { typescript_symbol: string }).typescript_symbol =
            "IdmModbusClient";
        },
      },
      {
        code: "extension_schema_invalid",
        mutate(extensions) {
          (extensions.extensions[0] as { no_python_counterpart: boolean }).no_python_counterpart =
            false;
        },
      },
      {
        code: "extension_schema_invalid",
        mutate(extensions) {
          (extensions.extensions[0] as { contract_test: string }).contract_test =
            "../outside.test.ts";
        },
      },
    ];

    for (const testCase of cases) {
      const project = createGeneratorProject();
      const extensions = structuredClone(MODBUS_TRANSPORT_EXTENSION);
      testCase.mutate(extensions);
      writeExtensionAuthority(project, extensions);
      const result = runGenerator(project);
      expect(result.status, testCase.code).not.toBe(0);
      expect(result.stderr, testCase.code).toContain(testCase.code);
    }
  });

  it("rejects partial class gaps, overlap, duplicates, and fabricated members", () => {
    const cases: readonly {
      readonly mutate: (partial: {
        implemented_members: string[];
        omitted_members: string[];
      }) => void;
    }[] = [
      {
        mutate(partial) {
          partial.implemented_members.pop();
        },
      },
      {
        mutate(partial) {
          partial.omitted_members.push(requireDefined(partial.implemented_members[0], "member"));
        },
      },
      {
        mutate(partial) {
          partial.implemented_members.push(
            requireDefined(partial.implemented_members[0], "member"),
          );
        },
      },
      {
        mutate(partial) {
          partial.implemented_members[0] = "fabricatedMember";
        },
      },
    ];

    for (const testCase of cases) {
      const project = createGeneratorProject();
      writeExtensionAuthority(project);
      preparePartialIdmModbusClient(project);
      mutateProjectJson<ApiMapping>(project, "contracts/api-mapping.json", (mapping) => {
        const client = requireDefined(
          mapping.mappings.find(({ python_symbol }) => python_symbol === "IdmModbusClient"),
          "IdmModbusClient mapping row",
        );
        const partial = requireDefined(client.partial_class, "partial class authority") as {
          implemented_members: string[];
          omitted_members: string[];
        };
        testCase.mutate(partial);
      });
      const result = runGenerator(project);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("mapping_partial_class_invalid");
    }
  });

  it("release mode rejects every partial mapping and incomplete extension", () => {
    const partialProject = createGeneratorProject();
    writeExtensionAuthority(partialProject, {
      ...MODBUS_TRANSPORT_EXTENSION,
      extensions: [
        {
          ...requireDefined(MODBUS_TRANSPORT_EXTENSION.extensions[0], "ModbusTransport extension"),
          status: "complete",
          contract_test: "test/semantic/constants-and-types.test.ts",
        },
      ],
    });
    preparePartialIdmModbusClient(partialProject);
    mutateProjectJson<{ parity_status: string }>(
      partialProject,
      "UPSTREAM-PARITY.json",
      (manifest) => {
        manifest.parity_status = "complete";
      },
    );
    const partialResult = runGenerator(partialProject, ["--release"]);
    expect(partialResult.status).not.toBe(0);
    expect(partialResult.stderr).toContain("mapping_release_status_incomplete");

    const extensionProject = createGeneratorProject();
    writeExtensionAuthority(extensionProject, {
      ...MODBUS_TRANSPORT_EXTENSION,
      extensions: [
        {
          ...requireDefined(MODBUS_TRANSPORT_EXTENSION.extensions[0], "ModbusTransport extension"),
          status: "planned",
        },
      ],
    });
    prepareReleaseMapping(extensionProject, "test/semantic/constants-and-types.test.ts");
    const extensionResult = runGenerator(extensionProject, ["--release"]);
    expect(extensionResult.status).not.toBe(0);
    expect(extensionResult.stderr).toContain("extension_release_status_incomplete");
  });

  it("documents one exact public constructor and closed runtime error normalization authority", () => {
    const project = createGeneratorProject();
    writeRuntimeNormalizationAuthority(project);
    requireSuccess(runGenerator(project), "runtime normalization generation");

    const apiDocument = readFileSync(resolve(project, "docs/API-PARITY.md"), "utf8");
    expect(apiDocument).toContain("## Runtime normalization authority");
    expect(apiDocument).toContain("`host` plus mapped options");
    expect(apiDocument).toContain("`port`, `slaveId`, `timeout`, `maxRetries`, `maxGroupSize`");
    expect(apiDocument).toContain("pymodbus adapter retries are internalized at `0`");
    for (const kind of RUNTIME_NORMALIZATION_AUTHORITY.transport_error_type_to_closed_kind.kinds) {
      expect(apiDocument).toContain(`\`${kind}\``);
    }
    expect(apiDocument).toContain("`<endpoint>`");
    expect(apiDocument).toContain("1024");
  });

  it("rejects extra constructor injection options and non-zero public adapter retries", () => {
    const cases: readonly ((authority: RuntimeNormalizationAuthority) => void)[] = [
      (authority) => {
        (authority.constructor_options.typescript_options as string[]).push("transportFactory");
      },
      (authority) => {
        (
          authority.constructor_options.internalized as { pymodbusRetries: number }
        ).pymodbusRetries = 1;
      },
      (authority) => {
        (authority.constructor_options.forbidden_public_options as string[]).splice(
          authority.constructor_options.forbidden_public_options.indexOf("clock"),
          1,
        );
      },
    ];

    for (const mutate of cases) {
      const project = createGeneratorProject();
      const authority = structuredClone(RUNTIME_NORMALIZATION_AUTHORITY);
      mutate(authority);
      writeRuntimeNormalizationAuthority(project, authority);
      const result = runGenerator(project);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("runtime_normalization_invalid");
    }
  });

  it("rejects unknown error kinds, message-only Code 2, and undocumented fallback equivalence", () => {
    const cases: readonly ((authority: RuntimeNormalizationAuthority) => void)[] = [
      (authority) => {
        (authority.transport_error_type_to_closed_kind.kinds as string[]).push("mystery");
      },
      (authority) => {
        (
          authority.transport_error_type_to_closed_kind.rules[0] as {
            source: string;
          }
        ).source = "message_contains_illegal_data_address";
      },
      (authority) => {
        (authority.transport_error_type_to_closed_kind.forbidden_equivalence as string[]).pop();
      },
    ];

    for (const mutate of cases) {
      const project = createGeneratorProject();
      const authority = structuredClone(RUNTIME_NORMALIZATION_AUTHORITY);
      mutate(authority);
      writeRuntimeNormalizationAuthority(project, authority);
      const result = runGenerator(project);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("runtime_normalization_invalid");
    }
  });

  it("rejects asymmetric redaction, alternate placeholders, and overlong diagnostic policy drift", () => {
    const cases: readonly ((authority: RuntimeNormalizationAuthority) => void)[] = [
      (authority) => {
        (authority.diagnostic_message_redaction.typescript_candidates as string[]).pop();
      },
      (authority) => {
        (
          authority.diagnostic_message_redaction as {
            placeholder: string;
          }
        ).placeholder = "[redacted]";
      },
      (authority) => {
        (
          authority.diagnostic_message_redaction as {
            maximum_output_length: number;
          }
        ).maximum_output_length = 2048;
      },
      (authority) => {
        (
          authority.diagnostic_message_redaction as {
            overlong_behavior: string;
          }
        ).overlong_behavior = "truncate";
      },
    ];

    for (const mutate of cases) {
      const project = createGeneratorProject();
      const authority = structuredClone(RUNTIME_NORMALIZATION_AUTHORITY);
      mutate(authority);
      writeRuntimeNormalizationAuthority(project, authority);
      const result = runGenerator(project);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("runtime_normalization_invalid");
    }
  });

  it("release mode rejects escaped, directory, symlink, empty, and oversized evidence", () => {
    const cases: readonly {
      readonly path: string;
      readonly setup?: (project: string, path: string) => void;
    }[] = [
      { path: "test/../../outside.test.ts" },
      {
        path: "test/evidence/directory.test.ts",
        setup: (project, path) => mkdirSync(resolve(project, path), { recursive: true }),
      },
      {
        path: "test/evidence/symlink.test.ts",
        setup(project, path) {
          mkdirSync(dirname(resolve(project, path)), { recursive: true });
          if (process.platform === "win32") {
            symlinkSync(resolve(project, "test/registers"), resolve(project, path), "junction");
          } else {
            symlinkSync(
              resolve(project, "test/registers/register-def.test.ts"),
              resolve(project, path),
              "file",
            );
          }
        },
      },
      {
        path: "test/evidence/empty.test.ts",
        setup(project, path) {
          mkdirSync(dirname(resolve(project, path)), { recursive: true });
          writeFileSync(resolve(project, path), "");
        },
      },
      {
        path: "test/evidence/oversized.test.ts",
        setup(project, path) {
          mkdirSync(dirname(resolve(project, path)), { recursive: true });
          writeFileSync(resolve(project, path), "x");
          truncateSync(resolve(project, path), 16 * 1024 * 1024 + 1);
        },
      },
    ];

    for (const testCase of cases) {
      const project = createGeneratorProject();
      testCase.setup?.(project, testCase.path);
      prepareReleaseMapping(project, testCase.path);
      const result = runGenerator(project, ["--release"]);
      expect(result.status, testCase.path).not.toBe(0);
      expect(result.stderr, testCase.path).toMatch(/mapping_(?:schema|complete_evidence)_invalid/u);
    }
  });

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
    expect(source).toContain('"contracts/normalization.md"');
    expect(source).toContain('"contracts/typescript-extensions.json"');
    expect(source).toContain('"docs/API-PARITY.md"');
    expect(source).toContain('"docs/BASELINE.md"');
  });
});
