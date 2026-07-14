# Requirements: IDM Heatpump Node

**Defined:** 2026-07-14
**Core Value:** Complete semantic and behavioral parity with the latest stable pinned `Xerolux/idm-heatpump-api` release, proven by cross-repository contracts and all release gates.

## v1 Requirements

Requirements for the initial `0.1.0` release. The existing package/tooling foundation remains a binding release invariant and is re-verified in Phase 5 rather than rebuilt as a setup phase.

### Package and Runtime Contract

- [ ] **PKG-01**: Consumers can run the package on Node.js without Python or the Python package at runtime; Python is used only for development and CI reference generation, and npm publication remains disabled until full parity.
- [ ] **PKG-02**: Maintainers can locate public exports, constants, types, errors, codecs, register families, transport adapters, client behavior, optional web behavior, fixtures, parity tests, scripts, examples, and documentation in their dedicated package boundaries.
- [ ] **PKG-03**: Consumers can use a strict-TypeScript-derived package on Node.js 22 or newer through primary ESM output and, when offered, separately tested CommonJS output generated from the same source; CI covers Node.js 22 and 24.
- [ ] **PKG-04**: Consumers can opt into read-only web capabilities only through `@xerolux/idm-heatpump/web`; the package makes no browser-support claim and includes no telemetry.
- [ ] **PKG-05**: Consumers can install the controlled npm tarball in a clean project and use every declared ESM and CommonJS export with declarations and source maps, while development-only files remain excluded and build, lint, format, Vitest, and CI checks stay reproducible.

### Parity Contract and Semantic Core

- [x] **PAR-01**: Maintainers can generate and verify `UPSTREAM-PARITY.json`, the public export inventory, `docs/API-PARITY.md`, codec vectors, and normalized golden register schemas for every relevant model/feature combination; TypeScript types, codecs, and all register builders match those contracts, including documented overlaps.
- [x] **BASE-01**: Every parity run uses an authoritative checked baseline containing repository URL, Python package version, fixed tag, full commit SHA, and parity-schema version, and rejects branch-only or mismatched references.
- [ ] **API-01**: Every public Python export has a documented, semantically equivalent TypeScript counterpart with equivalent defaults and validation; only the parity contract's explicit language normalizations are accepted.
- [ ] **API-02**: `docs/API-PARITY.md` is generated from or validated against the public Python API and records each Python symbol, TypeScript counterpart, development status, and contract test; release permits only complete or explicitly reviewed legitimate `not_applicable` entries.
- [ ] **REG-01**: For every supported model and feature combination, normalized Python and TypeScript register schemas agree on all contract fields, preserve official logical overlaps, and introduce no substantive difference.
- [ ] **COD-01**: Identical raw registers decode to identical domain values and identical writable values encode to identical 16-bit words, including low-word-first Float32, NaN, Infinity, integer boundaries, signs, and multipliers.
- [x] **CTR-01**: Cross-repository CI checks out the pinned Python reference and produces language-neutral JSON scenarios containing at least `name`, `configuration`, `transport_responses`, `clock`, `operation`, `expected_result`, `expected_requests`, and `expected_state`, with only contract-approved normalization.
- [ ] **CTR-02**: Cross-repository verification complements static fixtures with executable behavioral scenarios for retry, batch fallback, EEPROM throttling, and cyclic TTL, comparing observable results, requests, state, and controlled time.

### Modbus Reads, Detection, and Resilience

- [ ] **TRN-01**: Domain logic uses a `ModbusTransport` abstraction whose first real adapter encapsulates `modbus-serial`; deterministic tests can replace it with a fake transport and controlled clock without adapter details leaking into domain behavior.
- [ ] **TRN-02**: Consumers can connect, disconnect, reconnect, retry with backoff, serialize requests, perform single and safe batch reads, recover through fallback, and observe Illegal Address, permanent-error, and batch-unsafe quarantine behavior matching Python request traces and outcomes.
- [ ] **TRN-03**: Identical selections emit the same ordered Modbus read/write function, address, count, and payload semantics as Python; batching combines only exactly adjacent, non-overlapping ranges of one register type, and overlapping `1392/count=2` and `1393/count=1` remain distinct requests.
- [ ] **DET-01**: Consumers receive Python-equivalent Navigator 2.0, Navigator Pro, Navigator 10, firmware, heating-circuit, zone-module, solar, ISC, PV, cascade, sentinel, unavailable-slot, model-gate, and capability-derived register-map results, while Navigator 1.0/1.7 remains unsupported.
- [ ] **DET-02**: Identical probe responses produce Python-equivalent detected capabilities, unsupported registers, batch-unsafe registers, permanently failed registers, connection-suspect state, and diagnostics.
- [ ] **ERR-01**: Consumers observe language-neutral, Python-equivalent outcomes for timeouts, disconnects, short or invalid responses, Modbus Exception Code 2, repeated transient failures, batch-read errors, write errors, reconnect, and retry exhaustion.

