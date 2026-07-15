---
status: issues_found
depth: DEEP
files_reviewed: 44
findings:
  critical: 2
  warning: 3
  info: 0
  total: 5
---

# Phase 01 Code Review

## Review scope

Reviewed the complete requested Phase-1 implementation, generated contracts,
fixtures, tests, CI workflow, and parity tooling against the pinned Python
`idm-heatpump-api` `0.7.6` contract at
`ad121ebf34a5f5e37204371c026927d77efcd15c`.

The static register catalog matches the generated 26-field schemas for the
three authoritative model maps. The review found no attempt to normalize away
the official occupied-range overlaps: humidity remains `1392/FLOAT/count=2`,
heating-circuit A mode remains `1393/UCHAR/count=1`, and the overlaps at 1393,
1442, and 1484 remain separate definitions. The primitive Float32 path is
explicitly low-word-first. No register-address correction is proposed by this
review.

## Critical findings

### CRITICAL-01: `RegisterDef` is declared complete as a factory but has no runtime package export

**Evidence**

- `contracts/api-mapping.json:1292-1313` marks the public Python class
  `RegisterDef` as `complete` and explicitly selects
  `readonly_object_factory` with `constructor: factory`.
- `src/registers/definitions.ts:178-286` implements the selected factory only
  as the internal function `createRegisterDef`.
- `src/index.ts:41` exports only `type RegisterDef`; type exports are erased
  from both ESM and CommonJS output.
- `test/parity/api-parity.test.ts:381-412` hard-codes `RegisterDef` as the sole
  exception to the runtime export closure and explicitly requires
  `createRegisterDef` to remain hidden. This test therefore masks rather than
  detects the mapping/implementation contradiction.

**Impact**

The built package has no `RegisterDef` runtime value and no public factory, so
a JavaScript consumer cannot perform the Python-equivalent construction at
all. This makes the `complete` mapping and generated API documentation false.
It also blocks the documented advanced custom-register workflow needed by the
later write phase: callers cannot create an ad-hoc definition through the
package's public surface.

**Required action**

Expose the mapping-approved runtime counterpart, for example a frozen
`RegisterDef` value with a `create(input)` factory backed by the existing
validation, while retaining the interface in the TypeScript type namespace.
Export the necessary input type as part of that usable construction surface.
Remove the hard-coded type-only exception and test ESM, CommonJS, declarations,
and an installed tarball for `RegisterDef.create(...)`. Do not downgrade the
Python symbol to `not_applicable`; custom register construction is part of the
public upstream contract.

### CRITICAL-02: Contract ordering uses locale collation and disagrees with Python's canonical ordering

**Evidence**

- `contracts/normalization.md:13-16` requires sets to be sorted by canonical
  JSON and mapping keys to be sorted lexicographically.
- `scripts/generate-python-contract.py:77-78`, `101-114`, and `145-155` use
  Python lexical ordering and canonical JSON with sorted keys.
- `src/contracts/tagged-values.ts:213-215`, `270-272`, `288-293`, and
  `313-321` instead compare keys and canonical JSON strings with
  `localeCompare`, whose ICU/locale collation is neither Python code-point
  ordering nor environment-independent.
- The same mismatch appears in public registry/schema ordering at
  `src/registers/registry.ts:93-96` and the full serializer at
  `src/registers/serialize.ts:73-80`.
- `test/parity/scenario-schema.test.ts` exercises bounded shapes and ordinary
  values but has no case/collation boundary that joins TypeScript ordering to
  Python ordering.

**Reproduction**

`normalizeTaggedValue(new Set(["z", "ä"]))` returns `["ä", "z"]` on the
review runtime, while the pinned Python normalization returns `["z", "ä"]`.
Likewise `new Set(["Z", "a"])` becomes `["a", "Z"]` in TypeScript but
`["Z", "a"]` in Python.

**Impact**

Valid contracts can differ despite identical semantic input, and the result
can change with Node/ICU locale data. This breaks the closed cross-language
normalization contract and will be especially visible once localized web
values enter Phase 4. Set normalization produces an array, so this is a direct
semantic difference, not merely JSON object presentation.

**Required action**

Implement one locale-independent comparator that matches Python Unicode
code-point ordering, plus a canonical JSON sort key that recursively orders
mapping keys exactly like the Python generator. Use it consistently in tagged
values, registry schemas, and serializers. Add cross-language vectors for
upper/lower case, punctuation, accented characters, astral code points,
numeric-looking keys, and nested objects/sets.

## Warning findings

### WARNING-01: Fractional zone and room counts are silently truncated instead of rejected like Python

**Evidence**

- `src/registers/registry.ts:121-158` validates only numeric ranges, not the
  integer behavior that Python later enforces through `range(...)`.
