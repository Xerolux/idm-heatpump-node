---
phase: 02-modbus-reads-detection-and-resilience
plan: "07"
subsystem: client-detection-and-diagnostics
tags: [modbus, detection, diagnostics, sentinels, register-map, parity]

requires:
  - phase: 02-modbus-reads-detection-and-resilience
    provides: serialized lifecycle, exact probes, retries, normalized errors, reads, batching, fallback, and quarantine from Plans 02-01 through 02-06
provides:
  - Exact ordered heating-circuit, zone, capability, Navigator-10, and firmware detection
  - Immutable model information and cached model-aware register maps
  - Sorted client-owned diagnostics/query snapshots with exact reset ownership
  - Executable parity for all five Python-generated detection scenarios
affects: [phase-2-adapter, phase-2-public-promotion, phase-2-closure, phase-3-writes]

tech-stack:
  added: []
  patterns:
    - Keep ordered detection policy in a transport-neutral service driven by one locked probe callback
    - Build and replace immutable model/map state only after a complete detection result
    - Sort internal set snapshots before passing them to order-preserving public factories

key-files:
  created:
    - src/client/detection.ts
    - test/client/detection.test.ts
  modified:
    - src/client/idm-modbus-client.ts
    - test/client/diagnostics.test.ts
    - test/parity/transport-contract.test.ts

key-decisions:
  - "Keep the detection sequence explicit because Navigator-10 address 4108 and firmware address 4120 are direct probes outside the reusable detection-register catalog."
  - "Use the existing low-word-first codec and Python-equivalent two-decimal decoding for firmware instead of introducing another rounding path."
  - "Replace cached model information and the model-aware register map only after every ordered probe has completed."
  - "Keep diagnostics factories order-preserving; the client alone sorts copied internal set snapshots."

patterns-established:
  - "Detection probes every address with one attempt and a 2000 ms request timeout while the existing FIFO owns the complete operation."
  - "Exact two-word circuit responses prove presence unless they decode to the documented -1 unavailable sentinel."

requirements-completed: [TRN-02, DET-01, DET-02, ERR-01R]

duration: 20 min
completed: 2026-07-16
---

# Phase 02 Plan 07: Ordered Detection and Diagnostics Summary

**Exact IDM probe streams now produce Python-equivalent immutable models, capabilities, firmware, register maps, diagnostics, and final client state.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-16T21:29:56Z
- **Completed:** 2026-07-16T21:49:53Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added the exact pinned probe sequence for heating circuits, zone modules, solar, ISC, PV, cascade, Navigator 10, and optional firmware.
- Preserved two-missing stop rules, circuit `-1.0`, cascade low-byte `255`, exact-pair presence, model priority, Unknown fallback, and Python-equivalent firmware rounding.
- Stored immutable detected model information and cached the exact Phase-1 model/feature-aware register map without Navigator-1 facts.
- Proved sorted immutable diagnostics/query snapshots, retained last-error ownership, clear-last-error behavior, reset scope, and disconnected/reconnected state.
- Executed all five generated detection scenarios through the real TypeScript client and compared result, request trace, timeout, register-map projection, normalized errors, and final state.

## Task Commits

Each task followed RED/GREEN TDD:

1. **Task 02-07-01 RED: ordered detection contracts** - `9372ad4`
2. **Task 02-07-01 GREEN: ordered detection and cached model map** - `f086543`
3. **Task 02-07-02 RED: diagnostics and generated detection parity** - `c3fa7c1`
4. **Task 02-07-02 GREEN: diagnostics and generated scenario execution** - `a81ba11`
5. **Task 02-07-02 evidence: diagnostics lifecycle/reset retention** - `af4f292`

## Files Created/Modified

- `src/client/detection.ts` - Explicit ordered detection/classification service with exact sentinel and firmware semantics.
- `src/client/idm-modbus-client.ts` - Serialized `detectModel`, immutable model state, and cached model-aware register map.
- `test/client/detection.test.ts` - Model priority, capabilities, stop rules, sentinels, firmware, order, timeout, state isolation, and map evidence.
- `test/client/diagnostics.test.ts` - Sorting responsibility, ownership, error retention/clearing, reset scope, and lifecycle snapshots.
- `test/parity/transport-contract.test.ts` - Closed execution of all Python-generated detection scenarios.

## Decisions Made

- Detection remains transport-neutral: the client supplies a callback that enforces one attempt, FC04, and a 2000 ms timeout under the existing complete-operation FIFO.
- An exact two-word circuit response remains active when undecodable or outside the plausibility range; only a decoded `-1.0` or missing/short response is unavailable.
- Exact solar, ISC, and PV pairs prove presence; cascade uses the low byte so `0` is present and `255` is unavailable.
- Navigator 10 has priority over Pro, Pro over Navigator 2.0, and Navigator 2.0 over Unknown; public `modelName` retains the pinned Navigator 2.0 fallback.
- Diagnostics sorting occurs only while snapshotting internal sets. `IdmClientDiagnostics.create` continues to preserve caller order and duplicates.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The complete repository test run reached 339 passing tests, then the Windows symlink-permission case in `phase-gate.test.ts` failed with `EPERM` after removing `transport-behavior.json`; five later assertions failed only because that fixture was consequently absent. The exact pinned generator restored all nine artifacts byte-identically, leaving a clean worktree. Required focused tests, all 34 transport/diagnostic tests, register-schema parity, typecheck, lint, format, and build pass.

## TDD Gate Compliance

- Task 1 RED failed because `detectModel` did not exist; GREEN passes all ordered model/capability/map contracts.
- Task 2 RED failed at the deliberate detection-scenario placeholder; GREEN executes all five generated Python scenarios.
- RED commits precede their GREEN commits and no behavioral assertion was removed or weakened.

## Automated Evidence

- `npm test -- test/client/detection.test.ts` passes 5/5 tests.
- The required filtered detection/diagnostic/state command passes 15 focused tests with unrelated cases skipped.
- The complete detection, diagnostics, and transport contract files pass 35/35 tests.
- Register builders and register-schema parity pass 20/20 tests; no register source or generated schema byte changed.
- Strict `npm run typecheck`, `npm run lint`, and `npm run format:check` pass.
- `npm run build` succeeds for ESM, CommonJS, declarations, and source maps.
- The exact pinned generator restored/checks all seven fixtures and two generated documents with no Git diff.

## Security and Protocol Review

- Circuit and zone scans are fixed at seven and ten slots and stop after two consecutive missing entries.
- Every detection request uses one attempt and a bounded two-second timeout.
- Detection does not mutate unsupported, permanent-failure, transient-failure, or batch-unsafe state.
- No live endpoint, credential, private IP, device identifier, write path, web path, or Navigator-1 address was added.

## User Setup Required

None - no dependency, credential, endpoint, network, device, or hardware action is required.

## Next Phase Readiness

- Plan 02-08 can bind the real Modbus adapter to the exact request-timeout behavior without changing detection policy.
- Plans 02-09 and 02-10 can promote and close the Phase-2 public/read contract using the now-complete generated detection evidence.

## Self-Check: PASSED

- All five implementation/test artifacts and this summary exist.
- All five RED/GREEN/evidence commits are present in Git history.
- Every task acceptance criterion and required plan-level verification command passes.

---

_Phase: 02-modbus-reads-detection-and-resilience_  
_Completed: 2026-07-16_
