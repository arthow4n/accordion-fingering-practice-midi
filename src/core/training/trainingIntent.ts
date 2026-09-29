import { z } from "zod";
import { defaultTimingSettings, timingSettingsSchema } from "../performance/timingSettings";
import type { RightHandEmphasis } from "../model";
import { STRADELLA_ROOTS } from "../instrument/stradella";

const meterSchema = z.object({ beats: z.number().int().min(2).max(6), beatUnit: z.union([z.literal(4), z.literal(8)]) });
const rangeSchema = z.object({ low: z.number().int().min(0).max(127), high: z.number().int().min(0).max(127) }).refine((x) => x.low <= x.high);
const jumpFrequencySchema = z.enum(["none","occasional","frequent"]);
export const emphasisSchema = z.enum(["everything","melodicPatterns","intervals","arpeggios","cadencesApproaches","rhythm"]);

export const trainingRequestSchema = z.object({
  version: z.literal(3),
  timing: timingSettingsSchema.default(defaultTimingSettings),
  hands: z.enum(["both","right","left"]).default("both"),
  pitchRegister: z.enum(["rotating","low","middle","high","custom"]).default("rotating"),
  emphasis: emphasisSchema.default("everything"),
  tonal: z.object({ keys: z.array(z.string()).min(1), selection: z.enum(["fixed","random","weighted"]), modePolicy: z.enum(["major","minor","both"]), chromaticism: z.number().min(0).max(1) }),
  patterns: z.object({ allowedFamilies: z.array(z.string()).min(1), targetFamilies: z.array(z.string()), targetDensity: z.number().min(0).max(1), repetition: z.number().min(0).max(1), variation: z.number().min(0).max(1), sequenceProbability: z.number().min(0).max(1) }).default({
    allowedFamilies: ["repeated","scale","thirds","triad","arpeggio","neighbor","passing","leapRecovery","sequence","cadence","chordTone"],
    targetFamilies: [],
    targetDensity: 0.35,
    repetition: 0.55,
    variation: 0.35,
    sequenceProbability: 0.25,
  }),
  rhythm: z.object({ meters: z.array(meterSchema).min(1), noteValue: z.enum(["half","quarter","eighth","sixteenth"]), style: z.enum(["steady","mostlySteady","mixed","challenge"]), smallestSubdivision: z.enum(["quarter","eighth","sixteenth"]), syncopation: z.number().min(0).max(1), restDensity: z.number().min(0).max(1), tieDensity: z.number().min(0).max(1), noteDensity: z.number().min(0).max(1) }),
  harmony: z.object({ progressionVocabulary: z.array(z.string()).min(1), chordVocabulary: z.array(z.enum(["major","minor","dominant7","diminished"])) }),
  rightHand: z.object({ range: rangeSchema, maxAccidentalsPerExercise: z.number().int().min(0).max(64).default(2) }),
  leftHand: z.object({ enabled: z.boolean(), accompanimentStyle: z.enum(["bassChord","alternatingBass","polka","waltz","tango","swing"]), movementDifficulty: z.number().min(0).max(1), jumpFrequency: jumpFrequencySchema.default("none"), jumpSize: z.enum(["nearby","moderate","large","veryLarge"]).default("moderate"), maxJump: z.number().int().min(0).max(11).default(5), bassRootLow: z.enum(STRADELLA_ROOTS).default("Db"), bassRootHigh: z.enum(STRADELLA_ROOTS).default("F#"), templateId: z.enum(["legacy-tonic-pedal-descending","legacy-transition-to-IV","legacy-bb-fdim-line"]).optional() }),
  coordination: z.object({ difficulty: z.number().min(0).max(1) }).default({ difficulty: 0.3 }),
  challenge: z.object({ density: z.number().min(0).max(1), allowedTypes: z.array(z.enum(["largeLeap","chromatic","unfamiliarRhythm","syncopation","bassJump","handIndependence","unpredictable"])) }).default({ density: 0.06, allowedTypes: ["largeLeap","chromatic","syncopation","bassJump","handIndependence"] }),
  sessionProgression: z.enum(["progressive", "independent"]).default("independent"),
  tempoBpm: z.number().int().min(30).max(240), measures: z.number().int().min(2).max(32), seed: z.number().int().optional(),
});
export type TrainingRequest = z.infer<typeof trainingRequestSchema>;

