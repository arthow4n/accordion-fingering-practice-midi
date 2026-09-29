import { describe, expect, it } from "vitest";
import type { Exercise, ExerciseEvent, Hand, PerformedMidiEvent } from "../model";
import { generateExercise } from "../generation/generateExercise";
import { defaultTrainingRequest } from "../training/trainingIntent";
import { deriveReviewAnnotations } from "./reviewAnnotations";
import { matchEvents, type EventMatch } from "./eventMatcher";
import { createExpectedTimeline } from "./timeline";
import { computeMetrics } from "./performanceMetrics";
import type { PerformanceReport } from "./evaluatePerformance";

const note = (
  onset: number,
  pitches: { midi: number; name: string }[],
  hand: Hand = "right",
  duration = 480
): ExerciseEvent => ({
  id: `${hand}-${onset}`,
  onset,
  duration,
  pitches,
  hand,
  metadata: { challengeTags: [] },
});

const base = generateExercise(defaultTrainingRequest(), 0);
const createExercise = (rightHand: ExerciseEvent[], leftHand: ExerciseEvent[] = []): Exercise => ({
  ...base,
  tempoBpm: 120,
  totalDuration: 1920,
  rightHand,
  leftHand,
});

const midi = (
  midiNote: number,
  timestampMs: number,
  hand: Hand = "right",
  type: "noteOn" | "noteOff" = "noteOn"
): PerformedMidiEvent => ({
  midiNote,
  timestampMs,
  hand,
  type,
  velocity: 100,
});

describe("deriveReviewAnnotations", () => {
  it("maps wrong pitch to expected-note error and played-note ghost annotation", () => {
    // Expected F#4 (midi 66), performed F4 (midi 65)
    const target = note(0, [{ midi: 66, name: "F#4" }]);
    const exercise = createExercise([target]);
    const timeline = createExpectedTimeline(exercise, 1000);
    const performed = [midi(65, 1000)];
    const matches = matchEvents(timeline, performed);
    const report: PerformanceReport = {
      matches,
      metrics: computeMetrics(matches, 500),
    };

    const annotations = deriveReviewAnnotations(report, exercise);
    expect(annotations).toHaveLength(1);
    expect(annotations[0]).toEqual({
      kind: "wrongPitch",
      expectedEventId: target.id,
      playedMidiNotes: [65],
    });
  });

  it("identifies played wrong notes for chord events", () => {
    // Expected C4 and E4, performed D4 (62) and F4 (65)
    const target = note(0, [
      { midi: 60, name: "C4" },
      { midi: 64, name: "E4" },
    ]);
    const exercise = createExercise([target]);
    const timeline = createExpectedTimeline(exercise, 1000);
    const performed = [midi(62, 1000), midi(65, 1010)];
    const matches = matchEvents(timeline, performed);

    const annotations = deriveReviewAnnotations(matches, exercise);
    expect(annotations).toEqual(
      expect.arrayContaining([
        {
          kind: "wrongPitch",
          expectedEventId: target.id,
          playedMidiNotes: [62],
        },
        {
          kind: "extra",
          musicalPosition: expect.any(Number),
          playedMidiNotes: [65],
        },
      ])
    );
  });

  it("maps missed note without performed attack to missed annotation", () => {
    const target = note(0, [{ midi: 60, name: "C4" }]);
    const exercise = createExercise([target]);
    const timeline = createExpectedTimeline(exercise, 1000);
    const matches = matchEvents(timeline, []);

    const annotations = deriveReviewAnnotations(matches, exercise);
    expect(annotations).toHaveLength(1);
    expect(annotations[0]).toEqual({
      kind: "missed",
      expectedEventId: target.id,
    });
  });

  it("maps unassigned performed attack to extra-note annotation", () => {
    const target = note(0, [{ midi: 60, name: "C4" }]);
    const exercise = createExercise([target]);
    const timeline = createExpectedTimeline(exercise, 1000);
    // 60 is correct at 1000ms. 70 at 1400ms is unassigned/extra.
    const performed = [midi(60, 1000), midi(70, 1400)];
    const matches = matchEvents(timeline, performed);

    const annotations = deriveReviewAnnotations(matches, exercise);
    const extra = annotations.find(a => a.kind === "extra");
    expect(extra).toBeDefined();
    expect(extra).toEqual({
      kind: "extra",
      musicalPosition: expect.any(Number),
      playedMidiNotes: [70],
    });
  });

  it("maps timing errors (early/late) to timing annotations rather than pitch errors", () => {
    const targetEarly = note(0, [{ midi: 60, name: "C4" }]);
    const targetLate = note(480, [{ midi: 62, name: "D4" }]);
    const exercise = createExercise([targetEarly, targetLate]);
    const timeline = createExpectedTimeline(exercise, 1000);

    const earlyMatch: EventMatch = {
      expected: timeline[0]!,
      performed: [midi(60, 850)],
      classification: "early",
      timingErrorMs: -150,
    };
    const lateMatch: EventMatch = {
      expected: timeline[1]!,
      performed: [midi(62, 1650)],
      classification: "late",
      timingErrorMs: 150,
    };

    const annotations = deriveReviewAnnotations([earlyMatch, lateMatch], exercise);
    expect(annotations).toEqual([
      {
        kind: "timing",
        expectedEventId: targetEarly.id,
        direction: "early",
      },
      {
        kind: "timing",
        expectedEventId: targetLate.id,
        direction: "late",
      },
    ]);
  });

  it("produces no review annotation for correct, on-time events", () => {
    const target = note(0, [{ midi: 60, name: "C4" }]);
    const exercise = createExercise([target]);
    const timeline = createExpectedTimeline(exercise, 1000);
    const performed = [midi(60, 1000)];
    const matches = matchEvents(timeline, performed);

    const annotations = deriveReviewAnnotations(matches, exercise);
    expect(annotations).toEqual([]);
  });
});
