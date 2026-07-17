---
phase: 02-modbus-reads-detection-and-resilience
verified: 2026-07-17T01:21:58Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
requirements:
  satisfied:
    - TRN-01
    - TRN-02
    - TRN-03R
    - DET-01
    - DET-02
    - ERR-01R
  blocked: []
  human: []
deferred:
  - truth: "Write request/payload and write-error parity are not part of the Phase-2 read goal."
    addressed_in: "Phase 3"
    evidence: "ROADMAP Phase 3 owns TRN-03W and ERR-01W together with all seven omitted write/cyclic/throttle members."
  - truth: "The TRN-03 and ERR-01 umbrella requirements remain pending until their read and write children are both complete."
    addressed_in: "Phase 3"
    evidence: "REQUIREMENTS.md marks TRN-03R and ERR-01R complete, TRN-03W and ERR-01W pending, and both umbrellas pending."
---

# Phase 2: Modbus Reads, Detection, and Resilience Verification Report

**Phase Goal:** Consumers can reliably read IDM heat pumps and observe
Python-equivalent model detection, request traces, recovery, state, and
diagnostics.

**Verified:** 2026-07-17T01:21:58Z  
**Status:** passed  
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                          | Status     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Consumers can connect, disconnect, reconnect, and perform exact single and safe batch reads.                                                   | ✓ VERIFIED | `src/client/idm-modbus-client.ts` owns the complete FIFO-serialized lifecycle and read operations. `src/transport/modbus-serial-adapter.ts` maps holding/input requests to FC03/FC04. The generated Python fixture executes lifecycle, FC03, FC04, adjacency, gap, span, retry, and fallback cases through the real TypeScript client; all 32 non-detection scenarios pass result, ordered request, controlled-time, and final-state equality.                                                                                   |
| 2   | Batching merges only exact compatible adjacency and preserves gaps, types, maximum spans, and official overlaps.                               | ✓ VERIFIED | `src/client/read-groups.ts` requires unchanged register type, `next.address === previous.address + previous.size`, and a bounded complete span. The Python-generated traces require separate `1392/2` + `1393/1`, `1441/2` + `1442/1`, and `1483/2` + `1484/1` requests. Focused grouping/batch tests and the Phase-1 register-schema regression all pass. No no-overlap invariant exists.                                                                                                                                       |
| 3   | Identical probes produce Python-equivalent models, capabilities, firmware, sentinels, and model-aware maps while Navigator 1.x stays excluded. | ✓ VERIFIED | `src/client/detection.ts` implements the pinned ordered circuit, zone, solar, ISC, PV, cascade, Navigator-10, and optional firmware probes with the two-missing stop and exact sentinel rules. `IdmModbusClient.detectModel()` rebuilds the map only after complete detection. Five Python-generated detection scenarios and focused tests cover Unknown, Navigator 2.0, Pro, Navigator 10, unavailable slots, cascade `0/255`, firmware, features, and map keys/counts.                                                         |
| 4   | Read/lifecycle failures, retries, reconnects, fallback, permanent state, unsupported state, and quarantine match Python.                       | ✓ VERIFIED | Closed failures in `src/transport/errors.ts` and `IdmModbusClient.#retryReadLocked()` distinguish four reconnect classes, same-connection Modbus/invalid-response retry, and immediate numeric-Code-2 termination. Batch fallback alone owns unsupported/permanent counters; suspect values are quarantined and individually revalidated. Generated scenarios prove cumulative `[0.5, 1.5]` retry time, short-response diagnostics, reconnect traces, third-failure permanence, Code 2, reset scope, and invalid-value omission. |
| 5   | Concurrent calls are serialized, adapter details stay hidden, and diagnostics/state are deterministic and immutable.                           | ✓ VERIFIED | `FifoGate` surrounds complete public operations including connect, retry, reconnect, delay, detection, fallback, and reread. The real provider is internal default wiring behind public `ModbusTransport`; emitted declarations contain no adapter/test dependencies. Diagnostics factories preserve caller order while the client sorts owned set snapshots. The 21-operation FIFO test, generated `maxActiveRequests: 1` evidence, exact ESM/CJS/declaration export checks, and clean tarball consumer smokes all pass.        |

