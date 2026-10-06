import type { HarmonyEvent, NoteRole, PatternCategory, PatternFamily, PatternTransformation, Pitch, PitchRange, ScaleDegree, ScaleDegreeNumber, TonalContext } from "../model";
import { realizeScaleDegree } from "../music/key";

export type MelodicPattern = {
  id: string;
  family: PatternFamily;
  category: PatternCategory;
  relativeDegrees: readonly number[];
  complexity: number;
};

export interface GeneratedPatternNote {
  degree: ScaleDegree;
  pitch: Pitch;
  role: NoteRole;
  chromatic?: boolean;
  chromaticRole?: string;
}

export const MELODIC_PATTERNS: readonly MelodicPattern[] = [
  // Scalar & sequential (melodicPatterns)
  { id: "scale-ascending", family: "scale", category: "melodicPatterns", relativeDegrees: [0,1,2,3,4,5,6,7], complexity: .2 },
  { id: "scale-descending", family: "scale", category: "melodicPatterns", relativeDegrees: [0,-1,-2,-3,-4,-5,-6,-7], complexity: .2 },
  { id: "scale-asc-desc", family: "scale", category: "melodicPatterns", relativeDegrees: [0,1,2,3,4,3,2,1], complexity: .25 },
  { id: "scale-desc-asc", family: "scale", category: "melodicPatterns", relativeDegrees: [0,-1,-2,-3,-4,-3,-2,-1], complexity: .25 },
  { id: "scale-groups-3-up", family: "scale", category: "melodicPatterns", relativeDegrees: [0,1,2,1,2,3,2,3], complexity: .35 },
  { id: "scale-groups-3-down", family: "scale", category: "melodicPatterns", relativeDegrees: [0,-1,-2,-1,-2,-3,-2,-3], complexity: .35 },
  { id: "scale-groups-4-up", family: "scale", category: "melodicPatterns", relativeDegrees: [0,1,2,3,1,2,3,4], complexity: .35 },
  { id: "scale-groups-4-down", family: "scale", category: "melodicPatterns", relativeDegrees: [0,-1,-2,-3,-1,-2,-3,-4], complexity: .35 },
  { id: "sequence-1-2-3-1", family: "sequence", category: "melodicPatterns", relativeDegrees: [0,1,2,0,1,2,3,1], complexity: .35 },
  { id: "sequence-1-2-3-5", family: "sequence", category: "melodicPatterns", relativeDegrees: [0,1,2,4,1,2,3,5], complexity: .4 },
  { id: "sequence-1-3-2-4", family: "sequence", category: "melodicPatterns", relativeDegrees: [0,2,1,3,1,3,2,4], complexity: .45 },
  { id: "continuous-thirds-up", family: "thirds", category: "melodicPatterns", relativeDegrees: [0,2,1,3,2,4,3,5], complexity: .4 },
  { id: "continuous-thirds-down", family: "thirds", category: "melodicPatterns", relativeDegrees: [0,-2,-1,-3,-2,-4,-3,-5], complexity: .4 },
  { id: "continuous-fourths-up", family: "sequence", category: "melodicPatterns", relativeDegrees: [0,3,1,4,2,5,3,6], complexity: .45 },
  { id: "continuous-fourths-down", family: "sequence", category: "melodicPatterns", relativeDegrees: [0,-3,-1,-4,-2,-5,-3,-6], complexity: .45 },
  { id: "continuous-fifths-up", family: "sequence", category: "melodicPatterns", relativeDegrees: [0,4,1,5,2,6,3,7], complexity: .5 },
  { id: "continuous-fifths-down", family: "sequence", category: "melodicPatterns", relativeDegrees: [0,-4,-1,-5,-2,-6,-3,-7], complexity: .5 },
  { id: "continuous-sixths-up", family: "sequence", category: "melodicPatterns", relativeDegrees: [0,5,1,6,2,7,3,8], complexity: .55 },
  { id: "continuous-sixths-down", family: "sequence", category: "melodicPatterns", relativeDegrees: [0,-5,-1,-6,-2,-7,-3,-8], complexity: .55 },
  { id: "octave-scale-run", family: "scale", category: "melodicPatterns", relativeDegrees: [0,1,2,3,4,5,6,7,8], complexity: .3 },

  // Melodic intervals (intervals)
  { id: "interval-ascending-chain", family: "leapRecovery", category: "intervals", relativeDegrees: [0,2,1,4,2,5,3,7], complexity: .5 },
  { id: "interval-descending-chain", family: "leapRecovery", category: "intervals", relativeDegrees: [0,-2,-1,-4,-2,-5,-3,-7], complexity: .5 },
  { id: "interval-alternating-chain", family: "leapRecovery", category: "intervals", relativeDegrees: [0,4,1,5,0,4,1,5], complexity: .55 },
  { id: "interval-repeated-figure", family: "leapRecovery", category: "intervals", relativeDegrees: [0,4,0,4,0,4,0,4], complexity: .35 },
  { id: "interval-leap-and-recovery", family: "leapRecovery", category: "intervals", relativeDegrees: [0,5,4,3,2,6,5,4], complexity: .6 },
  { id: "interval-step-then-leap", family: "leapRecovery", category: "intervals", relativeDegrees: [0,1,2,6,1,2,3,7], complexity: .5 },

  // Chord-tone melodies & arpeggios (arpeggios)
  { id: "chord-tone-1-3-5", family: "chordTone", category: "arpeggios", relativeDegrees: [0,2,4,0], complexity: .3 },
  { id: "chord-tone-1-3-5-3", family: "chordTone", category: "arpeggios", relativeDegrees: [0,2,4,2], complexity: .3 },
  { id: "chord-tone-1-5-3-5", family: "chordTone", category: "arpeggios", relativeDegrees: [0,4,2,4], complexity: .35 },
  { id: "chord-tone-3-5-1", family: "chordTone", category: "arpeggios", relativeDegrees: [2,4,7,2], complexity: .35 },
  { id: "chord-tone-5-3-1", family: "chordTone", category: "arpeggios", relativeDegrees: [4,2,0,4], complexity: .35 },
  { id: "chord-tone-1-3-5-8", family: "chordTone", category: "arpeggios", relativeDegrees: [0,2,4,7], complexity: .4 },
  { id: "chord-tone-3-5-1-3", family: "chordTone", category: "arpeggios", relativeDegrees: [2,4,7,9], complexity: .4 },
  { id: "chord-tone-5-1-3-5", family: "chordTone", category: "arpeggios", relativeDegrees: [4,7,9,11], complexity: .45 },
  { id: "dominant-7-run", family: "chordTone", category: "arpeggios", relativeDegrees: [0,2,4,6], complexity: .45 },
  { id: "arpeggio-1-3-5", family: "arpeggio", category: "arpeggios", relativeDegrees: [0,2,4,0], complexity: .4 },
  { id: "arpeggio-1-3-5-8", family: "arpeggio", category: "arpeggios", relativeDegrees: [0,2,4,7], complexity: .45 },
  { id: "arpeggio-1-5-3-5", family: "arpeggio", category: "arpeggios", relativeDegrees: [0,4,2,4], complexity: .4 },
  { id: "arpeggio-1-3-5-3", family: "arpeggio", category: "arpeggios", relativeDegrees: [0,2,4,2], complexity: .4 },
  { id: "arpeggio-1-5-8-5", family: "arpeggio", category: "arpeggios", relativeDegrees: [0,4,7,4], complexity: .45 },
  { id: "arpeggio-1-3-5-8-5-3", family: "arpeggio", category: "arpeggios", relativeDegrees: [0,2,4,7,4,2], complexity: .5 },
  { id: "arpeggio-triad-up", family: "arpeggio", category: "arpeggios", relativeDegrees: [0,2,4,7,9,11,14], complexity: .55 },
  { id: "arpeggio-triad-down", family: "arpeggio", category: "arpeggios", relativeDegrees: [7,4,2,0,-3,-5,-7], complexity: .55 },
  { id: "arpeggio-triad-up-down", family: "arpeggio", category: "arpeggios", relativeDegrees: [0,2,4,7,4,2,0], complexity: .5 },
  { id: "arpeggio-triad-down-up", family: "arpeggio", category: "arpeggios", relativeDegrees: [7,4,2,0,2,4,7], complexity: .5 },
  { id: "arpeggio-1-3-5-7", family: "arpeggio", category: "arpeggios", relativeDegrees: [0,2,4,6], complexity: .5 },
  { id: "arpeggio-seventh-up", family: "arpeggio", category: "arpeggios", relativeDegrees: [0,2,4,6,7,9,11,13], complexity: .6 },
  { id: "arpeggio-seventh-down", family: "arpeggio", category: "arpeggios", relativeDegrees: [13,11,9,7,6,4,2,0], complexity: .6 },

  // Cadences & approaches (cadencesApproaches)
  { id: "upper-neighbor", family: "neighbor", category: "cadencesApproaches", relativeDegrees: [0,1,0,-1], complexity: .2 },
  { id: "lower-neighbor", family: "neighbor", category: "cadencesApproaches", relativeDegrees: [0,-1,0,1], complexity: .2 },
  { id: "double-neighbor", family: "neighbor", category: "cadencesApproaches", relativeDegrees: [0,1,-1,0], complexity: .3 },
  { id: "ascending-passing", family: "passing", category: "cadencesApproaches", relativeDegrees: [0,1,2,3], complexity: .2 },
  { id: "descending-passing", family: "passing", category: "cadencesApproaches", relativeDegrees: [0,-1,-2,-3], complexity: .2 },
  { id: "chromatic-passing", family: "passing", category: "cadencesApproaches", relativeDegrees: [0,1,2,0], complexity: .4 },
  { id: "lower-chromatic-approach", family: "neighbor", category: "cadencesApproaches", relativeDegrees: [-1,0,-1,0], complexity: .35 },
  { id: "upper-chromatic-approach", family: "neighbor", category: "cadencesApproaches", relativeDegrees: [1,0,1,0], complexity: .35 },
  { id: "upper-lower-enclosure", family: "neighbor", category: "cadencesApproaches", relativeDegrees: [1,-1,0,0], complexity: .45 },
  { id: "lower-upper-enclosure", family: "neighbor", category: "cadencesApproaches", relativeDegrees: [-1,1,0,0], complexity: .45 },
  { id: "leading-tone-to-tonic", family: "cadence", category: "cadencesApproaches", relativeDegrees: [-1,0,-1,0], complexity: .25 },
  { id: "chromatic-neighbor", family: "neighbor", category: "cadencesApproaches", relativeDegrees: [0,1,0,0], complexity: .35 },
  { id: "cadence-7-1", family: "cadence", category: "cadencesApproaches", relativeDegrees: [6,7], complexity: .2 },
  { id: "cadence-2-1", family: "cadence", category: "cadencesApproaches", relativeDegrees: [1,0], complexity: .2 },
  { id: "cadence-4-3", family: "cadence", category: "cadencesApproaches", relativeDegrees: [3,2], complexity: .25 },
  { id: "cadence-2-7-1", family: "cadence", category: "cadencesApproaches", relativeDegrees: [1,-1,0], complexity: .3 },
  { id: "cadence-5-4-3", family: "cadence", category: "cadencesApproaches", relativeDegrees: [4,3,2], complexity: .3 },
  { id: "cadence-3-2-1", family: "cadence", category: "cadencesApproaches", relativeDegrees: [2,1,0], complexity: .25 },

  // Rhythm & repeated notes (rhythm)
  { id: "repeated-notes-short", family: "repeated", category: "rhythm", relativeDegrees: [0,0,0,0], complexity: .1 },
  { id: "repeated-notes-medium", family: "repeated", category: "rhythm", relativeDegrees: [0,0,0,0,0,0], complexity: .15 },
  { id: "repeated-notes-long", family: "repeated", category: "rhythm", relativeDegrees: [0,0,0,0,0,0,0,0], complexity: .2 },
  { id: "repeated-notes-embedded", family: "repeated", category: "rhythm", relativeDegrees: [0,1,1,1,2,1], complexity: .25 },
];

