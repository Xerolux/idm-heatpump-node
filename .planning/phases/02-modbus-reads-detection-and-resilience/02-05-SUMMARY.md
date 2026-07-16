---
phase: 02-modbus-reads-detection-and-resilience
plan: "05"
subsystem: client-lifecycle-and-resilience
tags: [modbus, fifo, lifecycle, retry, reconnect, probes, diagnostics]

requires:
  - phase: 02-modbus-reads-detection-and-resilience
    provides: adapter-neutral requests, deterministic transport/clock fakes, and closed normalized failures from Plans 02-02 and 02-04
provides:
  - One FIFO-serialized client lifecycle with exact mapped constructor defaults and validation
  - Internal-only transport/clock/sleep dependency creation seam with adapter retries fixed to zero
  - Python-equivalent retry, reconnect, probe, suspect-state, and latest-error behavior
affects: [phase-2-reads, phase-2-detection, phase-2-adapter, phase-2-public-promotion]

tech-stack:
  added: []
  patterns:
    - One non-reentrant FIFO gate around complete public asynchronous operations
    - Public methods acquire once and delegate to private Locked helpers
    - Structured failure kinds exclusively determine reconnect and retry policy

key-files:
  created:
    - src/client/fifo-gate.ts
    - src/client/idm-modbus-client.ts
    - src/client/index.ts
    - src/client/internal-create.ts
    - test/client/lifecycle.test.ts
    - test/client/resilience.test.ts
  modified: []

key-decisions:
  - "Carry internal dependencies through a non-enumerable module-private symbol while keeping the emitted constructor at host plus the five mapped options."
  - "Serialize ensure/connect, request attempts, reconnects, injected delays, validation, and state mutation through one FIFO acquisition."
  - "Reconnect only timeout, disconnected, socket, and no-response failures; retry Modbus and invalid-response failures on the same connection; never retry IllegalAddressError."
  - "Retain the latest immutable normalized error context after later success until clearLastErrorContext is called."

patterns-established:
  - "FIFO lifecycle: a never-rejecting tail promise releases in finally, preserving arrival order after success and rejection."
  - "Retry split: reconnect classes hard-close before retry, same-connection classes only back off, and Code 2 exits immediately."

requirements-completed: [TRN-01, TRN-02, ERR-01R]

duration: 14 min
completed: 2026-07-16
---

# Phase 02 Plan 05: Serialized Lifecycle and Resilience Summary

**A single FIFO-owned client state machine now preserves mapped construction, deterministic lifecycle recovery, exact backoff, FC04 probes, and endpoint-redacted immutable error state.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-16T20:42:54Z
- **Completed:** 2026-07-16T20:57:15Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added a tail-safe FIFO primitive and proved 21 concurrent mixed lifecycle operations complete in arrival order with maximum active work of one and recovery after rejection.
- Added `IdmModbusClient` with the exact public `host, options?` constructor shape, mapped defaults, strict port/slave/retry/group validation, Python-compatible timeout-number acceptance, lifecycle state, and Navigator 2.0 fallback.
- Kept transport creation, monotonic clock, sleep, and adapter retries behind a direct internal path absent from both source package barrels and emitted root declarations.
- Added exact three-attempt retry behavior with delays `0.5` and `1.0`, hard reconnect for four transport classes, same-connection retry for Modbus/invalid responses, and immediate Code-2 termination.
- Added exact FC04 probes with request-scoped retry/timeout overrides, word-count/range validation, immutable diagnostics, and a persistent one-based normalized error context.

## Task Commits

Each task followed RED/GREEN TDD:

1. **Task 02-05-01 RED: constructor, lifecycle, internal seam, and FIFO behavior** - `4813c94`
2. **Task 02-05-01 GREEN: serialized client lifecycle** - `a347810`
3. **Task 02-05-02 RED: retry, reconnect, probe, and context behavior** - `b22a92f`
4. **Task 02-05-02 GREEN: retry, reconnect, probes, and diagnostics** - `d208d99`

## Files Created/Modified

- `src/client/fifo-gate.ts` - Never-rejecting FIFO tail with `finally` release.
- `src/client/idm-modbus-client.ts` - Sole lifecycle, retry, probe, suspect, diagnostic, and error-context state owner.
- `src/client/internal-create.ts` - Direct-path deterministic dependency creation seam.
- `src/client/index.ts` - Source barrel exporting only `IdmModbusClient`.
- `test/client/lifecycle.test.ts` - Constructor, closure, lifecycle, FIFO ordering, exclusivity, and rejection-release evidence.
- `test/client/resilience.test.ts` - Closed failure matrix, exact attempts/delays/reconnects, malformed response, Code 2, probe, context, and retry-gate evidence.

## Decisions Made

- The internal test seam brands an otherwise mapped options object with a non-enumerable private symbol. No third constructor argument or injectable dependency field appears in public TypeScript.
- The complete public asynchronous operation owns the FIFO once; reconnect and retry helpers never reacquire it.
- A successful Modbus I/O round trip clears suspect state, while a successful TCP reconnect alone does not.
- Probe failures return `null` only for the closed known client failures. Invalid configuration, exhausted factories, and other programming errors still throw.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## TDD Gate Compliance

- Task 1 RED failed because the client barrel, internal factory, lifecycle implementation, and FIFO did not exist; GREEN passes all eight focused lifecycle tests.
- Task 2 RED failed because `probeRegister`, the retry runner, diagnostics, and latest-error methods did not exist; GREEN passes all thirteen focused resilience tests.
- Both RED commits precede their corresponding GREEN commits, and no failing behavioral assertion was removed.

## Automated Evidence

- `npm test -- test/client/lifecycle.test.ts test/client/resilience.test.ts` passes 21/21 tests.
- Strict `npm run typecheck`, `npm run lint`, and `npm run format:check` pass.
- `npm run build` succeeds for ESM, CommonJS, source maps, and declarations.
- Source and generated root declaration scans contain no `IdmModbusClient`, internal factory, dependency type, transport factory, or `pymodbusRetries` exposure; public promotion remains owned by Plan 02-09.
- Static scans find no live socket, hardware endpoint, credential, PIN, device identifier, `Promise.race`, or raw adapter payload/cause retention.

## Known Stubs

- The source-only default transport factory deliberately remains unattached until Plan 02-08 supplies the audited real adapter. The class is absent from the package root, and every behavior delivered by this plan is executable through the required internal deterministic seam.

## User Setup Required

None - no dependency installation, endpoint, credential, device, network, or hardware action is required.

## Next Phase Readiness

- Plan 02-06 can add single reads, safe grouping, fallback, permanent failure, unsupported state, and batch quarantine inside the existing locked helpers without introducing another state owner.
- Plan 02-07 can run ordered model probes through the same FC04 retry path and request-scoped timeout.
- Plan 02-08 can replace only the hidden default transport factory while retaining the proven client state machine.

## Self-Check: PASSED

- All six implementation/test artifacts and this summary exist.
- All four RED/GREEN task commits are present in Git history.
- Every task acceptance criterion and plan-level verification command passes.

---

_Phase: 02-modbus-reads-detection-and-resilience_  
_Completed: 2026-07-16_
