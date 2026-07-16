---
phase: 02-modbus-reads-detection-and-resilience
plan: "03"
subsystem: pinned-runtime-evidence
tags: [parity, python, modbus, fixtures, transactions, diagnostics]

requires:
  - phase: 01-reproducible-semantic-contract
    provides: exact pinned-checkout admission, canonical fixture generation, and transactional parity artifacts
  - phase: 02-modbus-reads-detection-and-resilience
    provides: closed transport scenario schema and runtime error normalization from Plans 02-01 and 02-02
provides:
  - Seventh canonical Python fixture with 34 pinned lifecycle, read, resilience, detection, and diagnostic scenarios
  - Closed source-derived transport evidence parsed by the TypeScript contract boundary
  - Fixed transactional lifecycle for seven fixtures and two generated documents
affects:
  [
    phase-2-client-lifecycle,
    phase-2-read-execution,
    phase-2-detection,
    phase-2-phase-gate,
    cross-repository-parity,
  ]

tech-stack:
  added: []
  patterns:
    - Verify the exact detached Python checkout before monkeypatching deterministic transport collaborators
    - Normalize runtime errors and diagnostic messages from one machine-readable contract authority
    - Replace a fixed generated-artifact allowlist as one rollback-safe transaction

key-files:
  created:
    - test/fixtures/transport-behavior.json
  modified:
    - scripts/generate-python-contract.py
    - scripts/check-parity.mjs
    - test/parity/generator.test.ts
    - test/parity/transport-contract.test.ts
    - test/parity/phase-gate.test.ts

key-decisions:
  - "Keep Phase-2 runtime evidence in its own closed transport fixture rather than widening the Phase-1 semantic scenario schema."
  - "Execute the pinned Python client with deterministic fake transport, sleep, wait, and monotonic-time collaborators only after exact identity verification."
  - "Use the reviewed normalization document as the machine-readable source for closed error kinds and endpoint-redacted diagnostics."
  - "Stage and replace all seven fixtures and both generated documents through one exact nine-path allowlist, rejecting symlinks and extras."

patterns-established:
  - "Pinned runtime fixture: exact provenance plus eight CTR-01 fields, canonical JSON, synthetic example.invalid configuration, and no raw device data."
  - "Transactional generated set: validate every bounded regular file before replacing any committed artifact and restore all nine on failure."

requirements-completed: [TRN-01, TRN-03R, DET-01, DET-02, ERR-01R]

duration: 21 min
completed: 2026-07-16
---

# Phase 02 Plan 03: Pinned Runtime Evidence Summary

**The exact pinned Python client now generates a deterministic seventh fixture with 34 runtime scenarios, and all seven fixtures plus both generated documents move through one fixed rollback-safe parity transaction.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-07-16T20:18:00Z
- **Completed:** 2026-07-16T20:39:09Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added `transport-behavior.json` with 34 unique source-executed scenarios covering construction, lifecycle, FIFO serialization, FC03/FC04 requests, exact adjacency and gap behavior, all documented overlaps, retry timing, fallback, Code 2, permanent failure, quarantine, reread/omit state, detection variants, diagnostics, and reset/query behavior.
- Preserved all eight CTR-01 fields per scenario with exact pinned provenance, controlled time, canonical bytes, closed normalized failures, literal endpoint redaction, and synthetic `example.invalid` configuration.
- Extended the verified Python generator with deterministic fake and monkeypatched collaborators that never open a socket, consult ambient sibling HEAD, or ingest device/PIN/private endpoint data.
- Extended the parity orchestrator from eight to exactly nine generated artifacts: seven fixtures plus `docs/API-PARITY.md` and `docs/BASELINE.md`.
- Added drift, mtime, committed-symlink, extra-artifact, bounded-output, fixed-allowlist, and full rollback coverage while keeping check mode non-mutating.
- Parsed the complete generated runtime inventory through the closed TypeScript transport-scenario boundary before later client plans execute it.

## Task Commits

Each task followed RED/GREEN TDD:

1. **Task 02-03-01 RED: transport fixture contracts** - `9cfc067`
2. **Task 02-03-01 GREEN: pinned runtime evidence generator** - `e035aee`
3. **Task 02-03-02 RED: nine-artifact orchestration contracts** - `ac6e389`
4. **Task 02-03-02 GREEN: transactional nine-artifact pipeline** - `87a6bdb`

## Files Created/Modified

