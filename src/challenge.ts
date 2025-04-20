import { isEqual } from "lodash-es";

import {
  bassKeyRange,
  getBassBaseRoot,
  rightHandNotesRange,
} from "./pattern.helper";
import {
  AnswerCheckMode,
  AnswerInput,
  BassBase,
  Metrics,
  Note,
  QuestionGenerationSetting,
  QuestionLeftHandGenerationMode,
  QuestionRightHandGenerationMode,
  Step,
  TimeSignature,
  Track,
  TrackKey,
  NoteLetterWithOctave,
  BassPatternType,
} from "./type";
import { isSupersetOf, takeOne } from "./utils";
import { bassPatterns, rightHandPatterns } from "./pattern";

const trackMeasureCount = 4;

const bassGenerationModeTypeMapping: Record<
  QuestionLeftHandGenerationMode,
  BassPatternType
> = {
  [QuestionLeftHandGenerationMode.PolkaAlt]: BassPatternType.PolkaAlt,
  [QuestionLeftHandGenerationMode.TangoAlt]: BassPatternType.TangoAlt,
  [QuestionLeftHandGenerationMode.SwingAlt]: BassPatternType.SwingAlt,
};

const getDurationPerMeasure = (timeSignature: TimeSignature) => {
  const durationRatio = 64 / timeSignature.bottom;
  const durationPerMeasure = timeSignature.top * durationRatio;
  return durationPerMeasure;
};

const isTrackCompleted = (steps: Step[], durationOfTrack: number) => {
  return steps.reduce((sum, step) => sum + step.duration, 0) >= durationOfTrack;
};

const makeRightHandStepGen = function* (timeSignature: TimeSignature) {
  let pattern: {
    duration: number;
    rest: boolean;
  }[] = [];
  let patternIndex = 0;

  while (true) {
    if (!pattern[patternIndex]) {
      pattern = takeOne(
        rightHandPatterns.filter((p) =>
          isEqual(timeSignature, p.timeSignature),
        ),
      ).pattern;
      patternIndex = 0;
    }

    yield pattern[patternIndex];
    patternIndex++;
  }
};

const isNextRightHandStepValid = (
  previousNote: Note | undefined | null,
  nextNote: Note,
  currentRightHandTotalAccidentals: number,
  questionGenerationSetting: QuestionGenerationSetting,
) => {
  const { maxAccidentalsPerTrack, maxJump, minJump } =
    questionGenerationSetting.rightHand;
  if (
    nextNote.accidental &&
    currentRightHandTotalAccidentals >= maxAccidentalsPerTrack
  ) {
    return false;
  }

  if (!previousNote) {
    return true;
  }

  const interval = Math.abs(
    rightHandNotesRange.findIndex((note) => isEqual(note, previousNote)) -
      rightHandNotesRange.findIndex((note) => isEqual(note, nextNote)),
  );

  if (interval > maxJump || interval < minJump) {
    return false;
  }

  return true;
};

const generateQuestionRightHand = (
  timeSignature: TimeSignature,
  durationOfTrack: number,
  previousQuestionTrack: Track | null,
  questionGenerationSetting: QuestionGenerationSetting,
): Step[] => {
  const result: Step[] = [];
  const lastStepFromPreviousTrack = previousQuestionTrack?.rightHand.at(-1);
  let currentRightHandTotalAccidentals = 0;

  const rightHandStepGen = makeRightHandStepGen(timeSignature);

  while (
    result.reduce((sum, step) => sum + step.duration, 0) < durationOfTrack
  ) {
    const previousStep =
      !result.length && lastStepFromPreviousTrack
        ? lastStepFromPreviousTrack
        : result.at(-1);

    if (
      questionGenerationSetting.rightHand.mode !==
      QuestionRightHandGenerationMode.Single
    ) {
      throw new Error("Unimplemented.");
    }

    const nextPatternStep = rightHandStepGen.next().value;

    if (nextPatternStep.rest) {
      result.push({
        accompaniment: null,
        duration: nextPatternStep.duration,
        rest: nextPatternStep.rest,
        notes: [],
      });
      continue;
    }

    let nextNote = takeOne(rightHandNotesRange);
    while (
      !isNextRightHandStepValid(
        previousStep?.notes.at(0),
        nextNote,
        currentRightHandTotalAccidentals,
        questionGenerationSetting,
      )
    ) {
      nextNote = takeOne(rightHandNotesRange);
    }

    if (nextNote.accidental) {
      currentRightHandTotalAccidentals++;
    }

    result.push({
      accompaniment: null,
      duration: nextPatternStep.duration,
      notes: [nextNote],
      rest: nextPatternStep.rest,
    });
  }

  return result;
};

