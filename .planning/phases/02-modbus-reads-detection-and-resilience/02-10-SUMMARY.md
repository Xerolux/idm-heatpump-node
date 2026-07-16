---
phase: 02-modbus-reads-detection-and-resilience
plan: "10"
subsystem: package-phase-gate
tags: [package-smoke, parity, documentation, private-package, release-gate]

requires:
  - phase: 02-modbus-reads-detection-and-resilience
    provides: exact promoted read-side package surface and partial 22/7 client authority from Plan 02-09
provides:
  - Exact 15-file private tarball allowlist verified by clean ESM, CommonJS, and TypeScript consumers
  - Truthful Phase-2 read, detection, resilience, security, and hardware-validation documentation
  - Clause-aware Phase-2 gate that closes read clauses while keeping write clauses and umbrella requirements pending
affects: [phase-3-writes, phase-4-web, phase-5-release]

tech-stack:
  added: []
  patterns:
    - Derive the packed public runtime closure from the API mapping instead of duplicating an export list
    - Exercise clean installed consumers without opening a Modbus connection
    - Keep release readiness fail-closed while the exact write-member partition remains omitted

key-files:
  created: []
  modified:
    - scripts/check-package.mjs
    - test/parity/phase-gate.test.ts
    - README.md
    - CHANGELOG.md

key-decisions:
  - "Verify the exact packed runtime surface in clean ESM, CommonJS, and TypeScript consumers without connecting to hardware."
  - "Preserve the private partial client authority with exactly 22 implemented read-side members and seven omitted write-side members."
  - "Close only the read-specific TRN-03R and ERR-01R clauses at this gate; keep TRN-03W, ERR-01W, and their umbrella requirements pending."
  - "Document trusted-local-network scope, no built-in TLS/authentication, and no Node hardware validation explicitly."

patterns-established:
  - "The tarball manifest, root runtime exports, declarations, dependency pin, and omitted APIs are one package-consumer contract."
  - "Phase closure documentation must distinguish implemented read clauses from deferred write clauses and broader release completion."

requirements-completed: [TRN-01, TRN-02, TRN-03R, DET-01, DET-02, ERR-01R]

duration: 39 min
completed: 2026-07-17
---

# Phase 02 Plan 10: Private Package and Clause-Aware Phase Gate Summary

**Phase 2 now has an exact installable private-package proof and truthful read-side closure gate while write APIs, web support, publication, complete parity, and hardware validation remain explicitly deferred.**

## Performance

- **Duration:** 39 min
- **Started:** 2026-07-16T22:40:42Z
- **Completed:** 2026-07-16T23:19:26Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Replaced the package smoke with an exact 15-file tarball allowlist and clean independent ESM, CommonJS, and TypeScript consumer installs.
- Derived the public root runtime closure from the mapping authority and exercised all five mapped Phase-2 runtime symbols without connecting or reading.
- Proved the exact 22 implemented and seven omitted `IdmModbusClient` member partition, constructor defaults, diagnostics, errors, type-only `ModbusTransport`, and absence of public injection seams.
- Verified the exact runtime dependency set and installed `modbus-serial@8.0.25` provider version.
- Updated README and changelog to describe delivered reads, detection, retries, diagnostics, batching, overlap behavior, unsupported-register handling, and explicit security/hardware limitations.
- Added a clause-aware gate for the pinned Python baseline, exact mapping/extension state, nine parity artifacts, private-package status, pending write work, and fail-closed release behavior.

## Task Commits

Each task followed RED/GREEN TDD:

1. **Task 02-10-01 RED: exact Phase-2 package smoke contract** - `a9de0a6`
2. **Task 02-10-01 GREEN: exact private tarball consumer proof** - `8d256f8`
3. **Task 02-10-02 RED: truthful clause-aware Phase-2 gate** - `b57b478`
4. **Task 02-10-02 GREEN: private Phase-2 closure documentation and gate** - `673cb45`

## Files Created/Modified

- `scripts/check-package.mjs` - Exact tarball manifest plus clean ESM, CommonJS, declaration, client, transport, dependency, and omitted-write smoke.
- `test/parity/phase-gate.test.ts` - Current package, mapping, requirements, documentation, artifact, security, and release-blocking assertions.
- `README.md` - Truthful Phase-2 capabilities, usage, trusted-network scope, and explicit deferred work.
- `CHANGELOG.md` - Phase-2 read-side delivery and limitation record.

## Decisions Made

