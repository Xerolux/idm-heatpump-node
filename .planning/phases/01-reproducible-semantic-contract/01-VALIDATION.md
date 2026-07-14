---
phase: 1
slug: reproducible-semantic-contract
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-14
updated: 2026-07-14
---

# Phase 1 — Validation Strategy

> Per-task feedback contract for the ten-plan semantic-parity phase.

## Test Infrastructure

| Property                     | Value                                                           |
| ---------------------------- | --------------------------------------------------------------- |
| **Framework**                | Vitest 4.1.10 with V8 coverage; Python 3.12 reference generator |
| **Config file**              | `vitest.config.ts`                                              |
| **Focused command**          | `npm test -- <task test path>`                                  |
| **Full phase command**       | `npm run check && npm run parity:check`                         |
| **Coverage gate**            | 80% branches/functions/lines/statements                         |
| **Expected focused latency** | Under 60 seconds                                                |

## Sampling Rate

- **After every implementation task:** run that task's focused Vitest command and `npm run typecheck` when TypeScript changed.
- **After every wave:** run all tests introduced in the wave, `npm run lint`, `npm run format:check`, and the relevant generator `--check` command.
- **Before phase verification:** run `npm run check && npm run parity:check` from a clean tree and confirm generated paths have no diff.
- **CI evidence:** Node.js 22 and 24 package validation plus an exact pinned Python 3.12 parity job.
- **Maximum focused feedback gap:** no task may complete without an automated command; there are no three consecutive tasks without focused coverage.

## Wave and Dependency Map

| Wave | Plans        | Entry condition                      | Exit evidence                                                      |
| ---- | ------------ | ------------------------------------ | ------------------------------------------------------------------ |
| 1    | 01-01        | Existing bootstrap green             | Strict manifest and disposable exact-checkout verifier tests green |
| 2    | 01-02        | 01-01 complete                       | Six deterministic pinned fixtures and generator tests green        |
| 3    | 01-03, 01-08 | 01-02 complete; files do not overlap | API mapping/class ownership contract and scenarios green           |
| 4    | 01-04        | 01-03 complete                       | Mapping-consistent semantic foundation and RegisterDef green       |
| 5    | 01-05, 01-06 | 01-04 and 01-08 complete             | Mapping-consistent codec and complete register/class parity green  |
| 6    | 01-07        | 01-03, 01-05, 01-06, 01-08 complete  | Guaranteed self-provisioning npm parity flows green                |
| 7    | 01-09        | 01-07 complete                       | API-only regeneration, non-mutating fixture check, exports green   |
| 8    | 01-10        | 01-09 complete                       | Full-tag CI, truthful docs, and complete phase gate green          |

## Per-Task Verification Map

