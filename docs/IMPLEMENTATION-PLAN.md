# Implementierungsplan

## Zielbild

Das Repository liefert ein eigenständiges TypeScript-Paket für Node.js. Es
benötigt zur Laufzeit weder Python noch das Python-Paket. Python wird nur in der
Entwicklungs- und CI-Umgebung als Referenz für Cross-Repository-Contracts
verwendet.

Entwickelt wird schrittweise. Veröffentlicht wird erst nach vollständiger
Parität gemäß `docs/PARITY-CONTRACT.md`.

## Vorgesehene Paketstruktur

```text
src/
  index.ts
  constants.ts
  types.ts
  errors.ts
  codec.ts
  registers/
    core.ts
    heating-circuits.ts
    zone-modules.ts
    registry.ts
    index.ts
  transport/
    transport.ts
    modbus-serial-transport.ts
  client/
    client.ts
    batching.ts
    detection.ts
    write-safety.ts
    diagnostics.ts
  web/
    navigator10.ts
    navigator20.ts
    parsing.ts
    errors.ts
    index.ts
test/
  fixtures/
  parity/
  fake-modbus-transport.ts
scripts/
examples/
docs/
```

## Architekturentscheidungen

- TypeScript Strict Mode.
- Node.js `>=22`; CI auf Node.js 22 und 24.
- ESM ist primär. Eine CommonJS-Ausgabe darf nur aus derselben Quelle gebaut
  und separat getestet werden.
- Die konkrete Modbus-Bibliothek wird hinter `ModbusTransport` gekapselt.
- `modbus-serial` ist der vorgesehene erste Adapter, nicht Teil der
  Fachlogik.
- Fake-Transport und Fake Clock sind zentrale Testbausteine.
- Das Web-Supplement wird als Subpath Export
  `@xerolux/idm-heatpump/web` angeboten.
- Keine Browser-Unterstützung, keine Telemetrie.

## Phase 1 — Tooling und Paketvertrag

- `package.json`, Lockfile und TypeScript-Konfiguration erstellen.
- Build, Typdeklarationen, Source Maps, Linting, Formatierung und Vitest
  einrichten.
- Export Map und Tarball-Inhalt definieren.
- CI für Node.js 22 und 24 erstellen.
- Installation aus `npm pack` testen.

Abnahme:

- leerer Bibliotheks-Build ist reproduzierbar;
- ESM-Import und gegebenenfalls CommonJS-Require funktionieren aus dem
  Tarball;
- keine Entwicklungsdateien gelangen unbeabsichtigt ins Paket.

## Phase 2 — Parity Harness, Typen, Codec und Register

- Python-Contract-Generator implementieren.
- `UPSTREAM-PARITY.json` im CI auswerten und Commit verifizieren.
- öffentliche Python-Exporte inventarisieren.
- TypeScript-Typen und Codec implementieren.
- vollständige Register-Builder portieren.
- Golden Schema für alle relevanten Modellkombinationen erzeugen.

Abnahme:

- `docs/API-PARITY.md` ist vollständig erzeugt oder validiert;
- Codec-Testvektoren stimmen exakt überein;
- Registerschemas stimmen nach Normalisierung exakt überein;
- dokumentierte Überlappungen bleiben erhalten.

## Phase 3 — Transport und Read-Pfad

- `ModbusTransport` und Fake-Transport implementieren.
- Connect, Disconnect, Reconnect, Retry und Backoff portieren.
- einzelne Reads und sichere Batchreads portieren.
- Request-Serialisierung implementieren.
- Illegal Address, permanente Fehler, Fallback und Batch-Unsafe-Quarantäne
  portieren.

Abnahme:

- identische Szenarien erzeugen identische Request-Traces;
- Lücken und Überlappungen werden korrekt getrennt;
- `1392/count=2` und `1393/count=1` sind separate Requests;
- alle Fehler- und Recovery-Contracts bestehen.

## Phase 4 — Modell- und Feature-Erkennung

- Navigator 2.0, Navigator Pro und Navigator 10 portieren.
- Firmware, Heizkreise, Zonenmodule, Solar, ISC, PV und Kaskade portieren.
- Sentinels und unavailable Slots übernehmen.
- Register-Map aus erkanntem Modell bauen.

Abnahme:

- alle Python-Erkennungsszenarien liefern semantisch gleiche Ergebnisse;
- Modell-Gates und Registerschemas stimmen überein;
- Navigator 1.0/1.7 bleibt ausgeschlossen.

## Phase 5 — Write-Sicherheit

- zunächst Write-Plan und Dry-run portieren.
- vollständige Validierung für Typ, Range, Enum, Excludes und Modellzugehörigkeit
  implementieren.
- Custom-Register-Escape-Hatch mit unverändertem verbleibendem Schutz
  implementieren.
- reale Einzel- und Mehrregister-Writes anbinden.
- EEPROM-Throttle und Cyclic-TTL mit Fake Clock portieren.

Abnahme:

- beide Implementierungen akzeptieren und verwerfen dieselben Testwerte;
- erzeugte Registerwörter und Requests stimmen überein;
- Dry-run sendet keinen Request;
- fehlgeschlagene Writes verändern keinen Erfolgszustand.

## Phase 6 — Web-Supplement

- Navigator-10-WebSocket portieren.
- Navigator-2.0-HTTP inklusive Authentifizierung und CSRF portieren.
- Parser, Cache, Notifications, Statistics, Capabilities, Diagnostik und
  Fehlerhierarchie portieren.
- optionale Client-Factories und PIN-Prüfung portieren.

Abnahme:

- alle Python-Web-Fixtures erzeugen gleiche normalisierte Ergebnisse;
- fehlende PIN führt weiterhin zu reinem Modbusbetrieb;
- das Web-Modul bleibt read-only und optional.

## Phase 7 — Vollständige Parität und Release-Vorbereitung

- verbleibende öffentliche Symbole portieren.
- API-Paritätsmatrix schließen.
- Cross-Repository-Testmatrix vollständig ausführen.
- README, Beispiele, API-Dokumentation, Security und Changelog abschließen.
- Upstream-Version-Check, Scheduled Workflow und Repository Dispatch
  einrichten.
- npm Trusted Publishing und Provenance konfigurieren.

Abnahme:

- kein `planned`, `partial` oder unbegründetes `not_applicable` verbleibt;
- mindestens 80 Prozent Branch Coverage;
- alle lokalen und Cross-Repository-Prüfungen sind grün;
- Tarball-Smoke-Test ist grün;
- Release-Gate bestätigt die neueste stabile Python-Baseline.

## Erstes Release

Das erste npm-Release ist `0.1.0`. Die niedrige Versionsnummer beschreibt die
Reife der TypeScript-Oberfläche, nicht einen reduzierten Funktionsumfang.

Das Release-Changelog nennt zwingend:

- npm-Version;
- Python-Version und Tag;
- vollständigen Python-Commit-SHA;
- Ergebnis der Cross-Repository-Parität;
- durchgeführte Hardwarevalidierungen.