const isNextBassPatternValid = (
  lastBassBase: BassBase | null | undefined,
  nextBassBase: BassBase,
  questionGenerationSetting: QuestionGenerationSetting,
) => {
  const nextBassBaseRoot = getBassBaseRoot(nextBassBase);

  const { bassRootHigh, bassRootLow, maxJump, minJump } =
    questionGenerationSetting.leftHand;

  const highIndex = bassKeyRange.indexOf(bassRootHigh);
  const lowIndex = bassKeyRange.indexOf(bassRootLow);
  const nextIndex = bassKeyRange.indexOf(nextBassBaseRoot);

  if (nextIndex > highIndex || nextIndex < lowIndex) {
    return false;
  }

  const lastBassBaseRoot = lastBassBase && getBassBaseRoot(lastBassBase);

  if (!lastBassBaseRoot) {
    return true;
  }

  const lastIndex = bassKeyRange.indexOf(lastBassBaseRoot);
  const interval = Math.abs(lastIndex - nextIndex);

  return interval >= minJump && interval <= maxJump;
};

const generateQuestionLeftHand = (
  timeSignature: TimeSignature,
  durationOfTrack: number,
  previousQuestionTrack: Track | null,
  questionGenerationSetting: QuestionGenerationSetting,
): Step[] => {
  const result: Step[] = [];

  let lastBassBase = previousQuestionTrack?.leftHand.findLast(
    (step) => step.accompaniment,
  )?.accompaniment;

  const getNextBassPattern = () =>
    takeOne(
      bassPatterns.filter(
        (p) =>
          isEqual(p.tag.timeSignature, timeSignature) &&
          p.tag.type ===
            bassGenerationModeTypeMapping[
              questionGenerationSetting.leftHand.mode
            ],
      ),
    );

  while (!isTrackCompleted(result, durationOfTrack)) {
    let nextBassPattern = getNextBassPattern();
    let nextBassBase = nextBassPattern.steps.find(
      (step) => step.accompaniment,
    )?.accompaniment;

    if (!nextBassBase) {
      throw new Error("Missing next bass base");
    }

    while (
      !isNextBassPatternValid(
        lastBassBase,
        nextBassBase,
        questionGenerationSetting,
      )
    ) {
      nextBassPattern = getNextBassPattern();
      nextBassBase = nextBassPattern.steps.find(
        (step) => step.accompaniment,
      )?.accompaniment;

      if (!nextBassBase) {
        throw new Error("Missing next bass base");
      }
    }
    lastBassBase = nextBassBase;

    for (const nextPatternStep of nextBassPattern.steps) {
      if (isTrackCompleted(result, durationOfTrack)) {
        continue;
      }

      if (nextPatternStep.rest) {
        result.push({
          accompaniment: null,
          duration: nextPatternStep.duration,
          rest: nextPatternStep.rest,
          notes: [],
        });
        continue;
      }

      result.push({
        accompaniment: nextPatternStep.accompaniment,
        duration: nextPatternStep.duration,
        notes: nextPatternStep.notes,
        rest: nextPatternStep.rest,
      });
    }
  }

  return result;
};

export const generateQuestionTrack = ({
  previousQuestionTrack,
  questionGenerationSetting,
}: {
  previousQuestionTrack: Track | null;
  questionGenerationSetting: QuestionGenerationSetting;
}): Track => {
  const key: TrackKey = previousQuestionTrack?.key ?? "C";
  const timeSignature: TimeSignature =
    previousQuestionTrack?.timeSignature ??
    questionGenerationSetting.timeSignature;

  const durationPerMeasure = getDurationPerMeasure(timeSignature);
  const durationOfTrack = durationPerMeasure * trackMeasureCount;

  return {
    key,
    timeSignature,
    leftHand: generateQuestionLeftHand(
      timeSignature,
      durationOfTrack,
      previousQuestionTrack,
      questionGenerationSetting,
    ),
    rightHand: generateQuestionRightHand(
      timeSignature,
      durationOfTrack,
      previousQuestionTrack,
      questionGenerationSetting,
    ),
  };
};

