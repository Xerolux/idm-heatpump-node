# Phase 1: Reproducible Semantic Contract - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the reproducible TypeScript semantic core whose public API mappings,
values, codecs, register definitions, and generated contract artifacts match
the exact Python release pinned in `UPSTREAM-PARITY.json`. Transport I/O,
runtime model detection, writes, and the optional web clients remain in later
phases.

</domain>

<decisions>
## Implementation Decisions

### Public TypeScript API

- Use `camelCase` for functions and methods and `PascalCase` for classes; every
  language-level rename is documented in the Python-to-TypeScript API mapping.
- Export Modbus/core capabilities from the package root and web capabilities
  exclusively from `@xerolux/idm-heatpump/web`.
- Return register maps as `ReadonlyMap<string, RegisterDef>` and provide
  registry helpers; normalize maps only at contract serialization boundaries.
- Model runtime enums as frozen `as const` objects with derived union types;
  do not use TypeScript `enum`.

### Parity Artifacts and Contract Generator

- Commit golden fixtures and regenerate them in CI from the exact pinned
  Python commit; any unapproved generated diff fails verification.
- Store representative complete model maps and exhaustively test builder
  parameters, model gates, and feature boundaries instead of persisting every
  combinatorial model permutation.
- Maintain a machine-readable API mapping as the source and generate
  `docs/API-PARITY.md` from it while checking coverage against Python `__all__`.
- Encode `NaN`, positive/negative infinity, and negative zero with explicit
  tagged JSON values so contract transport is lossless.

### Register and Codec Model

- Represent `RegisterDef` as an immutable plain object created through a
  central validating factory rather than a mutable class.
- Define datatypes with frozen `as const` values and derived union types;
  centralize datatype size and codec lookup.
- Return decoded sentinel values exactly as Python does and expose their
  meaning through metadata; do not silently convert sentinels to `null`.
- Implement IDM Float32 with bit-exact `DataView` operations in documented
  low-word-first order, preserving negative zero and non-finite values in
  contracts.

### the agent's Discretion

- Internal file boundaries, helper names, and generation implementation are at
  the agent's discretion when they preserve the accepted public and contract
  behavior.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/internal/parity-metadata.ts` already validates the pinned baseline and
  compatibility-matrix alignment.
- `test/bootstrap.test.ts` provides baseline, publication-guard, and package
  metadata tests with a reusable JSON-loading pattern.
- `UPSTREAM-PARITY.json` pins Python `v0.7.6` and its full commit SHA.

### Established Patterns

- Strict TypeScript, exact optional properties, unchecked-index protection,
  Vitest, and 80 percent coverage thresholds are already configured.
- ESM and CommonJS are generated from the same source with separate declaration
  files and tarball smoke tests.
- The package remains `private: true` until complete project parity.

### Integration Points

- Public core exports are added through `src/index.ts` only after their parity
  status and contract evidence exist.
- Web mappings are recorded now but their implementations remain under the
  `src/web/index.ts` subpath for Phase 4.
- Generated fixtures and API mapping integrate with `scripts/`, `test/parity/`,
  `test/fixtures/`, and `docs/API-PARITY.md`.

</code_context>

<specifics>
## Specific Ideas

- Prefer machine-generated, reviewable artifacts over hand-maintained parity
  claims.
- Keep language-normalization rules explicit and narrowly scoped so semantic
  differences cannot hide behind serialization.

</specifics>

<deferred>
## Deferred Ideas

- Modbus transport behavior and runtime detection belong to Phase 2.
- Real and simulated writes belong to Phase 3.
- Navigator 10 WebSocket and Navigator 2.0 HTTP clients belong to Phase 4.
- Publication, coordinated-release automation, and final parity closure belong
  to Phase 5.

</deferred>
