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

/** Compact canonical JSON for diagnostics and deterministic serialization. */
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

type StructuralSortKey =
  | Readonly<{ readonly rank: 0 }>
  | Readonly<{ readonly rank: 1; readonly value: boolean }>
  | Readonly<{ readonly rank: 2; readonly value: number }>
  | Readonly<{ readonly rank: 3; readonly value: string }>
  | Readonly<{ readonly items: readonly StructuralSortKey[]; readonly rank: 4 }>
  | Readonly<{
      readonly entries: readonly Readonly<{
        readonly key: string;
        readonly value: StructuralSortKey;
      }>[];
      readonly rank: 5;
    }>;

/**
 * Language-neutral structural key used by both contract implementations.
 *
 * Type ranks are null, boolean, finite number, string, array, then object.
 * Composite values are compared recursively and object keys are ordered by
 * Unicode code point. Number spelling is deliberately absent from the key.
 */
function structuralSortKey(value: NormalizedContractValue): StructuralSortKey {
  if (value === null) return { rank: 0 };
  if (typeof value === "boolean") return { rank: 1, value };
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw new TypeError("Exceptional contract numbers must use tagged envelopes");
    }
    return { rank: 2, value };
  }
  if (typeof value === "string") return { rank: 3, value };
  if (Array.isArray(value)) {
    return { rank: 4, items: value.map((item) => structuralSortKey(item)) };
  }

  return {
    rank: 5,
    entries: Object.keys(value)
      .sort(compareUnicodeCodePoints)
      .map((key) => ({
        key,
        value: structuralSortKey(
          (value as Readonly<Record<string, NormalizedContractValue>>)[
            key
          ] as NormalizedContractValue,
        ),
      })),
  };
}

function compareStructuralSortKeys(left: StructuralSortKey, right: StructuralSortKey): number {
  if (left.rank !== right.rank) return left.rank < right.rank ? -1 : 1;

  switch (left.rank) {
    case 0:
      return 0;
    case 1: {
      const rightValue = (right as Extract<StructuralSortKey, { readonly rank: 1 }>).value;
      return left.value === rightValue ? 0 : left.value ? 1 : -1;
    }
    case 2: {
      const rightValue = (right as Extract<StructuralSortKey, { readonly rank: 2 }>).value;
      if (left.value === rightValue) return 0;
      return left.value < rightValue ? -1 : 1;
    }
    case 3:
      return compareUnicodeCodePoints(
        left.value,
        (right as Extract<StructuralSortKey, { readonly rank: 3 }>).value,
      );
    case 4: {
      const rightItems = (right as Extract<StructuralSortKey, { readonly rank: 4 }>).items;
      const commonLength = Math.min(left.items.length, rightItems.length);
      for (let index = 0; index < commonLength; index += 1) {
        const leftItem = left.items[index];
        const rightItem = rightItems[index];
        if (leftItem === undefined || rightItem === undefined) break;
        const comparison = compareStructuralSortKeys(leftItem, rightItem);
        if (comparison !== 0) return comparison;
      }
      if (left.items.length === rightItems.length) return 0;
      return left.items.length < rightItems.length ? -1 : 1;
    }
    case 5: {
      const rightEntries = (right as Extract<StructuralSortKey, { readonly rank: 5 }>).entries;
      const commonLength = Math.min(left.entries.length, rightEntries.length);
      for (let index = 0; index < commonLength; index += 1) {
        const leftEntry = left.entries[index];
        const rightEntry = rightEntries[index];
        if (leftEntry === undefined || rightEntry === undefined) break;
        const keyComparison = compareUnicodeCodePoints(leftEntry.key, rightEntry.key);
        if (keyComparison !== 0) return keyComparison;
        const valueComparison = compareStructuralSortKeys(leftEntry.value, rightEntry.value);
        if (valueComparison !== 0) return valueComparison;
      }
      if (left.entries.length === rightEntries.length) return 0;
      return left.entries.length < rightEntries.length ? -1 : 1;
    }
  }
}

/** Compare two normalized values with the closed cross-language structural order. */
export function compareContractValues(
  left: NormalizedContractValue,
  right: NormalizedContractValue,
): number {
  return compareStructuralSortKeys(structuralSortKey(left), structuralSortKey(right));
}
