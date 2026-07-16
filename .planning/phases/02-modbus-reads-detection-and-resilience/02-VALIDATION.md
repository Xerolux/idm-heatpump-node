---
phase: 02
slug: modbus-reads-detection-and-resilience
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-16
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for exact Python `idm-heatpump-api` v0.7.6
> transport, detection, resilience, request-trace, and state parity.

---

## Test Infrastructure

| Property               | Value                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| **Framework**          | Vitest 4.1.10 plus the isolated Python 3.12 parity orchestrator                           |
| **Config file**        | `vitest.config.ts`, `tsconfig.json`, `scripts/run-parity.mjs`                             |
| **Quick run command**  | `npm test -- test/parity/api-parity.test.ts` or the focused Vitest file named by the task |
| **Full suite command** | `npm run check`                                                                           |
| **Estimated runtime**  | Focused tests under 30 seconds; full parity/check may take several minutes                |

---

## Sampling Rate

- **After every task commit:** Run the task's focused Vitest command plus
  `npm run typecheck`.
- **After every plan wave:** Run `npm run lint`, `npm run format:check`, the
  relevant parity contract, and all implemented Phase-2 focused tests.
- **Before `$gsd-verify-work`:** Run `npm run check`, `npm run parity:check`,
  `npm audit --omit=dev`, build/package smoke, and the complete Phase-2
  scenario suite.
