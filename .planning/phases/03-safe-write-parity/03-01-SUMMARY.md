---
phase: 03-safe-write-parity
plan: "01"
subsystem: transport
tags: [modbus, fc16, write-safety, typescript, deterministic-testing]

requires:
  - phase: 02-native-modbus-transport-and-runtime
    provides: Adapter-neutral read transport, structured errors, and deterministic fake transport
provides:
  - Closed thirteen-code write-validation vocabulary
  - Deeply immutable bounded holding-register FC16 request factory
  - Narrow additive ModbusWriteTransport refinement
  - Deterministic no-network fake FC16 scripts, events, and pause controls
affects: [03-safe-write-parity, write-contracts, client-write-execution, modbus-adapter]

tech-stack:
  added: []
  patterns:
    - Dedicated immutable write request separate from read request identity
    - Additive transport refinement while read-only implementations remain valid
    - Separate read/write fake scripts with shared concurrency accounting

key-files:
  created:
    - test/transport/write-request.test.ts
  modified:
    - contracts/normalization.md
    - src/errors.ts
    - src/transport/types.ts
    - test/client/errors.test.ts
    - test/support/fake-modbus-transport.ts

key-decisions:
  - "Represent every accepted write as holding-register FC16, including one-word values."
  - "Keep ModbusTransport read-only in Wave 1 and add ModbusWriteTransport as a narrow refinement."
  - "Keep fake read and write pause queues independent while sharing active-request counters."

patterns-established:
  - "FC16 boundary: validate unit, address, count, complete span, payload length, and every word before transport execution."
  - "Fake write evidence: copy scripts, revalidate requests, record frozen events, then consume exactly one outcome."

requirements-completed: [WRT-01, WRT-02, TRN-03W, ERR-01W]

duration: 13 min
completed: 2026-07-17
---

# Phase 3 Plan 1: FC16 Write Contract Foundation Summary

**Closed write-validation semantics and a deeply immutable FC16 transport boundary with deterministic no-network fake writes**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-17T02:30:00Z
- **Completed:** 2026-07-17T02:43:13Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added the exact reviewed thirteen-code write-safety vocabulary without a permissive fallback.
- Added a frozen FC16 request factory enforcing unit `1..247`, address `0..65535`, count `1..123`, exact payload length, complete address span, and 16-bit words.
- Extended the deterministic fake transport with copied write scripts, immutable write events, exact consumption checks, and independently controllable paused writes.
- Preserved all existing read transport contracts and read-only `ModbusTransport` implementations.

## Task Commits

Each task was committed atomically using TDD:

1. **Task 03-01-01: Close write validation codes and the immutable FC16 request**
   - `217b4ed` (RED tests)
   - `91d46a3` (GREEN implementation)
2. **Task 03-01-02: Extend the fake transport with bounded FC16 events**
   - `2585c6e` (RED tests)
   - `8153fbf` (GREEN implementation)

## Files Created/Modified

- `contracts/normalization.md` - Reviewed cross-language write rejection vocabulary.
- `src/errors.ts` - Exact thirteen write arms on `SemanticValidationErrorCode`.
- `src/transport/types.ts` - FC16 limits, request types/factory, and narrow write-capable transport refinement.
- `test/client/errors.test.ts` - Structured proof for all reviewed write codes.
- `test/support/fake-modbus-transport.ts` - No-network write scripts, events, pause controls, and shared concurrency accounting.
- `test/transport/write-request.test.ts` - FC16 identity, bounds, immutability, script, event, and concurrency proof.

## Decisions Made

- Forced holding-register FC16 identity independently of read-side register metadata, matching pinned Python `write_registers` behavior.
- Kept write capability additive through `ModbusWriteTransport` so existing read-only implementations require no edits.
- Preserved low-word-first payload order through owned immutable copies rather than re-encoding in the transport.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The repository-wide format gate identified existing planning metadata formatting; it is normalized during the required sequential state/roadmap update before close-out.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The exact FC16 request and deterministic fake write seam are ready for Plan 03-02 generated write-contract work.
- No provider adapter, client write execution, public export, register map, package lock, live network, or release state changed.

## Self-Check: PASSED

- Both task verification commands passed.
- `npm run lint` and `npm run typecheck` passed.
- Request, error, read, and lifecycle suites passed with no register-schema or package-lock changes.

---

_Phase: 03-safe-write-parity_
_Completed: 2026-07-17_
