# IDM Heatpump Node

Ein in Entwicklung befindlicher TypeScript-Port von
[Xerolux/idm-heatpump-api](https://github.com/Xerolux/idm-heatpump-api). Der
vorgesehene Paketname ist:

```text
@xerolux/idm-heatpump
```

## Status

**Der vollständige öffentliche Kern-Funktionsumfang der Python-Referenz `2.16.1`
ist implementiert und maschinengeprüft: Modbus Read/Write, Erkennung,
Fehlerverhalten, Fehlercode-Datenbank, Plausibilitätshelfer und die
Navigator-1.7-Registerkarte.** Das optionale Web-Supplement liegt funktional
auf dem Stand der Python-`1.0.3`-Baseline; die Python-2.x-Web-Erweiterung
(52 Symbole) und die Coil-Transport-Erweiterung (FC01/FC05) sind als
`planned` gestaffelt und werden in den Folge-Syncs portiert. Ein
npm-Release ist laut Release-Gate erst nach vollständiger Parität zulässig.

`package.json` bleibt bewusst auf `private: false` gesetzt. Version `2.16.1`
(gespiegelt an der Python-Baseline) wird nach Abschluss der gestaffelten
Bereiche unter `@xerolux/idm-heatpump` veröffentlicht.
Vor jeder späteren Version muss dieselbe Freshness- und Paritätsprüfung erneut
erfolgreich laufen.

Die exakt geprüfte Python-Baseline ist:

- Paketversion: `2.16.1`
- Git-Tag: `v2.16.1`
- vollständiger Commit: `0347f2553a046159c19f6913f63099625da88668`

`UPSTREAM-PARITY.json` steht auf `partial` (Kern vollständig, Web-Staging
dokumentiert). Keine Node-Hardwarevalidierung
durchgeführt; sämtliche Prüfungen verwenden reproduzierbare Fake-Transporte,
Fake-Zeit und Antworten der Python-Referenz.

## Nachgewiesener Funktionsumfang

Der Paket-Root stellt den vollständigen Semantik-Kern aus Phase 1 sowie den
evidenzbasierten Lesepfad aus Phase 2 bereit:

- `IdmModbusClient` mit geschlossenem Konstruktor
  `new IdmModbusClient(host, options?)` und öffentlicher Transport-Injektion
  über `options.transport` (Gegenstück zu Python 1.0 `transport=`);
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
- eine EEPROM-Schreibsperre von 60 Sekunden, öffentlich konfigurierbar über
  `eepromWriteInterval`, und Cyclic-Heartbeats mit einer
  Standard-TTL von 300 Sekunden, geprüft mit kontrollierter Uhr (Fake Clock);
- Write-Retry und Reconnect mit konservativer at-least-once-Semantik sowie
  erfolgreicher Zustandsänderung erst nach bestätigtem Transporterfolg;
- acht exakt gepinnte Golden Fixtures und zwei generierte Dokumente als zehn
  transaktional geprüfte Paritätsartefakte.
- read-only Navigator-10-WebSocket und Navigator-2.0-HTTP mit PIN-Prüfung,
  Login/CSRF, Cache, Notifications, Statistics, Capabilities, Diagnostik und
  geschlossener Fehlerhierarchie über den separaten Export `./web`;
- vollständige Erkennung nicht zusammenhängender Heizkreise A–G über
  Durchfluss- und Active-Mode-Signale;
- Navigator-10-Erkennung mit Plausibilitätsprüfung der Leistungsgrenze (4108),
  Booster-Fallback-Sonde (4001) und Standby-Leistungsmesspaar 4122/4126,
  einschließlich Terra-SWM-Sentinel-Abgrenzung;
- neutrale Binärregister-Metadaten (`BINARY_REGISTER_METADATA`,
  `getBinaryRegisterMetadata`) mit dynamischen Zonen-Raum-Relais-Namen;
- Sentinel-Autorität über `effectiveSentinelValues` je Registerdefinition;
- öffentliches `setModelInfo` zum expliziten Setzen erkannter Modellinformation.

Die Paritätsmatrix enthält exakt 161 öffentliche Python-Symbole der Baseline
`2.16.1`. 106 Zuordnungen sind `complete` (76 Paket-Root inklusive der
Module `exceptions`, `error_codes` und `plausibility`, 30 Web der
1.0.3-Baseline); die 54 gestaffelten Zuordnungen sind die Python-2.x-Web-Erweiterung;
`IdmCoilTransportExtension` (FC01/FC05) ist seit diesem Stand vollständig
portiert.
`IdmModbusClient` ist mit allen 32 öffentlichen Mitgliedern vollständig
abgebildet, einschließlich `getRegisterOutcomes()` für die
Lesediagnostik je Register (Wert, Rohwörter, Ablehnungsgrund).
`ModbusTransport` ist das dokumentierte TypeScript-Gegenstück des öffentlichen
Python-Protokolls `IdmModbusTransport`.

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

Navigator 1.0/1.7 besitzt seit diesem Sync eine eigene Registerkarte
(Registermap 149/154 Register, Signatur-Erkennung über die
Illegal-Data-Address-Antworten von 1350/1498/2000 plus Kernsonde 1000);
Coil-Kommandos (FC01/FC05, c3000/c3003) sind gestaffelt, bis die
Transport-Erweiterung portiert ist. Navigator 1.0/1.7 blieb vorher eine andere, nicht unterstützte und ausdrücklich
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
