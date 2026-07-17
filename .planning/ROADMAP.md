# Roadmap: IDM Heatpump Node

## Overview

The existing package and tooling foundation is already delivered, so this roadmap begins with the remaining parity implementation. It first establishes a reproducible semantic contract against the pinned Python release, then delivers exact Modbus read/detection behavior, safety-sensitive writes, and the optional read-only web supplement before closing every cross-repository and publication gate for the indivisible `0.1.0` release.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Reproducible Semantic Contract** - The pinned Python public API, codecs, registers, and contract artifacts have exact TypeScript counterparts. (completed 2026-07-15)
- [x] **Phase 2: Modbus Reads, Detection, and Resilience** - Consumers receive Python-equivalent requests, values, capabilities, state, diagnostics, and recovery from the Modbus path. (completed 2026-07-17)
- [ ] **Phase 3: Safe Write Parity** - Consumers can plan, validate, dry-run, and execute writes with the same safety and time-dependent behavior as Python.
- [ ] **Phase 4: Optional Read-Only Web Parity** - Consumers can opt into equivalent Navigator 10 WebSocket and Navigator 2.0 HTTP data without changing the Modbus baseline.
- [ ] **Phase 5: Parity Closure and Release Assurance** - The complete standalone package proves latest-stable parity and satisfies every gate for `0.1.0` publication.

## Phase Details

### Phase 1: Reproducible Semantic Contract

**Goal**: Consumers and maintainers have a reproducible TypeScript semantic core whose public API, values, codecs, and register definitions match the exact pinned Python release.
**Depends on**: Nothing (existing package/tooling foundation is already delivered)
**Requirements**: PAR-01, BASE-01, API-01, API-02, REG-01, COD-01, CTR-01
**Success Criteria** (what must be TRUE):

1. A consumer can use a documented TypeScript counterpart for every public Python export implemented in this phase with equivalent defaults, validation, constants, and contract-approved value normalization.
2. Given the same raw words or writable value, consumers observe the same decoded value or encoded words as Python across low-word-first floats, non-finite values, integer boundaries, signs, and multipliers.
3. Maintainers can generate normalized schemas for every supported model/feature combination and see exact agreement on addresses, sizes, metadata, model gates, sentinels, write attributes, and documented overlaps.
4. Maintainers can regenerate language-neutral contracts from the fixed Python tag and full SHA, receive all required scenario fields, and get a hard failure for a mismatched or non-reproducible baseline.
5. Maintainers can inspect a generated or validated API parity matrix that inventories every public Python symbol with its TypeScript mapping, status, and contract evidence.

**Plans**: 10 plans

Plans:

- [x] 01-01-PLAN.md — Establish the strict exact-baseline trust boundary before upstream execution.
- [x] 01-02-PLAN.md — Generate deterministic public API, codec, register, and scenario golden contracts.
- [x] 01-03-PLAN.md — Inventory all public symbols and generate the API parity and baseline documentation.
- [x] 01-08-PLAN.md — Implement lossless tagged values and the strict CTR-01 scenario envelope.
- [x] 01-04-PLAN.md — Consume the sole API mapping to implement immutable constants, complete helper/class contracts, and exact RegisterDef semantics.
- [x] 01-05-PLAN.md — Port mapping-named primitive and register-aware codecs with bit-exact golden parity.
- [x] 01-06-PLAN.md — Port the mapping-named register catalog, builders, gates, registry, and serializer.
- [x] 01-07-PLAN.md — Establish guaranteed self-provisioning exact-baseline npm parity flows.
- [x] 01-09-PLAN.md — Promote evidenced mappings, regenerate API-only artifacts with `parity:api`, non-mutatingly check Python fixtures, then expose root exports.
- [x] 01-10-PLAN.md — Integrate exact parity CI, truthful private documentation, and the final phase gate.

### Phase 2: Modbus Reads, Detection, and Resilience

**Goal**: Consumers can reliably read IDM heat pumps and observe Python-equivalent model detection, request traces, recovery, state, and diagnostics.
**Depends on**: Phase 1
**Requirements**: TRN-01, TRN-02, TRN-03R, DET-01, DET-02, ERR-01R
**Success Criteria** (what must be TRUE):

1. A consumer can connect, disconnect, reconnect, and perform single or safe batch reads whose ordered function codes, addresses, counts, and results match Python.
2. Adjacent compatible registers batch exactly, while gaps, incompatible types, and overlaps remain separate; humidity `1392/count=2` and heating-circuit mode `1393/count=1` are always distinct requests.
3. Given identical probes, a consumer receives equivalent Navigator 2.0/Pro/10, firmware, heating-circuit, zone-module, solar, ISC, PV, cascade, sentinel, unavailable-slot, and register-map results, with Navigator 1.0/1.7 excluded.
4. Timeouts, disconnects, invalid responses, Code 2, transient failures, batch errors, retry exhaustion, fallback, quarantine, and reconnect produce the same results and recovery state as Python; only Code 2 marks a register unsupported.
5. Concurrent calls are serialized, concrete Modbus adapter details remain invisible to consumers, and deterministic scenarios expose equivalent unsupported, batch-unsafe, permanently-failed, connection-suspect, and diagnostic state.