export const generateEmptyAnswerInput = (): AnswerInput => {
  return {
    totalDurationPlayedInTrack: 0,
    currentInputStep: {
      leftHand: [],
      rightHand: [],
    },
  };
};

const handToAbc = (
  trackKey: TrackKey,
  timeSignature: TimeSignature,
  handSteps: Step[],
  totalDurationPlayedInTrack: number,
) => {
  let sharpedNotesInCurrentMeasure = new Set<NoteLetterWithOctave>();
  let flattenedNotesInCurrentMeasure = new Set<NoteLetterWithOctave>();

  const noteToAbc = (note: Note): string => {
    // Cast to octave === 5 then postfix with commas or quotes to match the octave.
    let renderedNote = note.letter.toLowerCase();
    const noteLetterWithOctave: NoteLetterWithOctave = `${note.letter}${note.octave}`;

    for (let x = note.octave; x < 5; x++) {
      renderedNote += ",";
    }

    for (let x = note.octave; x > 5; x--) {
      renderedNote += "'";
    }

    // TODO: Take track key into account and prefix the rendered accidentals when traslating to ABC
    if (trackKey !== "C") {
      throw new Error("Only C major track is supported for now.");
    }

    if (note.accidental === "#") {
      const shouldMarkAsSharp =
        !sharpedNotesInCurrentMeasure.has(noteLetterWithOctave);
      if (shouldMarkAsSharp) {
        sharpedNotesInCurrentMeasure.add(noteLetterWithOctave);
        renderedNote = "^" + renderedNote;
      }
    }
    if (note.accidental === "b") {
      const shouldMarkAsFlat =
        !flattenedNotesInCurrentMeasure.has(noteLetterWithOctave);
      if (shouldMarkAsFlat) {
        flattenedNotesInCurrentMeasure.add(noteLetterWithOctave);
        renderedNote = "_" + renderedNote;
      }
    }

    if (!note.accidental) {
      const shouldMarkAsNatural =
        sharpedNotesInCurrentMeasure.has(noteLetterWithOctave) ||
        flattenedNotesInCurrentMeasure.has(noteLetterWithOctave);

      if (shouldMarkAsNatural) {
        sharpedNotesInCurrentMeasure.delete(noteLetterWithOctave);
        flattenedNotesInCurrentMeasure.delete(noteLetterWithOctave);
        renderedNote = "=" + renderedNote;
      }
    }

    return renderedNote;
  };

  const durationPerMeasure = getDurationPerMeasure(timeSignature);
  let result = "";
  let durationRendered = 0;

  for (const step of handSteps) {
    const shouldMark = durationRendered === totalDurationPlayedInTrack;

    durationRendered += step.duration;

    result += `${shouldMark ? "!mark!" : ""}"${step.accompaniment ?? ""}"${step.rest ? `z` : `[${step.notes.map(noteToAbc).join("")}]`}${step.duration}/64`;

    // Move to the next measure
    if (durationRendered % durationPerMeasure === 0) {
      result += "|";
      sharpedNotesInCurrentMeasure = new Set();
      flattenedNotesInCurrentMeasure = new Set();
    }
  }

  return result;
};

export const trackToAbc = (
  track: Track,
  totalDurationPlayedInTrack: number,
): string => {
  // Syntax reference: https://editor.drawthedots.com/

  return `X:1
M:${track.timeSignature.top}/${track.timeSignature.bottom}
L:1/1
%%staves {(RH) (LH)}
V:RH clef=treble
V:LH clef=bass
K:${track.key}
V:RH
${handToAbc(track.key, track.timeSignature, track.rightHand, totalDurationPlayedInTrack)}|
V:LH
${handToAbc(track.key, track.timeSignature, track.leftHand, totalDurationPlayedInTrack)}|
`;
};

export const getCurrentStepFromHand = (
  hand: Step[],
  totalDurationPlayedInTrack: number,
) => {
  const steps = hand.flatMap((measure) => measure);
  let durationInHandMapped = 0;

  for (const step of steps) {
    // Can happen if left hand is [C]1/2[C]1/2 but right hand is [C]1/4
    if (durationInHandMapped > totalDurationPlayedInTrack) {
      return null;
    }

    if (durationInHandMapped === totalDurationPlayedInTrack) {
      return step;
    }

    durationInHandMapped += step.duration;
  }

  // throw new Error("Can't find notes to play.");
  return null;
};

