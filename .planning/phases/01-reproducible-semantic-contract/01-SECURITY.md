---
phase: 01
slug: reproducible-semantic-contract
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-16
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Audit Scope

This audit verifies the consolidated plan-time threat register in
`01-10-PLAN.md`. The earlier `01-01` through `01-09` threat models supply
control detail, but the nine consolidated threats below are authoritative.
Implementation, tests, CI, package metadata, generated contracts, all Phase-1
summaries, and the final clean code review were checked. No new threat scan was
performed and no implementation file was modified.

No `## Threat Flags` entries were present in the Phase-1 summaries, so there
are no unregistered flags.

## Trust Boundaries

| Boundary                                      | Description                                                                                                                          | Data Crossing                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Manifest file → baseline parsers              | Repository-controlled JSON is untrusted until its closed schema and full pinned identity are validated.                              | Public repository URL, package/version, tag, full SHA, schema, status, date |
| Caller path → Git checkout                    | A local path can identify the wrong repository, a dirty tree, a branch, moved tag, or shallow checkout.                              | Filesystem path and Git metadata                                            |
| Verified checkout → Python import             | Pinned upstream code becomes executable only after identity, cleanliness, package, version, and output-root checks succeed.          | Audited Python source                                                       |
| Python values → contract JSON                 | Cross-language conversion can lose exceptional numbers, set membership, integer identity, errors, and ordering.                      | Synthetic semantic values and validation outcomes                           |
| Generator → repository artifacts              | Generated facts and documentation must not escape fixed paths, drift silently, or leave a partial transaction.                       | Eight allowlisted fixture/document files                                    |
| Mapping/evidence → public package             | A status or export must not claim completion without bounded executable evidence.                                                    | Public symbol metadata, test paths, ESM/CJS/declarations                    |
| Caller values → codecs/register objects       | Coercion, mutation, or normalization can change protocol words, sentinels, datatypes, sizes, and addresses.                          | Numeric values, words, register metadata, builder configuration             |
| Repository → GitHub Actions/package ecosystem | CI and packaging must preserve local controls without write permissions, unpinned actions, secret/device inputs, or tooling leakage. | Source, npm lock data, isolated Python dependency, build artifacts          |

---

## Threat Register

