---
phase: 01-reproducible-semantic-contract
verified: 2026-07-16T16:47:40Z
status: passed
score: 5/5 must-haves verified
requirements:
  satisfied:
    - PAR-01
    - BASE-01
    - API-01
    - API-02
    - REG-01
    - COD-01
    - CTR-01
  blocked: []
  human: []
decision_coverage:
  honored: 12
  total: 12
  not_honored: []
---

# Phase 1: Reproducible Semantic Contract Verification Report

**Phase Goal:** Consumers and maintainers have a reproducible TypeScript
semantic core whose public API, values, codecs, and register definitions match
the exact pinned Python release.

**Verified:** 2026-07-16T16:47:40Z

**Status:** passed

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                                  | Status     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Every public Python export implemented in Phase 1 has a documented TypeScript counterpart with equivalent defaults, validation, constants, and approved normalization. | ✓ VERIFIED | `contracts/api-mapping.json`, generated `docs/API-PARITY.md`, and `test/parity/api-parity.test.ts` close the full 89-symbol inventory. The 53 Phase-1-complete rows exactly match the 53 root runtime exports, including the `RegisterDef.create` factory. All 36 remaining rows are explicitly owned by Phases 2-4 and remain absent from the runtime.                                                              |
| 2   | Identical raw words and writable values produce Python-equivalent decoded values and encoded words across the required numeric edge cases.                             | ✓ VERIFIED | `src/codec.ts`, `test/fixtures/codec-vectors.json`, `test/codec.test.ts`, and `test/parity/codec-contract.test.ts` cover primitive and register-aware paths, IEEE-754 Float32 low-word-first transfer, signed and unsigned boundaries, multipliers, half-even/two-decimal normalization, NaN, infinities, negative zero, and finite sentinels.                                                                       |
| 3   | Register schemas and builders preserve the exact Python addresses, sizes, metadata, gates, sentinels, write attributes, and documented overlaps.                       | ✓ VERIFIED | `src/registers/`, `test/fixtures/register-schema.json`, `test/parity/register-schema.test.ts`, and `test/registers/builders.test.ts` compare 26 fields over complete 267-, 587-, and 105-register maps and exhaust the model, feature, A-G circuit, zone 1-10, room 1-8, count-boundary, and precedence gates. The exact overlaps at 1393, 1442, and 1484 are positively required.                                   |
| 4   | Contracts regenerate from the fixed Python tag and full SHA, contain the complete scenario envelope, and hard-fail on an invalid or non-reproducible baseline.         | ✓ VERIFIED | `UPSTREAM-PARITY.json` pins Python `0.7.6`, tag `v0.7.6`, and full SHA `ad121ebf34a5f5e37204371c026927d77efcd15c`. `scripts/check-upstream-version.mjs`, `scripts/check-parity.mjs`, `scripts/generate-python-contract.py`, and the baseline/generator/phase-gate tests enforce exact repository identity, clean checkout, tag target, version, fixed outputs, non-mutating check mode, and all eight CTR-01 fields. |
| 5   | The parity matrix inventories every public Python symbol with its TypeScript mapping, status, and executable evidence.                                                 | ✓ VERIFIED | `contracts/api-mapping.json` is the sole machine authority; `scripts/generate-api-parity.mjs --check` reports the generated API parity and baseline documents current. Tests require exact symbol/class-member closure, bounded evidence paths, valid statuses, root export closure, and an empty Phase-1 web runtime.                                                                                               |

**Score:** 5/5 truths verified

### Scope Boundary

Phase 1 is the semantic-contract foundation, not the completed npm release.
The mapping contains 53 `complete` entries and 36 `planned` entries. Every
`owner_phase: 1` entry is complete; the planned entries belong to:

| Later scope                                                        | Intended phase | Phase-1 treatment                                    |
| ------------------------------------------------------------------ | -------------- | ---------------------------------------------------- |
| Modbus transport, reads, detection, resilience, and related errors | Phase 2        | Documented in the matrix; intentionally not exported |
| Write execution and write-safety orchestration                     | Phase 3        | Documented in the matrix; intentionally not exported |
| Optional web supplement                                            | Phase 4        | `src/web/index.ts` remains deliberately empty        |
| Publication and complete release closure                           | Phase 5        | `package.json` remains `private: true`               |