- `test/fixtures/transport-behavior.json` - Canonical pinned Python runtime evidence with 34 closed scenarios.
- `scripts/generate-python-contract.py` - Deterministic pinned-client execution, normalization, redaction, and seventh-fixture emission.
- `scripts/check-parity.mjs` - Fixed nine-artifact staging, validation, comparison, transactional replacement, and rollback.
- `test/parity/generator.test.ts` - Exact counts, provenance, scenario inventory, determinism, forbidden-data, normalization, drift, allowlist, and rollback tests.
- `test/parity/transport-contract.test.ts` - Closed parser coverage for every generated runtime scenario.
- `test/parity/phase-gate.test.ts` - Nine-artifact phase-gate inventory, symlink, extra-path, and rollback coverage.

## Decisions Made

- Runtime behavior remains separate from the Phase-1 semantic fixture schema so both envelopes stay closed and independently reviewable.
- Python runtime collaborators are replaced only after the repository, tag, full SHA, detached state, and cleanliness checks succeed.
- Detection and diagnostics facts are taken directly from the pinned client and normalized only through the reviewed contract rules; TypeScript implementation expectations are not copied into the fixture.
- Generated artifacts are accepted only as bounded regular files at the nine exact paths. Missing, extra, oversized, or symlinked output fails before repository replacement.

## Deviations from Plan

### Auto-fixed Supporting Scope

**1. Updated the existing Phase-2 gate inventory to nine artifacts**

- **Found during:** Task 02-03-02
- **Issue:** The phase-gate test still encoded the previous generated-artifact count and could not validate the newly required seventh fixture.
- **Fix:** Updated its inventory and added focused symlink, extra-output, and rollback assertions.
- **Files modified:** `test/parity/phase-gate.test.ts`
- **Verification:** Focused phase-gate structural test passes.

### Verification Constraint

**2. Replaced the live self-provisioning parity command with an exact local detached-checkout verification**

- **Reason:** This execution was explicitly constrained from using live network, PyPI, hardware, or device access. `npm run parity:check` intentionally self-provisions GitHub/PyPI inputs and therefore was not run.
- **Equivalent local evidence:** The generator ran in check mode against a local detached checkout at exact SHA `ad121ebf34a5f5e37204371c026927d77efcd15c`; all seven pinned fixtures verified, `npm run parity:api -- --check` passed, and fixture diff checks stayed clean.
- **Remaining gate:** CI or a network-authorized release run must execute the full self-provisioning `npm run parity:check`; this is an environment verification item, not an implementation gap.

## Issues Encountered

- A forbidden-content assertion initially matched an innocent serialization-related word. The scan was narrowed to the intended sensitive patterns while preserving the exact no-private-endpoint, no-PIN, no-identifier, and no-raw-capture protections.

## TDD Gate Compliance

- Task 1 RED established the missing seventh fixture, exact scenario inventory, closed normalization, deterministic generation, and parser requirements before generator implementation.
- Task 2 RED established the missing fixed nine-artifact allowlist, drift, symlink, extra-path, mtime, and rollback behavior before orchestrator implementation.
- Both RED commits precede their corresponding GREEN commits.

## Verification

- `npm test -- test/parity/generator.test.ts test/parity/transport-contract.test.ts` passes 28/28 tests.
- Both plan-focused filtered commands pass.
- The focused phase-gate structural test passes.
- `npm run format:check`, `npm run lint`, and strict `npm run typecheck` pass.
- Exact local detached-SHA generator check verifies all seven pinned semantic/runtime fixtures.
- `npm run parity:api -- --check` passes and the existing six fixture bytes remain unchanged.
- `git diff --check` passes and the implementation worktree was clean before planning metadata was added.

## Known Stubs

None. Later plans consume these generated scenarios to implement and execute the TypeScript client behavior; this plan contains no placeholder runtime branches.

## User Setup Required

None - generation and tests require no credentials, endpoint, PIN, device, or hardware access.

## Next Phase Readiness

- Plan 02-05 can implement lifecycle, serialization, retries, reconnects, probes, and context against exact pinned scenario evidence.
- Plans 02-06 and 02-07 can execute the closed read, fallback, quarantine, detection, state, and diagnostic inventory.
- The full self-provisioning parity command remains a release/CI verification for a network-authorized environment.

## Self-Check: PASSED

- All six implementation/test artifacts and all four TDD commits exist.
- The fixture has exactly 34 unique scenarios and every scenario parses through the closed TypeScript contract.
- Generator and orchestrator counts are exactly seven fixtures, two generated documents, and nine generated artifacts.
- No live network, hardware, device, ambient sibling HEAD, or sensitive input participated in this execution.

---

_Phase: 02-modbus-reads-detection-and-resilience_
_Completed: 2026-07-16_
