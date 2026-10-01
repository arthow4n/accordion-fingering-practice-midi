import { describe, expect, it } from "vitest";
import { PracticeSession } from "./practiceSession";
import { SightReadingCoordinator } from "./sightReadingCoordinator";
import { generateExercise } from "../core/generation/generateExercise";
import { defaultTrainingRequest, parseTrainingRequest } from "../core/training/trainingIntent";
import type { PerformedMidiEvent } from "../core/model";
import { defaultTimingSettings } from "../core/performance/timingSettings";

const midi = (midiNote: number, timestampMs: number, hand: "right" | "left" = "right", type: "noteOn" | "noteOff" = "noteOn"): PerformedMidiEvent => ({
  midiNote,
  timestampMs,
  hand,
  type,
  velocity: 100,
});

describe("pause / resume / restart edge cases", () => {
  it("case 1: user starts with a wrong note, pauses, then plays the correct first note", () => {
    const req = parseTrainingRequest({
      ...defaultTrainingRequest(),
      hands: "right",
      rhythm: { ...defaultTrainingRequest().rhythm, meters: [{ beats: 3, beatUnit: 4 }] },
    });
    const exercise = generateExercise(req, 208098320);
    const firstNote = exercise.rightHand[0]!;
    const firstPitch = firstNote.pitches[0]!.midi;

    const session = new PracticeSession(exercise, "right", "sightReading", defaultTimingSettings());
    // Start with a wrong note at t=1000
    session.accept(midi(firstPitch + 1, 1000));
    expect(session.started).toBe(true);
    // User hesitates for 3 seconds -> waiting state
    expect(session.isWaiting(4000)).toBe(true);
    expect(session.positionMs(4000)).toBe(0);

    // Now user plays the correct first note at t=4500
    session.accept(midi(firstPitch, 4500));
    expect(session.completedIds.has(firstNote.id)).toBe(true);
    expect(session.isWaiting(4500)).toBe(false);
  });

  it("case 2: user starts with wrong note, then while paused plays another wrong note, then the correct note", () => {
    const req = parseTrainingRequest({
      ...defaultTrainingRequest(),
      hands: "right",
      rhythm: { ...defaultTrainingRequest().rhythm, meters: [{ beats: 3, beatUnit: 4 }] },
    });
    const exercise = generateExercise(req, 208098320);
    const firstPitch = exercise.rightHand[0]!.pitches[0]!.midi;

    const session = new PracticeSession(exercise, "right", "sightReading", defaultTimingSettings());
    session.accept(midi(firstPitch + 1, 1000));
    expect(session.isWaiting(4000)).toBe(true);

    // Plays wrong note while paused
    session.accept(midi(firstPitch + 2, 4500));
    expect(session.completedIds.size).toBe(0);
    // Plays correct note 200ms later
    session.accept(midi(firstPitch, 4700));
    expect(session.completedIds.has(exercise.rightHand[0]!.id)).toBe(true);
    expect(session.isWaiting(4700)).toBe(false);
  });

  it("case 3: user plays note 1, hesitates on note 2, it backs off, then user plays note 1 to start exercise again", () => {
    const req = parseTrainingRequest({
      ...defaultTrainingRequest(),
      hands: "right",
      rhythm: { ...defaultTrainingRequest().rhythm, meters: [{ beats: 3, beatUnit: 4 }] },
    });
    const exercise = generateExercise(req, 208098320);
    const firstPitch = exercise.rightHand[0]!.pitches[0]!.midi;
    const session = new PracticeSession(exercise, "right", "sightReading", defaultTimingSettings());

    // Play first note correctly at t=1000
    session.accept(midi(firstPitch, 1000));
    expect(session.completedIds.has(exercise.rightHand[0]!.id)).toBe(true);

    // Hesitate on note 2 for 3 seconds -> it backs off
    expect(session.isWaiting(4000)).toBe(true);

    // User wants to start the exercise again from the accordion: plays note 1 at t=4500!
    session.accept(midi(firstPitch, 4500));
    expect(session.completedIds.has(exercise.rightHand[0]!.id)).toBe(true);
    expect(session.isWaiting(4500)).toBe(false);
  });

  it("case 4: arpeggio exercise with distinct pitches - user hesitates on note 2 and plays note 1 again", () => {
    // Note 1: 69 (A4), Note 2: 76 (E5), Note 3: 72 (C5)
    const ex = {
      ...generateExercise(defaultTrainingRequest(), 0),
      tempoBpm: 72,
      totalDuration: 1920,
      rightHand: [
        { id: "rh-1", onset: 0, duration: 240, pitches: [{ midi: 69, name: "A4" }], hand: "right" as const, metadata: { challengeTags: [] } },
        { id: "rh-2", onset: 240, duration: 240, pitches: [{ midi: 76, name: "E5" }], hand: "right" as const, metadata: { challengeTags: [] } },
        { id: "rh-3", onset: 480, duration: 240, pitches: [{ midi: 72, name: "C5" }], hand: "right" as const, metadata: { challengeTags: [] } },
      ],
      leftHand: [],
    };
    const session = new PracticeSession(ex, "right", "sightReading", defaultTimingSettings());
    // User plays note 1 correctly at 1000
    session.accept(midi(69, 1000));
    expect(session.completedIds.has("rh-1")).toBe(true);
    // User hesitates on note 2 -> paused at t=4000
    expect(session.isWaiting(4000)).toBe(true);

    // User plays note 1 (69) to start exercise again!
    session.accept(midi(69, 4500));
    expect(session.completedIds.has("rh-1")).toBe(true);
    expect(session.completedIds.has("rh-2")).toBe(false);
    expect(session.isWaiting(4500)).toBe(false);
  });

  it("case 5: hands=both, paused at onset 0, user plays LH then RH", () => {
    const ex = {
      ...generateExercise(defaultTrainingRequest(), 0),
      tempoBpm: 72,
      totalDuration: 1920,
      rightHand: [
        { id: "rh-1", onset: 0, duration: 240, pitches: [{ midi: 69, name: "A4" }], hand: "right" as const, metadata: { challengeTags: [] } },
        { id: "rh-2", onset: 240, duration: 240, pitches: [{ midi: 76, name: "E5" }], hand: "right" as const, metadata: { challengeTags: [] } },
      ],
      leftHand: [
        { id: "lh-1", onset: 0, duration: 480, pitches: [{ midi: 57, name: "A3" }], hand: "left" as const, metadata: { challengeTags: [] } },
        { id: "lh-2", onset: 480, duration: 480, pitches: [{ midi: 57, name: "A3" }], hand: "left" as const, metadata: { challengeTags: [] } },
      ],
    };
    const session = new PracticeSession(ex, "both", "sightReading", defaultTimingSettings());
    // Start with wrong note
    session.accept(midi(60, 1000));
    expect(session.isWaiting(4000)).toBe(true);

    // Play LH at 4500
    session.accept(midi(57, 4500, "left"));
    expect(session.completedIds.has("lh-1")).toBe(true);
    // Play RH at 4550
    session.accept(midi(69, 4550, "right"));
    expect(session.completedIds.has("rh-1")).toBe(true);
    expect(session.completedIds.has("lh-1")).toBe(true);
  });

  it("case 6: SightReadingCoordinator ignores unselected hand in ready state without starting", () => {
    const ex = {
      ...generateExercise(defaultTrainingRequest(), 0),
      tempoBpm: 72,
      totalDuration: 1920,
      rightHand: [
        { id: "rh-1", onset: 0, duration: 240, pitches: [{ midi: 69, name: "A4" }], hand: "right" as const, metadata: { challengeTags: [] } },
      ],
      leftHand: [],
    };
    const coordinator = new SightReadingCoordinator({
      exercise: ex,
      hands: "right",
      timing: defaultTimingSettings(),
      onNextExercise: () => ex,
    });

    expect(coordinator.status).toBe("ready");
    // Left hand note on a right-hand only exercise
    const res = coordinator.acceptMidi(midi(57, 1000, "left"));
    expect(res.action).toBe("consumed");
    expect(coordinator.status).toBe("ready");
    expect(coordinator.session.started).toBe(false);

    // Now right hand note starts it
    const res2 = coordinator.acceptMidi(midi(69, 1100, "right"));
    expect(res2.action).toBe("started");
    expect(coordinator.status).toBe("playing");
    expect(coordinator.session.started).toBe(true);
  });

  it("case 7: does not jump several steps ahead when pushing a future key while paused at note 2", () => {
    // Arpeggio: Am (A4, E5, C5, E5, A4, C5)
    // Onsets: 0 (69), 240 (76), 480 (72), 720 (76), 960 (69), 1200 (72)
    const ex = {
      ...generateExercise(defaultTrainingRequest(), 0),
      tempoBpm: 72,
      totalDuration: 1920,
      rightHand: [
        { id: "rh-1", onset: 0, duration: 240, pitches: [{ midi: 69, name: "A4" }], hand: "right" as const, metadata: { challengeTags: [] } },
        { id: "rh-2", onset: 240, duration: 240, pitches: [{ midi: 76, name: "E5" }], hand: "right" as const, metadata: { challengeTags: [] } },
        { id: "rh-3", onset: 480, duration: 240, pitches: [{ midi: 72, name: "C5" }], hand: "right" as const, metadata: { challengeTags: [] } },
        { id: "rh-4", onset: 720, duration: 240, pitches: [{ midi: 76, name: "E5" }], hand: "right" as const, metadata: { challengeTags: [] } },
        { id: "rh-5", onset: 960, duration: 240, pitches: [{ midi: 69, name: "A4" }], hand: "right" as const, metadata: { challengeTags: [] } },
        { id: "rh-6", onset: 1200, duration: 240, pitches: [{ midi: 72, name: "C5" }], hand: "right" as const, metadata: { challengeTags: [] } },
      ],
      leftHand: [],
    };
    const session = new PracticeSession(ex, "right", "sightReading", defaultTimingSettings());

    // Play note 1 at 1000ms
    session.accept(midi(69, 1000));
    expect(session.completedIds.has("rh-1")).toBe(true);

    // Pause on note 2 (onset 240, pitch 76)
    expect(session.isWaiting(4000)).toBe(true);

    // User pushes pitch 72 (C5, which is note 3 at onset 480) at 4500ms
    session.accept(midi(72, 4500));

    // It must NOT jump ahead to note 3! Note 2 must still be pending.
    expect(session.completedIds.has("rh-3")).toBe(false);
    expect(session.completedIds.has("rh-2")).toBe(false);
    expect(session.isWaiting(4500)).toBe(true);

    // Now user plays the correct note 2 (pitch 76, E5) at 4700ms
    session.accept(midi(76, 4700));

    // It resumes cleanly AT NOTE 2 (the right place) without skipping ahead
    expect(session.completedIds.has("rh-2")).toBe(true);
    expect(session.completedIds.has("rh-3")).toBe(false);
    expect(session.isWaiting(4700)).toBe(false);
    expect(session.currentExpected("right")?.id).toBe("rh-3");
  });
});
