import { Buffer } from "node:buffer";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { isEvidenceTestPath, validateEvidencePath } from "./evidence-path.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PATHS = Object.freeze({
  mapping: resolve(ROOT, "contracts/api-mapping.json"),
  normalization: resolve(ROOT, "contracts/normalization.md"),
  extensions: resolve(ROOT, "contracts/typescript-extensions.json"),
  publicApi: resolve(ROOT, "test/fixtures/public-api.json"),
  publicClasses: resolve(ROOT, "test/fixtures/public-classes.json"),
  manifest: resolve(ROOT, "UPSTREAM-PARITY.json"),
  apiDocument: resolve(ROOT, "docs/API-PARITY.md"),
  baselineDocument: resolve(ROOT, "docs/BASELINE.md"),
});
const MAX_JSON_BYTES = 4 * 1024 * 1024;
const MAX_STRING_LENGTH = 1024;
const EXPECTED_SYMBOL_COUNT = 89;
const EXPECTED_ROOT_COUNT = 59;
const EXPECTED_WEB_COUNT = 30;
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/u;
const CAMEL_IDENTIFIER = /^[A-Za-z][A-Za-z0-9]*$/u;
const ALLOWED_STATUSES = new Set(["planned", "partial", "complete", "not_applicable"]);
const ALLOWED_NORMALIZATIONS = new Set([
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
const ALLOWED_REPRESENTATIONS = new Set([
  "alias",
  "class",
  "error_class",
  "frozen_const_and_union",
  "frozen_constant",
  "function",
  "readonly_map",
  "readonly_object_factory",
]);
const ALLOWED_CONSTRUCTORS = new Set(["class", "factory", "not_constructible", "value"]);
const ALLOWED_EXTENSION_STATUSES = new Set(["planned", "complete"]);
const RUNTIME_NORMALIZATION_START = "<!-- runtime-normalization-contract:start -->";
const RUNTIME_NORMALIZATION_END = "<!-- runtime-normalization-contract:end -->";
const EXPECTED_RUNTIME_NORMALIZATION = Object.freeze({
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
});
const NODE_DECISION_KEYS = new Set([
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
]);

class ContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ContractError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new ContractError(code, message);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function own(record, key) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function boundedString(value, label, code, maximum = MAX_STRING_LENGTH) {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum) {
    fail(code, `${label} must be a non-empty string of at most ${maximum} characters`);
  }
  return value;
}

function assertExactKeys(value, required, optional, code, label) {
  if (!isRecord(value)) {
    fail(code, `${label} must be an object`);
  }
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      fail(code, `${label} has unknown field ${key}`);
    }
  }
  for (const key of required) {
    if (!own(value, key)) {
      fail(code, `${label} is missing field ${key}`);
    }
  }
}

function readJson(path, label) {
  const bytes = readFileSync(path);
  if (bytes.length === 0 || bytes.length > MAX_JSON_BYTES) {
    fail("input_size_invalid", `${label} must be between 1 and ${MAX_JSON_BYTES} bytes`);
  }
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    fail("input_json_invalid", `${label} is not valid JSON: ${String(error)}`);
  }
}

function canonical(value) {
  return JSON.stringify(value);
}

function structuralCanonical(value) {
  if (Array.isArray(value)) {
    return value.map(structuralCanonical);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, structuralCanonical(value[key])]),
    );
  }
  return value;
}

function baselineFromManifest(manifest) {
  return Object.freeze({
    repository: manifest.repository,
    python_package: manifest.python_package,
    python_version: manifest.python_version,
    git_tag: manifest.git_tag,
    git_commit: manifest.git_commit,
    parity_schema_version: manifest.schema_version,
  });
}

function validateManifest(value) {
  const fields = [
    "schema_version",
    "repository",
    "python_package",
    "python_version",
    "git_tag",
    "git_commit",
    "parity_status",
    "verified_on",
  ];
  assertExactKeys(value, fields, [], "baseline_manifest_invalid", "UPSTREAM-PARITY.json");
  if (value.schema_version !== 1) {
    fail("baseline_manifest_invalid", "Unsupported baseline schema version");
  }
  for (const field of fields.slice(1)) {
    boundedString(value[field], `manifest.${field}`, "baseline_manifest_invalid", 256);
  }
  if (!/^\d+\.\d+\.\d+(?:[A-Za-z0-9.-]+)?$/u.test(value.python_version)) {
    fail("baseline_manifest_invalid", "Malformed Python version");
  }
  if (value.git_tag !== `v${value.python_version}`) {
    fail("baseline_manifest_invalid", "Baseline tag and Python version differ");
  }
  if (!/^[0-9a-f]{40}$/u.test(value.git_commit)) {
    fail("baseline_manifest_invalid", "Baseline must use a full lowercase commit SHA");
  }
  if (!new Set(["planned", "partial", "complete"]).has(value.parity_status)) {
    fail("baseline_manifest_invalid", "Unsupported baseline parity status");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value.verified_on)) {
    fail("baseline_manifest_invalid", "Malformed baseline verification date");
  }
  return value;
}

function validateBaseline(value, expected, code, label) {
  const fields = [
    "repository",
    "python_package",
    "python_version",
    "git_tag",
    "git_commit",
    "parity_schema_version",
  ];
  assertExactKeys(value, fields, [], code, label);
  for (const field of fields) {
    if (value[field] !== expected[field]) {
      fail(code, `${label} does not match UPSTREAM-PARITY.json`);
    }
  }
}