const legacyIntentToEmphasis: Record<string, RightHandEmphasis> = {
  general: "everything",
  balanced: "everything",
  readAhead: "everything",
  keyFluency: "everything",
  noteRecognition: "everything",
  randomDecoding: "everything",
  leftHand: "everything",
  leftHandFocus: "everything",
  coordination: "everything",
  patternsIntervals: "melodicPatterns",
  patternFocus: "melodicPatterns",
  pitchIntervalFocus: "melodicPatterns",
  rhythm: "rhythm",
  rhythmFocus: "rhythm",
};

export const parseTrainingRequest = (input: unknown): TrainingRequest => {
  const migrated = structuredClone(input) as Record<string, unknown>;
  if (migrated && typeof migrated === "object") {
    if (typeof migrated.intent === "string") {
      const legacy = migrated.intent;
      migrated.emphasis = legacyIntentToEmphasis[legacy] ?? "everything";
      if (legacy === "noteRecognition" || legacy === "randomDecoding") {
        migrated.hands = "right";
      } else if (legacy === "coordination") {
        migrated.hands = "both";
      }
      delete migrated.intent;
    }
    if ("mix" in migrated) {
      delete migrated.mix;
    }
    const rh = migrated.rightHand as Record<string, unknown> | undefined;
    if (rh && typeof rh === "object") {
      delete rh.movementDifficulty;
      delete rh.jumpFrequency;
      delete rh.jumpSize;
      delete rh.maxJump;
    }
    const rhythm = migrated.rhythm as Record<string, unknown> | undefined;
    if (rhythm && typeof rhythm === "object") {
      if (!rhythm.noteValue) rhythm.noteValue = rhythm.smallestSubdivision === "sixteenth" ? "sixteenth" : rhythm.smallestSubdivision === "quarter" ? "quarter" : "eighth";
      if (!rhythm.style) rhythm.style = "mixed";
    }
  }
  const parsed = trainingRequestSchema.parse(migrated);
  return parsed;
};

export const defaultTrainingRequest = (): TrainingRequest => ({
  version: 3,
  timing: defaultTimingSettings(),
  hands: "both",
  pitchRegister: "rotating",
  emphasis: "everything",
  tonal: { keys: ["C major", "G major", "F major", "D major"], selection: "random", modePolicy: "both", chromaticism: 0.03 },
  patterns: { allowedFamilies: ["repeated", "scale", "thirds", "triad", "arpeggio", "neighbor", "passing", "leapRecovery", "sequence", "cadence", "chordTone"], targetFamilies: [], targetDensity: 0.35, repetition: 0.55, variation: 0.35, sequenceProbability: 0.25 },
  rhythm: { meters: [{ beats: 4, beatUnit: 4 }], noteValue: "eighth", style: "mostlySteady", smallestSubdivision: "eighth", syncopation: 0.1, restDensity: 0.05, tieDensity: 0.05, noteDensity: 0.55 },
  harmony: { progressionVocabulary: ["I-I-V-I", "I-IV-V-I", "I-vi-IV-V", "I-ii-V7-I"], chordVocabulary: ["major", "minor", "dominant7", "diminished"] },
  rightHand: { range: { low: 55, high: 91 }, maxAccidentalsPerExercise: 2 },
  leftHand: { enabled: true, accompanimentStyle: "bassChord", movementDifficulty: 0.35, jumpFrequency: "none", jumpSize: "moderate", maxJump: 5, bassRootLow: "Db", bassRootHigh: "F#" },
  coordination: { difficulty: 0.3 },
  challenge: { density: 0.06, allowedTypes: ["largeLeap", "chromatic", "syncopation", "bassJump", "handIndependence"] },
  sessionProgression: "independent",
  tempoBpm: 72,
  measures: 4,
});

export const defaultRuntimeMode = (intent?: string): "correction" | "sightReading" =>
  intent === "noteRecognition" || intent === "randomDecoding" ? "correction" : "sightReading";
