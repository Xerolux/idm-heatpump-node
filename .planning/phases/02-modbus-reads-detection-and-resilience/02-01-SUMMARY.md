---
phase: 02-modbus-reads-detection-and-resilience
plan: "01"
subsystem: public-api-governance
tags: [api-parity, modbus-transport, normalization, diagnostics, release-gate]

requires:
  - phase: 01-reproducible-semantic-contract
    provides: exact 89-symbol Python inventory, generated API matrix, and pinned public-class facts
provides:
  - Separate closed authority for additive TypeScript-only public symbols
  - Exact private-development partial-class lifecycle with hard release blocking
  - Closed public constructor, runtime error-kind, and diagnostic-redaction normalization
affects: [phase-2-transport, phase-2-client, phase-3-writes, phase-5-release]

tech-stack:
  added: []
  patterns:
    - Keep additive Node symbols outside the exact Python public inventory
    - Partition every partial class member into disjoint implemented and omitted sets
    - Compare runtime failures through one language-neutral closed projection

key-files:
  created:
    - contracts/typescript-extensions.json
  modified:
    - contracts/api-mapping.json
    - contracts/normalization.md
    - docs/API-PARITY.md
    - docs/PARITY-CONTRACT.md
    - scripts/check-parity.mjs
    - scripts/generate-api-parity.mjs
    - test/parity/api-parity.test.ts
    - test/parity/phase-gate.test.ts

key-decisions:
  - "Keep ModbusTransport in a separate additive authority with no fabricated Python mapping row."
  - "Allow IdmModbusClient to be partial only during private development, with an exact pinned member partition and an unconditional release block."
  - "Expose only host plus port, slaveId, timeout, maxRetries, and maxGroupSize publicly; keep transport, clock, sleep, and zero adapter retries internal."
  - "Normalize errors to seven closed kinds and redact endpoint diagnostics symmetrically with the literal <endpoint> and a 1024-character bound."

patterns-established:
  - "Extension authority: every Node-only public symbol needs explicit ownership, evidence, rationale, and no_python_counterpart."
  - "Runtime normalization authority: constructor, error-kind, and message projection are machine-checked before later client implementation."

requirements-completed: [TRN-01, TRN-03R, ERR-01R]

duration: 39 min
completed: 2026-07-16
---

# Phase 02 Plan 01: Public Governance and Runtime Normalization Summary

**The exact 89-row Python inventory now remains isolated from additive Node types, while partial client development and all future constructor/error projections are governed by closed, release-blocking machine contracts.**

## Performance

- **Duration:** 39 min
- **Started:** 2026-07-16T19:04:40Z
- **Completed:** 2026-07-16T19:43:17Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Added schema-versioned `contracts/typescript-extensions.json` with one planned type-only `ModbusTransport`, explicit ownership and evidence, and no synthetic Python counterpart.
- Promoted `IdmModbusClient` from planned to partial with an exact 21-member implemented set and eight-member omitted set whose union equals the pinned Python class inventory.
- Extended generation and parity checking to validate extension evidence, collisions, partial partitions, fixed source paths, and unconditional release rejection of partial or incomplete public surface.
- Added a machine-readable runtime normalization authority for the sole public constructor boundary, internal zero adapter retries, seven closed error kinds, and deterministic endpoint redaction.
- Added mutation coverage for fabricated extensions, invalid evidence, partial gaps/overlap, public injection leakage, message-only Code 2, unknown error kinds, asymmetric redaction, alternate placeholders, and oversized diagnostics.
- Regenerated the API parity document so extensions, partial classes, and runtime normalization appear separately from complete Python coverage.

## Task Commits

Both tasks followed RED/GREEN TDD:

1. **Task 02-01-01 RED: additive and partial governance contracts** - ff8d6f4
2. **Task 02-01-01 GREEN: independent extension and partial validation** - 3162963
3. **Task 02-01-02 RED: runtime normalization contracts** - 384d857
4. **Task 02-01-02 GREEN: closed constructor, error, and redaction authority** - 8569726

## Files Created/Modified

- `contracts/typescript-extensions.json` - Closed additive TypeScript-only authority for `ModbusTransport`.
- `contracts/api-mapping.json` - Exact partial `IdmModbusClient` member partition and runtime normalization references.
- `contracts/normalization.md` - Machine-readable constructor, retry, error-kind, and redaction authority.
- `docs/API-PARITY.md` - Generated separate extension, partial-class, and runtime-normalization projections.
- `docs/PARITY-CONTRACT.md` - Durable G-01 through G-04 governance and exact runtime projection policy.
- `scripts/generate-api-parity.mjs` - Independent schema, partition, authority, evidence, and release validation.
- `scripts/check-parity.mjs` - Bounded staging of the new extension and normalization authorities.
- `test/parity/api-parity.test.ts` - Positive, mutation, release-block, and fixed-path contract tests.
- `test/parity/phase-gate.test.ts` - Exact-checkout staging coverage for the new extension authority.
- `.planning/ROADMAP.md` - Mechanically formatted to satisfy the repository-wide Prettier gate.

