# Changelog

Alle wesentlichen Änderungen an diesem Projekt werden in dieser Datei
dokumentiert.

## [Unreleased]

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
  `IdmModbusClient.eepromWriteInterval` (Standard 60 s).
- Strikte Baseline-Prüfung vor jedem Import aus der Python-Referenz.
- 95 vollständige API-Zuordnungen für exakt 95 öffentliche
  Python-Symbole (65 Paket-Root, 30 Web); `IdmModbusClient` ist mit allen
  31 öffentlichen Mitgliedern vollständig abgebildet.
- Öffentliche additive TypeScript-Schnittstelle `ModbusTransport` mit einem
  internen, retry-neutralen `modbus-serial`-Adapter in exakt Version `8.0.25`.
- Serialisierter Modbus-Lesepfad mit Connect, Disconnect, Reconnect, Retry,
  Backoff, exakten FC03- und FC04-Requests sowie striktem Batching ohne Lücken,
  Typmischung oder Überlappungen.
- Einzelregister-Fallback mit Code-2-Unsupported-Erkennung, permanenter
  Fehlerverfolgung, Batch-unsafe-Quarantäne und unveränderlicher Diagnostik.
- Geordnete Modell- und Feature-Erkennung für Navigator 2.0, Navigator Pro und
  Navigator 10 einschließlich Firmware, Heizkreisen, Zonenmodulen, Solar, ISC,
  PV, Kaskade, Sentinels und modellabhängiger Registerkarte.
- Sichere ein- und zwei-Wort-Writes ausschließlich über FC16 mit Planung,
  Simulation, Dry-run ohne Netzwerkverkehr und Python-äquivalenter Typ-,
  Bereichs-, Enum-, Ausschlusswert- und Modellvalidierung.
- EEPROM-Drosselung bei 60 Sekunden und Cyclic-TTL bei 300 Sekunden mit
  kontrollierter Uhr, Zustandsabfragen und expliziten Reset-Funktionen.
- Serialisierte Write-Retries und Reconnects mit at-least-once-Risiko bei
  Antwortverlust; Write-Fehler und Retry-Erschöpfung zeichnen niemals einen
  falschen Erfolg oder einen falschen Sicherheitszustand auf.
- Kontrollierter npm-Tarball mit exakter Dist-Allowlist, ESM-, CommonJS- und
  Declaration-Smoke sowie sauberer Installation.
- Optionales read-only Web-Supplement über `@xerolux/idm-heatpump/web` für
  Navigator 10 WebSocket und Navigator 2.0 HTTP mit Login/CSRF, Cache,
  Notifications, Statistics, Capabilities, Diagnostik und Fehlerhierarchie.
- Web-Supplement: Raumtemperatur-Sensoren `B62`–`B67` sowie Beschreibungen für
  `flow_temp_HK_A`–`G` und `room_temperature_HK_A`–`G`.

### Changed

- Navigator-10-Modellerkennung: Register 4108 zählt nur mit plausibler
  Leistungsgrenze (0,1–200 kW), Fallback-Sonde 4001 (booster_fault, Sentinel
  255 ist familienneutral) und tertiäres Standby-Signal 4122/4126; schließt
  die Terra-SWM-Fehlklassifikation und den Standby-Fall (#170) ab.
- Modbus-Writes mit Exception Code 2 werden wie Reads als permanent
  (`IllegalAddressError`) klassifiziert und nicht erneut versucht
  (`check_transport_response`-Wiederverwendung aus Python 1.0.1).
- Sentinel-Metadaten `(-32768, 65535, 255)` für zehn Pumpen-Statusregister;
  Zonen-Raum-Relais `zm{z}_room{r}_relay` sind `binary`.
- Vollständige A–G-Heizkreiserkennung mit Durchfluss- und Active-Mode-Signal.

### Release status

- Das erste öffentliche Paket ist mit `private: false` als Version `1.0.3`
  freigegeben. Die geprüfte Baseline und alle 95 API-Zuordnungen stehen auf
  `complete`; vor jeder weiteren Veröffentlichung ist die Freshness-Prüfung
  erneut auszuführen.
- Navigator 1.0/1.7 bleibt als separate Protokollfamilie ausgeschlossen.
- Modbus TCP bietet keine integrierte TLS-Verschlüsselung und keine
  Modbus-Authentifizierung; vorgesehen ist ausschließlich ein
  vertrauenswürdiges lokales Netzwerk.
- Keine Node-Hardwarevalidierung durchgeführt.
