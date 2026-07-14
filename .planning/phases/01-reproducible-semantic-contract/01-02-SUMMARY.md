---
phase: 01-reproducible-semantic-contract
plan: "02"
subsystem: parity-contracts
tags: [python, fixtures, contracts, supply-chain, register-schema]

requires:
  - phase: 01-reproducible-semantic-contract
    provides: exact baseline trust boundary from Plan 01-01
provides:
  - Verified Python 3.12 contract generator for the exact pinned upstream commit
  - Six byte-stable semantic fixture families with complete baseline provenance
  - Closed cross-language normalization, validation-error, and exceptional-number contract
affects: [api-parity, codecs, register-builders, cross-repository-ci, release-gates]

tech-stack:
  added: []
  patterns:
    - Verify repository identity and package metadata before importing pinned Python
    - Stage, validate, fsync, and transactionally replace a fixed output allowlist
    - Encode exceptional numbers with one closed reserved JSON envelope

key-files:
  created:
    - contracts/normalization.md
    - scripts/generate-python-contract.py
    - test/fixtures/public-api.json
    - test/fixtures/public-classes.json
    - test/fixtures/codec-vectors.json
    - test/fixtures/register-schema.json
    - test/fixtures/behavior-contract.json
    - test/fixtures/web-contract.json
    - test/parity/generator.test.ts
  modified:
    - .prettierignore

key-decisions:
  - "Upstream Python is imported only after canonical origin, clean detached HEAD, exact tag/SHA, package/version, manifest, and output-root checks pass."
  - "Python-derived class facts remain separate from future TypeScript ownership, naming, export, status, and representation mappings."
  - "All six fixtures are generated and validated before a transactional replacement; check mode compares temporary output without touching bytes or mtimes."

patterns-established:
  - "Closed contract values: only documented null/sequence/set/enum/mapping normalization and the exact $number envelope are accepted."
  - "Representative complete maps plus compact exhaustive gate matrices avoid both hand-copied subsets and combinatorial fixture growth."

requirements-completed: [PAR-01, CTR-01]

duration: 33 min
completed: 2026-07-15
---

# Phase 01 Plan 02: Pinned Semantic Contract Pipeline Summary

**A verify-before-import Python generator now produces six deterministic, lossless contracts for the exact `idm-heatpump-api` v0.7.6 source and fails hard on identity, schema, drift, or transaction errors.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-07-14T23:02:45Z
- **Completed:** 2026-07-14T23:35:45Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Defined a closed normalization contract for nulls, sequences, sets, enums, mappings, finite validation codes, and lossless NaN, infinities, and negative zero.
- Generated exact public API/class facts, primitive/register codec vectors, three complete register maps with documented overlaps, strict eight-field behavior scenarios, and an explicit release-blocking web deferral marker.
- Secured the generator boundary with canonical checkout/package verification before import, fixed output paths, no network/device/credential access, deterministic JSON, non-mutating check mode, and rollback-tested transactional writes.
- Preserved all 26 register fields for 267 default, 587 Navigator 10 full, and 105 Navigator 2.0 circuit-A entries while keeping Navigator 1.0/1.7 absent.

## Task Commits

Each task was committed atomically using RED/GREEN TDD:

1. **Task 01-02-01 RED: secure generator boundary tests** - `48ddc3f` (test)
2. **Task 01-02-01 GREEN: verified Python generation boundary** - `b7cce14` (feat)
3. **Task 01-02-02 RED: semantic fixture contract tests** - `e0d73c6` (test)
4. **Task 01-02-02 GREEN: pinned semantic fixture families** - `1d3e627` (feat)
5. **Task 01-02-03 RED: deterministic atomic generation tests** - `8e8a854` (test)
6. **Task 01-02-03 GREEN: deterministic atomic generation** - `aaafe09` (feat)
7. **Final gate formatting:** byte-authoritative fixture handling - `786e249` (style)
8. **Final acceptance hardening:** rollback after an actual replacement - `371add6` (test)

## Files Created/Modified

