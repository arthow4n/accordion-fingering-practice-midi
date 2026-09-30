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
export type PatternCategory = "melodicPatterns" | "intervals" | "arpeggios" | "cadencesApproaches" | "rhythm";
export type NoteRole = "scale tone" | "chord tone" | "passing tone" | "neighbor tone" | "chromatic approach" | "leading tone" | "cadence tone" | "repeated tone";
export type PatternFamily = "repeated" | "scale" | "thirds" | "triad" | "arpeggio" | "neighbor" | "passing" | "leapRecovery" | "sequence" | "cadence" | "chordTone";
export type ChallengeType = "largeLeap" | "chromatic" | "unfamiliarRhythm" | "syncopation" | "bassJump" | "handIndependence" | "unpredictable";
export type ExerciseSource =
  | {
      type: "generated";
      seed: number;
      generatorVersion: string;
    }
  | {
      type: "imported";
      materialId: string;
      source?: string;
    };

export type PhraseRole =
  | "opening"
  | "statement"
  | "repetition"
  | "variation"
  | "continuation"
  | "sequence"
  | "contrast"
  | "climax"
  | "cadentialPreparation"
  | "cadence"
  | "response";

export type CadenceType =
  | "strongTonic"
  | "weakTonic"
  | "half"
  | "plagal"
  | "deceptive"
  | "open";

export type EventMetadata = {
  scaleDegree?: ScaleDegree; harmonyId?: string; motifId?: string; patternId?: string;
  patternFamily?: PatternFamily; patternCategory?: PatternCategory; patternInstanceId?: string;
  positionInPattern?: number; noteRole?: NoteRole; chromaticRole?: string;
  rhythmCellId?: string; intervalFromPrevious?: number;
  metricStrength?: "strong" | "medium" | "weak"; challengeTags: ChallengeType[];
  chromatic?: boolean; accompaniment?: string; bassDistance?: number;
  tieFromPrevious?: boolean; tieToNext?: boolean;
  accompanimentTemplateId?: string; stradellaButton?: string;
  leadSheetAnnotation?: { chordRoot: string; quality: ChordQuality; bass?: string };
  stradellaColumn?: number; stradellaRow?: "counterbass"|"fundamental"|"major"|"minor"|"seventh"|"diminished";
  phraseArchetypeId?: string; phraseIndex?: number; phraseRole?: PhraseRole;
  contourPhase?: "stable" | "rise" | "peak" | "fall" | "release";
  harmonicFunction?: string; harmonicRhythmId?: string;
  cadenceType?: CadenceType; cadenceInstanceId?: string; anchorId?: string;
  motifSourceId?: string; motifTransformation?: PatternTransformation;
  gestureId?: string; gestureType?: string; positionInGesture?: number;
  rhythmGestureId?: string;
};
export type ExerciseEvent = { id: string; onset: Tick; duration: Tick; pitches: Pitch[]; hand: Hand; metadata: EventMetadata };
export type DifficultyVector = {
  tonal: number; pitchMovement: number; patternComplexity: number; rhythm: number;
  density: number; harmony: number; rightHandMotor: number; leftHandMotor: number;
  coordination: number; predictability: number; tempo: number; challengeDensity: number;
};
export type PhraseSection = {
  id: string;
  label: "A" | "A'" | "A''" | "B" | "cadence" | string;
  measure: number;
  role?: PhraseRole;
  phraseIndex?: number;
  transformation: PatternTransformation;
};
export type PatternTransformation = "exact" | "sequenceUp" | "sequenceDown" | "newStart" | "newPitches" | "changedEnding" | "shortened" | "extended" | "continuation" | "rhythmicVariation";
export type RightHandEmphasis = "everything" | "melodicPatterns" | "intervals" | "arpeggios" | "cadencesApproaches" | "rhythm";
export type Exercise = {
  seed: number; source?: ExerciseSource; tonalContext: TonalContext; meter: Meter; tempoBpm: number; totalDuration: Tick;
  harmony: HarmonyEvent[]; phrase: PhraseSection[]; rightHand: ExerciseEvent[]; leftHand: ExerciseEvent[];
  difficulty: DifficultyVector; metadata: { emphasis?: RightHandEmphasis; progressionId: string; attempts: number; studyStep?: 1 | 2 | 3; studyLabel?: "Theme" | "Variation" | "Challenge"; studyCycle?: number; studyTopic?: string };
};
export type AccompanimentStyle = "bassChord" | "alternatingBass" | "polka" | "waltz" | "tango" | "swing";
export type PerformedMidiEvent = { midiNote: number; type: "noteOn" | "noteOff"; timestampMs: number; velocity: number; hand?: Hand };