**Score:** 5/5 roadmap truths verified

### Plan-Level Must-Haves

Every truth declared in all ten PLAN frontmatters was checked against source,
tests, contracts, generated evidence, and package output. The result is
**45/45 plan truths verified**.

| Plan  | Truths | Result     | Concrete verification                                                                                                                                                                   |
| ----- | -----: | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 02-01 |    4/4 | ✓ VERIFIED | Exact 89-row Python authority; separate complete TypeScript extension; exact 22/7 partial-client partition; closed constructor/error/redaction normalization; release mode fail-closed. |
| 02-02 |    4/4 | ✓ VERIFIED | Adapter-neutral request boundary, separate bounded immutable parser, deterministic fake transport/clock, and closed normalized runtime contexts.                                        |
| 02-03 |    4/4 | ✓ VERIFIED | Exact pinned Python generator emits seven fixtures and nine total generated artifacts; 37 runtime scenarios have all eight CTR-01 fields; check mode is non-mutating and transactional. |
| 02-04 |    4/4 | ✓ VERIFIED | Numeric Code 2 only, exact logging aliases, immutable order-preserving public values, and client-only sorting responsibility.                                                           |
| 02-05 |    4/4 | ✓ VERIFIED | One non-reentrant FIFO, closed public constructor, private deterministic dependencies, exact reconnect/backoff/error context, and deterministic lifecycle state.                        |
| 02-06 |    6/6 | ✓ VERIFIED | Exact single reads, strict grouping, all three official overlaps, ordered device fallback, transport propagation, suspect quarantine/reread/omit, and generated read-state parity.      |
| 02-07 |    5/5 | ✓ VERIFIED | Exact one-attempt/2-second ordered detection, all capability/sentinel rules, model priority/map, client-owned diagnostics sorting, and generated detection parity.                      |
| 02-08 |    4/4 | ✓ VERIFIED | Sole exact runtime provider, mocked no-TCP adapter coverage, hidden provider types/errors, and public-constructor default wiring.                                                       |
| 02-09 |    5/5 | ✓ VERIFIED | Four completed Python mappings, exact partial client, complete type-only extension, exact root closure, and exact public declarations.                                                  |
| 02-10 |    5/5 | ✓ VERIFIED | Exact private tarball surface, 15-file allowlist, truthful limitations, complete phase gate, and clause-aware requirement closure.                                                      |

### Deferred Items

| Item                                         | Addressed In | Evidence                                                                                                                            |
| -------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Write request/payload and write-error parity | Phase 3      | Phase 3 explicitly owns WRT-01, WRT-02, TRN-03W, and ERR-01W plus the seven omitted client members.                                 |
| TRN-03 and ERR-01 umbrella closure           | Phase 3      | Each umbrella requires its completed Phase-2 read child and Phase-3 write child; neither parent is incorrectly marked complete now. |

These are later-phase scope boundaries, not Phase-2 gaps.

## Required Artifacts

The GSD artifact verifier checked every artifact declaration in all ten plans:
**46/46 exist and are substantive**. Manual inspection additionally verified
that implementation artifacts are wired into executable consumers rather than
standing as isolated files.

