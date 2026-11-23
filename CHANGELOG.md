# Changelog

Alle wesentlichen Änderungen an diesem Projekt werden in dieser Datei
dokumentiert.

## [Unreleased]

### 2.17.0-rc.1

- Python-2.17.0rc1-Parität für `v2.17.0rc1` (Commit
  `6d6174fabc49cef765249358f4308102ef35391b`).
- Modellerkennung verwirft Läufe mit unbeantworteten Probes und erkennt
  nicht initialisierte Heizkreiswerte.
- Modellgebundene Schreibzugriffe prüfen den Register- und Datentyp. Ein
  laufender EEPROM-Schreibzugriff reserviert seinen Platz bis zum Abschluss.
- Navigator 10 schließt WebSockets bei unterbrochener Anmeldung und meldet
  nicht verfügbare Heizkreise mit einem eigenen Fehler. Navigator 2.0
  normalisiert bekannte Statistikeinheiten und verwirft unbekannte Skalen.
- Keine Node-Hardwarevalidierung durchgeführt.

### Added

- **Coil-Transport-Erweiterung `IdmCoilTransportExtension` (FC01/FC05)**
  portiert: das optionale Interface ergänzt `readCoils`/`writeCoil` neben
  den Wort-Methoden (Gegenstück zu Pythons 2.5.0-Erweiterung); der
  modbus-serial-Adapter implementiert es, Byte-Padding wird auf die
  angeforderte Bitzahl gekürzt, Kurzantworten als Invalid-Response
  klassifiziert. Der Client erkennt die Fähigkeit per Duck-Checking und
  meldet eine handlungsanleitende `IdmTransportError`, wenn ein
  Coil-Register (c3000 Störung quittieren, c3003 Vorrangladung anfordern)
  über einen Transport ohne Coil-Unterstützung gelesen oder geschrieben
  wird. Coil-Leseflüsse laufen durch Batching, Retry,
  Illegal-Data-Address-Quarantäne und Lesediagnostik, normalisiert auf
  0/1-Wörter. Damit ist die Navigator-1.7-Runtime vollständig.

## [2.16.1] - 2026-11-19

Sync der Python-Baseline von `1.0.3` auf `2.16.1` (Tag `v2.16.1`, Commit
`0347f2553a046159c19f6913f63099625da88668`). Der Kern (Modbus TCP,
Registerkarten, Erkennung, Fehlerverhalten, Schreibsicherheit) ist mit
106 vollständige API-Zuordnungen auf Python-2.16.1-Parität gebracht (106 vollständige API-Zuordnungen);
die 55 gestaffelten Zuordnungen (Python-2.x-Web-Erweiterung und
`IdmCoilTransportExtension`) bleiben `planned` und werden in Folge-Syncs
portiert. `package.json` bleibt `private: false`; ein npm-Release erfolgt
erst nach vollständiger Parität gemäß Release-Gate.

### Added

- Eigene Fehlerhierarchie `IdmModbusError`, `IdmConnectionError`,
  `IdmTransportError`, `IdmDeviceError` (mit `exceptionCode`) und
  `IllegalAddressError` als deren Unterklasse — Gegenstück zu Pythons
  Bibliothek-eigener Hierarchie seit 2.0.0. Konsumenten fangen
  `IdmModbusError`, ohne von einem Modbus-Stack abzuhängen.
