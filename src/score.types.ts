import { immerable } from "immer";
import { ensureNotNullish } from "./utils";

const rootNotes = ["c", "d", "e", "f", "g", "a", "b"] as const;
const accidentals = ["bb", "b", "n", "#", "##"] as const;
const octaves = [1, 2, 3, 4, 5, 6, 7] as const;

const durations = [1, 2, 4, 8, 16] as const;
export type Duration = `${(typeof durations)[number]}`;

type RootNote = (typeof rootNotes)[number];
type Accidental = (typeof accidentals)[number];
type Octave = (typeof octaves)[number];

export type Key = `${RootNote}${Accidental | ""}/${Octave}`;
export type KeysWithDuration = {
  readonly keys: Key[];
  readonly bass: Bass;
  readonly duration: Duration;

  isCurrentProgress?: boolean;
};
type KeysWithDurationAndBassPattern = KeysWithDuration & {
  bassPatternKeys: Key[];
  bassDisplayName: string | null;
};

// I don't really know what's the correct name for this.
const chordVariants = ["", "m", "7"] as const;
type ChordVariant = (typeof chordVariants)[number];
const chordVariantAlternatives = ["Normal", "Alt"] as const;
type ChordVariantAlternative = (typeof chordVariantAlternatives)[number];
type Chord = `${Uppercase<RootNote>}${Accidental | ""}${ChordVariant}`;

const timeSignatures = ["3/4", "4/4"] as const;
type TimeSignature = (typeof timeSignatures)[number];

export type Bass = `${Chord}_${TimeSignature}_${ChordVariantAlternative}`;
export type ParsedBass = {
  chord: Chord;
  timeSignature: TimeSignature;
  variant: ChordVariantAlternative;
  raw: Bass;
};
export const parseBass = (raw: Bass) => {
  const [chord, timeSignature, variant] = raw.split("_");

  return {
    chord,
    timeSignature,
    variant,
    raw,
  } as ParsedBass;
};

