import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  connectWebMidi,
  type MidiListener,
} from "../../adapters/midi/webMidiInput";
import {
  clearSettings,
  loadCalibratedLatency,
  loadStoredSession,
  saveSettings,
  type RuntimeMode,
} from "../../adapters/persistence/settingsPersistence";
import { generateFirstValidCandidate } from "../../application/generateCandidate";
import { PracticeSession } from "../../application/practiceSession";
import {
  SightReadingCoordinator,
  type SightReadingStatus,
} from "../../application/sightReadingCoordinator";
import { generateExercise } from "../../core/generation/generateExercise";
import type { PerformedMidiEvent } from "../../core/model";
import type { PerformanceMetrics } from "../../core/performance/performanceMetrics";
import type { ReviewAnnotation } from "../../core/performance/reviewAnnotations";
import {
  defaultRuntimeMode,
  defaultTrainingRequest,
  parseTrainingRequest,
  type TrainingRequest,
} from "../../core/training/trainingIntent";
import { useAccordionBridge } from "./useAccordionBridge";
import type { SessionStats } from "./SessionStatusBar";

const emptySessionStats: SessionStats = {
  completedExercises: 0,
  completedEvents: 0,
  attempts: 0,
  correct: 0,
  timingCorrect: 0,
  missed: 0,
  extra: 0,
};

const nextSeed = () => Math.floor(Math.random() * 0x2aaaaaaa) * 3;
const randomSeeds = (first = nextSeed()) => [
  first,
  nextSeed(),
  nextSeed(),
  nextSeed(),
  nextSeed(),
  nextSeed(),
  nextSeed(),
  nextSeed(),
];