function validatePublicApi(value, expectedBaseline) {
  assertExactKeys(
    value,
    ["aliases", "baseline", "counts", "generator_version", "schema_version", "symbols"],
    [],
    "public_inventory_invalid",
    "public-api.json",
  );
  if (value.schema_version !== 1 || value.generator_version !== "1") {
    fail("public_inventory_invalid", "Unsupported public inventory version");
  }
  validateBaseline(
    value.baseline,
    expectedBaseline,
    "baseline_inventory_mismatch",
    "public API baseline",
  );
  assertExactKeys(
    value.counts,
    ["root", "total", "web"],
    [],
    "public_inventory_invalid",
    "public API counts",
  );
  if (!Array.isArray(value.symbols) || !Array.isArray(value.aliases)) {
    fail("public_inventory_invalid", "Public symbols and aliases must be arrays");
  }
  const names = new Set();
  let rootCount = 0;
  let webCount = 0;
  for (const [index, symbol] of value.symbols.entries()) {
    assertExactKeys(
      symbol,
      ["export_boundary", "name", "python_kind", "source_group"],
      [],
      "public_inventory_invalid",
      `public symbol ${index}`,
    );
    boundedString(symbol.name, `public symbol ${index}.name`, "public_inventory_invalid", 128);
    if (names.has(symbol.name)) {
      fail("public_inventory_invalid", `Duplicate public symbol ${symbol.name}`);
    }
    names.add(symbol.name);
    if (!new Set(["class", "constant", "function"]).has(symbol.python_kind)) {
      fail("public_inventory_invalid", `Invalid kind for ${symbol.name}`);
    }
    if (!new Set(["client", "const", "registers", "web"]).has(symbol.source_group)) {
      fail("public_inventory_invalid", `Invalid source group for ${symbol.name}`);
    }
    if (symbol.export_boundary === ".") {
      rootCount += 1;
    } else if (symbol.export_boundary === "./web") {
      webCount += 1;
    } else {
      fail("public_inventory_invalid", `Invalid export boundary for ${symbol.name}`);
    }
    if ((symbol.source_group === "web") !== (symbol.export_boundary === "./web")) {
      fail(
        "public_inventory_invalid",
        `Source group and export boundary differ for ${symbol.name}`,
      );
    }
  }
  if (
    names.size !== EXPECTED_SYMBOL_COUNT ||
    rootCount !== EXPECTED_ROOT_COUNT ||
    webCount !== EXPECTED_WEB_COUNT ||
    value.counts.total !== names.size ||
    value.counts.root !== rootCount ||
    value.counts.web !== webCount
  ) {
    fail("public_inventory_invalid", "Public inventory must contain exactly 89/59/30 symbols");
  }
  const aliases = new Map();
  for (const [index, alias] of value.aliases.entries()) {
    assertExactKeys(
      alias,
      ["name", "target"],
      [],
      "public_inventory_invalid",
      `public alias ${index}`,
    );
    if (!names.has(alias.name) || !names.has(alias.target) || aliases.has(alias.name)) {
      fail("public_inventory_invalid", `Invalid public alias ${String(alias.name)}`);
    }
    aliases.set(alias.name, alias.target);
  }
  if (aliases.size !== 7) {
    fail("public_inventory_invalid", "Public inventory must retain all seven web aliases");
  }
  return { ...value, aliasesByName: aliases, names };
}

function collectKeys(value, target = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, target);
    }
  } else if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      target.add(key);
      collectKeys(item, target);
    }
  }
  return target;
}

function validateParameter(parameter, label) {
  assertExactKeys(
    parameter,
    ["annotation", "default", "kind", "name"],
    [],
    "public_class_inventory_invalid",
    label,
  );
  boundedString(parameter.name, `${label}.name`, "public_class_inventory_invalid", 128);
  boundedString(parameter.kind, `${label}.kind`, "public_class_inventory_invalid", 64);
  if (!(parameter.annotation === null || typeof parameter.annotation === "string")) {
    fail("public_class_inventory_invalid", `${label}.annotation is invalid`);
  }
  if (!isRecord(parameter.default) || typeof parameter.default.kind !== "string") {
    fail("public_class_inventory_invalid", `${label}.default is invalid`);
  }
}

function validateMember(member, label) {
  if (
    !isRecord(member) ||
    !new Set(["attribute", "method", "property", "staticmethod"]).has(member.kind)
  ) {
    fail("public_class_inventory_invalid", `${label} has invalid member kind`);
  }
  const schemas = {
    attribute: ["annotation", "default", "init", "kind", "name"],
    method: ["kind", "name", "parameters", "return_annotation", "signature"],
    property: ["kind", "name", "readable", "return_annotation", "writable"],
    staticmethod: ["kind", "name", "parameters", "return_annotation", "signature"],
  };
  assertExactKeys(member, schemas[member.kind], [], "public_class_inventory_invalid", label);
  boundedString(member.name, `${label}.name`, "public_class_inventory_invalid", 128);
  if (member.kind === "method" || member.kind === "staticmethod") {
    if (!Array.isArray(member.parameters)) {
      fail("public_class_inventory_invalid", `${label}.parameters must be an array`);
    }
    member.parameters.forEach((parameter, index) =>
      validateParameter(parameter, `${label} parameter ${index}`),
    );
  }
}

