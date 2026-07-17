---
phase: 03
slug: safe-write-parity
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-17
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for exact Python `idm-heatpump-api` v0.7.6
> write planning, safety state, FC16 transport, and generated parity.

---

## Test Infrastructure

| Property               | Value                                                                      |
| ---------------------- | -------------------------------------------------------------------------- |
| **Framework**          | Vitest 4.1.10 plus the isolated Python 3.12 parity orchestrator            |
| **Config file**        | `vitest.config.ts`, `tsconfig.json`, `scripts/run-parity.mjs`              |
| **Quick run command**  | `npm test -- <focused-write-test-files>`                                   |
| **Full suite command** | `npm run check && npm run parity:check && npm audit --omit=dev`            |
| **Estimated runtime**  | Focused tests under 30 seconds; full parity/check may take several minutes |

---

## Sampling Rate

- **After every task commit:** Run the task's focused Vitest command plus
  `npm run typecheck`.
- **After every plan wave:** Run all implemented Phase-3 tests, `npm run lint`,
  `npm run format:check`, and the applicable parity contract.
- **Before `$gsd-verify-work`:** Run `npm run check`, `npm run parity:check`,
  `npm audit --omit=dev`, package smoke, and the complete generated write
  scenario suite.
- **Max feedback latency:** 30 seconds for ordinary focused tests; isolated
  Python generation is reserved for parity and phase gates.

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement                      | Threat Ref                       | Secure Behavior                                                                           | Test Type         | Automated Command                                                                                                                        | File Exists | Status        |
| -------- | ---- | ---- | -------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------- |
| 03-01-01 | 01   | 1    | WRT-01, TRN-03W, ERR-01W         | T-03-02, T-03-04, T-03-06        | Frozen bounded FC16 request and operation-aware closed write errors                       | unit              | `npm test -- test/transport/write-request.test.ts test/client/errors.test.ts`                                                            | ❌ W0       | ⬜ pending    |
| 03-01-02 | 01   | 1    | TRN-03W                          | T-03-04, T-03-07                 | Fake transport records exact immutable writes without network access                      | unit              | `npm test -- test/transport/write-request.test.ts -t "fake\\                                                                             | FC16\\      | word\\        | count"`       | ❌ W0         | ⬜ pending |
| 03-02-01 | 02   | 2    | WRT-01, WRT-02, CTR-01           | T-03-01, T-03-05, T-03-08        | Closed bounded write-scenario parser and exact pinned Python authority                    | contract          | `npm test -- test/parity/write-contract.test.ts test/parity/generator.test.ts -t "schema\\                                               | parser\\    | bound\\       | write"`       | ❌ W0         | ⬜ pending |
| 03-02-02 | 02   | 2    | WRT-01, WRT-02, TRN-03W, CTR-01  | T-03-05, T-03-08                 | Eighth fixture is generated transactionally while all prior fixture bytes remain governed | contract          | `npm run parity:generate && npm run parity:check && npm test -- test/parity/generator.test.ts -t "write\\                                | ten\\       | rollback\\    | fixed point"` | ❌ W0         | ⬜ pending |
| 03-03-01 | 03   | 3    | WRT-01, WRT-02                   | T-03-01, T-03-02, T-03-03        | Immutable plan plus exact lookup, validation order, custom bypass, and codec use          | unit/contract     | `npm test -- test/client/write-validation.test.ts`                                                                                       | ❌ W0       | ⬜ pending    |
| 03-03-02 | 03   | 3    | WRT-02                           | T-03-03, T-03-04                 | Exact EEPROM/cyclic boundaries, resets, projections, and no premature mutation            | unit              | `npm test -- test/client/write-state.test.ts`                                                                                            | ❌ W0       | ⬜ pending    |
| 03-04-01 | 04   | 4    | WRT-01, WRT-02, TRN-03W          | T-03-03, T-03-04, T-03-06        | Seven methods execute inside one FIFO and commit safety state only after ack              | unit              | `npm test -- test/client/write-execution.test.ts test/client/write-state.test.ts`                                                        | ❌ W0       | ⬜ pending    |
| 03-04-02 | 04   | 4    | TRN-03W, ERR-01W                 | T-03-03, T-03-04, T-03-06        | Exact retry/reconnect/backoff, Code-2 separation, rollback, and redacted context          | unit              | `npm test -- test/client/write-execution.test.ts test/client/resilience.test.ts -t "write\\                                              | retry\\     | Code 2\\      | rollback\\    | FIFO\\        | redact"`   | ❌ W0      | ⬜ pending |
| 03-05-01 | 05   | 5    | TRN-03W, ERR-01W                 | T-03-04, T-03-06, T-03-07        | Provider maps every write to FC16 and accepts only the exact echoed address/count         | unit              | `npm test -- test/transport/modbus-serial-adapter.test.ts -t "write\\                                                                    | FC16\\      | ack"`         | ✅/❌ W0      | ⬜ pending    |
| 03-05-02 | 05   | 5    | TRN-03W, ERR-01W                 | T-03-04, T-03-06                 | Malformed ack and provider failures never commit state or create read unsupported state   | unit              | `npm test -- test/transport/modbus-serial-adapter.test.ts test/client/write-execution.test.ts -t "malformed\\                            | Code 2\\    | unsupported\\ | state"`       | ✅/❌ W0      | ⬜ pending |
| 03-06-01 | 06   | 6    | WRT-01, WRT-02, TRN-03W, ERR-01W | T-03-01 through T-03-08          | Every generated Python scenario is consumed once with exact result/request/state          | contract          | `npm test -- test/parity/write-contract.test.ts && npm run parity:check`                                                                 | ❌ W0       | ⬜ pending    |
| 03-06-02 | 06   | 6    | ERR-01W, CTR-01                  | T-03-05, T-03-06, T-03-08        | Mutation, secrecy, bounds, rollback, and fixed-point evidence fail closed                 | security/contract | `npm test -- test/parity/write-contract.test.ts test/parity/generator.test.ts -t "mutation\\                                             | redact\\    | leak\\        | rollback\\    | fixed point"` | ❌ W0      | ⬜ pending |
| 03-07-01 | 07   | 7    | WRT-01, WRT-02, PAR-01           | T-03-05, T-03-08                 | Exact write exports/mappings/declarations/package smoke are promoted only after evidence  | integration       | `npm test -- test/parity/api-parity.test.ts test/parity/phase-gate.test.ts && npm run parity:api && npm run build && npm run pack:check` | ✅/❌ W0    | ⬜ pending    |
| 03-07-02 | 07   | 7    | WRT-01, WRT-02, TRN-03W, ERR-01W | T-03-01 through T-03-08, T-03-SC | Full private phase gate passes while Phase-4/5 release mode remains fail closed           | integration       | `npm run check && npm run parity:check && npm audit --omit=dev && ! node scripts/generate-api-parity.mjs --release`                      | ✅/❌ W0    | ⬜ pending    |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Threat Model