- `contracts/normalization.md` - Documents the complete allowed value normalizations and stable semantic validation categories/codes.
- `scripts/generate-python-contract.py` - Verifies pinned source identity, reflects/executes approved semantic facts, emits canonical JSON, checks drift, and transactionally writes only the six allowlisted artifacts.
- `test/fixtures/public-api.json` - Records the ordered 89-symbol inventory, aliases, source groups, and 59-root/30-web split.
- `test/fixtures/public-classes.json` - Records Python-only constructor/member signatures, defaults, and validation/acceptance facts for every public class.
- `test/fixtures/codec-vectors.json` - Separates primitive and register layers across float, integer, mask, rounding, multiplier, and rejection boundaries.
- `test/fixtures/register-schema.json` - Contains three complete pinned maps, all 26 fields, documented overlaps, and compact exhaustive builder/model/feature/detection/registry facts.
- `test/fixtures/behavior-contract.json` - Contains strict language-neutral semantic scenarios with all eight CTR-01 fields.
- `test/fixtures/web-contract.json` - Records the explicit Phase-4, release-blocking web evidence deferral.
- `test/parity/generator.test.ts` - Proves verification order, normalization closure, fixture completeness, deterministic bytes, non-mutating checks, drift failure, and transaction rollback.
- `.prettierignore` - Excludes byte-authoritative generated fixtures from formatting rewrites.

## Decisions Made

- The Python generator independently rechecks the complete baseline instead of assuming the TypeScript baseline verifier already ran; this keeps the import boundary fail-closed in every invocation context.
- Class reflection emits only pinned Python facts. TypeScript symbol names, ownership phases, export paths, lifecycle status, and representation choices remain Plan 01-03 mapping concerns.
- The register artifact uses three complete authoritative maps and compact exhaustive boundary summaries, preserving official overlaps rather than imposing a false no-overlap invariant.
- `--check` generates in a disposable directory, byte-compares committed artifacts, reports the first drift, and never rewrites or refreshes mtimes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Kept generated JSON byte-authoritative under the format gate**

- **Found during:** Final verification (`npm run format:check`)
- **Issue:** Prettier would rewrite deterministic generator output, creating a second serialization authority and failing the repository format gate.
- **Fix:** Added the six generated JSON paths as a fixture glob in `.prettierignore` and formatted the human-authored documentation/test files.
- **Files modified:** `.prettierignore`, `contracts/normalization.md`, `test/parity/generator.test.ts`
- **Verification:** `npm run format:check` passes and a detached pinned-source `--check` reports all six artifacts unchanged.
- **Committed in:** `786e249`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix preserves the generator as the sole byte authority without changing contract semantics or adding dependencies.

## Issues Encountered

- Windows-hosted Vitest cannot invoke the WSL-only `python3.12` executable. The process tests support `IDM_CONTRACT_PYTHON` and use the installed Python 3.13 interpreter on Windows, while the generator itself enforces Python 3.12 or newer.
- The initial failure-injection test aborted after staging but before replacement. Final acceptance hardening moved the exercised failure to after the first real replacement and proved rollback restores every prior byte and mtime.

## TDD Gate Compliance

- RED commits: `48ddc3f`, `e0d73c6`, `8e8a854`
- GREEN commits: `b7cce14`, `1d3e627`, `aaafe09`
- Every RED run failed for its intended missing behavior before implementation; final hardening is covered by `371add6`.

## Verification

- `npm test` - 48 tests passed across bootstrap, baseline, and generator suites.
- `npm run typecheck` - passed.
- `npm run lint` - passed.
- `npm run format:check` - passed.
- Fresh local clone at `ad121ebf34a5f5e37204371c026927d77efcd15c`, canonical origin, detached HEAD, then generator `--check` - verified all six fixtures.
- `git diff --exit-code -- test/fixtures` - passed.
- Static capability scans found no network/device API, shell execution, private IP, credential value, private key, unapproved hardware capture, TODO/FIXME stub, or npm dependency change.

## Known Stubs

- `test/fixtures/web-contract.json` is the intentional structured Phase-4 deferred marker required by this plan. It carries `release_blocking: true`; it is not fabricated web parity evidence and cannot permit publication.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-03 can map every Python public symbol/class fact to an explicit TypeScript counterpart without contaminating the authoritative Python evidence.
- Codec and register implementation plans can consume stable, provenance-bound goldens and exact builder/gate summaries.
- No blockers remain; web behavior remains explicitly deferred and release-blocking until Phase 4 evidence exists.

## Self-Check: PASSED

- All nine planned implementation/test artifacts, the format-gate adjustment, and this summary exist on disk.
- All RED/GREEN, formatting, and rollback-hardening commits are present in Git history.
- Every task acceptance criterion, plan verification command, detached-source check, quality gate, and threat-surface check passed.

---

_Phase: 01-reproducible-semantic-contract_  
_Completed: 2026-07-15_
