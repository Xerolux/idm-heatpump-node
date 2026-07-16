# Phase 2: Modbus Reads, Detection, and Resilience - Pattern Map

**Mapped:** 2026-07-16  
**Files classified:** 39 likely or conditional files  
**Analogs found:** 36 / 39  
**Authority:** Python `idm-heatpump-api` `v0.7.6` at
`ad121ebf34a5f5e37204371c026927d77efcd15c`

## Scope and Authority Notes

- Target `AGENTS.md`, `docs/PARITY-CONTRACT.md`, `UPSTREAM-PARITY.json`, the
  pinned Python API/protocol documents, and
  `docs/Register-Map-Invariants.md` were read before mapping these patterns.
- The existing TypeScript semantic core is the implementation-style authority.
  The pinned Python client and tests are the behavioral authority where the
  Node repository has no transport/client analog yet.
- The safest contract evolution is a separate, closed
  `test/fixtures/transport-behavior.json` plus
  `src/contracts/transport-scenario.ts`. Phase-1 scenario schema v1 explicitly
  rejects runtime reads, writes, and web operations; it must not be widened
  silently.
- The file split under `src/client/` and `src/transport/` is discretionary.
  The rows below name the research-recommended split so the planner can merge
  small files without changing the ownership or data-flow rules.

## File Classification

| New/Modified File                              | Role                    | Data Flow                              | Closest Analog                                                         | Match Quality         |
| ---------------------------------------------- | ----------------------- | -------------------------------------- | ---------------------------------------------------------------------- | --------------------- |
| `src/transport/types.ts`                       | model/provider contract | request-response                       | `src/types.ts`, pinned `client.py:_read_registers`                     | role-match            |
| `src/transport/errors.ts`                      | model/utility           | transform                              | `src/errors.ts`, pinned `IllegalAddressError`                          | role-match            |
| `src/transport/modbus-serial-adapter.ts`       | provider/adapter        | request-response                       | pinned `client.py:_read_registers`; no Node adapter exists             | behavioral-match      |
| `src/transport/index.ts`                       | route/barrel            | module export                          | `src/registers/index.ts`                                               | exact role            |
| `src/client/diagnostics.ts`                    | model/factory           | state snapshot/transform               | `src/types.ts:FeatureFlags` and `IdmModelInfo`                         | exact role            |
| `src/client/state.ts`                          | store/model             | event-driven state transitions         | `src/registers/registry.ts`, pinned client fields/reset methods        | partial               |
| `src/client/read-groups.ts`                    | service/utility         | batch/transform                        | pinned `_group_registers`, `_read_group`, `_read_individual_fallback`  | behavioral-match      |
| `src/client/detection.ts`                      | service                 | ordered request-response               | pinned `detect_model`; target `getDetectionRegisters`                  | behavioral-match      |
| `src/client/idm-modbus-client.ts`              | service/facade          | serialized request-response            | pinned `IdmModbusClient`; no Node client exists                        | behavioral-match      |
| `src/client/index.ts`                          | route/barrel            | module export                          | `src/registers/index.ts`                                               | exact role            |
| `src/contracts/transport-scenario.ts`          | utility/parser          | transform                              | `src/contracts/scenario.ts`                                            | exact role            |
| `test/support/fake-modbus-transport.ts`        | provider/test double    | scripted event-driven request-response | pinned `tests/fake_modbus.py`                                          | exact behavioral role |
| `test/support/fake-clock.ts`                   | provider/test double    | event-driven time                      | `PollRateLimiter` fake-clock test                                      | role-match            |
| `test/client/lifecycle.test.ts`                | test                    | request-response/state                 | pinned lifecycle tests and `test/semantic/constants-and-types.test.ts` | behavioral-match      |
| `test/client/errors.test.ts`                   | test                    | transform/error                        | `test/semantic/constants-and-types.test.ts`                            | role-match            |
| `test/client/diagnostics.test.ts`              | test                    | state snapshot                         | immutable `IdmModelInfo` tests and pinned diagnostics tests            | role-match            |
| `test/client/reads.test.ts`                    | test                    | request-response                       | `test/parity/codec-contract.test.ts`, pinned fake-transport tests      | behavioral-match      |
| `test/client/batching.test.ts`                 | test                    | batch                                  | pinned `test_fake_modbus_transport.py`                                 | exact behavioral role |
| `test/client/resilience.test.ts`               | test                    | event-driven retry/state               | pinned timeout/Code-2/fallback tests                                   | exact behavioral role |
| `test/client/detection.test.ts`                | test                    | ordered request-response               | pinned `test_client.py` detection tests                                | exact behavioral role |
| `test/transport/modbus-serial-adapter.test.ts` | test                    | request-response                       | existing process-boundary tests plus pinned request tests              | partial               |
| `test/parity/transport-contract.test.ts`       | contract test           | scenario request-response              | `test/parity/codec-contract.test.ts`                                   | exact role            |
| `test/fixtures/transport-behavior.json`        | fixture/data            | scripted request-response              | `test/fixtures/behavior-contract.json`                                 | exact role            |
| `scripts/generate-python-contract.py`          | generator/utility       | file I/O/transform                     | existing `_scenario` and `_behavior_fixture`                           | exact role            |
| `scripts/check-parity.mjs`                     | orchestrator            | process/file I/O                       | existing generated-path and staging pipeline                           | exact role            |
| `test/parity/generator.test.ts`                | generator test          | file I/O/transform                     | existing fixture allowlist/determinism tests                           | exact role            |
| `contracts/api-mapping.json`                   | config/authority        | mapping/transform                      | existing Phase-1 mapping rows                                          | exact role            |
| `contracts/typescript-extensions.json`         | config/authority        | mapping/transform                      | no existing TypeScript-only authority                                  | no analog             |
| `scripts/generate-api-parity.mjs`              | generator/validator     | file I/O/transform                     | existing status/evidence validation                                    | exact role            |
| `test/parity/api-parity.test.ts`               | contract test           | mapping/export closure                 | existing promotion and root-export tests                               | exact role            |
| `test/parity/phase-gate.test.ts`               | integration gate        | process/package                        | existing package/private/parity gates                                  | exact role            |
| `docs/API-PARITY.md`                           | generated documentation | projection                             | current generated document                                             | exact role            |
| `docs/PARITY-CONTRACT.md`                      | contract documentation  | policy                                 | current parity contract                                                | exact role            |
| `src/index.ts`                                 | package route/barrel    | module export                          | current checked root barrel                                            | exact role            |
| `package.json`                                 | config                  | dependency/build                       | current zero-runtime-dependency package                                | exact role            |
| `package-lock.json`                            | config/lock             | dependency graph                       | current npm lockfile                                                   | exact role            |
| `scripts/check-package.mjs`                    | package verifier        | package/file I/O                       | current ESM/CJS/type smoke test                                        | exact role            |
| `README.md`                                    | documentation           | projection                             | Phase-1 truthful-scope README pattern                                  | exact role            |
| `CHANGELOG.md`                                 | documentation           | append-only release notes              | Phase-1 Unreleased entry pattern                                       | exact role            |

