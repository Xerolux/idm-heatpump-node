---
phase: 02-modbus-reads-detection-and-resilience
plan: "09"
subsystem: public-api-parity
tags: [api-parity, exports, declarations, modbus, release-gate]

requires:
  - phase: 02-modbus-reads-detection-and-resilience
    provides: implemented read, detection, diagnostics, resilience, logging, and hidden-adapter behavior from Plans 02-01 through 02-08
provides:
  - Exact complete authorities for four Phase-2 Python symbols
  - Exact release-blocking 22 implemented and seven omitted IdmModbusClient member partition
  - Complete additive type-only ModbusTransport authority
  - Explicit public ESM, CommonJS, and declaration surfaces without internal seams or Phase-3 stubs
affects: [phase-2-closure, phase-3-writes, package-release]

tech-stack:
  added: []
  patterns:
    - Derive public runtime exports from complete mappings plus the exact partial client
    - Keep additive type-only contracts in a separate extension authority
    - Hold private test controls in a module-scoped WeakMap so class declarations remain public-only

key-files:
  created: []
  modified:
    - contracts/api-mapping.json
    - contracts/typescript-extensions.json
    - docs/API-PARITY.md
    - src/client/idm-modbus-client.ts
    - src/client/index.ts
    - src/index.ts
    - test/client/lifecycle.test.ts
    - test/parity/api-parity.test.ts

key-decisions:
  - "Promote only IdmClientDiagnostics, IllegalAddressError, ModbusErrorContext, and quietPymodbusLogging to complete Phase-2 Python parity."
  - "Keep IdmModbusClient partial and release-blocking with exactly 22 implemented read-side members and seven deferred Phase-3 write members."
  - "Expose ModbusTransport only as an additive type export and keep adapter, normalized failure, dependency-injection, and logging-hook seams private."

patterns-established:
  - "Built ESM, CommonJS, and declarations are checked against the same mapping-derived exact export set."
  - "Public class declarations cannot reference symbol-keyed internal test controls; private controls live outside the class shape."

requirements-completed: [TRN-01, TRN-02, TRN-03R, DET-01, DET-02, ERR-01R]

duration: 17 min
completed: 2026-07-17
---

# Phase 02 Plan 09: Exact Phase-2 Public API Promotion Summary

**The implemented Phase-2 client is now importable from the package root with exact mapping-driven runtime, type, and declaration closure while the seven Phase-3 write members keep release validation fail-closed.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-07-16T22:18:16Z
- **Completed:** 2026-07-16T22:35:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Promoted `IdmClientDiagnostics`, `IllegalAddressError`, `ModbusErrorContext`, and `quietPymodbusLogging` to complete mappings with focused Phase-2 evidence.
- Closed `IdmModbusClient` to the exact pinned class fixture partition: 22 implemented camelCase members and seven omitted Phase-3 write members.
- Completed the additive, type-only `ModbusTransport` extension without changing the exact 89-row Python inventory.
- Added exactly five new runtime root exports and one type-only root export through explicit named `.js` exports.
- Verified identical 58-key ESM and CommonJS runtime surfaces plus declaration closure for the public constructor and implemented members.
- Preserved private-package and release-blocking status; no deferred member, write stub, adapter, dependency seam, raw failure, or logging hook is public.

## Task Commits

Each task followed RED/GREEN TDD:

1. **Task 02-09-01 RED: exact Phase-2 authority promotion contract** - `c444122`
2. **Task 02-09-01 GREEN: promoted mapping and extension authorities** - `182e7c9`
3. **Task 02-09-02 RED: root export and emitted-declaration closure** - `c1b2272`
4. **Task 02-09-02 GREEN: exact public Phase-2 package surface** - `104f2c9`

## Files Created/Modified

- `contracts/api-mapping.json` - Four complete Phase-2 rows and exact partial client member/constructor authority.
- `contracts/typescript-extensions.json` - Complete type-only `ModbusTransport` authority with focused evidence.
- `docs/API-PARITY.md` - Generated 89-row mapping and additive extension status.
- `src/client/idm-modbus-client.ts` - Module-private WeakMap test controls that do not enter public declarations.
- `src/client/index.ts` - Explicit client and diagnostics exports only.
- `src/index.ts` - Exact mapped runtime exports and additive type-only transport export.
- `test/client/lifecycle.test.ts` - Root client promotion assertion while preserving internal dependency closure.
- `test/parity/api-parity.test.ts` - Exact status, member partition, runtime key, source export, ESM/CJS, declaration, and release-block tests.