### Write Safety

- [ ] **WRT-01**: Consumers can first plan or dry-run writes, then perform real single- and multi-register writes only after equivalent type, range, enum, excluded-value, and model-membership validation; custom registers do not weaken remaining protections, and fake-clock tests govern EEPROM throttling and cyclic TTL.
- [ ] **WRT-02**: Given the same state and value, Python and TypeScript accept or reject a write for the same domain reason and, when accepted, produce the same target, function, and words; dry-run sends no traffic, controlled-time EEPROM/cyclic behavior matches, and failed writes never create successful state.

### Optional Web Supplement

- [ ] **WEB-01**: Consumers can optionally use read-only Navigator 10 WebSocket and Navigator 2.0 HTTP access with authentication and CSRF, parsers, cache, notifications, statistics, capabilities, diagnostics, error hierarchy, factories, and PIN checking; a missing PIN preserves Modbus-only operation.
- [ ] **WEB-02**: Equivalent Python and TypeScript Navigator 10 and Navigator 2.0 responses yield equivalent normalized data, values, units, notifications, statistics, capabilities, diagnostics, and errors while Modbus remains the baseline path.

### Parity Closure and Release

- [ ] **PAR-02**: All remaining public symbols, the API parity matrix, the complete cross-repository matrix, user and API documentation, examples, security and changelog material, upstream-version/scheduled/repository-dispatch automation, and npm Trusted Publishing with provenance are complete; branch coverage is at least 80 percent and all local, cross-repository, tarball, and latest-stable-baseline gates pass.
- [ ] **REL-01**: The first release is `0.1.0`, and its changelog names the npm version, Python version and tag, full Python commit SHA, cross-repository parity result, and hardware validations performed.
- [ ] **REL-02**: Public Python changes update contracts and tests, are ported and checked against the intended commit before coordinated releases, and update the compatibility matrix; any newer Python release immediately marks the Node baseline stale and blocks npm publication until parity is restored.
- [ ] **REL-03**: npm publication is a hard failure unless the baseline is the latest stable Python release with exact commit verification, every API symbol is resolved, schemas and behavioral scenarios match, all quality and tarball gates pass, and compatibility and changelog evidence are ready; known functional differences are never released.

## v2 Requirements

None. Complete parity is indivisible for the initial npm release; unsupported or deferred functional parity is not a v1 release option.

## Out of Scope

| Feature                               | Reason                                                                |
| ------------------------------------- | --------------------------------------------------------------------- |
| Partial npm release                   | Full parity is an absolute publication gate.                          |
| Python runtime integration            | Python is development/CI reference material only.                     |
| Navigator 1.0/1.7                     | Separate, currently unsupported protocol family.                      |
| Browser support                       | Target runtime is standalone Node.js 22+.                             |
| Telemetry                             | Explicitly excluded by the package boundary.                          |
| Independent Node register corrections | The Python authority must receive source/hardware-backed fixes first. |
| Unapproved live hardware writes       | Safety-sensitive interaction requires explicit user authorization.    |

## Source Traceability

Each v1 requirement below derives from exactly one of the 27 ingested binding constraints. This preserves 27/27 constraint coverage while the roadmap maps every v1 requirement to exactly one phase.

