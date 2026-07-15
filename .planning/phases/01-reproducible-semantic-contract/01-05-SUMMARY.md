---
phase: 01-reproducible-semantic-contract
plan: "05"
subsystem: codec
tags: [typescript, dataview, float32, modbus, golden-contracts, parity]

requires:
  - phase: 01-reproducible-semantic-contract
    provides: immutable datatype/RegisterDef contracts, tagged exceptional values, and pinned Python codec fixtures
provides:
  - Six-method mapping-owned primitive ModbusCodec with low-word-first Float32 and exact signed integer behavior
  - Exhaustive internal register-aware decodeValue/encodeValue dispatch for every pinned datatype
  - Python-equivalent binary-float two-decimal rounding and round-half-even integer scaling
  - Focused and generated-golden evidence for primitive and register codec parity
affects: [transport-client, register-read, safe-writes, parity-closure]

tech-stack:
  added: []
  patterns:
    - Explicit little-endian DataView conversion without host-endian typed arrays
    - Datatype-specific validation and masking instead of a global Modbus-word guard
    - Exact BigInt decomposition for CPython-compatible binary-float rounding
    - Public primitive codec separated from internal register-aware unavailable-value handling

key-files:
  created:
    - src/codec.ts
    - test/codec.test.ts
    - test/parity/codec-contract.test.ts
  modified: []

key-decisions:
  - "Preserve primitive NaN, infinities, and negative zero while mapping only register-aware raw non-finite Float32 values to null."
  - "Keep decodeValue and encodeValue internal to src/codec.ts; only the mapping-owned ModbusCodec class is eligible for the later public export promotion."
  - "Use exact IEEE-754 decomposition and BigInt arithmetic to reproduce CPython round(value, 2), including tie-sensitive values JavaScript decimal shortcuts get wrong."

patterns-established:
  - "Codec domains: each datatype mirrors its pinned Python pack, mask, sign, scaling, and pass-through rules independently."
  - "Codec ownership: mapping closure applies to the six-method ModbusCodec class, while client-layer helpers remain internal until their owning phase."
  - "Exceptional numbers: primitive bit behavior and register-layer availability semantics are deliberately separate contracts."

requirements-completed: [COD-01]

duration: 15 min
completed: 2026-07-15
---

# Phase 01 Plan 05: Bit-Exact Codec Parity Summary

**Primitive and register-aware Modbus codecs now reproduce pinned Python 0.7.6 bits, datatype domains, exceptional values, scaling, and rounding without exposing later client behavior.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-15T01:04:31Z
- **Completed:** 2026-07-15T01:19:01Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Implemented the exact six-static-method `ModbusCodec` surface with explicit little-endian `DataView` operations, low-word-first Float32 ordering, swapped handling, extra-word behavior, and Float32 representability rejection.
- Matched Python's datatype-specific integer behavior: primitive INT8/INT16 decoding masks arbitrary integers, UCHAR/BITFLAG/BOOL apply their own first-word masks, and unscaled UINT16 passes its first word through directly.
- Added exhaustive register-aware decoding and encoding for FLOAT, UCHAR, INT8, INT16, UINT16, BOOL, and BITFLAG with exact size checks, multipliers, signs, sentinels, and newly owned frozen word arrays.
- Reproduced CPython round-half-even integer scaling and binary-float `round(value, 2)`, including positive/negative ties, nearby values, and `1.125 -> 1.12`.
- Kept primitive non-finite values bit-preserving while register-aware raw NaN/infinities become `null`; finite negative zero and documented finite sentinels remain unchanged.
- Proved mapping closure: the 89-row mapping owns only public `ModbusCodec`, the internal helpers have no mapping/root-export rows, and `IdmModbusClient` remains planned for Phase 2.

## Task Commits

Each task was committed atomically using RED/GREEN TDD:

1. **Task 01-05-01 RED: primitive codec contracts** - `2afbad0` (test)
2. **Task 01-05-01 GREEN: bit-exact primitive Modbus codecs** - `3eed262` (feat)
3. **Task 01-05-02 RED: register codec contracts** - `a40b3b4` (test)
4. **Task 01-05-02 GREEN: register-aware codec parity** - `8a97e8d` (feat)

## Files Created/Modified

- `src/codec.ts` - Mapping-owned primitive codec plus exhaustive internal register-aware dispatch and exact Python rounding helpers.
- `test/codec.test.ts` - Focused bit, validation, rounding, datatype-domain, immutability, and public-boundary evidence.
- `test/parity/codec-contract.test.ts` - Strict generated golden-vector execution for all primitive and register-aware cases.

## Decisions Made

