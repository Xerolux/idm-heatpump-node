---
phase: 03-safe-write-parity
reviewed: 2026-07-17T05:20:04Z
depth: deep
files_reviewed: 53
files_reviewed_list:
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/STATE.md
  - .planning/phases/03-safe-write-parity/03-01-PLAN.md
  - .planning/phases/03-safe-write-parity/03-01-SUMMARY.md
  - .planning/phases/03-safe-write-parity/03-02-PLAN.md
  - .planning/phases/03-safe-write-parity/03-02-SUMMARY.md
  - .planning/phases/03-safe-write-parity/03-03-PLAN.md
  - .planning/phases/03-safe-write-parity/03-03-SUMMARY.md
  - .planning/phases/03-safe-write-parity/03-04-PLAN.md
  - .planning/phases/03-safe-write-parity/03-04-SUMMARY.md
  - .planning/phases/03-safe-write-parity/03-05-PLAN.md
  - .planning/phases/03-safe-write-parity/03-05-SUMMARY.md
  - .planning/phases/03-safe-write-parity/03-06-PLAN.md
  - .planning/phases/03-safe-write-parity/03-06-SUMMARY.md
  - .planning/phases/03-safe-write-parity/03-07-PLAN.md
  - .planning/phases/03-safe-write-parity/03-07-SUMMARY.md
  - .planning/phases/03-safe-write-parity/03-VALIDATION.md
  - CHANGELOG.md
  - README.md
  - contracts/api-mapping.json
  - contracts/normalization.md
  - docs/API-PARITY.md
  - scripts/check-package.mjs
  - scripts/check-parity.mjs
  - scripts/generate-python-contract.py
  - src/client/idm-modbus-client.ts
  - src/client/index.ts
  - src/client/internal-create.ts
  - src/client/write-safety.ts
  - src/contracts/write-scenario.ts
  - src/errors.ts
  - src/index.ts
  - src/transport/errors.ts
  - src/transport/modbus-serial-adapter.ts
  - src/transport/types.ts
  - test/client/batching.test.ts
  - test/client/errors.test.ts
  - test/client/lifecycle.test.ts
  - test/client/reads.test.ts
  - test/client/resilience.test.ts
  - test/client/write-execution.test.ts
  - test/client/write-state.test.ts
  - test/client/write-validation.test.ts
  - test/fixtures/write-behavior.json
  - test/parity/api-parity.test.ts
  - test/parity/generator.test.ts
  - test/parity/phase-gate.test.ts
  - test/parity/write-contract.test.ts
  - test/support/fake-modbus-transport.ts
  - test/support/write-scenario-runner.ts
  - test/transport/modbus-serial-adapter.test.ts
  - test/transport/write-request.test.ts
findings:
  critical: 1
  warning: 2
  info: 0
  total: 3
status: resolved
---

# Phase 3: Code Review Report

**Reviewed:** 2026-07-17T05:20:04Z

**Depth:** deep

**Files Reviewed:** 53

**Status:** resolved

## Resolution

All three findings were resolved before final parity closure:

- numeric strings now follow the Python conversion domain, with generated
  accepted and rejected cross-repository scenarios;
- generated write rejections verify the exact Python exception family and
  terminal validation guard;
- `03-VALIDATION.md` records the completed Wave-0 and task evidence.

## Narrative Findings (AI reviewer)

The FC16 request boundary, whole-operation FIFO, retry/reconnect path,
acknowledgement validation, success-only state commits, error redaction, closed
fixture parser, and installed ESM/CJS/declaration surface are generally
disciplined. One public value domain nevertheless differs from the exact pinned
Python authority, so Phase 3 is not yet functionally equivalent. Two evidence
issues should also be corrected before the phase is called complete.

## Summary

The release-blocking defect is that the Node client rejects numeric strings for
non-BOOL registers while pinned Python 0.7.6 accepts and encodes them. The
generated contract contains no accepted numeric-string scenario, so all focused
write tests still pass. The generator also trusts any exception as the expected
validation stage when a manually assigned code exists, and the phase validation
artifact still reports every implemented task as Wave-0 pending.

## Critical Issues

### CR-01: Numeric strings accepted by pinned Python are rejected by the public Node write API

**File:** `src/client/write-safety.ts:319-345`

**Affected:** `src/client/idm-modbus-client.ts:625-665`,
`test/fixtures/write-behavior.json`, `test/client/write-validation.test.ts`