**Plans**: 10 plans
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Establish additive/partial API governance and closed runtime error normalization.

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 02-02-PLAN.md — Define the adapter-neutral transport contract, bounded parser, fake transport, and fake clock.
- [x] 02-04-PLAN.md — Implement exact public errors, logging aliases, immutable context values, and diagnostics factories.

**Wave 3** _(blocked on Wave 2 completion)_

- [x] 02-03-PLAN.md — Generate the seventh Python fixture and orchestrate all nine generated artifacts transactionally.
- [x] 02-05-PLAN.md — Implement the internal-injection lifecycle, FIFO serialization, retries, reconnects, probes, and error context.

**Wave 4** _(blocked on Wave 3 completion)_

- [x] 02-06-PLAN.md — Implement exact single reads, grouping, batch fallback, failure tracking, quarantine, and read scenario execution.

**Wave 5** _(blocked on Wave 4 completion)_

- [x] 02-07-PLAN.md — Implement ordered model/capability detection, model-aware maps, state queries, and diagnostic scenarios.

**Wave 6** _(blocked on Wave 5 completion)_

- [x] 02-08-PLAN.md — Add the audited hidden `modbus-serial` adapter and bind it as the public constructor default.

**Wave 7** _(blocked on Wave 6 completion)_

- [x] 02-09-PLAN.md — Promote the exact mapped partial client and additive transport type through machine-checked root exports.

**Wave 8** _(blocked on Wave 7 completion)_

- [x] 02-10-PLAN.md — Close package smoke, documentation, parity, privacy, and clause-aware Phase-2 gates.

### Phase 3: Safe Write Parity

**Goal**: Consumers can write supported settings with the same validation, request shape, throttling, heartbeat, and failure safety as the Python reference.
**Depends on**: Phase 2
**Requirements**: WRT-01, WRT-02, TRN-03W, ERR-01W
**Success Criteria** (what must be TRUE):

1. A consumer can inspect an equivalent write plan or dry-run result without any Modbus request being sent.
2. Accepted single- and multi-register writes target the same address and function and emit the same words as Python.
3. Invalid types, ranges, enums, excluded values, and model memberships are rejected for the same domain reason, and custom-register writes retain every protection that still applies.
4. With controlled time, EEPROM throttling and cyclic TTL/heartbeat transitions occur at the same points and with the same requests as Python.
5. A failed write never records a successful transition or weakens the next write's safety state.

**Plans**: TBD

### Phase 4: Optional Read-Only Web Parity

**Goal**: Consumers can optionally obtain Python-equivalent web data from Navigator 10 and Navigator 2.0 while Modbus remains the safe baseline path.
**Depends on**: Phase 3
**Requirements**: PKG-04, WEB-01, WEB-02
**Success Criteria** (what must be TRUE):

1. A consumer can load web capabilities explicitly from `@xerolux/idm-heatpump/web`, while the base package and missing-PIN configurations continue to operate through Modbus alone.
2. Equivalent Navigator 10 WebSocket responses produce equivalent normalized values, units, notifications, statistics, capabilities, diagnostics, and errors.
3. Equivalent Navigator 2.0 HTTP authentication, CSRF, and response fixtures produce equivalent normalized results, cache behavior, and errors.
4. Web factories and PIN checks never expose a write path, and the optional web supplement remains read-only with Modbus as the baseline.
5. Package consumers see no browser-support promise and no telemetry behavior from either export path.

**Plans**: TBD

### Phase 5: Parity Closure and Release Assurance

**Goal**: Maintainers can prove that the complete standalone package matches the latest stable Python release and is safe to publish as `0.1.0` only when every gate passes.
**Depends on**: Phase 4
**Requirements**: PKG-01, PKG-02, PKG-03, PKG-05, PAR-02, REL-01, CTR-02, REL-02, REL-03
**Success Criteria** (what must be TRUE):

1. Maintainers can inspect clearly separated public, register, transport, client, optional web, test, script, example, and documentation boundaries, and consumers can install a controlled tarball in clean Node.js 22 and 24 projects and use its ESM and CommonJS exports without Python or leaked development files.
2. The exact latest stable Python tag and full SHA are verified, every public symbol is complete or legitimately reviewed as not applicable, and any stale baseline or semantic difference blocks publication.
3. Local and cross-repository suites prove schema, codec, detection, request, retry, fallback, EEPROM, cyclic TTL, write, and web behavior rather than static structures alone; typecheck, lint, format, Node 22/24 CI, tarball smoke, and at least 80 percent branch coverage all pass.
4. Consumers and maintainers can use complete README, examples, API, security, compatibility, and changelog material; the `0.1.0` changelog records Python version/tag/full SHA, parity result, and performed hardware validations.
5. Pull-request, push, daily, repository-dispatch, and pre-release checks detect upstream changes, while coordinated-release automation and Trusted Publishing with provenance cannot publish until every absolute gate succeeds and `private: true` is intentionally removed.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase                                      | Plans Complete | Status      | Completed  |
| ------------------------------------------ | -------------- | ----------- | ---------- |
| 1. Reproducible Semantic Contract          | 10/10          | Complete    | 2026-07-16 |
| 2. Modbus Reads, Detection, and Resilience | 10/10          | Complete    | 2026-07-17 |
| 3. Safe Write Parity                       | 3/7            | In Progress |            |
| 4. Optional Read-Only Web Parity           | 0/TBD          | Not started | -          |
| 5. Parity Closure and Release Assurance    | 0/TBD          | Not started | -          |