- Primitive `ModbusCodec` preserves NaN, both infinities, and negative zero because those are public bit-conversion semantics. Only register-aware FLOAT decoding applies Python's unavailable-value `null` conversion.
- `decodeValue` and `encodeValue` are exported only by the internal source module for reuse and direct contract testing. They are absent from `src/index.ts` and the API mapping, so this plan does not prematurely claim `IdmModbusClient` parity.
- Python two-decimal rounding is implemented from the exact IEEE-754 binary value with BigInt rational arithmetic. This matches CPython's correctly rounded behavior for ties and adjacent values without `Math.round`.
- Validation stays datatype-specific: FLOAT consumes packable unsigned 16-bit words, while masked integer datatypes retain Python's acceptance of negative and oversized integers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the primitive generated-vector runner's mixed expected shape**

- **Found during:** Task 01-05-01 GREEN
- **Issue:** The `encode_decode_float32` fixture returns tagged object results for exceptional numbers but scalar results for finite subnormal/maximum values; the initial RED runner assumed one universal object shape.
- **Fix:** Made the runner follow each generated case's actual operation/result shape without changing fixture data or codec semantics.
- **Files modified:** `test/parity/codec-contract.test.ts`
- **Verification:** Every primitive golden case passes structurally, including tagged NaN/infinity/-0 and finite extrema.
- **Committed in:** `3eed262`

**2. [Rule 1 - Bug] Corrected the register generated-vector runner's round-case input field**

- **Found during:** Task 01-05-02 GREEN
- **Issue:** The generated `decode_value` rounding case carries a `values` array rather than encoded `words`; the initial RED runner assumed all decode cases used words.
- **Fix:** Routed that named generated operation through Float32 encode plus register-aware decode for each provided value, matching the fixture contract.
- **Files modified:** `test/parity/codec-contract.test.ts`
- **Verification:** All generated two-decimal tie and adjacent-value cases pass against pinned Python results.
- **Committed in:** `8a97e8d`

**3. [Rule 3 - Blocking] Reconciled stale state progress after the GSD update handler**

- **Found during:** Plan close-out
- **Issue:** The state handler found 6/10 summaries and reported 60% but persisted `percent: 0`, retained the prior 50% body bar/activity, and did not aggregate the newly recorded metric into velocity totals.
- **Fix:** Reconciled STATE.md to 6/10, 60%, current Plan 05 activity, and the complete six-plan metric history.
- **Files modified:** `.planning/STATE.md`
- **Verification:** Frontmatter, current position, progress bar, activity, duration totals, averages, trend, and per-plan metric rows now agree.
- **Committed in:** Plan metadata commit

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** Test-harness and tracking corrections only; no scope expansion, dependency change, transport behavior, or public API broadening.

## Issues Encountered

- Two accidentally overlapping full-suite invocations competed for Vitest's shared temporary coverage directory. A single clean rerun passed completely; this was execution-process contention, not a source or test failure.

## TDD Gate Compliance

- RED commits: `2afbad0`, `a40b3b4`
- GREEN commits: `3eed262`, `8a97e8d`
- Both RED runs failed for the intended absent primitive or register-aware codec implementation before their respective GREEN changes.

## Verification

- Focused codec suites: 65/65 tests passed.
- Full repository coverage run: 9/9 test files and 193/193 tests passed.
- Repository coverage: 90.89% statements, 91.10% branches, 87.41% functions, and 90.93% lines.
- `src/codec.ts` coverage: 92.44% statements, 86.08% branches, 100% functions, and 92.39% lines.
- `npm run check` passed format, ESLint, strict TypeScript, coverage, ESM/CommonJS build, package allowlist, and both package smoke tests.
- Focused mapping tests proved exactly six public static methods, no helper mapping rows, no root helper exports, and an unchanged planned `IdmModbusClient` row.
- Source checks found no `Math.round`, Node `Buffer`, host-endian typed-array codec, placeholder, or transport/write implementation.

## Known Stubs

None. Transport, model detection, write validation/execution, and public-root promotion remain intentionally owned by later plans rather than stubbed here.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-06 can build the complete register catalog on the same immutable datatype and RegisterDef semantics consumed by the codecs.
- Later transport and write phases can reuse internal register-aware conversion without duplicating Python scaling, unavailable handling, or rounding behavior.
- Plan 01-09 retains sole responsibility for promoting evidenced mapping rows and exposing approved root exports.

## Self-Check: PASSED

- All three planned source/test artifacts and this summary exist on disk.
- All four RED/GREEN commits exist in Git history in the required order.
- Both task verification commands, every acceptance criterion, full-suite checks, coverage, strict typecheck, lint, format, build, package smoke checks, mapping ownership, internal export boundary, and no-stub scan passed.

---

_Phase: 01-reproducible-semantic-contract_  
_Completed: 2026-07-15_