function validatePublicClasses(value, expectedBaseline) {
  assertExactKeys(
    value,
    ["baseline", "classes", "generator_version", "schema_version"],
    [],
    "public_class_inventory_invalid",
    "public-classes.json",
  );
  if (
    value.schema_version !== 1 ||
    value.generator_version !== "1" ||
    !Array.isArray(value.classes)
  ) {
    fail("public_class_inventory_invalid", "Unsupported public class inventory");
  }
  validateBaseline(
    value.baseline,
    expectedBaseline,
    "baseline_inventory_mismatch",
    "public class baseline",
  );
  for (const key of collectKeys(value)) {
    if (NODE_DECISION_KEYS.has(key)) {
      fail("public_class_node_decision_leak", `Python class facts contain Node-only field ${key}`);
    }
  }
  const byPublicName = new Map();
  for (const [index, classFact] of value.classes.entries()) {
    const label = `public class ${index}`;
    assertExactKeys(
      classFact,
      [
        "constructor",
        "members",
        "public_names",
        "python_module",
        "python_name",
        "source_group",
        "validation_boundaries",
      ],
      [],
      "public_class_inventory_invalid",
      label,
    );
    assertExactKeys(
      classFact.constructor,
      ["parameters", "return_annotation", "signature", "source"],
      [],
      "public_class_inventory_invalid",
      `${label}.constructor`,
    );
    if (
      !Array.isArray(classFact.constructor.parameters) ||
      !Array.isArray(classFact.members) ||
      !Array.isArray(classFact.public_names) ||
      !Array.isArray(classFact.validation_boundaries) ||
      classFact.validation_boundaries.length === 0
    ) {
      fail("public_class_inventory_invalid", `${label} arrays are invalid`);
    }
    boundedString(
      classFact.python_name,
      `${label}.python_name`,
      "public_class_inventory_invalid",
      128,
    );
    boundedString(
      classFact.constructor.signature,
      `${label}.signature`,
      "public_class_inventory_invalid",
    );
    classFact.constructor.parameters.forEach((parameter, parameterIndex) =>
      validateParameter(parameter, `${label} constructor parameter ${parameterIndex}`),
    );
    classFact.members.forEach((member, memberIndex) =>
      validateMember(member, `${label} member ${memberIndex}`),
    );
    for (const publicName of classFact.public_names) {
      boundedString(publicName, `${label}.public_name`, "public_class_inventory_invalid", 128);
      if (byPublicName.has(publicName)) {
        fail("public_class_inventory_invalid", `Duplicate class public name ${publicName}`);
      }
      byPublicName.set(publicName, classFact);
    }
  }
  return { ...value, byPublicName };
}

function camelCase(name) {
  return name.replace(/_([a-z0-9])/gu, (_, character) => character.toUpperCase());
}

function memberCounterpart(row, pythonName) {
  if (
    isRecord(row.representation.member_overrides) &&
    own(row.representation.member_overrides, pythonName)
  ) {
    return row.representation.member_overrides[pythonName];
  }
  return row.representation.member_naming === "snake_case_to_camelCase"
    ? camelCase(pythonName)
    : pythonName;
}

function validateRepresentation(row, classFact) {
  const representation = row.representation;
  assertExactKeys(
    representation,
    ["form", "constructor", "validation"],
    ["alias_of", "member_naming", "member_overrides", "python_class"],
    "mapping_representation_invalid",
    `${row.python_symbol}.representation`,
  );
  if (!ALLOWED_REPRESENTATIONS.has(representation.form)) {
    fail("mapping_representation_invalid", `Invalid representation for ${row.python_symbol}`);
  }
  if (!ALLOWED_CONSTRUCTORS.has(representation.constructor)) {
    fail(
      "mapping_representation_invalid",
      `Invalid constructor representation for ${row.python_symbol}`,
    );
  }
  const expectedValidation =
    row.kind === "class"
      ? "python_fixture"
      : row.kind === "constant"
        ? "constant_fixture"
        : "function_fixture";
  if (representation.validation !== expectedValidation) {
    fail("mapping_representation_invalid", `Invalid validation authority for ${row.python_symbol}`);
  }
  if (row.kind !== "class") {
    if (representation.python_class !== undefined || representation.member_naming !== undefined) {
      fail("mapping_representation_invalid", `Non-class ${row.python_symbol} has class decisions`);
    }
    return;
  }
  if (classFact === undefined || representation.python_class !== classFact.python_name) {
    fail("mapping_class_inventory_mismatch", `Class facts do not match ${row.python_symbol}`);
  }
  if (!new Set(["preserve", "snake_case_to_camelCase"]).has(representation.member_naming)) {
    fail(
      "mapping_class_inventory_mismatch",
      `Class member naming is missing for ${row.python_symbol}`,
    );
  }
  const pythonNames = new Set([
    ...classFact.constructor.parameters.map(({ name }) => name),
    ...classFact.members.map(({ name }) => name),
  ]);
  if (representation.member_overrides !== undefined) {
    if (!isRecord(representation.member_overrides)) {
      fail(
        "mapping_class_inventory_mismatch",
        `Member overrides are invalid for ${row.python_symbol}`,
      );
    }
    for (const [pythonName, typescriptName] of Object.entries(representation.member_overrides)) {
      if (
        !pythonNames.has(pythonName) ||
        typeof typescriptName !== "string" ||
        !CAMEL_IDENTIFIER.test(typescriptName)
      ) {
        fail(
          "mapping_class_inventory_mismatch",
          `Invalid member override for ${row.python_symbol}`,
        );
      }
    }
  }
  for (const pythonName of pythonNames) {
    const counterpart = memberCounterpart(row, pythonName);
    if (typeof counterpart !== "string" || !CAMEL_IDENTIFIER.test(counterpart)) {
      fail(
        "mapping_class_inventory_mismatch",
        `Missing member counterpart ${row.python_symbol}.${pythonName}`,
      );
    }
    if (counterpart !== pythonName && !row.normalizations.includes("snake_case_to_camelCase")) {
      fail(
        "mapping_class_inventory_mismatch",
        `Undocumented member rename ${row.python_symbol}.${pythonName}`,
      );
    }
  }
}

