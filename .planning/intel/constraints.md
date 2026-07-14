# Constraints

## Standalone TypeScript runtime and parity release policy

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/IMPLEMENTATION-PLAN.md
- type: nfr
- content: The package must be a standalone Node.js TypeScript implementation with no Python runtime or Python-package dependency. Python may be used only in development and CI as the cross-repository reference. Development is incremental, but publication is prohibited until full parity under `docs/PARITY-CONTRACT.md` is achieved.

## Target package structure

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/IMPLEMENTATION-PLAN.md
- type: schema
- content: The intended source layout separates public exports, constants, types, errors, codecs, register families and registry, transport abstraction and adapter, client batching/detection/write safety/diagnostics, optional web implementations and parsing, fixtures, parity tests, fake transport, scripts, examples, and documentation. The structure is rooted in `src/`, with tests in `test/` and dedicated `scripts/`, `examples/`, and `docs/` directories.

## Runtime, compiler, and module baseline

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/IMPLEMENTATION-PLAN.md
- type: nfr
- content: TypeScript strict mode is mandatory. Node.js 22 or newer is required, and CI must cover Node.js 22 and 24. ESM is the primary module format. CommonJS may be emitted only from the same source and must be tested separately.

## Modbus isolation and deterministic test infrastructure

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/IMPLEMENTATION-PLAN.md
- type: protocol
- content: The concrete Modbus library must be encapsulated behind `ModbusTransport`. `modbus-serial` is the intended first adapter and must not leak into domain logic. A fake transport and fake clock are core test components.

## Web export and platform boundaries

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/IMPLEMENTATION-PLAN.md
- type: api-contract
- content: The optional web supplement must be exposed through the `@xerolux/idm-heatpump/web` subpath. Browser support and telemetry are excluded.

## Tooling and package contract

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/IMPLEMENTATION-PLAN.md
- type: api-contract
- content: Phase 1 must establish package metadata, lockfile, TypeScript configuration, reproducible build, declarations, source maps, linting, formatting, Vitest, an explicit export map, controlled tarball contents, and CI on Node.js 22 and 24. The packed artifact must install successfully; ESM import and any offered CommonJS require must work from the tarball; development-only files must not leak into the package.

## Parity harness, codec, and register schema implementation

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/IMPLEMENTATION-PLAN.md
- type: schema
- content: Phase 2 must implement a Python contract generator, verify the committed `UPSTREAM-PARITY.json` in CI, inventory public Python exports, implement TypeScript types and codecs, port all register builders, and generate golden schemas for relevant model combinations. `docs/API-PARITY.md` must be generated or validated completely; codec vectors and normalized register schemas must match exactly; documented register overlaps must be preserved.

## Transport and read-path behavior

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/IMPLEMENTATION-PLAN.md
- type: protocol
- content: Phase 3 must implement real and fake `ModbusTransport` instances, connect/disconnect/reconnect, retry and backoff, single reads, safe batch reads, request serialization, Illegal Address handling, permanent-error handling, fallback, and batch-unsafe quarantine. Equivalent scenarios must produce identical request traces. Gaps and overlaps must remain separated, including distinct requests for `1392/count=2` and `1393/count=1`. All error and recovery contracts must pass.

## Model and feature detection boundary

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/IMPLEMENTATION-PLAN.md
- type: protocol
- content: Phase 4 must port Navigator 2.0, Navigator Pro, Navigator 10, firmware detection, heating circuits, zone modules, solar, ISC, PV, cascade, sentinels, unavailable slots, and register-map construction from detected capabilities. Python and TypeScript detection results, model gates, and schemas must be semantically equivalent. Navigator 1.0/1.7 remains unsupported.

## Write-safety implementation sequence and invariants

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/IMPLEMENTATION-PLAN.md
- type: protocol
- content: Phase 5 must first port write planning and dry-run, then validate type, range, enum, excluded values, and model membership, add a custom-register escape hatch without weakening remaining protections, connect real single- and multi-register writes, and port EEPROM throttling and cyclic TTL with a fake clock. Both implementations must accept and reject the same values and emit the same words and requests. Dry-run must send no request, and failed writes must not alter success state.

## Optional read-only web supplement

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/IMPLEMENTATION-PLAN.md
- type: api-contract
- content: Phase 6 must port Navigator 10 WebSocket access and Navigator 2.0 HTTP access including authentication and CSRF, plus parsers, cache, notifications, statistics, capabilities, diagnostics, error hierarchy, optional client factories, and PIN checking. Python web fixtures must normalize identically. A missing PIN must retain Modbus-only operation. The web module must remain optional and read-only.

## Full-parity and release-readiness gate

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/IMPLEMENTATION-PLAN.md
- type: nfr
- content: Phase 7 must port all remaining public symbols, close the API parity matrix, run the full cross-repository matrix, complete README/examples/API/security/changelog material, add upstream-version, scheduled, and repository-dispatch automation, and configure npm Trusted Publishing with provenance. No `planned`, `partial`, or unjustified `not_applicable` entry may remain. Branch coverage must be at least 80 percent. Local, cross-repository, tarball smoke, and latest-stable-Python-baseline gates must all pass.

## Initial release identity and changelog evidence

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/IMPLEMENTATION-PLAN.md
- type: api-contract
- content: The initial npm release is `0.1.0`; the low version reflects TypeScript API maturity rather than reduced scope. Its changelog must name the npm version, Python version and tag, complete Python commit SHA, cross-repository parity result, and hardware validations performed.

## Reproducible upstream baseline

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/PARITY-CONTRACT.md
- type: nfr
- content: `UPSTREAM-PARITY.json` is the authoritative checked reference and must contain the repository URL, Python package version, Git tag, full commit SHA, and parity-schema version. A branch such as `main` is not reproducible; releases may reference only fixed tags and commit SHAs.

## Public API semantic equivalence

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/PARITY-CONTRACT.md
- type: api-contract
- content: Every public Python export must have a semantically equivalent TypeScript counterpart. Idiomatic TypeScript names and types are allowed only when mapping and semantics are unambiguous and documented. Permitted normalizations include `None` to `null`, tuple to readonly array, set to sorted contract array, snake_case to camelCase, and Python enum to string-literal union or `as const` map. Missing functions, weaker validation, and changed defaults are forbidden.

## Exact register-schema parity

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/PARITY-CONTRACT.md
- type: schema
- content: For every supported model and feature combination, both implementations must agree on canonical name; address; datatype and size; register type and read function code; unit, multiplier, min/max, and enum values; writable/write-only/write class; EEPROM and cyclic metadata; excluded write values; home-automation metadata; source and source version; supported models; sentinel values; and hardware verification. Ordering may be normalized, but substantive differences are forbidden.

## Codec parity

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/PARITY-CONTRACT.md
- type: protocol
- content: Identical raw registers must decode to identical domain values, and identical writable values must encode to identical 16-bit words. Float32 uses low-word-first transfer. Tests must explicitly cover NaN, Infinity, integer boundaries, signs, and multipliers.

## Transport and batching parity

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/PARITY-CONTRACT.md
- type: protocol
- content: For the same register selection, both implementations must emit semantically identical Modbus requests in the same order, including read function, start address, count, write function, and payload words. Batches may combine only exactly adjacent, non-overlapping ranges of the same register type. Official logical overlaps must remain separate exact requests.

## Detection and state parity

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/PARITY-CONTRACT.md
- type: protocol
- content: Identical probe responses must produce equivalent Navigator model, firmware, heating circuit, zone module, solar, ISC, PV, cascade, unsupported-register, batch-unsafe-register, permanently-failed-register, connection-suspect, and diagnostic outcomes.

## Error and resilience parity

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/PARITY-CONTRACT.md
- type: protocol
- content: Transport errors must be normalized independently of implementation language. Both implementations must respond semantically alike to timeouts, disconnects, short or invalid responses, Modbus Exception Code 2, repeated transient failures, batch-read errors, write errors, reconnect, and retry exhaustion.

## Write-safety parity

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/PARITY-CONTRACT.md
- type: protocol
- content: Given the same register state and value, both implementations must either accept the write or reject it for the same domain reason. Successful plans must have identical target address, function, and words. Dry-run must never generate network traffic. EEPROM throttling and cyclic TTL require controlled-clock tests. A failed write must not create a successful state transition.

## Web-supplement parity

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/PARITY-CONTRACT.md
- type: api-contract
- content: Equivalent Navigator 10 WebSocket and Navigator 2.0 HTTP responses must produce equivalent normalized data, values, units, notifications, statistics, capabilities, and errors. The web supplement is optional and read-only; Modbus remains the baseline data path.

## Cross-repository contract scenario schema

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/PARITY-CONTRACT.md
- type: schema
- content: Cross-repository CI must check out the pinned Python reference and run a contract generator that emits language-neutral JSON scenarios and expectations. Each scenario must contain at least `name`, `configuration`, `transport_responses`, `clock`, `operation`, `expected_result`, `expected_requests`, and `expected_state`. TypeScript must run the same scenario, and comparison may normalize only language differences expressly allowed by the parity contract.

## Behavioral contract coverage

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/PARITY-CONTRACT.md
- type: nfr
- content: Static fixtures must be complemented with behavioral scenarios. Retry, batch fallback, EEPROM behavior, and cyclic TTL may not be validated solely by comparing data structures.

## API parity matrix lifecycle

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/PARITY-CONTRACT.md
- type: api-contract
- content: `docs/API-PARITY.md` must be generated from or validated against the public Python API and map each Python symbol to a TypeScript symbol, status, and contract test. Development statuses are `planned`, `partial`, `complete`, and justified `not_applicable`. npm releases permit only `complete` and explicitly reviewed, semantically legitimate `not_applicable`; any other status blocks release.

## Coordinated release process and stale-baseline handling

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/PARITY-CONTRACT.md
- type: nfr
- content: Public Python changes must update contracts and tests; the Node port must be prepared before the Python release; cross-repository parity must run against the intended Python commit; Python and npm releases must be coordinated; and the compatibility matrix must record both versions and the commit. If Python releases first, the daily upstream check must immediately mark the Node baseline stale, and npm publication is blocked until full parity is restored.

## Absolute npm release gate

- source: /mnt/c/Users/basti/Documents/GitHub/idm-heatpump-node/docs/PARITY-CONTRACT.md
- type: nfr
- content: npm release is allowed only when the baseline matches the latest stable Python release, the Python commit is verified exactly, every API symbol is mapped, register schema and contract scenarios match, local and cross-repository tests pass, typecheck/lint/format/coverage pass, the npm tarball installs and passes tests, and the compatibility matrix and changelog are ready. Any deviation is a hard error; releases with known functional differences are forbidden.