## Decisions Made

- `encodeValue` belongs to the implemented 22-member client surface because the pinned Python public-class fixture includes it and the TypeScript client already has focused codec behavior.
- The seven write-side methods remain absent rather than receiving placeholders, and the client row remains partial so release mode must still fail.
- `ModbusTransport` is separately additive and type-only; it does not fabricate a Python inventory row or runtime export.
- Public export closure is explicit at both barrels. No wildcard export can accidentally expose internal adapter or test modules.
- Internal test control moved from a public symbol-keyed class property to a module-scoped WeakMap, preserving direct-path test behavior without contaminating emitted declarations.

## Deviations from Plan

### Auto-fixed Issues

**1. Removed a declaration leak exposed by the new package-surface gate**

- **Found during:** Task 02-09-02 GREEN
- **Issue:** The existing symbol-keyed test control was public in the class shape, which pulled internal dependency and snapshot types into generated declarations.
- **Fix:** Stored the same frozen test-control functions in a module-scoped WeakMap and retained the existing internal helper API.
- **Files modified:** `src/client/idm-modbus-client.ts`
- **Verification:** ESM, CommonJS, `.d.ts`, and `.d.cts` closure tests pass and all client regressions remain green.

**2. Updated one superseded Phase-1 barrel assertion**

- **Found during:** Task 02-09-02 focused regression run
- **Issue:** A lifecycle test still required `IdmModbusClient` to be absent from the root barrel, contradicting this plan's explicit Phase-2 promotion.
- **Fix:** Required the mapped client export while continuing to reject every internal dependency and creation seam.
- **Files modified:** `test/client/lifecycle.test.ts`
- **Verification:** All 130 focused parity, client, and adapter tests pass.

## Issues Encountered

- The known Windows symlink-test side effect had removed `test/fixtures/transport-behavior.json` before execution. The exact pinned `v0.7.6` generator restored it byte-identically to the Git blob before task work began; no unreviewed fixture change entered a commit.
- A declaration scan initially matched the allowed public `NormalizedTransportFailureKind` because it searched for the shorter internal class name as a substring. The assertion now uses exact word-boundary symbol matching and still rejects the internal `NormalizedTransportFailure` class.

## TDD Gate Compliance

- Task 1 RED failed on the four unpromoted rows and missing focused evidence; GREEN records only supported statuses and the exact 22/7 class partition.
- Task 2 RED failed on the missing root runtime/type exports and built-surface closure; GREEN exposes only the mapped package surface.
- RED commits precede their corresponding GREEN commits, and no behavioral requirement was removed or weakened.
- The one legacy assertion changed only because its previous Phase-1 expectation directly contradicted the planned Phase-2 export.

## Automated Evidence

- Focused parity, client, and adapter run passes 130/130 tests across nine files.
- Root/export/declaration selection passes 12/12 selected tests with 13 intentionally unselected tests.
- `npm run parity:api` generates the documentation successfully.
- `npm run parity:check` verifies the exact upstream `v0.7.6` commit and all seven fixtures, two documents, and nine generated artifacts without drift.
- `npm run format:check`, `npm run lint`, and strict `npm run typecheck` pass.
- `npm run build` succeeds for ESM, CommonJS, declarations, and source maps.

## Security and Protocol Review

- No register address, datatype, size, batching rule, function code, model gate, or write behavior changed.
- No write method or stub was introduced; all seven safety-sensitive write members remain deferred to Phase 3.
- No adapter object, transport factory, dependency-injection seam, raw failure, endpoint, credential, or third-party cause is public.
- Release validation remains fail-closed on the exact partial client authority.

## User Setup Required

None - no credential, endpoint, network, device, or hardware action is required.

## Next Phase Readiness

- Plan 02-10 can audit and close Phase 2 against the exact promoted read-side package surface.
- Phase 3 retains sole ownership of the seven omitted write members and release-completion work.

## Self-Check: PASSED

- All eight implementation, authority, documentation, and test artifacts exist.
- All four RED/GREEN task commits are present in Git history.
- Every task acceptance criterion and plan-level verification command passes.
- The package remains private and release validation continues to reject the partial mapping as designed.

---

_Phase: 02-modbus-reads-detection-and-resilience_  
_Completed: 2026-07-17_