## Pattern Assignments

### `src/transport/types.ts` and `src/transport/index.ts`

**Primary analogs:**

- `src/types.ts:1-38` for frozen string-value domains plus union types.
- `src/types.ts:60-128` for readonly inputs and immutable public values.
- `src/registers/index.ts:1-11` for a deliberately small `.js`-specifier barrel.
- Pinned `idm_heatpump/client.py:698-750` for the exact read identity carried by
  the contract.

Use a small adapter-neutral request/result surface. The protocol identity must
carry unit ID, `RegisterType`, FC03/FC04, address, count, and optional request
timeout. Keep adapter client classes, response objects, callback signatures,
and raw error values out of these declarations.

Copy the established import/export style:

```ts
import type { RegisterType } from "../types.js";

export interface ModbusReadRequest {
  readonly unitId: number;
  readonly registerType: RegisterType;
  readonly functionCode: 3 | 4;
  readonly address: number;
  readonly count: number;
  readonly timeoutMs?: number;
}
```

**Selected extension rule (G-01):** `ModbusTransport` is governed by the
separate closed TypeScript-extension authority and may be promoted as a
type-only root export only after that authority and its contract evidence are
green. Do not expose `modbus-serial` types through emitted declarations.

---

### `src/transport/errors.ts`

**Analog:** `src/errors.ts:1-16`.

Use stable categories/codes and owned diagnostic text:

