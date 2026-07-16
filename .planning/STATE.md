---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 02-06-PLAN.md; next first incomplete 02-07-PLAN.md
last_updated: "2026-07-16T21:27:15.044Z"
last_activity: 2026-07-16 -- Completed Phase 02 Plan 06 exact reads, safe batching, fallback, quarantine, and executable read parity
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 20
  completed_plans: 16
  percent: 80
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-14)

**Core value:** Complete semantic and behavioral parity with the latest stable pinned `Xerolux/idm-heatpump-api` release, proven by cross-repository contracts and all release gates.
**Current focus:** Phase 02 — modbus-reads-detection-and-resilience

## Current Position

Phase: 02 (modbus-reads-detection-and-resilience) — EXECUTING
Plan: 7 of 10
Status: Ready to execute
Last activity: 2026-07-16 -- Completed Phase 02 Plan 06 exact reads, safe batching, fallback, quarantine, and executable read parity

Milestone progress: [████████░░] 80% (16/20 milestone plans)

## Performance Metrics

**Velocity:**

- Total plans completed: 16
- Average duration: 65 min
- Total execution time: 17h 22m

**By Phase:**

| Phase | Plans | Total   | Avg/Plan |
| ----- | ----- | ------- | -------- |
| 01    | 10    | 15h 22m | 92 min   |
| 02    | 6     | 2h 00m  | 20 min   |

**Recent Trend:**

- Last 5 plans: 18 min, 9 min, 21 min, 14 min, 19 min
- Trend: Phase 2 now has exact FIFO-owned single/batch reads, fallback, quarantine, and executable read parity

