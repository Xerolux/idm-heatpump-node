# Phase 2: Modbus Reads, Detection, and Resilience - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the adapter-neutral Modbus read path whose connection lifecycle,
ordered requests, safe batching, model and capability detection, recovery
state, and sanitized diagnostics match the exact pinned Python `v0.7.6`
behavior. This phase includes Navigator 2.0, Navigator Pro, and Navigator 10
read semantics only. Write planning and execution remain in Phase 3, and the
optional read-only web supplement remains in Phase 4.

</domain>

<decisions>
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

</decisions>

<code_context>

## Existing Code Insights

### Reusable Assets

- `src/codec.ts` already provides the native low-word-first primitive and
  register-aware codecs required by reads and detection.
- `src/types.ts` provides immutable `IdmModelInfo`, `FeatureFlags`,
  `DataType`, `RegisterType`, and `WriteClass` values; Phase 2 can extend the
  established readonly-object factory pattern for `IdmClientDiagnostics` and
  `ModbusErrorContext`.
- `src/registers/` already contains the complete exact register catalog,
  detection-register definitions, model/feature-aware builders, immutable
  registry, and preserved official logical overlaps.
- `src/timing.ts` provides tested backoff and injected monotonic-clock patterns,
  while `src/contracts/scenario.ts` and tagged-value helpers provide the
  deterministic language-neutral envelope for transport behavior fixtures.

### Established Patterns

- Public symbols are promoted only after executable parity evidence exists in
  `contracts/api-mapping.json`; Phase 2 owns exactly
  `IdmClientDiagnostics`, `IdmModbusClient`, `IllegalAddressError`,
  `ModbusErrorContext`, and `quietPymodbusLogging`.
- Strict TypeScript, frozen values, readonly collections, explicit
  snake_case-to-camelCase mapping, `None`-to-`null`, tuple-to-readonly-array,
  and set-to-immutable-set normalizations are already binding.
- The pinned Python tag and full SHA are the behavioral authority, generated
  fixtures are transactionally checked, and `private: true` remains until all
  later phases and release gates pass.

### Integration Points

- Add the adapter-neutral transport boundary under `src/transport/` and the
  read/detection/state implementation under `src/client/`; promote only the
  five mapped Phase-2 root symbols through `src/index.ts`.
- Extend Python contract generation and `test/parity/` with deterministic
  scenarios comparing results, ordered FC03/FC04 requests, retries, controlled
  time, and final state.
- Reuse `buildRegisterMap`, `getRegister`, register metadata, and
  `decodeValue`/`encodeValue` internals rather than duplicating protocol facts
  in transport or detection code.

</code_context>

<specifics>
## Specific Ideas

- Treat the exact Python request trace and final state as the product contract,
  not the behavior of a particular Node Modbus library.
- Keep request-sensitive overlap scenarios explicit: the same physical word at
  address `1393` can participate in the `1392/2` humidity response and be read
  separately as the independent `1393/1` mode value.
- Model Code `2`, short responses, transient register failures, suspect
  connections, and batch quarantine as distinct states so diagnostics cannot
  collapse different recovery causes.

</specifics>

<deferred>
## Deferred Ideas

- Write planning, dry-run, actual FC16 writes, validation, EEPROM throttling,
  and cyclic TTL belong to Phase 3.
- Navigator 10 WebSocket and Navigator 2.0 HTTP capabilities belong to Phase
  4 and remain optional and read-only.
- Navigator 1.0/1.7 support requires a separate future protocol family,
  detection strategy, register map, fixtures, tests, and hardware validation;
  it is not part of this milestone.
- npm publication, release automation, and final latest-stable closure belong
  to Phase 5.

</deferred>
