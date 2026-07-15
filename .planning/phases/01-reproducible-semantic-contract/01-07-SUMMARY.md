---
phase: 01-reproducible-semantic-contract
plan: "07"
subsystem: parity-tooling
tags: [node, python, git, supply-chain, atomic-generation, npm, parity]

requires:
  - phase: 01-reproducible-semantic-contract
    provides: exact baseline admission, deterministic Python fixtures, API document generation, and complete Phase-1 semantic evidence
provides:
  - Self-provisioning exact-tag/SHA upstream checkout with verification before import
  - Ephemeral exact Python 3.12 reference environment pinned to pymodbus 3.12.1
  - Atomic eight-artifact generation and repository-non-mutating parity checks
  - Stable parity:generate, parity:api, and parity:check npm entry points
affects: [api-promotion, cross-repository-ci, release-gates, upstream-synchronization]

tech-stack:
  added: []
  patterns:
    - Treat cloned source as executable input only after exact identity admission in a sanitized child environment
    - Generate Python facts and API projections in an owned shadow root before fixed-allowlist comparison or promotion
    - Provision Python reference dependencies ephemerally and keep them outside package metadata and tarballs

key-files:
  created:
    - scripts/check-parity.mjs
    - test/parity/phase-gate.test.ts
  modified:
    - package.json

key-decisions:
  - "Use an exact Python 3.12 ephemeral venv with only pymodbus==3.12.1 installed without dependencies from the fixed PyPI index."
  - "Generate six Python fixtures plus both API documents in an owned shadow root, then compare without writes or replace the fixed eight-file allowlist transactionally."
  - "Sanitize Git configuration and the legacy ambient checkout variable after cloning so identity verification and Python imports see only the canonical origin and explicit paths."
  - "Keep parity:api as API-only deterministic regeneration while parity:generate and parity:check own the exact Python baseline lifecycle."

patterns-established:
  - "Parity subprocess boundary: fixed executables, literal argument arrays, shell disabled, bounded output/timeouts, and stable named diagnostics."
  - "Offline optimization: --upstream-dir is explicit and must pass the same clean detached SHA/tag/origin/version/schema admission as self-provisioned checkouts."

requirements-completed: [PAR-01, BASE-01, CTR-01]

duration: 44 min
completed: 2026-07-15
---

# Phase 01 Plan 07: Safe Self-Provisioning Parity Orchestrator Summary

**Exact Python baseline generation and verification now self-provision a verified full-tag checkout and disposable Python 3.12 environment, atomically manage all generated evidence, and expose stable private npm gates.**

## Performance

- **Duration:** 44 min
- **Started:** 2026-07-15T01:41:00Z
- **Completed:** 2026-07-15T02:25:06Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added a strict generate/check orchestrator that accepts only the closed manifest, clones only the allowlisted canonical repository, checks out the exact commit with tags, and verifies origin, cleanliness, detached HEAD, tag target, package version, and schema before any upstream import.
- Added an explicit-checkout offline path with identical admission and no fallback to ambient `IDM_HEATPUMP_API_DIR` state.
- Provisioned an owned exact Python 3.12 venv with only audited `pymodbus==3.12.1`, exact-version verification, fixed PyPI origin, no dependency expansion, and Windows-to-WSL support when native Python 3.12 is unavailable.
- Generated all six Python fixtures and both API documents in a temporary shadow repository. Check mode compares bytes without touching repository bytes or mtimes; generate mode promotes only the fixed eight-file allowlist with rollback.
- Added process tests for default and explicit success, literal metacharacter paths, shallow missing-tag rejection, wrong/dirty checkout rejection before import, drift, injected generation failure, cleanup, private packaging, and tarball exclusion.
- Added `parity:generate`, `parity:api`, and `parity:check` while preserving every prior package script, `private: true`, zero runtime dependencies, and the `dist`-only package boundary.

## Task Commits

Each task was committed through RED/GREEN TDD:

1. **Task 01-07-01 RED: parity orchestrator process contracts** - `35b2f65` (test)
2. **Task 01-07-01 GREEN: exact-baseline parity orchestrator** - `8bad985` (feat)
3. **Task 01-07-02 RED: npm/private/tarball contracts** - `ddcd15d` (test)
4. **Task 01-07-02 GREEN: guaranteed npm parity entry points** - `258aa1c` (chore)

## Files Created/Modified