| Requirement | Ingested constraint                                       | Authoritative source                                      |
| ----------- | --------------------------------------------------------- | --------------------------------------------------------- |
| PKG-01      | Standalone TypeScript runtime and parity release policy   | `docs/IMPLEMENTATION-PLAN.md` § Zielbild                  |
| PKG-02      | Target package structure                                  | `docs/IMPLEMENTATION-PLAN.md` § Vorgesehene Paketstruktur |
| PKG-03      | Runtime, compiler, and module baseline                    | `docs/IMPLEMENTATION-PLAN.md` § Architekturentscheidungen |
| TRN-01      | Modbus isolation and deterministic test infrastructure    | `docs/IMPLEMENTATION-PLAN.md` § Architekturentscheidungen |
| PKG-04      | Web export and platform boundaries                        | `docs/IMPLEMENTATION-PLAN.md` § Architekturentscheidungen |
| PKG-05      | Tooling and package contract                              | `docs/IMPLEMENTATION-PLAN.md` § Phase 1                   |
| PAR-01      | Parity harness, codec, and register schema implementation | `docs/IMPLEMENTATION-PLAN.md` § Phase 2                   |
| TRN-02      | Transport and read-path behavior                          | `docs/IMPLEMENTATION-PLAN.md` § Phase 3                   |
| DET-01      | Model and feature detection boundary                      | `docs/IMPLEMENTATION-PLAN.md` § Phase 4                   |
| WRT-01      | Write-safety implementation sequence and invariants       | `docs/IMPLEMENTATION-PLAN.md` § Phase 5                   |
| WEB-01      | Optional read-only web supplement                         | `docs/IMPLEMENTATION-PLAN.md` § Phase 6                   |
| PAR-02      | Full-parity and release-readiness gate                    | `docs/IMPLEMENTATION-PLAN.md` § Phase 7                   |
| REL-01      | Initial release identity and changelog evidence           | `docs/IMPLEMENTATION-PLAN.md` § Erstes Release            |
| BASE-01     | Reproducible upstream baseline                            | `docs/PARITY-CONTRACT.md` § Referenz                      |
| API-01      | Public API semantic equivalence                           | `docs/PARITY-CONTRACT.md` § Paritätsdimensionen 1         |
| REG-01      | Exact register-schema parity                              | `docs/PARITY-CONTRACT.md` § Paritätsdimensionen 2         |
| COD-01      | Codec parity                                              | `docs/PARITY-CONTRACT.md` § Paritätsdimensionen 3         |
| TRN-03      | Transport and batching parity                             | `docs/PARITY-CONTRACT.md` § Paritätsdimensionen 4         |
| DET-02      | Detection and state parity                                | `docs/PARITY-CONTRACT.md` § Paritätsdimensionen 5         |
| ERR-01      | Error and resilience parity                               | `docs/PARITY-CONTRACT.md` § Paritätsdimensionen 6         |
| WRT-02      | Write-safety parity                                       | `docs/PARITY-CONTRACT.md` § Paritätsdimensionen 7         |
| WEB-02      | Web-supplement parity                                     | `docs/PARITY-CONTRACT.md` § Paritätsdimensionen 8         |
| CTR-01      | Cross-repository contract scenario schema                 | `docs/PARITY-CONTRACT.md` § Contract-Harness              |
| CTR-02      | Behavioral contract coverage                              | `docs/PARITY-CONTRACT.md` § Contract-Harness              |
| API-02      | API parity matrix lifecycle                               | `docs/PARITY-CONTRACT.md` § API-Paritätsmatrix            |
| REL-02      | Coordinated release process and stale-baseline handling   | `docs/PARITY-CONTRACT.md` § Koordinierte Releases         |
| REL-03      | Absolute npm release gate                                 | `docs/PARITY-CONTRACT.md` § Release-Gate                  |

## Traceability

| Requirement | Phase   | Status   |
| ----------- | ------- | -------- |
| PAR-01      | Phase 1 | Complete |
| BASE-01     | Phase 1 | Complete |
| API-01      | Phase 1 | Pending  |
| API-02      | Phase 1 | Pending  |
| REG-01      | Phase 1 | Pending  |
| COD-01      | Phase 1 | Pending  |
| CTR-01      | Phase 1 | Complete |
| TRN-01      | Phase 2 | Pending  |
| TRN-02      | Phase 2 | Pending  |
| TRN-03      | Phase 2 | Pending  |
| DET-01      | Phase 2 | Pending  |
| DET-02      | Phase 2 | Pending  |
| ERR-01      | Phase 2 | Pending  |
| WRT-01      | Phase 3 | Pending  |
| WRT-02      | Phase 3 | Pending  |
| PKG-04      | Phase 4 | Pending  |
| WEB-01      | Phase 4 | Pending  |
| WEB-02      | Phase 4 | Pending  |
| PKG-01      | Phase 5 | Pending  |
| PKG-02      | Phase 5 | Pending  |
| PKG-03      | Phase 5 | Pending  |
| PKG-05      | Phase 5 | Pending  |
| PAR-02      | Phase 5 | Pending  |
| REL-01      | Phase 5 | Pending  |
| CTR-02      | Phase 5 | Pending  |
| REL-02      | Phase 5 | Pending  |
| REL-03      | Phase 5 | Pending  |

**Coverage:**

- Ingested binding constraints: 27 total
- Constraints represented by v1 requirements: 27
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓
- Duplicate phase mappings: 0 ✓

---

_Requirements defined: 2026-07-14_
_Last updated: 2026-07-14 after roadmap creation from ingested specifications_