```ts
export class SemanticValidationError extends RangeError {
  public readonly category = "validation" as const;
  public readonly code: SemanticValidationErrorCode;

  public constructor(code: SemanticValidationErrorCode, diagnostic: string) {
    super(diagnostic);
    this.name = "SemanticValidationError";
    this.code = code;
  }
}
```

Model normalized transport failures as a closed discriminated domain such as
`timeout`, `disconnected`, `socket`, `no_response`, `modbus`,
`illegal_address`, and `invalid_response`. The public
`IllegalAddressError` should follow the same named-error pattern and expose the
Python semantic marker (`isIllegalAddress`) without retaining the raw adapter
error as a public field.

**Pinned behavior:** Python `client.py:124-138` defines the marker, but the Node
adapter has stronger numeric evidence: only adapter `modbusCode === 2` is
authoritative. Never classify Code 2 from arbitrary localized message text.

---

### `src/transport/modbus-serial-adapter.ts`

**Behavioral analog:** pinned `idm_heatpump/client.py:698-750`.

The adapter should be thin:

1. Create/configure one `modbus-serial` TCP client.
2. Map holding to `readHoldingRegisters` and input to
   `readInputRegisters`.
3. Apply unit ID and milliseconds timeout.
4. Return a newly owned word array.
5. Reject non-array, non-integer, out-of-16-bit, short, or long responses before
   domain decoding.
6. Normalize numeric device exceptions and transport failures.
7. Wrap callback-style close/destroy as idempotent promises.

Pinned request selection:

```py
if reg_type == RegisterType.HOLDING:
    read_task = client.read_holding_registers(address=address, count=count, **kwargs)
else:
    read_task = client.read_input_registers(address=address, count=count, **kwargs)
```

**Timeout pattern:** temporarily set the adapter request timeout while the
client operation mutex is held, await the request to settle, and restore the
normal timeout in `finally`. Do not use an abandoning `Promise.race`; a losing
wire request would remain active and break serialization.

**No close Node analog exists.** Keep the adapter isolated enough that all its
tests can mock the constructor/client without opening TCP.

---

### `src/client/diagnostics.ts`

**Analog:** `src/types.ts:76-128`, especially `IdmModelInfo.create`.

Use interface + frozen factory, clone arrays, and expose no mutable set/map:

```ts
export interface IdmClientDiagnostics {
  readonly navigatorType: string;
  readonly modbusConnected: boolean;
  readonly firmware: string | null;
  readonly lastError: string | null;
  readonly permanentlyFailedRegisters: readonly string[];
  readonly connectionSuspect: boolean;
  readonly batchUnsafeRegisters: readonly string[];
}

export const IdmClientDiagnostics = Object.freeze({
  create(input: IdmClientDiagnosticsInput): IdmClientDiagnostics {
    return Object.freeze({
      ...input,
      permanentlyFailedRegisters: Object.freeze([...input.permanentlyFailedRegisters]),
      batchUnsafeRegisters: Object.freeze([...input.batchUnsafeRegisters]),
    });
  },
});
```

Apply the same pattern to `ModbusErrorContext`. The exact Python fields are at
pinned `client.py:321-329`; diagnostic construction is at
`client.py:1224-1237`.

**Exact shape:** `IdmClientDiagnostics` does not include unsupported registers.
That state remains exposed by `getUnsupportedRegisters()`.

**Ordering:** the public factory clones, freezes, and preserves caller-provided
array order exactly. `IdmModbusClient.getDiagnostics()` sorts copied internal
sets using `src/contracts/canonical-order.ts:3-18` before calling the factory;
the factory itself must never sort semantic sequences.

---

### `src/client/state.ts`

**Analogs:**

- `src/registers/registry.ts:61-126` for one owner, copied inputs, readonly
  public views, and deterministic sorted snapshots.
- Pinned `client.py:448-478` for the single client-owned state inventory.
- Pinned `client.py:1607-1648` for exact reset/query semantics.

One client instance should own:

- current transport;
- FIFO exclusive-operation gate;
- immutable model info and cached register map;
- last error context;
- connection-suspect flag;
- transient failure counts;
- unsupported, permanent, and batch-unsafe name sets.

State should not be duplicated between facade, batching service, and detection
service. Helpers may receive the owner through a narrow internal interface, but
only one object mutates it.

