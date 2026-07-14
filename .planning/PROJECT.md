# IDM Heatpump Node

## What This Is

IDM Heatpump Node is a standalone TypeScript package for Node.js 22 and newer that provides the public Modbus and optional read-only web capabilities of `Xerolux/idm-heatpump-api`. It gives Node.js consumers an idiomatic API while preserving the pinned Python release's register map, codecs, transport behavior, detection, diagnostics, write safety, and web semantics.

## Core Value

Complete semantic and behavioral parity with the latest stable pinned `Xerolux/idm-heatpump-api` release, proven by cross-repository contracts and all release gates.

## Requirements

### Validated

- ✓ Package foundation: metadata, lockfile, strict TypeScript, reproducible ESM and CommonJS builds, declarations, source maps, linting, formatting, Vitest, and coverage are implemented locally — pre-roadmap foundation, 2026-07-14
- ✓ Distribution foundation: explicit exports, controlled tarball contents, tarball installation smoke tests, and CI on Node.js 22 and 24 are implemented locally — pre-roadmap foundation, 2026-07-14
- ✓ Publication guard: the package remains `private: true` while parity is incomplete — pre-roadmap foundation, 2026-07-14

### Active

- [ ] Establish a reproducible cross-repository parity harness and port the complete public API, types, codecs, and register schemas.
- [ ] Match Python Modbus read, batching, detection, recovery, error, state, and diagnostic behavior exactly.
- [ ] Match Python write planning, validation, request generation, EEPROM throttling, and cyclic TTL behavior safely.
- [ ] Provide the optional read-only Navigator 10 WebSocket and Navigator 2.0 HTTP supplement through the dedicated web export.
- [ ] Close every parity dimension and satisfy all local, cross-repository, packaging, documentation, automation, and release gates for `0.1.0`.

### Out of Scope

- Partial npm publication — known functional differences are forbidden; `private: true` remains until complete parity.
- Python as a runtime dependency — Python is permitted only as the development and CI reference implementation.
- Navigator 1.0/1.7 — it is a distinct, currently unsupported protocol family whose addresses must not enter the Navigator 2.0/10/Pro map.
- Browser support — the target is a standalone Node.js package.
- Telemetry — the package must not collect or transmit usage data.
- Independent register-map corrections — corrections originate in the Python reference with source or hardware evidence before being ported.
- Unapproved live hardware writes — tests use controlled transports and clocks unless the user explicitly authorizes hardware interaction.

## Context

- The functional reference and single source of truth is `Xerolux/idm-heatpump-api`.
- `UPSTREAM-PARITY.json` currently pins Python package `idm-heatpump-api` `0.7.6`, tag `v0.7.6`, commit `ad121ebf34a5f5e37204371c026927d77efcd15c`, parity schema version 1.
- The intended npm identity is `@xerolux/idm-heatpump`, with optional web capabilities exposed from `@xerolux/idm-heatpump/web`.
- Package/tooling/strict TypeScript/ESM+CJS build/Vitest/coverage/tarball smoke/Node 22+24 CI already exist locally. The roadmap begins with remaining parity work rather than recreating that foundation.
- Ingest classified `docs/IMPLEMENTATION-PLAN.md` and `docs/PARITY-CONTRACT.md` as specifications and preserved 27 binding constraints with no conflicts.

## Constraints

- **Parity authority**: The exact stable Python tag and full commit SHA define behavior — branches and inferred behavior are not reproducible references.
- **Protocol fidelity**: Official addresses, datatypes, sizes, function codes, overlaps, sentinels, and model gates are preserved exactly — map tidiness cannot override protocol evidence.
- **Float representation**: IDM `FLOAT` is IEEE-754 Float32 transferred low word first — codec and request words must match Python.
- **Batching**: Only exactly adjacent, non-overlapping ranges of the same register type may be combined — gaps and official logical overlaps require separate requests.
- **Write safety**: Dry-run, validation, EEPROM throttling, cyclic TTL, excluded values, and failure-state rules are mandatory — writes affect real equipment.
- **Runtime**: Strict TypeScript on Node.js 22 or newer, CI on 22 and 24, ESM primary, optional CommonJS from the same source — one implementation must support the declared package contract.
- **Isolation**: Domain logic depends on `ModbusTransport`, not a concrete Modbus package; deterministic tests use fake transport and fake clock — behavior must be reproducible.
- **Release**: npm publication is all-or-nothing against the latest stable Python release — any stale baseline, incomplete API entry, contract difference, or failed gate blocks release.
- **Security**: PINs, credentials, private IPs, and device identifiers must not appear in logs, fixtures, or documentation — parity evidence must not leak sensitive device data.

## Key Decisions

| Decision                                                                 | Rationale                                                                                   | Outcome   |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | --------- |
| Treat the pinned Python release as the semantic and behavioral authority | Prevents undocumented Node-specific drift                                                   | — Pending |
| Keep `private: true` until all parity and release gates pass             | Partial publication is explicitly forbidden                                                 | — Pending |
| Treat the existing package/tooling as delivered foundation               | Remaining work should focus on functional parity, while final release re-verifies packaging | ✓ Good    |
| Use one strict TypeScript source for ESM and CommonJS outputs            | Avoids behavior divergence between module formats                                           | — Pending |
| Keep concrete Modbus access behind `ModbusTransport`                     | Isolates domain behavior and enables deterministic contract tests                           | — Pending |
| Keep the web supplement optional and read-only                           | Modbus remains the baseline path and write safety stays centralized                         | — Pending |
| Release first as `0.1.0` only at full scope                              | Version signals TypeScript API maturity, not reduced parity                                 | — Pending |

---

_Last updated: 2026-07-14 after project initialization from ingested specifications_
