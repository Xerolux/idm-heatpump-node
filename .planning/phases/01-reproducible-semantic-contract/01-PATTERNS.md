# Phase 1: Reproducible Semantic Contract - Pattern Map

**Mapped:** 2026-07-14  
**Files analyzed:** all 46 planned new/modified artifacts plus the existing web export boundary
**Node analogs found:** role matches are recorded per artifact below; the semantic core is intentionally greenfield

This repository is still a bootstrap codebase. The closest implementation analogs are
therefore the existing parity metadata validator, bootstrap tests, package smoke-test script,
entry points, and build configuration. The pinned Python implementation is cited only as a
semantic authority; its module layout and mutable Python structures are not Node patterns to
copy.

## File Classification

| New/Modified File                           | Role                            | Data Flow              | Closest Node Analog               | Match Quality                  |
| ------------------------------------------- | ------------------------------- | ---------------------- | --------------------------------- | ------------------------------ |
| `contracts/api-mapping.json`                | config / contract               | transform              | `UPSTREAM-PARITY.json`            | role-match                     |
| `contracts/normalization.md`                | config / contract documentation | transform              | `docs/PARITY-CONTRACT.md`         | role-match                     |
| `src/constants.ts`                          | model / constants               | transform              | `src/internal/parity-metadata.ts` | weak role-match                |
| `src/types.ts`                              | model                           | transform              | `src/internal/parity-metadata.ts` | role-match                     |
| `src/errors.ts`                             | model / utility                 | request-response       | none                              | greenfield                     |
| `src/codec.ts`                              | utility / domain service        | transform              | none                              | greenfield                     |
| `src/contracts/tagged-values.ts`            | utility / contract model        | transform              | `src/internal/parity-metadata.ts` | role-match                     |
| `src/contracts/scenario.ts`                 | model / validator               | transform              | `src/internal/parity-metadata.ts` | role-match                     |
| `src/registers/definitions.ts`              | model                           | transform              | none                              | greenfield                     |
| `src/registers/core.ts`                     | domain builder                  | batch / transform      | none                              | greenfield                     |
| `src/registers/feature-blocks.ts`           | domain builder                  | batch / transform      | none                              | greenfield                     |
| `src/registers/heating-circuits.ts`         | domain builder                  | batch / transform      | none                              | greenfield                     |
| `src/registers/zone-modules.ts`             | domain builder                  | batch / transform      | none                              | greenfield                     |
| `src/registers/registry.ts`                 | registry / service              | CRUD / transform       | none                              | greenfield                     |
| `src/registers/serialize.ts`                | utility                         | transform              | `src/internal/parity-metadata.ts` | weak role-match                |
| `src/registers/index.ts`                    | route / barrel                  | transform              | `src/index.ts`                    | exact                          |
| `src/internal/parity-metadata.ts`           | model / validator               | transform              | itself                            | exact                          |
| `src/timing.ts`                             | utility / domain service        | transform              | none                              | greenfield                     |
| `src/index.ts`                              | route / package barrel          | transform              | itself and `src/web/index.ts`     | exact                          |
| `src/web/index.ts`                          | route / package barrel          | transform              | itself                            | exact; remain empty in Phase 1 |
| `scripts/generate-python-contract.py`       | generator / integration utility | process + file I/O     | `scripts/check-package.mjs`       | role-match; different language |
| `scripts/check-upstream-version.mjs`        | validator / integration utility | process + file I/O     | `scripts/check-package.mjs`       | strong role-match              |
| `scripts/generate-api-parity.mjs`           | generator                       | file I/O / transform   | `scripts/check-package.mjs`       | role-match                     |
| `scripts/check-parity.mjs`                  | orchestrator                    | process + file I/O     | `scripts/check-package.mjs`       | strong role-match              |
| `test/fixtures/public-api.json`             | golden fixture                  | file I/O               | `UPSTREAM-PARITY.json`            | role-match                     |
| `test/fixtures/public-classes.json`         | golden fixture                  | file I/O               | pinned Python public classes      | role-match                     |
| `test/fixtures/codec-vectors.json`          | golden fixture                  | file I/O               | `UPSTREAM-PARITY.json`            | role-match                     |
| `test/fixtures/register-schema.json`        | golden fixture                  | file I/O               | `docs/compatibility-matrix.json`  | weak role-match                |
| `test/fixtures/behavior-contract.json`      | scenario fixture                | request-response       | none                              | greenfield                     |
| `test/fixtures/web-contract.json`           | deferred contract marker        | transform              | `docs/compatibility-matrix.json`  | role-match                     |
| `test/parity/baseline.test.ts`              | test / process integration      | process + file I/O     | `test/bootstrap.test.ts`          | exact style                    |
| `test/parity/generator.test.ts`             | test / process integration      | process + file I/O     | `test/bootstrap.test.ts`          | exact style                    |
| `test/parity/api-parity.test.ts`            | contract test                   | file I/O / transform   | `test/bootstrap.test.ts`          | exact style                    |
| `test/parity/codec-contract.test.ts`        | contract test                   | transform              | `test/bootstrap.test.ts`          | exact style                    |
| `test/parity/register-schema.test.ts`       | contract test                   | batch / transform      | `test/bootstrap.test.ts`          | exact style                    |
| `test/parity/scenario-schema.test.ts`       | schema test                     | transform              | `test/bootstrap.test.ts`          | exact style                    |
| `test/parity/phase-gate.test.ts`            | integration / final gate        | process + file I/O     | `test/bootstrap.test.ts`          | exact style                    |
| `test/codec.test.ts`                        | unit test                       | transform              | `test/bootstrap.test.ts`          | exact style                    |
| `test/registers/register-def.test.ts`       | unit test                       | transform              | `test/bootstrap.test.ts`          | exact style                    |
| `test/registers/builders.test.ts`           | unit test                       | batch / transform      | `test/bootstrap.test.ts`          | exact style                    |
| `test/semantic/constants-and-types.test.ts` | unit test                       | transform              | `test/bootstrap.test.ts`          | exact style                    |
| `docs/BASELINE.md`                          | generated documentation         | file I/O / transform   | none                              | greenfield generated file      |
| `docs/API-PARITY.md`                        | generated documentation         | file I/O / transform   | none                              | greenfield generated file      |
| `package.json`                              | package config                  | build / publish        | itself                            | exact                          |
| `.github/workflows/ci.yml`                  | CI config                       | event-driven / process | itself                            | exact                          |
| `README.md`                                 | package documentation           | transform              | itself                            | exact                          |
| `CHANGELOG.md`                              | release documentation           | transform              | none                              | greenfield                     |