- Read-only Fehlercode-Datenbank: `getErrorCodeInfo()` und `ErrorCodeInfo`
  mit 2005 Einträgen, dekodiert aus der Konfiguration des
  Windows-Service-Tools („IDM Smart Navigator" 2.3.118).
- Plausibilitätshelfer `isUninitializedTemperature()` und
  `UNINITIALIZED_TEMPERATURE_C` (-300 °C) für das Band uninitialisierter
  Speicher in Temperaturregistern (Python 2.16.1).
- `IdmModbusClient.getRegisterOutcomes()`: Lesediagnostik je Register mit
  Status (`ok`/`suspect`/`unsupported`/`device_error`/`decode_error`),
  letztem dekodierten Wert, Rohwörtern und Ablehnungsgrund
  (Python 2.4.2).
- Navigator 1.0/1.7-Registerkarte (Navigator-1.0/1.7): vollständige eigene Map (149/154
  Register, FC04-Blöcke ab 1000/1500, kompletter RW-Holder-Block ab 2000,
  Coil-Kommandos c3000/c3003) plus Signatur-Erkennung über die
  Illegal-Data-Address-Antworten von 1350/1498/2000 und die Kernsonde
  1000 (Python 2.1.0, 2.4.x, 2.5.0, 2.13.0).
- `RegisterDef.step`-Metadatum (Heizkurve 0.05, Zonen-Raumsollwert 0.5)
  und `RegisterType.COIL`.
- Konstanten `MODEL_NAVIGATOR_17`, `PUMP_STATUS_OPTIONS`,
  `VALVE_HC_HEAT_COOL_OPTIONS` sowie Holiday (3) in
  `SYSTEM_MODE_OPTIONS` (Register 1005, idm-heatpump-hass#596).

### Changed

- Detektion der Heizkreissignale mit einer angrenzenden Batch-Sonde je
  Signal (1350–1363, 1498–1504) nach einzeln getestetem Gate — halbiert
  die Round-Trips; Bruch- oder Falschlänge-Antworten fallen auf
  Einzelsonden zurück (Python 2.14.5).
- `detectModel()` hebt ab, wenn die Verbindung während der Erkennung
  abbricht, statt ein falsches Modell zu melden (Python 2.0.1).
- `getRegister()` löst die Modellkarte vor dem Legacy-Kurzschluss auf,
  damit die 1.7-Schatten (`error_acknowledge`) korrekt auflösen
  (Python 2.5.0).
- Transport-Fehlermeldungen ohne pymodbus-Präfixe („Modbus Error:
  [Connection] …"), kurzantwortige Reads werden als Gerätefehler
  klassifiziert und isolieren das Register (Python 2.0.1).
- Injizierte Transporte können `connectsLazily` deklarieren (geteilte
  Verbindungen; Python 2.15.0).

### Fixed (Registerkarte, Python 2.0.1–2.16.0)

- `heat_sink_flow_rate` (1072) von UCHAR auf wortgetauschtes FLOAT32
  neu typisiert (idm-heatpump-hass#516).
- `dhw_charge_off_temp` (1034) auf 46..67 °C erweitert (#460);
  Ventil 1110 mit offizieller Heating/Cooling-Enum und Sentinel 65535;
  Wärmequellen-Störwort 1680 als Binärstatus; Sentinels für
  `bivalence_state`, `solar_mode` (255), Kühl-Sollwerte (0.0) und
  externe Anforderungstemperaturen (0) (#532).
- Navigator-10-exklusive Blöcke tragen jetzt `supported_models:
("Navigator 10",)`; Binärmetadaten für `compressor_status_3/_4`.

### Staged (geplant, nicht enthalten)

- Python-2.x-Web-Erweiterung: 52 Symbole (Status-, Frischwasser-,
  Leistungs-, Wetter-, iON-, Energiefluss-, Systemübersichts-Frames,
  Web-Writes, Statistiken, `setDatetime`).
- Coil-Transport-Erweiterung `IdmCoilTransportExtension` (FC01/FC05) und
  die Ausführung der 1.7-Coil-/Holder-Writes über den Transport.

Keine Node-Hardwarevalidierung durchgeführt. Sämtliche Prüfungen
verwenden reproduzierbare Fake-Transporte, Fake-Zeit und Antworten der
Python-Referenz (`ModbusTransport`-Injektion, FC03/FC04, Batching mit
Fallback und Quarantäne, Modell-Erkennung, Retry/Reconnect, Diagnostik,
FC16-Writes mit Dry-run, EEPROM-Drosselung und Cyclic-Write-Heartbeats).
Sicherheitshinweise bleiben unverändert: keine integrierte TLS-Verschlüsselung,
keine Modbus-Authentifizierung — Betrieb nur im
vertrauenswürdigen lokalen Netzwerk. Das Web-Supplement bleibt
read-only (Stand 1.0.3-Baseline) bis zur Veröffentlichung der gestaffelten
Bereiche.

## [1.0.3] - 2026-08-25

Erste öffentliche Veröffentlichung mit vollständiger Python-1.0.3-Parität;
die Versionsnummer spiegelt die geprüfte Python-Baseline.

### Added

- Reproduzierbarer Semantik- und Laufzeitvertrag gegen
  `idm-heatpump-api` `1.0.3`, Tag `v1.0.3`, vollständiger Commit
  `6b834747a05931c4512ebdbb03292b487a3f986d`; acht deterministische Golden
  Fixtures und zwei generierte Dokumente als zehn transaktional geprüfte
  Paritätsartefakte.
- Öffentliche Transport-Injektion `new IdmModbusClient(host, { transport })`
  als Gegenstück zu Python 1.0 `IdmModbusClient(..., transport=)`. Injizierte
  Transports besitzen nur den Verbindungszyklus, persistieren über Reconnects
  und werden strukturell gegen das `ModbusTransport`-Protokoll validiert
  (Gegenstück zu `IdmModbusTransport`).
- Neutrales Binärregister-Metadatenmodul mit `BINARY_REGISTER_METADATA`,
  `BinaryRegisterMetadata`, `BinaryDeviceClass`, `BinaryValue` und
  `getBinaryRegisterMetadata` inklusive dynamischer Zonen-Raum-Relais-Namen.
- `RegisterDef.effectiveSentinelValues` mit datentyp-spezifischen
  Sentinel-Defaults (Sentinel-Autorität).
- `IdmModbusClient.setModelInfo` zum expliziten Setzen von Modellinformationen
  mit Cache-Neuaufbau.
- Öffentliche, validierte Eigenschaft
  `IdmModbusClient.eepromWriteInterval` (Standard 60 Sekunden).
- Strikte Baseline-Prüfung vor jedem Import aus der Python-Referenz.
- 95 vollständige API-Zuordnungen für exakt 95 öffentliche
  Python-Symbole (65 Paket-Root, 30 Web); `IdmModbusClient` ist mit allen
  31 öffentlichen Mitgliedern vollständig abgebildet.
- Öffentliche additive TypeScript-Schnittstelle `ModbusTransport` mit einem
  internen, retry-neutralen `modbus-serial`-Adapter in exakt Version `8.0.25`.
- Serialisierter Modbus-Lesepfad mit Connect, Disconnect, Reconnect, Retry,
  exakten FC03-/FC04-Einzelrequests, Batching ausschließlich für exakt
  angrenzende, nicht überlappende Register desselben Typs,
  getrennten Requests für offizielle logische Überlappungen, geordnetem
  Einzelregister-Fallback, Unsupported-Erkennung nur für numerischen
  Modbus-Code 2, permanenter Fehlerverfolgung und
  Batch-unsafe-Quarantäne.
- Erkennung von Navigator 2.0, Navigator Pro und Navigator 10 samt Firmware,
  Heizkreisen, Zonenmodulen, Solar, ISC, PV, Kaskade, Sentinels und
  modellabhängiger Registerkarte.
- Unveränderliche Diagnostik für Verbindungs-, Fehler-, Unsupported-,
  Permanent- und Quarantänezustand.
- Planung, Simulation und Dry-run ohne Netzwerkverkehr.
- Validierte ein- und zwei-Wort-Writes ausschließlich als FC16-Request.
- Typ-, Bereichs-, Enum-, Ausschlusswert- und Modell-Validierung; die
  EEPROM-Drosselung liegt bei 60 Sekunden, Cyclic-Write-Heartbeats bei
  300 Sekunden mit Fake-Clock-Prüfung.
- At-least-once-Schreibsemantik: Antwortverlust wird erneut gesendet,
  Bestätigungsverlust sicher gemeldet (Write-Fehler-Kontext).
- Optionales read-only Web-Supplement (Navigator-10-WebSocket und
  Navigator-2.0-HTTP mit CSRF-Handhabung), Web-Parsing, Notifications und
  Statistics bis zur 1.0.3-Baseline.
