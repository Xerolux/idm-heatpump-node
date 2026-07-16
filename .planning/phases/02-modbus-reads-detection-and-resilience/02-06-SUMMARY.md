---
phase: 02-modbus-reads-detection-and-resilience
plan: "06"
subsystem: client-reads-and-batching
tags: [modbus, reads, batching, fallback, quarantine, parity]

requires:
  - phase: 02-modbus-reads-detection-and-resilience
    provides: adapter-neutral transport, deterministic fakes, FIFO lifecycle, retries, reconnects, and normalized error state from Plans 02-02 through 02-05
provides:
  - Exact FC03/FC04 single reads and model-aware readValue lookup
  - Protocol-correct same-type strict-adjacency grouping that preserves official logical overlaps
  - Ordered batch fallback, failure tracking, permanent/unsupported state, and suspect-value quarantine
  - Executable generated result/request/time/state parity for every non-detection Phase-2 transport scenario
affects: [phase-2-detection, phase-2-adapter, phase-2-public-promotion, phase-2-gates]

tech-stack:
  added: []
  patterns:
    - Group documented logical starts and sizes without occupied-range normalization
    - Mutate per-register failure state only inside ordered individual fallback
    - Execute generated Python scenarios through a direct internal-only client inspection seam

key-files:
  created:
    - src/client/read-groups.ts
  modified:
    - src/client/idm-modbus-client.ts
    - src/client/internal-create.ts
    - test/client/reads.test.ts
    - test/client/batching.test.ts
    - test/client/resilience.test.ts
    - test/parity/transport-contract.test.ts
    - test/support/fake-modbus-transport.ts
    - test/codec.test.ts

key-decisions:
  - "Keep ordinary direct reads independent from fallback failure counters and unsupported/permanent state."
  - "Group only exact same-type adjacency within the complete address span; documented overlaps always remain separate requests."
  - "Keep generated scenario setup, raw probe execution, transport attachment, and state inspection behind a direct internal path absent from package exports."
  - "Treat only structured Code 2 as unsupported, while generic device failures become permanent on the third individual fallback occurrence."

patterns-established:
  - "Batch sequence: filter, split quarantine, stable-sort candidates, read exact groups, then read pre-quarantined definitions in original filtered-input order."
  - "Quarantine sequence: omit suspect grouped value, mark batch-unsafe, reread once individually, and expose only a successfully validated result."

requirements-completed: [TRN-02, TRN-03R, DET-02, ERR-01R]

duration: 19 min
completed: 2026-07-16
---

# Phase 02 Plan 06: Exact Reads, Safe Batching, and Read Parity Summary

**Exact single and batch reads now preserve documented IDM request identities while matching Python fallback, quarantine, failure state, traces, time, and results.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-07-16T21:06:28Z
- **Completed:** 2026-07-16T21:25:03Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added exact FC03 holding and FC04 input reads with documented start/count validation before codec dispatch, model-aware `readValue`, and direct-read state isolation.
- Added pure stable grouping by register type and address with strict adjacency, complete-span limits, and explicit preservation of the official overlaps at 1393, 1442, and 1484.
- Added deterministic batch execution, device-error fallback, immediate Code-2 unsupported/permanent state, third-failure permanent state, success counter clearing, and transport-error propagation without register counter mutation.
- Added suspect enum/range quarantine with one individual reread, invalid-result omission, and explicit acceptance of null, booleans, and documented sentinels.
- Executed all 29 generated non-detection transport scenarios through the real TypeScript client and compared exact result, ordered lifecycle/read trace, controlled delays, final state, and complete response consumption.

## Task Commits

Each task followed RED/GREEN TDD:

1. **Task 02-06-01 RED: exact single reads and grouping contracts** - `f03a86d`
2. **Task 02-06-01 GREEN: exact single reads and protocol-safe grouping** - `6fc5343`
3. **Task 02-06-01 formatting follow-up** - `374d804`
4. **Task 02-06-02 RED: fallback, failure, and quarantine contracts** - `a7a2bce`
5. **Task 02-06-02 GREEN: ordered fallback and batch quarantine** - `be38b85`
6. **Task 02-06-03 RED: executable generated transport scenarios** - `8e94800`
7. **Task 02-06-03 GREEN: generated read/resilience scenario execution** - `65312c6`
8. **Verification maintenance: update stale partial-client codec assertion** - `3683827`

## Files Created/Modified

