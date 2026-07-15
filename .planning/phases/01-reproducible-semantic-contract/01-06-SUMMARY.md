---
phase: 01-reproducible-semantic-contract
plan: "06"
subsystem: register-contract
tags: [typescript, modbus, register-map, immutability, parity, vitest]

requires:
  - phase: 01-reproducible-semantic-contract
    provides: exact generated register-schema facts, immutable RegisterDef semantics, and closed tagged values
provides:
  - Exact static register catalog and parameterized heating-circuit, zone, and room builders
  - Model- and feature-aware immutable RegisterRegistry with exact official overlap behavior
  - Independent complete 26-field register-schema serializer and golden parity evidence
affects: [transport-reading, model-detection, safety-sensitive-writes, cross-repository-ci]

tech-stack:
  added: []
  patterns:
    - Route every static and generated register through the sole validated createRegisterDef factory
    - Expose closure-backed immutable map views instead of relying on Object.freeze for native Map mutation safety
    - Keep the full contract serializer independent from the abbreviated runtime registry schema

key-files:
  created:
    - src/registers/core.ts
    - src/registers/feature-blocks.ts
    - src/registers/heating-circuits.ts
    - src/registers/zone-modules.ts
    - src/registers/registry.ts
    - src/registers/serialize.ts
    - src/registers/map-utils.ts
    - src/registers/index.ts
    - test/registers/builders.test.ts
    - test/parity/register-schema.test.ts
  modified:
    - src/errors.ts

key-decisions:
  - "Construct every register definition through createRegisterDef so static catalogs and parameterized builders inherit one exact validation and immutability boundary."
  - "Index runtime lookup by exact register type and documented start address while allowing official occupied-range overlaps between independent logical data points."
  - "Keep the complete 26-field parity serializer separate from RegisterRegistry.toSchema and internal to the register module until the evidence-promotion plan exposes only mapped public symbols."

patterns-established:
  - "Immutable catalog view: a closure owns each mutable Map while callers receive a frozen ReadonlyMap-compatible facade."
  - "Register composition: deterministic family builders compose model gates and independent feature flags without consulting runtime fixtures."

requirements-completed: [REG-01]

duration: 22 min
completed: 2026-07-15
---

# Phase 01 Plan 06: Exact Register Catalog and Schema Parity Summary

**The full pinned Python register catalog now has immutable TypeScript definitions, exact parameterized builders and gates, an overlap-safe registry, and byte-semantic golden schema parity.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-15T01:23:56Z
- **Completed:** 2026-07-15T01:46:08Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Ported all 153 static definitions across core, heat-pump, energy, cascade, solar, ISC, PV, Navigator-10-only, and GLT families through the central `createRegisterDef` validation boundary.
- Implemented exact A-G heating-circuit formulas plus zone 1-10 and room 1-8 builders, including stable diagnostics, the Python default of six rooms, exact model gates, and independent feature flags.
- Added an immutable `RegisterRegistry` whose default, full Navigator 10, and Navigator 2.0 circuit-A shapes contain exactly 267, 587, and 105 definitions.
- Preserved the three documented occupied-range overlaps at addresses 1393, 1442, and 1484 without shifting addresses, changing datatypes, or merging logical data points.
- Added an independent deterministic serializer for all 26 contract fields and proved exact equality against the pinned generated fixture.
- Kept the register barrel to exactly the nine mapped public values; internal serializers and composition helpers remain unpromoted pending Plan 01-09.

## Task Commits

Each task was committed atomically using RED/GREEN TDD:

1. **Task 01-06-01 RED: static register contracts** - `50ff9a7` (test)
2. **Task 01-06-01 GREEN: exact static register catalog** - `f2e823a` (feat)
3. **Task 01-06-02 RED: builder and registry contracts** - `e4b06a1` (test)
4. **Task 01-06-02 GREEN: builders and immutable registry** - `2656813` (feat)
5. **Task 01-06-03 RED: complete schema parity contract** - `551fa97` (test)
6. **Task 01-06-03 GREEN: serializer and golden parity** - `2a2da62` (feat)

