import { last } from "lodash-es";
import {
  Duration,
  Key,
  KeysWithDuration,
  Measure,
  ParsedBass,
  parseBass,
  supportedBasses,
} from "./score.types";
import { takeOne } from "./utils";

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

const isFirstBassValid = (first: ParsedBass): boolean => {
  // Don't start the first bass with an alternative bass
  if (first.timeSignature === "3/4") {
    return first.variant === "Normal";
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

// TODO: Allow configuration
const maxIntervalJump = 3;

const isNextKeyValid = (previousKey: Key | null | undefined, nextKey: Key) => {
  if (!previousKey) {
    return true;
  }

  const interval = Math.abs(
    supportedKeys.indexOf(previousKey) - supportedKeys.indexOf(nextKey),
  );

  if (interval >= maxIntervalJump) {
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
  lastKeyFromLastMeasure: Key | null,
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
  // TODO: Create next challenge where the bass is not too far away from the previous one
  previousMeasures;

  let firstBass = generateBass();
  while (!isFirstBassValid(firstBass)) {
    firstBass = generateBass();
  }

  let secondBass = generateBass();
  while (!isSecondBassValid(firstBass, secondBass)) {
    secondBass = generateBass();
  }

  const firstMeasureNotes = generateNotes(firstBass, 0, null);
  return Measure.fromPropsList([
    {
      notes: firstMeasureNotes,
    },
    {
      notes: generateNotes(secondBass, 1, last(firstMeasureNotes)!.keys[0]),
    },
  ]);
};

export const isCorrectAnswer = (currentInputs: Key[], answerKeys: Key[]) => {
  const uniqueAnswers = [...new Set(answerKeys)];
  // g/3 can exist in both treble and bass,
  // therefore we need to ensure that g/3 is pressed 2 times in that case
  // to make sure both treble and bass are played.
  // The current logic doesn't really check if there's at least 1 g/3 from treble and 1 g/3 from bass.
  return uniqueAnswers.every((answerKey) => {
    const countInCurrentInput = currentInputs.filter(
      (x) => x === answerKey,
    ).length;
    const countInAnswerKeys = answerKeys.filter((x) => x === answerKey).length;
    return countInCurrentInput >= countInAnswerKeys;
  });
};