- `src/client/read-groups.ts` - Pure stable exact-adjacency/type/span grouping.
- `src/client/idm-modbus-client.ts` - Single reads, batches, fallback, failure state, quarantine, exact invalid-response normalization, and internal test control.
- `src/client/internal-create.ts` - Direct-path-only scenario attachment, raw read, state seed, and snapshot helpers.
- `test/client/reads.test.ts` - FC03/FC04, exact response shape, decode, lookup, and direct-state evidence.
- `test/client/batching.test.ts` - Adjacency, gap, type, span, overlap, order, fallback, and quarantine evidence.
- `test/client/resilience.test.ts` - Permanent, unsupported, transport propagation, success clearing, and reset evidence.
- `test/parity/transport-contract.test.ts` - Closed execution of all owned generated transport scenarios.
- `test/support/fake-modbus-transport.ts` - Preconnected and mismatched-response modes used only by deterministic parity evidence.
- `test/codec.test.ts` - Corrected the stale Phase-1 expectation from planned to partial client status.

## Decisions Made

- Direct `readRegister` failures throw without changing fallback counters or permanent/unsupported state; only individual batch fallback owns those transitions.
- Grouping uses the official logical start and size of each data point. It never shifts addresses, shrinks datatypes, merges overlaps, or introduces a no-overlap invariant.
- Batch-level Modbus, Code-2, and invalid-response failures trigger ordered individual fallback; timeout, disconnected, socket, and no-response failures remain transport failures and propagate.
- The generated runner resolves names from canonical source register definitions. Synthetic definitions are accepted only from generated scenario configuration and expected protocol metadata is never used to build requests.

## Deviations from Plan

### Auto-fixed Issues

**1. Updated one stale Phase-1 codec ownership assertion**

- **Found during:** Repository verification
- **Issue:** The test still expected `IdmModbusClient` mapping status `planned`, although Phase 2 had already promoted it to `partial`.
- **Fix:** Updated only the assertion and title to the current machine-checked mapping state.
- **Files modified:** `test/codec.test.ts`
- **Verification:** The codec suite passes 27/27 tests.
- **Committed in:** `3683827`

---

**Total deviations:** 1 auto-fixed verification issue.
**Impact on plan:** No scope change; the fix aligned an obsolete test with existing API-governance state.

## Issues Encountered

- The generated fixture intentionally omits internal setup state for a small number of scenarios. A closed scenario-name setup switch seeds only the Python-generated preconditions needed for those cases.
- A broad exploratory `npm run check` exposed the stale codec assertion and entered the intentionally long self-provisioning phase-gate. Required plan verification, package build, and tarball smoke were then run directly and passed.

## TDD Gate Compliance

- Task 1 RED failed on absent single-read/grouping behavior; GREEN passes exact request, validation, state-isolation, and overlap grouping contracts.
- Task 2 RED failed on absent batch fallback/quarantine behavior; GREEN passes all device/transport failure classes and state transitions.
- Task 3 RED failed on absent internal execution/snapshot helpers; GREEN passes all 29 owned generated scenarios and consumes every scripted response.
- No failing behavioral assertion was removed or weakened.

## Automated Evidence

- `npm test -- test/parity/transport-contract.test.ts test/client/reads.test.ts test/client/batching.test.ts test/client/resilience.test.ts` passes 63/63 tests.
- Expanded verification including codec and register-schema parity passes 95/95 tests across six files.
- Strict `npm run typecheck`, `npm run lint`, and `npm run format:check` pass.
- `npm run build` succeeds for ESM, CommonJS, source maps, and declarations.
- `npm run pack:check` reports 15 intended files and passes ESM/CommonJS tarball smoke tests.
- No file under `src/registers/` and no generated register-schema fixture changed from the pre-plan baseline.
- Production source contains no import of `transport-behavior.json`; direct scenario controls remain outside package barrels and emitted root declarations.

## Known Stubs

- The five generated model-detection scenarios remain intentionally deferred to Plan 02-07.
- The default real Modbus adapter remains intentionally deferred to Plan 02-08.

## User Setup Required

None - no dependency installation, endpoint, credential, device, network, or hardware action is required.

## Next Phase Readiness

- Plan 02-07 can reuse the exact raw probe path, FIFO, generated scenario runner, canonical register resolution, and state snapshot to implement ordered model/capability detection.
- Plan 02-08 can bind the real adapter without changing read grouping, fallback, or quarantine semantics.

## Self-Check: PASSED

- All implementation/test artifacts and this summary exist.
- All RED/GREEN and verification commits are present in Git history.
- Every task acceptance criterion and plan-level verification command passes.

---

_Phase: 02-modbus-reads-detection-and-resilience_  
_Completed: 2026-07-16_
