import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { defaultTrainingRequest, parseTrainingRequest } from "../training/trainingIntent";
import { generateExercise } from "./generateExercise";
import {
  applyProgressiveStudy,
  keyForCycle,
  studyStepForSeed,
} from "./progressiveStudy";
import { accordionProfile } from "../instrument/accordionProfile";
import { validateExercise } from "./validateExercise";

describe("progressiveStudy", () => {
  it("computes deterministic 3-step cycle and label for any seed", () => {
    expect(studyStepForSeed(0)).toEqual({ step: 1, label: "Theme", cycle: 0 });
    expect(studyStepForSeed(1)).toEqual({ step: 2, label: "Variation", cycle: 0 });
    expect(studyStepForSeed(2)).toEqual({ step: 3, label: "Challenge", cycle: 0 });
    expect(studyStepForSeed(3)).toEqual({ step: 1, label: "Theme", cycle: 1 });
    expect(studyStepForSeed(4)).toEqual({ step: 2, label: "Variation", cycle: 1 });
    expect(studyStepForSeed(5)).toEqual({ step: 3, label: "Challenge", cycle: 1 });

    fc.assert(
      fc.property(fc.integer({ min: -100000, max: 100000 }), (seed) => {
        const info = studyStepForSeed(seed);
        expect([1, 2, 3]).toContain(info.step);
        expect(["Theme", "Variation", "Challenge"]).toContain(info.label);
        expect(Number.isInteger(info.cycle)).toBe(true);
      })
    );
  });

  it("rotates keys as a deterministic shuffle-bag without immediate repeats across cycles", () => {
    const keys = ["C major", "G major", "D major", "F major"] as const;

    // Test across 50 consecutive cycles
    const selected: string[] = [];
    for (let cycle = 0; cycle < 50; cycle++) {
      selected.push(keyForCycle(keys, cycle));
    }

    // Every round of keys.length contains all keys
    for (let round = 0; round < Math.floor(50 / keys.length); round++) {
      const slice = selected.slice(round * keys.length, (round + 1) * keys.length);
      expect(new Set(slice).size).toBe(keys.length);
    }

    // No consecutive repeats
    for (let i = 0; i < selected.length - 1; i++) {
      expect(selected[i]).not.toBe(selected[i + 1]);
    }
  });

  it("modulates theme, variation, and challenge across the 3 study steps", () => {
    const baseRequest = {
      ...defaultTrainingRequest(),
      sessionProgression: "progressive" as const,
    };

    const step1Req = applyProgressiveStudy(baseRequest, 0); // step 1 (Theme)
    const step2Req = applyProgressiveStudy(baseRequest, 1); // step 2 (Variation)
    const step3Req = applyProgressiveStudy(baseRequest, 2); // step 3 (Challenge)

    // All 3 steps in cycle 0 share the same primary key and meter
    expect(step1Req.tonal.keys[0]).toBe(step2Req.tonal.keys[0]);
    expect(step2Req.tonal.keys[0]).toBe(step3Req.tonal.keys[0]);
    expect(step1Req.rhythm.meters[0]).toEqual(step2Req.rhythm.meters[0]);

    // Step 1: Theme (repetition high, variation low, challenge zero)
    expect(step1Req.challenge.density).toBe(0);
    expect(step1Req.patterns.repetition).toBeGreaterThan(step2Req.patterns.repetition);
    expect(step1Req.patterns.variation).toBeLessThan(step2Req.patterns.variation);

    // Step 2: Variation (variation high)
    expect(step2Req.patterns.variation).toBeGreaterThan(step3Req.patterns.variation);

    // Step 3: Challenge (challenge density peak)
    expect(step3Req.challenge.density).toBeGreaterThanOrEqual(step2Req.challenge.density);
    expect(step3Req.coordination.difficulty).toBeGreaterThanOrEqual(step1Req.coordination.difficulty);
  });

  it("attaches study metadata to generated exercises in progressive mode", () => {
    const request = {
      ...defaultTrainingRequest(),
      sessionProgression: "progressive" as const,
    };

    const ex1 = generateExercise(request, 0);
    expect(ex1.metadata.studyStep).toBe(1);
    expect(ex1.metadata.studyLabel).toBe("Theme");
    expect(ex1.metadata.studyCycle).toBe(0);

    const ex2 = generateExercise(request, 1);
    expect(ex2.metadata.studyStep).toBe(2);
    expect(ex2.metadata.studyLabel).toBe("Variation");
    expect(ex2.metadata.studyCycle).toBe(0);

    const ex3 = generateExercise(request, 2);
    expect(ex3.metadata.studyStep).toBe(3);
    expect(ex3.metadata.studyLabel).toBe("Challenge");
    expect(ex3.metadata.studyCycle).toBe(0);
  });

  it("generates valid exercises for hands=right, hands=left, and hands=both across all 3 steps", () => {
    for (const hands of ["right", "left", "both"] as const) {
      for (let seed = 0; seed < 6; seed++) {
        const request = parseTrainingRequest({
          ...defaultTrainingRequest(),
          hands,
          sessionProgression: "progressive",
        });
        const exercise = generateExercise(request, seed);
        const validation = validateExercise(exercise, accordionProfile);
        expect(validation.valid).toBe(true);
        expect(exercise.metadata.studyStep).toBe(studyStepForSeed(seed).step);
      }
    }
  });

  it("preserves strict determinism for identical (request, seed)", () => {
    const request = parseTrainingRequest({
      ...defaultTrainingRequest(),
      sessionProgression: "progressive",
    });

    for (let seed = 10; seed <= 15; seed++) {
      const ex1 = generateExercise(request, seed);
      const ex2 = generateExercise(request, seed);
      expect(ex1).toEqual(ex2);
    }
  });
});
