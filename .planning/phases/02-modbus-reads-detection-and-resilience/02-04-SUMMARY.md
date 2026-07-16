---
phase: 02-modbus-reads-detection-and-resilience
plan: "04"
subsystem: transport-errors-and-diagnostics
tags: [modbus, errors, diagnostics, redaction, logging, immutable-values]

requires:
  - phase: 02-modbus-reads-detection-and-resilience
    provides: closed runtime normalization authority and deterministic transport contracts from Plans 02-01 and 02-02
provides:
  - Numeric-Code-2-only IllegalAddressError without additive public members
  - Closed bounded endpoint-redacted transport failures and Python-compatible logging levels
  - Exact immutable order-preserving ModbusErrorContext and IdmClientDiagnostics factories
affects:
  [
    phase-2-lifecycle,
    phase-2-batching,
    phase-2-detection,
    phase-2-adapter,
    phase-2-public-promotion,
  ]

tech-stack:
  added: []
  patterns:
    - Classify privileged Modbus behavior only from structured numeric evidence
    - Project raw failures into bounded endpoint-redacted errors with no retained cause
    - Clone and freeze public semantic sequences without sorting at factory boundaries

key-files:
  created:
    - src/transport/errors.ts
    - src/transport/logging.ts
    - src/client/diagnostics.ts
    - test/client/errors.test.ts
    - test/client/diagnostics.test.ts
  modified: []

key-decisions:
  - "Represent the seven closed runtime outcomes as six NormalizedTransportFailure kinds plus the dedicated IllegalAddressError marker."
  - "Create IllegalAddressError only when the structured raw Modbus code is the numeric value 2; messages and numeric strings never classify it."
  - "Keep logging-hook registration internal while quietPymodbusLogging preserves Python names, WARN/FATAL aliases, case folding, defaults, and integer pass-through."
  - "Preserve factory caller order and duplicates exactly; only later client getDiagnostics snapshots may sort internal sets."

patterns-established:
  - "Safe failure projection: longest-first endpoint replacement, 1024-code-point bound, no raw cause/payload/provider retention."
  - "Readonly dataclass factory: exact keys/defaults, newly owned frozen arrays, frozen object, and no semantic sequence sorting."

requirements-completed: [TRN-01, DET-02, ERR-01R]

duration: 9 min
completed: 2026-07-16
---

# Phase 02 Plan 04: Transport Errors, Logging, and Diagnostics Summary

**Structured numeric Code 2, bounded redacted failures, Python logging aliases, and exact immutable diagnostics now provide the safe public-value foundation for the Phase-2 client.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-16T20:08:31Z
- **Completed:** 2026-07-16T20:17:42Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added `IllegalAddressError` with `isIllegalAddress === true`, normal Error fields, no `code`, cause, adapter, response, raw object, host, or endpoint member, and numeric Modbus Code 2 as the sole raw classifier.
- Added the six remaining closed normalized transport failure kinds with deterministic longest-first endpoint redaction, a 1024-code-point output bound, immutable error closure, and no retained adapter state.
- Added `quietPymodbusLogging` with Python-compatible CRITICAL/FATAL, ERROR, WARNING/WARN, INFO, DEBUG, and NOTSET parsing across case variants, integer pass-through, default WARNING, and an internal neutral hook.
- Added exact same-name `ModbusErrorContext.create` and `IdmClientDiagnostics.create` factories derived from the pinned public-class fixture.
- Proved that diagnostics arrays are cloned, frozen, duplicate-preserving, and order-preserving, while unsupported, provider, endpoint, request, and write fields remain absent.

## Task Commits

Each task followed RED/GREEN TDD:

1. **Task 02-04-01 RED: transport error and logging behavior** - `7ba557c`
2. **Task 02-04-01 GREEN: safe failures and Python logging levels** - `4458a09`
3. **Task 02-04-02 RED: diagnostics factory behavior** - `a7ac3b1`
4. **Task 02-04-02 GREEN: immutable order-preserving factories** - `d647a93`
5. **Plan style gate: repository formatting** - `75be3b1`

## Files Created/Modified

- `src/transport/errors.ts` - Closed failure kinds, exact public IllegalAddressError, numeric Code-2 classifier, and bounded endpoint redaction.
- `src/transport/logging.ts` - Python-compatible level parsing and internal adapter-neutral logging hook registration.
- `src/client/diagnostics.ts` - Exact immutable ModbusErrorContext and IdmClientDiagnostics interfaces and factories.
- `test/client/errors.test.ts` - Twenty-one focused error, redaction, leakage, logging-name, alias, case, numeric, no-hook, and rejection tests.
- `test/client/diagnostics.test.ts` - Six fixture-derived exact-key, default, order, duplicate, ownership, null, and forbidden-field tests.

## Decisions Made

- Illegal-address behavior is not represented as a freely constructible normalized kind at the raw adapter boundary. Numeric `modbusCode === 2` creates the dedicated marker; all other device exception evidence remains `modbus`.
- Error messages are normalized before construction, so public failures retain only a closed kind/marker and already-redacted bounded text.
- Logging configuration remains inert until the hidden real adapter registers a hook; this keeps the public compatibility helper independent of a logging package or concrete provider.
- Public factories never sort arrays. Later client state owns the responsibility to sort copied internal sets before passing them to `IdmClientDiagnostics.create`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first repository-wide format check identified the five new files as unformatted. Prettier was applied, all focused behavior stayed green, and the formatting-only result was committed separately.

## TDD Gate Compliance

- Task 1 RED failed because the transport error and logging modules did not exist; GREEN passes all 21 focused tests.
- Task 2 RED failed because the diagnostics module did not exist; GREEN passes all six fixture-derived tests.
- Both RED commits precede their corresponding GREEN commits. The later style commit changes formatting only.

## Verification

- `npm test -- test/client/errors.test.ts test/client/diagnostics.test.ts` passes 27/27 tests.
- `npm run lint`, `npm run format:check`, and strict `npm run typecheck` pass.
- `npm run build` succeeds for ESM, CommonJS, source maps, and declarations.
- Generated root runtime and declaration surfaces do not yet expose `IdmClientDiagnostics`, `ModbusErrorContext`, `IllegalAddressError`, `quietPymodbusLogging`, normalized failures, or logging-hook registration; Plan 02-09 retains promotion ownership.
- Static and runtime property checks prove no public `IllegalAddressError.code`, raw cause, provider object, host, endpoint, response, request, or write payload leakage.

## Known Stubs

None. The hidden adapter and client consumers are later completed plans, not placeholder branches in these artifacts.

## User Setup Required

None - no dependency, endpoint, credential, network, device, or hardware action is required.

## Next Phase Readiness

- Plan 02-05 can consume the closed failure classes and exact context factory for serialized lifecycle, retries, reconnect, probes, and latest-error state.
- Plans 02-06 through 02-08 can reuse the same numeric Code-2 boundary, redaction helper, diagnostics factories, and hidden logging hook.
- Plan 02-03 remains the first incomplete plan in repository order and is not skipped by this out-of-order independent completion.

## Self-Check: PASSED

- All five implementation/test artifacts and all five task/style commits exist.
- Every task acceptance criterion and plan-level verification command passes.
- Factory inputs preserve deliberate non-sorted order and duplicates, while runtime/public package roots remain unpromoted as required.

---

_Phase: 02-modbus-reads-detection-and-resilience_  
_Completed: 2026-07-16_