const getNextStepDurationTimestamp = (
  hand: Step[],
  totalDurationPlayedInTrack: number,
) => {
  const steps = hand.flatMap((measure) => measure);
  let durationInHandMapped = 0;

  for (const step of steps) {
    durationInHandMapped += step.duration;
    if (durationInHandMapped > totalDurationPlayedInTrack) {
      return durationInHandMapped;
    }
  }

  return durationInHandMapped;
};

const stringifyNote = (note: Note) =>
  `${note.letter}${note.accidental ?? ""}${note.octave}`;

const checkAnswerForHand = (
  handSide: "left" | "right",
  questionHand: Step[],
  answerNotes: Note[],
  totalDurationPlayedInTrack: number,
  checkInModes: AnswerCheckMode[],
  answerCheckMode: AnswerCheckMode,
) => {
  const shoulCheck = checkInModes.includes(answerCheckMode);

  const step = getCurrentStepFromHand(questionHand, totalDurationPlayedInTrack);

  const makeStringifier = (): ((note: Note) => string) => {
    let counter = 0;

    return (note: Note): string => {
      if (
        handSide === "right" &&
        answerCheckMode === AnswerCheckMode.LeftHandAndBeatOnlyRightHand
      ) {
        counter += 1;
        return `${counter}`;
      }

      return stringifyNote(note);
    };
  };

  const question = new Set((step?.notes ?? []).map(makeStringifier()));
  const answer = new Set([...new Set(answerNotes)].map(makeStringifier()));

  console.log(handSide, "question", JSON.stringify([...question]));
  console.log(handSide, "answer", JSON.stringify([...answer]));

  const isCorrect = !shoulCheck || isSupersetOf(answer, question);
  const isPerfectMatch =
    !shoulCheck || (isCorrect && question.size === answer.size);

  const nextStepDurationTimestamp = getNextStepDurationTimestamp(
    questionHand,
    totalDurationPlayedInTrack,
  );

  // console.log({
  //   question,
  //   answer,
  //   isCorrect,
  //   isPerfectMatch,
  //   durationToMove: step
  //     ? isCorrect
  //       ? step.duration
  //       : 0
  //     : nextStepDurationTimestamp - totalDurationPlayedInTrack,
  // });

  return {
    isCorrect,
    isPerfectMatch,
    durationToMove: step
      ? isCorrect
        ? step.duration
        : 0
      : nextStepDurationTimestamp - totalDurationPlayedInTrack,
  };
};

export const checkNextProgress = (
  questionTrack: Track,
  answerInput: AnswerInput,
  answerCheckMode: AnswerCheckMode,
  metrics: Metrics,
): {
  nextProgress: {
    totalDurationPlayedInTrack: number;
    metrics: Metrics;
  };
} => {
  const resultLeft = checkAnswerForHand(
    "left",
    questionTrack.leftHand,
    answerInput.currentInputStep.leftHand,
    answerInput.totalDurationPlayedInTrack,
    [
      AnswerCheckMode.All,
      AnswerCheckMode.LeftHandOnly,
      AnswerCheckMode.LeftHandAndBeatOnlyRightHand,
    ],
    answerCheckMode,
  );

  const resultRight = checkAnswerForHand(
    "right",
    questionTrack.rightHand,
    answerInput.currentInputStep.rightHand,
    answerInput.totalDurationPlayedInTrack,
    [
      AnswerCheckMode.All,
      AnswerCheckMode.RightHandOnly,
      AnswerCheckMode.LeftHandAndBeatOnlyRightHand,
    ],
    answerCheckMode,
  );

  const nextDurationPlayed =
    answerInput.totalDurationPlayedInTrack +
    [resultLeft.durationToMove, resultRight.durationToMove]
      .filter((x) => x !== null)
      .reduce(
        (prev, curr) => (curr < prev ? curr : prev),
        resultLeft.durationToMove ?? resultRight.durationToMove ?? 0,
      );

  return {
    nextProgress: {
      totalDurationPlayedInTrack: nextDurationPlayed,
      metrics: {
        completedSets:
          metrics.completedSets +
          (resultLeft.isCorrect && resultRight.isCorrect ? 1 : 0),
        perfectlyCompletedSets:
          metrics.perfectlyCompletedSets +
          (resultLeft.isPerfectMatch && resultRight.isPerfectMatch ? 1 : 0),
      },
    },
  };
};

export const getTotalDurationOfTrack = (track: Track) => {
  return track.leftHand
    .flatMap((measure) => measure)
    .reduce((sum, step) => sum + step.duration, 0);
};
