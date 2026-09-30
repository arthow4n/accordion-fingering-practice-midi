import type { HarmonyEvent, PatternTransformation, PitchRange, ScaleDegree, TonalContext } from "../model";
import type { Rng } from "../random/rng";
import { realizeDiatonicStep, type GeneratedPatternNote } from "../patterns/melodicPatterns";
import type { RhythmAtom } from "./rhythmGrammar";
import type { GeneratedGesture, MelodicGestureType } from "./melodicGestures";

export type StoredMotif = {
  id: string;
  notes: GeneratedPatternNote[];
  rhythm: RhythmAtom[];
  gestures: GeneratedGesture[];
  contour: ("U" | "D" | "S")[]; // direction between consecutive notes: Up, Down, Same
  anchorDegree: ScaleDegree;
};

export type MotifMemory = {
  primary?: StoredMotif;
  secondary?: StoredMotif;
  recentGestures: GeneratedGesture[];
  recentRhythms: RhythmAtom[][];
};

export const createMotifMemory = (): MotifMemory => ({
  recentGestures: [],
  recentRhythms: [],
});

const computeContour = (notes: GeneratedPatternNote[]): ("U" | "D" | "S")[] => {
  return notes.slice(1).map((n, i) => {
    const diff = n.pitch.midi - notes[i]!.pitch.midi;
    return diff > 0 ? "U" : diff < 0 ? "D" : "S";
  });
};