export function usePracticeSessionController() {
  const frameRef = useRef<number | undefined>(undefined);
  const midiListenerRef = useRef<MidiListener>(() => {});

  const [initial] = useState(() => {
    const session = loadStoredSession();
    const sessionSettings: TrainingRequest = session.settings;
    const seed = sessionSettings.seed ?? nextSeed();
    try {
      const candidate = generateFirstValidCandidate(
        randomSeeds(seed),
        (candidateSeed) => generateExercise(sessionSettings, candidateSeed),
      );
      return {
        settings: sessionSettings,
        mode: session.mode,
        seed: candidate.seed,
        exercise: candidate.value,
        error: "",
        pending: false,
      };
    } catch (error) {
      const fallback = generateExercise(defaultTrainingRequest(), 0);
      return {
        settings: sessionSettings,
        mode: session.mode,
        seed: 0,
        exercise: fallback,
        error: error instanceof Error ? error.message : String(error),
        pending: true,
      };
    }
  });

  const seedRef = useRef(initial.seed);
  const settingsRef = useRef(initial.settings);
  const modeRef = useRef(initial.mode);

  const coordinatorRef = useRef<SightReadingCoordinator>(
    new SightReadingCoordinator({
      exercise: initial.exercise,
      hands: initial.settings.hands,
      timing: initial.settings.timing,
      onNextExercise: () => initial.exercise,
    }),
  );

  const sessionRef = useRef(
    initial.mode === "sightReading"
      ? coordinatorRef.current.session
      : new PracticeSession(
          initial.exercise,
          initial.settings.hands,
          initial.mode,
          initial.settings.timing,
        ),
  );

  const [waiting, setWaiting] = useState(false);
  const [settings, setSettings] = useState(initial.settings);
  const [seed, setSeed] = useState(initial.seed);
  const [exercise, setExercise] = useState(initial.exercise);
  const [mode, setMode] = useState<RuntimeMode>(initial.mode);
  const [status, setStatus] = useState<SightReadingStatus>(
    initial.mode === "correction" ? "playing" : "ready",
  );
  const [reviewAnnotations, setReviewAnnotations] = useState<
    ReviewAnnotation[]
  >([]);
  const [positionMs, setPositionMs] = useState(0);
  const [metrics, setMetrics] = useState<PerformanceMetrics>();
  const [sessionStats, setSessionStats] = useState(emptySessionStats);
  const [devices, setDevices] = useState<string[]>([]);
  const [midiError, setMidiError] = useState("");
  const [generationError, setGenerationError] = useState(initial.error);
  const [settingsPendingScore, setSettingsPendingScore] = useState(
    initial.pending,
  );

  useEffect(() => {
    seedRef.current = seed;
  }, [seed]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const onNextExercise = useCallback(() => {
    try {
      const candidate = generateFirstValidCandidate(
        randomSeeds(nextSeed()),
        (candidateSeed) => generateExercise(settingsRef.current, candidateSeed),
      );
      seedRef.current = candidate.seed;
      setSeed(candidate.seed);
      setGenerationError("");
      setSettingsPendingScore(false);
      return candidate.value;
    } catch (error) {
      setGenerationError(
        error instanceof Error ? error.message : String(error),
      );
      return coordinatorRef.current.exercise;
    }
  }, []);

  coordinatorRef.current.onNextExercise = onNextExercise;

  const hasLeft = sessionRef.current.count("left") > 0;

  const resetSession = useCallback(
    (nextExercise = exercise, nextSettings = settings, nextMode = mode) => {
      cancelAnimationFrame(frameRef.current ?? 0);
      if (nextMode === "sightReading") {
        coordinatorRef.current.reset(
          nextExercise,
          nextSettings.hands,
          nextSettings.timing,
        );
        sessionRef.current = coordinatorRef.current.session;
      } else {
        sessionRef.current = new PracticeSession(
          nextExercise,
          nextSettings.hands,
          nextMode,
          nextSettings.timing,
        );
      }
      setStatus(nextMode === "correction" ? "playing" : "ready");
      setWaiting(false);
      setPositionMs(0);
      setReviewAnnotations([]);
    },
    [exercise, settings, mode],
  );

  const changeMode = useCallback(
    (nextMode: RuntimeMode) => {
      modeRef.current = nextMode;
      resetSession(exercise, settings, nextMode);
      setMode(nextMode);
      setMetrics(undefined);
      saveSettings(settings, nextMode);
    },
    [exercise, settings, resetSession],
  );

  const updateSettings = useCallback(
    (
      raw: TrainingRequest,
      persist = true,
      nextMode = mode,
      keepValidSettingsOnGenerationFailure = true,
    ) => {
      // Generate before changing the active settings, score, or persisted session.
      let next: TrainingRequest | undefined;
      try {
        next = parseTrainingRequest(raw);
        const candidate = generateFirstValidCandidate(
          randomSeeds(),
          (candidateSeed) => generateExercise(next!, candidateSeed),
        );
        resetSession(candidate.value, next, nextMode);
        setSettings(next);
        setMode(nextMode);
        setSeed(candidate.seed);
        setExercise(candidate.value);
        setMetrics(undefined);
        setGenerationError("");
        setSettingsPendingScore(false);
        if (persist) saveSettings(next, nextMode);
        return true;
      } catch (error) {
        if (next && keepValidSettingsOnGenerationFailure) {
          resetSession(exercise, next, nextMode);
          setSettings(next);
          setMode(nextMode);
          setMetrics(undefined);
          setSettingsPendingScore(true);
          if (persist) saveSettings(next, nextMode);
        }
        setGenerationError(
          error instanceof Error ? error.message : String(error),
        );
        return false;
      }
    },
    [exercise, mode, resetSession],
  );

  const updateTiming = useCallback(
    (timing: TrainingRequest["timing"]) => {
      const next = parseTrainingRequest({ ...settings, timing });
      resetSession(exercise, next);
      setSettings(next);
      setMetrics(undefined);
      saveSettings(next, mode);
    },
    [exercise, mode, resetSession, settings],
  );

  const updateLatency = useCallback(
    (latencyMs: number) => {
      updateTiming({ ...settings.timing, latencyMs });
    },
    [settings.timing, updateTiming],
  );

  const regenerate = useCallback(
    (newSeed = seed + 1, preserveMetrics = false, retry = true) => {
      try {
        const candidate = generateFirstValidCandidate(
          retry ? randomSeeds(newSeed) : [newSeed],
          (candidateSeed) => generateExercise(settings, candidateSeed),
        );
        const next = candidate.value;
        cancelAnimationFrame(frameRef.current ?? 0);
        if (mode === "sightReading") {
          coordinatorRef.current.reset(next, settings.hands, settings.timing);
          sessionRef.current = coordinatorRef.current.session;
        } else {
          sessionRef.current = new PracticeSession(
            next,
            settings.hands,
            mode,
            settings.timing,
          );
        }
        setSeed(candidate.seed);
        setExercise(next);
        setStatus(mode === "correction" ? "playing" : "ready");
        setWaiting(false);
        setPositionMs(0);
        setReviewAnnotations([]);
        if (!preserveMetrics) setMetrics(undefined);
        setGenerationError("");
        setSettingsPendingScore(false);
      } catch (error) {
        cancelAnimationFrame(frameRef.current ?? 0);
        setStatus(mode === "correction" ? "playing" : "ready");
        setGenerationError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    [settings, mode, seed],
  );

  const finish = useCallback(() => {
    const session = sessionRef.current;
    if (session.done || !session.started) return;
    cancelAnimationFrame(frameRef.current ?? 0);
    const currentMode = modeRef.current;
    const report =
      currentMode === "sightReading"
        ? coordinatorRef.current.finish()
        : session.finish();
    setMetrics(report.metrics);
    const attempts =
      report.metrics.rightHand.attempts + report.metrics.leftHand.attempts;
    const correct =
      report.metrics.rightHand.correct + report.metrics.leftHand.correct;
    setSessionStats((x) => ({
      ...x,
      completedExercises: x.completedExercises + 1,
      completedEvents: x.completedEvents + attempts,
      attempts: x.attempts + attempts,
      correct: x.correct + correct,
      timingCorrect:
        x.timingCorrect + Math.round(report.metrics.timingAccuracy * attempts),
      missed: x.missed + report.metrics.missedNotes,
      extra: x.extra + report.metrics.extraNotes,
    }));
    if (currentMode === "sightReading") {
      setReviewAnnotations(coordinatorRef.current.reviewAnnotations);
      setStatus("review");
    }
    setWaiting(false);
  }, []);

  const acceptMidi = useCallback(
    (event: PerformedMidiEvent) => {
      if (modeRef.current === "sightReading") {
        const coordinator = coordinatorRef.current;
        const res = coordinator.acceptMidi(event);
        if (res.action === "dismissedReview") {
          setStatus("ready");
          setExercise(coordinator.exercise);
          setReviewAnnotations([]);
          setPositionMs(0);
          setWaiting(false);
          sessionRef.current = coordinator.session;
          return;
        }
        if (res.action === "consumed" || res.action === "none") {
          return;
        }
        if (res.action === "started") {
          setStatus("playing");
          const session = coordinator.session;
          sessionRef.current = session;
          const tick = () => {
            if (sessionRef.current !== session) return;
            const now = performance.now();
            setPositionMs(session.positionMs(now));
            setWaiting(session.isWaiting(now));
            if (session.shouldFinish(now)) {
              finish();
              return;
            }
            frameRef.current = requestAnimationFrame(tick);
          };
          frameRef.current = requestAnimationFrame(tick);
          return;
        }
        if (res.action === "played") {
          const session = coordinator.session;
          const now = performance.now();
          setPositionMs(session.positionMs(now));
          setWaiting(session.isWaiting(now));
          return;
        }
        return;
      }

      const session = sessionRef.current;
      const result = session.accept(event);
      if (session.mode === "correction") {
        if (result.accepted || result.wrong) {
          setSessionStats((x) => ({
            ...x,
            completedEvents: x.completedEvents + result.accepted,
            attempts: x.attempts + result.accepted + result.wrong,
            correct: x.correct + result.accepted,
            completedExercises:
              x.completedExercises + (result.completed ? 1 : 0),
          }));
        }
        if (result.completed) {
          // Leave the completed session in place through this MIDI burst.
          frameRef.current = requestAnimationFrame(() =>
            regenerate(seed + 1, true),
          );
        }
      }
    },
    [finish, regenerate, seed],
  );

  const calibrationListenerRef = useRef<
    ((event: PerformedMidiEvent) => void) | null
  >(null);
  const registerCalibrationListener = useCallback(
    (fn: ((event: PerformedMidiEvent) => void) | null) => {
      calibrationListenerRef.current = fn;
    },
    [],
  );

  useEffect(() => {
    midiListenerRef.current = acceptMidi;
  }, [acceptMidi]);

  useEffect(() => {
    let cancelled = false;
    let disconnect: undefined | (() => void);
    connectWebMidi(
      (event) => {
        if (calibrationListenerRef.current) {
          calibrationListenerRef.current(event);
          return;
        }
        midiListenerRef.current(event);
      },
      (names) => {
        if (!cancelled) setDevices(names);
      },
    )
      .then((x) => {
        if (cancelled) {
          x.disconnect();
        } else {
          setDevices(x.deviceNames);
          disconnect = x.disconnect;
          setMidiError("");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setMidiError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      cancelled = true;
      disconnect?.();
    };
  }, []);

  const firstPlayableNote =
    exercise.rightHand.find((e) => e.pitches.length > 0) ??
    exercise.leftHand.find((e) => e.pitches.length > 0);
  const firstNoteOnset = firstPlayableNote?.onset ?? 0;

  const playhead =
    mode === "correction"
      ? sessionRef.current.correctionOnset
      : status === "playing"
        ? (positionMs / 60_000) * exercise.tempoBpm * 480
        : status === "ready"
          ? firstNoteOnset
          : undefined;

  const scorePositions = useMemo(
    () =>
      [
        ...new Set([
          ...exercise.rightHand.map((e) => e.onset),
          ...exercise.leftHand
            .filter((e) => e.metadata.leadSheetAnnotation)
            .map((e) => e.onset),
        ]),
      ].sort((a, b) => a - b),
    [exercise],
  );

  const markedOnset =
    status === "review"
      ? undefined
      : playhead === undefined
        ? (status === "ready" ? firstNoteOnset : undefined)
        : (scorePositions.filter((onset) => onset <= playhead).at(-1) ?? firstNoteOnset);

  // Screen wake lock
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    const acquire = async () => {
      try {
        await lock?.release();
        lock = await navigator.wakeLock.request("screen");
      } catch {
        lock = undefined;
      }
    };
    const visibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      void lock?.release();
    };
  }, []);

  // Frame cleanup on unmount
  useEffect(() => () => cancelAnimationFrame(frameRef.current ?? 0), []);

  // Virtual MIDI bridge
  useAccordionBridge({
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
  });

  const resetToDefaults = () => {
    if (
      !window.confirm(
        "Reset all practice settings to their defaults? Saved presets will not be deleted.",
      )
    ) {
      return;
    }
    const defaults = defaultTrainingRequest();
    defaults.timing.latencyMs = loadCalibratedLatency();
    clearSettings();
    updateSettings(defaults, false, defaultRuntimeMode());
  };

  return {
    settings,
    seed,
    exercise,
    mode,
    status,
    waiting,
    positionMs,
    playhead,
    markedOnset,
    metrics,
    reviewAnnotations,
    sessionStats,
    devices,
    midiError,
    generationError,
    settingsPendingScore,
    hasLeft,
    changeMode,
    updateSettings,
    updateTiming,
    updateLatency,
    registerCalibrationListener,
    regenerate,
    finish,
    resetToDefaults,
  };
}
