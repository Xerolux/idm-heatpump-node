---
phase: 02-modbus-reads-detection-and-resilience
reviewed: 2026-07-17T00:24:49Z
depth: deep
files_reviewed: 38
files_reviewed_list:
  - contracts/api-mapping.json
  - contracts/normalization.md
  - contracts/typescript-extensions.json
  - docs/PARITY-CONTRACT.md
  - package.json
  - scripts/check-package.mjs
  - scripts/check-parity.mjs
  - scripts/generate-api-parity.mjs
  - scripts/generate-python-contract.py
  - src/client/detection.ts
  - src/client/diagnostics.ts
  - src/client/fifo-gate.ts
  - src/client/idm-modbus-client.ts
  - src/client/index.ts
  - src/client/internal-create.ts
  - src/client/read-groups.ts
  - src/contracts/transport-scenario.ts
  - src/index.ts
  - src/transport/errors.ts
  - src/transport/logging.ts
  - src/transport/modbus-serial-adapter.ts
  - src/transport/types.ts
  - test/client/batching.test.ts
  - test/client/detection.test.ts
  - test/client/diagnostics.test.ts
  - test/client/errors.test.ts
  - test/client/lifecycle.test.ts
  - test/client/reads.test.ts
  - test/client/resilience.test.ts
  - test/codec.test.ts
  - test/fixtures/transport-behavior.json
  - test/parity/api-parity.test.ts
  - test/parity/generator.test.ts
  - test/parity/phase-gate.test.ts
  - test/parity/transport-contract.test.ts
  - test/support/fake-clock.ts
  - test/support/fake-modbus-transport.ts
  - test/transport/modbus-serial-adapter.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 2: Code Review Report

**Reviewed:** 2026-07-17T00:24:49Z
**Depth:** deep
**Files Reviewed:** 38
**Status:** clean

## Narrative Findings (AI reviewer)

No critical, warning, or informational findings remain in the original Phase 2
review scope. The five atomic fix commits resolve every prior finding without
introducing a regression in the pinned Python `idm-heatpump-api` 0.7.6 read,
retry, diagnostics, batching, or transport behavior.

## Prior Finding Resolution

### CR-01: Successful `modbus-serial` close status

Resolved by `230c08e`. The adapter accepts the real dependency's normal
`false` close-event status while retaining closed normalization for `true` and
error objects. Boundary and client-level reconnect tests now exercise this
actual callback shape.

### CR-02: Pinned malformed-response diagnostic

Resolved by `2d5db12`. The adapter validates the response container and word
domain but leaves count validation to `IdmModbusClient`, so short and long
responses preserve the actual word count in the pinned Python-compatible
diagnostic. The real-adapter integration assertion matches the complete
`invalid_short_response` result and client error state.

### WR-01: Cumulative retry clock trace

Resolved by `42f44da`. `FakeClock` now separates requested delays from
cumulative observation timestamps, and the generated three-attempt scenario
proves the Python trace `[0.5, 1.5]` for delays of 0.5 and 1.0 seconds.

### WR-02: Special batch-result keys

Resolved by `1bb7fa0`. All grouped, individual-fallback, and top-level batch
accumulators use `Map` entries and `Object.fromEntries`, preserving own
enumerable `__proto__`, `constructor`, and `prototype` keys without changing
the result object's prototype. Result immutability and decoded `null` are also
covered.

### WR-03: Fractional probe timeouts

Resolved by `92e438d`. Every finite positive timeout is accepted and converted
from seconds to bounded milliseconds with binary64 round-half-to-even. Pinned
generated scenarios cover the fractional tie and smallest positive binary64
value, while focused tests also cover the even tie and invalid inputs.

## Verification Evidence

- `npm run parity:check` passed against Python package `0.7.6`, tag `v0.7.6`,
  commit `ad121ebf34a5f5e37204371c026927d77efcd15c`: seven fixtures, two generated
  documents, and nine generated artifacts are byte-stable.
- Focused re-review execution passed 87 tests across the real adapter,
  batching, resilience, generated transport contract, and generator suites.
- The fix workflow's full `npm run check` evidence remains green: 392 tests,
  coverage gates, build, and exact 15-file package smoke.
- `git diff --check` passed.

---

_Reviewed: 2026-07-17T00:24:49Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
