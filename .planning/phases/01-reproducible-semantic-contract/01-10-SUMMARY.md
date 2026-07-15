---
phase: 01-reproducible-semantic-contract
plan: "10"
subsystem: ci-documentation
tags: [github-actions, parity, python-3.12, documentation, release-gate]

requires:
  - phase: 01-reproducible-semantic-contract
    provides: exact semantic fixtures, checked Phase-1 mappings, and private package exports
provides:
  - Least-privilege Node 22/24 and exact Python 3.12 parity CI
  - Truthful private Phase-1 README and Unreleased changelog
  - Complete quality, coverage, package, mapping, parity, and drift closure contracts
affects: [phase-2-transport, phase-3-writes, phase-4-web, phase-5-release]

tech-stack:
  added: []
  patterns:
    - Delegate CI parity to the same guaranteed non-mutating npm command used locally
    - Keep implemented semantic scope and deferred runtime scope explicit in human documentation
    - Enforce private packaging and empty later-phase boundaries in executable closure tests

key-files:
  created:
    - CHANGELOG.md
  modified:
    - .github/workflows/ci.yml
    - README.md
    - test/parity/phase-gate.test.ts

key-decisions:
  - "Use one separate Python 3.12 CI job that calls only npm run parity:check after a full-history, full-tag checkout."
  - "Pin every GitHub Action to a complete commit SHA and retain global contents-read permissions without secrets, environments, or device inputs."
  - "Document exactly 53 complete Phase-1 mappings, 52 runtime exports plus RegisterDef as a type, while all 36 later-owned mappings remain planned."
  - "Keep private: true and explicitly state that no Node hardware validation was performed."

patterns-established:
  - "CI parity boundary: setup may provision runtimes, but semantic generation and identity verification remain owned by scripts/check-parity.mjs."
  - "Truthful phase docs: distinguish proven semantic-core behavior from absent transport, write, web, and release behavior."

requirements-completed: [PAR-01, BASE-01, API-01, API-02, REG-01, COD-01, CTR-01]

duration: 22 min
completed: 2026-07-15
---

# Phase 01 Plan 10: Least-Privilege CI and Truthful Phase Closure Summary

**SHA-pinned read-only CI now enforces the exact Python semantic contract, while README, changelog, and executable gates keep the private Phase-1 scope distinct from all deferred runtime work.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-15T14:53:40Z
- **Completed:** 2026-07-15T15:15:26Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Preserved the Node.js 22/24 package matrix and added a separate Python 3.12 parity job with read-only permissions, full tag history, and five full-SHA action references.
- Made CI invoke only npm run parity:check, preserving the exact verify-before-import, isolated Python 3.12, pinned pymodbus 3.12.1, atomic, and cleanup guarantees already used locally.
- Replaced bootstrap-era documentation with an exact Phase-1 account: Python 0.7.6, v0.7.6, full commit ad121ebf34a5f5e37204371c026927d77efcd15c, 53 complete mappings, 52 runtime exports, and RegisterDef as the sole type-only export.
- Added an Unreleased changelog that records implemented constants, classes, codecs, registers, contracts, packaging, CI, private status, later Phases 2-5, and the absence of Node hardware validation.
- Added closure tests for workflow permissions/history/actions, truthful documentation, 80 percent coverage thresholds, private packaging, exact mapping status, the empty web runtime, guaranteed parity, and generated artifact presence.

## Task Commits

Both tasks followed RED/GREEN TDD:

1. **Task 01-10-01 RED: least-privilege CI contracts** - e38b0c3
2. **Task 01-10-01 GREEN: exact read-only parity CI** - b023ad1
3. **Task 01-10-02 RED: truthful documentation and closure contracts** - d038055
4. **Task 01-10-02 GREEN: private Phase-1 documentation and full gate** - 5deca21

## Files Created/Modified

