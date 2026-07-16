---
phase: 02-modbus-reads-detection-and-resilience
plan: "02"
subsystem: transport-contracts
tags: [modbus, transport, contract-parser, fake-clock, deterministic-testing]

requires:
  - phase: 02-modbus-reads-detection-and-resilience
    provides: additive transport governance and closed runtime normalization from Plan 02-01
provides:
  - Adapter-neutral validated FC03/FC04 read requests and ModbusTransport
  - Deterministic immutable fake transport and monotonic fake clock
  - Separate closed bounded Phase-2 transport scenario parser
affects: [phase-2-generator, phase-2-client, phase-2-adapter, phase-2-parity]

tech-stack:
  added: []
  patterns:
    - Validate complete Modbus request identity before consuming scripted evidence
    - Keep runtime transport scenarios separate from the closed Phase-1 behavior schema
    - Clone and recursively freeze every accepted request, trace, response, and scenario graph

key-files:
  created:
    - src/transport/types.ts
    - src/contracts/transport-scenario.ts
    - test/support/fake-modbus-transport.ts
    - test/support/fake-clock.ts
    - test/parity/transport-contract.test.ts
  modified: []

key-decisions:
  - "Represent every read through one frozen adapter-neutral request containing unit ID, register type, exact FC03/FC04, address, count, and optional millisecond timeout."
  - "Reject requests whose address plus count crosses the 16-bit Modbus address space before any scripted response is consumed."
  - "Use a separate schema-version-1 transport contract with seven closed Phase-2 operation kinds; leave Phase-1 scenario schema v1 byte-for-byte unchanged."
  - "Permit only the synthetic example.invalid configured endpoint in accepted runtime evidence and require the literal <endpoint> diagnostic projection."

patterns-established:
  - "Deterministic transport fake: immutable lifecycle/read events, finite response queue, fresh word arrays, and explicit yield release."
  - "Transport parser: exact provenance and fields, closed operations/scripts/traces, bounded graphs, dangerous-key rejection, and recursive error projection validation."

requirements-completed: [TRN-01, TRN-03R, DET-02, ERR-01R]

duration: 18 min
completed: 2026-07-16
---

# Phase 02 Plan 02: Transport Contract and Scenario Boundary Summary

**Exact adapter-neutral Modbus read identities now run against deterministic owned fakes, while a separate immutable Phase-2 parser safely admits only pinned lifecycle/read/probe/detection evidence.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-16T19:46:00Z
- **Completed:** 2026-07-16T20:04:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added `ModbusTransport`, frozen request construction, exact FC03-holding/FC04-input pairing, bounded unit/address/count/timeout validation, 16-bit word validation, and address-span overflow protection.
- Added a deterministic scripted fake transport with immutable lifecycle/read traces, fresh response ownership, finite queue assertions, controlled read yields, and active/max-active concurrency instrumentation.
- Added a monotonic fake clock whose injected sleeps and explicit advances require no wall-clock timers.
- Added a separate transport scenario parser with exact baseline identity, seven closed Phase-2 operations, closed response and trace shapes, explicit collection/text/clock bounds, prototype-pollution protection, and recursive endpoint-redaction validation.
- Proved that the Phase-1 scenario parser and `behavior-contract.json` remain unchanged.

## Task Commits

Each task followed RED/GREEN TDD:

1. **Task 02-02-01 RED: transport boundary behavior** - `3f11f38`
2. **Task 02-02-01 GREEN: deterministic transport and clock** - `826ae21`
3. **Task 02-02-02 RED: separate parser behavior** - `9444a79`
4. **Task 02-02-02 GREEN: closed transport scenario parser** - `f55c04d`
5. **Correctness follow-up: reject overflowing read spans** - `d1e2c82`

## Files Created/Modified

- `src/transport/types.ts` - Adapter-neutral read contract, request factory, limits, and owned word validation.
- `src/contracts/transport-scenario.ts` - Exact-provenance closed Phase-2 runtime scenario parser.
- `test/support/fake-modbus-transport.ts` - Scripted immutable transport fake with lifecycle and concurrency evidence.
- `test/support/fake-clock.ts` - Deterministic monotonic time and delay recorder.
- `test/parity/transport-contract.test.ts` - Sixteen focused transport, fake, parser, bounds, redaction, and ownership tests.

## Decisions Made

