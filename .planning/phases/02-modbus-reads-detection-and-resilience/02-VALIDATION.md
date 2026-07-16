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

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 plus the isolated Python 3.12 parity orchestrator |
| **Config file** | `vitest.config.ts`, `tsconfig.json`, `scripts/run-parity.mjs` |
| **Quick run command** | `npm run test:unit -- --runInBand` or the focused Vitest file named by the task |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | Focused tests under 30 seconds; full parity/check may take several minutes |

---

## Sampling Rate

- **After every task commit:** Run the focused Vitest file plus `npm run typecheck`.
- **After every plan wave:** Run `npm run lint`, `npm run format:check`, the
  relevant parity contract, and all Phase-2 focused tests.
- **Before `$gsd-verify-work`:** `npm run check`, `npm run parity:check`, build,
  package smoke tests, and the Phase-2 scenario suite must be green.
- **Max feedback latency:** 30 seconds for ordinary focused tests; slow isolated
  Python provisioning is reserved for parity gates and phase closure.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | TRN-01, TRN-03 | T-02-01, T-02-06 | Closed bounded scenario schema; synthetic endpoints only | contract | `npx vitest run test/contracts test/parity/transport-contract.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | TRN-01, TRN-02 | T-02-02 | Fake transport proves one active operation and stable traces | unit | `npx vitest run test/support test/client/lifecycle.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | ERR-01, DET-02 | T-02-03, T-02-04 | Numeric Code 2 classification and host-redacted immutable errors | unit | `npx vitest run test/client/errors.test.ts test/client/diagnostics.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | TRN-01, TRN-02, ERR-01 | T-02-01, T-02-02 | Bounded retries, exact delays, reconnect, and FIFO serialization | unit | `npx vitest run test/client/lifecycle.test.ts test/client/resilience.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 3 | TRN-02, TRN-03, ERR-01 | T-02-02, T-02-05 | Exact FC03/FC04 requests; no gap/type/overlap merging | unit/contract | `npx vitest run test/client/reads.test.ts test/client/batching.test.ts test/parity/transport-contract.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-02 | 04 | 3 | TRN-02, DET-02, ERR-01 | T-02-05 | Device fallback only; exact permanent and quarantine state | unit/contract | `npx vitest run test/client/batching.test.ts test/client/resilience.test.ts test/parity/transport-contract.test.ts` | ❌ W0 | ⬜ pending |
| 02-05-01 | 05 | 4 | DET-01, DET-02 | T-02-02, T-02-05 | Ordered bounded probes; unsupported Navigator 1.x remains absent | unit/contract | `npx vitest run test/client/detection.test.ts test/parity/transport-contract.test.ts` | ❌ W0 | ⬜ pending |
| 02-06-01 | 06 | 5 | TRN-01, TRN-03, ERR-01 | T-02-03, T-02-04 | Adapter types/errors stay hidden; numeric exceptions and timeouts normalized | unit | `npx vitest run test/transport/modbus-serial-adapter.test.ts` | ❌ W0 | ⬜ pending |
| 02-06-02 | 06 | 5 | TRN-01, TRN-02, DET-01, DET-02 | T-02-01 through T-02-06 | Public promotion remains private and machine-checked until Phase 3 closes writes | integration | `npm run check && npm run parity:check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Threat Model

| Ref | Threat | Required mitigation and evidence |
|-----|--------|----------------------------------|
| T-02-01 | Unbounded configuration or retry loops cause denial of service | Validate constructor bounds; client owns finite attempts and exact backoff tests |
| T-02-02 | Concurrent lifecycle/read calls race transport and client state | One FIFO client mutex covers the complete operation and releases after failure |
| T-02-03 | Forged/localized error text is mistaken for Illegal Address | Only numeric Modbus exception code `2` maps to `IllegalAddressError` |
| T-02-04 | Raw socket errors disclose host/IP or adapter internals | Normalize at adapter boundary and assert sanitized diagnostics |
| T-02-05 | Malformed/short responses or unsafe batch merging corrupt values | Exact count and 16-bit validation before decode; adjacency/type/span/overlap tests |
| T-02-06 | Oversized or ambient parity fixtures consume resources or leak device data | Closed bounded parser, isolated pinned Python checkout, synthetic example endpoints |

---

## Wave 0 Requirements

- [ ] `test/support/fake-modbus-transport.ts` — scripted lifecycle, response,
  exact request trace, and concurrency instrumentation.
- [ ] `test/support/fake-clock.ts` — deterministic monotonic clock and recorded
  delay sequence without wall-clock sleeps.
- [ ] `test/parity/transport-contract.test.ts` — TypeScript execution of pinned
  Python-generated runtime scenarios.
- [ ] Versioned transport behavior fixture and strict parser — request/result,
  error, timing, state, and detection envelopes.
- [ ] Focused client test files for lifecycle, errors, diagnostics, reads,
  batching, resilience, and detection.
- [ ] Mocked adapter test harness for `modbus-serial`; no live TCP or hardware.

---

## Manual-Only Verifications

All Phase-2 software parity behaviors have automated verification. Live hardware
reads are intentionally excluded; they are required only if changing an official
protocol fact or claiming hardware validation during release closure.

---

## Validation Sign-Off

- [x] All anticipated tasks have an automated command or a Wave 0 dependency.
- [x] Sampling continuity: no three consecutive tasks lack automated verification.
- [x] Wave 0 lists every currently missing test/support artifact.
- [x] No watch-mode flags.
- [x] Focused feedback latency target is below 30 seconds.
- [x] `nyquist_compliant: true` is set in frontmatter.

**Approval:** approved 2026-07-16 for planning; task IDs may be reconciled to the
final verified plan set without weakening the listed coverage or threats.
