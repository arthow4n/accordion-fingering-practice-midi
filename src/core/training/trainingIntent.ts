import { z } from "zod";
import { defaultTimingSettings, timingSettingsSchema } from "../performance/timingSettings";
import type { TrainingIntent } from "../model";
const meterSchema = z.object({ beats: z.number().int().min(2).max(6), beatUnit: z.union([z.literal(4), z.literal(8)]) });
const rangeSchema = z.object({ low: z.number().int().min(0).max(127), high: z.number().int().min(0).max(127) }).refine((x) => x.low <= x.high);
const intentSchema = z.enum(["general","noteRecognition","patternsIntervals","rhythm","leftHand","coordination"]);
const jumpFrequencySchema = z.enum(["none","occasional","frequent"]);
export const trainingRequestSchema = z.object({
  version: z.literal(3),
  timing: timingSettingsSchema.default(defaultTimingSettings),
  hands: z.enum(["both","right","left"]).default("both"),
  pitchRegister: z.enum(["rotating","low","middle","high","custom"]).default("rotating"),
  intent: intentSchema,
  mix: z.array(z.object({ intent: intentSchema, weight: z.number().positive() })).optional(),
  tonal: z.object({ keys: z.array(z.string()).min(1), selection: z.enum(["fixed","random","weighted"]), modePolicy: z.enum(["major","minor","both"]), chromaticism: z.number().min(0).max(1) }),
  patterns: z.object({ allowedFamilies: z.array(z.string()).min(1), targetFamilies: z.array(z.string()), targetDensity: z.number().min(0).max(1), repetition: z.number().min(0).max(1), variation: z.number().min(0).max(1), sequenceProbability: z.number().min(0).max(1) }),
  rhythm: z.object({ meters: z.array(meterSchema).min(1), smallestSubdivision: z.enum(["quarter","eighth","sixteenth"]), syncopation: z.number().min(0).max(1), restDensity: z.number().min(0).max(1), tieDensity: z.number().min(0).max(1), noteDensity: z.number().min(0).max(1) }),
  harmony: z.object({ progressionVocabulary: z.array(z.string()).min(1), chordVocabulary: z.array(z.enum(["major","minor","dominant7","diminished"])) }),
  rightHand: z.object({ range: rangeSchema, movementDifficulty: z.number().min(0).max(1), jumpFrequency: jumpFrequencySchema.default("none"), jumpSize: z.enum(["small","medium","large","octave","beyondOctave"]).default("medium"), maxJump: z.number().int().min(0).max(36).default(12), maxAccidentalsPerExercise: z.number().int().min(0).max(64).default(2) }),
  leftHand: z.object({ enabled: z.boolean(), accompanimentStyle: z.enum(["bassChord","alternatingBass","polka","waltz","tango","swing"]), movementDifficulty: z.number().min(0).max(1), jumpFrequency: jumpFrequencySchema.default("none"), jumpSize: z.enum(["nearby","moderate","large","veryLarge"]).default("moderate"), maxJump: z.number().int().min(0).max(11).default(5), bassRootLow: z.enum(["Ab","Eb","Bb","F","C","G","D","A","E","B"]).default("Ab"), bassRootHigh: z.enum(["Ab","Eb","Bb","F","C","G","D","A","E","B"]).default("B"), templateId: z.enum(["legacy-tonic-pedal-descending","legacy-transition-to-IV","legacy-bb-fdim-line"]).optional() }),
  coordination: z.object({ difficulty: z.number().min(0).max(1) }),
  challenge: z.object({ density: z.number().min(0).max(1), allowedTypes: z.array(z.enum(["largeLeap","chromatic","unfamiliarRhythm","syncopation","bassJump","handIndependence","unpredictable"])) }),
  tempoBpm: z.number().int().min(30).max(240), measures: z.number().int().min(2).max(32), seed: z.number().int().optional(),
});
export type TrainingRequest = z.infer<typeof trainingRequestSchema>;
const legacyIntent:Record<string,TrainingIntent>={balanced:"general",patternFocus:"patternsIntervals",keyFluency:"general",rhythmFocus:"rhythm",pitchIntervalFocus:"patternsIntervals",readAhead:"general",leftHandFocus:"leftHand",coordination:"coordination",randomDecoding:"noteRecognition"};
export const parseTrainingRequest = (input: unknown) => {
 const migrated=structuredClone(input) as Record<string,unknown>;
 if(migrated&&typeof migrated==="object"){
  if(typeof migrated.intent==="string")migrated.intent=legacyIntent[migrated.intent]??migrated.intent;
  if(Array.isArray(migrated.mix))migrated.mix=migrated.mix.map(item=>{if(!item||typeof item!=="object")return item;const entry={...(item as Record<string,unknown>)};if(typeof entry.intent==="string")entry.intent=legacyIntent[entry.intent]??entry.intent;return entry;});
 }
 const parsed=trainingRequestSchema.parse(migrated);
 if(parsed.intent==="noteRecognition"&&parsed.hands==="left")parsed.hands="right";
 return parsed;
};
export const defaultTrainingRequest = (): TrainingRequest => ({
  version:3, timing:defaultTimingSettings(), hands:"both", pitchRegister:"rotating", intent:"general", tonal:{keys:["C major","G major","F major","D major"],selection:"random",modePolicy:"both",chromaticism:.03},
  patterns:{allowedFamilies:["repeated","scale","thirds","triad","arpeggio","neighbor","passing","leapRecovery","sequence","cadence","chordTone"],targetFamilies:[],targetDensity:.35,repetition:.55,variation:.35,sequenceProbability:.25},
  rhythm:{meters:[{beats:4,beatUnit:4}],smallestSubdivision:"eighth",syncopation:.1,restDensity:.05,tieDensity:.05,noteDensity:.55},
  harmony:{progressionVocabulary:["I-I-V-I","I-IV-V-I","I-vi-IV-V","I-ii-V7-I"],chordVocabulary:["major","minor","dominant7","diminished"]},
  rightHand:{range:{low:55,high:91},movementDifficulty:.4,jumpFrequency:"none",jumpSize:"medium",maxJump:12,maxAccidentalsPerExercise:2},leftHand:{enabled:true,accompanimentStyle:"bassChord",movementDifficulty:.35,jumpFrequency:"none",jumpSize:"moderate",maxJump:5,bassRootLow:"Ab",bassRootHigh:"B"},coordination:{difficulty:.3},
  challenge:{density:.06,allowedTypes:["largeLeap","chromatic","syncopation","bassJump","handIndependence"]},tempoBpm:72,measures:4,
});
export const defaultRuntimeMode = (intent: TrainingIntent): "correction" | "sightReading" => intent === "noteRecognition" ? "correction" : "sightReading";