type BassPattern = Key[][];
export const bassPatternMapping: Partial<Record<Bass, BassPattern>> = {
  "Bb_3/4_Normal": [["a#/3"], ["a#/2", "d/3", "f/3"], ["a#/2", "d/3", "f/3"]],
  "Bb_3/4_Alt": [["f/3"], ["a#/2", "d/3", "f/3"], ["a#/2", "d/3", "f/3"]],

  "Bbm_3/4_Normal": [["a#/3"], ["a#/2", "d/3", "f/3"], ["a#/2", "d/3", "f/3"]],
  "Bbm_3/4_Alt": [["f/3"], ["a#/2", "d/3", "f/3"], ["a#/2", "d/3", "f/3"]],

  "Bb7_3/4_Normal": [
    ["a#/3"],
    ["a#/2", "d/3", "g#/3", "f/3"],
    ["a#/2", "d/3", "g#/3", "f/3"],
  ],
  "Bb7_3/4_Alt": [
    ["f/3"],
    ["a#/2", "d/3", "g#/3", "f/3"],
    ["a#/2", "d/3", "g#/3", "f/3"],
  ],

  "F_3/4_Normal": [["f/3"], ["f/2", "a/3", "c/3"], ["f/2", "a/3", "c/3"]],
  "F_3/4_Alt": [["c/3"], ["f/2", "a/3", "c/3"], ["f/2", "a/3", "c/3"]],

  "Fm_3/4_Normal": [["f/3"], ["f/2", "g#/3", "c/3"], ["f/2", "g#/3", "c/3"]],
  "Fm_3/4_Alt": [["c/3"], ["f/2", "g#/3", "c/3"], ["f/2", "g#/3", "c/3"]],

  "F7_3/4_Normal": [
    ["f/3"],
    ["f/2", "g#/3", "c/3", "a/3", "d#/3"],
    ["f/2", "g#/3", "c/3", "a/3", "d#/3"],
  ],
  "F7_3/4_Alt": [
    ["c/3"],
    ["f/2", "g#/3", "c/3", "a/3", "d#/3"],
    ["f/2", "g#/3", "c/3", "a/3", "d#/3"],
  ],

  "C_3/4_Normal": [["c/3"], ["c/3", "e/3", "g/3"], ["c/3", "e/3", "g/3"]],
  "C_3/4_Alt": [["g/3"], ["c/3", "e/3", "g/3"], ["c/3", "e/3", "g/3"]],

  "Cm_3/4_Normal": [["c/3"], ["c/3", "d#/3", "g/3"], ["c/3", "d#/3", "g/3"]],
  "Cm_3/4_Alt": [["g/3"], ["c/3", "d#/3", "g/3"], ["c/3", "d#/3", "g/3"]],

  "C7_3/4_Normal": [
    ["c/3"],
    ["c/3", "e/3", "a#/3", "g/3"],
    ["c/3", "e/3", "a#/3", "g/3"],
  ],
  "C7_3/4_Alt": [
    ["g/3"],
    ["c/3", "e/3", "a#/3", "g/3"],
    ["c/3", "e/3", "a#/3", "g/3"],
  ],

  "G_3/4_Normal": [["g/3"], ["g/2", "b/3", "d/3"], ["g/2", "b/3", "d/3"]],
  "G_3/4_Alt": [["d/3"], ["g/2", "b/3", "d/3"], ["g/2", "b/3", "d/3"]],

  "Gm_3/4_Normal": [["g/3"], ["g/2", "a#/3", "d/3"], ["g/2", "a#/3", "d/3"]],
  "Gm_3/4_Alt": [["d/3"], ["g/2", "a#/3", "d/3"], ["g/2", "a#/3", "d/3"]],

  "G7_3/4_Normal": [
    ["g/3"],
    ["g/2", "b/3", "f/3", "d/3"],
    ["g/2", "b/3", "f/3", "d/3"],
  ],
  "G7_3/4_Alt": [
    ["d/3"],
    ["g/2", "b/3", "f/3", "d/3"],
    ["g/2", "b/3", "f/3", "d/3"],
  ],

  "D_3/4_Normal": [["d/3"], ["d/3", "f#/3", "a/3"], ["d/3", "f#/3", "a/3"]],
  "D_3/4_Alt": [["a/3"], ["d/3", "f#/3", "a/3"], ["d/3", "f#/3", "a/3"]],

  "Dm_3/4_Normal": [["d/3"], ["d/3", "f/3", "a/3"], ["d/3", "f/3", "a/3"]],
  "Dm_3/4_Alt": [["a/3"], ["d/3", "f/3", "a/3"], ["d/3", "f/3", "a/3"]],

  "D7_3/4_Normal": [
    ["d/3"],
    ["d/2", "f#/3", "c/3", "a/3"],
    ["d/2", "f#/3", "c/3", "a/3"],
  ],
  "D7_3/4_Alt": [
    ["a/3"],
    ["d/2", "f#/3", "c/3", "a/3"],
    ["d/2", "f#/3", "c/3", "a/3"],
  ],

  "A_3/4_Normal": [["a/3"], ["a/2", "c#/3", "e/3"], ["a/2", "c#/3", "e/3"]],
  "A_3/4_Alt": [["e/3"], ["a/2", "c#/3", "e/3"], ["a/2", "c#/3", "e/3"]],

  "Am_3/4_Normal": [["a/3"], ["a/2", "c/3", "e/3"], ["a/2", "c/3", "e/3"]],
  "Am_3/4_Alt": [["e/3"], ["a/2", "c/3", "e/3"], ["a/2", "c/3", "e/3"]],

  "A7_3/4_Normal": [
    ["a/3"],
    ["a/2", "c#/3", "g/3", "e/3"],
    ["a/2", "c#/3", "g/3", "e/3"],
  ],
  "A7_3/4_Alt": [
    ["e/3"],
    ["a/2", "c#/3", "g/3", "e/3"],
    ["a/2", "c#/3", "g/3", "e/3"],
  ],

  "E_3/4_Normal": [["e/3"], ["e/3", "g#/3", "b/3"], ["e/3", "g#/3", "b/3"]],
  "E_3/4_Alt": [["b/3"], ["e/3", "g#/3", "b/3"], ["e/3", "g#/3", "b/3"]],

  "Em_3/4_Normal": [["e/3"], ["e/3", "g/3", "b/3"], ["e/3", "g/3", "b/3"]],
  "Em_3/4_Alt": [["b/3"], ["e/3", "g/3", "b/3"], ["e/3", "g/3", "b/3"]],

  "E7_3/4_Normal": [
    ["e/3"],
    ["e/2", "g#/3", "d/3", "b/3"],
    ["e/2", "g#/3", "d/3", "b/3"],
  ],
  "E7_3/4_Alt": [
    ["b/3"],
    ["e/2", "g#/3", "d/3", "b/3"],
    ["e/2", "g#/3", "d/3", "b/3"],
  ],
};

export const supportedBasses = Object.keys(bassPatternMapping) as Bass[];

export type MeasureProps = {
  notes: KeysWithDuration[];
};

// Forgot exactly why I made this a class to begin with, probably change it back to plain object later on.
export class Measure implements MeasureProps {
  [immerable] = true;

  readonly timeSignature: string;
  readonly bassPattern: BassPattern;
  readonly notes: KeysWithDurationAndBassPattern[];

  static fromPropsList(measures: MeasureProps[]) {
    return measures.map((m) => new Measure(m));
  }

  constructor(props: MeasureProps) {
    const bass = props.notes[0].bass;
    const { chord, timeSignature, variant } = parseBass(bass);
    this.timeSignature = timeSignature;
    this.bassPattern = ensureNotNullish(bassPatternMapping[bass]);

    this.notes = props.notes.map((note, index) => {
      const bassPatternKeys = this.bassPattern[index];
      const bassDisplayName =
        index !== 0
          ? null
          : chord +
            // TODO: Don't show bass name for alternative bass?
            (variant === "Alt" ? "*" : "");

      return {
        ...note,
        bassPatternKeys,
        bassDisplayName,
      };
    });
  }
}
