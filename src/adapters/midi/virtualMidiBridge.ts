import type { Exercise, Hand, PerformedMidiEvent } from "../../core/model";
import { createExpectedTimeline, ticksToMs } from "../../core/performance/timeline";
import type { ReviewAnnotation } from "../../core/performance/reviewAnnotations";
import type { PerformanceMetrics } from "../../core/performance/performanceMetrics";
import type { RuntimeMode } from "../persistence/settingsPersistence";
import type { SightReadingStatus } from "../../application/sightReadingCoordinator";
import type { TrainingRequest } from "../../core/training/trainingIntent";

export interface BridgeSessionStats {
  completedExercises: number;
  completedEvents: number;
  attempts: number;
  correct: number;
  timingCorrect: number;
  missed: number;
  extra: number;
}

export interface BridgeState {
  mode: RuntimeMode;
  status: SightReadingStatus;
  waiting: boolean;
  positionMs: number;
  playheadOnset: number | undefined;
  markedOnset: number | undefined;
  exercise: Exercise;
  metrics: PerformanceMetrics | undefined;
  reviewAnnotations: ReviewAnnotation[];
  sessionStats: BridgeSessionStats;
  devices: string[];
  settings: TrainingRequest;
  seed: number;
}

export interface PlayNextNoteOptions {
  mistake?: boolean;
  hand?: Hand;
}

export interface FastForwardReviewOptions {
  mistakeCount?: number;
}

export interface AccordionBridge {
  getState: () => BridgeState;
  sendEvent: (event: PerformedMidiEvent) => void;
  sendNoteOn: (midiNote: number, options?: { hand?: Hand; velocity?: number; timestampMs?: number }) => void;
  sendNoteOff: (midiNote: number, options?: { hand?: Hand; timestampMs?: number }) => void;
  sendDeviceNames: (names: string[]) => void;
  playNextNote: (options?: PlayNextNoteOptions) => boolean;
  fastForwardToReview: (options?: FastForwardReviewOptions) => void;
  simulatePause: () => void;
  dismissReview: () => void;
  setMode: (mode: RuntimeMode) => void;
  resetSession: () => void;
  regenerate: (seed?: number) => void;
  setLatency?: (latencyMs: number) => void;
  getLatency?: () => number;
}

declare global {
  interface Window {
    accordionBridge?: AccordionBridge;
    __accordionBridge?: AccordionBridge;
  }
}

/**
 * Deterministically generates a timeline of performed MIDI events simulating
 * an exercise run with optional simulated mistakes (omissions and wrong notes).
 */
export const createReviewMidiEvents = (
  exercise: Exercise,
  hands: "both" | Hand,
  mistakeCount = 2,
  baseTimestampMs = performance.now()
): PerformedMidiEvent[] => {
  const timeline = createExpectedTimeline({
    ...exercise,
    rightHand: hands === "left" ? [] : exercise.rightHand,
    leftHand: hands === "right" ? [] : exercise.leftHand,
  });

  if (!timeline.length) return [];

  const count = Math.min(mistakeCount, Math.max(0, timeline.length - 1));
  const mistakeIndices = new Set<number>();
  if (count > 0) {
    const step = Math.max(1, Math.floor(timeline.length / (count + 1)));
    for (let i = 1; i <= count; i++) {
      mistakeIndices.add(Math.min(timeline.length - 1, i * step));
    }
  }

  const events: PerformedMidiEvent[] = [];
  let mistakeCounter = 0;

  for (let idx = 0; idx < timeline.length; idx++) {
    const expected = timeline[idx]!;
    const isMistake = mistakeIndices.has(idx);

    if (isMistake) {
      mistakeCounter++;
      // Alternate between missing a note completely and playing a wrong pitch
      if (mistakeCounter % 2 === 1) {
        // Missed note: no event performed
        continue;
      }
      // Wrong pitch: play pitch + 1
      const wrongPitch = expected.pitches[0] ? expected.pitches[0].midi + 1 : 60;
      const attackTime = baseTimestampMs + expected.expectedMs;
      events.push({
        midiNote: wrongPitch,
        type: "noteOn",
        timestampMs: attackTime,
        velocity: 80,
        hand: expected.hand,
      });
      events.push({
        midiNote: wrongPitch,
        type: "noteOff",
        timestampMs: attackTime + Math.min(200, ticksToMs(expected.duration, exercise.tempoBpm) * 0.8),
        velocity: 0,
        hand: expected.hand,
      });
      continue;
    }

    const attackTime = baseTimestampMs + expected.expectedMs;
    const noteDurationMs = Math.min(300, Math.max(50, ticksToMs(expected.duration, exercise.tempoBpm) * 0.85));

    for (const pitch of expected.pitches) {
      events.push({
        midiNote: pitch.midi,
        type: "noteOn",
        timestampMs: attackTime,
        velocity: 85,
        hand: expected.hand,
      });
      events.push({
        midiNote: pitch.midi,
        type: "noteOff",
        timestampMs: attackTime + noteDurationMs,
        velocity: 0,
        hand: expected.hand,
      });
    }
  }

  return events.sort((a, b) => a.timestampMs - b.timestampMs);
};

const getWindow = (): (Window & typeof globalThis) | undefined => {
  if (typeof window !== "undefined") return window;
  if (typeof globalThis !== "undefined" && (globalThis as unknown as { window?: Window & typeof globalThis }).window) {
    return (globalThis as unknown as { window: Window & typeof globalThis }).window;
  }
  return undefined;
};

export const registerBridge = (bridge: AccordionBridge): (() => void) => {
  const win = getWindow();
  if (win) {
    win.accordionBridge = bridge;
    win.__accordionBridge = bridge;
  }
  return () => {
    const currentWin = getWindow();
    if (currentWin) {
      if (currentWin.accordionBridge === bridge) {
        delete currentWin.accordionBridge;
      }
      if (currentWin.__accordionBridge === bridge) {
        delete currentWin.__accordionBridge;
      }
    }
  };
};

export const getBridge = (): AccordionBridge | undefined => {
  const win = getWindow();
  if (win) {
    return win.accordionBridge ?? win.__accordionBridge;
  }
  return undefined;
};