**Reset landmine:** `resetFailedRegisters()` clears transient, permanent, and
unsupported state only. It must not clear batch quarantine, last error,
connection suspect, connection, or model.

---

### `src/client/read-groups.ts`

**Behavioral analogs:**

- Pinned `client.py:1363-1433` for filtering, ordering, and grouping.
- Pinned `client.py:1435-1523` for batch decode/quarantine.
- Pinned `client.py:1525-1605` for ordered individual fallback.
- `src/codec.ts:348-374` for register-aware decoding.
- `src/contracts/canonical-order.ts:3-18` for Python-compatible string ordering.

The grouping core should remain a small pure function:

```ts
const expectedNext = previous.address + previous.size;
const span = next.address + next.size - first.address;
const canMerge =
  next.registerType === first.registerType && next.address === expectedNext && span <= maxGroupSize;
```

Preserve the pinned order:

1. filter write-only and permanent definitions;
2. split pre-quarantined definitions;
3. stable-sort batch candidates by register-type value then address;
4. read groups in sorted order;
5. read pre-quarantined definitions individually in original filtered-input
   order.

**Required overlap traces:** `1392/2` and `1393/1`, plus the `1442` and `1484`
logical overlaps, must start separate requests. Never sum logical sizes or
normalize occupied ranges.

**Failure-state landmine:** ordinary public `readRegister()` does not increment
fallback counters or mark Code 2 unsupported. Those mutations occur in the
ordered individual fallback path (`client.py:1525-1605`).

---

### `src/client/detection.ts`

**Behavioral analog:** pinned `client.py:878-1027`.

**Target integration analogs:**

- `src/registers/registry.ts:175-244` for building the exact model-aware map.
- `src/registers/registry.ts:246-278` for reusable circuit/zone/feature probe
  definitions.
- `src/types.ts:88-128` for immutable `IdmModelInfo`.
- `src/constants.ts:27-50` for all defaults, models, limits, and feature names.

Keep an explicit ordered probe table or explicit code whose order is obvious:

1. circuits `1350 + 2*n`, count 2;
2. zones `2000 + 65*n`, count 1;
3. solar `1850/2`;
4. ISC `1870/2`;
5. PV `74/2`;
6. cascade `1147/1`;
7. Navigator 10 `4108/2`;
8. optional firmware `4120/2`.

The direct `4108` and `4120` probes are not returned by
`getDetectionRegisters()` and must remain explicit.

**Sentinel/presence rules:**

- circuit Float32 `-1.0` is unavailable;
- two consecutive circuit or zone misses stop the scan;
- an exact two-word circuit response that is undecodable/out-of-range still
  proves the slot active;
- exact solar/ISC pairs prove presence;
- cascade low byte `255` is unavailable; `0` is valid present evidence;
- `4108/2` selects Navigator 10;
- otherwise zones select Pro, circuits select Navigator 2.0, no evidence
  selects `Unknown`;
- `modelName` still falls back to Navigator 2.0 for no/Unknown detection.

**Map integration:** after detection, create a new immutable `IdmModelInfo`,
invalidate the cached map, then call the existing `buildRegisterMap` rather than
rebuilding protocol facts.

---

### `src/client/idm-modbus-client.ts` and `src/client/index.ts`

**Primary behavioral analog:** pinned `client.py:412-1027`,
`1148-1237`, and `1363-1648`.

**Target style analogs:**

- constructor validation and injected options:
  `src/timing.ts:11-34`, `55-66`;
- immutable public model values: `src/types.ts:88-128`;
- internal codec reuse: `src/codec.ts:348-374`;
- registry lookup/map cache: `src/registers/registry.ts:175-301`.

Use one facade with private locked/unlocked method pairs. A non-reentrant FIFO
mutex must not be acquired again from a method already inside the exclusive
operation. A useful naming pattern is:

```ts
public async readRegister(...) {
  return this.#exclusive(() => this.#readRegisterLocked(...));
}

async #readRegisterLocked(...) {
  await this.#ensureConnectedLocked();
  return this.#retryReadLocked(...);
}
```

The exclusive scope must cover lazy connect, all attempts, reconnect, delay,
batch fallback, individual reread, detection, and state mutation.