- `src/registers/registry.ts:195-197` and
  `src/registers/zone-modules.ts:17-20,39-40` use `<=` loops, which silently
  floor positive fractional counts.
- `test/registers/builders.test.ts:328-365` covers only integer boundary
  values (`0`, `11`, `0`, `9`) and valid integer counts.
- `scripts/generate-python-contract.py:754-784` generates only integer circuit,
  zone, and room cases, leaving this acceptance boundary outside the Golden
  contract.

**Reproduction**

- `buildRegisterMap({ zoneModules: 1.5 })` succeeds with 299 registers; pinned
  Python raises `TypeError` because `1.5` cannot be used by `range`.
- `getZoneModuleRegisters(1, 1.5)` succeeds with one room (7 registers); pinned
  Python raises the same `TypeError`.
- A model with `zoneModules: 1.5` succeeds with one zone in TypeScript and is
  rejected by Python.

**Impact**

Runtime input from JSON or plain JavaScript bypasses TypeScript's intended
integer domain and produces a valid-looking but semantically different
register map.

**Required action**

Generate explicit Python facts for fractional and non-finite counts, then
match their acceptance/rejection precisely. In particular, reject fractional
active zone counts and fractional room counts when Python reaches a range
operation; preserve Python's precedence behavior for ignored manual options.
Add focused builder and model-info tests rather than relying on TypeScript
types alone.

### WARNING-02: Standalone release evidence validation permits paths outside `test/` and non-files

**Evidence**

- `scripts/generate-api-parity.mjs:655-668` accepts any string matching
  `^test/.+\.test\.ts$` and checks only `existsSync(resolve(ROOT, path))` for a
  `complete` row.
- A value such as `test/../../outside.test.ts` matches that expression, but
  `resolve` escapes the repository and can satisfy the gate with an unrelated
  path. `existsSync` also accepts a directory or symlink.
- `test/parity/api-parity.test.ts:268-270` repeats the same weak expression and
  existence-only assertion, so it does not cover containment, file type,
  symlinks, emptiness, or size.
- `scripts/check-parity.mjs:437-466` already has the stronger containment,
  `..`, `lstat`, symlink, regular-file, non-empty, and size checks, but those
  protections are absent from the standalone
  `generate-api-parity.mjs --release` gate documented in
  `docs/API-PARITY.md:298-300`.

**Impact**

A malformed or malicious mapping can claim a `complete` symbol using evidence
that is not a repository test. This weakens the release-state machine exactly
where all rows will eventually be promoted.

**Required action**

Share one evidence-path validator between the generator and orchestrator.
Canonicalize under `<root>/test`, reject `..` and escapes, use `lstat`, reject
symlinks, require a bounded non-empty regular `.test.ts` file, and add negative
release-mode tests for traversal, directories, symlinks, empty files, and
oversized files.

### WARNING-03: The Python reference process is not isolated from ambient Python import state

**Evidence**

- `scripts/check-parity.mjs:91-102` removes selected Git variables and one
  legacy checkout variable but retains `PYTHONPATH`, `PYTHONHOME`, and other
  Python startup/import controls.
- `scripts/check-parity.mjs:323-344` passes that environment to every Python
  invocation and does not use Python isolated mode (`-I`).
- `scripts/check-parity.mjs:382-391` verifies the installed `pymodbus`
  distribution metadata, but that does not prove which importable module wins
  if `PYTHONPATH` shadows it.
- `scripts/generate-python-contract.py:930-946` inserts the verified checkout
  only after interpreter startup; an ambient `sitecustomize` has already run,
  and an ambient `pymodbus` can still precede the venv's site-packages.
- `test/parity/phase-gate.test.ts:259-269` checks shell-free calls and selected
  literals but has no poisoned-environment test.

**Impact**

`npm run parity:check` is not fully reproducible from its declared inputs. A
developer/runner `PYTHONPATH` can change imported dependencies or execute
startup customization even though checkout identity and installed package
metadata appear correct.

**Required action**

Run venv verification and contract generation in Python isolated mode and
construct a minimal allowlisted environment. Explicitly remove Python startup,
home, and path variables while preserving only required platform/TMP settings
and the two test hooks when deliberately enabled. Add a test with a synthetic
`PYTHONPATH` shadow module or `sitecustomize` sentinel and prove it is neither
imported nor executed.

## Conclusion

Phase 1 should not be marked verified until both critical findings are fixed
and the Golden/consumer tests no longer encode the missing runtime factory or
locale-dependent ordering. The three warnings should be resolved before later
phases rely on these contracts as release evidence. Register-map protocol
invariants themselves passed this review.
