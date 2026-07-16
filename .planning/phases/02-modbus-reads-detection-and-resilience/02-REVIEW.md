---
phase: 02-modbus-reads-detection-and-resilience
reviewed: 2026-07-16T23:38:36Z
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
  critical: 2
  warning: 3
  info: 0
  total: 5
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-07-16T23:38:36Z  
**Depth:** deep  
**Files Reviewed:** 38  
**Status:** issues_found

## Narrative Findings (AI reviewer)

The read-side architecture is generally disciplined, but the real transport boundary was not exercised with the callback and response shapes delivered by the pinned dependency. That leaves two release-blocking differences between the passing synthetic suite and actual TCP use. Three additional edge cases weaken the executable parity contract or return incorrect public results.

## Summary

Two blockers must be fixed before Phase 2 can ship: a normal TCP close is treated as an error, and malformed response diagnostics differ between the real adapter path and the pinned Python contract. The warnings cover an accidentally under-specified multi-retry clock trace, unsafe handling of valid register names in batch result objects, and rejection of valid fractional Python timeout values.

## Critical Issues

### CR-01: A successful `modbus-serial` TCP close is rejected as a transport failure

**File:** `src/transport/modbus-serial-adapter.ts:217-229`  
**Affected:** `src/client/idm-modbus-client.ts:710-719`, `src/client/idm-modbus-client.ts:799-816`, `test/transport/modbus-serial-adapter.test.ts:82-87`

**Issue:** `#invokeLifecycle()` accepts only `undefined` and `null` as successful callback values. The pinned `modbus-serial@8.0.25` TCP port forwards Node's socket `close` event argument to this callback; a normal socket close supplies `hadError === false`. The adapter therefore converts every ordinary TCP close into a `disconnected` failure. Public `disconnect()` rejects even though the socket closed, and the reconnect path aborts at `#closeTransportLocked()` before opening the replacement connection. The test double always calls `callback(undefined)`, so it does not model the installed dependency and cannot reveal the failure.

**Fix:** Treat the dependency's `false` close status as success while preserving `true`/real error objects as failures, and make the boundary/test double model the actual callback contract. At minimum:

```ts
const finish = (error?: unknown): void => {
  if (settled) return;
  settled = true;
  if (error === undefined || error === null || error === false) {
    resolve();
  } else {
    reject(normalizeAdapterError(error, operation, this.#endpoint));
  }
};
```

Add tests where `close()` calls back with both `false` and `true`, plus a client-level reconnect test using that realistic boundary.

### CR-02: Real-adapter short responses bypass the pinned invalid-response diagnostic

**File:** `src/transport/modbus-serial-adapter.ts:106-127`  
**Affected:** `src/client/idm-modbus-client.ts:766-777`, `test/fixtures/transport-behavior.json:1219-1265`

**Issue:** The adapter validates response length first and replaces every malformed array with `Invalid Modbus response ... expected exactly N words`, discarding the actual count. The client contains the Python-compatible diagnostic (`Incomplete Modbus response ... got N registers, expected C`), but the real adapter throws before that validation can execute. The generated contract explicitly requires the latter message in both the returned error and `lastError`; the contract runner passes only because its fake transport deliberately permits the short array through to the client. Thus the real package and the executable pinned fixture disagree on an observable diagnostics API.

**Fix:** Preserve the actual array length at the adapter boundary and emit the same normalized short/long-response diagnostic as the client, or let array-count validation be owned solely by the client while the adapter validates only the response container and word domain. Add an integration assertion that routes a one-word `modbus-serial` boundary response through `IdmModbusClient` and compares the full result/error context with the `invalid_short_response` fixture.

## Warnings

### WR-01: Python and TypeScript give different meanings to multi-retry `clock` traces

**File:** `scripts/generate-python-contract.py:1214-1220`  
**Affected:** `test/parity/transport-contract.test.ts:977-983`, `test/support/fake-clock.ts:20-27`

**Issue:** Python appends cumulative elapsed times, while the TypeScript runner returns the individual sleep durations. Existing generated scenarios contain only one sleep, so both happen to produce `[0.5]`. With three attempts, correct backoff produces Python `[0.5, 1.5]` but TypeScript `[0.5, 1]`. The cross-repository gate therefore does not currently prove retry timing beyond the first delay and will fail for the wrong reason as soon as such a scenario is added.

**Fix:** Define `clock` consistently as cumulative observation times (matching the current pinned generator), expose those observations from `FakeClock`, and add a generated three-attempt scenario that requires `0.5` then `1.0` seconds of backoff and compares the resulting `[0.5, 1.5]` trace.

### WR-02: Valid `__proto__` register names disappear from batch results

**File:** `src/client/idm-modbus-client.ts:554-563`  
**Affected:** `src/client/idm-modbus-client.ts:587-609`, `src/client/idm-modbus-client.ts:612-654`

**Issue:** Public `RegisterDef` values permit arbitrary string names, including `__proto__`, and Python dictionaries preserve that key. The batch paths accumulate results in ordinary `{}` objects using indexed assignment and `Object.assign`. On such objects, `data["__proto__"] = decodedPrimitive` invokes the legacy prototype setter instead of creating an own result property, so the successfully decoded value is silently omitted. A decoded `null` can additionally change the result object's prototype. This is both a parity defect for custom registers and an unsafe object-key boundary.

**Fix:** Accumulate dynamic keys in a `Map` and materialize them with `Object.fromEntries`, or use null-prototype records plus `Object.defineProperty`/safe entry copying. Apply the same mechanism to every batch/group/fallback accumulator. Add custom-register tests for `__proto__`, `constructor`, and `prototype`, asserting own enumerable properties and an unchanged prototype.

### WR-03: `probeRegister` rejects fractional timeouts accepted by Python

**File:** `src/client/idm-modbus-client.ts:178-189`  
**Affected:** `src/transport/types.ts:73-79`

**Issue:** Python's public `probe_register(timeout: float | None)` forwards any positive fractional seconds value to `asyncio.wait_for`. TypeScript rejects the same value whenever seconds multiplied by 1000 is not an integer (for example `0.0015`). Whole-millisecond resolution is neither an audited normalization nor part of the public contract, so valid upstream calls can fail before any Modbus request.

**Fix:** Specify an explicit cross-language timeout conversion and implement it consistently in the generator and client (for example the generator's bounded half-even millisecond rounding), or allow finite positive fractional milliseconds through the transport request if the adapter supports them. Add pinned scenarios for a non-whole-millisecond timeout and the lower positive boundary so acceptance and request shape cannot drift.

---

_Reviewed: 2026-07-16T23:38:36Z_  
_Reviewer: the agent (gsd-code-reviewer)_  
_Depth: deep_
