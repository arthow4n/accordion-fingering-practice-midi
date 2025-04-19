import { sample } from "lodash-es";
import { useEffect } from "react";
import { NoteMessageEvent } from "webmidi";

export const throwError = (): never => {
  throw new Error();
};

export const ensureNotNullish = <T>(input: T | undefined | null): T => {
  return input ?? throwError();
};

export const validOrUndefined = <T>(
  input: T,
  validator: (input: T) => boolean | undefined | null,
) => {
  return validator(input) ? input : undefined;
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

let flushLogSet = new Set<string>();
let flushLogTimeout: number | undefined = undefined;

export const logMidiInputIfNotNull = (event: NoteMessageEvent | null) => {
  if (!event) {
    return;
  }

  const noteString = `${event.note.name.toUpperCase()}${event.note.accidental ?? ""}${event.note.octave}`;

  console.log(
    `Got midi input on channel ${event.message.channel}: ${noteString}`,
  );

  flushLogSet.add(noteString);

  clearTimeout(flushLogTimeout);
  flushLogTimeout = setTimeout(() => {
    console.log([...flushLogSet].join(","));
    flushLogSet = new Set();
  }, 50);
};
