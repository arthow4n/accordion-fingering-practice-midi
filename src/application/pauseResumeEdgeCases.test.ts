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

describe("continuous pulse sight reading (no pause or jumping progress)", () => {
  it("case 1: positionMs advances smoothly and monotonically without jumping backward or freezing", () => {
    const req = parseTrainingRequest({
      ...defaultTrainingRequest(),
      hands: "right",
      rhythm: { ...defaultTrainingRequest().rhythm, meters: [{ beats: 3, beatUnit: 4 }] },
    });
    const exercise = generateExercise(req, 208098320);
    const firstNote = exercise.rightHand[0]!;
    const firstPitch = firstNote.pitches[0]!.midi;

    const session = new PracticeSession(exercise, "right", "sightReading", defaultTimingSettings());
    expect(session.positionMs(500)).toBe(0);

    // Start with note 1 at t=1000
    session.accept(midi(firstPitch, 1000));
    expect(session.started).toBe(true);

    // Position advances continuously
    const p1 = session.positionMs(1500);
    const p2 = session.positionMs(2000);
    const p3 = session.positionMs(3000);
    expect(p1).toBe(500);
    expect(p2).toBe(1000);
    expect(p3).toBe(2000);
    expect(p2).toBeGreaterThan(p1);
    expect(p3).toBeGreaterThan(p2);

    // User plays a wrong note at t=2500 - position continues steadily and does not jump or freeze
    session.accept(midi(firstPitch + 3, 2500));
    expect(session.positionMs(2600)).toBe(1600);
    expect(session.isWaiting(2600)).toBe(false);
  });

  it("case 2: playing wrong notes does not reset the session or clear completed notes", () => {
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

    // Later, player makes a mistake and plays the first pitch again (or wrong note)
    session.accept(midi(firstPitch, 2500));
    // The first note remains completed and timeline is NOT reset to 2500
    expect(session.completedIds.has(exercise.rightHand[0]!.id)).toBe(true);
    expect(session.positionMs(2500)).toBe(1500);
  });

  it("case 3: does not pause or wait when the user hesitates", () => {
    const req = parseTrainingRequest({
      ...defaultTrainingRequest(),
      hands: "right",
      rhythm: { ...defaultTrainingRequest().rhythm, meters: [{ beats: 3, beatUnit: 4 }] },
    });
    const exercise = generateExercise(req, 208098320);
    const firstPitch = exercise.rightHand[0]!.pitches[0]!.midi;
    const session = new PracticeSession(exercise, "right", "sightReading", defaultTimingSettings());

    session.accept(midi(firstPitch, 1000));
    // Even after several seconds of silence, isWaiting is always false
    expect(session.isWaiting(5000)).toBe(false);
    expect(session.positionMs(5000)).toBe(4000);
  });

  it("case 4: automatically finishes when the exercise duration has elapsed", () => {
    const ex = {
      ...generateExercise(defaultTrainingRequest(), 0),
      tempoBpm: 120, // 500ms per beat
      totalDuration: 960, // 2 beats = 1000ms
      rightHand: [
        { id: "rh-1", onset: 0, duration: 480, pitches: [{ midi: 69, name: "A4" }], hand: "right" as const, metadata: { challengeTags: [] } },
        { id: "rh-2", onset: 480, duration: 480, pitches: [{ midi: 72, name: "C5" }], hand: "right" as const, metadata: { challengeTags: [] } },
      ],
      leftHand: [],
    };
    const session = new PracticeSession(ex, "right", "sightReading", defaultTimingSettings());
    session.accept(midi(69, 1000));

    // At t=1500 (halfway), not finished
    expect(session.shouldFinish(1500)).toBe(false);

    // Total duration is 1000ms from start (t=2000), plus late tolerance (500ms at 120BPM veryForgiving) = t=2500
    expect(session.shouldFinish(2400)).toBe(false);
    expect(session.shouldFinish(2600)).toBe(true);

    const report = session.finish();
    expect(report.metrics.missedNotes).toBe(1); // second note was not played
    expect(session.done).toBe(true);
  });

  it("case 5: hands=both records both hands continuously", () => {
    const ex = {
      ...generateExercise(defaultTrainingRequest(), 0),
      tempoBpm: 120,
      totalDuration: 1920,
      rightHand: [
        { id: "rh-1", onset: 0, duration: 480, pitches: [{ midi: 69, name: "A4" }], hand: "right" as const, metadata: { challengeTags: [] } },
        { id: "rh-2", onset: 480, duration: 480, pitches: [{ midi: 76, name: "E5" }], hand: "right" as const, metadata: { challengeTags: [] } },
      ],
      leftHand: [
        { id: "lh-1", onset: 0, duration: 480, pitches: [{ midi: 57, name: "A3" }], hand: "left" as const, metadata: { challengeTags: [] } },
        { id: "lh-2", onset: 480, duration: 480, pitches: [{ midi: 57, name: "A3" }], hand: "left" as const, metadata: { challengeTags: [] } },
      ],
    };
    const session = new PracticeSession(ex, "both", "sightReading", defaultTimingSettings());
    // Start with LH at 1000
    session.accept(midi(57, 1000, "left"));
    expect(session.started).toBe(true);
    // Play RH at 1020
    session.accept(midi(69, 1020, "right"));
    expect(session.completedIds.has("lh-1")).toBe(true);
    expect(session.completedIds.has("rh-1")).toBe(true);
    expect(session.isWaiting(1500)).toBe(false);
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

  it("case 7: playing a wrong key does not skip future notes or jump the progress", () => {
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

    // Play note 1 at 1000ms
    session.accept(midi(69, 1000));
    expect(session.completedIds.has("rh-1")).toBe(true);

    // At onset 240 (~1200ms), user accidentally plays wrong note (midi 72)
    session.accept(midi(72, 1200));

    // Progress continues smoothly forward
    expect(session.positionMs(1200)).toBe(200);
    expect(session.isWaiting(1200)).toBe(false);
    expect(session.completedIds.has("rh-2")).toBe(false);
  });
});