Constructor defaults come from `src/constants.ts:27-33`. Validate host, port
`1..65535`, slave ID `1..247`, retry count `>=1`, and group size `>=1` before
creating a transport. The public TypeScript options object contains only port,
slave ID, timeout, max retries, and max group size. Python's
`pymodbus_retries` is internalized at zero. Transport factory, clock, and sleep
injection use a direct-path internal creation seam that is absent from both
package barrels and emitted public declarations.

**Retry split:**

- timeout/disconnect/socket/no-response: mark suspect, record sanitized context,
  hard reconnect, delay `0.5 * 2 ** attempt`;
- generic Modbus: retry same connection with the same delay;
- numeric Code 2: throw `IllegalAddressError` immediately, no delay/retry;
- success clears suspect.

**Public helpers:** `decodeValue`/`encodeValue` methods should delegate to the
existing internal codec helpers rather than duplicate dispatch.

**Cross-phase landmine:** do not add fake write methods to make the class appear
complete. See the governance section before root export or mapping promotion.

---

### `src/contracts/transport-scenario.ts`

**Analog:** `src/contracts/scenario.ts:3-78`, `135-188`, `198-314`, and
`349-378`; value ownership comes from
`src/contracts/tagged-values.ts:18-24`, `264-289`, and `360-451`.

Copy these exact parser patterns:

- frozen stable error codes;
- bounded collection sizes;
- exact allowed root/scenario fields;
- exact pinned baseline;
- closed operation kinds;
- own-property/plain-object parsing;
- recursive tagged-value parsing;
- 16-bit validation only at request/response word boundaries;
- newly owned recursively frozen return graph.

Prefer schema version 1 for the separate transport fixture, or version 2 if the
planner deliberately versions the shared behavior fixture. Never accept both
old and new shapes permissively.

Expected operation kinds should be the minimum executable Phase-2 surface, for
example lifecycle, single read, batch read, probe, and detect. Reject write and
web operations until their phases.

---

### `test/support/fake-modbus-transport.ts`

**Exact behavioral analog:** pinned `tests/fake_modbus.py:20-106`.

Retain:

- scripted input/holding read responses;
- device Modbus errors;
- numeric illegal-address responses;
- thrown transport errors;
- short/malformed responses;
- ordered read/lifecycle trace;
- `activeRequests` and `maxActiveRequests`;
- deterministic request delay/yield;
- close/destroy/connect state.

Use the new adapter-neutral contract directly. Unlike the Python fake, do not
imitate `modbus-serial` methods; that would make domain tests adapter-coupled.

The fake should record complete immutable requests, including unit ID,
function code, type, address, count, and timeout. Return fresh arrays so client
mutation cannot change scripted evidence.

---

### `test/support/fake-clock.ts`

**Analog:** `test/semantic/constants-and-types.test.ts:353-369`.

Use a small owned clock:

```ts
let now = 0;
const delays: number[] = [];

const clock = () => now;
const sleep = async (seconds: number) => {
  delays.push(seconds);
  now += seconds;
};
```

Expose readonly snapshots, support explicit advancement, and avoid wall-clock
timers. The client needs both monotonic `now` and injected `sleep`; do not
couple it to `performance.now()` or `setTimeout()` in tests.

---

### `test/client/*.test.ts`

**Testing style analogs:**

- immutable factory and injected clock:
  `test/semantic/constants-and-types.test.ts:237-314`, `353-387`;
- exact generated vector runner:
  `test/parity/codec-contract.test.ts:34-70`, `129-183`;
- pinned behavior cases:
  `tests/test_client.py:63-213`, `584-780`;
- pinned batching/concurrency cases:
  `tests/test_fake_modbus_transport.py:86-185`, `259-454`.

Assign focused responsibilities:

- `lifecycle.test.ts`: constructor bounds, connect no-op/failure, disconnect,
  force reconnect, suspect reconnect, FIFO serialization, release-after-error;
- `errors.test.ts`: normalized categories, Code 2 marker, exact attempt numbers,
  invalid response, no raw adapter object;
- `diagnostics.test.ts`: frozen snapshots, sorted names, model fallback,
  firmware text, clear-last-error, host redaction, exact resets;
- `reads.test.ts`: FC03/FC04, exact address/count, write-only/permanent rejection,
  short/invalid response before decode, `readValue` registry lookup;
