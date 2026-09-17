import type { PatternFamily, PatternTransformation } from "../model";
export type MelodicPattern = { id: string; family: PatternFamily; relativeDegrees: readonly number[]; complexity: number };
export const MELODIC_PATTERNS: readonly MelodicPattern[] = [
  { id: "repeated-note", family: "repeated", relativeDegrees: [0,0,0,0], complexity: .05 },
  { id: "scale-3-up", family: "scale", relativeDegrees: [0,1,2,1], complexity: .15 },
  { id: "scale-3-down", family: "scale", relativeDegrees: [0,-1,-2,-1], complexity: .15 },
  { id: "scale-5-up", family: "scale", relativeDegrees: [0,1,2,3,4], complexity: .2 },
  { id: "scale-5-down", family: "scale", relativeDegrees: [0,-1,-2,-3,-4], complexity: .2 },
  { id: "thirds-up", family: "thirds", relativeDegrees: [0,2,1,3], complexity: .4 },
  { id: "thirds-down", family: "thirds", relativeDegrees: [0,-2,-1,-3], complexity: .4 },
  { id: "broken-triad", family: "triad", relativeDegrees: [0,2,4,2], complexity: .35 },
  { id: "triad-up-down", family: "triad", relativeDegrees: [0,2,4,2,0], complexity: .4 },
  { id: "arpeggio-fragment", family: "arpeggio", relativeDegrees: [0,2,4,7], complexity: .55 },
  { id: "upper-neighbor", family: "neighbor", relativeDegrees: [0,1,0,-1], complexity: .2 },
  { id: "lower-neighbor", family: "neighbor", relativeDegrees: [0,-1,0,1], complexity: .2 },
  { id: "passing-up", family: "passing", relativeDegrees: [0,1,2,3], complexity: .2 },
  { id: "leap-step-recovery", family: "leapRecovery", relativeDegrees: [0,4,3,2], complexity: .6 },
  { id: "sequence-up", family: "sequence", relativeDegrees: [0,1,2,1,2,3], complexity: .45 },
  { id: "sequence-down", family: "sequence", relativeDegrees: [0,-1,-2,-1,-2,-3], complexity: .45 },
  { id: "cadence-2-7-1", family: "cadence", relativeDegrees: [1,0,-1,0], complexity: .25 },
  { id: "chord-tone-turn", family: "chordTone", relativeDegrees: [0,2,1,0], complexity: .3 },
];
export const transformPattern = (degrees: readonly number[], transformation: PatternTransformation): number[] => {
  if (transformation === "sequenceUp") return degrees.map((x) => x + 1);
  if (transformation === "sequenceDown") return degrees.map((x) => x - 1);
  if (transformation === "changedEnding") return degrees.map((x, i) => i === degrees.length - 1 ? 0 : x);
  if (transformation === "shortened") return degrees.slice(0, Math.max(2, degrees.length - 1));
  if (transformation === "extended") return [...degrees, degrees.at(-1) ?? 0, 0];
  return [...degrees];
};
