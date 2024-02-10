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