- **Max feedback latency:** 30 seconds for ordinary focused tests; slow isolated
  Python provisioning is reserved for parity gates and phase closure.

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement                                      | Threat Ref                         | Secure Behavior                                                            | Test Type         | Automated Command                                                                                                                                                                      | File Exists | Status     |
| -------- | ---- | ---- | ------------------------------------------------ | ---------------------------------- | -------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 02-01-01 | 01   | 1    | TRN-01, TRN-03R                                  | T-02-06                            | Exact 89-row authority plus closed additive/partial governance             | contract          | `npm test -- test/parity/api-parity.test.ts -t "extension\|partial\|89\|release" && npm run parity:api`                                                                                | ✅/❌ W0    | ⬜ pending |
| 02-01-02 | 01   | 1    | TRN-01, ERR-01R                                  | T-02-03, T-02-04                   | Public-constructor closure and symmetric closed error projection           | contract          | `npm test -- test/parity/api-parity.test.ts -t "constructor\|normalization\|error\|redaction"`                                                                                         | ✅          | ⬜ pending |
| 02-02-01 | 02   | 2    | TRN-01, TRN-03R                                  | T-02-01, T-02-02, T-02-05          | Exact transport contract plus deterministic fake trace/concurrency/time    | unit/contract     | `npm test -- test/parity/transport-contract.test.ts -t "transport\|fake\|clock\|concurrency"`                                                                                          | ❌ W0       | ⬜ pending |
| 02-02-02 | 02   | 2    | TRN-03R, DET-02, ERR-01R                         | T-02-01, T-02-04                   | Separate bounded immutable parser with closed normalized errors            | contract          | `npm test -- test/parity/transport-contract.test.ts -t "schema\|parser\|bounds\|immutable\|redaction"`                                                                                 | ❌ W0       | ⬜ pending |
| 02-03-01 | 03   | 3    | TRN-01, TRN-03R, DET-01, DET-02, ERR-01R         | T-02-03, T-02-04, T-02-06          | Seventh exact pinned synthetic fixture with symmetric normalization        | contract          | `npm test -- test/parity/generator.test.ts test/parity/transport-contract.test.ts -t "transport\|seven\|fixture\|normalization\|deterministic"`                                        | ✅/❌ W0    | ⬜ pending |
| 02-03-02 | 03   | 3    | TRN-01, TRN-03R                                  | T-02-06                            | Seven fixtures plus two documents staged as nine artifacts transactionally | contract          | `npm test -- test/parity/generator.test.ts test/parity/transport-contract.test.ts -t "nine\|allowlist\|check mode\|rollback\|inventory" && npm run parity:check`                       | ✅/❌ W0    | ⬜ pending |
| 02-04-01 | 04   | 2    | TRN-01, ERR-01R                                  | T-02-03, T-02-04                   | Numeric Code 2 only; no additive Error code; exact WARN/FATAL aliases      | unit              | `npm test -- test/client/errors.test.ts`                                                                                                                                               | ❌ W0       | ⬜ pending |
| 02-04-02 | 04   | 2    | DET-02, ERR-01R                                  | T-02-02, T-02-04                   | Exact immutable dataclass fields/defaults with caller-order preservation   | unit              | `npm test -- test/client/diagnostics.test.ts -t "factory\|order\|default\|immutable\|keys"`                                                                                            | ❌ W0       | ⬜ pending |
| 02-05-01 | 05   | 3    | TRN-01, TRN-02                                   | T-02-01, T-02-02                   | Exact public constructor, internal injection only, FIFO lifecycle          | unit              | `npm test -- test/client/lifecycle.test.ts`                                                                                                                                            | ❌ W0       | ⬜ pending |
| 02-05-02 | 05   | 3    | TRN-02, ERR-01R                                  | T-02-01 through T-02-04            | Exact attempts/delays/reconnect/Code2/probe/context                        | unit              | `npm test -- test/client/lifecycle.test.ts test/client/resilience.test.ts`                                                                                                             | ❌ W0       | ⬜ pending |
| 02-06-01 | 06   | 4    | TRN-02, TRN-03R, ERR-01R                         | T-02-02, T-02-05                   | Exact FC03/FC04 and no gap/type/span/overlap merge                         | unit              | `npm test -- test/client/reads.test.ts test/client/batching.test.ts -t "single\|group\|FC03\|FC04\|overlap\|1392\|1442\|1484"`                                                         | ❌ W0       | ⬜ pending |
| 02-06-02 | 06   | 4    | TRN-02, DET-02, ERR-01R                          | T-02-02, T-02-03, T-02-05          | Device-only fallback and exact permanent/unsupported/quarantine state      | unit              | `npm test -- test/client/batching.test.ts test/client/resilience.test.ts -t "fallback\|unsupported\|permanent\|quarantine\|suspect\|reset\|transport"`                                 | ❌ W0       | ⬜ pending |
| 02-06-03 | 06   | 4    | TRN-02, TRN-03R, DET-02, ERR-01R                 | T-02-01 through T-02-06            | Closed executable Python-vs-TypeScript read/resilience scenarios           | contract          | `npm test -- test/parity/transport-contract.test.ts test/client/reads.test.ts test/client/batching.test.ts test/client/resilience.test.ts`                                             | ❌ W0       | ⬜ pending |
| 02-07-01 | 07   | 5    | DET-01, DET-02                                   | T-02-01, T-02-02, T-02-05          | Ordered bounded probes and exact sentinel/model/map rules                  | unit              | `npm test -- test/client/detection.test.ts`                                                                                                                                            | ❌ W0       | ⬜ pending |
| 02-07-02 | 07   | 5    | TRN-02, DET-01, DET-02, ERR-01R                  | T-02-02, T-02-04, T-02-05          | Client-only sorting, exact diagnostics/reset, executable detection state   | unit/contract     | `npm test -- test/client/detection.test.ts test/client/diagnostics.test.ts test/parity/transport-contract.test.ts -t "detect\|diagnostic\|model\|reset\|state\|sort"`                  | ❌ W0       | ⬜ pending |
| 02-08-01 | 08   | 6    | TRN-01                                           | T-02-SC                            | Re-audited exact dependency and RED no-network adapter contract            | supply-chain/unit | `npm test -- test/transport/modbus-serial-adapter.test.ts && npm ls modbus-serial --depth=0`                                                                                           | ❌ W0       | ⬜ pending |
| 02-08-02 | 08   | 6    | TRN-01, TRN-02, TRN-03R, ERR-01R                 | T-02-02 through T-02-05, T-02-SC   | Hidden adapter, timeout restore, exact reads, internal default wiring      | unit              | `npm test -- test/transport/modbus-serial-adapter.test.ts test/client/lifecycle.test.ts test/client/resilience.test.ts && npm ls modbus-serial --depth=0`                              | ❌ W0       | ⬜ pending |
| 02-09-01 | 09   | 7    | TRN-01, TRN-02, TRN-03R, DET-01, DET-02, ERR-01R | T-02-03, T-02-06                   | Exact complete/partial/additive status and 22/7 member closure             | integration       | `npm test -- test/parity/api-parity.test.ts test/client test/transport/modbus-serial-adapter.test.ts && npm run parity:api`                                                            | ✅/❌ W0    | ⬜ pending |
| 02-09-02 | 09   | 7    | TRN-01, TRN-02, TRN-03R, DET-01, DET-02, ERR-01R | T-02-04, T-02-06                   | Exact root/declaration exports with no adapter/injection/write leakage     | integration       | `npm test -- test/parity/api-parity.test.ts -t "root\|export\|declaration\|constructor\|member" && npm run parity:check && npm run build`                                              | ✅          | ⬜ pending |
| 02-10-01 | 10   | 8    | TRN-01, TRN-02                                   | T-02-04, T-02-SC                   | Clean tarball ESM/CJS/type/client/transport smoke without network          | integration       | `npm test -- test/parity/phase-gate.test.ts -t "package\|tarball\|ESM\|CommonJS\|declaration" && npm run pack:check`                                                                   | ✅          | ⬜ pending |
| 02-10-02 | 10   | 8    | TRN-01, TRN-02, TRN-03R, DET-01, DET-02, ERR-01R | T-02-01, T-02-04, T-02-06, T-02-SC | Full private phase gate; umbrella and write clauses remain pending         | integration       | `npm test -- test/client test/transport test/parity/transport-contract.test.ts test/parity/api-parity.test.ts test/parity/phase-gate.test.ts && npm run check && npm run parity:check` | ✅          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Threat Model

