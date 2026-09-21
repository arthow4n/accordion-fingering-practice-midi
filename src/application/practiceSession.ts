import type { Exercise, Hand, PerformedMidiEvent } from "../core/model";
import { createExpectedTimeline, ticksToMs, type TimedExpectedEvent } from "../core/performance/timeline";
import { matchEvents, pitchMatches } from "../core/performance/eventMatcher";
import { computeMetrics } from "../core/performance/performanceMetrics";
import { timingOptions, type TimingSettings } from "../core/performance/timingSettings";

export type PracticeMode = "correction" | "sightReading";
export type SessionUpdate = { accepted: number; wrong: number; completed: boolean };

/** Synchronous MIDI/session authority. React only displays snapshots of this object. */
export class PracticeSession {
  readonly expected: TimedExpectedEvent[];
  readonly performed: PerformedMidiEvent[] = [];
  readonly options;
  readonly completedIds = new Set<string>();
  private correctionNotes = new Map<string, { pitches: Set<number>; firstMs: number }>();
  private correctionHeld = new Set<string>();
  private correctionCompletedAt = new Map<string, number>();
  private startMs: number | undefined;
  private shiftMs = 0;
  private lastProgressMs = -Infinity;
  private frontier = -1;
  private ended = false;
  recoveryCount = 0;
  hesitationMs = 0;

  constructor(readonly exercise: Exercise, readonly hands: "both" | Hand, readonly mode: PracticeMode, readonly timing: TimingSettings) {
    this.expected = createExpectedTimeline({ ...exercise,
      rightHand: hands === "left" ? [] : exercise.rightHand,
      leftHand: hands === "right" ? [] : exercise.leftHand,
    });
    this.options = timingOptions(timing, exercise.tempoBpm);
  }
  get started() { return this.startMs !== undefined; }
  get done() { return this.ended; }
  count(hand: Hand) { return this.expected.filter(e => e.hand === hand).length; }
  completed(hand: Hand) { return this.expected.filter(e => e.hand === hand && this.completedIds.has(e.id)).length; }
  get correctionOnset() { return this.expected.find(e => !this.completedIds.has(e.id))?.onset; }
  private pending() { return this.expected.filter(e => e.onset > this.frontier); }

