import { describe, expect, it } from "vitest";
import { defaultTrainingRequest } from "../training/trainingIntent";
import { generateExercise } from "./generateExercise";
import { computeStructuralSignature } from "./structuralSignature";

describe("procedural generator population diversity", () => {
  it("produces broad structural variety across 120 deterministic seeds", () => {
    const request = defaultTrainingRequest();
    request.emphasis = "everything";

    const archetypes = new Set<string>();
    const contours = new Set<string>();
    const harmonicPaths = new Set<string>();
    const cadenceTypes = new Set<string>();
    const cadenceContours = new Set<string>();
    const cadenceRhythms = new Set<string>();
    const finalScaleDegrees = new Set<number>();
    const arrivalBeats = new Set<number>();
    const transformations = new Set<string>();
    const gestures = new Set<string>();

    const totalSeeds = 120;
    for (let seed = 1; seed <= totalSeeds; seed++) {
      const exercise = generateExercise(request, seed);
      const sig = computeStructuralSignature(exercise);

      archetypes.add(sig.phraseArchetype);
      contours.add(sig.contour);
      harmonicPaths.add(sig.harmonicFunctions.join("→"));
      cadenceTypes.add(sig.cadenceType);
      cadenceContours.add(sig.cadenceContour);
      cadenceRhythms.add(sig.cadenceRhythm);
      if (sig.finalScaleDegree !== undefined) finalScaleDegrees.add(sig.finalScaleDegree);
      if (sig.arrivalBeat !== undefined) arrivalBeats.add(sig.arrivalBeat);

      for (const section of exercise.phrase) {
        transformations.add(section.transformation);
      }
      for (const ev of exercise.rightHand) {
        if (ev.metadata.gestureType) gestures.add(ev.metadata.gestureType);
      }
    }

    // Meaningful lower bounds verifying no structural collapse
    expect(archetypes.size).toBeGreaterThanOrEqual(3);
    expect(contours.size).toBeGreaterThanOrEqual(4);
    expect(harmonicPaths.size).toBeGreaterThanOrEqual(5);
    expect(cadenceTypes.size).toBeGreaterThanOrEqual(2);
    expect(cadenceContours.size).toBeGreaterThanOrEqual(3);
    expect(cadenceRhythms.size).toBeGreaterThanOrEqual(2);
    // Final scale degrees should explore more than just 1 (e.g. 1, 3, 5)
    expect(finalScaleDegrees.size).toBeGreaterThanOrEqual(2);
    expect(arrivalBeats.size).toBeGreaterThanOrEqual(2);
    expect(transformations.size).toBeGreaterThanOrEqual(4);
    expect(gestures.size).toBeGreaterThanOrEqual(4);
  });

  it("avoids excessive structural signature repetition across consecutive seeds", () => {
    const request = defaultTrainingRequest();
    request.emphasis = "everything";

    const signatures: string[] = [];
    const count = 50;

    for (let seed = 1000; seed < 1000 + count; seed++) {
      const exercise = generateExercise(request, seed);
      const sig = computeStructuralSignature(exercise);
      signatures.push(JSON.stringify(sig));
    }

    // Verify consecutive exercises rarely duplicate identical structural signatures
    let consecutiveIdentical = 0;
    for (let i = 1; i < signatures.length; i++) {
      if (signatures[i] === signatures[i - 1]) {
        consecutiveIdentical++;
      }
    }

    // At most 2 duplicate adjacent signatures across 50 consecutive seeds
    expect(consecutiveIdentical).toBeLessThanOrEqual(2);
    // High overall diversity
    expect(new Set(signatures).size).toBeGreaterThanOrEqual(30);
  });
});
