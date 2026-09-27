import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { defaultTrainingRequest, parseTrainingRequest } from "../training/trainingIntent";
import { generateExercise } from "./generateExercise";
import {
  applyProgressiveStudy,
  keyForCycle,
  STUDY_TOPICS,
  studyStepForSeed,
  topicForCycle,
} from "./progressiveStudy";
import { accordionProfile } from "../instrument/accordionProfile";
import { validateExercise } from "./validateExercise";

describe("progressiveStudy", () => {
  it("computes deterministic 3-step cycle, topic, and label for any seed", () => {
    expect(studyStepForSeed(0)).toMatchObject({ step: 1, label: "Theme", cycle: 0, topic: "Linear Fluency", emphasis: "melodicPatterns" });
    expect(studyStepForSeed(1)).toMatchObject({ step: 2, label: "Variation", cycle: 0, topic: "Linear Fluency", emphasis: "melodicPatterns" });
    expect(studyStepForSeed(2)).toMatchObject({ step: 3, label: "Challenge", cycle: 0, topic: "Linear Fluency", emphasis: "melodicPatterns" });
    expect(studyStepForSeed(3)).toMatchObject({ step: 1, label: "Theme", cycle: 1, topic: "Harmonic Outlines", emphasis: "arpeggios" });
    expect(studyStepForSeed(4)).toMatchObject({ step: 2, label: "Variation", cycle: 1, topic: "Harmonic Outlines", emphasis: "arpeggios" });
    expect(studyStepForSeed(5)).toMatchObject({ step: 3, label: "Challenge", cycle: 1, topic: "Harmonic Outlines", emphasis: "arpeggios" });

    fc.assert(
      fc.property(fc.integer({ min: -100000, max: 100000 }), (seed) => {
        const info = studyStepForSeed(seed);
        expect([1, 2, 3]).toContain(info.step);
        expect(["Theme", "Variation", "Challenge"]).toContain(info.label);
        expect(Number.isInteger(info.cycle)).toBe(true);
        expect(typeof info.topic).toBe("string");
      })
    );
  });

  it("rotates pedagogical topics cyclically across sets", () => {
    for (let cycle = 0; cycle < 15; cycle++) {
      const topic = topicForCycle(cycle);
      const expected = STUDY_TOPICS[cycle % STUDY_TOPICS.length]!;
      expect(topic).toEqual(expected);
    }
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

  it("maintains a single fixed key across long multi-cycle sessions while rotating topics and progressions", () => {
    const fixedKeyRequest = parseTrainingRequest({
      ...defaultTrainingRequest(),
      tonal: {
        keys: ["C major"],
        selection: "fixed",
        modePolicy: "major",
        chromaticism: 0.03,
      },
      sessionProgression: "progressive",
    });

    const exercises = [];
    // Simulate playing 30 consecutive exercises (10 cycles of 3 steps = ~500 notes)
    for (let seed = 0; seed < 30; seed++) {
      const ex = generateExercise(fixedKeyRequest, seed);
      exercises.push(ex);

      // Key must strictly remain C major
      expect(`${ex.tonalContext.tonic} ${ex.tonalContext.mode}`).toBe("C major");

      // Verify study metadata
      expect(ex.metadata.studyStep).toBe(studyStepForSeed(seed).step);
      expect(ex.metadata.studyTopic).toBe(studyStepForSeed(seed).topic);
    }

    // Verify all 5 topics were practiced within C major
    const observedTopics = new Set(exercises.map((e) => e.metadata.studyTopic));
    expect(observedTopics.size).toBe(5);

    // Verify progressions changed across cycles in C major
    const observedProgressions = new Set(exercises.map((e) => e.metadata.progressionId));
    expect(observedProgressions.size).toBeGreaterThan(1);
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
    expect(ex1.metadata.studyTopic).toBe("Linear Fluency");

    const ex2 = generateExercise(request, 1);
    expect(ex2.metadata.studyStep).toBe(2);
    expect(ex2.metadata.studyLabel).toBe("Variation");
    expect(ex2.metadata.studyCycle).toBe(0);
    expect(ex2.metadata.studyTopic).toBe("Linear Fluency");

    const ex3 = generateExercise(request, 2);
    expect(ex3.metadata.studyStep).toBe(3);
    expect(ex3.metadata.studyLabel).toBe("Challenge");
    expect(ex3.metadata.studyCycle).toBe(0);
    expect(ex3.metadata.studyTopic).toBe("Linear Fluency");

    const ex4 = generateExercise(request, 3);
    expect(ex4.metadata.studyStep).toBe(1);
    expect(ex4.metadata.studyCycle).toBe(1);
    expect(ex4.metadata.studyTopic).toBe("Harmonic Outlines");
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
