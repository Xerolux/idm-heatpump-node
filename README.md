# IDM Heatpump Node

Ein in Entwicklung befindlicher TypeScript-Port von
[Xerolux/idm-heatpump-api](https://github.com/Xerolux/idm-heatpump-api).
Der vorgesehene Paketname ist:

```text
@xerolux/idm-heatpump
```

## Status

**Phase 1, der reproduzierbare Semantik-Vertrag, ist implementiert und
maschinengeprüft. Das Gesamtprojekt ist nicht fertig und nicht auf npm
veröffentlicht.**

Der aktuelle Stand ist nicht auf npm veröffentlicht.

Das Repository enthält derzeit den nutzbaren semantischen Kern, aber noch
keinen Modbus-Transport und damit noch keinen einsatzfähigen
Wärmepumpen-Client. package.json bleibt absichtlich auf private: true.
Eine Veröffentlichung ist erst nach vollständiger Funktionsparität und allen
Release-Gates der Phasen 2 bis 5 zulässig.

Die exakt geprüfte Python-Baseline ist:

- Paketversion: 0.7.6
- Git-Tag: v0.7.6
- vollständiger Commit:
  ad121ebf34a5f5e37204371c026927d77efcd15c

UPSTREAM-PARITY.json behält den Gesamtstatus planned, weil die späteren
Laufzeitphasen noch fehlen. Auf Node-Seite wurde keine Live-Hardwarevalidierung
durchgeführt.

## In Phase 1 nachgewiesen

Die Paritätsmatrix enthält 89 öffentliche Python-Symbole. Davon sind 53
Phase-1-Zuordnungen vollständig implementiert und durch fokussierte
Contract-Tests belegt: 53 Runtime-Exporte einschließlich der unveränderlichen
`RegisterDef.create(...)`-Factory mit zugehörigen TypeScript-Typen.

Der aktuelle Paket-Root stellt bereit:

- unveränderliche Konstanten, Optionslisten und Domänentypen;
- FeatureFlags, IdmModelInfo, AdaptiveBackoff und PollRateLimiter;
- ModbusCodec mit bitgenauem Low-Word-first-Float32-, Integer- und
  Rundungsverhalten;
- die vollständigen Registerdefinitionen, Builder und RegisterRegistry für
  die in der Baseline unterstützten Navigator-2.0/Pro/10-Modellkombinationen;
- streng geprüfte, sprachneutrale Contract-Szenarien und Golden Fixtures.

Die exakte Zuordnung, Darstellung und Testevidenz steht in
[docs/API-PARITY.md](docs/API-PARITY.md). Interne Codec- und
Serialisierungshelfer werden nicht als zusätzliche öffentliche API exportiert.
Der Exportpfad @xerolux/idm-heatpump/web ist absichtlich leer.

Ein Beispiel für den heute nutzbaren Semantik-Kern:

```ts
import { ModbusCodec, buildRegisterMap, getRegister } from "@xerolux/idm-heatpump";

const words = ModbusCodec.encodeFloat32(21.5);
const value = ModbusCodec.decodeFloat32(words);
const registers = buildRegisterMap();
const outdoorTemperature = getRegister("outdoor_temperature");
```

Dieses Beispiel führt keinen Netzwerkzugriff und keinen Geräte-Write aus.

## Noch geplant

- **Phase 2 – Transport und Erkennung:** Modbus TCP, exakte Request-Shapes,
  Batching, Modell-/Feature-Erkennung, Retry, Reconnect und Diagnostik.
- **Phase 3 – sichere Writes:** Dry-run, Write-Validierung,
  EEPROM-Drosselung und Cyclic-Heartbeats.
- **Phase 4 – optionales Web-Supplement:** read-only Navigator-10-WebSocket
  und Navigator-2.0-HTTP.
- **Phase 5 – Release-Sicherung:** vollständige Cross-Repository-Parität,
  Upstream-Freshness, Hardwarevalidierungsnachweis und Veröffentlichung.

Bis diese Arbeit abgeschlossen ist, darf das Repository weder als
vollständiger Client noch als funktionsgleicher Gesamtport bezeichnet werden.

## Entwicklung und Paritätsprüfung

Voraussetzungen sind Node.js 22 oder neuer, Git und Python 3.12. Die
Paritätskommandos provisionieren die exakt gepinnte Python-Referenz selbst und
benötigen keine Geräteadresse, Zugangsdaten oder PIN.

```bash
npm ci
npm run check
npm run parity:check
```

npm run check führt Formatprüfung, ESLint, strikten Typecheck, Tests mit
mindestens 80 Prozent Branch Coverage, ESM-/CommonJS-/Declaration-Build und
einen Installations-/Importtest des kontrollierten npm-Tarballs aus.

npm run parity:check ist nicht mutierend: Es klont vollständige Tag-Historie,
verifiziert Version, Tag und vollständigen SHA vor jedem Python-Import,
erzeugt die Referenzartefakte isoliert und schlägt bei jeder Abweichung hart
fehl.

Nur wenn die gepinnten Golden Fixtures bewusst aktualisiert werden sollen,
wird der transaktionale Schreibpfad verwendet:

```bash
npm run parity:generate
```

Der vollständige lokale Abschluss-Gate lautet:

```bash
npm run check
npm run parity:check
git diff --exit-code -- contracts docs/API-PARITY.md docs/BASELINE.md test/fixtures
```

## Verbindliche Dokumente

- [AGENTS.md](AGENTS.md) – Arbeits- und Sicherheitsregeln
- [UPSTREAM-PARITY.json](UPSTREAM-PARITY.json) – exakte Python-Referenz
- [docs/PARITY-CONTRACT.md](docs/PARITY-CONTRACT.md) – Definition von
  Funktionsparität und Release-Gates
- [docs/API-PARITY.md](docs/API-PARITY.md) – generierte Symbolmatrix
- [docs/BASELINE.md](docs/BASELINE.md) – generierter Baseline-Nachweis
- [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md) –
  Portierungsreihenfolge und Abnahmekriterien

## Zielplattform

- Node.js 22 oder neuer
- TypeScript im Strict Mode
- Node.js-Laufzeit; keine Browser-Kompatibilitätszusage
- später Modbus TCP für Navigator 2.0, Navigator Pro und Navigator 10

Navigator 1.0/1.7 ist eine andere, nicht unterstützte Protokollfamilie.

## Unofficial project

Dieses Projekt ist eine inoffizielle Open-Source-Integration und steht in
keiner Verbindung zu IDM Energiesysteme GmbH.