| Ref     | Threat                                                                      | Required mitigation and evidence                                                             |
| ------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| T-03-01 | Custom input or JavaScript coercion bypasses write validation               | Membership-only bypass and exact ordered type/domain/codec tests                             |
| T-03-02 | Wrong function code, address, count, or word order changes device state     | Frozen FC16 factory and exact one-/two-word request vectors                                  |
| T-03-03 | Races or early mutation bypass EEPROM/cyclic safety                         | Whole-operation FIFO and success-only commit with rollback/concurrency tests                 |
| T-03-04 | Retry, Code-2, or malformed acknowledgement produces false success          | Operation-aware normalization, bounded retry, exact echo validation, state snapshots         |
| T-03-05 | Handwritten or partial evidence falsely claims Python parity                | Exact tag/SHA generation, closed scenario IDs, transactional fixed-point checks              |
| T-03-06 | Errors disclose requested values, encoded words, raw causes, or endpoints   | Immutable closed redacted context plus recursive leak and packed-artifact scans              |
| T-03-07 | Provider retry multiplication or live TCP causes unintended physical writes | Adapter retries disabled, provider fully mocked, no live controller or network in tests      |
| T-03-08 | Premature API/release promotion hides remaining web/release gaps            | Clause-aware mappings; keep package private and release command fail closed                  |
| T-03-SC | Runtime dependency changes or becomes vulnerable                            | Exact `modbus-serial` pin/lock audit, `npm ls`, `npm audit`, and no added runtime dependency |

---

## Wave 0 Requirements

- [ ] `test/transport/write-request.test.ts` and fake FC16 transport events.
- [ ] `src/contracts/write-scenario.ts` with bounded closed parsing.
- [ ] `test/parity/write-contract.test.ts` and generated
      `test/fixtures/write-behavior.json`.
- [ ] `test/client/write-validation.test.ts`,
      `test/client/write-state.test.ts`, and
      `test/client/write-execution.test.ts`.
- [ ] Mocked provider write acknowledgements/errors in
      `test/transport/modbus-serial-adapter.test.ts`.
- [ ] Generator rollback, old-artifact byte preservation, mapping-count, and
      release-fail-closed assertions.

---

## Manual-Only Verifications

All Phase-3 package behavior has automated verification. Live controller
writes are explicitly excluded: no physical write, real TCP connection, or
hardware-validation claim is authorized.

---

## Validation Sign-Off

- [x] All 14 tasks have an automated command or Wave-0 dependency.
- [x] Sampling continuity: no three consecutive tasks lack automated verification.
- [x] Wave 0 lists every currently missing test/support artifact.
- [x] Commands use existing npm scripts and no watch-mode flags.
- [x] Focused feedback latency target is below 30 seconds.
- [x] `nyquist_compliant: true` is set in frontmatter.

**Approval:** approved 2026-07-17 for the seven-plan validation architecture;
the planner must update task IDs if decomposition changes.
