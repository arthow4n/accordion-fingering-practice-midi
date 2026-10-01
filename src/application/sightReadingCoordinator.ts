import type { Exercise, Hand, PerformedMidiEvent } from "../core/model";
import { PracticeSession } from "./practiceSession";
import type { PerformanceReport } from "../core/performance/evaluatePerformance";
import { deriveReviewAnnotations, type ReviewAnnotation } from "../core/performance/reviewAnnotations";
import { timingOptions, type TimingSettings } from "../core/performance/timingSettings";

export type SightReadingStatus = "ready" | "playing" | "review";

export type SightReadingCoordinatorOptions = {
  exercise: Exercise;
  hands: "both" | Hand;
  timing: TimingSettings;
  onNextExercise: () => Exercise;
};

export type CoordinatorMidiResult =
  | { action: "none" }
  | { action: "consumed" }
  | { action: "dismissedReview" }
  | { action: "started" }
  | { action: "played" };

export class SightReadingCoordinator {
  exercise: Exercise;
  hands: "both" | Hand;
  timing: TimingSettings;
  onNextExercise: () => Exercise;

  status: SightReadingStatus = "ready";
  session: PracticeSession;
  report?: PerformanceReport;
  reviewAnnotations: ReviewAnnotation[] = [];

  private dismissBurstUntilMs = -Infinity;
  private dismissHeldKeys = new Set<string>();

  constructor(options: SightReadingCoordinatorOptions) {
    this.exercise = options.exercise;
    this.hands = options.hands;
    this.timing = options.timing;
    this.onNextExercise = options.onNextExercise;
    this.session = new PracticeSession(this.exercise, this.hands, "sightReading", this.timing);
  }

  private key(event: PerformedMidiEvent) {
    return `${event.hand ?? "unknown"}:${event.midiNote}`;
  }

  acceptMidi(event: PerformedMidiEvent): CoordinatorMidiResult {
    const k = this.key(event);

    if (this.status === "review") {
      if (event.type === "noteOff") {
        return { action: "none" };
      }
      // noteOn: dismiss review and consume this event
      if (event.timestampMs <= this.dismissBurstUntilMs) {
        this.dismissHeldKeys.add(k);
        return { action: "consumed" };
      }

      const opts = timingOptions(this.timing, this.exercise.tempoBpm);
      this.dismissBurstUntilMs = event.timestampMs + opts.simultaneityWindowMs;
      this.dismissHeldKeys.add(k);

      const nextExercise = this.onNextExercise();
      this.exercise = nextExercise;
      this.session = new PracticeSession(nextExercise, this.hands, "sightReading", this.timing);
      this.report = undefined;
      this.reviewAnnotations = [];
      this.status = "ready";
      return { action: "dismissedReview" };
    }

    if (this.status === "ready") {
      if (event.timestampMs <= this.dismissBurstUntilMs) {
        if (event.type === "noteOn") this.dismissHeldKeys.add(k);
        else this.dismissHeldKeys.delete(k);
        return { action: "consumed" };
      }

      if (event.type === "noteOff") {
        this.dismissHeldKeys.delete(k);
        return { action: "none" };
      }

      if (this.dismissHeldKeys.has(k)) {
        return { action: "consumed" };
      }

      // First attack of the new exercise
      this.session.accept(event);
      if (this.session.started) {
        this.status = "playing";
        return { action: "started" };
      }
      return { action: "consumed" };
    }

    // status === "playing"
    this.session.accept(event);
    return { action: "played" };
  }

  finish(): PerformanceReport {
    this.status = "review";
    this.dismissBurstUntilMs = -Infinity;
    this.dismissHeldKeys.clear();
    this.report = this.session.finish();
    this.reviewAnnotations = deriveReviewAnnotations(this.report, this.exercise);
    return this.report;
  }

  reset(exercise = this.exercise, hands = this.hands, timing = this.timing) {
    this.exercise = exercise;
    this.hands = hands;
    this.timing = timing;
    this.status = "ready";
    this.dismissBurstUntilMs = -Infinity;
    this.dismissHeldKeys.clear();
    this.report = undefined;
    this.reviewAnnotations = [];
    this.session = new PracticeSession(exercise, hands, "sightReading", timing);
  }
}