function validatePartialClass(row, classFact) {
  if (row.status !== "partial") {
    if (row.partial_class !== undefined) {
      fail(
        "mapping_partial_class_invalid",
        `Partial class authority is only valid for partial mappings: ${row.python_symbol}`,
      );
    }
    return;
  }
  if (row.kind !== "class" || classFact === undefined) {
    fail(
      "mapping_partial_class_invalid",
      `Partial mapping must reference a pinned class: ${row.python_symbol}`,
    );
  }
  assertExactKeys(
    row.partial_class,
    ["implemented_members", "omitted_members"],
    [],
    "mapping_partial_class_invalid",
    `${row.python_symbol}.partial_class`,
  );
  const implemented = row.partial_class.implemented_members;
  const omitted = row.partial_class.omitted_members;
  if (!Array.isArray(implemented) || !Array.isArray(omitted)) {
    fail(
      "mapping_partial_class_invalid",
      `Partial member partitions must be arrays for ${row.python_symbol}`,
    );
  }
  const validateMembers = (members, label) => {
    for (const member of members) {
      if (typeof member !== "string" || !CAMEL_IDENTIFIER.test(member)) {
        fail(
          "mapping_partial_class_invalid",
          `${row.python_symbol}.${label} has an invalid member`,
        );
      }
    }
    if (new Set(members).size !== members.length) {
      fail(
        "mapping_partial_class_invalid",
        `${row.python_symbol}.${label} contains duplicate members`,
      );
    }
  };
  validateMembers(implemented, "implemented_members");
  validateMembers(omitted, "omitted_members");

  const expectedMembers = classFact.members.map(({ name }) => memberCounterpart(row, name));
  const expectedSet = new Set(expectedMembers);
  const implementedSet = new Set(implemented);
  const omittedSet = new Set(omitted);
  for (const member of implementedSet) {
    if (!expectedSet.has(member) || omittedSet.has(member)) {
      fail(
        "mapping_partial_class_invalid",
        `Implemented member partition is invalid for ${row.python_symbol}.${member}`,
      );
    }
  }
  for (const member of omittedSet) {
    if (!expectedSet.has(member)) {
      fail(
        "mapping_partial_class_invalid",
        `Omitted member partition is invalid for ${row.python_symbol}.${member}`,
      );
    }
  }
  if (
    implementedSet.size + omittedSet.size !== expectedSet.size ||
    expectedMembers.some((member) => !implementedSet.has(member) && !omittedSet.has(member))
  ) {
    fail(
      "mapping_partial_class_invalid",
      `Partial member partition does not cover ${row.python_symbol}`,
    );
  }
  const implementedOrder = expectedMembers.filter((member) => implementedSet.has(member));
  const omittedOrder = expectedMembers.filter((member) => omittedSet.has(member));
  if (
    canonical(implemented) !== canonical(implementedOrder) ||
    canonical(omitted) !== canonical(omittedOrder)
  ) {
    fail(
      "mapping_partial_class_invalid",
      `Partial member order must follow pinned class order for ${row.python_symbol}`,
    );
  }
}

