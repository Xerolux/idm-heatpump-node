---
phase: 01-reproducible-semantic-contract
plan: "04"
subsystem: semantic-foundation
tags: [typescript, constants, immutable-data, timing, register-definition, parity]

requires:
  - phase: 01-reproducible-semantic-contract
    provides: pinned Python semantic fixtures and the sole public API ownership mapping
provides:
  - All 35 pinned public constants with mutation-safe collection representations
  - Frozen const-and-union datatype, register-type, and write-class domains
  - Immutable FeatureFlags and IdmModelInfo factories plus exact pure timing helpers
  - Deeply immutable RegisterDef factory with pinned validation and derived metadata
affects: [codec, register-builders, registry, transport, writes, phase-1-parity-closure]

tech-stack:
  added: []
  patterns:
    - Frozen runtime const objects paired with derived TypeScript unions
    - Closure-backed readonly collection views for real runtime mutation resistance
    - Mapping-approved type/value factory namespaces for immutable data shapes
    - One exact RegisterDef construction boundary with derived size and write class

key-files:
  created:
    - src/constants.ts
    - src/types.ts
    - src/errors.ts
    - src/timing.ts
    - src/registers/definitions.ts
    - test/semantic/constants-and-types.test.ts
    - test/registers/register-def.test.ts
  modified: []

key-decisions:
  - "Represent mapped readonly dataclasses through the mapped FeatureFlags and IdmModelInfo symbols as frozen factory namespaces, without adding unmapped root helper names."
  - "Use closure-backed ReadonlySet views because Object.freeze(new Set()) does not disable add/delete mutations."
  - "Keep RegisterDef validation exactly at the pinned Python __post_init__ boundary while applying TypeScript-only deep clone/freeze hardening."

patterns-established:
  - "Runtime immutability: readonly types are paired with frozen values and mutation-safe collection views."
  - "Semantic errors: Phase-1 validation failures expose category=validation and code=register_invalid with diagnostics used only for debugging."
  - "Register definitions: callers supply only source fields; size and writeClass are always centrally derived."

requirements-completed: [API-01, REG-01]

duration: 12 min
completed: 2026-07-15
---

# Phase 01 Plan 04: Immutable Semantic Foundation Summary

**Pinned constants, const-and-union domains, deterministic timing helpers, and a deeply immutable RegisterDef factory now match the Python 0.7.6 semantic boundary without adding stricter validation.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-15T00:42:07Z
- **Completed:** 2026-07-15T00:54:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Ported all 35 pinned `const.py` exports, including exact numeric option keys, model/feature values, circuit limits, and the complete EEPROM address set.
- Added frozen `DataType`, `RegisterType`, and `WriteClass` runtime objects with derived unions and one exhaustive `DATA_TYPE_SIZE` record.
- Implemented immutable mapped `FeatureFlags` and `IdmModelInfo` factory representations, including cloned collections, exact defaults, and derived `isPro`.
- Matched `AdaptiveBackoff` and `PollRateLimiter` signatures, defaults, validation, controlled-clock behavior, and readonly `interval` surface.
- Added one plain-object `createRegisterDef` boundary covering all 26 mapped fields, every pinned validation branch, write-class precedence, datatype size, deep metadata isolation, sentinels, and documented overlaps.

## Task Commits

Each task was committed atomically using RED/GREEN TDD:

1. **Task 01-04-01 RED: semantic foundation contracts** - `670e89a` (test)
2. **Task 01-04-01 GREEN: immutable constants, types, and timing** - `1f6cc4b` (feat)
3. **Task 01-04-02 RED: RegisterDef contracts** - `68f6081` (test)
4. **Task 01-04-02 GREEN: exact immutable RegisterDef factory** - `6c5e4dd` (feat)

## Files Created/Modified

- `src/constants.ts` - Exact immutable scalar, option-map, sequence, and EEPROM-set constants.
- `src/types.ts` - Frozen value domains, exhaustive sizes, and mapped readonly data factories.
- `src/errors.ts` - Stable Phase-1 semantic validation error shape.
- `src/timing.ts` - Python-equivalent adaptive backoff and poll rate limiting.
- `src/registers/definitions.ts` - Plain immutable RegisterDef interface/input/factory and exact derived metadata.
- `test/semantic/constants-and-types.test.ts` - Mapping/fixture closure, defaults, timing, and hostile mutation evidence.
- `test/registers/register-def.test.ts` - Complete defaults/invariants/precedence/acceptance/immutability/sentinel/overlap evidence.

## Decisions Made

- The mapped `FeatureFlags` and `IdmModelInfo` symbols each carry both their TypeScript interface and a same-name frozen `.create()` factory namespace. This fulfills the sole mapping's `readonly_object_factory` decision without inventing extra public root symbols.
- Set-like values use frozen closure-backed `ReadonlySet` views. Freezing a native JavaScript `Set` alone would still allow hostile `add()` and `delete()` calls.
- `createRegisterDef` deliberately accepts an empty name, fractional non-negative address, and otherwise unvalidated collection members because pinned Python accepts them. It clones/freezes those members but does not narrow their semantic domain.
- Sentinels remain exact decoded numbers in readonly metadata; no null conversion or physical-range filtering occurs at definition construction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected stale state progress after the GSD update handler**

- **Found during:** Plan close-out
- **Issue:** The state handler reported 5/10 plans and 50% but persisted `percent: 0`, retained the 40% body bar, and did not aggregate the new execution metric into the velocity summary.
- **Fix:** Reconciled STATE.md to the handler's reported 5/10 result and the recorded five-plan metric table.
- **Files modified:** `.planning/STATE.md`
- **Verification:** Frontmatter, current position, progress bar, plan count, duration totals, and the per-plan metric row now agree.
- **Committed in:** Plan metadata commit

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Tracking-only correction; runtime behavior, fixtures, public mapping, and source implementation are unchanged.

## Issues Encountered

None.

## TDD Gate Compliance

- RED commits: `670e89a`, `68f6081`
- GREEN commits: `1f6cc4b`, `6c5e4dd`
- Both RED runs failed for the intended absent semantic/RegisterDef modules before implementation.

## Verification

- Focused semantic and RegisterDef suites: 55/55 tests passed.
- Full repository Vitest suite passed.
- Coverage gate passed at the repository's 80% branch/function/line/statement thresholds.
- `npm run typecheck` passed under strict TypeScript settings.
- `npm run lint` passed.
- `npm run format:check` passed.
- `npm run build` passed for the shared ESM/CommonJS source.
- `rg "\benum\b" src/constants.ts src/types.ts` returned no enum declaration.
- Mapping/fact tests proved exactly 35 constants, all 26 RegisterDef fields, every mapped representation, and the complete timing/data member surfaces.

## Known Stubs

None. No transport, write execution, or web behavior was introduced by this semantic-only plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-05 can consume the centralized datatype domains and sizes for bit-exact codecs.
- Plans 01-06 and 01-07 can construct every register through the immutable factory without duplicating validation or write-class rules.
- Phase-1 public exports remain intentionally gated for the later evidence-promotion plan; no partial client/write/web surface was exposed.

## Self-Check: PASSED

- All seven planned source/test artifacts and this summary exist on disk.
- All four RED/GREEN commits exist in Git history in the required order.
- Both task verification commands, every acceptance criterion, full-suite checks, coverage, typecheck, lint, format, build, immutability probes, no-enum check, and no-overlap safeguard passed.

---

_Phase: 01-reproducible-semantic-contract_  
_Completed: 2026-07-15_