| Threat ID | Category               | Component                                                         | Disposition | Mitigation                                                                                                                                                                                                                                                     | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------- | ---------------------- | ----------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-1-01    | Spoofing               | Upstream/CI identity                                              | mitigate    | Admit only the allowlisted repository, exact package/version/tag/full SHA/schema, clean detached HEAD, and exact tag target before import; CI delegates to the same gate.                                                                                      | closed | `UPSTREAM-PARITY.json:2-9`; `src/internal/parity-metadata.ts:40-162`; `scripts/check-upstream-version.mjs:205-309`; `scripts/check-parity.mjs:255-285,619-640`; `.github/workflows/ci.yml:45-72`; rejection/success evidence in `test/parity/baseline.test.ts:47-170,211-371` and `test/parity/phase-gate.test.ts:155-227,440-461`. Key commits: `1822383`, `3a44fdb`, `8bad985`, `b023ad1`.                                                                                                                                                                                                                        |
| T-1-02    | Tampering              | Code, contracts, mapping, docs, exports                           | mitigate    | Generate from the verified source into fixed allowlists, compare check-mode bytes without mutation, replace transactionally with rollback, validate bounded evidence paths, generate docs from machine authorities, and require exact mapping/export closure.  | closed | `scripts/generate-python-contract.py:1125-1156,1159-1258`; `scripts/check-parity.mjs:467-617`; `scripts/evidence-path.mjs:15-83`; `scripts/generate-api-parity.mjs`; `test/parity/generator.test.ts:324-591`; `test/parity/api-parity.test.ts:219-314,404-443,446-664`; `test/parity/phase-gate.test.ts:229-260,307-423`. Generated artifact diff was clean. Key commits: `aaafe09`, `371add6`, `7b1d688`, `0588b11`, `6bd333b`, `36e2ebc`.                                                                                                                                                                         |
| T-1-03    | Repudiation            | Parity and hardware claims                                        | mitigate    | Embed the full provenance tuple in fixtures and generated docs, print the verified tuple, keep lifecycle status machine-readable, and explicitly state private/incomplete/no-Node-hardware scope.                                                              | closed | `scripts/generate-python-contract.py:325-340`; `scripts/check-upstream-version.mjs:306-309`; `docs/API-PARITY.md:1-17`; `docs/BASELINE.md:1-16`; `README.md:11-34,71-83,101-119`; `CHANGELOG.md:6-46`; executable claim checks in `test/parity/api-parity.test.ts:579-635` and `test/parity/phase-gate.test.ts:469-518`. Final documentation correction and clean review: commits `025e86d`, `c7690dc`.                                                                                                                                                                                                             |
| T-1-04    | Information disclosure | CI, docs, fixtures, diagnostics                                   | mitigate    | Use synthetic/public facts only, omit device credentials/captures, run CI without secrets/environments/device inputs, sanitize the Python child environment, and bound emitted diagnostics.                                                                    | closed | `contracts/normalization.md:112-122`; `scripts/check-parity.mjs:60-131,133-150`; `scripts/generate-python-contract.py:54-76,105-188`; `README.md:85-104`; `.github/workflows/ci.yml`; absence of secret/device inputs is enforced by `test/parity/phase-gate.test.ts:262-304,463-466` and fixture content by `test/parity/generator.test.ts:516-527`. Repository scan found no credential, PIN, private-IP, device-identifier, private-key, or raw-capture value in the audited Phase-1 artifacts. Key commits: `b7cce14`, `3e96e69`, `b023ad1`.                                                                    |
| T-1-05    | Denial of service      | CI, contracts, builders, processes                                | mitigate    | Bound manifest/artifact/diagnostic sizes, parser depth/nodes/collections/strings, scenario counts/names/clocks, builder ranges, child-process duration, CI duration, and temporary-state lifetime.                                                             | closed | `scripts/check-upstream-version.mjs:23-26,159-177,286-303`; `scripts/check-parity.mjs:60-65,133-168,448-465,535-553`; `src/contracts/tagged-values.ts:18-24,83-143,279-385`; `src/contracts/scenario.ts:20-24,267-286,316-375`; `src/registers/registry.ts:129-173`; `.github/workflows/ci.yml:18-27,45-48`; boundary tests in `test/parity/scenario-schema.test.ts:281-368,675-704`, `test/registers/builders.test.ts:336-501`, and cleanup/drift tests in `test/parity/phase-gate.test.ts:229-260`. Key commits: `9048822`, `0087e3a`, `11a7845`, `8bad985`.                                                      |
| T-1-06    | Elevation of privilege | Actions, processes, evidence paths, package                       | mitigate    | Use read-only CI permissions and full-SHA actions, literal fixed process argument arrays with no shell, isolated Python, canonical non-symlink evidence paths, fixed output allowlists, and a private dist-only package.                                       | closed | `.github/workflows/ci.yml:10-15,29-72`; `scripts/check-upstream-version.mjs:159-167`; `scripts/check-parity.mjs:133-168,317-445`; `scripts/evidence-path.mjs:15-83`; `package.json:7,35-45,66-90`; `scripts/check-package.mjs:27-53`; enforcement in `test/parity/baseline.test.ts:329-339`, `test/parity/api-parity.test.ts:446-497,656-664`, and `test/parity/phase-gate.test.ts:290-304,381-466,520-566`. Key commits: `8bad985`, `3e96e69`, `0588b11`, `b023ad1`, `c3e350b`.                                                                                                                                    |
| T-1-07    | Tampering              | Exceptional values, ordering, integer/error domains, codec states | mitigate    | Use one closed tagged-number envelope, safe-integer source boundaries, structural language-neutral set ordering, lossless source-set snapshots, stable error codes, datatype-specific codec domains, and separate primitive/register non-finite behavior.      | closed | `contracts/normalization.md:19-110`; `scripts/generate-python-contract.py:51-188`; `src/contracts/tagged-values.ts:18-26,70-76,145-249,251-450`; `src/codec.ts:4-32,174-227,233-373`; golden and mutation evidence in `test/parity/generator.test.ts:250-322,405-434`, `test/parity/scenario-schema.test.ts:63-279,371-408,410-723`, `test/codec.test.ts:151-235,276-420`, and `test/parity/codec-contract.test.ts:129-182`. Review remediations are commits `ec8da2d` and `720d65c`; codec commits `3eed262`, `8a97e8d`.                                                                                           |
| T-1-08    | Tampering              | Register protocol identity                                        | mitigate    | Build every definition through the exact immutable factory, retain datatype-derived size, compare all 26 fields across three complete maps, preserve provenance/sentinels, index exact starts, and positively require the official overlap set.                | closed | `src/types.ts:1-38`; `src/registers/definitions.ts:178-286`; `src/registers/heating-circuits.ts:34-180`; `src/registers/registry.ts:57-84,175-244`; `src/registers/serialize.ts:36-84`; `test/parity/register-schema.test.ts:48-147`; `test/registers/builders.test.ts:314-334,554-565,568-645`; `test/registers/register-def.test.ts:335-354`. The audited map retains exactly `1392/FLOAT/size=2` and `1393/UCHAR/size=1`, plus overlaps at `1393`, `1442`, and `1484`; repository scan found no global no-overlap invariant and no Navigator-1.x register address. Key commits: `6c5e4dd`, `2a2da62`, `11a7845`. |
| T-1-SC    | Tampering              | npm, pip, and GitHub Action supply chain                          | mitigate    | Install npm dependencies only through the integrity-bearing lockfile, keep zero runtime dependencies, isolate and exact-pin the sole Python reference dependency without dependency expansion, verify its runtime version, and pin every Action to a full SHA. | closed | `package.json:35-48,66-90`; `package-lock.json:1-29` and integrity-bearing locked package entries; `.github/workflows/ci.yml:29-40,50-69`; `scripts/check-parity.mjs:400-445`; package/dependency and action-pin contracts in `test/parity/phase-gate.test.ts:381-466`. `npm ci` is the only CI npm install path; `pymodbus==3.12.1` is installed with `--isolated --no-deps --only-binary=:all:` and verified before generator use. Key commits: `9de69d0`, `8bad985`, `b023ad1`.                                                                                                                                  |