function validateMapping(value, expectedBaseline, publicApi, publicClasses, releaseMode) {
  assertExactKeys(
    value,
    ["baseline", "mappings", "schema_version"],
    [],
    "mapping_schema_invalid",
    "api-mapping.json",
  );
  if (value.schema_version !== 1 || !Array.isArray(value.mappings)) {
    fail("mapping_schema_invalid", "Unsupported API mapping schema");
  }
  validateBaseline(
    value.baseline,
    expectedBaseline,
    "baseline_inventory_mismatch",
    "mapping baseline",
  );
  const expectedByName = new Map(publicApi.symbols.map((symbol) => [symbol.name, symbol]));
  const mappedNames = new Set();
  const counterpartKeys = new Set();
  const requiredFields = [
    "python_symbol",
    "typescript_symbol",
    "export_path",
    "kind",
    "owner_phase",
    "status",
    "evidence_category",
    "contract_test",
    "normalizations",
    "representation",
  ];
  for (const [index, row] of value.mappings.entries()) {
    assertExactKeys(
      row,
      requiredFields,
      ["not_applicable_rationale", "partial_class"],
      "mapping_schema_invalid",
      `mapping row ${index}`,
    );
    boundedString(
      row.python_symbol,
      `mapping row ${index}.python_symbol`,
      "mapping_schema_invalid",
      128,
    );
    boundedString(
      row.typescript_symbol,
      `mapping row ${index}.typescript_symbol`,
      "mapping_schema_invalid",
      128,
    );
    if (mappedNames.has(row.python_symbol)) {
      fail("mapping_duplicate_python_symbol", `Duplicate mapping for ${row.python_symbol}`);
    }
    mappedNames.add(row.python_symbol);
    const expected = expectedByName.get(row.python_symbol);
    if (expected === undefined) {
      fail("mapping_inventory_mismatch", `Extra mapping ${row.python_symbol}`);
    }
    if (row.export_path !== expected.export_boundary) {
      fail("mapping_export_boundary_mismatch", `Wrong export boundary for ${row.python_symbol}`);
    }
    if (row.kind !== expected.python_kind) {
      fail("mapping_inventory_mismatch", `Wrong kind for ${row.python_symbol}`);
    }
    if (!IDENTIFIER.test(row.typescript_symbol)) {
      fail("mapping_schema_invalid", `Invalid TypeScript symbol ${row.typescript_symbol}`);
    }
    const counterpartKey = `${row.export_path}:${row.typescript_symbol}`;
    if (counterpartKeys.has(counterpartKey)) {
      fail(
        "mapping_duplicate_typescript_symbol",
        `Duplicate TypeScript counterpart ${counterpartKey}`,
      );
    }
    counterpartKeys.add(counterpartKey);
    if (!Number.isInteger(row.owner_phase) || row.owner_phase < 1 || row.owner_phase > 4) {
      fail("mapping_schema_invalid", `Invalid owner for ${row.python_symbol}`);
    }
    if (expected.source_group === "web") {
      if (row.owner_phase !== 4 || row.export_path !== "./web") {
        fail(
          "mapping_export_boundary_mismatch",
          `Web symbol is not exclusively web-owned: ${row.python_symbol}`,
        );
      }
    } else if (row.owner_phase === 4 || row.export_path !== ".") {
      fail(
        "mapping_export_boundary_mismatch",
        `Core symbol is routed to web: ${row.python_symbol}`,
      );
    }
    if (!ALLOWED_STATUSES.has(row.status)) {
      fail("mapping_status_invalid", `Invalid status for ${row.python_symbol}`);
    }
    if (row.status === "not_applicable") {
      if (
        typeof row.not_applicable_rationale !== "string" ||
        row.not_applicable_rationale.length < 20 ||
        row.not_applicable_rationale.length > 512
      ) {
        fail(
          "mapping_not_applicable_rationale_missing",
          `Reviewed rationale is required for ${row.python_symbol}`,
        );
      }
    } else if (row.not_applicable_rationale !== undefined) {
      fail(
        "mapping_status_invalid",
        `Rationale is only valid for not_applicable: ${row.python_symbol}`,
      );
    }
    if (releaseMode && (row.status === "planned" || row.status === "partial")) {
      fail("mapping_release_status_incomplete", `Release-blocking status for ${row.python_symbol}`);
    }
    boundedString(
      row.evidence_category,
      `${row.python_symbol}.evidence_category`,
      "mapping_schema_invalid",
      128,
    );
    boundedString(
      row.contract_test,
      `${row.python_symbol}.contract_test`,
      "mapping_schema_invalid",
      256,
    );
    if (!isEvidenceTestPath(row.contract_test)) {
      fail("mapping_schema_invalid", `Invalid contract test path for ${row.python_symbol}`);
    }
    if (row.status === "complete") {
      try {
        validateEvidencePath(ROOT, row.contract_test);
      } catch (error) {
        fail(
          "mapping_complete_evidence_invalid",
          `Complete evidence is invalid for ${row.python_symbol}: ${String(error)}`,
        );
      }
    }
    if (
      !Array.isArray(row.normalizations) ||
      new Set(row.normalizations).size !== row.normalizations.length
    ) {
      fail("mapping_normalization_invalid", `Normalizations are invalid for ${row.python_symbol}`);
    }
    for (const normalization of row.normalizations) {
      if (!ALLOWED_NORMALIZATIONS.has(normalization)) {
        fail("mapping_normalization_invalid", `Unknown normalization for ${row.python_symbol}`);
      }
    }
    if (row.kind === "function" && row.python_symbol !== row.typescript_symbol) {
      if (
        row.typescript_symbol !== camelCase(row.python_symbol) ||
        !row.normalizations.includes("snake_case_to_camelCase")
      ) {
        fail("mapping_normalization_invalid", `Undocumented function rename ${row.python_symbol}`);
      }
    }
    const classFact = publicClasses.byPublicName.get(row.python_symbol);
    validateRepresentation(row, classFact);
    validatePartialClass(row, classFact);
    const aliasTarget = publicApi.aliasesByName.get(row.python_symbol);
    if (aliasTarget !== undefined) {
      if (
        row.representation.form !== "alias" ||
        row.representation.alias_of !== aliasTarget ||
        !row.normalizations.includes("python_alias_to_typescript_alias")
      ) {
        fail("mapping_alias_invalid", `Alias mapping is invalid for ${row.python_symbol}`);
      }
    } else if (row.representation.form === "alias" || row.representation.alias_of !== undefined) {
      fail("mapping_alias_invalid", `Non-alias ${row.python_symbol} uses alias representation`);
    }
  }
  if (value.mappings.length !== EXPECTED_SYMBOL_COUNT || mappedNames.size !== expectedByName.size) {
    fail("mapping_inventory_mismatch", "Mapping must contain exactly 89 public symbols");
  }
  for (const name of expectedByName.keys()) {
    if (!mappedNames.has(name)) {
      fail("mapping_inventory_mismatch", `Missing mapping ${name}`);
    }
  }
  const mappedOrder = value.mappings.map(({ python_symbol }) => python_symbol);
  const expectedOrder = publicApi.symbols.map(({ name }) => name);
  if (canonical(mappedOrder) !== canonical(expectedOrder)) {
    fail("mapping_inventory_mismatch", "Mapping order must match pinned __all__ order");
  }
  for (const [publicName] of publicClasses.byPublicName) {
    const row = value.mappings.find(({ python_symbol }) => python_symbol === publicName);
    if (row === undefined || row.kind !== "class") {
      fail("mapping_class_inventory_mismatch", `Missing class mapping ${publicName}`);
    }
  }
  return value;
}