| Plan  | Artifact declarations | Status     | Representative wiring                                                                                                                        |
| ----- | --------------------: | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 02-01 |                   4/4 | ✓ VERIFIED | Extension/normalization authorities are consumed by API generation, mutation tests, Python generation, and runtime execution.                |
| 02-02 |                   5/5 | ✓ VERIFIED | Fake transport directly implements `ModbusTransport`; the separate parser validates exact request values and generated fixture graphs.       |
| 02-03 |                   4/4 | ✓ VERIFIED | The pinned generator executes Python and the orchestrator stages the fixed seven-fixture/two-document allowlist transactionally.             |
| 02-04 |                   5/5 | ✓ VERIFIED | Errors feed adapter/client policy; diagnostics factories feed client snapshots and root exports.                                             |
| 02-05 |                   5/5 | ✓ VERIFIED | Client methods enter one FIFO and use only the private internal creation seam for deterministic dependencies.                                |
| 02-06 |                   5/5 | ✓ VERIFIED | Client delegates to the Phase-1 codec and pure grouper; the parity runner invokes the real client against generated scripts.                 |
| 02-07 |                   5/5 | ✓ VERIFIED | Detection consumes locked probes, builds the canonical registry, and projects through immutable diagnostics.                                 |
| 02-08 |                   4/4 | ✓ VERIFIED | Normal public construction selects the hidden adapter implementing `ModbusTransport`.                                                        |
| 02-09 |                   5/5 | ✓ VERIFIED | Mapping and extension authorities drive explicit root exports, generated docs, ESM/CJS keys, and declarations.                               |
| 02-10 |                   4/4 | ✓ VERIFIED | Package checker installs the actual tarball in clean ESM/CJS/TypeScript consumers; phase gate binds docs, requirements, privacy, and parity. |

## Key Link Verification

All **23/23** declared plan links pass automated pattern verification and
manual semantic tracing.

| From                       | To                                                               | Via                                                                            | Status  | Details                                                                                                                    |
| -------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| Runtime/public authorities | Generators, tests, docs, root exports                            | Closed schemas and explicit mappings                                           | ✓ WIRED | Python inventory stays 89; additive `ModbusTransport` is separate; partial client partition is exact and release-blocking. |
| `IdmModbusClient`          | FIFO, adapter, codec, grouping, detection, registry, diagnostics | Complete-operation client state machine                                        | ✓ WIRED | Requests and state are produced by implementation code, not fixture lookups.                                               |
| Pinned Python generator    | Transport fixture                                                | Execution of exact detached Python `0.7.6` client with deterministic fake/time | ✓ WIRED | Expected results, traces, cumulative clock, and final state are captured from Python execution.                            |
| Transport fixture          | TypeScript parity runner                                         | Closed parser plus canonical register resolution                               | ✓ WIRED | Runner builds requests from source definitions, consumes every script, and compares all four observable dimensions.        |
| Package source             | Packed consumers                                                 | Actual tarball install/import/require/typecheck                                | ✓ WIRED | Fifteen-file package smoke passed without connecting and with exact runtime dependency.                                    |

## Data-Flow Trace

| Output                   | Upstream source                                                       | Execution path                                                                                                        | Status    |
| ------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------- |
| Read value/request trace | Canonical `RegisterDef` plus scripted 16-bit words                    | public read → FIFO → exact request → hidden transport → count validation → Phase-1 codec                              | ✓ FLOWING |
| Batch result/state       | Canonical register selection plus Python-generated responses          | filter/split → pure strict grouping → group read → ordered fallback/quarantine → immutable record and state snapshots | ✓ FLOWING |
| Detected model/map       | Ordered raw FC04 probe responses                                      | locked probes → sentinel/stop classification → immutable `IdmModelInfo` → `buildRegisterMap`                          | ✓ FLOWING |
| Diagnostics              | Client connection, model, failure, quarantine, and latest-error state | client-owned sorted snapshots → order-preserving immutable factory → public root value                                | ✓ FLOWING |
| Golden runtime evidence  | Exact detached Python tag/SHA                                         | verified checkout → deterministic Python fake/clock → normalized fixture → strict TypeScript parser/runner            | ✓ FLOWING |

## Behavioral Spot-Checks

