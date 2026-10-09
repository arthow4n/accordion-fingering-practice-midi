import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SightReadingCoordinator } from "../../application/sightReadingCoordinator";
import { generateExercise } from "../../core/generation/generateExercise";
import { defaultTrainingRequest } from "../../core/training/trainingIntent";
import {
  createReviewMidiEvents,
  getBridge,
  registerBridge,
  type AccordionBridge,
  type BridgeState,
} from "./virtualMidiBridge";

describe("virtualMidiBridge", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    Object.defineProperty(globalThis, "window", {
      value: {} as Window & typeof globalThis,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
  });

  it("registers and unregisters on window globals", () => {
    const mockState: BridgeState = {
      mode: "sightReading",
      status: "ready",
      waiting: false,
      positionMs: 0,
      playheadOnset: undefined,
      markedOnset: undefined,
      exercise: generateExercise(defaultTrainingRequest(), 1),
      metrics: undefined,
      reviewAnnotations: [],
      sessionStats: {
        completedExercises: 0,
        completedEvents: 0,
        attempts: 0,
        correct: 0,
        timingCorrect: 0,
        missed: 0,
        extra: 0,
      },
      devices: [],
      settings: defaultTrainingRequest(),
      seed: 1,
    };

    const mockBridge: AccordionBridge = {
      getState: () => mockState,
      sendEvent: vi.fn(),
      sendNoteOn: vi.fn(),
      sendNoteOff: vi.fn(),
      sendDeviceNames: vi.fn(),
      playNextNote: vi.fn().mockReturnValue(true),
      fastForwardToReview: vi.fn(),
      simulatePause: vi.fn(),
      dismissReview: vi.fn(),
      setMode: vi.fn(),
      resetSession: vi.fn(),
      resetStats: vi.fn(),
      regenerate: vi.fn(),
      setLatency: vi.fn(),
      getLatency: vi.fn().mockReturnValue(0),
    };

    expect(getBridge()).toBeUndefined();
    const unregister = registerBridge(mockBridge);

    expect(getBridge()).toBe(mockBridge);
    expect(window.accordionBridge).toBe(mockBridge);
    expect(window.__accordionBridge).toBe(mockBridge);
    expect(mockBridge.getState().status).toBe("ready");
    expect(mockBridge.getLatency?.()).toBe(0);
    mockBridge.setLatency?.(40);
    expect(mockBridge.setLatency).toHaveBeenCalledWith(40);
    mockBridge.resetStats?.();
    expect(mockBridge.resetStats).toHaveBeenCalled();

    unregister();
    expect(getBridge()).toBeUndefined();
    expect(window.accordionBridge).toBeUndefined();
    expect(window.__accordionBridge).toBeUndefined();
  });

  it("generates deterministic performed MIDI events for review simulation", () => {
    const exercise = generateExercise(defaultTrainingRequest(), 42);
    const events = createReviewMidiEvents(exercise, "both", 2, 1000);

    expect(events.length).toBeGreaterThan(0);
    // Events must be ordered by timestamp
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.timestampMs).toBeGreaterThanOrEqual(events[i - 1]!.timestampMs);
    }

    // Every noteOn should have a corresponding noteOff
    const noteOns = events.filter(e => e.type === "noteOn");
    const noteOffs = events.filter(e => e.type === "noteOff");
    expect(noteOns.length).toBe(noteOffs.length);

    // Initial note starts near base timestamp
    expect(events[0]!.timestampMs).toBeGreaterThanOrEqual(1000);
  });

  it("handles 0 mistakes cleanly", () => {
    const exercise = generateExercise(defaultTrainingRequest(), 99);
    const events = createReviewMidiEvents(exercise, "right", 0, 0);

    expect(events.length).toBeGreaterThan(0);
    // All events belong to the right hand
    for (const e of events) {
      expect(e.hand).toBe("right");
    }
  });

  it("drives SightReadingCoordinator from ready -> playing -> review -> dismissed", () => {
    const settings = defaultTrainingRequest();
    const exercise = generateExercise(settings, 12);
    const coordinator = new SightReadingCoordinator({
      exercise,
      hands: settings.hands,
      timing: settings.timing,
      onNextExercise: () => exercise,
    });

    expect(coordinator.status).toBe("ready");

    const events = createReviewMidiEvents(exercise, settings.hands, 2, 2000);
    expect(events.length).toBeGreaterThan(0);

    for (const event of events) {
      coordinator.acceptMidi(event);
    }

    expect(coordinator.status).toBe("playing");

    const report = coordinator.finish();
    expect(coordinator.status).toBe("review");
    expect(report.metrics.pitchAccuracy).toBeLessThan(1.0);
    expect(coordinator.reviewAnnotations.length).toBeGreaterThan(0);

    // Dismiss review with any noteOn
    const dismissRes = coordinator.acceptMidi({
      midiNote: 60,
      type: "noteOn",
      timestampMs: 50000,
      velocity: 80,
    });
    expect(dismissRes.action).toBe("dismissedReview");
    expect(coordinator.status).toBe("ready");
  });

  it("maintains continuous pulse without hesitation waiting in SightReadingCoordinator", () => {
    const settings = defaultTrainingRequest();
    const exercise = generateExercise(settings, 12);
    const coordinator = new SightReadingCoordinator({
      exercise,
      hands: settings.hands,
      timing: settings.timing,
      onNextExercise: () => exercise,
    });

    const target = coordinator.session.expected[0]!;
    const past = 1000;
    const res = coordinator.acceptMidi({
      midiNote: target.pitches[0]!.midi,
      type: "noteOn",
      timestampMs: past,
      velocity: 80,
      hand: target.hand,
    });
    expect(res.action).toBe("started");
    expect(coordinator.status).toBe("playing");
    expect(coordinator.session.started).toBe(true);

    // After 5 seconds, clock continues and session does not pause/wait
    const later = past + 5000;
    expect(coordinator.session.isWaiting(later)).toBe(false);
  });
});