_Updated after each plan completion_
| Phase 01 P01 | 16 min | 2 tasks | 3 files |
| Phase 01 P02 | 33 min | 3 tasks | 10 files |
| Phase 01 P03 | 27 min | 2 tasks | 7 files |
| Phase 01 P08 | 16 min | 2 tasks | 3 files |
| Phase 01 P04 | 12 min | 2 tasks | 7 files |
| Phase 01 P05 | 15 min | 2 tasks | 3 files |
| Phase 01 P06 | 22 min | 3 tasks | 11 files |
| Phase 01 P07 | 44 min | 2 tasks | 3 files |
| Phase 01 P09 | 11h 55m | 2 tasks | 6 files |
| Phase 01 P10 | 22 min | 2 tasks | 4 files |
| Phase 02 P01 | 39 min | 2 tasks | 10 files |
| Phase 02 P02 | 18 min | 2 tasks | 5 files |
| Phase 02 P04 | 9 min | 2 tasks | 5 files |
| Phase 02 P03 | 21 min | 2 tasks | 6 files |
| Phase 02 P05 | 14 min | 2 tasks | 6 files |
| Phase 02 P06 | 19 min | 3 tasks | 9 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Initialization]: Existing package/tooling is delivered foundation; roadmap phases cover remaining parity implementation.
- [Initialization]: The pinned stable Python tag and full SHA remain the behavioral authority.
- [Initialization]: `private: true` remains until complete parity and every release gate pass.
- [Phase 01]: Baseline admission verifies the exact manifest and clean detached Git identity before upstream execution.
- [Phase 01]: Read pinned Python project metadata from the verified Git object.
- [Phase 01]: Verify the entire pinned Python identity before import in every generator invocation.
- [Phase 01]: Keep Python fact fixtures separate from future TypeScript mappings.
- [Phase 01]: Treat generated contract JSON as byte-authoritative and transactionally replace the fixed six-file allowlist.
- [Phase 01]: Keep all 89 mappings planned until their owning implementation and evidence plan promotes them in Plan 01-09.
- [Phase 01]: Preserve all seven Python web aliases as independent `./web` contract rows.
- [Phase 01]: Treat `API-PARITY.md` and `BASELINE.md` as transactional generated projections, never editable authorities.
- [Phase 01]: Reserve one exact one-key envelope for NaN, both infinities, and negative zero; reject raw exceptional numbers during contract parsing.
- [Phase 01]: Keep scenario schema version 1 closed to the four generated Phase-1 semantic operations; later runtime operations require schema evolution.
- [Phase 01]: Validate Modbus words only in named transport/request envelope fields so direct codec values retain pinned datatype-specific domains.
- [Phase 01]: Treat controlled clock entries as finite non-negative monotonic timestamps while preserving event order.
- [Phase 01]: Use mapped same-name frozen factory namespaces for immutable FeatureFlags and IdmModelInfo values. — Preserves the sole mapping authority without adding unmapped root helper symbols.
- [Phase 01]: Use closure-backed ReadonlySet views for public set-like collections. — Object.freeze on a native Set does not block add or delete mutations.
- [Phase 01]: Keep RegisterDef validation exactly at pinned Python post-init semantics. — Deep immutability must not reject empty names, fractional non-negative addresses, or unvalidated collection members accepted upstream.
- [Phase 01]: Separate primitive exceptional-number bits from register-aware unavailable handling. — Pinned Python preserves primitive NaN/infinity/-0 but maps only high-level raw non-finite FLOAT values to null.
- [Phase 01]: Keep decodeValue and encodeValue internal until their owning client phase. — The sole API mapping owns only public ModbusCodec here; root/helper promotion would prematurely claim IdmModbusClient parity.
- [Phase 01]: Implement CPython rounding from exact IEEE-754 values with BigInt arithmetic. — JavaScript Math.round and decimal shortcuts diverge on half-even and binary-float tie-sensitive values.
- [Phase 01]: Construct all static and generated registers through the sole createRegisterDef validation boundary. — Static catalogs and parameterized builders must inherit one exact validation and immutability contract.
- [Phase 01]: Preserve exact documented starts and allow official occupied-range overlaps between independent logical data points. — Logical overlaps are authoritative request identities, not address-map defects.
- [Phase 01]: Keep the complete 26-field parity serializer independent from the abbreviated runtime registry schema. — Contract evidence must not depend on a convenience projection with different fields.
- [Phase 01]: Verify cloned source in a sanitized child environment before any upstream import. — Prevents Git URL rewrites or ambient checkout state from affecting admitted identity.
- [Phase 01]: Stage six Python fixtures and two API documents together before byte-checking or transactional promotion. — Makes check mode structurally non-mutating and generate mode rollback-safe.
- [Phase 01]: Keep parity:api API-only; exact Python lifecycle belongs to parity:generate and parity:check. — Preserves Plan 01-09 promotion ownership without regenerating Python facts.
- [Phase 01]: Complete exactly the 53 implemented owner-Phase-1 rows; keep all 36 later-owned rows planned. — Prevents status claims from preceding full implementation and focused evidence.
- [Phase 01]: Expose exactly 53 evidenced Phase-1 runtime counterparts, including the frozen RegisterDef.create factory. — Makes the root namespace equal the checked mapping without leaking internal or later-phase symbols.
- [Phase 01]: Stage only bounded regular contract-test files for complete rows inside the parity shadow root. — Keeps complete-row evidence validation isolated, deterministic, and non-mutating.
- [Phase 01]: Delegate CI parity to npm run parity:check after full-history checkout. — Keeps exact identity verification and generation lifecycle in one audited orchestrator.
- [Phase 01]: Pin all CI actions by full SHA under contents-read permissions. — Prevents mutable action references and avoids secrets, environments, or device inputs.
- [Phase 01]: Document exactly 53 complete Phase-1 mappings and 36 planned runtime mappings. — Keeps the usable semantic core distinct from absent transport, write, and web behavior.
- [Phase 01]: Keep private: true and record that no Node hardware validation was performed. — Prevents premature publication or unsupported validation claims.
- [Phase 02]: Keep ModbusTransport in a separate additive authority with no fabricated Python mapping row.
- [Phase 02]: Allow IdmModbusClient to be partial only during private development, with an exact pinned member partition and an unconditional release block.
- [Phase 02]: Expose only host plus mapped camelCase options publicly; keep transport, clock, sleep, and zero adapter retries internal.
- [Phase 02]: Normalize runtime errors to seven closed kinds and symmetrically redact configured endpoints with a bounded projection.
- [Phase 02]: Use one frozen adapter-neutral read request with exact FC03/FC04 identity and reject address/count spans beyond the 16-bit Modbus space. — Validating protocol identity before transport execution keeps adapters interchangeable and prevents malformed requests from consuming deterministic evidence.
- [Phase 02]: Keep Phase-2 runtime evidence in a separate exact-baseline schema with seven closed operations, synthetic example.invalid configuration, and literal <endpoint> diagnostic redaction. — This preserves the Phase-1 schema closure while preventing writes, web operations, private endpoints, alternate redaction markers, or mutable graphs from entering read parity evidence.
- [Phase 02]: Represent the seven closed runtime outcomes as six normalized failure kinds plus the dedicated IllegalAddressError marker.
- [Phase 02]: Create IllegalAddressError only from structured numeric Modbus Code 2; messages and numeric strings remain ordinary Modbus failures.
- [Phase 02]: Preserve caller order and duplicates in public diagnostics factories; sorting belongs only to later internal-set snapshots.
- [Phase 02]: Keep Phase-2 runtime evidence in a separate closed transport fixture. — Preserves the Phase-1 scenario schema while allowing exact lifecycle, read, resilience, detection, and diagnostics evidence.
- [Phase 02]: Replace all seven fixtures and two generated documents through one fixed transaction. — Rejects missing, extra, oversized, or symlinked output before replacement and restores all nine artifacts after failure.
- [Phase 02]: Carry internal client dependencies through a non-enumerable private symbol while keeping the constructor closed to host plus five mapped options.
- [Phase 02]: Hold one FIFO acquisition across ensure/connect, every attempt, reconnect, delay, validation, and state mutation.
- [Phase 02]: Reconnect timeout, disconnected, socket, and no-response failures; retry Modbus and invalid-response failures on the same connection; never retry Code 2.
- [Phase 02]: Preserve the latest immutable normalized error context after later success until explicit clearing.
- [Phase 02]: Keep exact documented logical starts/sizes and isolate direct reads from fallback failure state. — Grouping merges only same-type strict adjacency within the complete span; only ordered individual fallback mutates unsupported, permanent, or transient register state.

### Pending Todos

None yet.

### Blockers/Concerns

- Hardware validations completed for the initial release must be recorded accurately; no unperformed validation may be claimed.
- Upstream freshness must be rechecked before publication because a newer stable Python release invalidates the current baseline.

## Deferred Items

| Category | Item | Status | Deferred At |
| -------- | ---- | ------ | ----------- |
| _(none)_ |      |        |             |

## Session Continuity

Last session: 2026-07-16T21:26:49.097Z
Stopped at: Completed 02-06-PLAN.md; next first incomplete 02-07-PLAN.md
Resume file: None