| Task ID  | Plan  | Wave | Requirement                    | Threat Ref                             | Secure behavior / observable contract                                                                                 | Test type           | Automated command                                                                                                                                                      | Test exists | Status     |
| -------- | ----- | ---- | ------------------------------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 01-01-01 | 01-01 | 1    | BASE-01                        | T-1-01, T-1-05                         | Strict manifest parser rejects branch/malformed/mismatched identities                                                 | unit                | `npm test -- test/parity/baseline.test.ts test/bootstrap.test.ts`                                                                                                      | ❌ W0       | ⬜ pending |
| 01-01-02 | 01-01 | 1    | BASE-01                        | T-1-01, T-1-02, T-1-06                 | Exact identity plus shallow missing-tag failure/full-history success occurs before import                             | process integration | `npm test -- test/parity/baseline.test.ts -t "checkout\|tag\|shallow\|shell\|dirty"`                                                                                   | ❌ W0       | ⬜ pending |
| 01-02-01 | 01-02 | 2    | CTR-01                         | T-1-01, T-1-06, T-1-07                 | Generator proves verify-before-import and closed normalization without invented rejection                             | process + unit      | `npm test -- test/parity/generator.test.ts -t "verifies before import\|normalization"`                                                                                 | ❌ W0       | ⬜ pending |
| 01-02-02 | 01-02 | 2    | PAR-01, CTR-01                 | T-1-02, T-1-04, T-1-08                 | Six fixtures cover symbols, public classes, datatype codecs, registers, scenarios, and deferred web                   | golden generation   | `npm test -- test/parity/generator.test.ts -t "fixtures\|class\|schema\|codec\|scenario"`                                                                              | ❌ W0       | ⬜ pending |
| 01-02-03 | 01-02 | 2    | PAR-01                         | T-1-02, T-1-03                         | Repeat generation is byte-stable; check is atomic/non-mutating and hard-fails drift                                   | process integration | `npm test -- test/parity/generator.test.ts -t "deterministic\|atomic\|drift"`                                                                                          | ❌ W0       | ⬜ pending |
| 01-03-01 | 01-03 | 3    | API-01, API-02                 | T-1-02, T-1-03                         | 89 planned mappings and Phase-1 class/member/signature/default/validation closure are strict                          | contract            | `npm test -- test/parity/api-parity.test.ts -t "mapping\|inventory\|class\|member\|status"`                                                                            | ❌ W0       | ⬜ pending |
| 01-03-02 | 01-03 | 3    | API-02                         | T-1-02, T-1-03                         | Generated API/class/baseline docs are complete, deterministic, and fresh                                              | generation contract | `npm test -- test/parity/api-parity.test.ts && node scripts/generate-api-parity.mjs --check`                                                                           | ❌ W0       | ⬜ pending |
| 01-08-01 | 01-08 | 3    | CTR-01                         | T-1-05, T-1-07                         | Tagged numbers round-trip losslessly with closed bounded immutable envelopes                                          | unit                | `npm test -- test/parity/scenario-schema.test.ts -t "tagged\|number\|bounds"`                                                                                          | ❌ W0       | ⬜ pending |
| 01-08-02 | 01-08 | 3    | CTR-01                         | T-1-01, T-1-05, T-1-07                 | All eight scenario fields parse strictly while codec operation domains remain datatype-specific                       | schema              | `npm test -- test/parity/scenario-schema.test.ts`                                                                                                                      | ❌ W0       | ⬜ pending |
| 01-04-01 | 01-04 | 4    | API-01                         | T-1-02, T-1-06                         | Mapping-owned constants/data/timing names/representations close exact Python facts                                    | unit + class        | `npm test -- test/semantic/constants-and-types.test.ts`                                                                                                                | ❌ W0       | ⬜ pending |
| 01-04-02 | 01-04 | 4    | REG-01                         | T-1-02, T-1-08                         | Mapping-owned RegisterDef representation matches pinned **post_init** while immutable                                 | unit + golden       | `npm test -- test/registers/register-def.test.ts`                                                                                                                      | ❌ W0       | ⬜ pending |
| 01-05-01 | 01-05 | 5    | COD-01                         | T-1-02, T-1-07                         | Mapping-owned ModbusCodec members and datatype-specific words/bits/rejections match Python                            | unit + golden       | `npm test -- test/codec.test.ts test/parity/codec-contract.test.ts -t "primitive\|Float32\|INT8\|INT16"`                                                               | ❌ W0       | ⬜ pending |
| 01-05-02 | 01-05 | 5    | COD-01                         | T-1-02, T-1-07                         | Internal register codec covers Python domains while remaining unmapped/unexported and leaving IdmModbusClient planned | unit + golden       | `npm test -- test/codec.test.ts test/parity/codec-contract.test.ts`                                                                                                    | ❌ W0       | ⬜ pending |
| 01-06-01 | 01-06 | 5    | REG-01                         | T-1-02, T-1-04, T-1-08                 | Mapped CORE_REGISTERS and internal static families preserve all pinned fields without extra mapping rows              | unit + golden       | `npm test -- test/registers/builders.test.ts -t "core\|static\|sentinel\|metadata"`                                                                                    | ❌ W0       | ⬜ pending |
| 01-06-02 | 01-06 | 5    | REG-01                         | T-1-05, T-1-06, T-1-08                 | Mapping-owned builders/registry close the full Python class/member/default/error surface                              | boundary + class    | `npm test -- test/registers/builders.test.ts`                                                                                                                          | ❌ W0       | ⬜ pending |
| 01-06-03 | 01-06 | 5    | REG-01, PAR-01                 | T-1-02, T-1-08                         | Nine mapped public register exports use internal serializers that preserve separate schemas and positive overlaps     | golden contract     | `npm test -- test/registers test/parity/register-schema.test.ts`                                                                                                       | ❌ W0       | ⬜ pending |
| 01-07-01 | 01-07 | 6    | BASE-01, PAR-01, CTR-01        | T-1-01, T-1-02, T-1-06                 | Self-provisioned exact full-tag orchestration verifies before import and cleans all state                             | process integration | `npm test -- test/parity/phase-gate.test.ts -t "orchestrator\|self-provision\|tag\|drift\|cleanup"`                                                                    | ❌ W0       | ⬜ pending |
| 01-07-02 | 01-07 | 6    | BASE-01, PAR-01                | T-1-02, T-1-03, T-1-SC                 | Guaranteed npm generate/check flows work without ambient upstream path and retain private packaging                   | package integration | `npm test -- test/parity/phase-gate.test.ts -t "npm parity\|private\|package" && npm run parity:generate && npm run parity:check`                                      | ❌ W0       | ⬜ pending |
| 01-09-01 | 01-09 | 7    | PAR-01, API-01, API-02         | T-1-01, T-1-02, T-1-03                 | Python facts stay pure; only evidenced rows promote through API-only regeneration/fixture check                       | API state machine   | `npm test -- test/parity/api-parity.test.ts test/semantic/constants-and-types.test.ts test/codec.test.ts test/registers && npm run parity:api && npm run parity:check` | ❌ W0       | ⬜ pending |
| 01-09-02 | 01-09 | 7    | API-01, API-02                 | T-1-02, T-1-03                         | Only post-check complete root rows export; planned/later/web symbols remain absent                                    | API/export contract | `npm test -- test/parity/api-parity.test.ts test/parity/phase-gate.test.ts -t "promotion\|export\|mapping" && npm run build && npm run parity:check`                   | ❌ W0       | ⬜ pending |
| 01-10-01 | 01-10 | 8    | BASE-01, PAR-01, CTR-01        | T-1-01, T-1-06, T-1-SC                 | Node 22/24 plus least-privilege full-tag CI delegates to guaranteed parity:check                                      | workflow contract   | `npm test -- test/parity/baseline.test.ts test/parity/phase-gate.test.ts -t "workflow\|tag\|permissions\|parity:check" && npm run parity:check`                        | ❌ W0       | ⬜ pending |
| 01-10-02 | 01-10 | 8    | PAR-01, API-02, REG-01, COD-01 | T-1-02, T-1-03, T-1-04, T-1-06, T-1-SC | Truthful private/no-hardware docs and complete quality/package/parity/clean-diff gate pass                            | full gate           | `npm test -- test/parity/phase-gate.test.ts -t "README\|CHANGELOG\|private\|hardware\|full gate" && npm run check && npm run parity:check`                             | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠ flaky_

## Threat References

- **T-1-01 — Spoofing:** moved/spoofed/non-exact upstream identity.
- **T-1-02 — Tampering:** stale or altered fixtures, mapping, docs, definitions, or generated evidence.
- **T-1-03 — Repudiation:** parity/status claims without complete provenance and test evidence.
- **T-1-04 — Information disclosure:** secrets, PINs, private IPs, identifiers, or raw captures entering artifacts/logs.
- **T-1-05 — Denial of service:** unbounded manifests/contracts/configurations or duplicate/excessive structures.
- **T-1-06 — Elevation of privilege:** shell/path/import/output/CI-permission abuse.
- **T-1-07 — Tagged numeric/error tampering:** ambiguous exceptional values or permissive rejection normalization.
- **T-1-08 — Protocol tampering:** address/datatype/overlap/model-gate cleanup that changes official register identity.
- **T-1-SC — Supply chain:** npm/pip/action provenance; no npm expansion, exact development dependency, SHA-pinned actions.

## Wave 0 Requirements

Wave 0 means the executor writes the named tests before implementation in each task's RED step. The foundation already has Vitest, V8 coverage, strict TypeScript, ESLint, and formatting; no new test framework is needed.

- [ ] `test/parity/baseline.test.ts` — tasks 01-01-01 and 01-01-02.
- [ ] `test/parity/generator.test.ts` — tasks 01-02-01 through 01-02-03.
- [ ] `test/parity/api-parity.test.ts` — tasks 01-03-01, 01-03-02, 01-09-01, and 01-09-02.
- [ ] `test/semantic/constants-and-types.test.ts` — task 01-04-01.
- [ ] `test/registers/register-def.test.ts` — task 01-04-02.
- [ ] `test/parity/scenario-schema.test.ts` — tasks 01-08-01 and 01-08-02.
- [ ] `test/codec.test.ts` and `test/parity/codec-contract.test.ts` — tasks 01-05-01 and 01-05-02.
- [ ] `test/registers/builders.test.ts` and `test/parity/register-schema.test.ts` — tasks 01-06-01 through 01-06-03.
- [ ] `test/parity/phase-gate.test.ts` — tasks 01-07-01, 01-07-02, 01-09-01, 01-09-02, 01-10-01, and 01-10-02.
- [ ] Six committed fixture families, exact-baseline generator/check scripts, API docs generator, and parity npm entry points.

## Manual-Only Verifications

None. Phase 1 uses no live hardware, device writes, credentials, browser UI, or human-only external step. GitHub Actions execution confirms the Node/Python matrix after local commands pass, but every acceptance claim also has a deterministic local test.

## Nyquist Sign-Off

- [x] Every implementation task has a focused `<automated>` verification command.
- [x] Test-first Wave 0 coverage exists for every production-code task.
- [x] No three consecutive tasks can complete without focused automated feedback.
- [x] No watch-mode command appears in validation.
- [x] Focused commands target under 60 seconds; full parity is reserved for plan/wave closure.
- [x] Every Phase-1 requirement has at least one focused test and the final full gate.
- [x] Every STRIDE threat has a disposition and linked secure behavior.
- [x] Verify-before-import, no-secret/no-device, fixed-path/no-shell, atomic-write, and non-mutating-check controls are tested.
- [x] `nyquist_compliant: true` is set because the complete executable validation plan now exists.
- [ ] `wave_0_complete: true` remains false until executors create and run all named tests.

**Approval:** planned and Nyquist-compliant; execution evidence pending.
