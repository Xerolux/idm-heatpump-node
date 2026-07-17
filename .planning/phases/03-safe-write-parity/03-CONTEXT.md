# Phase 3: Safe Write Parity - Context

**Gathered:** 2026-07-17
**Status:** Ready for planning
**Mode:** Autonomous recommendations approved by the project owner

<domain>
## Phase Boundary

Deliver the complete Python `idm-heatpump-api` 0.7.6 Modbus write surface:
immutable write planning and dry-run, validation, FC16 request execution,
retry/error behavior, EEPROM throttling, cyclic heartbeat deadlines, state
queries/resets, generated cross-repository scenarios, and the seven currently
omitted `IdmModbusClient` members. Phase 3 does not add web writes, live
hardware tests, Navigator 1.x support, or publication.

</domain>

<decisions>
## Implementation Decisions

### Public Write API and Request Shape

- Promote exactly the mapped Python write surface with idiomatic names:
  `WriteSafetyResult`, `simulateWrite`, `writeRegister`, `setValue`,
  `resetWriteThrottle`, `getActiveCyclicWrites`,
  `getExpiredCyclicWrites`, and `resetCyclicWriteState`.
- `WriteSafetyResult` is an immutable readonly object/factory containing the
  exact register object, requested value, immutable encoded word array, and
  `dryRun` flag. Planning and dry-run never connect and never send.
- Extend the adapter-neutral transport with one exact immutable write request.
  Python calls `write_registers` for every accepted write, so both one- and
  multi-word writes use FC16 with the exact unit, holding-register address,
  count, and low-word-first payload.
- Preserve the existing whole-operation FIFO: validation, ensure/connect,
  every retry/reconnect/delay, write response validation, and successful state
  mutation are one serialized operation.

### Validation and Custom Registers

- Match Python validation order and domain reasons: writable/model membership,
  BOOL versus numeric type, finite numeric input, integer-only datatypes,
  excluded values, min/max, enum membership, then the existing authoritative
  codec. Never clamp, coerce invalid booleans, or hide codec errors.
- `allowCustomRegister` bypasses only detected-model map membership. It never
  bypasses writability, datatype, finite/integer, excluded-value, range, enum,
  address/count, holding-write, or encoding protections.
- Unknown string keys remain distinct from read-only or model-unavailable
  registers. String-key lookup uses the same model-aware registry semantics as
  Python; explicit `RegisterDef` inputs retain identity in the returned plan.
- Dry-run and rejected writes emit no transport request and cannot mutate
  connection, EEPROM, cyclic, or diagnostic success state.

### EEPROM and Cyclic Time State

- Use the already injected monotonic clock. EEPROM-sensitive registers retain
  Python's 60-second per-name throttle with the same boundary and one-decimal
  remaining-time diagnostic.
- Record an EEPROM timestamp only after a fully successful Modbus write.
  Resetting one register removes only its name; a no-argument reset clears the
  complete EEPROM throttle map.
- Successful cyclic writes set or refresh the per-name deadline to the
  register TTL or Python's 300-second default. The exact deadline, not a
  remaining duration, is returned.
- Active state uses `deadline > now`, expired state uses `deadline <= now`;
  both are immutable deterministic projections. Per-register and global cyclic
  resets match Python exactly.

### Retry, Error, and Evidence Closure

- Reuse Python's client-owned attempt count and exponential backoff. Transport
  connection failures reconnect; generic device/write failures retry without
  recording success. Preserve Python's operation-specific handling rather
  than assuming read-side Code-2 semantics automatically apply to writes.
- A failed validation, connection, device response, retry exhaustion, or
  malformed response must not record an EEPROM timestamp or cyclic deadline.
  The latest immutable error context uses operation `write`, exact address and
  count, a closed normalized kind, redacted endpoint, and no raw payload.
- Generate executable write scenarios from the exact pinned Python tag/SHA.
  Compare result/error, FC16 requests and words, controlled time, EEPROM and
  cyclic state, retries, reconnects, dry-run no-traffic, and failed-write
  rollback. Keep this evidence transactionally regenerated with the existing
  fixture/doc set.
- Tests use only deterministic fake transports and clocks. No live heat-pump
  write is authorized or implied, and diagnostics/fixtures must never contain
  a real endpoint or a sensitive write payload.

### the agent's Discretion

- Internal module boundaries for write planning, immutable state projection,
  transport response typing, and fixture parsing are at the agent's
  discretion when public mappings, validation order, exact FC16 traces,
  controlled time, and Python outcomes remain unchanged.
- The planner may either version the existing transport scenario schema or
  introduce a separate Phase-3 write fixture, choosing the approach with the
  strongest closed-schema and transactional evidence while preserving all
  Phase-2 read fixtures byte-for-byte unless the pinned generator requires a
  reviewed extension.

</decisions>

<code_context>

## Existing Code Insights

### Reusable Assets

- `src/client/idm-modbus-client.ts` already owns the private transport,
  complete-operation FIFO, retries, reconnects, model-aware map, injected
  monotonic clock, error context, and exact partial public client.
- `src/codec.ts` already provides Python-equivalent immutable encoded words,
  including Float32 low-word-first and integer/range behavior.
- `src/registers/definitions.ts` already validates and exposes `writable`,
  `writeClass`, EEPROM, cyclic TTL, write-only, excluded-value, model, and
  datatype metadata from the pinned schema.
- The pinned generator, transactional parity orchestrator, fake clock, fake
  transport, adapter boundary, package checker, and API mapping promotion
  gates are established in Phases 1 and 2.

### Established Patterns

- Public objects are frozen readonly values; runtime unions are frozen
  `as const` objects; public mappings are promoted only after executable
  evidence exists.
- Concrete `modbus-serial` types and internal dependency injection stay out of
  root declarations. Adapter retries remain zero.
- Generated fixtures come only from Python `0.7.6`, tag `v0.7.6`, commit
  `ad121ebf34a5f5e37204371c026927d77efcd15c`, and replacement is atomic.
- The package remains `private: true` until all later phases and release gates
  pass.

### Integration Points

- Extend `src/transport/types.ts`, the fake transport, and
  `src/transport/modbus-serial-adapter.ts` with the exact FC16 write boundary.
- Add write planning/state to `IdmModbusClient` without changing proven read
  paths or official register definitions.
- Extend Python generation, TypeScript scenario parsing/execution, API
  promotion, package smoke, documentation, and clause-aware phase gates.

</code_context>

<specifics>
## Specific Ideas

- Functional equivalence to `idm-heatpump-api` is the overriding requirement.
- Preserve every write safety protection; write behavior affects real
  equipment even though this phase performs no live hardware operation.
- Complete all seven omitted client members and `WriteSafetyResult`, but keep
  web work and final publication in their existing later phases.

</specifics>

<deferred>
## Deferred Ideas

- Optional read-only web parity remains Phase 4.
- Latest-stable revalidation, public release metadata, and removal of
  `private: true` remain Phase 5.
- Live hardware validation is not performed or claimed.

</deferred>