function validateExtensions(value, mapping, releaseMode) {
  assertExactKeys(
    value,
    ["extensions", "schema_version"],
    [],
    "extension_schema_invalid",
    "typescript-extensions.json",
  );
  if (value.schema_version !== 1 || !Array.isArray(value.extensions)) {
    fail("extension_schema_invalid", "Unsupported TypeScript extension schema");
  }
  const pythonCounterparts = new Set(
    mapping.mappings.map(({ export_path, typescript_symbol }) => {
      return `${export_path}:${typescript_symbol}`;
    }),
  );
  const extensionCounterparts = new Set();
  for (const [index, extension] of value.extensions.entries()) {
    const label = `extension row ${index}`;
    assertExactKeys(
      extension,
      [
        "contract_test",
        "export_path",
        "kind",
        "no_python_counterpart",
        "owner_phase",
        "rationale",
        "status",
        "typescript_symbol",
      ],
      [],
      "extension_schema_invalid",
      label,
    );
    boundedString(
      extension.typescript_symbol,
      `${label}.typescript_symbol`,
      "extension_schema_invalid",
      128,
    );
    if (!IDENTIFIER.test(extension.typescript_symbol)) {
      fail("extension_schema_invalid", `${label} has an invalid TypeScript symbol`);
    }
    if (!new Set([".", "./web"]).has(extension.export_path)) {
      fail("extension_schema_invalid", `${label} has an invalid export path`);
    }
    if (extension.kind !== "type") {
      fail("extension_schema_invalid", `${label} must be an explicit type-only extension`);
    }
    if (
      !Number.isInteger(extension.owner_phase) ||
      extension.owner_phase < 1 ||
      extension.owner_phase > 4
    ) {
      fail("extension_schema_invalid", `${label} has an invalid owner`);
    }
    if (!ALLOWED_EXTENSION_STATUSES.has(extension.status)) {
      fail("extension_schema_invalid", `${label} has an invalid status`);
    }
    boundedString(extension.rationale, `${label}.rationale`, "extension_schema_invalid", 512);
    if (extension.rationale.length < 20) {
      fail("extension_schema_invalid", `${label} requires a reviewed rationale`);
    }
    boundedString(
      extension.contract_test,
      `${label}.contract_test`,
      "extension_schema_invalid",
      256,
    );
    if (!isEvidenceTestPath(extension.contract_test)) {
      fail("extension_schema_invalid", `${label} has an invalid contract test path`);
    }
    if (extension.no_python_counterpart !== true) {
      fail("extension_schema_invalid", `${label} must declare no_python_counterpart: true`);
    }
    const counterpart = `${extension.export_path}:${extension.typescript_symbol}`;
    if (pythonCounterparts.has(counterpart)) {
      fail(
        "extension_python_inventory_collision",
        `Extension collides with Python mapping ${counterpart}`,
      );
    }
    if (extensionCounterparts.has(counterpart)) {
      fail(
        "extension_duplicate_typescript_symbol",
        `Duplicate TypeScript extension ${counterpart}`,
      );
    }
    extensionCounterparts.add(counterpart);
    if (releaseMode && extension.status !== "complete") {
      fail(
        "extension_release_status_incomplete",
        `Release-blocking extension status for ${extension.typescript_symbol}`,
      );
    }
    if (extension.status === "complete") {
      try {
        validateEvidencePath(ROOT, extension.contract_test);
      } catch (error) {
        fail(
          "extension_complete_evidence_invalid",
          `Complete extension evidence is invalid for ${extension.typescript_symbol}: ${String(error)}`,
        );
      }
    }
  }
  return value;
}

function validateRuntimeNormalization(source, publicClasses) {
  const start = source.indexOf(RUNTIME_NORMALIZATION_START);
  const end = source.indexOf(RUNTIME_NORMALIZATION_END);
  if (
    start === -1 ||
    end === -1 ||
    end <= start ||
    source.lastIndexOf(RUNTIME_NORMALIZATION_START) !== start ||
    source.lastIndexOf(RUNTIME_NORMALIZATION_END) !== end
  ) {
    fail(
      "runtime_normalization_invalid",
      "contracts/normalization.md must contain one runtime normalization authority",
    );
  }
  const match = source
    .slice(start + RUNTIME_NORMALIZATION_START.length, end)
    .trim()
    .match(/^```json\n([\s\S]+)\n```$/u);
  if (match === null) {
    fail(
      "runtime_normalization_invalid",
      "Runtime normalization authority must be one fenced JSON object",
    );
  }
  let authority;
  try {
    authority = JSON.parse(match[1]);
  } catch (error) {
    fail(
      "runtime_normalization_invalid",
      `Runtime normalization authority is invalid JSON: ${String(error)}`,
    );
  }
  if (
    canonical(structuralCanonical(authority)) !==
    canonical(structuralCanonical(EXPECTED_RUNTIME_NORMALIZATION))
  ) {
    fail(
      "runtime_normalization_invalid",
      "Runtime normalization authority differs from the reviewed closed contract",
    );
  }
  const clientFact = publicClasses.byPublicName.get("IdmModbusClient");
  if (
    clientFact === undefined ||
    canonical(clientFact.constructor.parameters.map(({ name }) => name)) !==
      canonical(authority.constructor_options.python_parameters)
  ) {
    fail(
      "runtime_normalization_invalid",
      "Runtime constructor authority differs from the pinned Python class fixture",
    );
  }
  return authority;
}