| Behavior                            | Command/evidence                                                                                             | Result                                                                                                                                                                      | Status |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Full workspace quality/package gate | `npm run check`                                                                                              | Format, ESLint, strict TypeScript, 21/21 test files, 394 passed / 1 intentional Win32 symlink skip, coverage, ESM/CJS/DTS build, and 15-file tarball consumer smoke passed. | ✓ PASS |
| Coverage                            | Included in `npm run check`                                                                                  | 92.36% statements, 90.38% branches, 92.58% functions, 92.54% lines.                                                                                                         | ✓ PASS |
| Exact cross-repository behavior     | `npm run parity:check`                                                                                       | Verified package `0.7.6`, tag `v0.7.6`, SHA `ad121ebf34a5f5e37204371c026927d77efcd15c`; seven fixtures, two generated docs, nine artifacts; no drift.                       | ✓ PASS |
| Runtime dependency closure          | `npm ls modbus-serial --depth=0`                                                                             | Exactly `modbus-serial@8.0.25`.                                                                                                                                             | ✓ PASS |
| Production dependency audit         | `npm audit --omit=dev`                                                                                       | 0 vulnerabilities.                                                                                                                                                          | ✓ PASS |
| Release fail-closed boundary        | `node scripts/generate-api-parity.mjs --release`                                                             | Exited 1 with `mapping_release_status_incomplete`, as required while later-phase symbols remain incomplete.                                                                 | ✓ PASS |
| Generated artifact/worktree drift   | `git diff --exit-code -- contracts docs/API-PARITY.md docs/BASELINE.md test/fixtures` and `git diff --check` | Clean before this report.                                                                                                                                                   | ✓ PASS |

## Probe Execution

No workflow shell probes (`scripts/**/probe-*.sh`) are declared for Phase 2.
The domain operation named `probeRegister` is not a workflow probe; it is
covered by focused tests and Python-generated runtime scenarios, including
FC04 identity, one-attempt/two-second detection, fractional timeouts, failures,
and state isolation.

## Requirements Coverage

| Requirement | Source plans                                           | Status      | Evidence                                                                                                                                                                   |
| ----------- | ------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TRN-01      | 02-01, 02-02, 02-03, 02-04, 02-05, 02-08, 02-09, 02-10 | ✓ SATISFIED | Public adapter-neutral `ModbusTransport`, deterministic fake/time seam, exact hidden adapter, and no provider leakage in declarations/package.                             |
| TRN-02      | 02-05 through 02-10                                    | ✓ SATISFIED | Lifecycle, serialization, exact reads, retries, reconnect, fallback, permanent/unsupported tracking, quarantine, and queries are executable and Python-equal.              |
| TRN-03R     | 02-01, 02-02, 02-03, 02-06, 02-08, 02-09, 02-10        | ✓ SATISFIED | Exact FC03/FC04 function/address/count traces, strict same-type adjacency, gaps, spans, and official overlaps all match generated Python evidence.                         |
| DET-01      | 02-03, 02-07, 02-09, 02-10                             | ✓ SATISFIED | Exact model/capability/firmware/sentinel/stop/map scenarios pass; Navigator 1.0/1.7 is absent.                                                                             |
| DET-02      | 02-02 through 02-07, 02-09, 02-10                      | ✓ SATISFIED | Identical responses yield equivalent model/features, unsupported, permanent, batch-unsafe, suspect, context, diagnostics, and reset state.                                 |
| ERR-01R     | 02-01 through 02-10                                    | ✓ SATISFIED | Closed normalized timeout/disconnect/socket/no-response/Modbus/Code-2/invalid-response behavior, exact backoff/reconnect/fallback/exhaustion traces, and final state pass. |

**Orphaned Phase-2 requirements:** none. All six IDs appear in plan
frontmatter and in the roadmap mapping. `TRN-03`, `ERR-01`, `TRN-03W`, and
`ERR-01W` are correctly not claimed by Phase 2.

## Protocol-Invariant Verification

- Float32 remains IEEE-754 32-bit, two words, low word first.
- Input and holding register identity retains FC04 and FC03 respectively.
- Grouping uses exact documented logical starts/sizes and never spans gaps or
  combines overlaps.
- `humidity_sensor` is `1392/count=2`; `hc_a_mode` is the separate
  `1393/count=1` request.
- The additional official overlaps at 1442 and 1484 are also positively tested
  as separate requests.
- Only structured numeric Code 2 marks a register unsupported.
- Sentinels are accepted only after documented datatype decoding.
- Navigator 1.0/1.7 remains a separate unsupported family.
- No register definition/schema byte changed during Phase 2; the Phase-1
  regression and schema parity gates pass.

