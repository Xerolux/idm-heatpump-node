/**
 * Read-only IDM controller error-code database.
 *
 * The data was decoded from the configuration of the Windows service tool
 * ("IDM Smart Navigator" 2.3.118) during the NAV10 protocol session of
 * 2026-09-27. The numbering is cross-checked against the message numbers
 * the Modbus `internal_message` register reports; provenance and privacy
 * handling are documented in the idm-heatpump-hass wiki page "Navigator
 * Protocol Analysis".
 *
 * Numbering structure:
 *
 * - `0` — "no error" placeholder with empty texts,
 * - `20..999` — controller messages and errors; this is the range the
 *   Modbus `internal_message` register reports (020-999),
 * - `10000+` — device-side error blocks (20000 display, 30000+ outdoor
 *   unit, inverter, fan, EVD, Carel peripherals, cascade devices).
 *
 * Every entry carries the affected component (`text`, for example
 * "Wärmepumpenvorlauf") and, where the vendor database has one, the error
 * kind (`info`, for example "Maximaltemperatur"); `"{text} {info}"`
 * reproduces the controller display wording. `userDescription` and
 * `serviceDescription` hold the vendor's remediation texts where
 * available. All texts are German: the vendor translation table ships
 * German only for these enums.
 */

import rawData from "./error-codes-data.json" with { type: "json" };
/** One entry of the vendor error-code database (German texts). */
export interface ErrorCodeInfo {
  readonly code: number;
  readonly isWarning: boolean;
  readonly text: string | null;
  readonly info: string | null;
  readonly userDescription: string | null;
  readonly serviceDescription: string | null;
}

export const ErrorCodeInfo = Object.freeze({
  /** Component and error kind as one phrase, e.g. "Vorlauf Maximaltemperatur". */
  displayText(entry: ErrorCodeInfo): string {
    return [entry.text, entry.info].filter((part) => part !== null && part !== "").join(" ");
  },

  create(input: Omit<ErrorCodeInfo, "displayText">): ErrorCodeInfo {
    return Object.freeze({ ...input });
  },
});

type RawEntry = [boolean, string | null, string | null, string | null, string | null];

const DATABASE: ReadonlyMap<number, ErrorCodeInfo> = (() => {
  const entries = new Map<number, ErrorCodeInfo>();
  const raw = rawData as unknown as Record<string, RawEntry>;
  for (const [code, fields] of Object.entries(raw)) {
    entries.set(
      Number(code),
      Object.freeze({
        code: Number(code),
        isWarning: fields[0],
        text: fields[1] ?? null,
        info: fields[2] ?? null,
        userDescription: fields[3] ?? null,
        serviceDescription: fields[4] ?? null,
      }),
    );
  }
  return entries;
})();

/** Return the database entry for `code`, or `null` when unknown. */
export function getErrorCodeInfo(code: number): ErrorCodeInfo | null {
  return DATABASE.get(code) ?? null;
}
