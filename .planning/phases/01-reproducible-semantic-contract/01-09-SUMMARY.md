---
phase: 01-reproducible-semantic-contract
plan: "09"
subsystem: public-api
tags: [typescript, api-mapping, exports, parity, tdd, npm]

requires:
  - phase: 01-reproducible-semantic-contract
    provides: exact-baseline parity orchestration and complete semantic-core evidence
provides:
  - Evidence-gated completion of exactly 53 Phase-1 public API mappings
  - Exact 52-symbol runtime root namespace plus the RegisterDef type export
  - Promotion and export state-machine contracts that keep later-owned symbols private
affects: [transport-api, write-api, web-api, parity-ci, release-gates]

tech-stack:
  added: []
  patterns:
    - Promote mapping status only after complete implementation and focused evidence
    - Derive the package barrel exactly from checked complete mapping rows
    - Keep runtime, type-only, internal, later-phase, and web exports explicitly separated

key-files:
  created: []
  modified:
    - contracts/api-mapping.json
    - docs/API-PARITY.md
    - scripts/check-parity.mjs
    - src/index.ts
    - test/parity/api-parity.test.ts
    - test/parity/phase-gate.test.ts

key-decisions:
  - "Complete exactly the 53 implemented owner-Phase-1 rows; keep all 36 later-owned rows planned."
  - "Expose 52 runtime values and RegisterDef as an explicit type-only export; do not expose internal codec, serializer, or static-builder helpers."
  - "Stage only bounded regular contract-test files for complete rows inside the parity shadow root so API validation remains isolated and non-mutating."

patterns-established:
  - "Checked barrel closure: runtime Object.keys must equal complete root mappings minus the explicit type-only allowlist."
  - "Promotion order: focused evidence, mapping promotion, parity:api, parity:check, then package export."

requirements-completed: [PAR-01, API-01, API-02]

duration: 11h 55m elapsed (interrupted executor; 20m resume)
completed: 2026-07-15
---

# Phase 01 Plan 09: Evidence-Gated API Promotion and Root Exports Summary

**Exactly 53 proven semantic-core mappings now close against generated API evidence, with a 52-symbol runtime root namespace and one explicit type-only export while all later-phase surfaces remain absent.**

## Performance

- **Duration:** 11h 55m elapsed, including an interrupted executor; approximately 20m active resume
- **Started:** 2026-07-15T02:38:28Z
- **Completed:** 2026-07-15T14:33:09Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Promoted exactly 53 implemented and evidenced owner-Phase-1 mapping rows from `planned` to `complete`; all 36 client, write, and web rows remain `planned`.
- Regenerated `docs/API-PARITY.md` through the API-only npm command and proved all six Python-derived fixtures byte-stable through the self-provisioning exact-baseline parity check.
- Exported exactly 52 complete runtime symbols from the package root and `RegisterDef` through `export type`, using `.js` specifiers compatible with the shared ESM/CJS/declaration build.
- Added executable closure contracts that reject export-before-promotion, later/web leakage, internal helper leakage, and any mismatch between the checked mapping and runtime package namespace.

## Task Commits

Both tasks followed RED/GREEN TDD, with one formatting-only refactor after GREEN:

1. **Task 01-09-01 RED: API promotion contracts** - `24ab6cd` (test)
2. **Task 01-09-01 GREEN: evidenced Phase-1 mapping promotion** - `6bd333b` (feat)
3. **Task 01-09-02 RED: exact checked export contracts** - `463729c` (test)
4. **Task 01-09-02 GREEN: checked Phase-1 root surface** - `36e2ebc` (feat)
5. **Task 01-09-02 REFACTOR: repository formatting compliance** - `0271321` (refactor)

## Files Created/Modified

- `contracts/api-mapping.json` - Sole Node decision authority with 53 complete Phase-1 and 36 planned later-phase rows.
- `docs/API-PARITY.md` - Generated status, representation, normalization, and member-evidence projection.
- `scripts/check-parity.mjs` - Safely stages bounded evidence files required to validate complete mappings in the owned shadow root.
- `src/index.ts` - Exact checked root runtime and type-only package barrel.
- `test/parity/api-parity.test.ts` - Mapping authority separation, promotion eligibility, exact runtime export closure, and forbidden-symbol tests.
- `test/parity/phase-gate.test.ts` - npm promotion ordering, checked export boundary, fixture non-mutation, and package isolation contracts.

## Decisions Made

- `RegisterDef` is the sole type-only complete row; the remaining 52 complete rows must be observable runtime exports and match `Object.keys()` exactly.
- `decodeValue`, `encodeValue`, `createRegisterDef`, `serializeRegisterDef`, and static register-block helpers remain internal until a mapped public owner requires them.
- The optional web barrel remains empty and every owner-Phase-2/3/4 row remains absent even if a name could be implemented partially.
- Python-only class/member fixtures remain unchanged; TypeScript names, owner phases, status, export paths, and representation stay exclusively in the mapping.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Staged complete-row evidence inside the isolated parity shadow root**