function markdown(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function code(value) {
  return `\`${markdown(value)}\``;
}

function renderApiDocument(
  mapping,
  extensions,
  runtimeNormalization,
  publicApi,
  publicClasses,
  manifest,
) {
  const lines = [
    "<!-- GENERATED FILE — DO NOT EDIT. Run `node scripts/generate-api-parity.mjs` to regenerate. -->",
    "",
    "# Public API parity",
    "",
    "The Python matrix is generated from `contracts/api-mapping.json` and the pinned Python-only public inventories.",
    "Additive Node-only types are governed separately by `contracts/typescript-extensions.json` and never alter Python coverage.",
    "It documents development intent; only `complete` rows with passing evidence may be exported or released.",
    "",
    "## Pinned baseline",
    "",
    `- Repository: ${code(manifest.repository)}`,
    `- Python package: ${code(manifest.python_package)}`,
    `- Python version/tag: ${code(manifest.python_version)} / ${code(manifest.git_tag)}`,
    `- Full commit: ${code(manifest.git_commit)}`,
    `- Parity schema: ${code(manifest.schema_version)}`,
    `- Development status: ${code(manifest.parity_status)}`,
    "",
    `**${publicApi.counts.total} public symbols: ${publicApi.counts.root} root, ${publicApi.counts.web} web.**`,
    "",
    "## Symbol matrix",
    "",
    "| Python symbol | TypeScript counterpart | Export path | Owner | Status | Representation | Normalizations | Contract evidence |",
    "| --- | --- | --- | ---: | --- | --- | --- | --- |",
  ];
  for (const row of mapping.mappings) {
    const normalizations =
      row.normalizations.length === 0 ? "—" : row.normalizations.map(code).join(", ");
    lines.push(
      `| ${code(row.python_symbol)} | ${code(row.typescript_symbol)} | ${code(row.export_path)} | ${row.owner_phase} | ${code(row.status)} | ${code(row.representation.form)} | ${normalizations} | ${code(row.evidence_category)}: ${code(row.contract_test)} |`,
    );
  }
  lines.push(
    "",
    "## TypeScript-only extensions",
    "",
    "These explicitly additive symbols have no Python counterpart and do not count toward the 89-row Python inventory.",
    "",
    "| TypeScript symbol | Export path | Owner | Status | Kind | Rationale | Contract evidence |",
    "| --- | --- | ---: | --- | --- | --- | --- |",
  );
  for (const extension of extensions.extensions) {
    lines.push(
      `| ${code(extension.typescript_symbol)} | ${code(extension.export_path)} | ${extension.owner_phase} | ${code(extension.status)} | ${code(extension.kind)} | ${markdown(extension.rationale)} | ${code(extension.contract_test)} |`,
    );
  }
  const constructor = runtimeNormalization.constructor_options;
  const errorKinds = runtimeNormalization.transport_error_type_to_closed_kind.kinds;
  const redaction = runtimeNormalization.diagnostic_message_redaction;
  lines.push(
    "",
    "## Runtime normalization authority",
    "",
    `- Public constructor: ${code("host")} plus mapped options ${constructor.typescript_options.map(code).join(", ")}`,
    `- Internal adapter policy: pymodbus adapter retries are internalized at ${code(constructor.internalized.pymodbusRetries)}`,
    `- Closed error kinds: ${errorKinds.map(code).join(", ")}`,
    `- Diagnostic redaction: longest-first endpoint replacement with ${code(redaction.placeholder)}, unchanged remaining text/order, and rejection above ${redaction.maximum_output_length} characters`,
    "- Error equivalence never uses exception class names, message substrings, case folding, or undocumented fallbacks.",
  );
  const partialRows = mapping.mappings.filter(({ status }) => status === "partial");
  lines.push(
    "",
    "## Partial class lifecycle",
    "",
    "Partial classes are private-development authorities only. Their implemented and omitted member lists are an exact disjoint partition of the pinned Python class fixture, and release mode rejects them.",
  );
  if (partialRows.length === 0) {
    lines.push("", "No partial classes are currently declared.");
  }
  for (const row of partialRows) {
    lines.push(
      "",
      `### ${row.typescript_symbol}`,
      "",
      `- Partition: ${row.partial_class.implemented_members.length} implemented, ${row.partial_class.omitted_members.length} omitted`,
      `- Implemented: ${row.partial_class.implemented_members.map(code).join(", ")}`,
      `- Omitted: ${row.partial_class.omitted_members.map(code).join(", ")}`,
    );
  }
  lines.push(
    "",
    "## Phase 1 class/member contract",
    "",
    "Constructor defaults, exact Python signatures, and validation boundaries remain authoritative in `test/fixtures/public-classes.json`.",
    "The TypeScript naming and representation decisions below are derived only from mapping rows.",
  );
  for (const row of mapping.mappings.filter(
    ({ kind, owner_phase }) => kind === "class" && owner_phase === 1,
  )) {
    const classFact = publicClasses.byPublicName.get(row.python_symbol);
    lines.push(
      "",
      `### ${row.typescript_symbol}`,
      "",
      `- Representation: ${code(row.representation.form)}`,
      `- Python constructor: ${code(classFact.constructor.signature)}`,
      `- Validation boundaries: ${classFact.validation_boundaries.length}`,
      "- Counterparts:",
    );
    if (classFact.constructor.parameters.length === 0) {
      lines.push("  - constructor has no parameters");
    } else {
      for (const parameter of classFact.constructor.parameters) {
        lines.push(
          `  - ${code(`${row.python_symbol}.constructor.${parameter.name}`)} → ${code(memberCounterpart(row, parameter.name))}`,
        );
      }
    }
    if (classFact.members.length === 0) {
      lines.push("  - no public class members in the Python fact inventory");
    } else {
      for (const member of classFact.members) {
        lines.push(
          `  - ${code(`${row.python_symbol}.${member.name}`)} → ${code(memberCounterpart(row, member.name))} (${markdown(member.kind)})`,
        );
      }
    }
  }
  lines.push(
    "",
    "## Release rule",
    "",
    "`--release` rejects every `planned` or `partial` Python row, every unjustified `not_applicable` row, every incomplete TypeScript-only extension, and every `complete` authority whose contract test is absent.",
    "",
  );
  return lines.join("\n");
}

function renderBaselineDocument(manifest) {
  return [
    "<!-- GENERATED FILE — DO NOT EDIT. Run `node scripts/generate-api-parity.mjs` to regenerate. -->",
    "",
    "# Pinned upstream baseline",
    "",
    "This document is a deterministic projection of `UPSTREAM-PARITY.json`; the JSON manifest is the only editable authority.",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Schema version | ${code(manifest.schema_version)} |`,
    `| Repository | ${code(manifest.repository)} |`,
    `| Python package | ${code(manifest.python_package)} |`,
    `| Python version | ${code(manifest.python_version)} |`,
    `| Git tag | ${code(manifest.git_tag)} |`,
    `| Full Git commit | ${code(manifest.git_commit)} |`,
    `| Parity status | ${code(manifest.parity_status)} |`,
    `| Verified on | ${code(manifest.verified_on)} |`,
    "",
  ].join("\n");
}

function durableWrite(path, bytes) {
  writeFileSync(path, bytes, { encoding: "utf8", flag: "wx" });
  const descriptor = openSync(path, "r+");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function replaceDocuments(documents) {
  const snapshots = new Map();
  const temporaryPaths = [];
  const replaced = [];
  try {
    for (const [index, [path, bytes]] of documents.entries()) {
      mkdirSync(dirname(path), { recursive: true });
      snapshots.set(path, existsSync(path) ? readFileSync(path) : null);
      const temporaryPath = resolve(
        dirname(path),
        `.${basename(path)}.${process.pid}.${Date.now()}.${index}.tmp`,
      );
      durableWrite(temporaryPath, bytes);
      temporaryPaths.push(temporaryPath);
    }
    for (const [index, [path]] of documents.entries()) {
      renameSync(temporaryPaths[index], path);
      replaced.push(path);
      if (process.env.IDM_API_GENERATOR_TEST_FAIL_AFTER_REPLACE === "1" && replaced.length === 1) {
        throw new Error("injected replacement failure");
      }
    }
  } catch (error) {
    for (const [index, path] of [...replaced].reverse().entries()) {
      const previous = snapshots.get(path);
      if (previous === null) {
        rmSync(path, { force: true });
      } else {
        const restorePath = resolve(
          dirname(path),
          `.${basename(path)}.${process.pid}.${Date.now()}.restore.${index}.tmp`,
        );
        writeFileSync(restorePath, previous, { flag: "wx" });
        renameSync(restorePath, path);
      }
    }
    fail("generated_document_write_failed", `Atomic document replacement failed: ${String(error)}`);
  } finally {
    for (const path of temporaryPaths) {
      rmSync(path, { force: true });
    }
  }
}

function checkDocuments(documents) {
  const stale = [];
  for (const [path, expected] of documents) {
    if (!existsSync(path) || !readFileSync(path).equals(Buffer.from(expected))) {
      stale.push(basename(path));
    }
  }
  if (stale.length > 0) {
    fail("generated_document_stale", `Generated documents are stale: ${stale.join(", ")}`);
  }
}

function parseArguments(arguments_) {
  const allowed = new Set(["--check", "--release"]);
  const unknown = arguments_.find((argument) => !allowed.has(argument));
  if (unknown !== undefined || new Set(arguments_).size !== arguments_.length) {
    fail(
      "generator_argument_invalid",
      `Unknown or duplicate generator argument: ${String(unknown)}`,
    );
  }
  return { check: arguments_.includes("--check"), release: arguments_.includes("--release") };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const manifest = validateManifest(readJson(PATHS.manifest, "UPSTREAM-PARITY.json"));
  const expectedBaseline = baselineFromManifest(manifest);
  const publicApi = validatePublicApi(
    readJson(PATHS.publicApi, "public-api.json"),
    expectedBaseline,
  );
  const publicClasses = validatePublicClasses(
    readJson(PATHS.publicClasses, "public-classes.json"),
    expectedBaseline,
  );
  const mapping = validateMapping(
    readJson(PATHS.mapping, "api-mapping.json"),
    expectedBaseline,
    publicApi,
    publicClasses,
    options.release,
  );
  const extensions = validateExtensions(
    readJson(PATHS.extensions, "typescript-extensions.json"),
    mapping,
    options.release,
  );
  const runtimeNormalization = validateRuntimeNormalization(
    readFileSync(PATHS.normalization, "utf8"),
    publicClasses,
  );
  if (options.release && manifest.parity_status !== "complete") {
    fail("baseline_release_status_incomplete", "Baseline manifest is not complete");
  }
  const documents = [
    [
      PATHS.apiDocument,
      renderApiDocument(
        mapping,
        extensions,
        runtimeNormalization,
        publicApi,
        publicClasses,
        manifest,
      ),
    ],
    [PATHS.baselineDocument, renderBaselineDocument(manifest)],
  ];
  if (options.check) {
    checkDocuments(documents);
    console.log("Generated API parity and baseline documents are current");
  } else {
    replaceDocuments(documents);
    console.log("Generated docs/API-PARITY.md and docs/BASELINE.md");
  }
}

try {
  main();
} catch (error) {
  if (error instanceof ContractError) {
    console.error(`${error.code}: ${error.message}`);
  } else {
    console.error(`generator_failed: ${String(error)}`);
  }
  process.exitCode = 1;
}
