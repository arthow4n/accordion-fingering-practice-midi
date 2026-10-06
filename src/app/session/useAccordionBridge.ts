import { useEffect } from "react";
import type { RuntimeMode } from "../../adapters/persistence/settingsPersistence";
import {
  createReviewMidiEvents,
  registerBridge,
  type AccordionBridge,
} from "../../adapters/midi/virtualMidiBridge";
import type {
  SightReadingCoordinator,
  SightReadingStatus,
} from "../../application/sightReadingCoordinator";
import type { PracticeSession } from "../../application/practiceSession";
import type { Exercise, PerformedMidiEvent } from "../../core/model";
import type { PerformanceMetrics } from "../../core/performance/performanceMetrics";
import type { ReviewAnnotation } from "../../core/performance/reviewAnnotations";
import type { TrainingRequest } from "../../core/training/trainingIntent";
import type { SessionStats } from "./SessionStatusBar";

export interface UseAccordionBridgeParams {
  mode: RuntimeMode;
  status: SightReadingStatus;
  waiting: boolean;
  positionMs: number;
  playhead?: number;
  markedOnset?: number;
  exercise: Exercise;
  metrics?: PerformanceMetrics;
  reviewAnnotations: ReviewAnnotation[];
  sessionStats: SessionStats;
  devices: string[];
  settings: TrainingRequest;
  seed: number;
  sessionRef: React.MutableRefObject<PracticeSession>;
  coordinatorRef: React.MutableRefObject<SightReadingCoordinator>;
  acceptMidi: (event: PerformedMidiEvent) => void;
  setDevices: (names: string[]) => void;
  changeMode: (nextMode: RuntimeMode) => void;
  resetSession: (
    nextExercise?: Exercise,
    nextSettings?: TrainingRequest,
    nextMode?: RuntimeMode,
  ) => void;
  regenerate: (
    newSeed?: number,
    preserveMetrics?: boolean,
    retry?: boolean,
  ) => void;
  finish: () => void;
  updateLatency?: (latencyMs: number) => void;
  calibrationListenerRef?: React.MutableRefObject<
    ((event: PerformedMidiEvent) => void) | null
  >;
}

export function useAccordionBridge({
  mode,
  status,
  waiting,
  positionMs,
  playhead,
  markedOnset,
  exercise,
  metrics,
  reviewAnnotations,
  sessionStats,
  devices,
  settings,
  seed,
  sessionRef,
  coordinatorRef,
  acceptMidi,
  setDevices,
  changeMode,
  resetSession,
  regenerate,
  finish,
  updateLatency,
  calibrationListenerRef,
}: UseAccordionBridgeParams) {
  useEffect(() => {
    const bridgeApi: AccordionBridge = {
      getState: () => ({
        mode,
        status,
        waiting,
        positionMs,
        playheadOnset: playhead,
        markedOnset,
        exercise,
        metrics,
        reviewAnnotations,
        sessionStats,
        devices,
        settings,
        seed,
      }),
      sendEvent: (event) => {
        if (calibrationListenerRef?.current) {
          calibrationListenerRef.current(event);
          return;
        }
        acceptMidi(event);
      },
      sendNoteOn: (midiNote, options) => {
        const ev: PerformedMidiEvent = {
          midiNote,
          type: "noteOn",
          timestampMs: options?.timestampMs ?? performance.now(),
          velocity: options?.velocity ?? 80,
          hand: options?.hand,
        };
        if (calibrationListenerRef?.current) {
          calibrationListenerRef.current(ev);
          return;
        }
        acceptMidi(ev);
      },
      sendNoteOff: (midiNote, options) => {
        const ev: PerformedMidiEvent = {
          midiNote,
          type: "noteOff",
          timestampMs: options?.timestampMs ?? performance.now(),
          velocity: 0,
          hand: options?.hand,
        };
        if (calibrationListenerRef?.current) {
          calibrationListenerRef.current(ev);
          return;
        }
        acceptMidi(ev);
      },
      sendDeviceNames: (names) => setDevices(names),
      setLatency: (latencyMs) => updateLatency?.(latencyMs),
      getLatency: () => settings.timing.latencyMs ?? 0,
      setMode: changeMode,
      resetSession: () => resetSession(),
      regenerate: (newSeed?: number) => regenerate(newSeed),
      dismissReview: () => {
        acceptMidi({
          midiNote: 60,
          type: "noteOn",
          timestampMs: performance.now(),
          velocity: 80,
        });
      },
      playNextNote: (options) => {
        if (mode === "correction") {
          const session = sessionRef.current;
          const onset = session.correctionOnset;
          if (onset === undefined) return false;
          const target = session.expected.find(
            (e) =>
              e.onset === onset &&
              !session.completedIds.has(e.id) &&
              (!options?.hand || e.hand === options.hand),
          );
          if (!target || !target.pitches[0]) return false;
          const midiNote = options?.mistake
            ? target.pitches[0].midi + 1
            : target.pitches[0].midi;
          const now = performance.now();
          acceptMidi({
            midiNote,
            type: "noteOn",
            timestampMs: now,
            velocity: 80,
            hand: target.hand,
          });
          acceptMidi({
            midiNote,
            type: "noteOff",
            timestampMs: now + 100,
            velocity: 0,
            hand: target.hand,
          });
          return true;
        }

        if (mode === "sightReading") {
          if (status === "review") {
            acceptMidi({
              midiNote: 60,
              type: "noteOn",
              timestampMs: performance.now(),
              velocity: 80,
            });
            return true;
          }
          const session = coordinatorRef.current.session;
          const target =
            status === "ready"
              ? session.expected.find(
                  (e) => !options?.hand || e.hand === options.hand,
                )
              : (session.currentExpected(options?.hand) ??
                session.expected.find((e) => !session.completedIds.has(e.id)));
          if (!target || !target.pitches[0]) return false;
          const midiNote = options?.mistake
            ? target.pitches[0].midi + 1
            : target.pitches[0].midi;
          const now = performance.now();
          acceptMidi({
            midiNote,
            type: "noteOn",
            timestampMs: now,
            velocity: 80,
            hand: target.hand,
          });
          acceptMidi({
            midiNote,
            type: "noteOff",
            timestampMs: now + 100,
            velocity: 0,
            hand: target.hand,
          });
          return true;
        }

        return false;
      },
      fastForwardToReview: (options) => {
        if (mode !== "sightReading") {
          changeMode("sightReading");
        }
        resetSession(exercise, settings, "sightReading");
        const activeExercise = coordinatorRef.current.exercise;
        const now = performance.now();
        const events = createReviewMidiEvents(
          activeExercise,
          settings.hands,
          options?.mistakeCount ?? 2,
          now,
        );
        for (const event of events) {
          acceptMidi(event);
        }
        finish();
      },
      simulatePause: () => {
        // Sight-reading mode preserves a continuous pulse without pausing.
        // Retained as a safe compatibility no-op for external bridge clients.
      },
    };

    const unregister = registerBridge(bridgeApi);
    return unregister;
  }, [
    mode,
    status,
    waiting,
    positionMs,
    playhead,
    markedOnset,
    exercise,
    metrics,
    reviewAnnotations,
    sessionStats,
    devices,
    settings,
    seed,
    sessionRef,
    coordinatorRef,
    acceptMidi,
    setDevices,
    changeMode,
    finish,
    regenerate,
    resetSession,
    updateLatency,
    calibrationListenerRef,
  ]);
}
