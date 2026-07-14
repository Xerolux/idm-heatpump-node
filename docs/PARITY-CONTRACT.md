# Funktionsparitätsvertrag

## Zweck

Dieses Dokument definiert, was „funktionsgleich zu `idm-heatpump-api`“ für
`@xerolux/idm-heatpump` bedeutet und wie diese Eigenschaft nachgewiesen wird.

Eine gemeinsame Registerliste reicht nicht aus. Parität ist ein überprüfbarer
Verhaltensvertrag über öffentliche API, Transportinteraktion, Fehlerfälle,
Zustand und Zeitabläufe.

## Referenz

Die geprüfte Referenz steht in `UPSTREAM-PARITY.json` und besteht immer aus:

- Repository-URL;
- Python-Paketversion;
- Git-Tag;
- vollständigem Commit-SHA;
- Version des Paritätsschemas.

Ein Branchname wie `main` ist keine reproduzierbare Referenz. Releases dürfen
nur auf feste Tags und Commit-SHAs verweisen.

## Paritätsdimensionen

### 1. Öffentliche Oberfläche

Jeder öffentliche Python-Export benötigt eine fachlich gleichwertige
TypeScript-Entsprechung. TypeScript darf idiomatische Namen und Typen verwenden,
sofern Zuordnung und Semantik eindeutig dokumentiert sind.

Beispiele erlaubter Normalisierung:

- Python `None` ↔ TypeScript `null`;
- Tuple ↔ `readonly` Array;
- Set ↔ sortiertes Array im Contract;
- `snake_case` ↔ `camelCase`;
- Python Enum ↔ TypeScript String-Literal-Union oder `as const` Map.

Nicht erlaubt sind fehlende Funktionen, schwächere Validierung oder andere
Standardwerte.

### 2. Registerschema

Für jede unterstützte Modell- und Featurekombination müssen übereinstimmen:

- kanonischer Name;
- Adresse;
- Datentyp und Größe;
- Registertyp und damit Read-Funktionscode;
- Einheit, Multiplikator, min/max und Enum-Optionen;
- writable, write-only und Write-Klasse;
- EEPROM- und Cyclic-Metadaten;
- ausgeschlossene Write-Werte;
- Home-Automation-Metadaten;
- Quelle, Quellversion und unterstützte Modelle;
- Sentinel-Werte und Hardware-Verifikation.

Reihenfolgeunterschiede werden normalisiert. Inhaltliche Unterschiede sind
nicht zulässig.

### 3. Codec

Gleiche Rohregister müssen gleiche fachliche Werte erzeugen. Gleiche
schreibbare Werte müssen gleiche 16-Bit-Wörter erzeugen.

Float32 wird Low Word zuerst übertragen. NaN, Infinity, Integergrenzen,
Vorzeichen und Multiplikatoren sind ausdrücklich zu testen.

### 4. Transport und Batching

Bei identischer Registerauswahl müssen beide Implementierungen dieselben
Modbus-Requests in derselben fachlichen Reihenfolge erzeugen:

- Read-Funktionscode;
- Startadresse;
- Count;
- Write-Funktionscode;
- Nutzdatenwörter.

Nur exakt angrenzende, nicht überlappende Bereiche desselben Registertyps
dürfen gruppiert werden. Offizielle logische Überschneidungen müssen getrennte
exakte Requests bleiben.

### 5. Erkennung und Zustandsverhalten

Identische Probeantworten müssen zu identischen Ergebnissen führen für:

- Navigator-Modell;
- Firmware;
- Heizkreise und Zonenmodule;
- Solar, ISC, PV und Kaskade;
- unsupported Register;
- batch-unsafe Register;
- permanent fehlgeschlagene Register;
- Connection-Suspect-Zustand;
- Diagnostik.

### 6. Fehler und Resilienz

Transportfehler werden sprachneutral normalisiert. Beide Implementierungen
müssen semantisch gleich reagieren auf:

- Timeout und Verbindungsabbruch;
- kurze oder ungültige Antwort;
- Modbus Exception Code 2;
- wiederholte transiente Fehler;
- Fehler während eines Batchreads;
- Fehler während eines Writes;
- Reconnect und Retry-Erschöpfung.