- `batching.test.ts`: empty, adjacency, gap, type split, max span, official
  overlaps, fallback order, pre-quarantine order, suspect reread;
- `resilience.test.ts`: exact attempts and delays, reconnect classes, generic
  Modbus same-connection retry, Code 2 no retry, failure thresholds;
- `detection.test.ts`: all model priorities, stop rules, sentinels,
  undecodable-but-present slots, feature flags, firmware on/off.

Use `example.invalid` or RFC 5737 documentation addresses only. Never use a
real device endpoint.

---

### `test/transport/modbus-serial-adapter.test.ts`

**Closest Node analog:** process-boundary tests such as
`test/parity/api-parity.test.ts:159-171` use explicit injected processes and
bounded outputs; the adapter test should apply the same principle to an
injected/mocked constructor.

Verify:

- `connectTCP`, ID, and timeout setup;
- FC03/FC04 method choice;
- one wire call per client attempt;
- temporary timeout restoration in success and failure paths;
- numeric `modbusCode === 2`;
- stable normalization for timeout/socket/disconnect/no-response;
- exact 16-bit word count/shape;
- idempotent callback close/destroy promise wrapping;
- no host/raw adapter detail in normalized messages.

No live TCP belongs in this suite.

---

### `test/parity/transport-contract.test.ts`

**Analog:** `test/parity/codec-contract.test.ts:17-31`, `44-70`, and
`129-183`.

Define typed fixture interfaces, parse through the strict transport parser,
execute a closed operation switch, normalize actual results/state with
`normalizeTaggedValue`, and compare:

- result;
- exact ordered request/lifecycle trace;
- delay/clock sequence;
- final state.

As in the codec runner, unknown fixture operations must throw rather than be
ignored. Bind the suite to the exact baseline SHA and assert a closed unique
case inventory.

---

### `scripts/generate-python-contract.py`,

`test/fixtures/transport-behavior.json`, and
`test/parity/generator.test.ts`

**Analogs:**

- fixed output allowlist: generator `57-64`;
- eight-field scenario helper: generator `957-967`;
- behavior generation: generator `1050-1122`;
- exact fixture dictionary: generator `1125-1151`;
- generator test allowlist/determinism:
  `test/parity/generator.test.ts:27-34`, `498-568`.

Add the transport fixture as an explicit output path; do not write it as an
untracked side effect. Generate it from the verified pinned checkout and a
deterministic Python fake/monkeypatch, not from live sockets.

Every case must preserve the eight CTR-01 fields. Use synthetic endpoints and
words. Add tests for:

- exact baseline and schema;
- closed operation inventory;
- exact request/state fields;
- deterministic bytes and trailing newline;
- check-mode byte/mtime non-mutation;
- drift reporting and atomic rollback;
- absence of Navigator 1.x facts and device data.

**Landmine:** fixture values are evidence, not implementation inputs. Production
code must never import this JSON.

---

### `scripts/check-parity.mjs`

**Analog:** current generated artifact allowlist at `50-59`, evidence staging at
`485-506`, and generation pipeline at `509-532`.

Add the new fixture/parser/test inputs to the same fixed, bounded,
non-symlinked, isolated shadow-root flow. Keep Python execution under `-I`, the
exact verified checkout, bounded output, and existing timeouts.

Do not add an ambient sibling-checkout shortcut. Do not make the parity runner
mutate source fixtures during check mode.

---

### `contracts/api-mapping.json`, `scripts/generate-api-parity.mjs`,

`test/parity/api-parity.test.ts`, and `docs/API-PARITY.md`

**Analogs:**

- Phase-2 rows:
  `contracts/api-mapping.json:699-720`, `788-827`,
  `1240-1255`, `1557-1570`;
- mapping promotion/evidence:
  `test/parity/api-parity.test.ts:263-314`;
- class member closure:
  `test/parity/api-parity.test.ts:317-365`;
- checked root export closure:
  `test/parity/api-parity.test.ts:390-440`;
- release rejection of partial/planned:
  `scripts/generate-api-parity.mjs:648-671`.

Promote the four fully Phase-2-owned mapped values/functions only after their
complete evidence exists:

- `IdmClientDiagnostics`;
- `IllegalAddressError`;
- `ModbusErrorContext`;
- `quietPymodbusLogging`.

