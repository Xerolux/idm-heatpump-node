# Changelog

Alle wesentlichen Änderungen an diesem Projekt werden in dieser Datei
dokumentiert.

## [Unreleased]

### Added

- Reproduzierbarer Phase-1-Vertrag gegen idm-heatpump-api 0.7.6, Tag
  v0.7.6, vollständiger Commit
  ad121ebf34a5f5e37204371c026927d77efcd15c.
- Strikte Baseline-Prüfung vor jedem Import aus der Python-Referenz sowie sechs
  deterministische Golden-Contract-Familien für öffentliche API und Klassen,
  Codec-Vektoren, Registerschemas, semantische Szenarien und den späteren
  Web-Vertrag.
- 53 vollständige API-Zuordnungen: unveränderliche Konstanten und Typen,
  Klassen-/Factory-Verträge, zeitabhängige Helfer, ModbusCodec,
  Registerdefinitionen, Register-Builder und RegisterRegistry.
- Exakte Registerkarten für die gepinnten Navigator-2.0/Pro/10-Kombinationen,
  einschließlich offizieller logischer Überschneidungen, Modell-Metadaten,
  Sentinels und einer getrennten vollständigen Contract-Serialisierung.
- Verlustfreie Contract-Darstellung für NaN, beide Unendlichkeiten und
  negatives Null sowie bitgenaue Low-Word-first-Float32- und
  Python-Rundungsparität.
- ESM-, CommonJS- und Declaration-Builds aus einer TypeScript-Implementierung,
  mindestens 80 Prozent Branch Coverage und ein kontrollierter
  Tarball-Installations-/Importtest.
- Read-only CI für Node.js 22 und 24 sowie ein separater, vollständig
  SHA-gepinnter Python-3.12-Job, der ausschließlich npm run parity:check
  verwendet.

### Not yet implemented

- Phase 2: Modbus-Transport, Batching, Erkennung, Resilienz und Diagnostik.
- Phase 3: sichere Writes, Dry-run, EEPROM-Drosselung und
  Cyclic-Heartbeats.
- Phase 4: optionales read-only Web-Supplement.
- Phase 5: vollständige Paritäts- und Release-Sicherung einschließlich
  Upstream-Freshness und Hardwarevalidierungsnachweis.

### Release status

- Das Paket bleibt mit private: true unveröffentlicht. Phase 1 ist kein
  funktionsgleicher Gesamtport und nicht releasebereit.
- No Node hardware validation performed.
