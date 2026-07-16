# Phase 2: Modbus Reads, Detection, and Resilience - Research

**Researched:** 2026-07-16
**Domain:** Adapter-neutral Modbus TCP reads, model detection, retry/fallback state, and parity contracts
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

## Implementation Decisions

### Transport, Adapter, and Concurrency Lifecycle

- Define a public `ModbusTransport` contract and keep the first real
  `modbus-serial` adapter behind it; client behavior, errors, tests, and
  diagnostics must not expose adapter request objects, connection classes,
  retry knobs, or response types.
- Preserve the Python client lifecycle and defaults through idiomatic
  camelCase TypeScript: host is required; port `502`, slave ID `1`, timeout
  `10`, max retries `3`, and max group size `40` remain the defaults;
  `connect`, `disconnect`, `forceReconnect`, `isConnected`, `modelInfo`, and
  `modelName` retain their observable state transitions and validation.
- Serialize every connect, disconnect, reconnect, read, and complete retry
  loop through one client-owned async mutex so concurrent consumer calls never
  overlap transport requests or mutate connection state underneath an
  in-flight attempt.
- Inject transport creation, monotonic clock, delay/sleep, and deterministic
  fake transport behavior for tests. Disable adapter-owned retries by default
  so the client owns the exact Python attempt count and backoff sequence;
  `quietPymodbusLogging` remains the mapped compatibility helper but acts only
  through an adapter-neutral logging hook.

### Read, Batching, Request Ordering, and Overlaps

- Preserve the Python read surface with mapped names such as `readRegister`,
  `readValue`, `readBatch`, and `probeRegister`; input registers use FC04,
  holding registers use FC03, and every request records the exact register
  type, start address, and count before decoding.
- Match Python grouping order exactly: exclude write-only and permanently
  failed registers, separate already quarantined registers, then sort batch
  candidates by register-type value and address. Merge only when
  `next.address === previous.address + previous.size`, the type is unchanged,
  and the complete group span does not exceed the configurable maximum of
  `40` registers.
- Never span a gap, mix register types, or merge overlapping logical data
  points. Preserve official starts and sizes, including distinct exact
  requests for humidity `1392/count=2` and heating-circuit A mode
  `1393/count=1`, as well as the documented overlaps at `1442` and `1484`.
- A device-side batch Modbus error falls back to ordered individual reads,
  while timeout, disconnect, socket/no-response, and other transport failures
  propagate through reconnect/retry without being misclassified as register
  failures. Successful responses must contain exactly the requested word
  count; short or invalid responses fail before value decoding.

### Model, Feature, Sentinel, and Register-Map Detection

- Probe in the pinned Python order and shape: heating circuits at
  `1350 + 2n/count=2`, zone modules at `2000 + 65n/count=1`, then solar
  `1850/2`, ISC `1870/2`, PV `74/2`, cascade `1147/1`, Navigator-10 power limit
  `4108/2`, and optional firmware `4120/2`. Detection probes use one fast
  attempt and a two-second request timeout without changing normal failure
  counters.
- Treat heating-circuit Float32 `-1.0` as an unavailable slot and stop circuit
  and zone scans after two consecutive unavailable/missing slots. An exact
  two-word circuit response that is present but otherwise undecodable or
  out-of-range still marks that slot active, matching Python; solar and ISC
  likewise count any exact two-word response as present.
- Treat cascade low-byte `255` as unavailable, while `0` is valid evidence that
  cascade exists but is inactive. Classify `4108/2` presence as Navigator 10;
  otherwise zone-module presence as Navigator Pro, active heating circuits as
  Navigator 2.0, and no evidence as `Unknown`. The public `modelName` fallback
  remains Navigator 2.0 before detection and after an inconclusive result.
- Store immutable `IdmModelInfo`, derive the same feature set, optionally
  decode and round firmware to two decimals, and build/cache the register map
  from the detected model and capabilities. Preserve all model gates and
  hardware-verified sentinels from Phase 1; Navigator 1.0/1.7 remains a
  separate unsupported family and none of its addresses may enter this map.

### Resilience, Fallback, Quarantine, and Diagnostics

- Match retry classes and timing exactly: timeout, disconnect, socket/OS, and
  no-response transport errors mark the connection suspect, hard reconnect,
  and delay by `0.5 * 2^attempt`; generic Modbus errors retry with the same
  backoff on the current connection. Only Modbus Exception Code `2` becomes
  `IllegalAddressError`, stops immediately, and is never retried.
- On individual reads, Code `2` marks the register both unsupported and
  permanently failed immediately; other Modbus failures become permanently
  failed after three occurrences, a successful individual read clears its
  transient count, and transport failures never increment per-register
  failure state. Single reads reject already permanent registers, while batch
  reads skip them.
- After decoding the documented datatype, treat an enum miss or numeric
  min/max violation as a suspect batch value unless the value is `null`,
  boolean, or a declared sentinel. Quarantine that register from future
  batches, re-read it individually once, allow explicit consumer quarantine,
  and omit a still-invalid individual value rather than exposing or clamping
  it.
- Expose deterministic reset/query methods and immutable diagnostics matching
  Python state: sorted unsupported, permanently failed, and batch-unsafe
  names; connection-suspect status; detected navigator and firmware;
  connection status; and the latest structured error context. Diagnostic
  messages must exclude host/IP data and write payloads, and reset operations
  clear only the same state sets as Python.

### the agent's Discretion

- Internal file boundaries under `src/transport/` and `src/client/`, mutex and
  adapter wrapper implementation, normalized transport error-code names, and
  fake-transport fixture helpers are at the agent's discretion when all
  public mappings, request traces, state transitions, ordering, and exact
  pinned Python outcomes remain unchanged.

### Deferred Ideas (OUT OF SCOPE)

- Write planning, dry-run, actual FC16 writes, validation, EEPROM throttling,
  and cyclic TTL belong to Phase 3.
- Navigator 10 WebSocket and Navigator 2.0 HTTP capabilities belong to Phase
  4 and remain optional and read-only.
- Navigator 1.0/1.7 support requires a separate future protocol family,
  detection strategy, register map, fixtures, tests, and hardware validation;
  it is not part of this milestone.
- npm publication, release automation, and final latest-stable closure belong
  to Phase 5.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                                                                                                                                                          | Research Support                                                                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TRN-01  | Domain logic uses a `ModbusTransport` abstraction whose first real adapter encapsulates `modbus-serial`; deterministic tests can replace it with a fake transport and controlled clock without adapter details leaking into domain behavior.                                         | The transport contract, adapter boundary, injected factory/clock/delay, package audit, and fake-transport design below define the implementation seam.             |
| TRN-02  | Consumers can connect, disconnect, reconnect, retry with backoff, serialize requests, perform single and safe batch reads, recover through fallback, and observe Illegal Address, permanent-error, and batch-unsafe quarantine behavior matching Python request traces and outcomes. | The lifecycle state machine, retry matrix, grouping algorithm, fallback rules, quarantine rules, and behavioral scenario matrix below reproduce the pinned client. |
| TRN-03R | Read/lifecycle child clause of umbrella TRN-03: identical selections emit exact ordered FC03/FC04 function, address, and count; safe batching preserves gaps, types, size limits, and logical overlaps.                                                                              | Exact request envelopes, grouping algorithm, and overlap scenarios below close this Phase-2 child without marking TRN-03W complete.                                |
| DET-01  | Consumers receive Python-equivalent Navigator 2.0, Navigator Pro, Navigator 10, firmware, heating-circuit, zone-module, solar, ISC, PV, cascade, sentinel, unavailable-slot, model-gate, and capability-derived register-map results, while Navigator 1.0/1.7 remains unsupported.   | The ordered detection table and stop/sentinel rules below are transcribed from the exact pinned implementation and tests.                                          |
| DET-02  | Identical probe responses produce Python-equivalent detected capabilities, unsupported registers, batch-unsafe registers, permanently failed registers, connection-suspect state, and diagnostics.                                                                                   | The state inventory, reset semantics, immutable diagnostics shape, and contract scenario expectations below close these observable outcomes.                       |
| ERR-01R | Read/lifecycle child clause of umbrella ERR-01: timeouts, disconnects, short or invalid responses, Code 2, repeated transient failures, batch errors, reconnect, and retry exhaustion have equivalent outcomes.                                                                      | Closed normalized errors and read/lifecycle scenarios below close this Phase-2 child without marking ERR-01W complete.                                             |

</phase_requirements>

## Summary

Phase 2 should implement one adapter-neutral client state machine whose observable product is the same result, ordered request trace, controlled delay sequence, and final state as Python `idm-heatpump-api` `v0.7.6` at commit `ad121ebf34a5f5e37204371c026927d77efcd15c`. The `modbus-serial` package is infrastructure only; none of its clients, response objects, retry behavior, or error strings may become domain contracts. [VERIFIED: `UPSTREAM-PARITY.json`, target `AGENTS.md`, pinned `idm_heatpump/client.py`, and `02-CONTEXT.md`]

The selected implementation order is contract-first without changing the
closed Phase-1 scenario schema: establish governance and normalization, add the
separate transport parser/fakes, generate deterministic Python transport
scenarios, implement public data/errors and lifecycle/retry, then reads,
detection, the real adapter, public promotion, and package/closure gates. This
prevents incidental adapter behavior from becoming parity evidence. [VERIFIED:
Phase-1 `01-08-SUMMARY.md`, `01-09-SUMMARY.md`,
`docs/PARITY-CONTRACT.md`, CTR-01, SELECTED G-03]

The two public-surface conflicts are resolved before implementation. Under
G-02, the mapped `IdmModbusClient` is an exact release-blocking `partial` class
whose implemented and omitted member sets partition the pinned fixture. Under
G-01, `ModbusTransport` is governed by a separate closed TypeScript-extension
authority while the Python mapping stays exactly 89/89. No write stubs or
unmapped-export bypasses are permitted. [VERIFIED:
`contracts/api-mapping.json`, `test/fixtures/public-classes.json`,
`01-03-SUMMARY.md`, `01-09-SUMMARY.md`, `02-CONTEXT.md`; SELECTED G-01/G-02]

**Selected plan decomposition:** ten bounded plans cover (1) governance, (2)
transport parser/fakes, (3) Python generation, (4) errors/diagnostics, (5)
lifecycle/retry, (6) reads/batching, (7) detection, (8) real adapter, (9)
public promotion, and (10) package/docs/closure. [VERIFIED: pinned Python
source/tests and target phase constraints]

## Exact Reference Surface

### Pinned authority

- The only behavioral authority is Python package version `0.7.6`, tag `v0.7.6`, full commit `ad121ebf34a5f5e37204371c026927d77efcd15c`. The sibling Python worktree is newer and must not be imported at its current `HEAD`. [VERIFIED: `UPSTREAM-PARITY.json`, sibling Git objects, and Phase-1 parity orchestration]
- Python requires `pymodbus>=3.12.1,<4`, but Python and pymodbus remain development/CI reference inputs only and must never become npm runtime dependencies. [VERIFIED: pinned `pyproject.toml`, PKG-01, and target `AGENTS.md`]
- The official register documents and `docs/Register-Map-Invariants.md` remain authoritative for address, datatype, size, function code, overlap, model gate, and write-safety facts. [VERIFIED: target and sibling `AGENTS.md` plus pinned `docs/Register-Map-Invariants.md`]

### Phase-2 public Python mappings

| Python symbol            | Mapped TypeScript symbol | Required representation | Phase-2 observable contract                                                                                                                                                                                                                                                                                                                            |
| ------------------------ | ------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `IdmClientDiagnostics`   | `IdmClientDiagnostics`   | Readonly object/factory | `navigatorType`, `modbusConnected`, nullable firmware and last error, permanently failed and batch-unsafe tuples, connection suspect. The factory preserves caller order; `getDiagnostics()` sorts snapshots from internal sets before construction. [VERIFIED: `contracts/api-mapping.json`, `test/fixtures/public-classes.json`, pinned `client.py`] |
| `IdmModbusClient`        | `IdmModbusClient`        | Class                   | Constructor defaults/validation, lifecycle, reads, detection, diagnostics, plus Python's later write members. [VERIFIED: same authorities]                                                                                                                                                                                                             |
| `IllegalAddressError`    | `IllegalAddressError`    | Error class             | Immediate non-retryable Modbus Exception Code 2 with `isIllegalAddress` semantic marker. [VERIFIED: pinned `client.py`]                                                                                                                                                                                                                                |
| `ModbusErrorContext`     | `ModbusErrorContext`     | Readonly object/factory | Operation, address, count, register type, error type, sanitized message, and one-based attempt. [VERIFIED: fixture and pinned `client.py`]                                                                                                                                                                                                             |
| `quiet_pymodbus_logging` | `quietPymodbusLogging`   | Function                | Accept Python-compatible string/numeric levels, reject unknown strings, and route only through an adapter-neutral logging hook. [VERIFIED: mapping, pinned source/tests, and locked context]                                                                                                                                                           |

`IdmClientDiagnostics` does not contain `unsupportedRegisters`; Python exposes that state through `getUnsupportedRegisters()` separately. Do not expand the diagnostics object merely because the context lists unsupported state among queryable diagnostics. [VERIFIED: `test/fixtures/public-classes.json` and pinned `IdmClientDiagnostics` dataclass]

The pinned constructor is `host`, `port=502`, `slave_id=1`, `timeout=10`,
`max_retries=3`, followed by keyword-only `pymodbus_retries=0` and
`max_group_size=40`. The selected TypeScript public constructor is
`new IdmModbusClient(host, options?)`, where `options` contains only `port`,
`slaveId`, `timeout`, `maxRetries`, and `maxGroupSize`. Python
`pymodbus_retries` is fixed internally to zero; transport factory, clock, and
sleep injection are internal-only. Validate non-empty host, port `1..65535`,
slave ID `1..247`, `maxRetries >= 1`, and group size `>= 1`. [VERIFIED: pinned
constructor, class fixture, and tests; SELECTED D-04/G-02]

## Standard Stack

### Existing project toolchain

| Runtime/library | Version               | Purpose                                              | Guidance                                                                                                                                                                                                   |
| --------------- | --------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js         | `>=22`; CI 22/24      | Published runtime and TCP/event primitives           | Keep the declared support matrix; the local research shell reports Node `25.9.0`, which is useful for development but not a supported-target substitute. [VERIFIED: `package.json`, CI, local environment] |
| TypeScript      | `6.0.3`               | Strict domain, transport, and immutable public types | Preserve `strict`, exact optional properties, unchecked-index checks, and `.js` ESM specifiers. [VERIFIED: `package.json` and `tsconfig.json`]                                                             |
| Vitest          | `4.1.10`              | Deterministic unit/parity tests                      | Reuse serial test-file execution and the existing 80% coverage gates. [VERIFIED: `package.json` and `vitest.config.ts`]                                                                                    |
| tsup            | `8.5.1`               | ESM, CJS, declarations, source maps                  | No build-system change is needed for Phase 2. [VERIFIED: `package.json`]                                                                                                                                   |
| Python          | `3.12` reference only | Exact scenario generation                            | The local environment has Python `3.12.3`; the existing parity orchestrator already provisions a verified isolated reference. [VERIFIED: local environment and `01-07-SUMMARY.md`]                         |

## Package Legitimacy Audit

| Package                | Registry | Age                                              | Downloads   | Source Repo                            | Verdict | Disposition                                                                                                                                                                                                                                                                                            |
| ---------------------- | -------- | ------------------------------------------------ | ----------- | -------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `modbus-serial@8.0.25` | npm      | Published 2026-03-20; package created 2015-11-07 | 22,124/week | `github.com/yaacov/node-modbus-serial` | [OK]    | Approved as the first real Modbus TCP adapter behind `ModbusTransport`; no deprecation or postinstall script. Optional serial-port support is outside the adapter surface. [VERIFIED: npm metadata and GSD package-legitimacy audit; CITED: https://github.com/yaacov/node-modbus-serial/tree/v8.0.25] |

**Packages removed due to [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

`modbus-serial` `8.0.25` exposes Promise-based `connectTCP`, FC03 `readHoldingRegisters`, FC04 `readInputRegisters`, `setID`, `setTimeout`, and `isOpen`; `close` and `destroy` are callback-based and must be wrapped into idempotent Promises. [CITED: https://github.com/yaacov/node-modbus-serial/blob/v8.0.25/ModbusRTU.d.ts]

The official implementation attaches numeric `modbusCode` to device exception errors. The adapter must classify Code 2 using `error.modbusCode === 2`, not by matching localized or version-dependent message text. [VERIFIED: locally inspected official `v8.0.25` source; CITED: https://github.com/yaacov/node-modbus-serial/tree/v8.0.25]

### Do not add

- Do not add a second Modbus protocol client, retry library, logging framework, clock library, or network mocking framework. The project already owns retry/time abstractions and only needs one audited TCP adapter. [VERIFIED: existing source and locked context]
- Do not use `Promise.race` alone to implement the two-second probe timeout: the losing Modbus request would continue in the background and violate the single-request invariant. Temporarily set the adapter request timeout while the client mutex is held, then restore the normal timeout after the request settles. [VERIFIED: `modbus-serial` timeout API and locked serialization requirement]
- Do not hand-roll Modbus TCP frames or socket parsing. `modbus-serial` should own wire framing while the package owns domain request identity, retries, error normalization, and validation. [VERIFIED: TRN-01 and selected adapter scope]

## Recommended Architecture

### Responsibility map

| Capability                        | Primary owner    | Inputs/outputs                                                  | Must not own                                                                                                 |
| --------------------------------- | ---------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `IdmModbusClient` facade          | `src/client/`    | Public config, registers, results, diagnostics                  | Adapter response types or pymodbus/modbus-serial names. [VERIFIED: locked adapter-neutral decision]          |
| Serialized lifecycle/retry runner | `src/client/`    | One exclusive operation, normalized errors, clock/delay         | Register decoding or adapter-specific classification. [VERIFIED: pinned retry loop]                          |
| Read grouping/fallback            | `src/client/`    | `RegisterDef[]`, exact word arrays, state sets                  | Register-address invention or no-overlap assumptions. [VERIFIED: pinned grouping and register invariants]    |
| Detection                         | `src/client/`    | Ordered probe outcomes, immutable `IdmModelInfo`                | Navigator 1 addresses or write behavior. [VERIFIED: pinned detection and phase scope]                        |
| Transport contract/errors         | `src/transport/` | Connect/close/read operations and closed normalized failures    | Register definitions, batching, retry counts, diagnostics. [VERIFIED: TRN-01]                                |
| `modbus-serial` adapter           | `src/transport/` | Adapter configuration and exact read requests                   | Public API objects, state sets, retry policy, decoding. [VERIFIED: locked decision]                          |
| Fake transport/clock              | `test/support/`  | Scripted responses, trace, concurrency counters, synthetic time | Production branching or fixture-derived implementation values. [VERIFIED: pinned fake transport tests]       |
| Python scenario generator         | `scripts/`       | Exact pinned client plus deterministic fake                     | Live sockets, ambient checkout, repository writes outside allowlist. [VERIFIED: Phase-1 parity architecture] |

### Suggested file boundaries

```text
src/
  client/
    diagnostics.ts
    idm-modbus-client.ts
    read-groups.ts
    detection.ts
    state.ts
    index.ts
  transport/
    types.ts
    errors.ts
    modbus-serial-adapter.ts
    index.ts
test/
  support/
    fake-modbus-transport.ts
    fake-clock.ts
  client/
    lifecycle.test.ts
    reads.test.ts
    batching.test.ts
    detection.test.ts
    resilience.test.ts
  transport/
    modbus-serial-adapter.test.ts
  parity/
    transport-contract.test.ts
```

The exact split is discretionary, but state ownership must remain singular: one client instance owns one transport, one exclusive-operation gate, one model value, one last error context, one suspect flag, and the failure/quarantine sets. [VERIFIED: pinned `IdmModbusClient` fields and locked context]

### Adapter-neutral request contract

Use a small closed request value rather than exposing `modbus-serial` method arguments:

```ts
export interface ModbusReadRequest {
  readonly unitId: number;
  readonly registerType: RegisterType;
  readonly functionCode: 3 | 4;
  readonly address: number;
  readonly count: number;
  readonly timeoutMs?: number;
}

export interface ModbusTransport {
  readonly connected: boolean;
  connect(): Promise<void>;
  close(): Promise<void>;
  destroy(): Promise<void>;
  read(request: ModbusReadRequest): Promise<readonly number[]>;
}
```

This is the selected adapter-neutral TypeScript shape, not a Python-derived
signature. G-01 requires its separate TypeScript-only mapping/closure rule
before the type-only root export is promoted. [ASSUMED: exact TypeScript field
shape; VERIFIED: required behavior and current mapping conflict; SELECTED:
G-01]

The transport factory should receive immutable host/port/unit/timeout configuration once, while every request still carries exact unit ID, function code, address, count, and optional request timeout into the fake trace. Repeating unit ID in the request makes stale adapter configuration observable without leaking adapter objects. [ASSUMED: request-value shape; VERIFIED: exact request identity requirement]

### Closed normalized transport errors

Normalize adapter failures at the boundary into stable categories:

| Kind               | Typical adapter evidence                                  | Client treatment                                                                                                     |
| ------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `timeout`          | `code`/`errno` `ETIMEDOUT`                                | Mark suspect, hard reconnect, retry/backoff. [VERIFIED: pinned transport error behavior and official adapter source] |
| `disconnected`     | closed socket, port not open, connection exception        | Mark suspect, hard reconnect, retry/backoff. [VERIFIED: pinned behavior]                                             |
| `socket`           | `ECONNRESET`, `ECONNREFUSED`, `EPIPE`, DNS/OS error       | Mark suspect, hard reconnect, retry/backoff. [VERIFIED: pinned behavior]                                             |
| `no_response`      | response timeout or closed request with no valid response | Mark suspect, hard reconnect, retry/backoff. [VERIFIED: pinned fake tests]                                           |
| `modbus`           | Numeric device exception other than 2                     | Retry on same connection; batch may later fall back individually. [VERIFIED: pinned behavior]                        |
| `illegal_address`  | Numeric `modbusCode === 2`                                | Throw public `IllegalAddressError` immediately, no retry. [VERIFIED: pinned source and adapter source]               |
| `invalid_response` | Wrong shape, non-word data, or short count                | Fail before decoding as a normalized Modbus/response error. [VERIFIED: pinned short-response behavior]               |

Do not infer Code 2 from arbitrary error text when the numeric adapter field is available. Do not expose raw adapter errors in diagnostics because socket messages can contain the configured host. [VERIFIED: official adapter source and diagnostic redaction constraint]

## Lifecycle and Serialization

### One exclusive client operation

The mutex scope must include the complete public operation, including lazy connect, all attempts, reconnects, delays, batch fallback, individual rereads, detection probes, and state mutation. A narrower per-request lock would permit another consumer call between retry attempts and diverge from Python's `_lock`-protected command loop. [VERIFIED: pinned `client.py` and concurrency tests]

A small private FIFO promise gate is sufficient if it is tested for release-after-error and strict arrival ordering; no extra mutex dependency is required. The critical requirement is behavioral exclusivity, not a particular mutex implementation. [ASSUMED: implementation choice; VERIFIED: locked one-mutex outcome]

### Observable lifecycle

| Operation/state                                      | Exact behavior                                                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connect()` while healthy connected                  | No-op; do not create another adapter or request. [VERIFIED: pinned source/tests]                                                                                    |
| `connect()` while disconnected                       | Create configured adapter, connect, and retain it; connection failure clears the client reference and throws normalized connection error. [VERIFIED: pinned source] |
| `disconnect()`                                       | Close/null the transport under the mutex. Python does not reset model, diagnostics sets, last error, or failure sets. [VERIFIED: pinned source]                     |
| `_ensureConnected()` while connected and not suspect | Reuse transport. [VERIFIED: pinned source]                                                                                                                          |
| `_ensureConnected()` while suspect                   | Close/null, clear suspect before the fresh connect, then connect. [VERIFIED: pinned source/tests]                                                                   |
| `forceReconnect()`                                   | Close/null, clear suspect, connect under the same mutex. [VERIFIED: pinned source/tests]                                                                            |
| Successful I/O                                       | Set `connectionSuspect=false`. [VERIFIED: pinned retry runner]                                                                                                      |
| Failed reconnect inside retry path                   | Leave `connectionSuspect=true`; retry after exact delay. [VERIFIED: pinned source/tests]                                                                            |

`modelName` returns `"Navigator 2.0"` before detection and also after an inconclusive `Unknown` detection, while `modelInfo.navigatorType` may still be `Unknown`. This apparently asymmetric fallback is public Python behavior and must be tested. [VERIFIED: pinned source/tests]

### Retry timing

For `maxRetries = 3`, failed attempts use one-based diagnostic attempts `1`, `2`, `3`; delays occur only before another attempt and are `0.5`, then `1.0` seconds. The general formula after zero-based failed attempt `attempt` is `0.5 * 2 ** attempt`. [VERIFIED: pinned `_retry_command`]

Generic Modbus failures retry using the same connection. Transport failures close/recreate the transport before retrying. Illegal Address never delays or retries. [VERIFIED: pinned source/tests]

Detection calls `probeRegister(..., maxRetries=1, timeout=2)`; that one attempt still uses the normal command machinery and may update the latest error/suspect connection state, but it does not increment per-register permanent-failure counters because it is not the batch individual-fallback path. [VERIFIED: pinned source]

## Exact Read Semantics

### Request identity

| Register type | Function | Adapter method                                                                                                                                    |
| ------------- | -------: | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Holding       |     FC03 | `readHoldingRegisters(address, count)` [VERIFIED: pinned source; CITED: https://github.com/yaacov/node-modbus-serial/blob/v8.0.25/ModbusRTU.d.ts] |
| Input         |     FC04 | `readInputRegisters(address, count)` [VERIFIED: pinned source; CITED: https://github.com/yaacov/node-modbus-serial/blob/v8.0.25/ModbusRTU.d.ts]   |

The adapter must return exactly `count` words. A short or malformed response is an error before `decodeValue` sees it; no padding, truncation, byte clamping, or partial decode is allowed. [VERIFIED: pinned source/tests and register invariants]

`readRegister()` rejects write-only definitions and already permanently failed names, ensures a connection, performs the definition's exact type/address/size request, and decodes with the existing Phase-1 codec. `readValue(name)` first resolves the model-aware register map, then delegates to that exact single-register behavior. [VERIFIED: pinned source and existing register/codec assets]

Direct `readRegister()` failures do not update the per-register failure counter in pinned Python; those counters are updated by ordered individual reads used during batch fallback/quarantine. Likewise, direct Code 2 throws immediately but does not itself mark the register unsupported/permanent. The locked context's phrase “on individual reads” should therefore be implemented as the Python `_read_individual` fallback path unless the project deliberately changes the pinned authority first. [VERIFIED: pinned `read_register`, `_read_individual`, and tests]

### Exact grouping algorithm

1. Return an empty result for empty input. [VERIFIED: pinned `read_batch`]
2. Filter write-only and permanently failed definitions. [VERIFIED: pinned source]
3. Split already batch-unsafe definitions into an individual list; keep the rest as batch candidates. [VERIFIED: pinned source]
4. Sort batch candidates by `(register_type.value, address)` using stable ordering. [VERIFIED: pinned source]
5. Start a new group unless type matches, `next.address === previous.address + previous.size`, and `(next.address + next.size - first.address) <= maxGroupSize`. [VERIFIED: pinned `_group_registers`]
6. Read groups in sorted group order. After all groups, read pre-quarantined definitions individually in their original filtered-input order. [VERIFIED: pinned source and fake-transport ordering test]

The maximum is a complete address span, not the sum of logical sizes. Official overlaps are never merge candidates because equality to the previous logical end is required; a start inside the previous range begins a separate group. [VERIFIED: pinned formula and register invariants]

Mandatory trace examples:

| Selection                                             | Required requests                                                                                                            |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Humidity `1392/FLOAT/2` plus HC-A mode `1393/UCHAR/1` | Separate `FC04 1392/2`, then separate `FC04 1393/1`; never `1392/3`. [VERIFIED: pinned fake tests and official overlap rule] |
| Two exact adjacent input definitions                  | One FC04 request spanning exact first start through final end, subject to max 40. [VERIFIED: pinned batching]                |
| Same addresses across holding/input types             | Separate FC03 and FC04 groups, sorted by Python register-type value then address. [VERIFIED: pinned source/tests]            |
| Gap of one or more words                              | Separate requests. [VERIFIED: pinned tests]                                                                                  |
| Logical overlap at `1442` or `1484`                   | Separate exact-start requests. [VERIFIED: register invariants]                                                               |

### Batch fallback and quarantine

A batch request that exhausts on a device-side Modbus error falls back to ordered individual reads for that group. A transport failure propagates through the client retry/reconnect loop and never becomes a register failure. [VERIFIED: pinned `_read_group` and fake tests]

For each decoded batch value, quarantine when an enum value is missing or a numeric value is outside declared min/max, except `null`, boolean values, and declared sentinels are always accepted for this check. A quarantined value is not returned from the batch result until an immediate individual reread succeeds with a non-suspect value. [VERIFIED: pinned suspect-value logic/tests]

During ordered individual fallback:

- Code 2 adds the name to unsupported and permanent sets immediately. [VERIFIED: pinned source/tests]
- Other Modbus errors increment a transient count and add the name to permanent after the third occurrence. [VERIFIED: pinned source/tests]
- A successful individual read clears that transient count. [VERIFIED: pinned source/tests]
- Transport failures propagate without touching any register failure state. [VERIFIED: pinned source/tests]
- Decode errors or still-suspect values are omitted rather than clamped or returned. [VERIFIED: pinned source/tests]

Consumer `markBatchUnsafe` accepts either a register definition or name in Python and adds the name without validating registry membership. Preserve that permissive acceptance unless the mapping explicitly documents a TypeScript normalization. [VERIFIED: pinned public method]

## Exact Detection Contract

Detection probes input registers in this exact sequence:

| Order | Capability           | Request                  | Interpretation                                                                                                                                                                                                                                                                           |
| ----: | -------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|     1 | Heating circuits A-G | `1350 + 2*n`, count `2`  | Decode Float32. `-1.0` means unavailable. Valid finite `[-50, 80]` non-`-1` means active. Any exact two-word response that cannot decode or is out of range still means the slot exists/active. Stop after two consecutive unavailable or missing slots. [VERIFIED: pinned source/tests] |
|     2 | Zone modules 1-10    | `2000 + 65*n`, count `1` | Any exact one-word response means module `n+1` exists. Stop after two consecutive misses. [VERIFIED: pinned source/tests]                                                                                                                                                                |
|     3 | Solar                | `1850`, count `2`        | Any exact two-word response means present. [VERIFIED: pinned source]                                                                                                                                                                                                                     |
|     4 | ISC                  | `1870`, count `2`        | Any exact two-word response means present. [VERIFIED: pinned source]                                                                                                                                                                                                                     |
|     5 | PV                   | `74`, count `2`          | Exact two-word response means present. [VERIFIED: pinned source]                                                                                                                                                                                                                         |
|     6 | Cascade              | `1147`, count `1`        | Low byte `255` means unavailable; low byte `0` is valid present-but-inactive evidence. [VERIFIED: pinned source/tests]                                                                                                                                                                   |
|     7 | Navigator 10         | `4108`, count `2`        | Exact two-word presence selects Navigator 10. Register `1072` is not detection evidence. [VERIFIED: pinned source/tests]                                                                                                                                                                 |
|     8 | Firmware, optional   | `4120`, count `2`        | Decode finite Float32 and round to two decimals; skip entirely when `readFirmware=false`. [VERIFIED: pinned source/tests]                                                                                                                                                                |

Model priority is Navigator 10 when `4108/2` is present, else Navigator Pro when at least one zone module exists, else Navigator 2.0 when at least one heating circuit is active, else `Unknown`. [VERIFIED: pinned source]

Feature flags must match Python's exact public constants and detected evidence. After detection, construct the existing immutable `IdmModelInfo`, invalidate/build the model-aware register registry, and keep Navigator 1.0/1.7 completely absent. [VERIFIED: pinned source, Phase-1 types/registers, and register invariants]

`getDetectionRegisters()` from the Python register module does not contain the direct Navigator-10 and firmware probes at `4108`/`4120`; detection code issues those probes explicitly. Do not infer the entire sequence from that helper alone. [VERIFIED: pinned `registers.py` and `client.py`]

## State and Diagnostics

### Client-owned state

| State                           | Mutation source                                       | Public observation/reset                                                                                                          |
| ------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Connected transport             | connect/disconnect/reconnect                          | `isConnected`; disconnect only closes/nulls. [VERIFIED: pinned source]                                                            |
| `modelInfo` and cached registry | detection                                             | `modelInfo`, `modelName`, model-aware reads; no Phase-2 public reset. [VERIFIED: pinned source]                                   |
| `connectionSuspect`             | transport failures and successful I/O/reconnect paths | Diagnostics field. [VERIFIED: pinned source/tests]                                                                                |
| Last `ModbusErrorContext`       | retryable/final read failures                         | `getLastErrorContext`, `clearLastErrorContext`; diagnostics exposes only its sanitized message. [VERIFIED: pinned source/fixture] |
| Unsupported names               | individual fallback Code 2                            | Sorted `getUnsupportedRegisters`; cleared by `resetFailedRegisters`. [VERIFIED: pinned source]                                    |
| Permanently failed names        | Code 2 or third individual Modbus failure             | Sorted query/diagnostics; cleared by `resetFailedRegisters`. [VERIFIED: pinned source]                                            |
| Transient failure counts        | individual fallback generic Modbus failure/success    | Internal; cleared by success or `resetFailedRegisters`. [VERIFIED: pinned source]                                                 |
| Batch-unsafe names              | suspect batch value or consumer mark                  | Sorted query/diagnostics; **not** cleared by `resetFailedRegisters`. [VERIFIED: pinned source]                                    |

`resetFailedRegisters()` clears permanent, unsupported, and transient counts only. It does not clear batch-unsafe state, last error, connection suspect, model, or connection. No broader “reset all” behavior should be invented. [VERIFIED: pinned source/tests]

All returned sets/arrays and diagnostics/error contexts must be newly owned and
frozen or readonly. Query methods and `getDiagnostics()` sort copied internal
sets where Python returns sorted tuples; public factories preserve the caller's
array order. Diagnostic text must remove configured endpoint literals and must
never include future write payloads. [VERIFIED: locked diagnostics decision
and established Phase-1 immutability pattern]

`quietPymodbusLogging` preserves Python level parsing: case-insensitive known
names and aliases map as `CRITICAL`/`FATAL` = 50, `ERROR` = 40,
`WARNING`/`WARN` = 30, `INFO` = 20, `DEBUG` = 10, and `NOTSET` = 0. Numeric
input passes through and an unknown string throws. Without a configured neutral
hook it is a no-op because Node has no pymodbus logger tree. [VERIFIED: pinned
helper/tests; SELECTED: no-hook Node behavior]

## Behavioral Contract Strategy

### Separate transport contract; do not widen scenario schema v1

Phase-1 scenario version 1 is deliberately closed to four semantic operation kinds. Phase 2 must either introduce `schema_version: 2` or add a separate transport-behavior fixture/parser; silently accepting runtime operations in v1 would invalidate the Phase-1 closure guarantee. [VERIFIED: `src/contracts/scenario.ts` and `01-08-SUMMARY.md`]

G-03 selects a separate closed schema-version-1
`transport-behavior.json` plus `src/contracts/transport-scenario.ts`, generated
from the exact pinned Python checkout. Phase-1 `scenario.ts` remains unchanged.
Each case retains the CTR-01 envelope and adds only normalized transport/state
values:

```json
{
  "name": "batch_overlap_humidity_and_mode",
  "configuration": {
    "host": "example.invalid",
    "port": 502,
    "slave_id": 1,
    "timeout": 10,
    "max_retries": 3,
    "max_group_size": 40
  },
  "transport_responses": [
    { "kind": "words", "words": [0, 17096] },
    { "kind": "words", "words": [2] }
  ],
  "clock": [],
  "operation": {
    "kind": "read_batch",
    "registers": ["humidity_sensor", "hc_a_mode"]
  },
  "expected_result": {
    "humidity_sensor": 42,
    "hc_a_mode": 2
  },
  "expected_requests": [
    { "function_code": 4, "address": 1392, "count": 2 },
    { "function_code": 4, "address": 1393, "count": 1 }
  ],
  "expected_state": {
    "connection_suspect": false,
    "unsupported_registers": [],
    "permanently_failed_registers": [],
    "batch_unsafe_registers": []
  }
}
```

The concrete value words above are illustrative and must be generated from the pinned Python codec/reference rather than copied as hand-maintained truth. [ASSUMED: example fixture values/shape; VERIFIED: required envelope and request identity]

### Wave-0 test infrastructure

Before implementation plans depend on it, add:

1. A deterministic fake transport recording unit ID, function code/type, address, count, timeout, response, connection lifecycle, and maximum concurrency. [VERIFIED: pinned `tests/fake_modbus.py` and fake-transport tests]
2. An injected fake monotonic clock/delay that advances without sleeping and records exact delay values. [VERIFIED: pinned retry tests and existing timing patterns]
3. A Python contract generator extension using only the verified pinned checkout and a deterministic fake, never a live TCP device. [VERIFIED: parity architecture and no-hardware requirement]
4. A strict versioned runtime scenario parser that validates 16-bit words only in request/response envelopes, preserves tagged values, bounds collection sizes, clones, and freezes. [VERIFIED: Phase-1 scenario/tagged-value pattern]
5. `test/parity/transport-contract.test.ts` that executes the same scenarios through the TypeScript client and compares normalized result, ordered requests, clock/delays, and final state. [VERIFIED: CTR-01 and Phase-2 evidence mapping]
6. Adapter unit tests with a mocked `modbus-serial` constructor/client proving method selection, setID, timeout restoration, numeric Code-2 classification, exact word extraction, and close/destroy wrapping. [VERIFIED: selected adapter API and TRN-01]

### Required scenario matrix

| Area                   | Minimum scenarios                                                                                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Constructor/lifecycle  | Empty host, port bounds, slave bounds, retry/group validation; connect success/failure/no-op; disconnect; force reconnect; suspect ensure-connected. [VERIFIED: public class fixture and pinned tests]    |
| Serialization          | Concurrent connect/read/batch/detect calls never exceed one active transport operation; mutex releases after every error. [VERIFIED: pinned concurrency tests]                                            |
| Single reads           | FC03 vs FC04; exact address/count; write-only rejection; permanent rejection; short response; decode error; Code 2 no retry. [VERIFIED: pinned source/tests]                                              |
| Retry                  | Timeout/disconnect/socket/OS/no-response reconnect with `0.5`, `1.0`; generic Modbus same connection; exhausted attempts/context; success clears suspect. [VERIFIED: pinned tests]                        |
| Batching               | Empty; adjacency; gap; type split; max-span split; official overlap split; pre-quarantine ordering; device-error fallback; transport propagation. [VERIFIED: pinned tests]                                |
| Register failure state | Code 2 immediate unsupported/permanent during fallback; three generic failures; transport no count; individual success clears count; exact reset semantics. [VERIFIED: pinned tests]                      |
| Batch unsafe           | Enum miss; range miss; sentinel acceptance; null/bool acceptance; immediate individual reread; still-invalid omission; explicit consumer mark. [VERIFIED: pinned tests]                                   |
| Detection              | Full Navigator 10, Pro, Navigator 2, Unknown; `-1`; undecodable/out-of-range exact circuit response; two-missing stop; solar/ISC/PV; cascade `0`/`255`; firmware on/off/invalid. [VERIFIED: pinned tests] |
| Diagnostics            | Immutable/sorted state, modelName fallback, firmware string, latest sanitized message, clear-last-error, host redaction. [VERIFIED: fixture, pinned source, locked context]                               |
| Adapter                | FC03/FC04 method mapping, unit ID, seconds-to-ms timeout, temporary probe timeout restoration, numeric `modbusCode`, word-count validation, lifecycle callbacks. [VERIFIED: official adapter API/source]  |

Focused tests should remain below roughly 30 seconds and use no real network. The existing full parity orchestration may remain slower because it provisions the exact Python reference, but normal client suites must be deterministic and fast. [VERIFIED: existing project test pattern; ASSUMED: focused duration target]

## Validation Architecture

### Per-plan verification loop

1. Run the focused RED/GREEN test file for the current contract slice. [VERIFIED: established Phase-1 TDD pattern]
2. Run `npm run typecheck`, because exact optional properties and readonly boundaries catch state-shape mistakes early. [VERIFIED: project scripts]
3. Run the versioned scenario parser and transport parity test whenever fixture/schema behavior changes. [VERIFIED: parity architecture]
4. Run `npm run lint` and `npm run format:check`. [VERIFIED: project quality gate]
5. Run `npm run build` after public/export or adapter dependency changes. [VERIFIED: package gate]
6. Run `npm run parity:check` before promotion to prove exact pinned regeneration and no unrelated fixture drift. [VERIFIED: Phase-1 parity gate]
7. Run `npm run check` at phase closure and verify the packed package contains only intended runtime output and the selected runtime dependency. [VERIFIED: Phase-1 closure pattern]

### Requirement-to-evidence map

| Requirement | Primary evidence                                                                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TRN-01      | Fake transport tests, adapter unit tests, no adapter types in public client/errors/diagnostics, package dependency audit. [VERIFIED: requirement intent] |
| TRN-02      | Lifecycle, retry, concurrency, single/batch, fallback, permanent/quarantine tests plus Python runtime scenarios. [VERIFIED: requirement intent]          |
| TRN-03      | Exact FC03/FC04 request trace fixtures, grouping/overlap tests; mark write half pending Phase 3. [VERIFIED: requirement scope]                           |
| DET-01      | Ordered detection scenarios and exact immutable model/register-map comparisons. [VERIFIED: requirement intent]                                           |
| DET-02      | Final-state comparisons for model, feature, unsupported/permanent/batch-unsafe/suspect/diagnostics. [VERIFIED: requirement intent]                       |
| ERR-01      | Normalized error scenario matrix for every read/lifecycle path; mark write-error cases pending Phase 3. [VERIFIED: requirement scope]                    |

## Common Pitfalls

### Pitfall 1: Adapter retry multiplication

If `modbus-serial` retries internally while `IdmModbusClient` also retries, observable request counts and backoff diverge from Python. Configure the adapter for one wire attempt and let the client own all retry policy. [VERIFIED: locked context]

### Pitfall 2: Timeout via abandoned promises

A timeout wrapper that rejects without cancelling/settling the underlying Modbus request lets the next operation begin while the old one is active. Use the adapter's request timeout and hold the client mutex until the adapter settles. [VERIFIED: selected adapter API and serialization constraint]

### Pitfall 3: Message-based Illegal Address detection

The official adapter supplies numeric `modbusCode`; matching `"Illegal data address"` is brittle and can misclassify generic messages. Numeric Code 2 is the sole special Modbus exception. [VERIFIED: official adapter source and pinned source]

### Pitfall 4: Making direct reads update fallback counters

Pinned Python updates register failure/quarantine state in the batch individual-fallback path, not in ordinary `readRegister()`. Merging these code paths without a mode flag changes later batch behavior. [VERIFIED: pinned source]

### Pitfall 5: Treating all batch errors alike

Device Modbus errors fall back to individual reads; transport errors reconnect/retry and propagate. Collapsing both into one error loses the distinction required for permanent-register state. [VERIFIED: pinned source/tests]

### Pitfall 6: Summing sizes instead of measuring span

The max-group rule is final end minus first start, and adjacency is based on the previous definition's documented size. Summing sizes can accidentally merge gaps or mishandle overlaps. [VERIFIED: pinned grouping code]

### Pitfall 7: “Fixing” official overlaps

Humidity `1392/2` and mode `1393/1` deliberately share a physical word but are separate logical points. Do not shift, shrink, clamp, merge, or add a no-overlap invariant. [VERIFIED: register-map invariants]

### Pitfall 8: Over-validating detection data

An exact two-word heating-circuit response that is undecodable or outside the plausibility range still proves the slot exists in Python. Treating it as missing changes the model and map. [VERIFIED: pinned detection source/tests]

### Pitfall 9: Resetting too much

`resetFailedRegisters()` does not clear batch quarantine, model, connection suspect, or last error. A convenient global reset breaks parity. [VERIFIED: pinned source]

### Pitfall 10: Premature API promotion

`IdmModbusClient` contains Phase-3 write members and `ModbusTransport` is not represented in the closed mapping. Do not satisfy export tests by adding write stubs, weakening closure, or claiming a partial class complete. [VERIFIED: mapping, class fixture, Phase-1 promotion rules]

## Security and Operational Boundaries

The selected `connectTCP` adapter path exposes raw TCP host/port connection options and no TLS or authentication parameters. Phase 2 must not imply protocol-level authentication or confidentiality; callers are responsible for selecting a trusted network and device endpoint. [VERIFIED: official `connectTCP` type/source and Phase-2 API boundary]

| ASVS area             | Relevance                     | Required treatment                                                                                                                                                                              |
| --------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | Not implemented by Modbus TCP | Make no authentication claim and accept no credentials in Phase 2. [VERIFIED: phase scope]                                                                                                      |
| V3 Session management | Not applicable                | No sessions/tokens. [VERIFIED: phase scope]                                                                                                                                                     |
| V4 Access control     | Network boundary only         | Document that arbitrary host input is a caller trust-boundary concern; library behavior intentionally connects to the configured host. [VERIFIED: client API; ASSUMED: documentation placement] |
| V5 Validation         | High                          | Validate constructor bounds, request address/count/word shape, exact response length, known register metadata, and closed error/scenario shapes. [VERIFIED: pinned validations and tests]       |
| V6 Cryptography       | Not provided                  | Do not advertise encryption; do not add an unrelated TLS abstraction in this phase. [VERIFIED: Modbus TCP and scope]                                                                            |
| V7 Logging/errors     | High                          | Sanitize host/IP and future payloads, return immutable stable contexts, avoid raw adapter error leakage. [VERIFIED: locked diagnostics decision]                                                |
| V8 Data protection    | Moderate                      | Do not commit private device IPs, IDs, PINs, captures, or write payloads in fixtures. Use reserved example domains and synthetic words. [VERIFIED: target `AGENTS.md`]                          |
| V11 Business logic    | High                          | Bound retries/timeouts, serialize operations, distinguish transport/device failures, and preserve safe state transitions. [VERIFIED: Phase-2 requirements]                                      |
| V13 API/web services  | Not applicable                | No HTTP/WebSocket server/client supplement in Phase 2. [VERIFIED: deferred Phase 4]                                                                                                             |

Threats to test explicitly are denial-of-service through unbounded retry/configuration, concurrent state races, forged error text causing Code-2 misclassification, raw socket error disclosure, stale per-request timeout restoration, and oversized/malformed scenario fixtures. [VERIFIED: architecture and selected adapter behavior]

No live hardware read is required to prove Phase-2 software parity. Hardware evidence becomes necessary only for a protocol fact that differs from the official/pinned tables or for the final release's truthful validation record. [VERIFIED: register authority and release requirements]

## Planning Conflicts and Resolutions

### Conflict A: Cross-phase `IdmModbusClient` class

The public class fixture includes Phase-3 write methods (`setValue`, `simulateWrite`, `writeRegister`, cyclic-write state/query methods, throttle reset, and encode behavior) in the same Python class that owns Phase-2 reads. Phase 1's promotion gate states that classes are complete only with their complete member contract and no public partial stubs. [VERIFIED: `test/fixtures/public-classes.json`, `01-03-SUMMARY.md`, `01-09-SUMMARY.md`]

**Selected resolution (G-02):** Implement the real class source and all Phase-2
members now under an exact `partial` lifecycle whose release gate remains red
and whose implemented/omitted member partition is machine-checked. Phase 3
supplies the remaining methods; do not label the class complete or add stubs.

### Conflict B: Public `ModbusTransport` versus exact mapping closure

The context calls the interface public, but `contracts/api-mapping.json` contains only Python public symbols and `src/index.ts` is tested to equal completed mapped root exports exactly. [VERIFIED: context, mapping, and Phase-1 export tests]

**Selected resolution (G-01):** Add a separate closed TypeScript-only extension
registry with rationale and type-only export evidence. The Python inventory
remains exactly 89/89.

### Conflict C: Whole-requirement wording includes writes

TRN-03 mentions read/write payload semantics and ERR-01 mentions write errors, but the locked phase boundary defers all writes to Phase 3. [VERIFIED: requirements and `02-CONTEXT.md`]

**Selected resolution (G-04):** Phase 2 completes only TRN-03R and ERR-01R.
Phase 3 owns TRN-03W and ERR-01W. The TRN-03 and ERR-01 umbrella rows remain
pending until both children are complete.

## Resolved Planning Questions

**Status: RESOLVED**

1. `IdmModbusClient` uses an exact release-blocking `partial` lifecycle during private development. Its implemented and omitted camelCase member lists must be a disjoint, duplicate-free partition of the pinned class fixture; Phase 3 completes the omitted write/cyclic/throttle members. [SELECTED: G-02]
2. `ModbusTransport` is governed by a separate closed `contracts/typescript-extensions.json` authority with `no_python_counterpart: true`; the exact Python mapping remains 89/89. [SELECTED: G-01]
3. Runtime behavior uses a separate closed `test/fixtures/transport-behavior.json` and `src/contracts/transport-scenario.ts`; Phase-1 scenario schema v1 remains unchanged. [SELECTED: G-03]

The compound requirements are also resolved through clause IDs: TRN-03R and
ERR-01R belong to Phase 2, while TRN-03W and ERR-01W belong to Phase 3. The
TRN-03 and ERR-01 umbrella rows cannot be phase-completed directly. [SELECTED:
G-04]

## Environment and Build Notes

- Research environment: Node `25.9.0`, npm `11.12.1`, Python `3.12.3`, Git `2.43.0`. Supported runtime verification must still run on Node 22 and 24. [VERIFIED: local commands and package CI]
- `modbus-serial` `8.0.25` was published/updated 2026-03-20; npm reports an unpacked size of 247,776 bytes across 30 files. [VERIFIED: npm registry metadata]
- The target repository currently has no runtime dependencies; Phase 2 should add only `modbus-serial` and update lockfile/tarball/install tests accordingly. [VERIFIED: `package.json`]
- A local graph artifact is absent, so there is no knowledge-graph query to incorporate. [VERIFIED: `.planning/graphs/graph.json` absence]
- Phase-1 verification passed all semantic requirements and exact overlap/codec/public-surface gates; Phase 2 can reuse those assets rather than regenerate register or codec logic. [VERIFIED: `01-VERIFICATION.md`]

## Sources

### Primary repository sources

- `UPSTREAM-PARITY.json`, `AGENTS.md`, `docs/PARITY-CONTRACT.md`, `docs/BASELINE.md`, `docs/API-PARITY.md`, `contracts/api-mapping.json`, and `test/fixtures/public-classes.json`. [VERIFIED: read in target repository]
- Phase-2 `02-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, and Phase-1 research/summaries/verification. [VERIFIED: read in target repository]
- Exact pinned Python `idm_heatpump/client.py`, `registers.py`, `const.py`, package exports, `tests/test_client.py`, `tests/test_fake_modbus_transport.py`, `tests/fake_modbus.py`, `tests/test_performance.py`, and `docs/Register-Map-Invariants.md`. [VERIFIED: read with `git show ad121ebf34a5f5e37204371c026927d77efcd15c:...`]

### Official external sources

- `modbus-serial` official repository and v8.0.25 source: [CITED: https://github.com/yaacov/node-modbus-serial/tree/v8.0.25]
- Official TypeScript declarations for connection, reads, timeout, ID, open state, and close/destroy behavior: [CITED: https://github.com/yaacov/node-modbus-serial/blob/v8.0.25/ModbusRTU.d.ts]
- npm package metadata: [CITED: https://www.npmjs.com/package/modbus-serial/v/8.0.25]

### Research cache and confidence

The planned documentation lookups were cached under keys `d6e29ae84c361c103b46140c4804c2d4041f999aa66d042a84390e55bbe1ae5b` and `5ee49812033802247c1d9302a379fc11ca349f18d1f7acd01aa1a3d5500fa43c`. Context7 was not available in this environment, so both were verified against the official tagged repository and classified `MEDIUM` for external-provider confidence; all parity-critical behavior is independently `HIGH` confidence because it was verified from the exact pinned Python source and tests. [VERIFIED: research-store results, confidence classifier, and local source inspection]

## Conclusion

Phase 2 is technically ready to execute after planning. The protocol behavior,
request ordering, retry classes, model detection, quarantine, diagnostics,
adapter API, test seams, validation matrix, cross-phase class lifecycle,
TypeScript-only extension authority, separate fixture/parser, and compound
requirement tracking are all resolved from primary sources. [VERIFIED:
complete research above and selected G-01 through G-04 resolutions]
