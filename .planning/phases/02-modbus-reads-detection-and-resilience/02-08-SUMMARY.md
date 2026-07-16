---
phase: 02-modbus-reads-detection-and-resilience
plan: "08"
subsystem: modbus-tcp-adapter
tags: [modbus, tcp, adapter, transport, resilience, supply-chain]

requires:
  - phase: 02-modbus-reads-detection-and-resilience
    provides: adapter-neutral transport requests, lifecycle, retries, normalized errors, and detection from Plans 02-01 through 02-07
provides:
  - Audited exact modbus-serial 8.0.25 runtime provider
  - Hidden real Modbus TCP adapter for exact FC03 and FC04 reads
  - Default public-construction wiring without adapter or dependency-injection leakage
affects: [phase-2-public-promotion, phase-2-closure, phase-3-writes]

tech-stack:
  added:
    - modbus-serial 8.0.25
  patterns:
    - Keep third-party Modbus objects behind the internal ModbusTransport boundary
    - Restore request-specific timeouts in finally before returning to the normal client policy
    - Classify Illegal Address only from structured numeric modbusCode 2

key-files:
  created:
    - src/transport/modbus-serial-adapter.ts
    - test/transport/modbus-serial-adapter.test.ts
  modified:
    - src/client/idm-modbus-client.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Use exactly modbus-serial 8.0.25 as the sole direct runtime dependency after matching npm metadata, official tagged source, tarball hashes, scripts, and lock integrity."
  - "Keep connection, FC03/FC04 selection, unit ID, timeout switching, word extraction, and third-party error normalization inside one non-public adapter module."
  - "Preserve client-owned retries by allowing exactly one library read call for each adapter attempt."

patterns-established:
  - "The real adapter returns only frozen validated 16-bit words and normalized package-owned failures."
  - "Normal IdmModbusClient construction selects the real provider internally while direct-path tests retain the private fake seam."

requirements-completed: [TRN-01, TRN-02, TRN-03R, ERR-01R]

duration: 14 min
completed: 2026-07-16
---

# Phase 02 Plan 08: Hidden Modbus TCP Adapter Summary

**The normal client now uses one audited, retry-neutral Modbus TCP adapter whose third-party API remains invisible to consumers.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-16T21:57:41Z
- **Completed:** 2026-07-16T22:12:07Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Re-verified and installed exact `modbus-serial@8.0.25` as the only direct runtime dependency while the package remains private.
- Implemented exact TCP host/port connection, unit-ID selection, seconds-to-milliseconds timeout conversion, FC03/FC04 dispatch, and one library read per client attempt.
- Validated exact response length and integer words in the range 0..65535 before returning immutable data.
- Restored temporary per-request timeouts in `finally` after success, numeric Code 2, socket failure, and invalid response.
- Normalized third-party connection/read/lifecycle failures into the package-owned closed error model with endpoint redaction and no leaked cause.
- Wrapped callback-based close and destroy operations as idempotent Promises and selected the adapter through normal public construction.

## Task Commits

Each task followed RED/GREEN TDD:

1. **Task 02-08-01 RED: dependency and adapter contract** - `17040ee`
2. **Task 02-08-02 GREEN: hidden adapter and default client wiring** - `115320e`

## Files Created/Modified

- `package.json` - Exact sole direct runtime dependency on `modbus-serial` 8.0.25.
- `package-lock.json` - Registry-resolved package graph with the verified package integrity.
- `src/transport/modbus-serial-adapter.ts` - Hidden real provider, response validation, error normalization, and lifecycle wrappers.
- `src/client/idm-modbus-client.ts` - Internal default binding for normal client construction.
- `test/transport/modbus-serial-adapter.test.ts` - Fully mocked dependency boundary and supply-chain/behavior assertions with no live socket.

## Decisions Made

- The adapter owns no retry policy: one adapter request invokes exactly one `modbus-serial` read, leaving all retries and reconnect decisions in `IdmModbusClient`.
- Only numeric `error.modbusCode === 2` creates `IllegalAddressError`; strings, other codes, messages, and localized text do not.
- Adapter/client factory types remain internal source-module details and do not enter package entry points, declarations, or the public constructor.
- A narrow constructor assertion bridges the dependency's CommonJS declaration shape under strict NodeNext compilation without exposing that shape elsewhere.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npm pack --pack-destination /tmp` hit Windows npm path conversion. Verification continued without weakening the gate by downloading the official registry tarball directly, matching its published SHA-1 and SHA-512, and byte-comparing the package metadata, declarations, and cited source files with the official `v8.0.25` Git tag.

## TDD Gate Compliance

- RED failed because the adapter module did not exist, after the exact dependency and lock integrity had been established.
- GREEN passes all 17 mocked adapter tests plus all 25 lifecycle/resilience regression tests.
- The RED commit precedes the GREEN commit and no behavioral assertion was removed or weakened.

## Automated Evidence

- Adapter, lifecycle, and resilience files pass 42/42 tests.
- Strict `npm run typecheck`, `npm run lint`, and `npm run format:check` pass.
- `npm run build` succeeds for ESM, CommonJS, declarations, and source maps.
- Public declaration scans contain no `modbus-serial`, `ModbusRTU`, adapter factory, client factory, or transport-factory name.
- `npm audit --omit=dev` reports zero vulnerabilities.
- `npm ls modbus-serial --depth=0` reports exactly `modbus-serial@8.0.25`.

## Supply-Chain Evidence

- npm name/version, repository URL, publication timestamp, deprecation state, and lifecycle scripts match the approved package.
- The package has no `preinstall`, `install`, or `postinstall` script.
- Published integrity is `sha512-T6OHW80k7DtYZF96onavw84IXNu44EW+fybgVftWAGOraL8vTmMZod8w6thOrWj2I2qHC9Gsn2nitVTUDih+6A==` and SHA-1 is `5999087b56b7ea26495fca40f5c3fbf5fe4257dc`.
- Official tag `v8.0.25` resolves to `73742ddeee2eb9ef72c348826abb23777852b782`.

## Security and Protocol Review

- Tests inject only a mocked dependency boundary and never open a TCP socket or contact hardware.
- The library owns all Modbus TCP framing; no socket parser or hand-written frame exists.
- Exact FC03/FC04 selection, unit IDs, addresses, counts, timeout restoration, response bounds, and numeric Code-2 semantics are executable assertions.
- Diagnostic messages redact configured endpoint values and do not retain third-party causes or response payloads.
- No write path, Navigator-1 support, register-map edit, private endpoint, credential, or hardware claim was added.

## User Setup Required

None - no credential, endpoint, network, device, or hardware action is required.

## Next Phase Readiness

- Plan 02-09 can promote the completed read/lifecycle surface without exposing adapter internals.
- Plan 02-10 can close Phase 2 against the complete public/read parity and release-block gates.

## Self-Check: PASSED

- All five implementation/test/dependency artifacts and this summary exist.
- Both RED/GREEN commits are present in Git history.
- Every task acceptance criterion and plan-level verification command passes.

---

_Phase: 02-modbus-reads-detection-and-resilience_  
_Completed: 2026-07-16_
