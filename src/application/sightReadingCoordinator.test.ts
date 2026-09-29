import { describe, expect, it } from "vitest";
import type { Exercise, ExerciseEvent, Hand, PerformedMidiEvent } from "../core/model";
import { generateExercise } from "../core/generation/generateExercise";
import { defaultTrainingRequest } from "../core/training/trainingIntent";
import { defaultTimingSettings } from "../core/performance/timingSettings";
import { SightReadingCoordinator } from "./sightReadingCoordinator";

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

describe("SightReadingCoordinator lifecycle", () => {
  it("transitions ready -> playing on first MIDI attack", () => {
    const exercise = createExercise([note(0, [{ midi: 60, name: "C4" }])]);
    const coordinator = new SightReadingCoordinator({
      exercise,
      hands: "right",
      timing: defaultTimingSettings(),
      onNextExercise: () => exercise,
    });

    expect(coordinator.status).toBe("ready");
    expect(coordinator.session.started).toBe(false);

    coordinator.acceptMidi(midi(60, 1000));
    expect(coordinator.status).toBe("playing");
    expect(coordinator.session.started).toBe(true);
  });

  it("handles natural completion: ready -> playing -> finishes -> status = review, keeping same exercise", () => {
    const exercise = createExercise([
      note(0, [{ midi: 60, name: "C4" }]),
      note(480, [{ midi: 62, name: "D4" }]),
    ]);
    const coordinator = new SightReadingCoordinator({
      exercise,
      hands: "right",
      timing: defaultTimingSettings(),
      onNextExercise: () => exercise,
    });

    coordinator.acceptMidi(midi(60, 1000));
    coordinator.acceptMidi(midi(62, 1500));
    expect(coordinator.status).toBe("playing");

    // Natural finish triggered when session time finishes
    const report = coordinator.finish();
    expect(coordinator.status).toBe("review");
    expect(coordinator.exercise).toBe(exercise); // Same exercise remains displayed!
    expect(report.metrics.pitchAccuracy).toBe(1);
    expect(coordinator.reviewAnnotations).toHaveLength(0); // Perfect performance
  });

  it("handles manual finish: playing -> Finish exercise -> review, remaining unperformed events appear as missed", () => {
    const note1 = note(0, [{ midi: 60, name: "C4" }]);
    const note2 = note(480, [{ midi: 62, name: "D4" }]);
    const exercise = createExercise([note1, note2]);
    const coordinator = new SightReadingCoordinator({
      exercise,
      hands: "right",
      timing: defaultTimingSettings(),
      onNextExercise: () => exercise,
    });

    coordinator.acceptMidi(midi(60, 1000));
    expect(coordinator.status).toBe("playing");

    // Player manually presses "Finish exercise" before note2
    const report = coordinator.finish();
    expect(coordinator.status).toBe("review");
    expect(coordinator.exercise).toBe(exercise);
    expect(report.metrics.missedNotes).toBe(1);

    // Note 2 appears as missed
    const missedAnn = coordinator.reviewAnnotations.find(a => a.kind === "missed");
    expect(missedAnn).toBeDefined();
    expect(missedAnn).toEqual({
      kind: "missed",
      expectedEventId: note2.id,
    });
  });

  it("noteOff while reviewing does not leave review", () => {
    const exercise = createExercise([note(0, [{ midi: 60, name: "C4" }])]);
    const coordinator = new SightReadingCoordinator({
      exercise,
      hands: "right",
      timing: defaultTimingSettings(),
      onNextExercise: () => exercise,
    });

    coordinator.acceptMidi(midi(60, 1000));
    coordinator.finish();
    expect(coordinator.status).toBe("review");

    // A note-off while reviewing does not leave review
    const res = coordinator.acceptMidi(midi(60, 2000, "right", "noteOff"));
    expect(coordinator.status).toBe("review");
    expect(res.action).toBe("none");
  });

  it("dismisses review on noteOn: generates next exercise, status = ready, and consumes dismissal event", () => {
    const ex1 = createExercise([note(0, [{ midi: 60, name: "C4" }])]);
    const ex2 = createExercise([note(0, [{ midi: 62, name: "D4" }])]);
    let generated = false;

    const coordinator = new SightReadingCoordinator({
      exercise: ex1,
      hands: "right",
      timing: defaultTimingSettings(),
      onNextExercise: () => {
        generated = true;
        return ex2;
      },
    });

    coordinator.acceptMidi(midi(60, 1000));
    coordinator.finish();
    expect(coordinator.status).toBe("review");
    expect(coordinator.exercise).toBe(ex1);

    // Press any key to dismiss review (e.g. note 70 at 2500ms)
    const dismissRes = coordinator.acceptMidi(midi(70, 2500, "right", "noteOn"));
    expect(dismissRes.action).toBe("dismissedReview");
    expect(generated).toBe(true);
    expect(coordinator.status).toBe("ready");
    expect(coordinator.exercise).toBe(ex2);

    // Verify dismissal MIDI note was consumed:
    // - does not enter the next performance
    expect(coordinator.session.performed).toHaveLength(0);
    // - does not start the next clock
    expect(coordinator.session.started).toBe(false);

    // Accompanying notes from a chord burst during dismissal (e.g. at 2520ms) are also consumed
    const burstRes = coordinator.acceptMidi(midi(74, 2520, "right", "noteOn"));
    expect(burstRes.action).toBe("consumed");
    expect(coordinator.status).toBe("ready");
    expect(coordinator.session.started).toBe(false);
    expect(coordinator.session.performed).toHaveLength(0);

    // Releases of the dismissal notes do not start anything
    coordinator.acceptMidi(midi(70, 2600, "right", "noteOff"));
    coordinator.acceptMidi(midi(74, 2610, "right", "noteOff"));
    expect(coordinator.status).toBe("ready");
    expect(coordinator.session.started).toBe(false);

    // Only a subsequent MIDI attack starts the new exercise
    const attackRes = coordinator.acceptMidi(midi(62, 3000, "right", "noteOn"));
    expect(attackRes.action).toBe("started");
    expect(coordinator.status).toBe("playing");
    expect(coordinator.session.started).toBe(true);
    expect(coordinator.session.performed).toHaveLength(1);
    expect(coordinator.session.performed[0]!.midiNote).toBe(62);
  });
});
