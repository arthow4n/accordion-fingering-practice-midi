import { last } from "lodash-es";
import {
  BassChordKey,
  Duration,
  Key,
  KeysWithDuration,
  Measure,
  ParsedBass,
  parseBass,
  parseBassOrNull,
  supportedBasses,
} from "./score.types";
import { isSupersetOf, takeOne } from "./utils";

// TODO: Support other scales than C Major
const supportedKeys: Key[] = [
  "g/3",
  "a/3",
  "b/3",
  "c/4",
  "d/4",
  "e/4",
  "f/4",
  "g/4",
  "a/4",
  "b/4",
  "c/5",
  "d/5",
  "e/5",
  "f/5",
  "g/5",
];

const bassPosition: BassChordKey[] = ["Bb", "F", "C", "G", "D", "A", "E"];

// TODO: Allow configuration
const maxTrebleIntervalJump = 3;
const maxBassIntervalJump = 2;

const isFirstBassValid = (
  first: ParsedBass,
  lastBassFromPreviousMeasures: ParsedBass | null,
): boolean => {
  // Don't start the first bass with an alternative bass
  if (first.timeSignature === "3/4" && first.variant !== "Normal") {
    return false;
  }

  if (lastBassFromPreviousMeasures) {
    const interval = Math.abs(
      bassPosition.indexOf(lastBassFromPreviousMeasures.bassChordKey) -
        bassPosition.indexOf(first.bassChordKey),
    );

    if (interval > maxBassIntervalJump) {
      return false;
    }
  }

  return true;
};

const isSecondBassValid = (first: ParsedBass, second: ParsedBass): boolean => {
  if (first.timeSignature != second.timeSignature) {
    return false;
  }

  if (first.timeSignature === "3/4" && second.variant !== "Alt") {
    return false;
  }

  if (
    first.timeSignature === "4/4" &&
    first.variant === "Alt" &&
    second.variant !== "Alt"
  ) {
    return false;
  }

  if (second.variant === "Alt") {
    return first.chord === second.chord;
  }

  return true;
};

const isNextKeyValid = (previousKey: Key | null | undefined, nextKey: Key) => {
  if (!previousKey) {
    return true;
  }

  const interval = Math.abs(
    supportedKeys.indexOf(previousKey) - supportedKeys.indexOf(nextKey),
  );

  if (interval > maxTrebleIntervalJump) {
    return false;
  }

  return true;
};

const generateBass = () => {
  return parseBass(takeOne(supportedBasses));
};

const generateNotes = (
  bass: ParsedBass,
  measureIndex: number,
  lastKeyFromLastMeasure: Key | null | undefined,
): KeysWithDuration[] => {
  // TODO: Support more durations
  const [countRaw, duration] = bass.timeSignature.split("/") as [
    string,
    Duration,
  ];
  const count = parseInt(countRaw, 10);

  const result: KeysWithDuration[] = [];
  while (result.length < count) {
    const previousKey =
      lastKeyFromLastMeasure && !result.length
        ? lastKeyFromLastMeasure
        : last(result)?.keys[0];

    let nextKey = takeOne(supportedKeys);
    while (!isNextKeyValid(previousKey, nextKey)) {
      nextKey = takeOne(supportedKeys);
    }

    const next = {
      bass: bass.raw,
      duration,
      keys: [nextKey],
      isCurrentProgress: result.length === 0 && measureIndex === 0,
    };

    result.push(next);
  }

  return result;
};

export const generateMeasuresForChallenge = (
  previousMeasures: Measure[] | null,
): Measure[] => {
  const lastNoteFromPreviousMeasures = last(
    previousMeasures?.flatMap((m) => m.notes),
  );

  const lastBassFromPreviousMeasures = parseBassOrNull(
    lastNoteFromPreviousMeasures?.bass,
  );

  let firstBass = generateBass();
  while (!isFirstBassValid(firstBass, lastBassFromPreviousMeasures)) {
    firstBass = generateBass();
  }

  let secondBass = generateBass();
  while (!isSecondBassValid(firstBass, secondBass)) {
    secondBass = generateBass();
  }

  const firstMeasureNotes = generateNotes(
    firstBass,
    0,
    lastNoteFromPreviousMeasures?.keys[0],
  );

  return Measure.fromPropsList([
    {
      notes: firstMeasureNotes,
    },
    {
      notes: generateNotes(secondBass, 1, last(firstMeasureNotes)!.keys[0]),
    },
  ]);
};

export type AnswerKeys = {
  treble: Set<Key>;
  bass: Set<Key>;
};

export const createAnswerKeys = (
  {
    treble,
    bass,
  }: {
    treble: Key[];
    bass: Key[];
  } = {
    treble: [],
    bass: [],
  },
): AnswerKeys => {
  return {
    treble: new Set(treble),
    bass: new Set(bass),
  };
};

export enum AnswerCheckMode {
  All = "All",
  TrebleOnly = "TrebleOnly",
  BassOnly = "BassOnly",
}

export const isCorrectAnswer = (
  currentInputs: AnswerKeys,
  answerKeys: AnswerKeys,
  answerCheckMode: AnswerCheckMode,
): boolean => {
  console.log("Current treble input: ", [...currentInputs.treble.values()]);
  console.log("Current bass input: ", [...currentInputs.bass.values()]);
  // console.log("Answer treble: ", [...answerKeys.treble.values()]);
  // console.log("Answer bass: ", [...answerKeys.bass.values()]);

  const isTrebleMatch = isSupersetOf(currentInputs.treble, answerKeys.treble);
  const isBassMatch = isSupersetOf(currentInputs.bass, answerKeys.bass);

  switch (answerCheckMode) {
    case AnswerCheckMode.All:
      return isTrebleMatch && isBassMatch;
    case AnswerCheckMode.BassOnly:
      return isBassMatch;
    case AnswerCheckMode.TrebleOnly:
      return isTrebleMatch;
  }
};
