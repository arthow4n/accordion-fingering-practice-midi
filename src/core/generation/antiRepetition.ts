import type { StructuralSignature } from "./structuralSignature";

export interface AntiRepetitionTracker {
  record(signature: StructuralSignature): void;
  getArchetypePenalty(archetype: string): number;
  getContourPenalty(contour: string): number;
  getCadencePenalty(cadenceType: string, finalDegree: number, melodicShape: string): number;
  getHarmonicRhythmPenalty(harmonicRhythm: string): number;
  clear(): void;
}

export class BoundedAntiRepetitionTracker implements AntiRepetitionTracker {
  private history: StructuralSignature[] = [];
  private maxHistory: number;

  constructor(maxHistory = 8) {
    this.maxHistory = maxHistory;
  }

  record(signature: StructuralSignature): void {
    this.history.unshift(signature);
    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }
  }

  getArchetypePenalty(archetype: string): number {
    let penalty = 1.0;
    for (let i = 0; i < Math.min(3, this.history.length); i++) {
      if (this.history[i]?.phraseArchetype === archetype) {
        penalty *= (i === 0 ? 0.25 : 0.6);
      }
    }
    return penalty;
  }

  getContourPenalty(contour: string): number {
    let penalty = 1.0;
    for (let i = 0; i < Math.min(3, this.history.length); i++) {
      if (this.history[i]?.contour === contour) {
        penalty *= (i === 0 ? 0.3 : 0.65);
      }
    }
    return penalty;
  }

  getCadencePenalty(cadenceType: string, finalDegree: number, melodicShape: string): number {
    let penalty = 1.0;
    for (let i = 0; i < Math.min(4, this.history.length); i++) {
      const h = this.history[i];
      if (!h) continue;
      const sameType = h.cadenceType === cadenceType;
      const sameDegree = h.finalScaleDegree === finalDegree;
      const sameShape = h.cadenceContour === melodicShape;

      if (sameType && sameDegree && sameShape) {
        penalty *= (i === 0 ? 0.15 : 0.4);
      } else if (sameType && sameDegree) {
        penalty *= (i === 0 ? 0.35 : 0.65);
      } else if (sameDegree) {
        penalty *= 0.8;
      }
    }
    return penalty;
  }

  getHarmonicRhythmPenalty(harmonicRhythm: string): number {
    if (this.history[0]?.harmonicRhythm === harmonicRhythm) {
      return 0.4;
    }
    return 1.0;
  }

  clear(): void {
    this.history = [];
  }
}

export const globalAntiRepetitionTracker = new BoundedAntiRepetitionTracker(8);