## Pattern Assignments

### Domain models: `src/constants.ts`, `src/types.ts`, and `src/registers/definitions.ts`

**Node analog:** `src/internal/parity-metadata.ts` for strict structural typing and pure
validation. There is no existing local `as const` object or deep-immutability implementation;
those parts are greenfield and must follow `01-CONTEXT.md` and `01-RESEARCH.md`.

**Type declaration pattern** (`src/internal/parity-metadata.ts:1-19`):

```typescript
export interface UpstreamParity {
  readonly schema_version: number;
  readonly repository: string;
  readonly python_package: string;
  readonly python_version: string;
  readonly git_tag: string;
  readonly git_commit: string;
  readonly parity_status: string;
}

export interface CompatibilityMatrix {
  readonly schema_version: number;
  readonly development_baseline: {
    readonly python_version: string;
    readonly python_commit: string;
    readonly status: string;
  };
  readonly releases: readonly unknown[];
}
```

Apply the same explicit `readonly` style and avoid `any`. Runtime value sets such as
`DataType`, `RegisterType`, and `WriteClass` must use frozen `as const` objects plus derived
union types, not TypeScript `enum`. `RegisterDef` itself is a readonly plain object returned by
a validating factory. Deep cloning/freezing of nested option maps, excluded values, supported
models, and sentinels has **no local analog** and must be implemented explicitly; the existing
`readonly` interfaces provide compile-time immutability only.

**Pure validation and deterministic error pattern** (`src/internal/parity-metadata.ts:21-42`):

```typescript
export function assertParityMetadataConsistency(
  upstream: UpstreamParity,
  matrix: CompatibilityMatrix,
): void {
  if (!/^[0-9a-f]{40}$/u.test(upstream.git_commit)) {
    throw new Error("Upstream parity must pin a full lowercase Git commit SHA");
  }
  if (upstream.git_tag !== `v${upstream.python_version}`) {
    throw new Error("Upstream Python tag and version do not match");
  }
  // ...one explicit invariant per branch...
}
```