## Decisions Made

- The Python public mapping remains exactly 89 ordered rows. Additive Node types never inflate Python parity coverage.
- `partial` is a private-development state only. Every member must be accounted for exactly, and release generation rejects the state regardless of evidence.
- Public construction uses required `host` plus five mapped camelCase options. Dependency injection and `pymodbusRetries` cannot appear in public evidence.
- Illegal-address equivalence requires numeric Code 2 or structured evidence; exception class names, message substrings, case folding, and undocumented fallbacks are forbidden.
- Diagnostic projection replaces configured endpoint tokens longest-first with `<endpoint>`, preserves all remaining text and order, rejects output above 1024 characters, and never projects raw cause or payload.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Formatted the existing Phase-2 roadmap section**

- **Found during:** Task 02-01-01 repository quality verification
- **Issue:** The committed Phase-2 planning section did not satisfy the mandatory repository-wide Prettier gate.
- **Fix:** Applied the repository formatter to `.planning/ROADMAP.md` without changing plan meaning.
- **Files modified:** `.planning/ROADMAP.md`
- **Verification:** `npm run format:check` passes.
- **Committed in:** 3162963

**2. [Rule 3 - Blocking] Staged new authorities in isolated parity roots**

- **Found during:** Task 02-01-01 cross-repository gate verification
- **Issue:** The isolated exact-checkout gate did not copy the newly required extension authority, and Task 02-01-02 added the same requirement for normalization authority.
- **Fix:** Added both bounded contract files to the fixed parity staging allowlist.
- **Files modified:** `scripts/check-parity.mjs`, `test/parity/phase-gate.test.ts`
- **Verification:** The isolated exact-checkout gate passes in 123 seconds.
- **Committed in:** 3162963 and 8569726

---

**Total deviations:** 2 auto-fixed blocking issues.
**Impact on plan:** Both fixes preserve deterministic isolation and mandatory quality gates without expanding public runtime scope.

## Issues Encountered

- A combined API and phase-gate invocation exceeded individual test timing under concurrent provisioning. The three real missing-staging failures were fixed, and the exact-checkout integration path then passed in isolation; all focused and full API tests also pass.

## TDD Gate Compliance

- Task 1 RED failed on absent extension authority, missing partial lifecycle validation, and release acceptance; GREEN passes all nine focused governance tests.
- Task 2 RED failed on absent constructor, error-kind, and redaction authority; GREEN passes all five focused runtime-normalization tests.
- No RED test was weakened or deleted during GREEN implementation.

## Verification

- `npm test -- test/parity/api-parity.test.ts -t "extension|partial|89|release"` passes 9/9 focused tests.
- `npm test -- test/parity/api-parity.test.ts -t "constructor|normalization|error|redaction"` passes 5/5 focused tests.
- The complete API parity suite passes 22/22 tests.
- The isolated exact-checkout cross-repository gate passes 1/1 in 123 seconds.
- `npm run lint`, `npm run format:check`, `npm run typecheck`, and `npm run parity:api` pass.
- The Python mapping remains exactly 89 rows: 53 complete, 35 planned, and one partial client.
- Release generation remains correctly red on the first unresolved Python symbol and separately proves that partial mappings and non-complete extensions prevent release.
- No dependency installation, network endpoint, credential path, or hardware action was introduced.

## Known Stubs

None. Omitted client members and the planned transport type are absent, explicitly governed future work rather than throwing runtime stubs.

## User Setup Required

None - no external service configuration, credentials, device, or hardware action is required.

## Next Phase Readiness

- Plan 02-02 can implement the adapter-neutral transport and deterministic fake infrastructure against the closed constructor and extension authorities.
- Later client plans can consume the seven error kinds and exact diagnostic projection without inventing runtime-specific equivalence.
- Publication remains unavailable while the client is partial, `ModbusTransport` is planned, and any Python mapping remains unresolved.

## Self-Check: PASSED

- The extension authority, normalization authority, generated documentation, and all four RED/GREEN task commits exist.
- Every acceptance criterion and plan-level verification command passes after the final implementation commit.
- The exact 89-row Python inventory is unchanged, release mode remains closed, no public injection option leaked, and no known stub prevents the plan objective.

---

_Phase: 02-modbus-reads-detection-and-resilience_  
_Completed: 2026-07-16_