## Review, Security, and Test Quality

- `02-REVIEW.md` is a clean deep review of 38 Phase-2 files. Its five earlier
  findings were closed by atomic fixes for real close status, short-response
  diagnostics, cumulative clock observations, special result keys, and
  fractional timeouts.
- `02-SECURITY.md` verifies all 7/7 registered threats closed, ASVS level 1,
  with one documented accepted local-configuration availability risk required
  by exact Python parity.
- Expected runtime results are not circular TypeScript fixtures: the generator
  executes the exact pinned Python client after repository/tag/SHA/package
  verification. The TypeScript runner resolves canonical source registers and
  never imports the fixture from production code.
- Mutation tests cover malformed mappings, extension/member partitions,
  parser bounds, prototype pollution, poisoned Python imports, symlinks,
  drift, rollback, unknown errors, redaction asymmetry, and package closure.

### Disconfirmation Pass

| Check                          | Finding                                                                                                                                | Assessment                                                                                                                                                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Potential partial requirement  | TRN-03 and ERR-01 are not globally complete.                                                                                           | Intentional and correctly represented: their read children pass here; their write children are Phase 3. No Phase-2 gap.                                                                                                          |
| Potential misleading test      | The real-adapter suite mocks TCP rather than contacting hardware.                                                                      | Not misleading: Phase 2 proves software/protocol parity and explicitly makes no Node hardware-validation claim. The actual dependency is installed and the packed package is consumed; live hardware is not a success criterion. |
| Potential uncovered error path | Coverage leaves defensive branches such as the impossible exhausted-retry guard and a synchronous provider lifecycle throw unexecuted. | Informational only. Required retry/lifecycle outcomes, callback errors, rejected operations, and recovery paths have direct tests; global branch coverage is 90.38%.                                                             |

## Anti-Patterns Found

Scans across all 38 reviewed Phase-2 files found no unresolved `TBD`, `FIXME`,
`XXX`, `TODO`, `HACK`, placeholder implementation, disabled behavior test, raw
device secret, live hardware call, no-overlap rule, or Phase-3 write stub. The
word `placeholder` occurs only in the exact diagnostic-redaction contract. The
single Win32 skip is the documented privilege-dependent symlink mutation; the
same security test remains active on Linux CI.

**Anti-patterns:** 0 blockers, 0 warnings, 1 informational platform skip

## Human Verification Required

None. Phase 2 is a deterministic protocol/client/package slice. Its goal is
fully observable through exact generated Python scenarios, mocked provider
boundary tests, immutable state comparisons, and clean installed-package
smokes. Live hardware validation, writes, and web user flows are not Phase-2
acceptance requirements and are not claimed by the package.

## Gaps Summary

**No Phase-2 gaps found.** All five roadmap success criteria, all 45 plan
truths, all 46 artifact declarations, all 23 key links, and all six Phase-2
child requirements are verified. The package correctly remains private and
release-blocking while Phase 3 writes, Phase 4 web behavior, and Phase 5 release
closure remain outstanding.

## Verification Metadata

- **Verification approach:** Goal-backward from ROADMAP success criteria, then
  plan truth/artifact/link closure, actual source data-flow tracing, fresh
  behavioral execution, and disconfirmation.
- **Pinned authority:** Python `idm-heatpump-api` `0.7.6`, tag `v0.7.6`, commit
  `ad121ebf34a5f5e37204371c026927d77efcd15c`.
- **Public authority:** 89 Python mapping rows: 57 complete, 1 exact partial
  client, 31 planned later-phase rows; one separately complete type-only
  `ModbusTransport` extension.
- **Runtime scenarios:** 37 total: 32 non-detection and 5 detection scenarios.
- **Artifacts:** 46/46 verified.
- **Key links:** 23/23 verified.
- **Plan truths:** 45/45 verified.
- **Roadmap truths:** 5/5 verified.
- **Requirements:** 6/6 satisfied.
- **Human checks:** 0.

---

_Verified: 2026-07-17T01:21:58Z_  
_Verifier: the agent (gsd-verifier)_
