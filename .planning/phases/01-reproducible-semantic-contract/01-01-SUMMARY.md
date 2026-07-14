---
phase: 01-reproducible-semantic-contract
plan: "01"
subsystem: parity-tooling
tags: [typescript, git, baseline, supply-chain, vitest]

requires:
  - phase: project-foundation
    provides: pinned UPSTREAM-PARITY.json and strict Node toolchain
provides:
  - Closed runtime parser for the exact Python v0.7.6 baseline identity
  - Shell-free verifier for clean detached upstream checkouts
  - Disposable full-history, shallow-history, and mutation rejection tests
affects: [contract-generation, api-parity, register-schema, release-gates]

tech-stack:
  added: []
  patterns:
    - Verify manifest and checkout identity before any upstream execution
    - Pass fixed Git subcommands and values as literal spawnSync argument arrays

key-files:
  created:
    - scripts/check-upstream-version.mjs
    - test/parity/baseline.test.ts
  modified:
    - src/internal/parity-metadata.ts

key-decisions:
  - "Baseline admission requires the allowlisted URL, package, version, tag, full SHA, schema, clean detached HEAD, and matching committed pyproject metadata."
  - "The verifier reads pyproject.toml from the pinned Git object instead of trusting mutable worktree content."

patterns-established:
  - "Closed baseline parsing: unknown JSON is accepted only after exact key, value, and identity validation."
  - "Local Git verification: fixed commands, shell disabled, bounded output, timeout, and no Python/import/network-device path."

requirements-completed: [BASE-01]

duration: 16 min
completed: 2026-07-14
---

# Phase 01 Plan 01: Exact Baseline Trust Boundary Summary

**Strict manifest admission and a shell-free Git verifier now reject every branch, dirty tree, moved tag, wrong identity, and shallow missing-tag baseline before upstream code can run.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-07-14T22:41:47Z
- **Completed:** 2026-07-14T22:58:17Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added a closed `unknown`-to-`UpstreamParity` parser with stable rejection codes, bounded fields, exact baseline identity checks, and a frozen result.
- Added a read-only verifier that requires a clean detached checkout, canonical allowlisted origin, exact HEAD and tag target, and matching pinned `pyproject.toml` package/version.
- Added 31 focused baseline tests covering all manifest branches, checkout mutations, literal shell metacharacters, and shallow history before and after the exact tag is fetched.
- Confirmed 100% statement, branch, function, and line coverage for the TypeScript baseline parser.

## Task Commits

Each task was committed atomically using RED/GREEN TDD:

1. **Task 01-01-01 RED: strict manifest contract tests** - `5e3edf7` (test)
2. **Task 01-01-01 GREEN: strict immutable manifest parser** - `1822383` (feat)
3. **Task 01-01-02 RED: exact checkout verifier tests** - `472f092` (test)
4. **Task 01-01-02 GREEN: shell-free checkout verifier** - `3a44fdb` (feat)

## Files Created/Modified

- `src/internal/parity-metadata.ts` - Requires every baseline field, validates the pinned identity, emits stable validation codes, and returns a frozen value.
- `scripts/check-upstream-version.mjs` - Canonicalizes caller paths and verifies origin, cleanliness, detached HEAD, tag target, and committed Python package metadata using fixed Git argument arrays.
- `test/parity/baseline.test.ts` - Exercises manifest and checkout success/rejection behavior with disposable repositories and shallow clones.

## Decisions Made

- The exact Python `v0.7.6` identity is explicitly allowlisted in both the runtime parser and the TypeScript-independent verifier; future baseline movement must be an intentional reviewed code and manifest change.
- `parity_status` accepts only the known lifecycle values `planned`, `partial`, and `complete`, while repository/package/version/tag/commit/schema remain the indivisible technical identity.
- Package metadata is read with `git show <pinned-sha>:pyproject.toml`, so index flags or mutable worktree content cannot spoof the verified name/version after Git identity checks.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first TOML section extractor stopped before the complete `[project]` body. It was replaced during GREEN implementation with deterministic header and next-section slicing; all focused and full checks then passed.

## TDD Gate Compliance

- RED commits: `5e3edf7`, `472f092`
- GREEN commits: `1822383`, `3a44fdb`
- Both RED runs failed for the intended missing behavior before implementation.

## Verification

- `npm test -- test/parity/baseline.test.ts test/bootstrap.test.ts` - 40 tests passed.
- `npm run typecheck` - passed.
- `npm run lint` - passed.
- `npm run format:check` - passed.
- `npm run test:coverage` - passed with 100% coverage for `parity-metadata.ts`.
- Static capability scan confirmed the verifier invokes only `git` with `shell: false`; it contains no Python execution, device access, credential read, or write API.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Later generators can call the verifier as a mandatory pre-import trust gate.
- Plan 01-02 can define tagged contract values and normalized semantic errors against the now-fixed baseline identity.
- No blockers remain.

## Self-Check: PASSED

- All three implementation/test artifacts and this summary exist on disk.
- All four RED/GREEN task commits are present in Git history.
- Every task acceptance criterion and plan-level verification command passed.

---

_Phase: 01-reproducible-semantic-contract_  
_Completed: 2026-07-14_