Keep factories and parsers pure: validate one invariant per branch and throw before returning a
partially accepted object. Use stable semantic error codes from `contracts/normalization.md` for
cross-language rejection contracts; do not compare Python and TypeScript exception class names
or raw messages as the semantic result.

**Pinned semantic analogs (do not copy structure):**

- `idm_heatpump/client.py:154-174` defines the exact enum values.
- `idm_heatpump/client.py:333-409` defines `RegisterDef` fields, defaults, invariants, derived
  size, and write-class precedence.
- `idm_heatpump/const.py:7-258` defines exact constants, numeric option keys, and EEPROM address
  membership.

### Codec: `src/codec.ts`

**Node analog:** none. This is greenfield binary-domain code. Use the project-wide pure-function
and deterministic-error style above, but take semantics only from the pinned codec and generated
goldens.

**Pinned semantic analog** (`idm_heatpump/client.py:265-301`): primitive Float32 and signed
integer codecs are stateless and preserve a separate primitive surface from register-aware codec
behavior (`client.py:1118-1146`). Their input domains are deliberately different and must be
generated/tested independently.

Implementation conventions fixed by the phase context/research:

- use native `DataView` with explicit little-endian operations;
- return low word then high word and support the Python `swapped` option;
- enforce integer `0..0xffff` packing bounds only for primitive/register FLOAT paths that reach
  Python `struct.pack("<HH")`;
- mirror pinned masking/direct behavior everywhere else: primitive/register INT8 and INT16 use
  bitwise masks and accept arbitrary integers, UCHAR/BITFLAG/BOOL mask the first integer word,
  and unscaled UINT16 returns the first value directly; dispatcher validation is limited to
  empty/short arrays before datatype dispatch;
- reject Float32 overflow instead of accepting DataView narrowing to infinity;
- use a dedicated round-half-even helper for register integer scaling;
- centralize datatype size and codec dispatch in exhaustive readonly records;
- keep primitive NaN/infinity/-0 behavior distinct from register-aware unavailable-value
  handling; sentinels remain decoded values.

Do not introduce Buffer-only or host-endian code, `Math.round`, a global unsigned-word validator,
or a single codec layer that conflates primitive and register-aware behavior. Any coercion,
masking, direct pass-through, or rejection must come from the generated pinned-Python case for
that exact datatype/path.

### Tagged contract values: `src/contracts/tagged-values.ts`

**Node analog:** `src/internal/parity-metadata.ts:21-42` for strict assertion-style parsing. No
existing local recursive normalizer or frozen tagged object exists.

Use a closed tagged union for exactly `NaN`, `+Infinity`, `-Infinity`, and `-0`. The parser must
reject unknown tags and any object with `$number` plus additional keys. Normalize only the
language differences explicitly listed in `contracts/normalization.md`; never use a permissive
JSON reviver and never allow `JSON.stringify` to turn non-finite numbers into `null`.

### Scenario contracts: `src/contracts/scenario.ts`

**Node analog:** `src/internal/parity-metadata.ts` for explicit runtime validation and
`test/bootstrap.test.ts:31-33` for typed JSON loading.

**Typed JSON boundary** (`test/bootstrap.test.ts:31-33`):

```typescript
function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(file), "utf8")) as T;
}
```

The generic cast is acceptable only at the file boundary and must immediately feed the new
strict scenario parser. Do not treat `as T` as validation. Require fixture schema version,
baseline identity, unique scenario names, known operation kinds, all eight CTR-01 fields,
bounded arrays/objects, valid 16-bit words only in transport/request envelope fields, and strict
tagged values. Direct codec-operation inputs retain their datatype-specific generated domains.

### Register builders: `src/registers/heating-circuits.ts`, `zone-modules.ts`, and

`definitions.ts`

**Node analog:** none. These are greenfield deterministic domain builders. The closest project
pattern is a pure function that validates inputs and returns newly owned data; runtime semantics
come from the pinned builder and golden schema.

Required local conventions:

- import types with `import type` and local modules through `.js` specifiers;
- return `ReadonlyMap<string, RegisterDef>` from public builders;
- never expose a cached mutable `Map`; each result must be newly owned or mutation-proof;
- construct every definition through the central factory;
- preserve the official A-G formulas and the three documented overlaps;
- validate circuit, zone, and room boundaries before building;
- keep model-info precedence over manual parameters exactly as the pinned implementation;
- do not add a global no-overlap assertion.

**Pinned semantic analog:** `idm_heatpump/registers.py:1692-1770` validates builder inputs,
constructs a hashable cache key, and returns a shallow copy so callers cannot mutate cached
future results. TypeScript needs a stronger runtime boundary because `ReadonlyMap` alone can be
cast back to `Map`.

### Registry and serializer: `src/registers/registry.ts` and `serialize.ts`

**Node analog:** no registry exists. Use `src/internal/parity-metadata.ts` for explicit invariant
checks and keep serialization as a pure boundary transform.

The registry may reject duplicate exact `(registerType, startAddress)` identities but must allow
occupied-range overlaps. Preserve the upstream default distinctions between core lookup,
complete default maps, and model-specific maps. Implement the public abbreviated
`RegisterRegistry.toSchema()` exactly as pinned: a sorted list containing only `key`, `address`,
`datatype`, `unit`, `scale`, `min_value`, `max_value`, `writable`, `register_type`, `write_class`,
and `supported_models`. This public method is required API behavior, not deprecated or optional.

Separately, `serializeRegisterMap` is the only boundary that converts runtime maps into the full
sorted 26-field parity contract. It must never call, reuse, alias, or extend `toSchema()`. Sort
canonical names, stringify numeric enum keys, sort set-like exclusions, preserve sequence-like
metadata, and route exceptional numbers through the tagged-value normalizer.

**Pinned semantic analogs:**

- `idm_heatpump/registers.py:98-153` for registry lookup/require/address/writable and abbreviated
  `to_schema()` behavior;
- `tests/test_register_schema.py:17-51` for the complete 26-field schema serialization;
- test abbreviated `toSchema()` and full 26-field serialization independently and forbid either
  implementation from delegating to the other.

### Barrels and public export boundaries: `src/registers/index.ts`, `src/index.ts`, and

`src/web/index.ts`

**Exact Node analogs:** the current entry points and conditional export map.

**Evidence-gated root export pattern** (`src/index.ts:1-7`):

```typescript
/**
 * Public package entry point.
 *
 * Exports are added only when their functional parity with idm-heatpump-api is
 * covered by the cross-repository contract suite.
 */
export {};
```

Add only Phase-1-complete runtime symbols to the root. Do not export throwing stubs for
later-owned clients, transport, writes, or web. Keep `src/web/index.ts` empty in this phase even
though every Python web symbol receives a planned mapping.

**Package boundary** (`package.json:12-33`): root and web are separate conditional exports, and
both import and require conditions point to declarations built from the same source. Preserve
this map and `src/web/index.ts` ownership.

All internal TypeScript imports must use NodeNext-compatible `.js` specifiers, as demonstrated by
`test/bootstrap.test.ts:6-10`:

```typescript
import {
  assertParityMetadataConsistency,
  type CompatibilityMatrix,
  type UpstreamParity,
} from "../src/internal/parity-metadata.js";
```

### Generator and verifier scripts

Applies to `scripts/check-upstream-version.mjs`, `scripts/generate-api-parity.mjs`, and the
process/file-safety aspects of `scripts/generate-python-contract.py`.

**Strong Node analog:** `scripts/check-package.mjs`.

**Standard-library import grouping** (`scripts/check-package.mjs:1-4`):

```javascript
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
```

Use Node/Python standard libraries only; Phase 1 adds no runtime or development dependency.

**Shell-free process wrapper** (`scripts/check-package.mjs:13-25`):

```javascript
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${command} ${args.join(" ")}\n${result.error?.message ?? ""}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
  return result.stdout;
}
```

Keep command and arguments separate, never use `shell: true`, and never interpolate manifest
values into a shell command. For Python, use `subprocess.run([...], check=True, ...)` with fixed
argument arrays and canonical paths.

