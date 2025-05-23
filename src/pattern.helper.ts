import {
  BassBase,
  BassBaseRoot,
  BassPattern,
  BassPatternType,
  Note,
  NoteString,
  RightHandPattern,
  Step,
  TimeSignature,
} from "./type";

export const noteToString = (note: Note): NoteString => {
  return `${note.letter}${note.accidental ?? ""}${note.octave}`;
};

export const noteStringToNote = (noteString: NoteString): Note => {
  const [, letter, accidental, octaveString] = noteString.match(
    /^(A|B|C|D|E|F|G)(|#|b)([0-9])$/,
  )!;
  return {
    letter: letter as Note["letter"],
    accidental: accidental as Note["accidental"],
    octave: parseInt(octaveString, 10) as Note["octave"],
  };
};

export const rightHandNotesRangeAsString: NoteString[] = [
  "G3",
  "G#3",
  "A3",
  "A#3",
  "B3",
  "C4",
  "C#4",
  "D4",
  "D#4",
  "E4",
  "F4",
  "F#4",
  "G4",
  "G#4",
  "A4",
  "A#4",
  "B4",
  "C5",
  "C#5",
  "D5",
  "D#5",
  "E5",
  "F5",
  "F#5",
  "G5",
  "G#5",
  "A5",
  "A#5",
  "B5",
  "C6",
  "C#6",
  "D6",
  "D#6",
  "E6",
  "F6",
  "F#6",
  "G6",
];

export const rightHandNotesRange: Note[] =
  rightHandNotesRangeAsString.map(noteStringToNote);

export const bassKeyRange: BassBaseRoot[] = [
  "Ab",
  "Eb",
  "Bb",
  "F",
  "C",
  "G",
  "D",
  "A",
  "E",
  "B",
];

export const getBassBaseRoot = (bassBase: BassBase) => {
  const [, bassBaseRoot] = bassBase.match(/^([ABCDEFG][#b]?)/)!;
  return bassBaseRoot as BassBaseRoot;
};

export const createBassPattern = (
  bassBase: BassBase,
  top: TimeSignature["top"],
  bottom: TimeSignature["bottom"],
  type: BassPatternType,
  patternString: string,
): BassPattern => {
  const stepStrings = patternString.split(" ");

  const steps = stepStrings.map((stepString): Step => {
    const [, duration, accompaniment, notesString] = stepString.match(
      /^([0-9]+?)[(](?:<(.+?)>)?(.+?)[)]$/,
    )!;

    return {
      accompaniment: accompaniment ?? null,
      duration: parseInt(duration, 10),
      rest: notesString === "z",
      notes:
        notesString === "z"
          ? []
          : notesString
              .split(",")
              .map((x) => noteStringToNote(x as NoteString)),
    };
  });

  return {
    steps,
    tag: {
      bassBase,
      timeSignature: {
        top,
        bottom,
      },
      type,
    },
  };
};

export const createRightHandPattern = (
  top: TimeSignature["top"],
  bottom: TimeSignature["bottom"],
  patternString: string,
): RightHandPattern => {
  const pattern = patternString.split(" ").map(
    (
      stepString,
    ): {
      duration: number;
      rest: boolean;
    } => {
      const [, duration, rest] = stepString.match(/^([0-9]+)(z)?$/)!;
      return {
        duration: parseInt(duration, 10),
        rest: rest === "z",
      };
    },
  );

  return {
    timeSignature: {
      top,
      bottom,
    },
    pattern,
  };
};
