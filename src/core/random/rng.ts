import { xoroshiro128plus } from "pure-rand/generator/xoroshiro128plus";
import type { RandomGenerator } from "pure-rand/types/RandomGenerator";

export type Weighted<T> = { value: T; weight: number };
export interface Rng { next(): number; integer(min: number, max: number): number; pick<T>(items: readonly T[]): T; weightedPick<T>(items: readonly Weighted<T>[]): T }

export const createRng = (seed: number): Rng => {
  const state: RandomGenerator = xoroshiro128plus(seed | 0);
  const uint = () => state.next() >>> 0;
  const next = () => uint() / 0x1_0000_0000;
  return {
    next,
    integer(min, max) { if (max < min) throw new Error("Invalid RNG range"); return min + Math.floor(next() * (max - min + 1)); },
    pick<T>(items: readonly T[]) { if (!items.length) throw new Error("Cannot pick from an empty list"); return items[Math.floor(next() * items.length)]!; },
    weightedPick<T>(items: readonly Weighted<T>[]) {
      const valid = items.filter((item) => item.weight > 0);
      const total = valid.reduce((sum, item) => sum + item.weight, 0);
      if (!total) throw new Error("No positive weights");
      let cursor = next() * total;
      for (const item of valid) { cursor -= item.weight; if (cursor <= 0) return item.value; }
      return valid.at(-1)!.value;
    },
  };
};
