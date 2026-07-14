---
phase: 1
slug: reproducible-semantic-contract
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-14
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 with V8 coverage; Python 3.12 contract generator |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --run` with the focused test path from the task |
| **Full suite command** | `npm run check && npm run parity:check` |
| **Estimated runtime** | Under 60 seconds for focused tests; full parity includes Python generation |

---

## Sampling Rate

- **After every task commit:** Run the task's focused Vitest file and `npm run typecheck`.
- **After every plan wave:** Run `npm test`, `npm run lint`, `npm run format:check`, and the relevant generator check.
- **Before `$gsd-verify-work`:** `npm run check && npm run parity:check` must be green in a clean tree.
- **Max feedback latency:** 60 seconds for the focused task loop.

---

## Per-Task Verification Map

Task IDs and waves are finalized by the phase planner. Every listed requirement
must retain at least one focused automated command when the plan is written.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| assigned by planner | TBD | TBD | BASE-01 | T-1-01, T-1-03, T-1-05 | Upstream code is not imported until URL, tag, SHA, version, and schema are verified | unit + process integration | `npm test -- test/parity/baseline.test.ts` | ❌ W0 | ⬜ pending |
| assigned by planner | TBD | TBD | API-01 | T-1-02 | Every pinned public export has one explicit TypeScript mapping and boundary | contract | `npm test -- test/parity/api-parity.test.ts` | ❌ W0 | ⬜ pending |
| assigned by planner | TBD | TBD | API-02 | T-1-02, T-1-08 | Generated API documentation is fresh and mapping status/evidence is strict | generation contract | `npm run parity:api -- --check` | ❌ W0 | ⬜ pending |
| assigned by planner | TBD | TBD | COD-01 | T-1-06, T-1-07 | Tagged exceptional numbers and codec inputs are strictly validated | unit + golden | `npm test -- test/parity/codec-contract.test.ts` | ❌ W0 | ⬜ pending |
| assigned by planner | TBD | TBD | REG-01 | T-1-02, T-1-07 | Register schemas preserve authoritative metadata and only documented overlaps | unit + golden | `npm test -- test/registers test/parity/register-schema.test.ts` | ❌ W0 | ⬜ pending |
| assigned by planner | TBD | TBD | PAR-01 | T-1-01, T-1-02, T-1-03, T-1-08 | Committed artifacts are deterministic, baseline-bound, and stale diffs fail | cross-repository contract | `npm run parity:check` | ❌ W0 | ⬜ pending |
| assigned by planner | TBD | TBD | CTR-01 | T-1-06, T-1-07, T-1-08 | Scenario contracts reject missing fields, unknown operations, and lossy values | unit + schema | `npm test -- test/parity/scenario-schema.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Threat References

- **T-1-01:** spoofed or moved upstream reference.
- **T-1-02:** stale or tampered generated evidence.
- **T-1-03:** execution of unverified upstream code with secrets or device access.
- **T-1-05:** shell or path injection through manifest and checkout inputs.
- **T-1-06:** ambiguous exceptional-number envelope.
- **T-1-07:** unbounded or unsupported contract input.
- **T-1-08:** generated evidence without reproducible provenance.

---

## Wave 0 Requirements

- [ ] `contracts/api-mapping.json` and strict mapping validation.
- [ ] `scripts/generate-python-contract.py` with verify-before-import and deterministic `--check` mode.
- [ ] `scripts/generate-api-parity.mjs` plus generated `docs/API-PARITY.md` and `docs/BASELINE.md`.
- [ ] `test/parity/baseline.test.ts` — BASE-01.
- [ ] `test/parity/api-parity.test.ts` — API-01 and API-02.
- [ ] `test/parity/codec-contract.test.ts` — COD-01.
- [ ] `test/registers/register-def.test.ts`, `test/registers/builders.test.ts`, and `test/parity/register-schema.test.ts` — REG-01.
- [ ] `test/parity/scenario-schema.test.ts` — CTR-01.
- [ ] `test/fixtures/public-api.json`, `codec-vectors.json`, `register-schema.json`, `behavior-contract.json`, and explicit deferred `web-contract.json`.
- [ ] npm parity scripts and the exact-baseline CI job.

---

## Manual-Only Verifications

All Phase 1 behaviors have automated verification. No live hardware access,
credentials, or device writes are permitted in this phase.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies.
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify.
- [ ] Wave 0 covers all MISSING references.
- [ ] No watch-mode flags.
- [ ] Feedback latency under 60 seconds for focused checks.
- [ ] Threat references appear in plan tasks and acceptance criteria.
- [ ] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending
