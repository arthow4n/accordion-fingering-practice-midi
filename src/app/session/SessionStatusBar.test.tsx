import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { SessionStatusBar } from "./SessionStatusBar";
import { generateExercise } from "../../core/generation/generateExercise";
import { defaultTrainingRequest } from "../../core/training/trainingIntent";
import type { PerformanceMetrics } from "../../core/performance/performanceMetrics";

describe("SessionStatusBar", () => {
  const baseSettings = defaultTrainingRequest();
  const exercise = generateExercise(baseSettings, 1);
  const emptyStats = {
    completedExercises: 3,
    completedEvents: 24,
    attempts: 24,
    correct: 20,
    timingCorrect: 18,
    missed: 1,
    extra: 0,
  };

  const renderClean = (component: React.ReactElement) =>
    renderToString(component).replace(/<!--.*?-->/g, "");

  it("renders session stats summary", () => {
    const text = renderClean(
      <SessionStatusBar
        exercise={exercise}
        settings={baseSettings}
        mode="sightReading"
        status="ready"
        waiting={false}
        hasLeft={false}
        sessionStats={emptyStats}
        generationError=""
        settingsPendingScore={false}
      />,
    );

    expect(text).toContain("Completed 3 exercises");
    expect(text).toContain("24 events");
    expect(text).toContain("correct 83%");
    expect(text).toContain("missed 1");
    expect(text).toContain("extra 0");
  });

  it("shows sight-reading paused message when waiting", () => {
    const text = renderClean(
      <SessionStatusBar
        exercise={exercise}
        settings={baseSettings}
        mode="sightReading"
        status="playing"
        waiting={true}
        hasLeft={false}
        sessionStats={emptyStats}
        generationError=""
        settingsPendingScore={false}
      />,
    );

    expect(text).toContain("Paused — resume playing, or finish this exercise");
  });

  it("shows accompaniment instruction when hasLeft is true", () => {
    const text = renderClean(
      <SessionStatusBar
        exercise={exercise}
        settings={baseSettings}
        mode="sightReading"
        status="ready"
        waiting={false}
        hasLeft={true}
        sessionStats={emptyStats}
        generationError=""
        settingsPendingScore={false}
      />,
    );

    expect(text).toContain("accompaniment-instruction");
    expect(text).toContain("Left hand:");
  });

  it("renders generation error when present", () => {
    const text = renderClean(
      <SessionStatusBar
        exercise={exercise}
        settings={baseSettings}
        mode="sightReading"
        status="ready"
        waiting={false}
        hasLeft={false}
        sessionStats={emptyStats}
        generationError="Could not satisfy constraints"
        settingsPendingScore={true}
      />,
    );

    expect(text).toContain('role="alert"');
    expect(text).toContain("Could not satisfy constraints");
    expect(text).toContain("Your selection was saved");
  });

  it("renders performance metrics when available", () => {
    const metrics: PerformanceMetrics = {
      pitchAccuracy: 0.95,
      timingAccuracy: 0.9,
      continuity: 0.85,
      durationAccuracy: 0.8,
      missedNotes: 2,
      wrongNotes: 1,
      extraNotes: 0,
      longestHesitationMs: 1500,
      lateEventClusters: 0,
      recoveryMetrics: {
        meanRecoveryMsAfterError: 0,
        meanRecoveryBeatsAfterError: 0,
      },
      rightHand: {
        attempts: 10,
        correct: 10,
        missed: 0,
        extra: 0,
        pitchAccuracy: 1,
        timingAccuracy: 0.9,
      },
      leftHand: {
        attempts: 10,
        correct: 9,
        missed: 2,
        extra: 0,
        pitchAccuracy: 0.9,
        timingAccuracy: 0.9,
      },
      byFeature: {},
    };

    const text = renderClean(
      <SessionStatusBar
        exercise={exercise}
        settings={baseSettings}
        mode="sightReading"
        status="review"
        waiting={false}
        hasLeft={true}
        sessionStats={emptyStats}
        metrics={metrics}
        generationError=""
        settingsPendingScore={false}
      />,
    );

    expect(text).toContain("Review:");
    expect(text).toContain("pitch 95%");
    expect(text).toContain("timing 90%");
    expect(text).toContain("2 missed");
    expect(text).toContain("1 wrong");
    expect(text).toContain("longest hesitation 1.5s");
  });
});
