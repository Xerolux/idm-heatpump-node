# IDM Heatpump Node

Ein in Entwicklung befindlicher TypeScript-Port von
[Xerolux/idm-heatpump-api](https://github.com/Xerolux/idm-heatpump-api). Der
vorgesehene Paketname ist:

```text
@xerolux/idm-heatpump
```

## Status

**Der vollständige öffentliche Funktionsumfang der aktuell neuesten stabilen
Python-Referenz ist implementiert und maschinengeprüft: Modbus Read/Write,
Erkennung, Fehlerverhalten und das optionale read-only Web-Supplement.**

`package.json` bleibt absichtlich auf `private: true`. Das optionale
Paket wird mit diesem Git-Push noch nicht auf npm veröffentlicht. Vor einer
späteren npm-Veröffentlichung muss dieselbe Freshness- und Paritätsprüfung
erneut erfolgreich laufen.

Die exakt geprüfte Python-Baseline ist:

- Paketversion: `0.8.0`
- Git-Tag: `v0.8.0`
- vollständiger Commit: `a5d44ed06e5bd317946ca41720f37151631bc9c6`

`UPSTREAM-PARITY.json` steht auf `complete`. Keine Node-Hardwarevalidierung
durchgeführt; sämtliche Prüfungen verwenden reproduzierbare Fake-Transporte,
Fake-Zeit und Antworten der Python-Referenz.

## Nachgewiesener Funktionsumfang

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
- Planung, Simulation und Dry-run ohne Netzwerkverkehr;
- validierte ein- und zwei-Wort-Writes ausschließlich als FC16-Request;
- Typ-, Bereichs-, Enum-, Ausschlusswert- und Modell-Validierung; die
  `allowCustomRegister`-Option umgeht nur die Name-/Adress-Mitgliedschaft eines
  erkannten Modells, niemals die übrigen Schutzprüfungen;
- eine EEPROM-Schreibsperre von 60 Sekunden und Cyclic-Heartbeats mit einer
  Standard-TTL von 300 Sekunden, geprüft mit kontrollierter Uhr (Fake Clock);
- Write-Retry und Reconnect mit konservativer at-least-once-Semantik sowie
  erfolgreicher Zustandsänderung erst nach bestätigtem Transporterfolg;
- acht exakt gepinnte Golden Fixtures und zwei generierte Dokumente als zehn
  transaktional geprüfte Paritätsartefakte.
- read-only Navigator-10-WebSocket und Navigator-2.0-HTTP mit PIN-Prüfung,
  Login/CSRF, Cache, Notifications, Statistics, Capabilities, Diagnostik und
  geschlossener Fehlerhierarchie über den separaten Export `./web`;
- vollständige Erkennung nicht zusammenhängender Heizkreise A–G über
  Durchfluss- und Active-Mode-Signale entsprechend Python `0.8.0`.

Die Paritätsmatrix enthält exakt 89 öffentliche Python-Symbole. Alle 89
Zuordnungen sind `complete` (59 Paket-Root, 30 Web);
`IdmModbusClient` ist mit allen 29 öffentlichen Mitgliedern vollständig
abgebildet.
`ModbusTransport` ist separat als vollständige additive TypeScript-Erweiterung
dokumentiert.

Die exakte Zuordnung, Repräsentation und Testevidenz steht in
[docs/API-PARITY.md](docs/API-PARITY.md). Der Exportpfad
`@xerolux/idm-heatpump/web` enthält ausschließlich optionale read-only
Web-Funktionen. Fehlende oder leere PINs liefern über die Factory-Funktionen
`null` und erhalten damit den Modbus-only-Betrieb.

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

## Writes planen und ausführen

Vor einem echten Write lässt sich derselbe Wert planen, simulieren und
asynchron als Dry-run prüfen. Das öffnet keine Verbindung und sendet keinen
Modbus-Request:

```ts
import { IdmModbusClient } from "@xerolux/idm-heatpump";

const client = new IdmModbusClient("heatpump.example.invalid");

const plan = client.simulateWrite("system_mode", 2);
const dryRun = await client.setValue("system_mode", 2, { dryRun: true });

console.log(plan.encodedRegisters, dryRun.dryRun);
```

Ein echter Aufruf von `setValue()` oder `writeRegister()` muss erst nach
bewusster Prüfung des Plans und einer hergestellten Verbindung erfolgen. Jeder
akzeptierte ein- und zwei-Wort-Write wird mit FC16 gesendet. Ungültige Typen,
Bereiche, Enum-Werte, ausgeschlossene Werte, schreibgeschützte Register und
Modellabweichungen werden vor Netzwerkverkehr abgewiesen.

Writes sind nicht exakt-einmalig: Bei einem Antwortverlust nach der
Geräteübernahme kann ein begrenzter Retry denselben FC16-Request erneut senden. Das
ist eine konservative at-least-once-Garantie; nach einem Antwortverlust muss der
Gerätezustand gelesen und geprüft werden. Ein fehlgeschlagener Write wird nie
als erfolgreicher EEPROM- oder Cyclic-Zustandswechsel gespeichert.

## Netzwerk- und Protokollgrenze

Die Modbus-TCP-Verbindung bietet keine integrierte TLS-Verschlüsselung und
keine Modbus-Authentifizierung. Verwende sie nur in einem vertrauenswürdigen
lokalen Netzwerk und trenne das Gerät durch geeignete Netzwerkregeln von nicht
vertrauenswürdigen Netzen.

Navigator 1.0/1.7 ist eine andere, nicht unterstützte und ausdrücklich
ausgeschlossene Protokollfamilie. Dieses Paket übernimmt keine Adressen dieser
Familie in die Navigator-2.0/Pro/10-Registerkarte.

## Optionales read-only Web-Supplement

```ts
import { createOptionalNavigator10WebClient } from "@xerolux/idm-heatpump/web";

const web = createOptionalNavigator10WebClient("heatpump.example.invalid", process.env.IDM_PIN);
if (web !== null) {
  await web.connect();
  try {
    const data = await web.readData();
    console.log(data.simpleValues);
  } finally {
    await web.close();
  }
}
```

Das Web-Supplement bietet bewusst keinen Write-Pfad, keine Browser-Zusage und
keine Telemetrie.

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
Tarball-Smoke prüft den öffentlichen Lese- und Dry-run-Write-Pfad, ohne eine
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
