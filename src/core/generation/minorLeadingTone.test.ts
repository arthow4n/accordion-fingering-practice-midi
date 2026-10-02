import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { exerciseToAbc } from "../../adapters/abc/exerciseToAbc";
import { accordionProfile } from "../instrument/accordionProfile";
import type { Exercise, HarmonyEvent, TonalContext } from "../model";
import { chordPitches } from "../music/harmony";
import { harmonicRootDegree, realizeScaleDegree } from "../music/key";
import { findChordTonesInRange, realizeDiatonicStep } from "../patterns/melodicPatterns";
import { defaultTrainingRequest } from "../training/trainingIntent";
import { generateExercise } from "./generateExercise";
import { validateExercise } from "./validateExercise";

const minorKeys = ["A minor", "D minor", "E minor"] as const;
const requestFor = (key: string) => {
  const request = defaultTrainingRequest();
  request.tonal.keys = [key];
  request.leftHand.maxJump = 11;
  request.tonal.chromaticism = 0;
  request.challenge.density = 0;
  request.rightHand.maxAccidentalsPerExercise = 0;
  request.rhythm.tieDensity = 0;
  return request;
};

const expectLeadingToneHarmony = (exercise: Exercise) => {
  for (const harmony of exercise.harmony.filter((h) => h.rootDegree.degree === 7 && h.quality === "diminished")) {
    expect(harmony.rootDegree.alteration).toBe(1);
    expect(harmony.symbol).toBe("vii°");
    for (const event of exercise.rightHand.filter((e) => e.metadata.harmonyId === harmony.id && e.pitches.length && e.metadata.metricStrength !== "weak" && !e.metadata.tieFromPrevious)) {
      expect(chordPitches(exercise.tonalContext, harmony).map((p) => p.midi % 12)).toContain(event.pitches[0]!.midi % 12);
      if (event.metadata.scaleDegree?.degree === 7) {
        expect(event.metadata.scaleDegree.alteration).toBe(1);
        expect(event.metadata.chromatic).toBe(false);
      }
    }
  }
};

describe("minor leading-tone diminished harmony", () => {
  it.each([
    ["A minor", "G#", [8, 11, 2], "Abdim diminished"],
    ["D minor", "C#", [1, 4, 7], "Dbdim diminished"],
    ["E minor", "D#", [3, 6, 9], "Ebdim diminished"],
  ] as const)("aligns %s vii° melody, bass, and notation", (key, root, pitchClasses, button) => {
    const request = requestFor(key);
    const exercise = generateExercise(request, 3);
    const harmony = exercise.harmony.find((h) => h.onset === 3840)!;
    expect(harmony.rootDegree.degree).toBe(7);
    expect(chordPitches(exercise.tonalContext, harmony).map((p) => p.midi % 12)).toEqual(pitchClasses);
    expectLeadingToneHarmony(exercise);
    expect(exercise.leftHand.some((event) => event.metadata.harmonyId === harmony.id && event.metadata.stradellaButton === button)).toBe(true);
    expect(exerciseToAbc(exercise)).toContain(`"${root}dim"`);
    expect(validateExercise(exercise, accordionProfile).errors).toEqual([]);
  });

  it.each(["occasional", "frequent"] as const)("raises vii° in explicit %s jump progressions and their endings", (frequency) => {
    for (const key of minorKeys) {
      for (const emphasis of ["everything", "arpeggios"] as const) {
        const request = requestFor(key);
        request.emphasis = emphasis;
        request.harmony.progressionVocabulary = [`jump-veryLarge-${frequency}`];
        const exercise = generateExercise(request, 3);
        expect(exercise.harmony.some((h) => h.rootDegree.degree === 7)).toBe(true);
        expectLeadingToneHarmony(exercise);
        if (frequency === "frequent" && emphasis === "arpeggios") {
          expect(exercise.rightHand.at(-1)!.metadata.scaleDegree).toMatchObject({ degree: 7, alteration: 1 });
        }
      }
    }
  });

  it("realizes raised degree seven consistently without altering ii° or major vii°", () => {
    fc.assert(fc.property(fc.constantFrom(...minorKeys), fc.integer({ min: -1, max: 2 }), (key, octaveOffset) => {
      const context: TonalContext = { tonic: key.split(" ")[0]!, mode: "minor" };
      const harmony: HarmonyEvent = { id: "leading", onset: 0, duration: 1920, rootDegree: harmonicRootDegree("minor", 7, "diminished"), quality: "diminished", function: "dominant", symbol: "vii°" };
      const realized = realizeDiatonicStep(context, 6 + octaveOffset * 7, harmony);
      expect(realized.degree.alteration).toBe(1);
      expect(realizeScaleDegree(context, realized.degree).midi).toBe(realized.pitch.midi);
      for (const tone of findChordTonesInRange(context, harmony, { low: 55, high: 91 })) {
        expect(realizeScaleDegree(context, tone.degree).midi).toBe(tone.pitch.midi);
      }
      expect(harmonicRootDegree("minor", 2, "diminished").alteration).toBe(0);
      expect(harmonicRootDegree("major", 7, "diminished").alteration).toBe(0);
    }));
  });

  it("preserves musical and generation invariants across minor-key seeds", () => {
    fc.assert(fc.property(fc.integer(), fc.constantFrom(...minorKeys), fc.constantFrom("everything" as const, "arpeggios" as const), (seed, key, emphasis) => {
      const request = requestFor(key);
      request.emphasis = emphasis;
      const exercise = generateExercise(request, seed);
      expectLeadingToneHarmony(exercise);
      expect(validateExercise(exercise, accordionProfile).errors).toEqual([]);
      expect(exercise.metadata.attempts).toBeLessThanOrEqual(32);
      expect(generateExercise(request, seed)).toEqual(exercise);
      expect(() => exerciseToAbc(exercise)).not.toThrow();
    }), { numRuns: 150 });
  });
});
