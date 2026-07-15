import type { RegisterDef, RegisterDefInput } from "./definitions.js";
import { createRegisterDef } from "./definitions.js";

/**
 * Create a real runtime-readonly Map view.
 *
 * TypeScript's ReadonlyMap is only a compile-time boundary. This closure-backed
 * view deliberately exposes no mutating Map methods, so a hostile cast cannot
 * poison catalog state shared by later calls.
 */
export function immutableRegisterMap(
  entries: Iterable<readonly [string, RegisterDef]>,
): ReadonlyMap<string, RegisterDef> {
  const backing = new Map(entries);
  const view: ReadonlyMap<string, RegisterDef> = {
    get size(): number {
      return backing.size;
    },
    get: (key: string): RegisterDef | undefined => backing.get(key),
    has: (key: string): boolean => backing.has(key),
    entries: (): MapIterator<[string, RegisterDef]> => backing.entries(),
    keys: (): MapIterator<string> => backing.keys(),
    values: (): MapIterator<RegisterDef> => backing.values(),
    forEach(
      callback: (value: RegisterDef, key: string, map: ReadonlyMap<string, RegisterDef>) => void,
      thisArg?: unknown,
    ): void {
      for (const [key, value] of backing) {
        callback.call(thisArg, value, key, view);
      }
    },
    [Symbol.iterator]: (): MapIterator<[string, RegisterDef]> => backing[Symbol.iterator](),
  };
  return Object.freeze(view);
}

export function buildRegisterDefinitions(
  inputs: readonly RegisterDefInput[],
): ReadonlyMap<string, RegisterDef> {
  return immutableRegisterMap(inputs.map((input) => [input.name, createRegisterDef(input)]));
}

export function mergeRegisterMaps(
  ...maps: readonly ReadonlyMap<string, RegisterDef>[]
): ReadonlyMap<string, RegisterDef> {
  const entries = new Map<string, RegisterDef>();
  for (const map of maps) {
    for (const [name, register] of map) {
      entries.set(name, register);
    }
  }
  return immutableRegisterMap(entries);
}
