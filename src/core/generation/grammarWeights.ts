import type { CadenceType, Meter, Mode, PhraseRole } from "../model";

export type PhraseContourPhase = "stable" | "rise" | "peak" | "fall" | "release";

export interface PhraseWeightContext {
  measures: number;
  phraseIndex: number;
  totalPhrases: number;
  mode: Mode;
}

export interface HarmonicTransitionContext {
  previousFunction: "T" | "TE" | "PD" | "D" | "R";
  phraseRole: PhraseRole;
  measureIndex: number;
  totalMeasures: number;
  mode: Mode;
}

export interface GestureWeightContext {
  phraseRole: PhraseRole;
  contourPhase: PhraseContourPhase;
  metricStrength: "strong" | "medium" | "weak";
  previousInterval?: number;
  nearCadence: boolean;
  stepDirectionHistory: number; // positive = ascending streak, negative = descending streak
}

export interface CadenceWeightContext {
  phraseRole: PhraseRole;
  isFinalPhrase: boolean;
  meter: Meter;
  mode: Mode;
}

export interface RhythmWeightContext {
  phraseRole: PhraseRole;
  contourPhase: PhraseContourPhase;
  meter: Meter;
  desiredDensity: number;
  syncopationAllowed: boolean;
}

export interface GrammarWeights {
  phraseArchetypeWeight(context: PhraseWeightContext, archetypeId: string): number;
  harmonicTransitionWeight(context: HarmonicTransitionContext, candidate: "T" | "TE" | "PD" | "D" | "R"): number;
  gestureWeight(context: GestureWeightContext, gestureType: string): number;
  cadenceWeight(context: CadenceWeightContext, cadenceType: CadenceType): number;
  rhythmWeight(context: RhythmWeightContext, rhythmType: string): number;
}

export class DefaultGrammarWeights implements GrammarWeights {
  phraseArchetypeWeight(context: PhraseWeightContext, archetypeId: string): number {
    void context;
    void archetypeId;
    return 1.0;
  }

  harmonicTransitionWeight(context: HarmonicTransitionContext, candidate: "T" | "TE" | "PD" | "D" | "R"): number {
    const { previousFunction, phraseRole, measureIndex, totalMeasures } = context;
    const isCadential = phraseRole === "cadence" || phraseRole === "cadentialPreparation" || measureIndex >= totalMeasures - 2;

    if (isCadential) {
      if (previousFunction === "PD" && candidate === "D") return 4.0;
      if (previousFunction === "D" && (candidate === "T" || candidate === "R")) return 4.0;
      if (previousFunction === "T" && candidate === "PD") return 3.0;
      if (previousFunction === "T" && candidate === "D") return 2.5;
    }

    switch (previousFunction) {
      case "T":
        if (candidate === "T") return 1.5;
        if (candidate === "TE") return 2.0;
        if (candidate === "PD") return 2.5;
        if (candidate === "D") return 1.5;
        return 0.5;
      case "TE":
        if (candidate === "PD") return 3.0;
        if (candidate === "D") return 2.0;
        if (candidate === "T") return 1.0;
        return 0.5;
      case "PD":
        if (candidate === "D") return 3.5;
        if (candidate === "PD") return 1.0;
        if (candidate === "T") return 0.8; // plagal
        return 0.2;
      case "D":
        if (candidate === "T" || candidate === "R") return 3.5;
        if (candidate === "D") return 0.8;
        if (candidate === "TE") return 0.6; // deceptive-like
        return 0.2;
      case "R":
        if (candidate === "T") return 3.0;
        if (candidate === "PD") return 1.5;
        return 0.5;
      default:
        return 1.0;
    }
  }

