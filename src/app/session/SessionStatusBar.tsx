import type { RuntimeMode } from "../../adapters/persistence/settingsPersistence";
import type { SightReadingStatus } from "../../application/sightReadingCoordinator";
import type { Exercise } from "../../core/model";
import { accompanimentInstruction } from "../../core/patterns/accompanimentTemplates";
import type { PerformanceMetrics } from "../../core/performance/performanceMetrics";
import type { TrainingRequest } from "../../core/training/trainingIntent";

export interface SessionStats {
  completedExercises: number;
  completedEvents: number;
  attempts: number;
  correct: number;
  timingCorrect: number;
  missed: number;
  extra: number;
}

export interface SessionStatusBarProps {
  exercise: Exercise;
  settings: TrainingRequest;
  mode: RuntimeMode;
  status: SightReadingStatus;
  waiting: boolean;
  hasLeft: boolean;
  sessionStats: SessionStats;
  metrics?: PerformanceMetrics;
  generationError: string;
  settingsPendingScore: boolean;
}

export function SessionStatusBar({
  exercise,
  settings,
  mode,
  status,
  hasLeft,
  sessionStats,
  metrics,
  generationError,
  settingsPendingScore,
}: SessionStatusBarProps) {
  return (
    <>
      {exercise.metadata.studyStep &&
        settings.sessionProgression !== "independent" && (
          <p className="study-arc-indicator">
            <strong>Study set:</strong> Set{" "}
            {(exercise.metadata.studyCycle ?? 0) + 1}
            {exercise.metadata.studyTopic
              ? ` · ${exercise.metadata.studyTopic}`
              : ""}{" "}
            · Step {exercise.metadata.studyStep} of 3 (
            {exercise.metadata.studyLabel})
          </p>
        )}

      {hasLeft && (
        <p className="accompaniment-instruction">
          <strong>Left hand:</strong>{" "}
          {accompanimentInstruction(
            settings.leftHand.accompanimentStyle,
            exercise.meter,
            settings.leftHand.templateId,
          )}
        </p>
      )}

      {mode === "sightReading" && (
        <p>
          {status === "playing"
            ? "Sight-reading—keep the pulse"
            : status === "review"
              ? "Review — press any accordion key to continue"
              : "Ready — play the first note on the accordion to begin"}
        </p>
      )}

      <p>
        Completed {sessionStats.completedExercises} exercises ·{" "}
        {sessionStats.completedEvents} events · correct{" "}
        {sessionStats.attempts
          ? `${((sessionStats.correct / sessionStats.attempts) * 100).toFixed(0)}%`
          : "—"}{" "}
        · missed {sessionStats.missed} · extra {sessionStats.extra}
      </p>

      {metrics && (
        <p>
          {status === "review" ? "Review: " : "Last exercise: "}pitch{" "}
          {(metrics.pitchAccuracy * 100).toFixed(0)}% · timing{" "}
          {(metrics.timingAccuracy * 100).toFixed(0)}%
          {status === "review"
            ? ` · ${metrics.missedNotes} missed · ${metrics.wrongNotes} wrong`
            : ""}{" "}
          · continuity {(metrics.continuity * 100).toFixed(0)}%
          {metrics.durationAccuracy !== undefined && (
            <> · note lengths {(metrics.durationAccuracy * 100).toFixed(0)}%</>
          )}{" "}
          · longest hesitation {(metrics.longestHesitationMs / 1000).toFixed(1)}
          s
        </p>
      )}

      {generationError && (
        <p role="alert">
          Requested settings could not generate a new exercise.{" "}
          {settingsPendingScore
            ? "Your selection was saved; the current score remains active until a new one can be generated."
            : "The previous settings and score remain active."}{" "}
          {generationError}
        </p>
      )}
    </>
  );
}