  accept(event: PerformedMidiEvent): SessionUpdate {
    const update = { accepted: 0, wrong: 0, completed: false };
    if (this.ended || (event.hand && this.hands !== "both" && event.hand !== this.hands) || !this.expected.length) return update;
    if (this.mode === "correction") {
      const key = `${event.hand ?? "unknown"}:${event.midiNote}`;
      if (event.type === "noteOff") { this.correctionHeld.delete(key); return update; }
      const duplicate = this.correctionHeld.has(key);
      this.correctionHeld.add(key);
      const onset = this.correctionOnset;
      const group = this.expected.filter(e => e.onset === onset && !this.completedIds.has(e.id));
      const target = group.find(e => (!event.hand || event.hand === e.hand) && e.pitches.some(p => pitchMatches(e, p.midi, event.midiNote)));
      if (!target) return duplicate ? update : { ...update, wrong: 1 };
      // A single bass+chord button burst can contain duplicate pitches. It must
      // not advance a repeated target at the next score onset in the same burst.
      if (duplicate && event.hand === "left" && this.expected.some(e => (this.correctionCompletedAt.get(e.id) ?? -Infinity) >= event.timestampMs - this.options.simultaneityWindowMs && e.hand === "left" && e.pitches.some(p => pitchMatches(e, p.midi, event.midiNote)))) return update;
      let collected = this.correctionNotes.get(target.id);
      if (!collected || event.timestampMs - collected.firstMs > this.options.simultaneityWindowMs) collected = { pitches: new Set(), firstMs: event.timestampMs };
      const index = target.pitches.findIndex((p, i) => !collected.pitches.has(i) && pitchMatches(target, p.midi, event.midiNote));
      if (index < 0) return update; // Extra register voices of a held chord are harmless.
      collected.pitches.add(index); this.correctionNotes.set(target.id, collected);
      if (collected.pitches.size === target.pitches.length) {
        this.completedIds.add(target.id); this.correctionCompletedAt.set(target.id,event.timestampMs); this.correctionNotes.delete(target.id); update.accepted = 1;
      }
      this.ended = this.completedIds.size === this.expected.length;
      update.completed = this.ended;
      return update;
    }
    if (event.type === "noteOff") { if (this.started) this.performed.push(event); return update; }
    if (this.startMs === undefined) {
      // The triggering attack represents the first sounding onset, including a
      // leading rest when only one hand is selected.
      this.startMs = event.timestampMs - this.expected[0]!.expectedMs;
      for (const target of this.expected) target.expectedMs += this.startMs;
    } else if (this.timing.followAfterPause && event.timestampMs - this.lastProgressMs > Math.max(this.options.lateToleranceMs, 60_000 / this.exercise.tempoBpm * .75)) {
      const pending = this.pending();
      const nextOnsets = [...new Set(pending.map(e => e.onset))].slice(0, 4);
      const resume = pending.find(e => nextOnsets.includes(e.onset) && (!event.hand || e.hand === event.hand) && e.pitches.some(p => pitchMatches(e, p.midi, event.midiNote)));
      if (resume && event.timestampMs > resume.expectedMs + this.options.lateToleranceMs) {
        const delay = event.timestampMs - resume.expectedMs;
        for (const target of this.expected) if (target.onset >= resume.onset) target.expectedMs += delay;
        this.shiftMs += delay; this.hesitationMs = Math.max(this.hesitationMs, delay); this.recoveryCount++;
      }
    }
    this.performed.push(event);
    // Advance the recovery frontier only after a complete, pitch-correct attack.
    const horizon = this.options.earlyToleranceMs + this.options.lateToleranceMs + this.options.simultaneityWindowMs;
    const recent = this.performed.filter(e => e.type === "noteOn" && e.timestampMs >= event.timestampMs - horizon);
    const nearby = this.expected.filter(e => e.expectedMs >= event.timestampMs - horizon - this.options.lateToleranceMs && e.expectedMs <= event.timestampMs + this.options.earlyToleranceMs);
    for (const match of matchEvents(nearby, recent, this.options)) {
      if (match.expected && ["correct", "early", "late"].includes(match.classification)) {
        this.lastProgressMs = Math.max(this.lastProgressMs,...match.performed.map(note=>note.timestampMs));
        this.completedIds.add(match.expected.id);
        this.frontier = Math.max(this.frontier, match.expected.onset);
      }
    }
    return update;
  }

  positionMs(nowMs: number) {
    if (this.startMs === undefined) return 0;
    const position = Math.max(0, nowMs - this.startMs - this.shiftMs);
    const next = this.pending()[0];
    if (this.timing.followAfterPause && next && nowMs > next.expectedMs + this.options.lateToleranceMs) {
      return Math.min(position, ticksToMs(next.onset, this.exercise.tempoBpm));
    }
    return position;
  }
  isWaiting(nowMs: number) {
    const next = this.pending()[0];
    return this.started && this.timing.followAfterPause && !!next && nowMs > next.expectedMs + this.options.lateToleranceMs;
  }
  shouldFinish(nowMs: number) {
    if (!this.started || this.ended) return false;
    if (this.timing.followAfterPause && this.pending().length) return false;
    const end = this.startMs! + this.shiftMs + ticksToMs(this.exercise.totalDuration, this.exercise.tempoBpm);
    return nowMs >= end + this.options.lateToleranceMs;
  }
  finish() {
    this.ended = true;
    const metrics = computeMetrics(matchEvents(this.expected, this.performed, this.options), 60_000 / this.exercise.tempoBpm);
    metrics.longestHesitationMs = Math.max(metrics.longestHesitationMs, this.hesitationMs);
    if (this.recoveryCount) metrics.continuity *= Math.max(0, 1 - this.recoveryCount / Math.max(1, this.expected.length));
    return metrics;
  }
}