export const transformPattern = (degrees: readonly number[], transformation: PatternTransformation): number[] => {
  if (transformation === "sequenceUp") return degrees.map((x) => x + 1);
  if (transformation === "sequenceDown") return degrees.map((x) => x - 1);
  if (transformation === "changedEnding") return degrees.map((x, i) => (i === degrees.length - 1 ? 0 : x));
  if (transformation === "shortened") return degrees.slice(0, Math.max(2, degrees.length - 1));
  if (transformation === "extended") return [...degrees, degrees.at(-1) ?? 0, 0];
  return [...degrees];
};

export const stepToScaleDegree = (step: number, alteration = 0): ScaleDegree => {
  const wrapped = ((step % 7) + 7) % 7;
  const degree = (wrapped + 1) as ScaleDegreeNumber;
  const rawOffset = Math.floor(step / 7);
  const octaveOffset = Math.max(-3, Math.min(3, rawOffset));
  return { degree, alteration: alteration as ScaleDegree["alteration"], octaveOffset };
};

export const realizeDiatonicStep = (context: TonalContext, step: number, activeHarmony?: HarmonyEvent, alteration = 0): { degree: ScaleDegree; pitch: Pitch } => {
  let alt = alteration;
  const zero = ((step % 7) + 7) % 7;
  const oct = Math.max(-3, Math.min(3, Math.floor(step / 7)));
  const degreeNum = (zero + 1) as ScaleDegreeNumber;

  const leadingToneHarmony = activeHarmony?.rootDegree.degree === 5 ||
    (activeHarmony?.rootDegree.degree === 7 && activeHarmony.quality === "diminished" && activeHarmony.rootDegree.alteration === 1);
  if (context.mode === "minor" && degreeNum === 7 && (leadingToneHarmony || alteration === 1)) {
    alt = 1;
  }

  const degree: ScaleDegree = {
    degree: degreeNum,
    alteration: alt as ScaleDegree["alteration"],
    octaveOffset: oct,
  };
  const pitch = realizeScaleDegree(context, degree, 4);

  return { degree, pitch };
};

