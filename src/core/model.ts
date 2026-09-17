export const TICKS_PER_QUARTER = 480;
export type Tick = number;
export type Hand = "right" | "left";
export type Mode = "major" | "minor";
export type PitchClass = string;
export type ScaleDegreeNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type ScaleDegree = { degree: ScaleDegreeNumber; alteration: -2 | -1 | 0 | 1 | 2; octaveOffset: number };
export type Pitch = { midi: number; name: string };
export type PitchRange = { low: number; high: number };
export type Meter = { beats: number; beatUnit: 4 | 8 };
export type TonalContext = { tonic: PitchClass; mode: Mode };
export type ChordQuality = "major" | "minor" | "dominant7" | "diminished";
export type HarmonicFunction = "tonic" | "predominant" | "dominant";
export type HarmonyEvent = {
  id: string; onset: Tick; duration: Tick; rootDegree: ScaleDegree;
  quality: ChordQuality; function: HarmonicFunction; symbol: string;
};
export type PatternFamily = "repeated" | "scale" | "thirds" | "triad" | "arpeggio" | "neighbor" | "passing" | "leapRecovery" | "sequence" | "cadence" | "chordTone";
export type ChallengeType = "largeLeap" | "chromatic" | "unfamiliarRhythm" | "syncopation" | "bassJump" | "handIndependence" | "unpredictable";
export type EventMetadata = {
  scaleDegree?: ScaleDegree; harmonyId?: string; motifId?: string; patternId?: string;
  patternFamily?: PatternFamily; rhythmCellId?: string; intervalFromPrevious?: number;
  metricStrength?: "strong" | "medium" | "weak"; challengeTags: ChallengeType[];
  chromatic?: boolean; accompaniment?: string; bassDistance?: number;
  tieFromPrevious?: boolean; tieToNext?: boolean;
  accompanimentTemplateId?: string; stradellaButton?: string;
  stradellaColumn?: number; stradellaRow?: "counterbass"|"fundamental"|"major"|"minor"|"seventh"|"diminished";
};
export type ExerciseEvent = { id: string; onset: Tick; duration: Tick; pitches: Pitch[]; hand: Hand; metadata: EventMetadata };
export type DifficultyVector = {
  tonal: number; pitchMovement: number; patternComplexity: number; rhythm: number;
  density: number; harmony: number; rightHandMotor: number; leftHandMotor: number;
  coordination: number; predictability: number; tempo: number; challengeDensity: number;
};
export type PhraseSection = { id: string; label: "A" | "A'" | "A''" | "B" | "cadence"; measure: number; transformation: PatternTransformation };
export type PatternTransformation = "exact" | "sequenceUp" | "sequenceDown" | "newStart" | "newPitches" | "changedEnding" | "shortened" | "extended";
export type Exercise = {
  seed: number; tonalContext: TonalContext; meter: Meter; tempoBpm: number; totalDuration: Tick;
  harmony: HarmonyEvent[]; phrase: PhraseSection[]; rightHand: ExerciseEvent[]; leftHand: ExerciseEvent[];
  difficulty: DifficultyVector; metadata: { intent: TrainingIntent; progressionId: string; attempts: number };
};
export type TrainingIntent = "balanced" | "patternFocus" | "keyFluency" | "rhythmFocus" | "pitchIntervalFocus" | "readAhead" | "leftHandFocus" | "coordination" | "randomDecoding";
export type AccompanimentStyle = "bassChord" | "alternatingBass" | "polka" | "waltz" | "tango" | "swing";
export type PerformedMidiEvent = { midiNote: number; type: "noteOn" | "noteOff"; timestampMs: number; velocity: number; hand?: Hand };
