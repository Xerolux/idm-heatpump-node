---
phase: 03-safe-write-parity
plan: "06"
subsystem: testing
tags: [write-parity, modbus, fc16, generated-contract, mutation-testing]

requires:
  - phase: 03-safe-write-parity
    provides: Generated Python write fixture, private transactional write engine, and production FC16 adapter
provides:
  - Exact once-only execution of every generated Python write scenario through the TypeScript client
  - Structural result, request, clock, state, retry, reconnect, and diagnostic parity proof
  - Closed action/result/request mutation and secrecy validation
  - Ten-artifact rollback and fixed-point regeneration evidence
affects: [03-07-api-promotion, package-contract, release-gates]

tech-stack:
  added: []
  patterns:
    - Parsed generated scenarios drive an independent deterministic TypeScript executor
    - Production adapter acknowledgement validation runs behind a scripted provider double
    - Cross-field fixture validation closes action/result, response/request, and final-state identity

key-files:
  created:
    - test/support/write-scenario-runner.ts
  modified:
    - src/contracts/write-scenario.ts
    - src/client/idm-modbus-client.ts
    - src/client/internal-create.ts
    - test/parity/write-contract.test.ts
    - scripts/check-package.mjs

key-decisions:
  - "Execute every parsed scenario through the private client and production adapter boundary while keeping all expected behavior Python-owned."
  - "Seed detected model information only through a private internal test seam so generated model-gated writes require no unplanned probe traffic."
  - "Reject fixtures whose action/result, acknowledgement/request, or final-step/final-state projections disagree."

patterns-established:
  - "Scenario closure: parsed action inputs are dispatched once, every scripted response is consumed, and actual observations are compared outside the runner."
  - "Secrecy closure: raw causes/provider payloads and configured endpoints are forbidden from errors, diagnostics, documentation, and packed artifacts."

requirements-completed: [WRT-01, WRT-02, TRN-03W, ERR-01W]

duration: 24 min
completed: 2026-07-17
---

# Phase 3 Plan 6: Executable Write Parity Summary

**All 49 generated Python write scenarios now execute exactly once through the private TypeScript client and production FC16 acknowledgement boundary with complete structural parity**

## Performance

- **Duration:** 24 min
- **Started:** 2026-07-17T06:08:00+02:00
- **Completed:** 2026-07-17T06:32:00+02:00
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added an independent deterministic runner that dispatches all eight closed write action kinds and executes all 49 generated scenarios once without handwritten expected outcomes, live TCP, or hardware access.
- Compared every action result, ordered lifecycle/FC16 trace, controlled clock observation, retry/reconnect transition, EEPROM/cyclic state, last error, unsupported state, and final snapshot against Python-owned evidence.
- Hardened the parser with action-specific result shapes, requested-value identity, encoded-word bounds, acknowledgement-to-request correlation, and exact final-state closure.
- Proved adversarial mutation and secrecy handling, seven-old-fixture byte stability, fixed-point generation, and byte-identical rollback of all ten generated artifacts.
- Kept the seven write methods and mapping promotion private for Plan 03-07.

## Task Commits

Each task was committed atomically using TDD:

1. **Task 03-06-01: Execute every generated scenario exactly once**
   - `56ac2a1` (RED generated runner proof)
   - `4b78bb5` (GREEN independent scenario executor)
2. **Task 03-06-02: Close mutation, secrecy, rollback, and fixed-point evidence**
   - `9e5afc8` (RED adversarial evidence tests)
   - `b95d2e3` (GREEN parser and evidence closure)
3. **Blocking package-smoke compatibility fix**
   - `d5a088b` (complete the structural transport double after Plan 03-05)

## Files Created/Modified

- `test/support/write-scenario-runner.ts` - Executes parsed generated actions through the private client, controlled clock, scripted provider, and production adapter acknowledgement gate.
- `test/parity/write-contract.test.ts` - Proves exact scenario inventory/execution, structural equality, mutations, bounds, correlations, and secrecy.
- `src/contracts/write-scenario.ts` - Closes cross-field action/result/request/response/state relationships.
- `src/client/idm-modbus-client.ts` - Adds private-only model seeding needed to reproduce generated model-gated scenarios without probe traffic.
- `src/client/internal-create.ts` - Exposes the model seed only to the internal test-control surface.
- `scripts/check-package.mjs` - Keeps the clean-consumer structural transport smoke complete after the production transport gained FC16 writes.

## Decisions Made

- Used the real production Modbus adapter behind a scripted provider client so acknowledgement validation is exercised without creating a socket or accepting adapter behavior from fixture expectations.
- Kept comparisons outside the runner; the runner consumes actions and transport scripts but never reads `expected_result`, `expected_requests`, or `expected_state` as implementation instructions.
- Added only a private model-information seed because generated detected-model scenarios otherwise require forbidden detection reads before the write sequence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added a private detected-model seed for generated scenarios**

- **Found during:** Task 03-06-01
- **Issue:** The internal client had no way to reproduce a fixture's already-detected model without issuing unplanned probe traffic.
- **Fix:** Added a private WeakMap-backed internal seed that rebuilds the private model-aware register map without changing the public class or root exports.
- **Files modified:** `src/client/idm-modbus-client.ts`, `src/client/internal-create.ts`
- **Verification:** All 49 generated scenarios execute once and the public mapping/root/package diff remains empty.
- **Committed in:** `4b78bb5`

**2. [Rule 3 - Blocking] Completed the package type-smoke transport double**

- **Found during:** Final package secrecy/installability verification
- **Issue:** Plan 03-05 made `ModbusTransport.write` mandatory, but the clean-consumer structural type double still implemented reads only.
- **Fix:** Added the required no-op `write` signature to the generated consumer source.
- **Files modified:** `scripts/check-package.mjs`
- **Verification:** `npm run pack:check` passes ESM, CommonJS, declarations, exact 15-file allowlist, client, and transport smoke without connecting.
- **Committed in:** `d5a088b`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both fixes were required to execute closed generated evidence and preserve package verification; no public API, mapping, dependency, register, network, or hardware scope changed.

## Issues Encountered

- The stronger cross-field parser correctly invalidated two unit-test fixtures that changed actions or requests without updating their corresponding synthetic results/responses; those fixtures were made internally coherent.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-07 can promote the seven evidenced write methods and their mapping rows atomically.
- All generated parity, write regressions, strict TypeScript, ESLint, Prettier, package smoke, governed diff, and ten-artifact transaction gates pass.
- No live endpoint, socket, hardware write, publication, dependency update, register-map change, or public write promotion occurred.

## Self-Check: PASSED

- Every one of the 49 generated scenarios executed exactly once; all 15 write-contract tests and 120 focused write/adapter tests passed.
- Mutation/secrecy plus generator fixed-point/rollback filters passed, including the real orchestrator's injected rollback of all ten artifacts.
- `parity:generate` and `parity:check` passed against Python `0.7.6`, tag `v0.7.6`, commit `ad121ebf34a5f5e37204371c026927d77efcd15c`; governed files had zero diff.
- Strict typecheck, ESLint, Prettier, `git diff --check`, build, and exact package smoke passed.

---

_Phase: 03-safe-write-parity_
_Completed: 2026-07-17_
