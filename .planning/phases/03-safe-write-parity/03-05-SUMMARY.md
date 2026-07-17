---
phase: 03-safe-write-parity
plan: "05"
subsystem: transport
tags: [modbus, fc16, modbus-serial, write-safety, error-normalization]

requires:
  - phase: 03-safe-write-parity
    provides: Frozen FC16 requests and private transactional client write execution
provides:
  - Production modbus-serial writeRegisters mapping for every one- and multi-word write
  - Exact integer address/length acknowledgement validation before client state commit
  - Operation-aware provider Code-2 normalization for read/write parity
  - Unified write-capable ModbusTransport boundary with every repository implementer updated
affects: [03-safe-write-parity, generated-write-runner, api-promotion, package-contract]

tech-stack:
  added: []
  patterns:
    - Provider-neutral FC16 request revalidation before mutable provider calls
    - Exact acknowledgement gate before safety-state success
    - Operation-specific structured Modbus error normalization

key-files:
  created: []
  modified:
    - src/transport/modbus-serial-adapter.ts
    - src/transport/errors.ts
    - src/transport/types.ts
    - src/client/idm-modbus-client.ts
    - test/transport/modbus-serial-adapter.test.ts

key-decisions:
  - "Merge write into ModbusTransport only after the real adapter and every repository implementer compile together."
  - "Require exact integer provider address and length echoes before resolving an FC16 write."
  - "Normalize ordinary provider Code 2 as illegal_address only for reads; writes remain generic retryable modbus failures."

patterns-established:
  - "Provider write boundary: revalidate the frozen request, set the unit ID, pass a fresh mutable word copy, then validate the exact echo."
  - "Write errors never carry requested values, encoded words, raw acknowledgements, provider causes, or unredacted endpoints."

requirements-completed: [TRN-03W, ERR-01W, WRT-02]

duration: 9 min
completed: 2026-07-17
---

# Phase 3 Plan 5: Production FC16 Adapter Summary

**The production modbus-serial boundary now maps every accepted write to FC16, validates exact acknowledgements, and preserves write-specific Code-2 retry semantics without false safety-state success**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-17T03:52:00Z
- **Completed:** 2026-07-17T04:00:58Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Added the production `writeRegisters(address, copiedWords)` path for both one- and two-word requests, preserving unit ID, address, count, and low-word-first order.
- Added a strict provider acknowledgement gate that accepts only a non-array object with exact integer `address` and `length` echoes.
- Merged write capability into `ModbusTransport` and updated the real adapter, fake transport, client, and every read-only local double in one type-safe change.
- Kept read-side numeric Code 2 as `IllegalAddressError` while ordinary write-side Code 2 retries as generic `modbus` without mutating unsupported/permanent read state.
- Proved malformed acknowledgements cannot replace prior cyclic state and that errors/contexts omit payloads, words, provider results, causes, values, and endpoints.

## Task Commits

Each task was committed atomically using TDD:

1. **Task 03-05-01: Map every write to mocked provider FC16 and validate exact echo**
   - `d533750` (RED provider contract tests)
   - `546b052` (GREEN adapter, transport merge, and implementer updates)
2. **Task 03-05-02: Separate write Code 2 and prove malformed-success rollback**
   - `818202a` (RED operation/rollback tests)
   - `0674c3d` (GREEN operation-aware normalization)

## Files Created/Modified

- `src/transport/modbus-serial-adapter.ts` - Mockable provider FC16 call, request revalidation, strict acknowledgement validation, and operation-aware normalization.
- `src/transport/errors.ts` - Dedicated generic Modbus write-failure factory preserving read Code-2 behavior.
- `src/transport/types.ts` - Unified write-capable transport interface with a compatibility alias for the temporary refinement.
- `src/client/idm-modbus-client.ts` - Direct use of the now-complete transport contract without runtime capability probing.
- `test/transport/modbus-serial-adapter.test.ts` - Fully mocked one-/two-word mapping, acknowledgement mutations, real-client rollback, Code-2 retry, and secrecy proof.
- `test/support/fake-modbus-transport.ts` - Complete transport-interface implementation after the merge.
- `test/client/batching.test.ts`, `test/client/lifecycle.test.ts`, `test/client/reads.test.ts`, `test/client/resilience.test.ts` - Deterministic never-used write stubs for read-only doubles.

## Decisions Made

- Kept provider acknowledgement types internal by exposing only `Promise<void>` through `ModbusTransport.write`.
- Allowed extra provider acknowledgement fields but required the two protocol identity echoes to be exact integers.
- Retained zero provider retries; all retries, delays, reconnects, diagnostics, and safety-state commits remain client-owned.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - expected TDD RED failures were resolved within their owning tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-06 can execute every generated Python write scenario through the completed client and real-provider boundary.
- No public write API was promoted; no dependency, lockfile, register map, live connection, hardware write, package publication, or release state changed.

## Self-Check: PASSED

- Task verification passed: 109 focused adapter/parity/read tests plus strict typecheck, then 10 filtered malformed/Code-2/state/secrecy tests.
- All transport/client regressions passed: 199/199 tests across 12 files.
- ESLint, Prettier, strict TypeScript, declarations/build, `git diff --check`, exact `modbus-serial@8.0.25`, and `npm audit --omit=dev` passed.
- Built declarations expose `ModbusTransport.write(request): Promise<void>` and no provider acknowledgement, boundary, or dependency type.
- Package and lockfile remained byte-unchanged; every provider call was mocked and no TCP or hardware operation occurred.

---

_Phase: 03-safe-write-parity_
_Completed: 2026-07-17_