## Files Created/Modified

- `src/registers/core.ts` - Exact common static register families.
- `src/registers/feature-blocks.ts` - Exact optional and model-specific static families.
- `src/registers/heating-circuits.ts` - A-G address formulas and circuit gates.
- `src/registers/zone-modules.ts` - Zone and room builders with pinned bounds and defaults.
- `src/registers/registry.ts` - Immutable composition, exact-start lookup, writes, and abbreviated runtime schema.
- `src/registers/serialize.ts` - Independent deterministic 26-field contract serializer.
- `src/registers/map-utils.ts` - Mutation-proof map construction and composition helpers.
- `src/registers/index.ts` - Exact nine-value mapped register barrel.
- `src/errors.ts` - Stable validation codes for generated register parameters.
- `test/registers/builders.test.ts` - Static catalogs, formulas, gates, bounds, registry, and immutability evidence.
- `test/parity/register-schema.test.ts` - Complete golden maps, official overlaps, serializer independence, and public-export evidence.

## Decisions Made

- `RegisterRegistry.get` follows nullable Python lookup semantics and returns `null`; `require` is the explicit throwing lookup.
- Registry duplicate rejection applies only to the same exact `(registerType, start address)` identity. Occupied-range overlap is deliberately valid because the official map defines separate requests at several boundaries.
- Active circuits inferred from `modelInfo` take precedence over manual circuit configuration, matching pinned Python behavior; independent feature options remain composable.
- Schema map keys, numeric enum entries, and excluded values are sorted for deterministic JSON while source-defined sequences retain their semantic order.

## Deviations from Plan

None - the plan was executed as written. `map-utils.ts` is the small internal helper allowed by implementation discretion; it changes neither the public API nor contract scope.

## Issues Encountered

- The long coverage process briefly outlived its command wrapper after producing the ignored Istanbul artifact. The result was inspected directly, and the duplicate process started by this plan was terminated; no process or worktree change remains.

## TDD Gate Compliance

- RED commits: `50ff9a7`, `e4b06a1`, `551fa97`.
- GREEN commits: `f2e823a`, `2656813`, `2a2da62`.
- Each RED gate failed for its intended absent implementation boundary. Every corresponding GREEN gate passed focused tests and strict typecheck before the next task began.

## Verification

- `npm test -- test/registers test/parity/register-schema.test.ts` - 62/62 focused tests passed across three suites.
- `npm test -- test/parity/register-schema.test.ts -t "official occupied-range overlaps"` - the exact positive overlap assertion passed.
- `npm test` - full repository suite passed.
- Coverage artifact aggregation - 91.16% statements, 90.44% branches, 89.01% functions, and 91.17% lines globally; every metric exceeds the 80% gate.
- `npm run typecheck` - passed.
- `npm run lint` - passed.
- `npm run format:check` - passed.
- `npm run build` - passed for ESM, CJS, and declarations.
- Pinned upstream fixture SHA-256 equals `c2aef3a2c75f48e37185d1d2c40243e89c6859ee008a7cbc32a430ffb20099a1`.
- Static stub and threat-surface scans found no placeholder implementation, network/authentication/file-access path, dependency change, secret, private address, device identifier, or raw capture introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Transport plans can consume exact start addresses, register types, sizes, write metadata, and model/feature composition without recreating register knowledge.
- Plan 01-09 can promote the nine evidenced register mappings into the package root while retaining the full serializer as an internal parity boundary.
- Navigator 1.0/1.7 remains correctly excluded as a separate unsupported protocol family.
- No blockers remain.

## Self-Check: PASSED

- All eight created source modules and both focused test files exist on disk.
- All six RED/GREEN commits are present in Git history.
- Exact golden counts, all 26 fields, official overlap identities, public barrel surface, coverage, build, and quality gates passed.

---

_Phase: 01-reproducible-semantic-contract_  
_Completed: 2026-07-15_