**Issue:** For every non-BOOL register, TypeScript requires
`typeof value === "number"` and emits `write_not_numeric` for a string. The
pinned Python authority instead calls `float(value)` during validation
(`idm_heatpump/client.py` at
`ad121ebf34a5f5e37204371c026927d77efcd15c:1263-1269`) and again in every
numeric encoder (`:1070-1098`). Consequently Python accepts values such as
`"40"` for `dhw_setpoint`, verifies their range/integer domain, and encodes the
same word as numeric `40`; all three public Node entry points accept `unknown`
but reject that call before encoding. This conversion is not an approved
normalization: `contracts/normalization.md:3-5` says every unlisted difference
must fail parity verification.

A no-I/O public reproduction against the built package and pinned Python
checkout produced:

```text
Node simulateWrite("dhw_setpoint", "40") -> write_not_numeric
Node simulateWrite("dhw_setpoint", 40)   -> encodedRegisters [40]
Python simulate_write("dhw_setpoint", "40") -> encoded_registers (40,)
Python simulate_write("dhw_setpoint", 40)   -> encoded_registers (40,)
```

**Fix:** Normalize the non-BOOL input once using a closed conversion that
matches the pinned Python `float()` acceptance domain, retain the original value
in `requestedValue`, and validate/encode the normalized finite number. Do not
use JavaScript `Number()` without an explicit guard because it accepts values
such as the empty string that Python rejects. Add generated cross-repository
cases for at least accepted integer and floating numeric strings, rejected empty
and nonnumeric strings, exponent notation, whitespace handling, and non-finite
strings; exercise `simulateWrite`, dry-run `setValue`, and a fake-transport real
write without live hardware.

## Warnings

### WR-01: The Python generator can relabel an unrelated exception as the expected validation reason

**File:** `scripts/generate-python-contract.py:2712-2724`

**Affected:** `scripts/generate-python-contract.py:2768-2803`,
`test/parity/generator.test.ts`, `test/fixtures/write-behavior.json`

**Issue:** Each rejection scenario supplies a reviewed code in
`validation_codes`, but the execution loop catches broad `Exception` and emits
that code for any thrown exception. It does not verify the expected Python
exception family or establish that the targeted ordered guard produced the
failure. An unexpected `AttributeError`, harness `RuntimeError`, codec defect,
or failure in a different validation stage is therefore serialized as the
case-owned reason at lines 2782-2789. Exact diagnostics happen to make many
such drifts visible in the current TypeScript runner, but the Phase-3 research
explicitly says diagnostics must not establish equivalence; the structured code
is the authoritative reason.

**Fix:** Give every generated rejection case a closed verifier that proves the
expected upstream exception family and validation stage without message
matching. Fail generation for every unexpected class/stage before emitting a
fixture. Add a generator regression/mutation test that substitutes an unrelated
exception for a validation action and asserts transactional generation failure.

### WR-02: The committed validation strategy still declares the completed phase as Wave-0 pending

**File:** `.planning/phases/03-safe-write-parity/03-VALIDATION.md:1-6`

**Affected:** `.planning/phases/03-safe-write-parity/03-VALIDATION.md:43-60`,
`.planning/phases/03-safe-write-parity/03-VALIDATION.md:82-94`,
`.planning/ROADMAP.md`, `.planning/STATE.md`

**Issue:** The roadmap, state, seven summaries, and changelog claim Phase 3 is
complete, while its validation authority remains `status: draft`,
`wave_0_complete: false`; all 14 task rows are `pending`; and all Wave-0
requirements are unchecked. Most rows even say their now-present files are
missing. This contradictory evidence can cause phase verification and later
handoffs to accept the completion claims without a trustworthy task-to-test
record.

**Fix:** After CR-01 and WR-01 are fixed and the full phase gate is rerun, update
the frontmatter, every task row, Wave-0 checklist, and sign-off to the observed
state and exact commands/results. If any row is not green, reopen the phase
instead of marking the artifact complete.

## Verification Evidence

- Reviewed all 53 implementation, test, fixture, script, contract, package, and
  planning files changed from `08676d3^` through `2668b5b`, plus the complete
  Phase-3 context/research and pinned Python source/docs at
  `ad121ebf34a5f5e37204371c026927d77efcd15c`.
- Focused Phase-3 Vitest command passed all 120 tests across six files.
- `npm run build` succeeded before the public package reproduction.
- The numeric-string comparison used simulation only; it made no connection and
  sent no Modbus request.
- No implementation file was modified by this review.

---

_Reviewed: 2026-07-17T05:20:04Z_

_Reviewer: the agent (gsd-code-reviewer)_

_Depth: deep_