- **Found during:** Task 01-09-01 GREEN
- **Issue:** Promoting rows made the API generator validate their `contract_test` paths, but the isolated shadow root did not yet contain those evidence files.
- **Fix:** Parse only the local mapping, accept only bounded regular `test/**/*.test.ts` files without traversal or symlinks, and copy each unique complete-row evidence file into the owned shadow root.
- **Files modified:** `scripts/check-parity.mjs`, `test/parity/api-parity.test.ts`
- **Verification:** `parity:api`, self-provisioning `parity:check`, drift/rollback tests, and the full package gate pass without repository or fixture mutation.
- **Committed in:** `6bd333b`

**2. [Rule 1 - Quality Gate] Applied repository formatting to RED export assertions**

- **Found during:** Full `npm run check` after Task 01-09-02 GREEN
- **Issue:** Two multiline assertions in the committed RED tests did not match the repository's Prettier rules.
- **Fix:** Ran Prettier on the single affected test file without changing behavior.
- **Files modified:** `test/parity/api-parity.test.ts`
- **Verification:** Focused promotion/export tests and `npm run format:check` pass, followed by the complete repository check.
- **Committed in:** `0271321`

**3. [Rule 3 - Blocking] Reconciled legacy GSD progress fields after handler updates**

- **Found during:** Plan close-out tracking
- **Issue:** The installed GSD SDK recognized all nine summaries but reset the STATE frontmatter percentage to `0` and left duplicate activity/progress/velocity fields stale while warning about the legacy free-form roadmap format.
- **Fix:** Preserved the handler-applied plan, metric, decision, session, roadmap, and requirement results, then reconciled STATE to 9/10 plans, 90%, the Plan-09 activity, and the recorded elapsed metric.
- **Files modified:** `.planning/STATE.md`, `.planning/ROADMAP.md`
- **Verification:** STATE, ROADMAP, and the on-disk PLAN/SUMMARY counts all report 9/10 with Plan 10 next; Prettier and `git diff --check` pass.
- **Committed in:** final plan metadata commit

---

**Total deviations:** 3 auto-fixed (2 blocking fixes, 1 quality-gate fix).
**Impact on plan:** The changes enforce the planned evidence and quality boundaries and keep workflow tracking truthful; no public surface or dependency scope was widened.

## Issues Encountered

- Execution was interrupted after the Task-2 RED commit. Resume verified all prior commits, preserved the prepared `src/index.ts` change, and continued without redoing or reverting completed work.
- The complete coverage suite takes roughly nine minutes because its parity gate intentionally provisions several isolated Python 3.12 environments and exact Git checkouts.
- The GSD SDK continues to warn about the repository's legacy free-form roadmap format; the reconciled state is correct and Plan 01-10 remains the next plan.

## TDD Gate Compliance

- Task 1 RED `24ab6cd` preceded GREEN `6bd333b`.
- Task 2 RED `463729c` preceded GREEN `36e2ebc`; formatting-only REFACTOR `0271321` followed GREEN.
- Focused tests fail on the pre-GREEN revisions because mappings/exports are absent and pass on the corresponding GREEN revisions.

## Verification

- Focused semantic evidence: 109/109 API, constants/types, codec, and register tests passed.
- Promotion/export closure: 12/12 focused tests passed; later, web, and internal helper exports remain absent.
- `npm run parity:api` regenerated only the API documents; mapping, baseline document, and all Python fixtures remained byte-clean afterward.
- `npm run parity:check` self-provisioned and verified Python `0.7.6`, tag `v0.7.6`, commit `ad121ebf34a5f5e37204371c026927d77efcd15c`, then passed non-mutatingly.
- `npm run check` passed format, ESLint, strict TypeScript, 225/225 tests, 90.44% branch coverage, ESM/CJS/declaration builds, and package validation.
- The controlled 15-file npm tarball installed in a clean project and passed both ESM import and CommonJS require smoke tests.
- Fixture diff, stub scan, and threat-surface scan found no unexpected change, placeholder, new endpoint, authentication path, dependency, secret, private address, or device identifier.

## Known Stubs

None. Later client, write, and web symbols are deliberately absent and remain truthfully `planned`; the package remains private.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-10 can treat the exact checked root namespace as its Phase-1 public API input for CI and documentation gates.
- Phase 2 can add transport/client symbols only by implementing their complete member contracts and promoting their existing mapping rows.
- No blocker remains. Upstream freshness and hardware-validation claims still require the dedicated release-phase checks before publication.

## Self-Check: PASSED

- All six modified files exist; no unintended deletion or untracked file remains.
- All five RED/GREEN/refactor commits exist in order.
- Every task acceptance criterion, plan verification command, parity check, coverage gate, build, package smoke test, stub scan, and threat-boundary check passed.

---

_Phase: 01-reproducible-semantic-contract_  
_Completed: 2026-07-15_
