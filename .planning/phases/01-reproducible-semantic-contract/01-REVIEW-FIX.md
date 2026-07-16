---
status: all_fixed
findings_in_scope: 1
fixed: 1
skipped: 0
iteration: 4
---

# Phase 01 Code Review Fix — Iteration 4

## Result

The sole final clean-review finding, `WARNING-04`, is fixed by commit
`025e86d`. The README now uses the canonical `outdoor_temp` register key, and
an executable documentation contract extracts every literal `getRegister(...)`
key from the README and resolves it through the public package API. The
contract also rejects the former `outdoor_temperature` typo.

No register definition or compatibility alias was changed to accommodate the
documentation error. No register address, datatype, size, register type, model
gate, function code, batching rule, or write-safety metadata changed.

## Iteration 3 semantic remediation

The sole iteration-3 finding, `CRITICAL-03`, was fixed by commit `720d65c`.
TypeScript now has an explicit lossless contract-set snapshot boundary for
already-enumerated source-language set members, and the Python generator now
rejects integer values and integer mapping keys outside the exact JavaScript
safe-integer domain. No register address, datatype, size, register type, model
gate, function code, batching rule, or write-safety metadata changed.

## Prior iteration-3 finding fixed

### CRITICAL-03 — lossless source sets and one reviewed integer domain

`createContractSetSnapshot()` copies a bounded dense standard array before any
native ECMAScript `Set` construction can apply SameValueZero. A frozen
null-prototype token is recognized through a private `WeakMap` brand, so an
ordinary object cannot spoof the boundary. The copied membership is immutable,
accessor-bearing, sparse, extra-property, symbol-property, and non-standard
arrays are rejected without invoking getters, and normalization applies the
existing cycle, depth, node, recursive-normalization, and structural-order
limits.

The boundary is explicitly a trusted enumeration of actual distinct
source-language set members. It does not claim to reproduce or validate the
source language's hash or equality construction. Native `Set` remains supported
for its actual runtime contents; documentation and tests state that it
canonicalizes `-0` to `+0` and collapses repeated NaNs before normalization.

The Python generator accepts non-boolean `int` values and integer mapping keys
only in `[-9007199254740991, 9007199254740991]`, including validation of
already-normalized integer values. Values one step outside either boundary fail
with `invalid_contract_value`. Finite Python floats and TypeScript numbers such
as `1e20` remain valid even when mathematically integral. TypeScript continues
to reject `bigint` and unsafe numeric mapping keys.

Exact cross-language evidence now covers raw Python `{-0.0}` against a
TypeScript snapshot containing `-0`, two distinct Python NaN objects against a
snapshot containing two NaNs, one NaN, positive zero, ordinary members, nested
sets, structural ordering, native `Set` SameValueZero behavior, integer
boundaries, spoofing, mutation, dense-array inspection, cycles, depth, node
count, and collection length.

## Iteration 3 verification

- RED focused run: 6 expected failures and 25 existing passes before the
  implementation and regenerated fixture.
- `npm run parity:generate`: passed through the self-provisioned exact Python
  `0.7.6`, tag `v0.7.6`, commit
  `ad121ebf34a5f5e37204371c026927d77efcd15c`; only
  `test/fixtures/behavior-contract.json` changed among generated fixtures.
- Final focused generator/scenario suite: 31 tests passed.
- Prettier format check, ESLint, strict TypeScript typecheck, and Python syntax
  compilation passed.
- `npm run parity:check`: passed non-mutating verification against the same
  exact pinned Python identity.
- `npm run pack:check`: passed ESM, CommonJS, declarations, the 15-file tarball,
  and installed-package smoke tests.
- The aggregate `npm run check` reached 243 of 244 passing tests. The unchanged
  self-provisioning phase-gate subprocess exceeded its fixed 180-second timeout
  by approximately 11 seconds under the 16-minute serial coverage load; the
  other 17 phase-gate tests passed.
- The unchanged timed-out phase-gate test then passed alone, 1 of 1, in 169.67
  seconds without increasing any timeout or weakening any assertion.
- Coverage excluding only that separately verified orchestration file passed
  226 of 226 tests with 91.81% statements, 90.54% branches, 89.42% functions,
  and 92.13% lines. `src/contracts/tagged-values.ts` achieved 91.84% statements,
  88.23% branches, 100% functions, and 91.62% lines.
- `git diff --check` passed, and no register source or register-schema fixture
  changed.

## Iteration 4 verification

- The focused README documentation contract passed: 1 test passed and 18
  unrelated phase-gate tests were skipped.
- The complete register builder/registry suite passed: 15 tests passed.
- Prettier format check, ESLint, strict TypeScript typecheck, and
  `git diff --check` passed.
- The implementation commit contains only `README.md` and
  `test/parity/phase-gate.test.ts`; review artifacts remain intentionally
  uncommitted.

## Cumulative disposition

Iteration 1 fixed the original runtime-export, validation-boundary,
evidence-containment, Python-isolation, ordering, and package findings in
commits `c3e350b`, `cd8d4ef`, `11a7845`, `0588b11`, `3e96e69`, and `569610e`.
Iteration 2 fixed language-neutral structural set ordering in `ec8da2d`.
Iteration 3 closes the remaining representational-domain hole in `720d65c`.
Iteration 4 corrects and contract-tests the final README key in `025e86d`.
All findings across the four review iterations are fixed; none is skipped.

The final reviewer should overwrite
`.planning/phases/01-reproducible-semantic-contract/01-REVIEW.md` with the clean
post-loop review. This fix report intentionally remains uncommitted.