These entries are planned roadmap work, not Phase-1 gaps. The current
documentation also makes no Node hardware-validation or publication claim.

## Required Artifacts

The GSD artifact verifier was run against every declaration in all ten plan
frontmatters. All 44 declarations exist and are substantive.

| Plan  | Artifact declarations | Result     | Representative verified capability                                         |
| ----- | --------------------: | ---------- | -------------------------------------------------------------------------- |
| 01-01 |                   3/3 | ✓ VERIFIED | Exact baseline manifest, strict parser, identity checks                    |
| 01-02 |                   8/8 | ✓ VERIFIED | Deterministic Python-generated API, codec, register, and scenario fixtures |
| 01-03 |                   5/5 | ✓ VERIFIED | Sole API mapping and generated parity/baseline documentation               |
| 01-04 |                   4/4 | ✓ VERIFIED | Constants, types, immutable helpers, and `RegisterDef` semantics           |
| 01-05 |                   3/3 | ✓ VERIFIED | Primitive and register-aware codec implementation and golden tests         |
| 01-06 |                   7/7 | ✓ VERIFIED | Static catalog, parametric builders, registry, and serializer              |
| 01-07 |                   3/3 | ✓ VERIFIED | Self-provisioning exact-baseline parity orchestration                      |
| 01-08 |                   3/3 | ✓ VERIFIED | Tagged values and strict scenario contract                                 |
| 01-09 |                   4/4 | ✓ VERIFIED | Evidence-backed mapping promotion and exact public export surface          |
| 01-10 |                   4/4 | ✓ VERIFIED | CI, private package gate, truthful documentation, and changelog            |

**Artifacts:** 44/44 plan declarations verified

Substantive implementation checks also confirmed:

- `package.json` is private, targets Node.js 22+, has zero runtime
  dependencies, and packages only `dist`.
- `src/index.ts` exposes exactly the 53 completed runtime mappings.
- `src/web/index.ts` contains only the empty Phase-1 module boundary.
- `src/registers/` contains real definitions and compositional builders rather
  than fixture lookups or stubs.
- `src/codec.ts` uses native `DataView` word operations and does not obtain
  expected results from the golden fixture.
- `src/contracts/` implements bounded, immutable tagged values, canonical
  ordering, and the strict scenario envelope.
- The generated fixtures retain full provenance and the official register-map
  overlaps; no global no-overlap invariant is present.
- Navigator 1.0/1.7 remains excluded as a separate unsupported protocol family.

## Key Link Verification

The GSD key-link verifier was run against every link declared in all ten plan
frontmatters.

| Plan  | Key links | Result  | Verified wiring                                                      |
| ----- | --------: | ------- | -------------------------------------------------------------------- |
| 01-01 |       2/2 | ✓ WIRED | Manifest → strict metadata parser → upstream identity gate           |
| 01-02 |       3/3 | ✓ WIRED | Verified Python reference → generator → allowlisted fixtures         |
| 01-03 |       4/4 | ✓ WIRED | API mapping → generated docs, tests, and evidence validation         |
| 01-04 |       4/4 | ✓ WIRED | Mapping decisions → semantic implementation → public root surface    |
| 01-05 |       5/5 | ✓ WIRED | Datatype definitions → codecs → golden vectors → parity tests        |
| 01-06 |       6/6 | ✓ WIRED | Register factory → families/builders → registry/serializer → schemas |
| 01-07 |       3/3 | ✓ WIRED | npm parity command → isolated Python environment → exact check mode  |
| 01-08 |       2/2 | ✓ WIRED | Tagged normalization → scenario parser → behavior contract           |
| 01-09 |       3/3 | ✓ WIRED | Complete evidence → mapping promotion → generated exports/docs       |
| 01-10 |       3/3 | ✓ WIRED | Local gates → read-only CI → private package/documentation contract  |

