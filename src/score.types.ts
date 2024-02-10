import { ensureNotNullish } from "./utils";

const rootNotes = ["c", "d", "e", "f", "g", "a", "b"] as const;
const accidentals = ["bb", "b", "n", "#", "##"] as const;
const octaves = [1, 2, 3, 4, 5, 6, 7] as const;

const durations = [1, 2, 4, 8, 16] as const;
type Duration = `${(typeof durations)[number]}`;

type RootNote = (typeof rootNotes)[number];
type Accidental = (typeof accidentals)[number];
type Octave = (typeof octaves)[number];

type Key = `${RootNote}${Accidental | ""}/${Octave}`;
type KeysWithDuration = {
  keys: Key[];
  duration: Duration;
};

// I don't really know what's the correct name for this.
const chordVariants = ["", "m", "7"] as const;
type ChordVariant = (typeof chordVariants)[number];
const chordVariantAlternatives = ["Normal", "Alt"] as const;
type ChordVariantAlternative = (typeof chordVariantAlternatives)[number];
type Chord = `${Uppercase<RootNote>}${ChordVariant}`;

const timeSignatures = ["3/4", "4/4"] as const;
type TimeSignature = (typeof timeSignatures)[number];

type Bass = `${Chord}_${TimeSignature}_${ChordVariantAlternative}`;

type BassPattern = Key[][];
export const bassPatternMapping: Partial<Record<Bass, BassPattern>> = {
  "C_3/4_Normal": [["c/3"], ["c/3", "e/3", "g/3"], ["c/3", "e/3", "g/3"]],
  "C_3/4_Alt": [["g/3"], ["c/3", "e/3", "g/3"], ["c/3", "e/3", "g/3"]],
};

export type MeasureProps = {
  bass: Bass;
  notes: KeysWithDuration[];
};

export class Measure {
  timeSignature: string;
  bassDisplayName: string | null;
  bassPattern: BassPattern;
  notes: KeysWithDuration[];

  constructor(props: MeasureProps) {
    const bassSyntaxSplitted = props.bass.split("_");
    this.timeSignature = bassSyntaxSplitted[1];
    this.bassDisplayName =
      bassSyntaxSplitted[0] +
      // TODO: Don't show bass name for alternative bass?
      (bassSyntaxSplitted[2] === "Alt" ? "*" : "");

    this.bassPattern = ensureNotNullish(bassPatternMapping[props.bass]);
    this.notes = props.notes;
  }
}
