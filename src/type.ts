export type NoteLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type NoteAccidental = "#" | "b" | "";

export type Octave = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type Note = {
  letter: NoteLetter;
  accidental: NoteAccidental | null | undefined;
  octave: Octave;
};

export type NoteLetterWithOctave = `${NoteLetter}${Octave}`;

export type NoteString = `${NoteLetter}${NoteAccidental}${Octave}`;

export type TrackKey = `${NoteLetter}${NoteAccidental}${"" | "min"}`;

export type Step = {
  notes: Note[];
  /**
   * If `true`, {@link Step.notes} should have 0 length.
   */
  rest: boolean;
  /**
   * Divided by 64 when transpiling to ABC, e.g. 1 -> 1/64, 32 -> 32/64, ...
   */
  duration: number;
  /**
   * Accompaniment string to be rendered above the right hand measures.
   */
  accompaniment: string | null;
};

export type Measure = Step[];

export type TimeSignature = {
  top: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  bottom: 2 | 4 | 8;
};

export type Track = {
  timeSignature: TimeSignature;
  key: TrackKey;
  leftHand: Step[];
  rightHand: Step[];
  questionGenerationState: QuestionGenerationState;
};

export type QuestionGenerationState = {
  rightHand: {
    takeOneNoteWithRepetitionPenalty: () => Note;
  };
};

export enum QuestionRightHandGenerationMode {
  Single = "Single",
  Double = "Double",
}

export enum QuestionLeftHandGenerationMode {
  PolkaAlt = "PolkaAlt",
  PolkaSwampAlt = "PolkaSwampAlt",
  TangoAlt = "TangoAlt",
  SwingAlt = "SwingAlt",
}

export type QuestionGenerationSetting = {
  timeSignature: TimeSignature;
  leftHand: {
    mode: QuestionLeftHandGenerationMode;
    minJump: number;
    maxJump: number;
    bassRootLow: BassBaseRoot;
    bassRootHigh: BassBaseRoot;
  };

  rightHand: {
    mode: QuestionRightHandGenerationMode;
    minJump: number;
    maxJump: number;
    maxAccidentalsPerTrack: number;
  };
};

export enum AnswerCheckMode {
  All = "All",
  RightHandOnly = "RightHandOnly",
  LeftHandOnly = "LeftHandOnly",
  LeftHandAndBeatOnlyRightHand = "LeftHandAndBeatOnlyRightHand",
}

export type AnswerInput = {
  totalDurationPlayedInTrack: number;
  currentInputStep: {
    leftHand: Note[];
    rightHand: Note[];
  };
};

export type Metrics = {
  completedSets: number;
  perfectlyCompletedSets: number;
};

export type AppState = {
  questionTrack: Track;
  answerInput: AnswerInput;

  questionGenerationSetting: QuestionGenerationSetting;
  answerCheckMode: AnswerCheckMode;

  detectedMidiInputDevices: string;
  metrics: Metrics;
  inputForCurrentMeasuresStartedAtTime: Date | null;
  timeTookToCompleteLastMeasuresInSeconds: number;
  rejectInputBeforeTime: Date;
};

export type BassBaseRoot = `${NoteLetter}${NoteAccidental}`;
export type BassBase = `${BassBaseRoot}${"" | "m" | "7" | "dim"}`;

export enum BassPatternType {
  PolkaNormal = "PolkaNormal",
  PolkaAlt = "PolkaAlt",
  PolkaSwampAlt = "PolkaSwampAlt", // What is this called in English actually...?
  TangoAlt = "TangoAlt",
  SwingAlt = "SwingAlt",
}

export type BassPattern = {
  steps: Step[];
  tag: {
    bassBase: BassBase;
    timeSignature: TimeSignature;
    type: BassPatternType;
  };
};

export type RightHandPattern = {
  timeSignature: TimeSignature;
  pattern: {
    duration: number;
    rest: boolean;
  }[];
};
