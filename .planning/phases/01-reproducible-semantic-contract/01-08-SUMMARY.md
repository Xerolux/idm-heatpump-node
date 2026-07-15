---
phase: 01-reproducible-semantic-contract
plan: "08"
subsystem: parity-contracts
tags: [typescript, tagged-json, scenarios, validation, immutability]

requires:
  - phase: 01-reproducible-semantic-contract
    provides: exact pinned semantic fixtures and the closed normalization contract from Plan 01-02
provides:
  - Lossless closed tagged-number normalization and parsing for all exceptional IEEE-754 states
  - Strict bounded runtime parser for the complete versioned CTR-01 scenario envelope
  - Focused mutation evidence for provenance, fields, operations, names, words, clocks, bounds, and immutability
affects: [codec-goldens, register-schema, behavioral-contracts, cross-repository-ci]

tech-stack:
  added: []
  patterns:
    - Explicit recursive contract transforms with stable semantic codes and no permissive reviver
    - Parse into newly owned deeply frozen values before schema-specific validation
    - Validate transport words and clock events at their contract boundaries without narrowing codec inputs

key-files:
  created:
    - src/contracts/tagged-values.ts
    - src/contracts/scenario.ts
  modified:
    - test/parity/scenario-schema.test.ts

key-decisions:
  - "Reserve one exact one-key envelope for NaN, both infinities, and negative zero; raw exceptional numbers are rejected during parsing."
  - "Keep the version-1 scenario operation set closed to the four generated Phase-1 semantic operations; transport, write, and web operations require a later schema version."
  - "Validate only named words fields inside transport/request envelopes, while direct codec values and ordinary results retain their datatype-specific generated domains."
  - "Represent clock entries as finite, non-negative, monotonic synthetic timestamps without sorting their semantic order."

patterns-established:
  - "Contract ownership: clone every accepted collection and freeze the complete returned graph."
  - "Scenario admission: exact root/baseline identity, exact eight-field entries, unique bounded names, and operation-specific closed shapes."

requirements-completed: [CTR-01]

duration: 16 min
completed: 2026-07-15
---

# Phase 01 Plan 08: Lossless Tagged Values and CTR-01 Scenario Contract Summary

**A closed exceptional-number boundary and exact-baseline scenario parser now preserve IEEE-754 edge states while rejecting malformed, excessive, or later-phase contract data deterministically.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-07-15T00:15:34Z
- **Completed:** 2026-07-15T00:31:34Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Implemented normalization and parsing for finite values plus exact tagged `NaN`, positive/negative infinity, and negative zero, with `Object.is(-0)` preservation and no conversion to `null`.
- Added strict plain-data inspection, stable contract error codes, explicit depth/node/string/collection limits, cycle rejection, approved Map/Set normalization, and recursively frozen newly owned outputs.
- Parsed every generated behavior scenario against the exact pinned repository/package/version/tag/SHA/schema identity and all eight mandatory CTR-01 fields.
- Closed version 1 to the four generated semantic operation kinds, rejected duplicate names and later-phase operations, validated finite monotonic clocks and only transport/request `words`, and left direct codec values untouched for datatype-specific parity.

## Task Commits

Each task was committed atomically using RED/GREEN TDD:

1. **Task 01-08-01 RED: tagged-value contract tests** - `627bb36` (test)
2. **Task 01-08-01 GREEN: closed lossless tagged values** - `9048822` (feat)
3. **Task 01-08-02 RED: strict scenario-schema tests** - `49cacb3` (test)
4. **Task 01-08-02 GREEN: complete CTR-01 scenario parser** - `0087e3a` (feat)

## Files Created/Modified

- `src/contracts/tagged-values.ts` - Closed exceptional-number tags, approved collection normalization, bounded recursive parsing, stable errors, cloning, sorting, and deep freezing.
- `src/contracts/scenario.ts` - Exact version/provenance/operation/field parser with scoped Modbus-word and controlled-clock validation.
- `test/parity/scenario-schema.test.ts` - Fourteen focused tests covering tags, malformed values, bounds, ownership, generated fixtures, every schema boundary, and codec-domain isolation.

## Decisions Made

- The tagged-value parser distinguishes malformed exceptional-number representations with `invalid_number_tag`; unsupported structures and resource bounds use `invalid_contract_value`.
- Fixture identity/schema failures use `fixture_invalid`, while scenario fields, operations, names, clocks, and envelope words use `scenario_invalid`.
- Version 1 operation declarations must match the complete generated four-kind list in deterministic order; later transport/runtime/write/web operations remain rejected until their owning phases version the schema.
- Clock events are controlled timestamps: finite, non-negative, monotonic, and order-preserving. No sorting or coercion is performed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected incomplete GSD state recalculation**

- **Found during:** Plan close-out tracking
- **Issue:** The installed GSD SDK warned that this repository uses a legacy free-form roadmap and rewrote the STATE frontmatter percentage to `0` while leaving activity, progress, and velocity summaries stale.
- **Fix:** Preserved the handler-applied plan/session/decision updates, then reconciled the affected STATE counters and summaries to the four committed phase summaries and 92 execution minutes.
- **Files modified:** `.planning/STATE.md`
- **Verification:** STATE reports Plan 5 of 10 ready, 4/10 completed, 40% progress, four metrics rows, and the Plan 01-08 stop point; ROADMAP reports 4/10.
- **Committed in:** final plan metadata commit

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Tracking metadata was corrected without changing implementation scope or contract behavior.

## Issues Encountered

- The GSD SDK still emits a deprecation warning for the existing free-form roadmap format; the warning is informational after the reconciled tracking state and does not block later plans.

## TDD Gate Compliance

- RED commits: `627bb36`, `49cacb3`.
- GREEN commits: `9048822`, `0087e3a`.
- Both RED runs failed only because their planned implementation module did not yet exist; each subsequent GREEN gate passed its focused tests and strict typecheck.

## Verification

- `npm test -- test/parity/scenario-schema.test.ts` - 14/14 tests passed.
- `npm test` - 73/73 tests passed across five suites.
- `npm run test:coverage` - passed with 92.51% statements, 90% branches, 100% functions, and 92.37% lines globally.
- New contract files individually exceed the 80% branch gate: `scenario.ts` 88.7%, `tagged-values.ts` 84.61%.
- `npm run typecheck` - passed.
- `npm run lint` - passed.
- `npm run format:check` - passed.
- Static stub and threat-surface scans found no TODO/FIXME/placeholder, network endpoint, authentication path, file-access path, dependency change, secret, private address, device identifier, or raw capture introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-05 can consume tagged codec expectations without losing NaN, infinities, or negative zero and without inheriting a false global word restriction.
- Later behavioral phases can add transport/detection/write/web operation kinds through explicit schema evolution rather than silently widening version 1.
- No blockers remain.

## Self-Check: PASSED

- Both created contract modules and the focused scenario test exist on disk.
- All four RED/GREEN commits are present in Git history.
- Every task acceptance criterion, plan verification command, coverage gate, stub scan, and threat-surface check passed.

---

_Phase: 01-reproducible-semantic-contract_  
_Completed: 2026-07-15_
