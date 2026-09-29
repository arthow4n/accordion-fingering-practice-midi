import type { Exercise, PerformedMidiEvent } from "../model";
import { matchEvents, type EventMatch, type MatchOptions } from "./eventMatcher";
import { computeMetrics, type PerformanceMetrics } from "./performanceMetrics";
import { createExpectedTimeline } from "./timeline";

export type PerformanceReport = {
  metrics: PerformanceMetrics;
  matches: EventMatch[];
};

export const evaluatePerformance = (
  exercise: Exercise,
  performed: PerformedMidiEvent[],
  sessionStartMs: number,
  options?: MatchOptions
): PerformanceReport => {
  const matches = matchEvents(createExpectedTimeline(exercise, sessionStartMs), performed, options);
  return { matches, metrics: computeMetrics(matches, 60_000 / exercise.tempoBpm) };
};

