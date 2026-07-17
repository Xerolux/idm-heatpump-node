---
status: all_fixed
findings_in_scope: 5
fixed: 5
skipped: 0
iteration: 1
---

# Phase 02 Code Review Fix — Iteration 1

## Result

All five findings from `02-REVIEW.md` are fixed in separate atomic commits.
No register address, datatype, size, register type, model gate, function code,
overlap rule, write path, or write-safety metadata changed.

## Findings fixed

### CR-01 — successful `modbus-serial` close status

Commit `230c08e` accepts the pinned dependency's normal `false` close callback
status while preserving `true` and error objects as failures. The boundary fake
now models the installed dependency, and a client-level timeout/reconnect test
proves that a normal close cannot abort reconnection.

### CR-02 — pinned malformed-response diagnostics

Commit `2d5db12` leaves response-count ownership with `IdmModbusClient` while
the adapter still validates the response container and every 16-bit word. A
real-adapter integration test compares the complete short-response result and
error state with the pinned `invalid_short_response` fixture, including the
actual word count and exact Python-compatible message.

### WR-01 — cumulative retry clock observations

Commit `42f44da` separates requested delays from cumulative clock observations.
The generated three-attempt retry scenario now proves delays of 0.5 and 1.0
seconds as the cumulative trace `[0.5, 1.5]`. The fixture was generated from
the exact Python `0.7.6` tag and commit.

### WR-02 — special batch-result keys

Commit `1bb7fa0` accumulates every grouped, fallback, and top-level batch result
through `Map` entries and materializes the public record with
`Object.fromEntries`. Tests prove own enumerable `__proto__`, `constructor`,
and `prototype` properties, a decoded `null` value, an unchanged
`Object.prototype`, and immutable results.

### WR-03 — positive fractional probe timeouts

Commit `92e438d` defines one explicit seconds-to-milliseconds normalization:
binary64 half-even rounding bounded to `1..2147483647`. Every finite positive
timeout remains accepted, including sub-millisecond values, while invalid zero
and non-finite inputs remain rejected. Pinned generated scenarios prove
`0.0015 s -> 2 ms` and the smallest positive binary64 value `-> 1 ms`; a
focused test additionally proves the even tie `0.0025 s -> 2 ms`.

## Verification

- Focused adapter, reconnect, batching, transport-contract, generator, and
  resilience suites passed throughout the five fixes.
- `npm run parity:check` passed against `idm-heatpump-api@0.7.6`, tag `v0.7.6`,
  commit `ad121ebf34a5f5e37204371c026927d77efcd15c`: seven fixtures and two
  generated documents are byte-stable.
- `npm run check` passed end to end: format, ESLint, strict TypeScript,
  392 tests passed with one intentional Windows symlink skip, coverage passed
  at 92.36% statements / 90.38% branches / 92.58% functions / 92.54% lines,
  build passed, and the exact 15-file ESM/CommonJS/declaration package smoke
  passed without connecting.
- `npm audit --omit=dev` reported zero vulnerabilities.
- `git diff --check` passed before every commit.

This report intentionally remains uncommitted for the orchestrator.