Under G-02, `IdmModbusClient` uses an exact release-blocking `partial`
lifecycle because the Python class fixture also includes Phase-3 write methods.
Keep the generated document a projection; never hand-edit it.

Under G-01, validate the TypeScript-only extension registry separately from the
exact 89 Python rows and include a generated “TypeScript extensions” section.
Do not fabricate a Python symbol or change the Python inventory count.

---

### `contracts/typescript-extensions.json`

**No existing analog.**

The planner resolved `ModbusTransport` as a package-root public TypeScript-only
type under G-01. The authority includes:

- TypeScript symbol;
- export path;
- kind (`type`/`interface`);
- owner phase;
- status;
- rationale;
- contract evidence;
- a flag proving it is additive and has no Python counterpart.

It must be validated independently and remain release-safe. The exact Python
mapping must stay 89/89.

Validate this authority separately from the exact Python mapping and keep
release validation red until the extension is complete.

---

### `src/index.ts`, `test/parity/phase-gate.test.ts`, and

`docs/PARITY-CONTRACT.md`

**Analog:** the checked barrel at `src/index.ts:1-53` and export closure at
`test/parity/api-parity.test.ts:404-440`.

Keep root exports explicit with `.js` specifiers. Never use `export *` for the
client or transport barrels because it can leak internal normalized errors,
adapter classes, or helpers.

Only export symbols whose mapping/extension authority and evidence are green.
If `IdmModbusClient` is allowed as a private-development `partial` export,
tests must:

- machine-check the exact implemented member subset;
- machine-check the exact Phase-3 omissions;
- keep release mode red;
- reject throwing write stubs;
- keep `private: true`.

Update `docs/PARITY-CONTRACT.md` with the selected G-01/G-02 durable contract
rules.

---

### `package.json`, `package-lock.json`, and

`scripts/check-package.mjs`

**Analog:** current package config `package.json:1-92` and package smoke test
`scripts/check-package.mjs:27-105`.

Add only `modbus-serial` as the Phase-2 runtime dependency and regenerate the
lockfile normally. Preserve:

- Node `>=22`;
- ESM primary plus CJS from the same source;
- `private: true`;
- `sideEffects: false`;
- `files: ["dist"]`;
- current build/check sequence.

Extend the tarball smoke test to instantiate the safe public/data surface and
type-check the approved transport/client signatures without opening a socket.
Do not call `connect()` in the package smoke test.

---

### `README.md` and `CHANGELOG.md`

**Analog:** Phase-1 summaries `01-10-SUMMARY.md` and the existing truthful-scope
documentation pattern.

Document only implemented read/detection behavior. Keep these statements
explicit:

- package remains private;
- writes and web supplement are still incomplete;
- no live hardware write occurred;
- no Navigator 1.x support;
- Modbus TCP provides no library-level TLS/authentication;
- caller supplies/trusts the target endpoint.

Do not call the port fully functionally equivalent until Phases 3-5 close.

## Shared Patterns

### Strict TypeScript and ESM

**Source:** `tsconfig.json:2-24`, `eslint.config.mjs:8-15`,
`.prettierrc.json:1-6`.

- `.js` relative specifiers in TypeScript.
- `import type` for type-only dependencies.
- `strict`, exact optional properties, unchecked-index checks, unknown catch
  values.
- readonly inputs/outputs; clone and freeze public collections.
- no unused adapter compatibility fields.

### Stable Errors and Sanitized Diagnostics

**Source:** `src/errors.ts:1-16`,
`src/contracts/scenario.ts:10-17`.

- Named error classes.
- Stable semantic category/code.
- Bounded diagnostic text.
- No raw adapter objects, host/IP literals, or future write payloads.
- Numeric Modbus exception code is structured data, not parsed message text.

### Python-Compatible Ordering

**Source:** `src/contracts/canonical-order.ts:3-18`,
`src/registers/registry.ts:107-126`.

- Sort deterministic public snapshots explicitly.
- Use Unicode code-point comparison for names.
- Sort batch candidates by register-type value and numeric address.
- Preserve original input order for pre-quarantined individual reads.

### Runtime Immutability

**Source:** `src/types.ts:40-58`, `113-128`;
`src/registers/map-utils.ts:4-35`.

`Object.freeze(new Set())` and `Object.freeze(new Map())` do not block their
mutating methods. Use closure-backed readonly facades or frozen arrays for
public state.

