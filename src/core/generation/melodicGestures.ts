import type { DifficultyVector, HarmonyEvent, NoteRole, Pitch, PitchRange, PhraseRole, ScaleDegree, TonalContext } from "../model";
import type { Rng } from "../random/rng";
import { findChordTonesInRange, realizeDiatonicStep, type GeneratedPatternNote } from "../patterns/melodicPatterns";

export type MelodicGestureType =
  | "stepUpward"
  | "stepDownward"
  | "continueDirection"
  | "changeDirection"
  | "repeatNote"
  | "upperNeighbor"
  | "lowerNeighbor"
  | "passingMotion"
  | "skipToChordTone"
  | "arpeggiateActive"
  | "leapAndStepwiseRecovery"
  | "approachTargetFromAbove"
  | "approachTargetFromBelow"
  | "enclosure"
  | "fillIntervalStepwise"
  | "delayArrival"
  | "anticipateNextHarmony"
  | "sequenceRecent";

export interface GestureContext {
  from: Pitch;
  fromDegree: ScaleDegree;
  target?: Pitch;
  targetDegree?: ScaleDegree;
  harmony: HarmonyEvent;
  nextHarmony?: HarmonyEvent;
  noteCount: number;
  metricPosition: number;
  phraseRole: PhraseRole;
  contourGoal: number; // 0..1
  difficulty?: DifficultyVector;
  accidentalsRemaining: number;
  range: PitchRange;
}

export interface GeneratedGesture {
  type: MelodicGestureType;
  notes: GeneratedPatternNote[];
}