_Status: open · closed_  
_Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)_

---

## Protocol-Invariant Verification

- The official occupied-range overlap set is exactly:
  - `1393`: `humidity_sensor` (`1392`, `FLOAT`, size `2`) with `hc_a_mode`
    (`1393`, `UCHAR`, size `1`);
  - `1442`: `hc_g_heating_curve` with `hc_a_heating_limit`;
  - `1484`: `hc_g_room_setpoint_cool_eco` with `hc_a_cooling_limit`.
- `test/parity/register-schema.test.ts:99-131` positively requires all three
  overlaps and their exact datatype/size identities.
- `RegisterRegistry` rejects only duplicate exact
  `(register_type, start_address)` identities and permits occupied-range
  overlaps (`src/registers/registry.ts:57-84`).
- No no-overlap invariant exists in the implementation or tests.
- Navigator 1.0/1.7 remains explicitly unsupported and no Navigator-1.x
  register address is present in the Phase-1 register schema.

---

## Verification Run

On 2026-07-16 the focused audit regression command completed successfully:

```text
Test Files  8 passed (8)
Tests       129 passed | 71 skipped (200)
Duration    140.25s
```

The selected tests covered baseline/checkout identity, exceptional values and
scenario bounds, codecs, complete register-schema parity and overlaps,
registry/mutation safety, shell-free orchestration, private packaging,
GitHub Actions, README/CHANGELOG claims, and the complete static Phase-1 gate.
Generated contracts, API/baseline documents, and fixtures had no diff after
the audit.

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By               |
| ---------- | ------------: | -----: | ---: | -------------------- |
| 2026-07-16 |             9 |      9 |    0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-16
