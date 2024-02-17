import { sample } from "lodash-es";
import { useEffect } from "react";

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

export const useKeepScreenOn = () => {
  useEffect(() => {
    let wakelock: WakeLockSentinel | null;

    const handler = async () => {
      wakelock?.release();

      if (document.visibilityState === "visible") {
        wakelock = await navigator.wakeLock.request("screen");
      }
    };

    handler();
    document.addEventListener("visibilitychange", handler);

    return () => {
      wakelock?.release();
      document.removeEventListener("visibilitychange", handler);
    };
  }, []);
};