**Temporary-output cleanup** (`scripts/check-package.mjs:55-90`): create a dedicated temporary
directory, perform generation/checks in `try`, and recursively clean in `finally`. Generation
mode should atomically replace only allowlisted repository paths; `--check` mode writes only to a
temporary directory and byte-compares without mutating the worktree.

The upstream verifier/generator has an additional greenfield security gate: validate the
allowlisted repository URL, supported schema, full lowercase SHA, tag resolution, checkout HEAD,
clean checkout, and `pyproject.toml` version **before** adding the checkout to `sys.path` or
importing any upstream module. It must never contact a heat pump or receive secrets.

### API mapping, generated docs, and fixtures

Applies to `contracts/api-mapping.json`, `docs/API-PARITY.md`, `docs/BASELINE.md`, and all six
`test/fixtures/*.json` files.

**Versioned JSON analogs:** `UPSTREAM-PARITY.json:1-10` and
`docs/compatibility-matrix.json:1-9` use snake_case field names, an integer `schema_version`, two
spaces of indentation, and a final newline. Fixtures additionally need full baseline identity
and generator version at the root.

`contracts/api-mapping.json` is the sole editable API mapping source. Generated Markdown must
carry a generated-file warning and must never become an independent source. The generator checks
exact one-to-one coverage of all 89 pinned Python `__all__` symbols, preserves alias entries,
enforces `.` versus `./web`, and requires evidence for `complete` statuses.

`test/fixtures/public-classes.json` contains Python-derived facts only: public constructors,
properties/methods, signatures, defaults, and observed validation/acceptance boundaries. It must
not contain Node owner phases, export paths, TypeScript names, lifecycle statuses, or approved TS
representations. Those Node decisions live only in `contracts/api-mapping.json`; mapping tests
join them to the Python facts and reject a missing member or undocumented representation change.

`docs/BASELINE.md` is a human-readable projection of `UPSTREAM-PARITY.json`, not another place to
edit baseline facts. Golden fixtures are deterministic UTF-8, stable-key-order JSON; semantic
array order is preserved while set/map normalizations are explicitly sorted.

`test/fixtures/web-contract.json` is intentionally a structured Phase-4 deferred marker. It must
remain release-blocking and cannot be labeled complete in Phase 1.

### Vitest suites

Applies to all seven planned `test/parity/*.test.ts` files and both `test/registers/*.test.ts` files.

**Exact style analog:** `test/bootstrap.test.ts`.

**Import grouping** (`test/bootstrap.test.ts:1-10`): Node built-ins first, blank line, Vitest,
blank line, then local `.js` imports with type-only imports marked inline.

**Table-driven validation pattern** (`test/bootstrap.test.ts:59-98`):

```typescript
const invalidParityCases: readonly InvalidParityCase[] = [
  ["invalid commit", { git_commit: "short" }, {}, "full lowercase Git commit SHA"],
  ["tag mismatch", { git_tag: "v9.9.9" }, {}, "tag and version"],
];

it.each(invalidParityCases)(
  "rejects %s",
  (_name, upstreamChange, matrixChange, expectedMessage) => {
    // arrange immutable variants, then assert the exact validation boundary
  },
);
```

Use readonly named tuples for case matrices, `describe` by contract domain, and focused `it` names
that state observable behavior. Prefer structural equality (`toEqual`), identity-sensitive checks
(`Object.is` for `-0`), and stable error categories/codes. Never weaken parity checks to warnings
or regenerate fixtures inside the assertion under test.

Fixture-loading tests may reuse the local `readJson<T>` pattern, but must pass values through
runtime validators before trusting them. Process-integration tests should spawn scripts with
argument arrays and isolated temporary directories.

### Package scripts and CI: `package.json` and `.github/workflows/ci.yml`

**Exact config analogs:** modify the existing files in place.

Preserve the composed check pipeline (`package.json:66-76`), adding dedicated
`parity:generate`, `parity:api`, and `parity:check` scripts rather than embedding long shell
pipelines in CI. Keep `private: true` through Phase 1.

The CI convention (`.github/workflows/ci.yml:10-43`) is:

- least privilege (`contents: read`);
- SHA-pinned actions;
- concurrency cancellation;
- Node 22/24 matrix with `npm ci`;
- one npm script as the validation entry point.