export const applyMotifTransformation = (
  base: StoredMotif,
  transformation: PatternTransformation,
  context: TonalContext,
  activeHarmony: HarmonyEvent,
  range: PitchRange,
  rng: Rng
): { notes: GeneratedPatternNote[]; rhythm: RhythmAtom[]; gestureType: MelodicGestureType } => {
  let notes = [...base.notes];
  let rhythm = [...base.rhythm];
  let gestureType: MelodicGestureType = base.gestures[0]?.type ?? "stepUpward";

  switch (transformation) {
    case "exact":
      // Preserve notes exactly, adapted only if out of range
      break;

    case "sequenceUp": {
      const shift = rng.pick([1, 2, 3]);
      notes = notes.map((n) => {
        const step = (n.degree.degree - 1) + (n.degree.octaveOffset * 7) + shift;
        const realized = realizeDiatonicStep(context, step, activeHarmony);
        return { ...n, degree: realized.degree, pitch: realized.pitch };
      });
      gestureType = "sequenceRecent";
      break;
    }

    case "sequenceDown": {
      const shift = rng.pick([1, 2, 3]);
      notes = notes.map((n) => {
        const step = (n.degree.degree - 1) + (n.degree.octaveOffset * 7) - shift;
        const realized = realizeDiatonicStep(context, step, activeHarmony);
        return { ...n, degree: realized.degree, pitch: realized.pitch };
      });
      gestureType = "sequenceRecent";
      break;
    }

    case "newStart": {
      // Reuse contour & rhythm starting from a new diatonic root step
      const stepOffset = rng.pick([2, 4, -2, -3]);
      notes = notes.map((n) => {
        const step = (n.degree.degree - 1) + (n.degree.octaveOffset * 7) + stepOffset;
        const realized = realizeDiatonicStep(context, step, activeHarmony);
        return { ...n, degree: realized.degree, pitch: realized.pitch };
      });
      break;
    }

    case "newPitches": {
      // Preserve rhythm and broad contour while generating new interval steps
      let curStep = (base.notes[0]?.degree.degree ?? 1) - 1 + ((base.notes[0]?.degree.octaveOffset ?? 0) * 7);
      notes = base.notes.map((n, i) => {
        if (i > 0) {
          const dir = base.contour[i - 1] ?? "U";
          const interval = rng.pick(dir === "U" ? [1, 2, 3] : dir === "D" ? [-1, -2, -3] : [0]);
          curStep += interval;
        }
        const realized = realizeDiatonicStep(context, curStep, activeHarmony);
        return { ...n, degree: realized.degree, pitch: realized.pitch };
      });
      break;
    }

    case "changedEnding": {
      // Preserve opening (first 50-70%), redirect final notes toward target
      const keepCount = Math.max(1, Math.floor(notes.length * 0.6));
      const retained = notes.slice(0, keepCount);
      const remainingCount = notes.length - keepCount;
      const lastRetainedStep = (retained.at(-1)?.degree.degree ?? 1) - 1 + ((retained.at(-1)?.degree.octaveOffset ?? 0) * 7);

      const endingNotes: GeneratedPatternNote[] = [];
      for (let i = 0; i < remainingCount; i++) {
        const step = lastRetainedStep - (i + 1); // step downward to resolution
        const realized = realizeDiatonicStep(context, step, activeHarmony);
        endingNotes.push({ ...notes[keepCount + i]!, degree: realized.degree, pitch: realized.pitch, role: "chord tone" });
      }
      notes = [...retained, ...endingNotes];
      gestureType = "approachTargetFromAbove";
      break;
    }

    case "shortened": {
      // Remove or compress the final note/gesture
      if (notes.length > 2) {
        notes = notes.slice(0, -1);
        rhythm = rhythm.slice(0, -1);
        // Extend last atom to fill measure duration
        const removedDur = base.rhythm.at(-1)?.duration ?? 0;
        const lastAtom = rhythm.at(-1);
        if (lastAtom) {
          lastAtom.duration += removedDur;
        }
      }
      break;
    }

    case "extended": {
      // Add a derived continuation note/gesture
      const lastNote = notes.at(-1)!;
      const lastAtom = rhythm.at(-1)!;
      if (lastAtom.duration >= 240) {
        // Split last atom
        const halfDur = Math.floor(lastAtom.duration / 2);
        lastAtom.duration = halfDur;
        rhythm.push({ duration: halfDur });

        const lastStep = (lastNote.degree.degree - 1) + (lastNote.degree.octaveOffset * 7);
        const nextStep = lastStep + (rng.next() < 0.5 ? 1 : -1);
        const realized = realizeDiatonicStep(context, nextStep, activeHarmony);
        notes.push({
          degree: realized.degree,
          pitch: realized.pitch,
          role: "passing tone",
          chromatic: false,
        });
      }
      break;
    }

    case "continuation": {
      // Develop the trajectory onward
      const lastNote = notes.at(-1)!;
      const lastStep = (lastNote.degree.degree - 1) + (lastNote.degree.octaveOffset * 7);
      notes = notes.map((n, i) => {
        const step = lastStep + i + 1;
        const realized = realizeDiatonicStep(context, step, activeHarmony);
        return { ...n, degree: realized.degree, pitch: realized.pitch, role: "scale tone" };
      });
      gestureType = "continueDirection";
      break;
    }

    case "rhythmicVariation": {
      // Preserve contour while materially altering rhythm (e.g. reverse or subdivide)
      if (rhythm.length >= 2) {
        rhythm = [...rhythm].reverse();
      }
      break;
    }
  }

  // Range clamping if necessary
  notes = notes.map((n) => {
    if (n.pitch.midi < range.low || n.pitch.midi > range.high) {
      const step = (n.degree.degree - 1) + (n.degree.octaveOffset * 7);
      const clampedStep = n.pitch.midi < range.low ? step + 7 : step - 7;
      const realized = realizeDiatonicStep(context, clampedStep, activeHarmony);
      return { ...n, degree: realized.degree, pitch: realized.pitch };
    }
    return n;
  });

  return { notes, rhythm, gestureType };
};

export const storeMotif = (
  id: string,
  notes: GeneratedPatternNote[],
  rhythm: RhythmAtom[],
  gestures: GeneratedGesture[],
  anchorDegree: ScaleDegree
): StoredMotif => ({
  id,
  notes,
  rhythm,
  gestures,
  contour: computeContour(notes),
  anchorDegree,
});
