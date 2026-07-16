# IDM Heatpump Node

Ein in Entwicklung befindlicher TypeScript-Port von
[Xerolux/idm-heatpump-api](https://github.com/Xerolux/idm-heatpump-api). Der
vorgesehene Paketname ist:

```text
@xerolux/idm-heatpump
```

## Status

**Phase 2 ist implementiert und maschinengeprüft. Der Modbus-Lesepfad mit
Erkennung und Resilienz ist nutzbar; das Gesamtprojekt ist noch nicht fertig
und nicht auf npm veröffentlicht.**

`package.json` bleibt absichtlich auf `private: true`. Sichere Writes, das
optionale Web-Supplement, die Veröffentlichung und die vollständige
Gesamtparität folgen in den Phasen 3 bis 5. Bis dahin darf dieses Repository
nicht als vollständiger, funktionsgleicher Gesamtport veröffentlicht werden.

Die exakt geprüfte Python-Baseline ist:

- Paketversion: `0.7.6`
- Git-Tag: `v0.7.6`
- vollständiger Commit: `ad121ebf34a5f5e37204371c026927d77efcd15c`

`UPSTREAM-PARITY.json` behält deshalb den Gesamtstatus `planned`. Keine
Node-Hardwarevalidierung durchgeführt.

## In Phase 2 nachgewiesen

Der Paket-Root stellt den vollständigen Semantik-Kern aus Phase 1 sowie den
evidenzbasierten Lesepfad aus Phase 2 bereit:

- `IdmModbusClient` mit geschlossenem Konstruktor
  `new IdmModbusClient(host, options?)`;
- die öffentliche, adapterneutrale TypeScript-Schnittstelle
  `ModbusTransport`; der konkrete `modbus-serial`-Adapter bleibt intern;
- Connect, Disconnect, Force-Reconnect und vollständige FIFO-Serialisierung;
- exakte FC03- und FC04-Einzelrequests;
- Batching ausschließlich für exakt angrenzende, nicht überlappende Register
  desselben Typs und innerhalb der maximalen Gruppengröße;
- getrennte Requests für offizielle logische Überlappungen, insbesondere
  `humidity_sensor` mit `1392/count=2` und `hc_a_mode` mit `1393/count=1`;
- geordnetes Einzelregister-Fallback, Unsupported-Erkennung nur für
  numerischen Modbus-Code 2, permanente Fehlerverfolgung und
  Batch-unsafe-Quarantäne;
- Retry mit Backoff, Reconnect und geschlossene Fehlernormalisierung;
- Erkennung von Navigator 2.0, Navigator Pro und Navigator 10 samt Firmware,
  Heizkreisen, Zonenmodulen, Solar, ISC, PV, Kaskade, Sentinels und
  modellabhängiger Registerkarte;
- unveränderliche Diagnostik für Verbindungs-, Fehler-, Unsupported-,
  Permanent- und Quarantänezustand;
- sieben exakt gepinnte Golden Fixtures und zwei generierte Dokumente als
  neun transaktional geprüfte Paritätsartefakte.

Die Paritätsmatrix enthält weiterhin exakt 89 öffentliche Python-Symbole. 57
Zuordnungen sind `complete`; `IdmModbusClient` bleibt während der privaten
Entwicklung bewusst `partial`: 22 Lesepfad-Mitglieder sind implementiert und
die sieben Write-Mitglieder aus Phase 3 sind nicht als Stubs exportiert.
`ModbusTransport` ist separat als vollständige additive TypeScript-Erweiterung
dokumentiert.

Die exakte Zuordnung, Repräsentation und Testevidenz steht in
[docs/API-PARITY.md](docs/API-PARITY.md). Der Exportpfad
`@xerolux/idm-heatpump/web` bleibt bis Phase 4 absichtlich leer.

## Verwendung des Lesepfads

```ts
import { IdmModbusClient, getRegister } from "@xerolux/idm-heatpump";

const client = new IdmModbusClient("heatpump.example.invalid", {
  port: 502,
  slaveId: 1,
  timeout: 10,
  maxRetries: 3,
  maxGroupSize: 40,
});

await client.connect();
try {
  const model = await client.detectModel();
  const outdoorTemperature = await client.readRegister(getRegister("outdoor_temp"));
  console.log(model.modelName, outdoorTemperature);
} finally {
  await client.disconnect();
}
```

Der Beispielhost ist absichtlich synthetisch. Für einen echten Aufruf muss er
durch den lokalen Host der eigenen Anlage ersetzt werden.

## Netzwerk- und Protokollgrenze

Die Modbus-TCP-Verbindung bietet keine integrierte TLS-Verschlüsselung und
keine Modbus-Authentifizierung. Verwende sie nur in einem vertrauenswürdigen
lokalen Netzwerk und trenne das Gerät durch geeignete Netzwerkregeln von nicht
vertrauenswürdigen Netzen.

Navigator 1.0/1.7 ist eine andere, nicht unterstützte und ausdrücklich
ausgeschlossene Protokollfamilie. Dieses Paket übernimmt keine Adressen dieser
Familie in die Navigator-2.0/Pro/10-Registerkarte.

## Noch ausstehend

- **Phase 3 – sichere Writes:** Dry-run, Write-Validierung,
  EEPROM-Drosselung, Cyclic-Heartbeats und Write-Fehlerpfade.
- **Phase 4 – optionales read-only Web-Supplement:** Navigator-10-WebSocket
  und Navigator-2.0-HTTP.
- **Phase 5 – Veröffentlichung und Gesamtparität:** vollständige
  Cross-Repository-Matrix, Upstream-Freshness, dokumentierte
  Hardwarevalidierung und alle npm-Release-Gates.

## Entwicklung und Paritätsprüfung

Voraussetzungen sind Node.js 22 oder neuer, Git und Python 3.12. Die
Paritätskommandos provisionieren die exakt gepinnte Python-Referenz selbst und
benötigen keine Geräteadresse, Zugangsdaten oder PIN.

```bash
npm ci
npm run check
npm run parity:check
npm audit --omit=dev
```

`npm run check` führt Formatprüfung, ESLint, strikten Typecheck, Tests mit
mindestens 80 Prozent Branch Coverage, ESM-/CommonJS-/Declaration-Build und
einen Installations-/Importtest des kontrollierten npm-Tarballs aus. Der
Tarball-Smoke importiert und instanziiert den öffentlichen Lesepfad, ohne eine
Verbindung zu öffnen.

`npm run parity:check` ist nicht mutierend: Es klont die vollständige
Tag-Historie, verifiziert Version, Tag und vollständigen SHA vor jedem
Python-Import, erzeugt die Referenzartefakte isoliert und schlägt bei jeder
Abweichung hart fehl.

Nur wenn die gepinnten Golden Fixtures bewusst aktualisiert werden sollen,
wird der transaktionale Schreibpfad verwendet:

```bash
npm run parity:generate
```

Der vollständige lokale Abschluss-Gate lautet:

```bash
npm run check
npm run parity:check
npm audit --omit=dev
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
- Modbus TCP für Navigator 2.0, Navigator Pro und Navigator 10
- keine Telemetrie

## Unofficial project

Dieses Projekt ist eine inoffizielle Open-Source-Integration und steht in
keiner Verbindung zu IDM Energiesysteme GmbH.