- .github/workflows/ci.yml - Node 22/24 package validation plus isolated full-tag Python 3.12 parity.
- README.md - Exact private semantic-core scope, usable exports, safe commands, and deferred runtime phases.
- CHANGELOG.md - Unreleased exact-baseline Phase-1 evidence and explicit no-hardware status.
- test/parity/phase-gate.test.ts - Workflow, documentation, package, coverage, mapping, parity, and web-boundary closure contracts.

## Decisions Made

- The parity CI job does not duplicate Python generator commands or consume an ambient checkout; the audited npm orchestrator remains the sole lifecycle owner.
- Full tag/history availability is explicit in the parity checkout, while the orchestrator still clones and verifies the canonical upstream tag and commit independently.
- Documentation calls the semantic core usable only for pure constants, codecs, types, registers, and scenarios. It does not call the repository a functioning Modbus client or a complete port.
- The optional web entry point stays empty, later mappings stay planned, and publication stays blocked by private: true.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Narrowed optional regular-expression captures for strict TypeScript**

- **Found during:** Task 01-10-02 full npm run check
- **Issue:** TypeScript correctly inferred that a RegExp capture can be undefined, although the workflow action-reference test had already passed at runtime.
- **Fix:** Filtered missing captures with an explicit string type predicate before validating full-SHA action references.
- **Files modified:** test/parity/phase-gate.test.ts
- **Verification:** strict typecheck, focused workflow/documentation tests, full coverage, lint, and format checks pass.
- **Committed in:** 5deca21

---

**Total deviations:** 1 auto-fixed bug.
**Impact on plan:** The fix strengthens static correctness without changing CI behavior or public scope.

## Issues Encountered

- The first full gate stopped at strict typecheck on the optional RegExp capture; the type guard above resolved it before any task completion claim.
- The full coverage suite took approximately eight minutes because it intentionally provisions isolated Python environments and exact Git checkouts for success, drift, rollback, and cleanup paths.

## TDD Gate Compliance

- Task 1 RED failed because the workflow had only two action references and no Python parity job; GREEN added the bounded job and passed workflow, baseline-tag, lint, format, and real parity checks.
- Task 2 RED failed because README lacked exact Phase-1 scope and CHANGELOG.md did not exist; GREEN documented only evidenced facts and passed the focused closure suite.

## Verification

- Focused workflow contracts passed for Node 22/24, read permissions, full SHA action pins, Python 3.12, full tags/history, parity:check delegation, and absence of secrets/device inputs.
- Focused README, CHANGELOG, private, hardware, and full-gate contracts passed.
- npm run check passed format, ESLint, strict TypeScript, 231/231 tests, 90.44 percent branch coverage, ESM/CJS/declarations, and package validation.
- The controlled 15-file tarball installed in a clean project and passed both ESM import and CommonJS require smoke tests.
- npm run parity:check self-provisioned and verified Python 0.7.6, v0.7.6, and ad121ebf34a5f5e37204371c026927d77efcd15c before passing non-mutatingly.
- Contracts, API and baseline documents, and all six fixture families remained byte-clean after parity verification.
- All 39 requirement, research, context, goal, and deferred source-coverage rows retain their covered or explicitly excluded disposition.

## Known Stubs

None. The client, write, and web runtime surfaces are not stubbed; they remain absent and their 36 API rows remain planned for Phases 2-4.

## User Setup Required

None - no external service configuration, credentials, device, or hardware action is required.

## Next Phase Readiness

- Phase 1 is ready for independent phase verification and security/code review.
- Phase 2 can add transport, detection, resilience, diagnostics, and their existing mapping rows without weakening the semantic trust boundary.
- Publication remains blocked until Phases 2-5, latest-stable freshness, full API closure, and accurately recorded hardware validation are complete.

## Self-Check: PASSED

- All four implementation artifacts exist and all four RED/GREEN commits are present in order.
- Every task acceptance criterion and plan verification command passed after the final implementation commit.
- Complete/planned mapping counts are exactly 53/36, the package remains private, web remains empty, and generated artifacts have no diff.

---

_Phase: 01-reproducible-semantic-contract_  
_Completed: 2026-07-15_
