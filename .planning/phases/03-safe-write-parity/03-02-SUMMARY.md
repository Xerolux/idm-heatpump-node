---
phase: 03-safe-write-parity
plan: "02"
subsystem: testing
tags: [python, modbus, fc16, write-safety, parity, transactional-generation]

requires:
  - phase: 03-safe-write-parity
    provides: Closed write validation codes, immutable FC16 request factory, and fake write transport
provides:
  - Separate bounded closed write-behavior fixture parser
  - Exact Python 0.7.6-generated write behavior authority with 49 scenarios
  - Atomic eight-fixture/two-document generation, rollback, and fixed-point closure
  - Byte-preservation proof for every pre-Phase-3 fixture
affects:
  [03-safe-write-parity, client-write-planning, write-execution, adapter-parity, release-gates]

tech-stack:
  added: []
  patterns:
    - Independent generated write evidence before TypeScript implementation or API promotion
    - Closed sequence actions with per-step result and safety-state snapshots
    - One durable all-or-nothing transaction for eight fixtures and two documents

key-files:
  created:
    - src/contracts/write-scenario.ts
    - test/fixtures/write-behavior.json
    - test/parity/write-contract.test.ts
  modified:
    - scripts/generate-python-contract.py
    - scripts/check-parity.mjs
    - test/parity/generator.test.ts
    - test/parity/phase-gate.test.ts

key-decisions:
  - "Keep write behavior in a separate closed fixture so all seven established read and schema fixtures remain byte-authoritative."
  - "Derive every outcome, FC16 trace, controlled-time transition, and state snapshot by executing Python 0.7.6 at the exact pinned SHA."
  - "Use explicit reviewed validation codes per Python rejection case; messages never determine semantic equality."

patterns-established:
  - "Write fixture boundary: exact eight action kinds, exact per-kind fields, bounded graphs, synthetic endpoints, reviewed errors, and shared FC16 validation."
  - "Write generation: controlled monotonic time and fake write_registers produce requests and success-only EEPROM/cyclic state without live I/O."

requirements-completed: [WRT-01, WRT-02, TRN-03W, ERR-01W]

duration: 29 min
completed: 2026-07-17
---

# Phase 3 Plan 2: Generated Write Authority Summary

**Closed Python-generated FC16 write evidence with validation, EEPROM, cyclic, retry, rollback, diagnostic, and transaction coverage**

## Performance

- **Duration:** 29 min
- **Started:** 2026-07-17T02:48:26Z
- **Completed:** 2026-07-17T03:17:01Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added a separate parser that rejects unbounded graphs, dangerous keys, malformed custom registers, illegal number tags, non-synthetic endpoints, unknown errors, and malformed FC16 traces before execution.
- Generated 49 unique scenarios by executing the exact clean Python `0.7.6` checkout at `ad121ebf34a5f5e37204371c026927d77efcd15c`, covering planning/no-traffic, validation precedence, one-/two-word FC16, EEPROM, cyclic state, reconnect classes, Code 2, exhaustion, rollback, redaction, and ordering.
- Extended the existing transaction to exactly eight fixtures plus two documents, with successful fixed-point checking, old-fixture byte preservation, symlink/directory closure, and injected replacement rollback for all ten artifacts.

## Task Commits

Each task was committed atomically using TDD:

1. **Task 03-02-01: Define and mutation-test the closed write scenario contract**
   - `3c154ec` (RED tests)
   - `d0546ac` (GREEN parser)
2. **Task 03-02-02: Generate the complete pinned Python write matrix transactionally**
   - `5df7088` (RED generation/transaction tests)
   - `98af278` (GREEN generator, fixture, and ten-artifact transaction)

## Files Created/Modified

- `src/contracts/write-scenario.ts` - Bounded closed schema, custom-register validation, error secrecy, state/result validation, and shared FC16 request checks.
- `test/fixtures/write-behavior.json` - Canonical Python-produced write authority with exact baseline identity and 49 scenarios.
- `scripts/generate-python-contract.py` - Controlled monotonic Python write harness, fake `write_registers`, explicit rejection codes, and write state projection.
- `scripts/check-parity.mjs` - Fixed ten-artifact generation/check/replacement allowlist and governed labels.
- `test/parity/write-contract.test.ts` - Schema, mutation, bounds, immutability, secrecy, and generated-fixture parser proof.
- `test/parity/generator.test.ts` - Matrix inventory, old-byte preservation, fixed-point, and fixture rollback proof.
- `test/parity/phase-gate.test.ts` - Full orchestrator ten-artifact inventory and injected replacement rollback proof.

## Decisions Made

- Retained the Phase-2 transport fixture and parser unchanged; writes use their own stricter evidence boundary.
- Kept ordinary write-side Modbus Code 2 as retryable `modbus` evidence, never read-side `illegal_address`/unsupported state.
- Required custom definitions to use explicit synthetic provenance and pass the real register plus FC16 factories.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended the existing phase-gate transaction inventory**

- **Found during:** Task 03-02-02
- **Issue:** The task file list did not name `test/parity/phase-gate.test.ts`, but that suite owns the real two-document plus fixture replacement transaction and still asserted nine artifacts.
- **Fix:** Added `write-behavior.json`, changed inventory to ten, and proved an injected mid-replacement failure restores all ten artifacts.
- **Files modified:** `test/parity/phase-gate.test.ts`
- **Verification:** `npm test -- test/parity/phase-gate.test.ts -t "ten generated artifacts|rolls back all ten"`
- **Committed in:** `98af278`

---

**Total deviations:** 1 auto-fixed (1 missing critical). **Impact:** Required transaction correctness was closed without changing runtime/package/register behavior.

## Issues Encountered

None - expected TDD RED failures were resolved within their owning tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-03 can consume independently generated Python outcomes for pure write planning, validation order, EEPROM formatting, and cyclic projections.
- No TypeScript client write method, real provider write, public mapping, dependency, register map, live network, or release state was changed.

## Self-Check: PASSED

- Created parser and fixture exist; all four task commits are present.
- `parity:generate` and non-mutating `parity:check` passed at the exact tag/SHA.
- Focused parser/generator/fixed-point/rollback tests, strict typecheck, ESLint, Prettier, and `git diff --check` passed.
- All seven pre-Phase-3 fixture SHA-256 values remained unchanged.

---

_Phase: 03-safe-write-parity_
_Completed: 2026-07-17_