- `scripts/check-parity.mjs` - Closed manifest parser, exact checkout lifecycle, Python reference provisioning, shadow generation, drift checking, transactional promotion, and cleanup.
- `test/parity/phase-gate.test.ts` - Nine process/package tests covering identity order, self-provisioning, explicit paths, drift, rollback, cleanup, private status, and tarball boundaries.
- `package.json` - Three fixed parity scripts; publication guard, exports, dependencies, files allowlist, and existing checks are unchanged.

## Decisions Made

- Git URL rewriting remains usable as a transport optimization for tests, but all Git configuration overrides are removed from verifier and Python child environments. The exact canonical origin and pinned commit/tag remain the admitted identity.
- Python 3.13 is not accepted as an implicit substitute. Windows first uses native `py -3.12`, then a fixed WSL Python 3.12 bridge; Unix requires `python3.12`.
- The Python generator never writes to the repository from the orchestrator. Its output root is always owned temporary state, which makes check mode structurally non-mutating rather than relying on post-hoc restoration.
- API mapping rows and root exports are deliberately untouched. Plan 01-09 retains sole promotion ownership and uses `parity:api` followed by `parity:check`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added cross-platform cleanup for WSL-created Python environments**

- **Found during:** Task 01-07-01 GREEN verification
- **Issue:** Windows could not remove Linux-style venv symlinks created by WSL Python, so a successful parity run could surface a cleanup failure or leave owned temporary state.
- **Fix:** Create the venv with `--copies` and use a bounded fixed-argument WSL removal fallback only when native Windows recursive removal fails.
- **Files modified:** `scripts/check-parity.mjs`
- **Verification:** Explicit/default success and injected-failure tests all assert no new owned temporary directory remains.
- **Committed in:** `8bad985`

---

**Total deviations:** 1 auto-fixed (1 missing critical functionality).
**Impact on plan:** The fix closes the required cleanup guarantee on the active Windows/WSL development platform without changing parity artifacts, package dependencies, mappings, or exports.

## Issues Encountered

- Disposable Python 3.12 venv creation on the Windows-mounted workspace is intentionally slower than ordinary unit tests. The process remains bounded, deterministic, isolated, and fully cleaned; focused process tests use generous explicit timeouts.

## TDD Gate Compliance

- RED commits: `35b2f65`, `ddcd15d`.
- GREEN commits: `8bad985`, `258aa1c`.
- The first RED run failed because `scripts/check-parity.mjs` did not exist. The second RED run failed because all three npm parity commands were absent. Both corresponding GREEN gates passed before plan closure.

## Verification

- `npm test -- test/parity/phase-gate.test.ts` - 9/9 tests passed, including four isolated real Python/Git orchestration runs.
- `npm run parity:generate` then `npm run parity:check` - both self-provisioned from the canonical GitHub repository without `IDM_HEATPUMP_API_DIR`, verified v0.7.6 at `ad121ebf34a5f5e37204371c026927d77efcd15c`, and passed.
- `npm run parity:api -- --check` - deterministic API and baseline documents are current.
- Generated diff gate - `contracts`, both generated documents, and all six fixtures are clean.
- `npm run check` - 12/12 suites and 221/221 tests passed; coverage is 91.15% statements, 90.44% branches, 89% functions, and 91.17% lines.
- Strict TypeScript, ESLint, Prettier, ESM/CJS/declaration builds, 15-file tarball allowlist, clean tarball installation, and ESM/CommonJS smoke imports all passed.
- Static process audit found no shell execution, dynamic command construction, ambient checkout fallback, runtime dependency, secret/device input, unexpected package file, or publication-guard change.

## Known Stubs

None. Mapping promotion and root exports remain intentionally absent because Plan 01-09 owns those operations; this plan does not claim them complete.

## User Setup Required

None - parity commands self-provision their exact reference environment. Python 3.12 must be available natively or through WSL on Windows.

## Next Phase Readiness

- Plan 01-09 can promote only evidenced owner-phase-1 mapping rows through `npm run parity:api`, then prove Python fixtures unchanged through non-mutating `npm run parity:check` before adding root exports.
- Plan 01-10 can delegate its Node 22/24 CI job directly to the guaranteed `parity:check` command without reconstructing Git/Python setup.
- The package remains private and no partial parity claim or release surface was introduced.

## Self-Check: PASSED

- Both created files and the modified package manifest exist.
- All four RED/GREEN task commits exist in Git history in the required order.
- Every task acceptance criterion, plan verification command, exact provenance check, non-mutation/cleanup test, full repository quality gate, coverage threshold, and package smoke gate passed.

---

_Phase: 01-reproducible-semantic-contract_  
_Completed: 2026-07-15_
