import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { accordionProfile } from "../instrument/accordionProfile";
import type { Exercise } from "../model";
import { chordPitches } from "../music/harmony";
import { createExpectedTimeline } from "../performance/timeline";
import { defaultTrainingRequest } from "../training/trainingIntent";
import { generateExercise } from "./generateExercise";
import { validateExercise } from "./validateExercise";

const expectCadenceClosure = (exercise: Exercise) => {
  const final = exercise.rightHand.filter((event) => event.pitches.length).at(-1)!;
  const harmony = exercise.harmony.find((h) => h.onset <= final.onset && final.onset < h.onset + h.duration)!;
  expect(final.metadata.harmonyId).toBe(harmony.id);
  expect(chordPitches(exercise.tonalContext, harmony).map((p) => p.midi % 12)).toContain(final.pitches[0]!.midi % 12);
  if (final.metadata.cadenceType === "strongTonic" && harmony.rootDegree.degree === 1) {
    expect(final.metadata.scaleDegree?.degree).toBe(1);
  }
  expect(validateExercise(exercise, accordionProfile).errors).toEqual([]);
  for (let index = 1; index < exercise.rightHand.length; index++) {
    const event = exercise.rightHand[index]!;
    if (event.metadata.tieFromPrevious) {
      const previous = exercise.rightHand[index - 1]!;
      expect(previous.metadata.tieToNext).toBe(true);
      expect(event.pitches).toEqual(previous.pitches);
    }
  }
};

describe("cadence arrival in general practice", () => {
  it.each([
    ["C major", 5, "steady", 0],
    ["D minor", 5, "steady", 0],
    ["C major", 5, "mixed", 1],
    ["D minor", 5, "mixed", 1],
    ["C major", 109, "mixed", 0],
    ["C major", 136, "mixed", 0],
  ] as const)("resolves %s seed %i with %s rhythm and tie density %i", (key, seed, style, tieDensity) => {
    const request = defaultTrainingRequest();
    request.tonal.keys = [key];
    request.rhythm.style = style;
    request.rhythm.tieDensity = tieDensity;
    request.rhythm.restDensity = 0;
    const exercise = generateExercise(request, seed);
    expectCadenceClosure(exercise);
    if (seed === 109) {
      const arrival = exercise.rightHand.find((event) => event.onset === 6720)!;
      expect(arrival.metadata.scaleDegree?.degree).toBe(1);
      expect(arrival.metadata.tieFromPrevious).toBe(false);
      expect(createExpectedTimeline(exercise).some((event) => event.hand === "right" && event.onset === 6720)).toBe(true);
    }
  });

  it("preserves closing harmony, ties, timelines, and determinism across seeds and keys", () => {
    fc.assert(fc.property(
      fc.integer(),
      fc.constantFrom("C major", "G major", "D major", "F major", "Bb major", "Eb major", "A minor", "D minor", "E minor"),
      fc.constantFrom("steady" as const, "mixed" as const, "challenge" as const),
      fc.constantFrom(0, 1),
      (seed, key, style, tieDensity) => {
        const request = defaultTrainingRequest();
        request.tonal.keys = [key];
        request.rhythm.style = style;
        request.rhythm.tieDensity = tieDensity;
        const exercise = generateExercise(request, seed);
        expectCadenceClosure(exercise);
        expect(generateExercise(request, seed)).toEqual(exercise);
      },
    ), { numRuns: 200 });
  });
});
