import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Exercise, RightHandEmphasis } from "../model";
import { chordPitches } from "../music/harmony";
import { realizeScaleDegree } from "../music/key";
import { defaultTrainingRequest } from "../training/trainingIntent";
import { generateExercise } from "./generateExercise";

const emphases = ["melodicPatterns", "intervals", "arpeggios", "cadencesApproaches", "rhythm"] as const satisfies readonly RightHandEmphasis[];

const expectActiveHarmony = (exercise: Exercise) => {
  for (const event of exercise.rightHand) {
    const active = exercise.harmony.find((h) => h.onset <= event.onset && event.onset < h.onset + h.duration);
    expect(active).toBeDefined();
    expect(event.metadata.harmonyId).toBe(active!.id);
    if (event.pitches.length && event.metadata.metricStrength !== "weak" && !event.metadata.chromatic && !event.metadata.tieFromPrevious) {
      expect(chordPitches(exercise.tonalContext, active!).map((p) => p.midi % 12)).toContain(event.pitches[0]!.midi % 12);
    }
  }
};

describe("focused drills with changing harmony", () => {
  it.each(emphases)("keeps %s aligned with the mid-bar dominant and final tonic", (emphasis) => {
    const request = defaultTrainingRequest();
    request.tonal.keys = ["C major"];
    request.emphasis = emphasis;
    request.rhythm.style = "steady";
    request.rhythm.tieDensity = 0;
    request.rhythm.restDensity = 0;
    const exercise = generateExercise(request, 4);
    expect(exercise.harmony.find((h) => h.onset === 4800)?.rootDegree.degree).toBe(5);
    expectActiveHarmony(exercise);
    const last = exercise.rightHand.at(-1)!;
    const finalHarmony = exercise.harmony.at(-1)!;
    expect(last.metadata.harmonyId).toBe(finalHarmony.id);
    expect(last.pitches[0]!.midi % 12).toBe(realizeScaleDegree(exercise.tonalContext, finalHarmony.rootDegree).midi % 12);
  });

  it("preserves active harmony and deterministic generation across keys, rhythms, and drill modes", () => {
    fc.assert(fc.property(
      fc.integer(),
      fc.constantFrom(...emphases),
      fc.constantFrom("C major", "G major", "D major", "F major", "Bb major", "Eb major", "A minor", "D minor", "E minor"),
      fc.constantFrom("steady" as const, "mixed" as const, "challenge" as const),
      (seed, emphasis, key, style) => {
        const request = defaultTrainingRequest();
        request.tonal.keys = [key];
        request.emphasis = emphasis;
        request.rhythm.style = style;
        const exercise = generateExercise(request, seed);
        expectActiveHarmony(exercise);
        expect(generateExercise(request, seed)).toEqual(exercise);
      },
    ), { numRuns: 150 });
  });
});
