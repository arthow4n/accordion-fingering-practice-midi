import { TICKS_PER_QUARTER, type Exercise, type ExerciseEvent } from "../model";
export type TimedExpectedEvent = ExerciseEvent & { expectedMs: number; durationMs: number };
export const ticksToMs = (ticks: number, tempoBpm: number) => ticks / TICKS_PER_QUARTER * 60_000 / tempoBpm;
export const createExpectedTimeline = (exercise: Exercise, startMs = 0): TimedExpectedEvent[] => {
  const result: TimedExpectedEvent[] = [];
  for (const events of [exercise.rightHand, exercise.leftHand]) {
    let previous: TimedExpectedEvent | undefined;
    for (const event of events) {
      if (!event.pitches.length) { previous = undefined; continue; }
      if (event.metadata.tieFromPrevious && previous) {
        previous.duration += event.duration;
        previous.durationMs += ticksToMs(event.duration, exercise.tempoBpm);
      } else {
        previous = { ...event, expectedMs: startMs + ticksToMs(event.onset, exercise.tempoBpm), durationMs: ticksToMs(event.duration, exercise.tempoBpm) };
        result.push(previous);
      }
    }
  }
  return result.sort((a, b) => a.expectedMs - b.expectedMs);
};
export class AbsoluteTimeline {
  private startMs: number | null = null;
  constructor(readonly exercise: Exercise, readonly previewMs = 0, readonly countInBeats = 4) {}
  start(nowMs: number) { this.startMs = nowMs; return this.sessionStartMs(); }
  sessionStartMs() { if (this.startMs === null) throw new Error("Timeline has not started"); return this.startMs + this.previewMs + ticksToMs(this.countInBeats * TICKS_PER_QUARTER, this.exercise.tempoBpm); }
  positionAt(nowMs: number) { return Math.max(0, nowMs - this.sessionStartMs()); }
  isFinished(nowMs: number) { return this.positionAt(nowMs) >= ticksToMs(this.exercise.totalDuration, this.exercise.tempoBpm); }
}