  gestureWeight(context: GestureWeightContext, gestureType: string): number {
    const { phraseRole, contourPhase, previousInterval, nearCadence, stepDirectionHistory } = context;

    // After large leap: opposite stepwise recovery high, repeat medium, same leap low
    if (previousInterval !== undefined && Math.abs(previousInterval) >= 5) {
      const isAscendingLeap = previousInterval > 0;
      if (isAscendingLeap) {
        if (gestureType === "stepDownward" || gestureType === "leapAndStepwiseRecovery" || gestureType === "approachTargetFromAbove") return 3.5;
        if (gestureType === "repeatNote") return 1.5;
        if (gestureType === "stepUpward") return 0.4;
      } else {
        if (gestureType === "stepUpward" || gestureType === "leapAndStepwiseRecovery" || gestureType === "approachTargetFromBelow") return 3.5;
        if (gestureType === "repeatNote") return 1.5;
        if (gestureType === "stepDownward") return 0.4;
      }
    }

    // Near cadence: stepwise approach high, neighbor medium, large leap away low
    if (nearCadence || phraseRole === "cadence") {
      if (gestureType === "approachTargetFromAbove" || gestureType === "approachTargetFromBelow" || gestureType === "stepDownward" || gestureType === "stepUpward") return 3.5;
      if (gestureType === "upperNeighbor" || gestureType === "lowerNeighbor" || gestureType === "enclosure") return 2.5;
      if (gestureType === "leapAndStepwiseRecovery" || gestureType === "arpeggiateActive") return 0.5;
    }

    // After repeated ascent / descent:
    if (stepDirectionHistory >= 3) {
      if (gestureType === "changeDirection" || gestureType === "stepDownward" || gestureType === "lowerNeighbor") return 3.0;
      if (gestureType === "stepUpward" || gestureType === "continueDirection") return 0.4;
    } else if (stepDirectionHistory <= -3) {
      if (gestureType === "changeDirection" || gestureType === "stepUpward" || gestureType === "upperNeighbor") return 3.0;
      if (gestureType === "stepDownward" || gestureType === "continueDirection") return 0.4;
    }

    // Contour phase influences
    if (contourPhase === "rise") {
      if (gestureType === "stepUpward" || gestureType === "continueDirection" || gestureType === "skipToChordTone") return 2.0;
    } else if (contourPhase === "peak") {
      if (gestureType === "changeDirection" || gestureType === "upperNeighbor" || gestureType === "leapAndStepwiseRecovery") return 2.5;
    } else if (contourPhase === "fall" || contourPhase === "release") {
      if (gestureType === "stepDownward" || gestureType === "approachTargetFromAbove") return 2.0;
    }

    return 1.0;
  }

  cadenceWeight(context: CadenceWeightContext, candidate: CadenceType): number {
    const { isFinalPhrase, phraseRole } = context;
    if (isFinalPhrase) {
      switch (candidate) {
        case "strongTonic": return 2.8;
        case "weakTonic": return 2.2;
        case "plagal": return 1.4;
        case "half": return 0.2; // rare open finish if specifically requested
        case "deceptive": return 0.5;
        case "open": return 0.2;
      }
    } else {
      // Internal phrase ending
      if (phraseRole === "statement" || phraseRole === "opening" || phraseRole === "response") {
        switch (candidate) {
          case "half": return 3.0;
          case "open": return 2.5;
          case "weakTonic": return 2.0;
          case "deceptive": return 1.5;
          case "strongTonic": return 0.8;
          case "plagal": return 1.0;
        }
      }
    }
    return 1.0;
  }

  rhythmWeight(context: RhythmWeightContext, rhythmType: string): number {
    const { phraseRole, desiredDensity, syncopationAllowed } = context;

    if (rhythmType === "syncopation" && !syncopationAllowed) return 0.0;

    if (phraseRole === "opening") {
      if (rhythmType === "quarter" || rhythmType === "twoEighths" || rhythmType === "half") return 2.5;
      if (rhythmType === "fourSixteenths" || rhythmType === "syncopation") return 0.5;
    } else if (phraseRole === "continuation" || phraseRole === "climax") {
      if (desiredDensity > 0.5) {
        if (rhythmType === "fourSixteenths" || rhythmType === "twoEighths" || rhythmType === "dottedEighthSixteenth") return 2.5;
        if (rhythmType === "half") return 0.4;
      }
    } else if (phraseRole === "cadence") {
      if (rhythmType === "half" || rhythmType === "whole" || rhythmType === "dottedHalf" || rhythmType === "twoQuarters") return 3.0;
      if (rhythmType === "fourSixteenths") return 0.3;
    }
    return 1.0;
  }
}

export const defaultGrammarWeights = new DefaultGrammarWeights();
