import type { NormalizedContractValue } from "./tagged-values.js";

/** Compare strings exactly as Python compares ``str`` values: by Unicode code point. */
export function compareUnicodeCodePoints(left: string, right: string): number {
  const leftPoints = left[Symbol.iterator]();
  const rightPoints = right[Symbol.iterator]();

  while (true) {
    const leftPoint = leftPoints.next();
    const rightPoint = rightPoints.next();
    if (leftPoint.done || rightPoint.done) {
      if (leftPoint.done === rightPoint.done) return 0;
      return leftPoint.done ? -1 : 1;
    }
    const leftValue = leftPoint.value.codePointAt(0) ?? 0;
    const rightValue = rightPoint.value.codePointAt(0) ?? 0;
    if (leftValue !== rightValue) return leftValue < rightValue ? -1 : 1;
  }
}

/**
 * Compact canonical JSON used by Python's set normalizer as its sort key.
 * Object keys are emitted explicitly so JavaScript's numeric-key enumeration
 * rules cannot override Python's lexical ordering.
 */
export function canonicalContractJson(value: NormalizedContractValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new TypeError("Contract value is not JSON-serializable");
    return encoded;
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalContractJson(item)).join(",")}]`;
  }

  const entries = Object.keys(value)
    .sort(compareUnicodeCodePoints)
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalContractJson(
          (value as Readonly<Record<string, NormalizedContractValue>>)[
            key
          ] as NormalizedContractValue,
        )}`,
    );
  return `{${entries.join(",")}}`;
}