The exact-baseline parity job may add Python 3.12 and a clean detached checkout, but must retain
read-only permissions, no secrets, no device network operations, and verify SHA/tag/version before
running the Python generator.

## Shared Patterns

### Import and module conventions

- Double quotes, semicolons, trailing commas, 100-column formatting.
- Node built-ins use `node:` specifiers.
- Type-only imports use `import type` or inline `type` markers.
- Relative TypeScript imports use the emitted `.js` suffix under NodeNext.
- Public barrels are explicit; avoid wildcard-exporting unverified later-phase symbols.

### Immutability

- Existing `readonly` interfaces are the compile-time baseline.
- Phase 1 adds deep runtime immutability for public definition objects and nested collections.
- Never expose a cached mutable `Map`; verify later builds are unchanged after hostile mutation of
  an earlier result.
- Frozen `as const` objects plus derived unions replace TypeScript enums.

### Error handling

- Pure validators fail immediately with `Error`/`RangeError` rather than returning a partial value.
- Generator/process failures include command context and captured stdout/stderr.
- Cleanup always occurs in `finally`.
- Cross-language contracts compare documented semantic category/code, not language-specific class
  or message text.
- `src/errors.ts` has no local analog; keep it small and do not prematurely add transport/web
  hierarchies owned by later phases.

### Contract generation and checks

- Verify exact baseline identity before importing upstream code.
- Use committed, deterministic artifacts and a non-mutating `--check` mode.
- Use one canonical normalization implementation per language.
- Write only fixed allowlisted outputs and use atomic replacement.
- Include schema/baseline provenance in every generated fixture.

### Testing

- Vitest tests are deterministic and use synthetic repository data only.
- Prefer readonly case tables with `it.each` for boundaries and rejection matrices.
- Run focused tests plus `npm run typecheck` per task; full parity/check scripts per wave.
- Cover branches created by every validator; repository thresholds are 80% for branches,
  functions, lines, and statements.

### ESM, CommonJS, and publication

- ESM and CJS are generated by tsup from the same `src/index.ts` and `src/web/index.ts` sources.
- Conditional exports have separate `.d.ts` and `.d.cts` declarations.
- The tarball smoke test imports and requires both subpaths from a clean install.
- Generated contracts, tests, Python tooling, and planning files remain outside published `dist`.
- `private: true` remains the publication guard until all five project phases close parity.

## No Analog Found

| File/Concern                                | Reason                                        | Planner Direction                                                                               |
| ------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/codec.ts` binary implementation        | No binary codec exists in Node repo           | Follow golden vectors and `DataView` design from research; do not mirror Python module layout.  |
| `src/errors.ts`                             | No Node domain error hierarchy exists         | Introduce only Phase-1 validation/contract errors or stable codes; defer transport/web classes. |
| `src/registers/definitions.ts` and builders | No Node register model/builders exist         | Use central validating factory, exact Python semantics, and generated schemas.                  |
| Runtime-deep immutable collections          | Existing code is compile-time readonly only   | Clone then freeze nested values; test mutation isolation explicitly.                            |
| `test/fixtures/behavior-contract.json`      | No scenario fixture exists                    | Implement strict CTR-01 schema before consuming the fixture.                                    |
| `docs/API-PARITY.md` and `docs/BASELINE.md` | No generated-doc convention exists            | Generator owns complete contents and generated header; JSON sources remain authoritative.       |
| Python contract generator                   | Existing script is JavaScript package tooling | Reuse process/path safety principles, but use Python stdlib and pinned semantic modules.        |

## Metadata

**Analog search scope:** complete current Node `src/`, `test/`, `scripts/`, package/build/CI
configuration, baseline/compatibility contracts, and selected pinned Python semantic
implementation/tests.  
**Current Node source files scanned:** 5 implementation/test/script files plus package/config and
documentation contracts.  
**Pinned Python semantic references inspected:** package `__all__`, constants, primitive and
register-aware codec, `RegisterDef`, registry/builders, public API snapshot, register schema
serializer, and value-boundary tests at commit
`ad121ebf34a5f5e37204371c026927d77efcd15c`.  
**Pattern extraction date:** 2026-07-14