- The transport boundary validates protocol identity once and carries no concrete adapter client, callback, response, host, port, or retry implementation type.
- Returned word arrays, request values, trace events, delay snapshots, and accepted scenario graphs are newly owned and frozen.
- Runtime fixtures use the same exact pinned baseline as Phase 1 but a separate schema and operation inventory, preserving the earlier closure guarantee.
- The parser accepts lifecycle, register read, batch read, probe, model detection, diagnostics, and failed-register reset operations only; writes and web operations are rejected.
- Runtime diagnostics may contain no configured endpoint token, alternate redaction marker, raw cause, or raw payload.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Kept the scenario-count bound reachable before the shared node bound**

- **Found during:** Task 02-02-02 GREEN verification
- **Issue:** An initial 256-scenario maximum allowed a duplicated full scenario graph to hit the shared 10,000-node limit before the transport-specific scenario-count error.
- **Fix:** Set the explicit transport scenario maximum to 64, which remains above the planned generated inventory while keeping its dedicated bound deterministic.
- **Files modified:** `src/contracts/transport-scenario.ts`
- **Verification:** The parser-bounds test now receives the transport-specific rejection and all focused parser tests pass.
- **Committed in:** `f55c04d`

**2. [Rule 2 - Missing Critical] Rejected read spans beyond address 65535**

- **Found during:** Plan-level transport boundary review
- **Issue:** Individually valid address and count values could still describe a range extending beyond the 16-bit Modbus address space.
- **Fix:** Added an address-plus-count invariant before request construction and scripted response consumption.
- **Files modified:** `src/transport/types.ts`, `test/parity/transport-contract.test.ts`
- **Verification:** The focused suite rejects `address=65535/count=2` and remains green for the valid boundary.
- **Committed in:** `d1e2c82`

**3. [Rule 1 - Bug] Corrected inconsistent generated planning progress**

- **Found during:** Plan metadata close-out
- **Issue:** The GSD progress update advanced the plan and counts but wrote `percent: 20`, retained the prior activity/velocity totals, and emitted unformatted roadmap/requirements table cells.
- **Fix:** Reconciled `STATE.md` to 12/20 and 60 percent with current Phase-2 metrics, updated the latest activity/trend, and formatted the generated planning tables.
- **Files modified:** `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`
- **Verification:** State counts agree with the 12 summary files, Phase 2 reports 2/10, STATE remains below 150 lines, and Prettier passes.
- **Committed in:** Plan metadata commit

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical correctness guard).
**Impact on plan:** The changes make the requested bounds deterministic and protocol-correct while keeping the repository's execution state trustworthy, without expanding runtime or public package scope.

## Issues Encountered

- The first parser-bound implementation exposed the shared tagged-value node limit before its more specific scenario-count limit; the transport maximum was adjusted to preserve deterministic domain errors.

## TDD Gate Compliance

- Task 1 RED failed because the transport contract and deterministic fakes did not exist; GREEN passes all transport/fake/clock tests.
- Task 2 RED failed because the separate parser module did not exist; GREEN passes all schema/parser/bounds/immutability/redaction tests.
- Both RED commits precede their corresponding GREEN commits, and no failing assertion was removed or weakened.

## Verification

- `npm test -- test/parity/transport-contract.test.ts -t "transport|fake|clock|concurrency"` passes 16/16 selected-by-suite tests.
- `npm test -- test/parity/transport-contract.test.ts -t "schema|parser|bounds|immutable|redaction"` passes 9/9 focused parser tests.
- The complete `test/parity/transport-contract.test.ts` suite passes 16/16 tests.
- `npm run lint`, `npm run format:check`, and strict `npm run typecheck` pass.
- `git diff --exit-code -- src/contracts/scenario.ts test/fixtures/behavior-contract.json` passes.
- Static scans find no socket/network API, real/private endpoint, adapter-specific contract type, wall-clock timer, credential, PIN, or device identifier.

## Known Stubs

None. The real adapter and client behavior are later planned consumers of this completed boundary, not placeholder exports.

## User Setup Required

None - no external service, network endpoint, device, credential, or hardware action is required.

## Next Phase Readiness

- Plan 02-03 can generate the seventh pinned Python fixture directly against the closed parser and deterministic evidence shapes.
- Plans 02-05 through 02-07 can consume the transport and clock fakes to prove serialization, retries, reads, detection, diagnostics, and final state without live sockets.
- The package remains private and no transport type has been promoted through the package root yet.

## Self-Check: PASSED

- All five key implementation/test files and this summary exist.
- All five RED/GREEN/correctness commits are present in Git history.
- Every task acceptance criterion and plan-level verification command passes.

---

_Phase: 02-modbus-reads-detection-and-resilience_  
_Completed: 2026-07-16_
