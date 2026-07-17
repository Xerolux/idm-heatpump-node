---
phase: 02
slug: modbus-reads-detection-and-resilience
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-17
---

# Phase 02 — Security

> Per-phase security contract for Modbus reads, detection, resilience, parity
> evidence, and the packaged runtime boundary.

---

## Trust Boundaries

| Boundary                              | Description                                                                                                         | Data Crossing                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Consumer configuration → client       | Host and retry/group settings come from trusted local application configuration.                                    | Endpoint and availability policy     |
| Modbus TCP → transport/client         | Device responses and failures are untrusted and must retain exact request identity and closed error classification. | 16-bit words and bounded diagnostics |
| Python reference → generated evidence | Pinned upstream execution must remain isolated, synthetic, exact, and transactional.                                | Public API and behavioral fixtures   |
| Package tooling → child processes     | npm, TypeScript, and consumer smoke processes must have bounded output and execution time.                          | Build and package artifacts          |
| Internal modules → package consumer   | Test injection, raw provider errors, and adapter implementation details must not cross public exports.              | Declarations and runtime exports     |

---

## Threat Register

| Threat ID | Category               | Component                                              | Disposition       | Mitigation                                                                                                                                                                                                                                                | Status |
| --------- | ---------------------- | ------------------------------------------------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-02-01   | Denial of service      | parsers, retries, grouping, detection, child processes | mitigate / accept | Scenario and protocol requests are bounded; detection and fallback loops are finite; every package-check child uses a 120-second timeout and bounded output. The upstream-identical trusted local retry/group configuration risk is accepted as R-02-01A. | closed |
| T-02-02   | Tampering / race       | public snapshots, FIFO, lifecycle, adapter timeout     | mitigate          | Owned immutable values, whole-operation FIFO serialization, rejection recovery, and `finally`-based timeout restoration are covered by hostile-cast and concurrency tests.                                                                                | closed |
| T-02-03   | Spoofing               | illegal-address classification                         | mitigate          | Only numeric Modbus exception Code 2 or the structured internal marker selects illegal-address behavior; message-only forgeries cannot.                                                                                                                   | closed |
| T-02-04   | Information disclosure | fixtures, errors, diagnostics, declarations, tarball   | mitigate          | Synthetic evidence, exact endpoint redaction, 1024-character diagnostic bound, no raw cause/payload, explicit exports, and a 15-file tarball allowlist.                                                                                                   | closed |
| T-02-05   | Tampering              | request identity, grouping, decoding, detection        | mitigate          | Closed FC/type/unit/address/count/word validation, exact adjacency and overlap preservation, fixed probe tables, and exact model decoding.                                                                                                                | closed |
| T-02-06   | Tampering              | parity authority, generated artifacts, release gates   | mitigate          | Exact 89-row mapping, closed partial-member partition, transactional nine-artifact generation, and fail-closed private release state.                                                                                                                     | closed |
| T-02-SC   | Supply-chain tampering | `modbus-serial` and package graph                      | mitigate          | Sole exact runtime dependency `modbus-serial@8.0.25`, lock integrity, no install script, exact tarball surface, and zero production audit findings.                                                                                                       | closed |

_Status: open · closed_  
_Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)_

---

## Accepted Risks Log

| Risk ID  | Threat Ref | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                            | Accepted By                    | Date       |
| -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | ---------- |
| R-02-01A | T-02-01    | Pinned Python `idm-heatpump-api` 0.7.6 accepts every local `max_retries` and `max_group_size` integer ≥ 1 and applies `max(1, int(value))` to per-operation retry overrides without an upper cap. A Node-only cap would violate the project's mandatory functional-parity rule. These values are trusted local consumer configuration, not network-controlled input; protocol requests remain independently capped at 125 registers. | Project owner parity directive | 2026-07-17 |

Accepted risks do not resurface in future audit runs unless the upstream
contract or trust boundary changes.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By                                                  |
| ---------- | ------------- | ------ | ---- | ------------------------------------------------------- |
| 2026-07-17 | 7             | 6      | 1    | GSD security auditor — initial audit                    |
| 2026-07-17 | 7             | 7      | 0    | GSD security auditor — independent remediation re-audit |

---

## Verification Evidence

- 155 focused security/protocol tests passed during the initial audit.
- The package child-process boundary has an executable success test, a real
  timeout termination test, and an invalid-timeout mutation test.
- Focused lifecycle and phase-gate verification passed with 34 tests and one
  intentional Windows symlink skip.
- Strict TypeScript, ESLint, the exact 15-file package smoke, and the pinned
  Python `0.7.6` parity check passed after remediation.
- `npm audit --omit=dev` reports zero vulnerabilities.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-17