### Contract Parsing

**Source:** `src/contracts/scenario.ts`, `src/contracts/tagged-values.ts`.

- Exact fields, exact provenance, closed operation set.
- Bounded size/depth/count.
- Plain own-data properties only.
- Clone and freeze before use.
- Validate Modbus words at transport boundaries, not as a global numeric rule.

### Contract-First TDD

**Source:** `test/parity/codec-contract.test.ts:129-183`,
`test/parity/scenario-schema.test.ts:410-723`.

Each slice should start with:

1. focused local fake-transport RED test;
2. strict parser/generated scenario RED test when observable parity changes;
3. GREEN implementation;
4. typecheck;
5. focused parity;
6. lint/format/build at wave closure.

## Contract Governance Landmines

### 1. `IdmModbusClient` spans Phase 2 and Phase 3

The existing mapping row is one whole Python class
(`contracts/api-mapping.json:788-809`). The Python class fixture includes both
Phase-2 read/detection members and Phase-3 write/cyclic/throttle members.
Current tests require every later-owned row to remain planned and absent
(`test/parity/api-parity.test.ts:390-400`) and export only complete mappings
(`405-413`).

**Resolved by G-02:** add a reviewed `partial` private-development lifecycle
with exact implemented/omitted member partition evidence and a hard release
block. Do not mark the class `complete`, weaken member closure, or add throwing
write stubs in Phase 2.

### 2. Public `ModbusTransport` has no Python row

The Python mapping is required to stay exactly 89/89
(`test/parity/api-parity.test.ts:230-234`). **Resolved by G-01:**
`ModbusTransport` uses the separate closed TypeScript-extension authority and a
type-only root export.

Do not add a fake Python row and do not relax the exact inventory assertion.

### 3. Direct reads versus fallback failure state

Pinned `read_register` (`client.py:1148-1164`) rejects write-only/permanent
registers and performs an exact read, but does not mutate unsupported/permanent
sets on Code 2. Those state mutations occur in
`_read_individual_fallback` (`client.py:1525-1605`).

Keep these paths distinct even if they share a private raw-read helper.

### 4. Non-reentrant mutex design

The locked context requires one mutex around complete consumer operations.
Implementing every private helper as independently locking will deadlock during
batch fallback, detection, or reconnect. Use one public exclusive wrapper and
locked private helpers.

### 5. Request timeout restoration

Detection changes one request timeout to two seconds. Restore the normal
adapter timeout in `finally`, including Code 2, socket error, and invalid
response paths. A stale two-second timeout would change later consumer reads.

### 6. Official overlaps are positive requirements

The exact grouping rule is:

```text
next.address === previous.address + previous.size
```

No no-overlap invariant, datatype shrink, address shift, gap spanning, or
`1392/3` combined request is allowed.

### 7. Compound roadmap requirements remain partially open

**Resolved by G-04:** TRN-03R and ERR-01R are the Phase-2 child clauses;
TRN-03W and ERR-01W are the Phase-3 child clauses. TRN-03 and ERR-01 remain
umbrella rows and cannot be phase-completed directly.

## No Analog Found

| File/Concern                           | Reason                                                            | Planner Guidance                                                                                                                |
| -------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `contracts/typescript-extensions.json` | The repository currently models only exact Python public symbols. | Add only through an explicit governance plan; otherwise keep `ModbusTransport` off the root export.                             |
| FIFO async mutex implementation        | No production async-lock primitive exists in the Node codebase.   | Implement a small promise queue with tests for FIFO, one active operation, and release after rejection; avoid a new dependency. |
| Real Modbus adapter                    | Phase 1 has no network provider.                                  | Use pinned Python request behavior plus the audited `modbus-serial` API; keep it behind `ModbusTransport`.                      |

## Metadata

**Analog search scope:** `src/`, `test/`, `scripts/`, `contracts/`, Phase-1
plans/summaries/verification, and pinned Python client/tests/docs.  
**Target source files inspected:** 25+ implementation/test/config artifacts.  
**Pinned Python files inspected:** `idm_heatpump/client.py`,
`tests/fake_modbus.py`, `tests/test_fake_modbus_transport.py`,
`tests/test_client.py`, plus protocol/API documentation.  
**Pattern extraction date:** 2026-07-16