### 7. Write-Sicherheit

Für denselben Registerzustand und Wert müssen beide Implementierungen den Write
entweder akzeptieren oder mit derselben fachlichen Begründung ablehnen.

Erfolgreiche Write-Pläne müssen identische Zieladresse, Funktion und Wörter
enthalten. Dry-run darf niemals Netzwerkverkehr auslösen.

EEPROM-Drosselung und Cyclic-TTL werden mit kontrollierter Zeit getestet.
Fehlgeschlagene Writes dürfen keinen erfolgreichen Zustandsübergang auslösen.

### 8. Web-Supplement

Gleiche Navigator-10-WebSocket- und Navigator-2.0-HTTP-Antworten müssen gleiche
normalisierte Daten, Werte, Einheiten, Notifications, Statistics, Capabilities
und Fehler erzeugen.

Das Web-Supplement bleibt read-only und optional. Modbus ist der Basisdatenpfad.

## Contract-Harness

Die Cross-Repository-CI checkt die gepinnte Python-Referenz aus und führt einen
Contract-Generator aus. Dieser schreibt sprachneutrale JSON-Szenarien und
Erwartungen.

Ein Szenario enthält mindestens:

```json
{
  "name": "overlapping_humidity_and_mode",
  "configuration": {},
  "transport_responses": [],
  "clock": [],
  "operation": {},
  "expected_result": {},
  "expected_requests": [],
  "expected_state": {}
}
```

TypeScript führt dasselbe Szenario aus. Vor dem Vergleich werden nur in diesem
Dokument ausdrücklich erlaubte Sprachunterschiede normalisiert.

Statische Fixtures werden durch Verhaltensszenarien ergänzt. Insbesondere
Retry, Batch-Fallback, EEPROM und Cyclic-TTL dürfen nicht nur als Datenstruktur
verglichen werden.

## API-Paritätsmatrix

`docs/API-PARITY.md` wird aus der öffentlichen Python-Oberfläche erzeugt oder
gegen sie validiert und enthält:

| Python-Symbol | TypeScript-Symbol | Status | Contract-Test |
| ------------- | ----------------- | ------ | ------------- |

Erlaubte Statuswerte während der Entwicklung:

- `planned`
- `partial`
- `complete`
- `not_applicable` mit zwingender Begründung

Für ein npm-Release sind ausschließlich `complete` und fachlich berechtigte,
explizit geprüfte `not_applicable`-Einträge zulässig. Ein abweichender Status
blockiert den Release.

## Koordinierte Releases

Ein Node-Repository allein kann eine Änderung des Python-Projekts nicht
zeitgleich verhindern. Strikte Gleichheit zum jeweils neuesten stabilen
Release erfordert deshalb einen koordinierten Prozess:

1. Eine öffentliche Python-Änderung aktualisiert Contract und Tests.
2. Der entsprechende Node-Port wird vor dem Python-Release vorbereitet.
3. Cross-Repository-Parität wird gegen den vorgesehenen Python-Commit geprüft.
4. Python- und npm-Releases werden koordiniert veröffentlicht.
5. Die Kompatibilitätsmatrix wird mit beiden Versionen und dem Commit ergänzt.

Falls dennoch zuerst ein neues Python-Release erscheint, markiert der tägliche
Upstream-Check die Node-Baseline sofort als veraltet. Bis zur Wiederherstellung
vollständiger Parität darf kein npm-Release erfolgen.

## Release-Gate

Ein npm-Release ist ausschließlich erlaubt, wenn:

- die Baseline dem neuesten stabilen Python-Release entspricht;
- der Python-Commit exakt verifiziert wurde;
- alle API-Symbole vollständig zugeordnet sind;
- Registerschema und Contract-Szenarien übereinstimmen;
- lokale und Cross-Repository-Tests erfolgreich sind;
- Typecheck, Lint, Format und Coverage erfolgreich sind;
- der erzeugte npm-Tarball installiert und getestet wurde;
- `docs/compatibility-matrix.json` und Changelog vorbereitet sind.

Jede Abweichung ist ein harter Fehler. Releases mit bekannten funktionalen
Abweichungen sind nicht zulässig.
