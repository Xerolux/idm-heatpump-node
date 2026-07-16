import type { RegisterDef } from "../registers/definitions.js";

function compareRegisterType(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * Stable-sort and group only exactly adjacent, non-overlapping logical ranges.
 *
 * The official IDM map contains independent data points whose occupied ranges
 * overlap. Grouping therefore uses each definition's documented start and
 * size and never normalizes occupied ranges.
 */
export function groupRegisters(
  registers: readonly RegisterDef[],
  maxGroupSize: number,
): readonly (readonly RegisterDef[])[] {
  if (!Number.isInteger(maxGroupSize) || maxGroupSize < 1) {
    throw new RangeError("maxGroupSize must be an integer greater than or equal to 1");
  }
  if (registers.length === 0) {
    return Object.freeze([]);
  }

  const sorted = [...registers].sort((left, right) => {
    const typeComparison = compareRegisterType(left.registerType, right.registerType);
    return typeComparison === 0 ? left.address - right.address : typeComparison;
  });
  const groups: RegisterDef[][] = [];
  let current: RegisterDef[] = [];

  for (const register of sorted) {
    if (current.length === 0) {
      current = [register];
      continue;
    }

    const first = current[0] as RegisterDef;
    const previous = current[current.length - 1] as RegisterDef;
    const completeSpan = register.address + register.size - first.address;
    const canMerge =
      register.registerType === first.registerType &&
      register.address === previous.address + previous.size &&
      completeSpan <= maxGroupSize;

    if (canMerge) {
      current.push(register);
    } else {
      groups.push(current);
      current = [register];
    }
  }
  groups.push(current);

  return Object.freeze(groups.map((group) => Object.freeze([...group])));
}
