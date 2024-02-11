import { sample } from "lodash-es";

export const throwError = (): never => {
  throw new Error();
};

export const ensureNotNullish = <T>(input: T | undefined | null): T => {
  return input ?? throwError();
};

export const takeOne = <T>(all: T[]): T => {
  return ensureNotNullish(sample(all));
};

export const isSupersetOf = <T>(a: Set<T>, b: Set<T>) => {
  return [...b.values()].every((v) => a.has(v));
};