export const generateMelodicGesture = (
  context: TonalContext,
  gestureCtx: GestureContext,
  preferredType: MelodicGestureType | undefined,
  rng: Rng
): GeneratedGesture => {
  const { from, fromDegree, target, targetDegree, harmony, noteCount, range, accidentalsRemaining } = gestureCtx;
  const count = Math.max(1, noteCount);
  const type: MelodicGestureType = preferredType ?? (
    target
      ? rng.pick([
          "approachTargetFromAbove",
          "approachTargetFromBelow",
          "fillIntervalStepwise",
          "enclosure",
          "passingMotion",
        ] as MelodicGestureType[])
      : rng.pick([
          "stepUpward",
          "stepDownward",
          "upperNeighbor",
          "lowerNeighbor",
          "skipToChordTone",
          "arpeggiateActive",
          "leapAndStepwiseRecovery",
          "repeatNote",
        ] as MelodicGestureType[])
  );

  const notes: GeneratedPatternNote[] = [];
  const baseStep = (fromDegree.degree - 1) + (fromDegree.octaveOffset * 7);

  const makeNote = (step: number, role: NoteRole, alteration = 0): GeneratedPatternNote => {
    let activeStep = step;
    let realized = realizeDiatonicStep(context, activeStep, harmony, alteration);
    if (realized.pitch.midi > range.high) {
      while (realized.pitch.midi > range.high && activeStep > -50) {
        activeStep -= 7;
        realized = realizeDiatonicStep(context, activeStep, harmony, alteration);
      }
    } else if (realized.pitch.midi < range.low) {
      while (realized.pitch.midi < range.low && activeStep < 150) {
        activeStep += 7;
        realized = realizeDiatonicStep(context, activeStep, harmony, alteration);
      }
    }
    return {
      degree: realized.degree,
      pitch: realized.pitch,
      role,
      chromatic: alteration !== 0,
      chromaticRole: alteration !== 0 ? "accidental" : undefined,
    };
  };

  switch (type) {
    case "stepUpward":
      for (let i = 0; i < count; i++) {
        notes.push(makeNote(baseStep + i, i === 0 ? "chord tone" : "passing tone"));
      }
      break;

    case "stepDownward":
      for (let i = 0; i < count; i++) {
        notes.push(makeNote(baseStep - i, i === 0 ? "chord tone" : "passing tone"));
      }
      break;

    case "repeatNote":
      for (let i = 0; i < count; i++) {
        notes.push({
          degree: fromDegree,
          pitch: from,
          role: "repeated tone",
          chromatic: false,
        });
      }
      break;

    case "upperNeighbor": {
      notes.push(makeNote(baseStep, "chord tone"));
      if (count > 1) notes.push(makeNote(baseStep + 1, "neighbor tone"));
      if (count > 2) notes.push(makeNote(baseStep, "chord tone"));
      for (let i = 3; i < count; i++) {
        // Complete the turn musically rather than repeating baseStep
        const stepOffset = i % 2 === 1 ? -1 : 0;
        notes.push(makeNote(baseStep + stepOffset, "neighbor tone"));
      }
      break;
    }

    case "lowerNeighbor": {
      notes.push(makeNote(baseStep, "chord tone"));
      const useHalfStep = accidentalsRemaining > 0 && rng.next() < 0.3;
      if (count > 1) {
        notes.push(makeNote(baseStep - 1, "neighbor tone", useHalfStep ? 1 : 0));
      }
      if (count > 2) notes.push(makeNote(baseStep, "chord tone"));
      for (let i = 3; i < count; i++) {
        const stepOffset = i % 2 === 1 ? 1 : 0;
        notes.push(makeNote(baseStep + stepOffset, "neighbor tone"));
      }
      break;
    }

    case "approachTargetFromAbove": {
      const tgtStep = targetDegree ? (targetDegree.degree - 1) + (targetDegree.octaveOffset * 7) : baseStep;
      for (let i = 0; i < count; i++) {
        const dist = count - 1 - i;
        notes.push(makeNote(tgtStep + dist, dist === 0 ? "chord tone" : "passing tone"));
      }
      break;
    }

    case "approachTargetFromBelow": {
      const tgtStep = targetDegree ? (targetDegree.degree - 1) + (targetDegree.octaveOffset * 7) : baseStep;
      for (let i = 0; i < count; i++) {
        const dist = count - 1 - i;
        notes.push(makeNote(tgtStep - dist, dist === 0 ? "chord tone" : "passing tone"));
      }
      break;
    }

    case "enclosure": {
      const tgtStep = targetDegree ? (targetDegree.degree - 1) + (targetDegree.octaveOffset * 7) : baseStep;
      if (count >= 4) {
        for (let i = 0; i < count; i++) {
          const dist = count - 1 - i;
          if (dist === 0) notes.push(makeNote(tgtStep, "chord tone"));
          else if (dist === 1) notes.push(makeNote(tgtStep - 1, "neighbor tone"));
          else if (dist === 2) notes.push(makeNote(tgtStep + 1, "neighbor tone"));
          else notes.push(makeNote(tgtStep + (dist % 2 === 0 ? 2 : -2), "scale tone"));
        }
      } else if (count === 3) {
        notes.push(makeNote(tgtStep + 1, "neighbor tone"));
        notes.push(makeNote(tgtStep - 1, "neighbor tone"));
        notes.push(makeNote(tgtStep, "chord tone"));
      } else if (count === 2) {
        notes.push(makeNote(tgtStep + 1, "neighbor tone"));
        notes.push(makeNote(tgtStep, "chord tone"));
      } else {
        notes.push(makeNote(tgtStep, "chord tone"));
      }
      break;
    }

    case "fillIntervalStepwise": {
      const tgtStep = targetDegree ? (targetDegree.degree - 1) + (targetDegree.octaveOffset * 7) : baseStep + 2;
      const stepDiff = tgtStep - baseStep;
      let lastStep = baseStep;
      for (let i = 0; i < count; i++) {
        if (i === 0) {
          notes.push(makeNote(baseStep, "chord tone"));
          lastStep = baseStep;
        } else if (i === count - 1) {
          notes.push(makeNote(tgtStep, "chord tone"));
          lastStep = tgtStep;
        } else {
          const frac = i / (count - 1);
          let curStep = Math.round(baseStep + frac * stepDiff);
          if (curStep === lastStep && Math.abs(stepDiff) < count - 1) {
            const embellishment = (i % 2 === 1) ? (stepDiff >= 0 ? 1 : -1) : 0;
            curStep = baseStep + Math.floor(frac * stepDiff) + embellishment;
          }
          notes.push(makeNote(curStep, "passing tone"));
          lastStep = curStep;
        }
      }
      break;
    }

    case "arpeggiateActive": {
      const chordTones = findChordTonesInRange(context, harmony, range);
      const sorted = [...chordTones].sort((a, b) => a.pitch.midi - b.pitch.midi);
      let startIdx = sorted.findIndex((ct) => ct.pitch.midi >= from.midi);
      if (startIdx < 0) startIdx = 0;

      for (let i = 0; i < count; i++) {
        const ct = sorted[(startIdx + i) % sorted.length]!;
        notes.push({
          degree: ct.degree,
          pitch: ct.pitch,
          role: "chord tone",
          chromatic: false,
        });
      }
      break;
    }

    case "skipToChordTone": {
      const chordTones = findChordTonesInRange(context, harmony, range).filter((ct) => ct.pitch.midi !== from.midi);
      const other = chordTones.length ? chordTones.reduce((prev, curr) => Math.abs(curr.pitch.midi - from.midi) < Math.abs(prev.pitch.midi - from.midi) ? curr : prev) : undefined;
      notes.push(makeNote(baseStep, "chord tone"));
      for (let i = 1; i < count; i++) {
        if (other && i === 1) {
          notes.push({ degree: other.degree, pitch: other.pitch, role: "chord tone", chromatic: false });
        } else {
          notes.push(makeNote(baseStep + (i % 2 === 0 ? 0 : 2), "chord tone"));
        }
      }
      break;
    }

    case "leapAndStepwiseRecovery": {
      // Leap of 4th/5th, then recover stepwise in opposite direction
      const leapUp = from.midi + 7 <= range.high;
      const leapStep = leapUp ? 4 : -4;
      notes.push(makeNote(baseStep, "chord tone"));
      if (count > 1) {
        notes.push(makeNote(baseStep + leapStep, "chord tone"));
      }
      for (let i = 2; i < count; i++) {
        // opposite stepwise recovery
        const recoveryOffset = leapUp ? -(i - 1) : +(i - 1);
        notes.push(makeNote(baseStep + leapStep + recoveryOffset, "scale tone"));
      }
      break;
    }

    default:
      for (let i = 0; i < count; i++) {
        notes.push(makeNote(baseStep + i, "scale tone"));
      }
      break;
  }

  return { type, notes };
};