| Ref     | Threat                                                                          | Required mitigation and evidence                                                     |
| ------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| T-02-01 | Unbounded configuration, parsing, retry, or probe loops cause denial of service | Explicit bounds, finite scripts/attempts, fixed detection limits, focused tests      |
| T-02-02 | Concurrent lifecycle/read calls race transport or state                         | One FIFO complete-operation gate and max-active/release-after-error tests            |
| T-02-03 | Forged error text is mistaken for Illegal Address                               | Numeric Code 2 only and symmetric closed error-kind projection                       |
| T-02-04 | Raw socket errors or artifacts disclose endpoint/device information             | Exact endpoint redaction, bounded diagnostics, synthetic fixtures, tarball allowlist |
| T-02-05 | Malformed responses or unsafe batches corrupt values                            | Exact word/count validation and adjacency/type/span/overlap tests                    |
| T-02-06 | API/artifact/requirement drift weakens parity or closes wrong clauses           | Exact authorities, transactional nine-artifact pipeline, child-clause phase gate     |
| T-02-SC | Runtime dependency is replaced or compromised                                   | Exact metadata/source recheck, lock integrity, no install script, npm audit          |

---

## Wave 0 Requirements

- [ ] `contracts/typescript-extensions.json` and governance mutation coverage.
- [ ] `src/transport/types.ts`, `test/support/fake-modbus-transport.ts`, and
      `test/support/fake-clock.ts`.
- [ ] `src/contracts/transport-scenario.ts` and
      `test/parity/transport-contract.test.ts`.
- [ ] `test/fixtures/transport-behavior.json` as the seventh fixture.
- [ ] Focused client tests for errors, diagnostics, lifecycle, resilience,
      reads, batching, and detection.
- [ ] Mocked `modbus-serial` adapter harness; no live TCP or hardware.
- [ ] Clause-aware phase-gate assertions for TRN-03R/TRN-03W and
      ERR-01R/ERR-01W.

---

## Manual-Only Verifications

All Phase-2 software parity behavior has automated verification. Live hardware
reads are intentionally excluded; hardware evidence is required only for a new
protocol fact or a later truthful release-validation claim.

---

## Validation Sign-Off

- [x] All 21 tasks have an automated command or Wave-0 dependency.
- [x] Sampling continuity: no three consecutive tasks lack automated verification.
- [x] Wave 0 lists every currently missing test/support artifact.
- [x] Commands use existing npm scripts and no watch-mode flags.
- [x] Focused feedback latency target is below 30 seconds.
- [x] `nyquist_compliant: true` is set in frontmatter.

**Approval:** revised 2026-07-16 for the 10-plan, 8-wave, 21-task plan set.
