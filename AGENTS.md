# AGENTS.md — IDM Heatpump Node

Diese Datei enthält verbindliche Regeln für KI-Agenten und Maintainer in
diesem Repository.

## Oberstes Ziel: vollständige Funktionsparität

[`Xerolux/idm-heatpump-api`](https://github.com/Xerolux/idm-heatpump-api) ist
die fachliche Referenzimplementierung und Single Source of Truth.

`@xerolux/idm-heatpump` muss zu der in `UPSTREAM-PARITY.json` festgelegten
Python-Version vollständig funktionsgleich sein. Ein npm-Release ist nur
zulässig, wenn außerdem geprüft wurde, dass diese Baseline dem neuesten
stabilen Python-Release entspricht.

Funktionsparität umfasst den gesamten öffentlichen Vertrag:

- öffentliche API und Konstanten;
- Registerdefinitionen, Metadaten, Modell-Gates und Sentinels;
- Datentypen, Größen, Codec und Low-Word-first-Float-Übertragung;
- Modbus-Funktionscodes und exakte Request-Shapes;
- Batchbildung, Fallbacks und Batch-Unsafe-Quarantäne;
- Modell- und Feature-Erkennung;
- Retry, Backoff, Reconnect und Request-Serialisierung;
- Fehlerklassifikation, Unsupported-Erkennung und Diagnostik;
- Write-Validierung, Dry-run und Custom-Register-Regeln;
- EEPROM-Drosselung und Cyclic-Write-Heartbeats;
- Navigator-10-WebSocket und Navigator-2.0-HTTP;
- Web-Parsing, Notifications und Statistics.

Eine idiomatische TypeScript-Oberfläche ist erlaubt. Jede öffentliche
Python-Funktion benötigt jedoch eine dokumentierte TypeScript-Entsprechung mit
demselben fachlichen Verhalten. Sprachbedingte Darstellungsunterschiede müssen
vor Paritätsvergleichen normalisiert werden.

## Vor jeder fachlichen Änderung lesen

Lies vollständig:

1. `AGENTS.md` in diesem Repository;
2. `docs/PARITY-CONTRACT.md`;
3. `UPSTREAM-PARITY.json`;
4. aus dem dort gepinnten Python-Commit:
   - `AGENTS.md`;
   - `docs/Register-Map-Invariants.md`;
   - `docs/API-Contract.md`;
   - `docs/Navigator-Protocol-Analysis.md`;
   - die betroffenen Implementierungsdateien und Tests.

Verwende niemals nur den aktuellen Python-Branch, ohne den tatsächlich
geprüften Commit in `UPSTREAM-PARITY.json` festzuhalten.

## Nicht verhandelbare Protokollregeln

- Verschiebe niemals eine offizielle Registeradresse, um logische
  Überschneidungen zu beseitigen.
- Ändere niemals einen dokumentierten Datentyp, damit jede Adresse nur einen
  eindeutigen 16-Bit-Slot belegt.
- IDM `FLOAT` ist IEEE-754 Float32 mit zwei 16-Bit-Registern, übertragen als
  `Reg_L` und anschließend `Reg_H`.
- Validiere physische Wertebereiche erst nach vollständigem Dekodieren des
  dokumentierten Datentyps.
- Bilde Batches ausschließlich aus exakt angrenzenden, nicht überlappenden
  Bereichen desselben Registertyps.
- Die Batch-Bedingung lautet exakt:

  ```text
  next.address === previous.address + previous.size
  ```

- Überspanne keine Lücken und kombiniere keine überlappenden Datenpunkte.
- Lese überlappende Datenpunkte mit ihren jeweils exakten Startadressen und
  Größen. `humidity_sensor` ist `1392/count=2`; `hc_a_mode` ist ein separater
  Request `1393/count=1`.
- Funktionscode, Startadresse und Count gehören zur Protokollidentität eines
  Registers.
- Behandle dokumentierte Sentinels als gültige Nichtverfügbarkeitswerte.
- Nur Modbus Exception Code 2 darf ein Register als unsupported markieren.
  Transiente Fehler dürfen dies nicht.
- Navigator 1.0/1.7 ist eine separate, nicht unterstützte Protokollfamilie.
  Übernimm keine ihrer Adressen in die Navigator-2.0/10/Pro-Map.
- Writes sind sicherheitskritisch. EEPROM-Schutz, Cyclic-TTL, exakte
  Funktionscodes und ausgeschlossene Werte müssen erhalten bleiben.

## Keine Teilveröffentlichung

Entwicklung darf phasenweise erfolgen. Eine Teilimplementierung darf aber
nicht auf npm veröffentlicht oder als funktionsgleich bezeichnet werden.

Verboten sind insbesondere Releases:

- ohne sichere Write-Unterstützung;
- ohne vollständige Modell- und Feature-Erkennung;
- ohne Web-Supplement;
- mit unvollständiger Register-Map;
- ohne Cross-Repository-Vertragstests;
- mit `missing`, `partial` oder `planned` in der API-Paritätsmatrix.

Die erste npm-Version beginnt bei `0.1.0`, muss aber bereits den vollständigen
öffentlichen Funktionsumfang ihrer Python-Baseline abbilden.

## Cross-Repository-Vertragstests

Parität darf nicht manuell behauptet werden. Die CI muss das Python-Repository
am exakten Commit aus `UPSTREAM-PARITY.json` auschecken und daraus
maschinenlesbare Golden Contracts erzeugen.

Mindestens zu vergleichen sind:

- vollständige Registerschemas aller unterstützten Modellkombinationen;
- öffentliche Exporte, Konstanten und Option Maps;
- Codec-Testvektoren;
- Modell-Erkennungsszenarien;
- Batch-Gruppierungen und exakte Modbus-Request-Traces;
- Retry-, Reconnect- und Fehlerklassifikation;
- akzeptierte und abgelehnte Write-Pläne;
- EEPROM- und Cyclic-Zustandsübergänge mit kontrollierter Zeit;
- Web-Parser, Notifications, Statistics und Diagnostik.

Bei identischen Eingaben, Rohdaten, Fehlern und Zeitabläufen müssen Python und
TypeScript semantisch identische Ergebnisse und Request-Sequenzen erzeugen.

Die Paritätstests müssen bei jeder Abweichung hart fehlschlagen. Eine Warnung
ist kein ausreichendes Release-Gate.

## Pflichtdateien der Implementierung

Sobald die Implementierung beginnt, müssen folgende Artefakte angelegt und
gepflegt werden:

- `docs/API-PARITY.md` mit Zuordnung jedes öffentlichen Python-Symbols;
- `test/fixtures/register-schema.json`;
- `test/fixtures/codec-vectors.json`;
- `test/fixtures/behavior-contract.json`;
- `test/fixtures/web-contract.json`;
- `test/parity/`;
- `scripts/generate-python-contract.py`;
- `scripts/check-upstream-version.mjs`.

Jeder öffentliche Python-Export benötigt in `docs/API-PARITY.md` eine
TypeScript-Entsprechung und einen Testnachweis. Nur der Status `complete` ist
für Releases zulässig.

## Registeränderungen

Registerkorrekturen erfolgen zuerst in `idm-heatpump-api`, einschließlich der
dort verlangten Quellen, Tests, Schema-Snapshots, Changelog- und
Cross-Repository-Prüfungen.

Dieses Repository darf keine unabhängigen Registerkorrekturen erfinden. Nach
dem Python-Fix werden Baseline, Fixtures, TypeScript-Code und Paritätstests in
einem nachvollziehbaren Änderungssatz aktualisiert.

Füge niemals eine No-Overlap-Invariante hinzu. Die offizielle Navigator-Map
enthält dokumentierte logische Überschneidungen an Blockgrenzen.

## Upstream-Synchronisation

Prüfe auf neue Python-Releases:

- bei jedem Pull Request;
- bei jedem Push auf `main`;
- täglich per Scheduled Workflow;
- bei jedem Python-Release per Repository Dispatch;
- unmittelbar vor einem npm-Release.

Ein neues Python-Release macht die Node-Baseline veraltet. Dann sind neue
npm-Releases gesperrt, bis Implementierung, Contracts,
`UPSTREAM-PARITY.json` und `docs/compatibility-matrix.json` aktualisiert wurden
und alle Paritätstests bestehen.

Für echte Gleichzeitigkeit müssen Änderungen mit öffentlicher Wirkung vor dem
Python-Release auch im Node-Repository vorbereitet und grün sein. Releases
sind zwischen beiden Repositories zu koordinieren.

## Technische Leitplanken

- TypeScript mit `strict: true`;
- Node.js 22 oder neuer;
- CI mit Node.js 22 und 24;
- ESM als primäres Format, CommonJS nur aus derselben Implementierung;
- ein eigener `ModbusTransport` kapselt die konkrete Modbus-Bibliothek;
- sämtliche Client-Requests werden serialisiert;
- Tests verwenden Fake-Transport und Fake Clock;
- keine Live-Hardware-Writes ohne ausdrückliche Zustimmung;
- keine Browser-Kompatibilität behaupten;
- keine Telemetrie;
- keine PINs, Zugangsdaten, privaten IPs oder Gerätekennungen in Logs,
  Fixtures oder Dokumentation.

## Erforderliche Tests

Jede betroffene Funktion benötigt fokussierte Tests. Der Gesamtsatz muss
mindestens abdecken:

- Float32 Low-Word-first Encode/Decode;
- Integer-, UCHAR-, BOOL- und BITFLAG-Grenzen;
- Registerschema und Modell-Gates;
- exakte FC03-/FC04-Requests;
- angrenzende, getrennte, überlappende und zu große Batches;
- `1392/count=2` getrennt von `1393/count=1`;
- Illegal Data Address gegenüber transienten Fehlern;
- Reconnect, kurze Antworten und beschädigte Antworten;
- Batch-Fallback und Quarantäne;
- parallele Promise-Aufrufe und Request-Serialisierung;
- Sentinels;
- Dry-run und reale Write-Pläne;
- EEPROM-Drosselung;
- Cyclic Heartbeats;
- abgelehnte Custom Writes;
- Navigator-10- und Navigator-2.0-Webverhalten;
- Installation und Import aus dem erzeugten npm-Tarball;
- ESM-Import und CommonJS-Require, sofern CommonJS angeboten wird.

## Definition of Done

Eine Änderung ist nur abgeschlossen, wenn:

- Unit-, Integrations- und Cross-Repository-Paritätstests bestehen;
- TypeScript, Lint und Formatprüfung bestehen;
- Branch Coverage mindestens 80 Prozent beträgt;
- `npm pack` nur beabsichtigte Dateien enthält;
- der erzeugte Tarball in einem sauberen Testprojekt installiert wurde;
- README, Changelog und Paritätsdokumentation aktuell sind;
- keine Registerdefinition ohne Quelle und Modell-Metadaten eingeführt wurde;
- die geprüfte Python-Version und der vollständige Commit-SHA dokumentiert
  sind.

## Arbeitsweise

- Erstelle vor größeren Änderungen einen konkreten Plan.
- Portiere in kleinen, überprüfbaren Schritten und Commits.
- Bewahre bei Unklarheiten das nachgewiesene Python-Verhalten und dokumentiere
  die offene Frage.
- Erfinde keine Register, Protokollannahmen oder stillen Abweichungen.
- Verwende vorhandene Golden Fixtures und Tests statt manuell kopierter
  Erwartungen.
- Berichte am Ende implementierte Funktionen, Abweichungen, Testergebnisse,
  Coverage, Tarball-Inhalt und verbleibende Hardwarevalidierungen.