export const harmonicDegrees = (context: TonalContext, harmony: HarmonyEvent): ScaleDegree[] => {
  const intervals = harmony.quality === "major" ? [0, 4, 7] : harmony.quality === "minor" ? [0, 3, 7] : harmony.quality === "dominant7" ? [0, 4, 7, 10] : [0, 3, 6];
  const root = realizeScaleDegree(context, harmony.rootDegree, 4).midi;
  return intervals.map((interval, index) => {
    const wrapped = (harmony.rootDegree.degree - 1 + index * 2) % 7;
    const degree: ScaleDegree = { degree: (wrapped + 1) as ScaleDegreeNumber, alteration: 0, octaveOffset: 0 };
    const natural = realizeScaleDegree(context, degree, 4).midi;
    const delta = (((root + interval - natural + 18) % 12) - 6);
    return { ...degree, alteration: delta as ScaleDegree["alteration"] };
  });
};

export const findChordTonesInRange = (context: TonalContext, harmony: HarmonyEvent, range: PitchRange): GeneratedPatternNote[] => {
  const degrees = harmonicDegrees(context, harmony);
  const notes: GeneratedPatternNote[] = [];
  for (let oct = -2; oct <= 3; oct++) {
    for (const d of degrees) {
      const degWithOct: ScaleDegree = { ...d, octaveOffset: oct };
      const pitch = realizeScaleDegree(context, degWithOct, 4);
      if (pitch.midi >= range.low && pitch.midi <= range.high) {
        notes.push({ degree: degWithOct, pitch, role: "chord tone", chromatic: false });
      }
    }
  }
  notes.sort((a, b) => a.pitch.midi - b.pitch.midi);
  return notes.filter((n, i, arr) => i === 0 || n.pitch.midi !== arr[i - 1]!.pitch.midi);
};