**Wiring:** 35/35 connections verified

## Requirements Coverage

| Requirement | Status      | Evidence                                                                                                                                                                                                                   |
| ----------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PAR-01      | ✓ SATISFIED | Exact baseline, API inventory, codec vectors, complete register schemas, builders, TypeScript implementation, and overlap tests are generated and verified together.                                                       |
| BASE-01     | ✓ SATISFIED | The repository URL, Python version, fixed tag, full SHA, parity schema, status, and verification date are closed and hard-validated before upstream execution.                                                             |
| API-01      | ✓ SATISFIED | All 53 Phase-1-owned public symbols have equivalent implementations and executable defaults/validation/normalization evidence; later-phase symbols are explicitly planned.                                                 |
| API-02      | ✓ SATISFIED | The generated matrix inventories all 89 public Python symbols with TypeScript mapping, owner phase, status, representation, normalization, and evidence.                                                                   |
| REG-01      | ✓ SATISFIED | Complete maps match over all 26 fields, builders cover every supported parameter boundary and gate, and official logical overlaps are required rather than rejected.                                                       |
| COD-01      | ✓ SATISFIED | Golden value-level tests prove decode/encode parity for Float32 word order, exceptional values, boundaries, signs, rounding, and multipliers.                                                                              |
| CTR-01      | ✓ SATISFIED | The language-neutral scenario parser requires `name`, `configuration`, `transport_responses`, `clock`, `operation`, `expected_result`, `expected_requests`, and `expected_state`, with only approved tagged normalization. |

**Coverage:** 7/7 Phase-1 requirements satisfied

## Decision Coverage

The automated decision-coverage parser reported no machine-trackable decision
records in `01-CONTEXT.md` and therefore skipped with no blocking result.
Manual verification of the context's twelve locked decisions found all twelve
honored:

1. camelCase/PascalCase naming with documented intentional renames;
2. separate root and web export boundaries;
3. readonly mapping representation with normalization at contract boundaries;
4. frozen `as const` unions instead of TypeScript enums;
5. committed exact pinned goldens with hard-diff checking;
6. three representative complete maps plus exhaustive compact gate boundaries;
7. one machine API mapping generating documentation and checks;
8. lossless tagged NaN, infinities, and negative zero;
9. immutable plain `RegisterDef` objects exposed through a factory;
10. centralized datatype sizes and codec selection;
11. preserved finite sentinel metadata; and
12. `DataView` Float32 transfer with low word first.

**Decision coverage:** 12/12 honored, 0 not honored

## Behavioral Verification

### Current focused verification

The following fresh checks passed on the verified HEAD:

| Check                                               | Result                                     |
| --------------------------------------------------- | ------------------------------------------ |
| Phase-1 semantic/API/codec/register/scenario suites | 8 files, 176/176 tests passed              |
| Prettier                                            | passed                                     |
| ESLint                                              | passed                                     |
| Strict TypeScript typecheck                         | passed                                     |
| API parity and baseline generated-document check    | current, no regeneration required          |
| Build and package gate                              | passed                                     |
| Packed install smoke tests                          | 15 intended files; ESM and CommonJS passed |

The focused tests directly exercised the five observable truths and seven
requirements without running a second concurrent fixture-generation process.

### Recent full and independent evidence

- `01-SECURITY.md` records a focused audit run of 129 passed tests, zero open
  threats, and no generated contract diff on 2026-07-16.
- `01-REVIEW.md` records a clean DEEP review of 46 implementation files with
  zero critical, warning, or informational findings.
- `01-REVIEW-FIX.md` records all findings fixed across four iterations,
  including exact runtime `RegisterDef` closure, deterministic ordering,
  Python-compatible count boundaries, evidence-path containment, isolated
  Python provisioning, structural set ordering, safe-integer/source-set
  identity, and the final README key correction.
- The latest full parity check cited there passed against Python `0.7.6`, tag
  `v0.7.6`, full SHA
  `ad121ebf34a5f5e37204371c026927d77efcd15c`.
