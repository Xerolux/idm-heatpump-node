# Changelog

Alle wesentlichen Änderungen an diesem Projekt werden in dieser Datei
dokumentiert.

## [Unreleased]

### Added

- Reproduzierbarer Semantik- und Laufzeitvertrag gegen
  `idm-heatpump-api` `0.7.6`, Tag `v0.7.6`, vollständiger Commit
  `ad121ebf34a5f5e37204371c026927d77efcd15c`.
- Strikte Baseline-Prüfung vor jedem Import aus der Python-Referenz sowie
  sieben deterministische Golden Fixtures und zwei generierte Dokumente als
  neun transaktional geprüfte Paritätsartefakte.
- 57 vollständige API-Zuordnungen für Konstanten, Typen, Codec,
  Registerdefinitionen und -Builder sowie Phase-2-Diagnostik, Fehler und
  Logging; `IdmModbusClient` bleibt mit exakt 22 implementierten und sieben
  nicht exportierten Write-Mitgliedern `partial`.
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
- Kontrollierter npm-Tarball mit exakter Dist-Allowlist, ESM-, CommonJS- und
  Declaration-Smoke sowie sauberer Installation und struktureller
  `ModbusTransport`-Implementierung ohne Verbindungsaufbau.

### Not yet implemented

- Phase 3: sichere Writes, Dry-run, EEPROM-Drosselung, Cyclic-Heartbeats und
  Write-Fehlerpfade.
- Phase 4: optionales read-only Web-Supplement.
- Phase 5: Veröffentlichung, vollständige Gesamtparität,
  Upstream-Freshness, Hardwarevalidierungsnachweis und sämtliche Release-Gates.

### Release status

- Das Paket bleibt mit `private: true` unveröffentlicht und nicht
  releasebereit; bekannte Teilstände werden nicht publiziert.
- Navigator 1.0/1.7 bleibt als separate Protokollfamilie ausgeschlossen.
- Modbus TCP bietet keine integrierte TLS-Verschlüsselung und keine
  Modbus-Authentifizierung; vorgesehen ist ausschließlich ein
  vertrauenswürdiges lokales Netzwerk.
- Keine Node-Hardwarevalidierung durchgeführt.
