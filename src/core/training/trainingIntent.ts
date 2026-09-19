import { z } from "zod";
import type { TrainingIntent } from "../model";
const meterSchema = z.object({ beats: z.number().int().min(2).max(6), beatUnit: z.union([z.literal(4), z.literal(8)]) });
const rangeSchema = z.object({ low: z.number().int().min(0).max(127), high: z.number().int().min(0).max(127) }).refine((x) => x.low <= x.high);
export const trainingRequestSchema = z.object({
  version: z.literal(3),
  hands: z.enum(["both","right","left"]).default("both"),
  pitchRegister: z.enum(["rotating","low","middle","high","custom"]).default("rotating"),
  intent: z.enum(["balanced","patternFocus","keyFluency","rhythmFocus","pitchIntervalFocus","readAhead","leftHandFocus","coordination","randomDecoding"]),
  mix: z.array(z.object({ intent: z.enum(["balanced","patternFocus","keyFluency","rhythmFocus","pitchIntervalFocus","readAhead","leftHandFocus","coordination","randomDecoding"]), weight: z.number().positive() })).optional(),
  tonal: z.object({ keys: z.array(z.string()).min(1), selection: z.enum(["fixed","random","weighted"]), modePolicy: z.enum(["major","minor","both"]), chromaticism: z.number().min(0).max(1) }),
  patterns: z.object({ allowedFamilies: z.array(z.string()).min(1), targetFamilies: z.array(z.string()), targetDensity: z.number().min(0).max(1), repetition: z.number().min(0).max(1), variation: z.number().min(0).max(1), sequenceProbability: z.number().min(0).max(1) }),
  rhythm: z.object({ meters: z.array(meterSchema).min(1), smallestSubdivision: z.enum(["quarter","eighth","sixteenth"]), syncopation: z.number().min(0).max(1), restDensity: z.number().min(0).max(1), tieDensity: z.number().min(0).max(1), noteDensity: z.number().min(0).max(1) }),
  harmony: z.object({ progressionVocabulary: z.array(z.string()).min(1), chordVocabulary: z.array(z.enum(["major","minor","dominant7","diminished"])) }),
  rightHand: z.object({ range: rangeSchema, movementDifficulty: z.number().min(0).max(1), minJump: z.number().int().min(0).max(36).default(0), maxJump: z.number().int().min(0).max(36).default(12), maxAccidentalsPerExercise: z.number().int().min(0).max(64).default(2) }).refine(x=>x.minJump<=x.maxJump),
  leftHand: z.object({ enabled: z.boolean(), accompanimentStyle: z.enum(["bassChord","alternatingBass","polka","waltz","tango","swing"]), movementDifficulty: z.number().min(0).max(1), minJump: z.number().int().min(0).max(11).default(0), maxJump: z.number().int().min(0).max(11).default(5), bassRootLow: z.enum(["Ab","Eb","Bb","F","C","G","D","A","E","B"]).default("Ab"), bassRootHigh: z.enum(["Ab","Eb","Bb","F","C","G","D","A","E","B"]).default("B"), templateId: z.enum(["legacy-tonic-pedal-descending","legacy-transition-to-IV","legacy-bb-fdim-line"]).optional() }).refine(x=>x.minJump<=x.maxJump),
  coordination: z.object({ difficulty: z.number().min(0).max(1) }),
  challenge: z.object({ density: z.number().min(0).max(1), allowedTypes: z.array(z.enum(["largeLeap","chromatic","unfamiliarRhythm","syncopation","bassJump","handIndependence","unpredictable"])) }),
  tempoBpm: z.number().int().min(30).max(240), measures: z.number().int().min(2).max(32), seed: z.number().int().optional(),
});
export type TrainingRequest = z.infer<typeof trainingRequestSchema>;
export const parseTrainingRequest = (input: unknown) => trainingRequestSchema.parse(input);
export const defaultTrainingRequest = (): TrainingRequest => ({
  version:3, hands:"both", pitchRegister:"rotating", intent:"balanced", tonal:{keys:["C major","G major","F major","D major"],selection:"random",modePolicy:"both",chromaticism:.03},
  patterns:{allowedFamilies:["repeated","scale","thirds","triad","arpeggio","neighbor","passing","leapRecovery","sequence","cadence","chordTone"],targetFamilies:[],targetDensity:.35,repetition:.55,variation:.35,sequenceProbability:.25},
  rhythm:{meters:[{beats:4,beatUnit:4}],smallestSubdivision:"eighth",syncopation:.1,restDensity:.05,tieDensity:.05,noteDensity:.55},
  harmony:{progressionVocabulary:["I-I-V-I","I-IV-V-I","I-vi-IV-V","I-ii-V7-I"],chordVocabulary:["major","minor","dominant7","diminished"]},
  rightHand:{range:{low:55,high:91},movementDifficulty:.4,minJump:0,maxJump:12,maxAccidentalsPerExercise:2},leftHand:{enabled:true,accompanimentStyle:"bassChord",movementDifficulty:.35,minJump:0,maxJump:5,bassRootLow:"Ab",bassRootHigh:"B"},coordination:{difficulty:.3},
  challenge:{density:.06,allowedTypes:["largeLeap","chromatic","syncopation","bassJump","handIndependence"]},tempoBpm:72,measures:4,
});
export const defaultRuntimeMode = (intent: TrainingIntent) => intent === "randomDecoding" ? "correction" : "sightReading";