- The one historical aggregate timeout was environmental: the unchanged
  orchestration test passed alone in 169.67 seconds, while the remaining 243
  tests passed in the aggregate run. No assertion, timeout, or gate was
  weakened.

## Test Quality

| Area                   | Quality assessment                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Baseline and generator | Process-level rejection and success tests validate exact repository/tag/SHA/version identity, clean checkout, fixed output roots, atomicity, rollback, drift, and check-mode non-mutation. |
| Public API             | Tests require the exact 89-row inventory, 53/36 status split, exact 53 root runtime exports, empty web runtime, class/member closure, and bounded executable evidence.                     |
| Codecs                 | Value-level goldens cover both primitive and register-aware behavior, including actual bit patterns and error domains rather than symbol presence alone.                                   |
| Registers              | Full serialized object equality covers all 26 fields; builder tests cover formulas, boundaries, feature/model gates, immutability, registry lookup, and exact occupied-range overlaps.     |
| Tagged scenarios       | Mutation tests enforce a closed schema, immutable tagged values, deterministic ordering, resource bounds, provenance, and every required CTR-01 field.                                     |

No skipped, todo, disabled, placeholder, fixture-self-fulfilling, or
implementation-circular test pattern was found in the Phase-1 suites. Expected
fixtures come from the independently pinned Python reference and are compared
against native TypeScript implementations.

## Protocol-Invariant Verification

The sibling Python authority
`idm-heatpump-api/docs/Register-Map-Invariants.md` was read before register
verification. The implementation honors its mandatory rules:

- Float values remain IEEE-754 32-bit and occupy two 16-bit registers in
  low-word-first order.
- `humidity_sensor` remains `1392/FLOAT/size=2`; `hc_a_mode` remains the
  separate `1393/UCHAR/size=1` point.
- The exact occupied-range overlap set is retained at addresses 1393, 1442,
  and 1484.
- `RegisterRegistry` rejects duplicate exact
  `(register_type, start_address)` identities only; it permits official
  logical range overlaps.
- No no-overlap invariant, address shifting, datatype shrinking, or
  raw-byte-clamping workaround exists.
- Sentinel and write-safety metadata are preserved in the normalized schema.
- Navigator 1.0/1.7 addresses are not copied into the supported map.

## Anti-Patterns Found

Repository scans over Phase-1 source, tests, scripts, contracts, CI, and
documentation found no TODO, FIXME, XXX, HACK, placeholder implementation,
disabled test, or unsupported no-overlap rule. CLI `console` output and the
intentional register-codec `null` result for non-finite register values are
valid behavior, not stubs.

**Anti-patterns:** 0 blockers, 0 warnings

## Human Verification Required

None — Phase 1 is a deterministic semantic-contract foundation. All required
outcomes are observable through generated contracts, exact schemas, package
surfaces, and executable tests. Live device reads/writes and user-facing web
behavior are later-phase work and are not Phase-1 acceptance checks.

## Gaps Summary

**No gaps found.** All five success criteria, all seven Phase-1 requirements,
all declared artifacts, all declared key links, and all locked decisions are
verified. Phase 1 is ready to remain closed while Phases 2-5 implement the
explicitly planned transport, write, web, and release scopes.

## Verification Metadata

**Verification approach:** Goal-backward from the Phase-1 ROADMAP goal and
success criteria

**Must-haves source:** `ROADMAP.md`, `REQUIREMENTS.md`, and all ten Phase-1
plan frontmatters

**Artifact checks:** 44 passed, 0 failed

**Key-link checks:** 35 passed, 0 failed

**Observable truths:** 5 passed, 0 failed

**Requirements:** 7 satisfied, 0 blocked

**Decisions:** 12 honored, 0 not honored

**Fresh behavioral checks:** 176 tests plus format, lint, typecheck,
generated-doc, build, package, ESM, and CommonJS gates passed

**Human checks required:** 0

---

_Verified: 2026-07-16T16:47:40Z_

_Verifier: phase-01-verifier_
