# IDM Heatpump Node

Ein geplanter, vollständig typisierter Node.js-Client für IDM-Navigator-
Wärmepumpen über Modbus TCP.

Das Repository ist das Node.js-/TypeScript-Gegenstück zu
[`Xerolux/idm-heatpump-api`](https://github.com/Xerolux/idm-heatpump-api).
Das spätere npm-Paket soll unter folgendem Namen veröffentlicht werden:

```text
@xerolux/idm-heatpump
```

## Zentrales Versprechen

Das npm-Paket darf nur veröffentlicht werden, wenn es zum angegebenen Release
von `idm-heatpump-api` vollständig funktionsgleich ist. Das umfasst die
Register-Map ebenso wie Codec, Modell-Erkennung, Batch-Verhalten, Fehlerfälle,
Diagnostik, sichere Schreibvorgänge und das optionale lokale Web-Protokoll.

Die aktuell festgelegte Referenz steht in
[`UPSTREAM-PARITY.json`](UPSTREAM-PARITY.json). Die genaue Bedeutung von
Funktionsgleichheit und die verpflichtenden Release-Gates beschreibt
[`docs/PARITY-CONTRACT.md`](docs/PARITY-CONTRACT.md).

## Status

**Planungs- und Bootstrap-Phase. Noch nicht als npm-Paket veröffentlicht.**

Eine Teilimplementierung darf nicht als funktionsgleicher Port veröffentlicht
werden. Insbesondere gibt es kein vorgezogenes Read-only-Paket ohne sichere
Writes oder ohne das Web-Supplement.

Das Manifest bleibt bis zur vollständig bestandenen Paritätsprüfung absichtlich
auf `private: true`. Damit kann der Entwicklungsstand lokal als Tarball geprüft,
aber nicht versehentlich auf npm veröffentlicht werden.

## Dokumente

- [`AGENTS.md`](AGENTS.md) – verbindliche Arbeitsanweisung für KI-Agenten und
  Maintainer
- [`docs/PARITY-CONTRACT.md`](docs/PARITY-CONTRACT.md) – maschinenprüfbarer
  Funktionsvertrag
- [`docs/IMPLEMENTATION-PLAN.md`](docs/IMPLEMENTATION-PLAN.md) – empfohlene
  Portierungsreihenfolge und Abnahmekriterien
- [`UPSTREAM-PARITY.json`](UPSTREAM-PARITY.json) – exakt gepinnte
  Python-Referenz
- [`docs/compatibility-matrix.json`](docs/compatibility-matrix.json) – Zuordnung
  späterer npm-Releases zu Python-Releases

## Zielplattform

- Node.js 22 oder neuer
- TypeScript im Strict Mode
- Node.js-Laufzeit; keine Browser-Kompatibilität
- Modbus TCP als primärer Transport
- Navigator 2.0, Navigator Pro und Navigator 10

Navigator 1.0/1.7 gehört zu einer anderen Protokollfamilie und ist nicht Teil
dieses Projekts.

## Entwicklung

Voraussetzung ist Node.js 22 oder neuer.

```bash
npm ci
npm run check
```

`npm run check` führt Formatprüfung, Linting, strikten Typecheck, Tests mit
Coverage, den ESM-/CommonJS-Build und eine Kontrolle des späteren npm-Tarballs
aus.

## Unofficial project

Dieses Projekt ist eine inoffizielle Open-Source-Integration und steht in
keiner Verbindung zu IDM Energiesysteme GmbH.
