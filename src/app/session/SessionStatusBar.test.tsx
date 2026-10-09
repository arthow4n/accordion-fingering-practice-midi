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

  it("renders session stats summary without events, missed, or extra labels", () => {
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
    expect(text).toContain("accuracy 83%");
    expect(text).not.toContain("events");
    expect(text).not.toContain("missed 1");
    expect(text).not.toContain("extra 0");
  });

  it("renders reset history button when exercises completed or attempted", () => {
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
        onResetStats={() => {}}
      />,
    );

    expect(text).toContain("Reset history");
  });

  it("omits reset history button when zero exercises completed and zero attempts", () => {
    const zeroStats = {
      completedExercises: 0,
      completedEvents: 0,
      attempts: 0,
      correct: 0,
      timingCorrect: 0,
      missed: 0,
      extra: 0,
    };
    const text = renderClean(
      <SessionStatusBar
        exercise={exercise}
        settings={baseSettings}
        mode="sightReading"
        status="ready"
        waiting={false}
        hasLeft={false}
        sessionStats={zeroStats}
        generationError=""
        settingsPendingScore={false}
        onResetStats={() => {}}
      />,
    );

    expect(text).toContain("Completed 0 exercises");
    expect(text).not.toContain("Reset history");
    expect(text).not.toContain("accuracy");
  });

  it("renders singular exercise label when 1 exercise is completed", () => {
    const singleStats = {
      ...emptyStats,
      completedExercises: 1,
    };
    const text = renderClean(
      <SessionStatusBar
        exercise={exercise}
        settings={baseSettings}
        mode="sightReading"
        status="ready"
        waiting={false}
        hasLeft={false}
        sessionStats={singleStats}
        generationError=""
        settingsPendingScore={false}
      />,
    );

    expect(text).toContain("Completed 1 exercise");
    expect(text).not.toContain("Completed 1 exercises");
  });

  it("does not render any filler prompt during sight reading playing", () => {
    const text = renderClean(
      <SessionStatusBar
        exercise={exercise}
        settings={baseSettings}
        mode="sightReading"
        status="playing"
        waiting={false}
        hasLeft={false}
        sessionStats={emptyStats}
        generationError=""
        settingsPendingScore={false}
      />,
    );

    expect(text).not.toContain("keep the pulse");
    expect(text).not.toContain("Ready —");
    expect(text).not.toContain("Review —");
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