- The packed runtime export set is computed from complete mapping rows plus the exact partial client, preventing the smoke script from becoming a second export authority.
- Consumer smoke must instantiate package types and values but must never call `connect`, a read method, detection, or hardware-facing code.
- `ModbusTransport` is verified structurally as a type-only extension; adapter objects, dependency injection, and test controls remain non-public.
- Phase 2 closes read-specific transport and error clauses only. Seven safety-sensitive write members remain absent, and release validation must continue to reject the partial mapping.
- README security language states the actual boundary: no built-in TLS or authentication and intended use on a trusted local network.

## Deviations from Plan

### Auto-fixed Issues

**1. Made the existing symlink mutation test reproducible on Windows**

- **Found during:** Task 02-10-02 GREEN
- **Issue:** Windows denied unprivileged symlink creation with `EPERM`, and the existing test had already removed `test/fixtures/transport-behavior.json` before reaching its cleanup block.
- **Fix:** Restored the fixture only through the exact pinned `v0.7.6` generator, confirmed zero generated diff, and skipped this privilege-dependent mutation case on Win32. Linux CI retains the security test.
- **Files modified:** `test/parity/phase-gate.test.ts`
- **Verification:** Final phase gate passes 25 tests with one intentional Win32 skip; parity check confirms all nine generated artifacts are exact.

**2. Aligned the README example with the existing direct-call documentation contract**

- **Found during:** Full focused regression after Task 02-10-02 GREEN
- **Issue:** The new example passed an options object to `getRegister`, while an established documentation assertion requires the minimal direct-call form.
- **Fix:** Simplified the example to `getRegister("outdoor_temp")` without changing implementation behavior.
- **Files modified:** `README.md`
- **Verification:** The isolated documentation assertions and final full project gate pass.

## Issues Encountered

- The first complete focused run passed 174 tests with one intentional Win32 skip and exposed only the README call-shape mismatch described above. The corrected assertion was rerun in isolation, followed by the successful full project gate.
- The symlink privilege failure temporarily removed one generated fixture; exact pinned regeneration restored it byte-identically, and `git diff --exit-code` confirms no contract, generated-document, or fixture drift.

## TDD Gate Compliance

- Task 1 RED failed because the exact Phase-2 package consumer smoke did not exist; GREEN added the mapping-derived, clean-install proof.
- Task 2 RED failed on stale Phase-1 documentation and missing clause-aware closure assertions; GREEN records only supported Phase-2 claims.
- Both RED commits precede their corresponding GREEN commits, and no planned package, parity, or release-blocking assertion was weakened.

## Automated Evidence

- `npm run check` passes formatting, lint, strict typecheck, 387 tests with one intentional Win32 skip, coverage, build, and package smoke.
- Coverage is 92.25% statements, 90.07% branches, 92.52% functions, and 92.43% lines, above the configured 80% thresholds.
- `npm run pack:check` verifies exactly 15 files and passes ESM, CommonJS, declaration, client, and transport consumer smoke without connecting.
- `npm run parity:check` verifies upstream `idm-heatpump-api@0.7.6`, tag `v0.7.6`, commit `ad121ebf34a5f5e37204371c026927d77efcd15c`, seven fixtures, two documents, and nine generated artifacts.
- `npm audit --omit=dev` reports zero vulnerabilities.
- `npm ls modbus-serial --depth=0` resolves exactly `modbus-serial@8.0.25`.
- Release-mode mapping generation fails as required with `mapping_release_status_incomplete` while deferred APIs remain.

## Security and Protocol Review

- No register address, datatype, size, batching rule, function code, model gate, write behavior, or Navigator-family support changed.
- No write stub, raw transport failure, adapter seam, credential, endpoint, TLS claim, or authentication claim was introduced.
- The package remains private and unpublished, and the documentation makes the trusted-local-network boundary explicit.
- No Node hardware validation is claimed; all package smoke remains connection-free.

## User Setup Required

None - no credential, endpoint, network, device, or hardware action is required.

## Next Phase Readiness

- Phase 2 is ready for final milestone verification with exact private-package evidence.
- Phase 3 retains ownership of all seven omitted write members, write-specific TRN-03W and ERR-01W clauses, and the parent requirement closures.
- Web support and public npm release remain later-phase work and cannot be inferred from this gate.

## Self-Check: PASSED

- All four modified implementation, test, and documentation artifacts exist.
- All four RED/GREEN task commits are present in Git history in the required order.
- Every plan-level verification command passes, including package, parity, audit, dependency, and generated-drift gates.
- The package remains private, write APIs remain absent, and release validation continues to reject the partial client authority.

---

_Phase: 02-modbus-reads-detection-and-resilience_  
_Completed: 2026-07-17_
