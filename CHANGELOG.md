# Changelog

Alle wesentlichen Änderungen an diesem Projekt werden in dieser Datei
dokumentiert.

## [Unreleased]

## [0.1.0] - 2026-07-17

### Added

- Reproduzierbarer Semantik- und Laufzeitvertrag gegen
  `idm-heatpump-api` `0.8.0`, Tag `v0.8.0`, vollständiger Commit
  `a5d44ed06e5bd317946ca41720f37151631bc9c6`.
- Strikte Baseline-Prüfung vor jedem Import aus der Python-Referenz sowie acht
  deterministische Golden Fixtures und zwei generierte Dokumente als zehn
  transaktional geprüfte Paritätsartefakte.
- 89 vollständige API-Zuordnungen für exakt 89 öffentliche
  Python-Symbole; `IdmModbusClient` ist mit allen 29 öffentlichen Lese-,
  Diagnose- und Write-Mitgliedern vollständig abgebildet.
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
  Declaration-Smoke sowie sauberer Installation und struktureller
  `ModbusTransport`-Implementierung ohne Verbindungsaufbau.
- Optionales read-only Web-Supplement über `@xerolux/idm-heatpump/web` für
  Navigator 10 WebSocket und Navigator 2.0 HTTP mit Login/CSRF, Cache,
  Notifications, Statistics, Capabilities, Diagnostik und Fehlerhierarchie.
- Python-0.8.0-Parität für die vollständige A–G-Heizkreiserkennung mit
  Durchfluss- und Active-Mode-Signal sowie Navigator-10-Web-Mappings B–G.

### Release status

- Das erste öffentliche Paket ist mit `private: false` als Version `0.1.0`
  freigegeben. Die geprüfte Baseline und alle 89 API-Zuordnungen stehen auf
  `complete`; vor jeder weiteren Veröffentlichung ist die Freshness-Prüfung
  erneut auszuführen.
- Navigator 1.0/1.7 bleibt als separate Protokollfamilie ausgeschlossen.
- Modbus TCP bietet keine integrierte TLS-Verschlüsselung und keine
  Modbus-Authentifizierung; vorgesehen ist ausschließlich ein
  vertrauenswürdiges lokales Netzwerk.
- Keine Node-Hardwarevalidierung durchgeführt.
