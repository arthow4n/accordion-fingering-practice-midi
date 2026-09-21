import type { PerformedMidiEvent } from "../model";
import type { TimedExpectedEvent } from "./timeline";
export type MatchClassification = "correct" | "wrongPitch" | "missed" | "extra" | "early" | "late";
export type EventMatch = {
  expected?: TimedExpectedEvent; performed: PerformedMidiEvent[];
  classification: MatchClassification; timingErrorMs?: number;
  durationCorrect?: boolean;
};
export type MatchOptions = {
  earlyToleranceMs: number; lateToleranceMs: number; simultaneityWindowMs: number;
  correctEarlyMs?: number; correctLateMs?: number;
};
export const defaultMatchOptions: MatchOptions = { earlyToleranceMs: 180, lateToleranceMs: 250, simultaneityWindowMs: 80 };
export const pitchMatches = (target: TimedExpectedEvent, expectedPitch: number, note: number) =>
  expectedPitch === note || (target.hand === "left" && expectedPitch % 12 === ((note % 12) + 12) % 12);

export const matchEvents = (expected: TimedExpectedEvent[], performed: PerformedMidiEvent[], options = defaultMatchOptions): EventMatch[] => {
  const notes = performed.filter(p => p.type === "noteOn").sort((a, b) => a.timestampMs - b.timestampMs);
  const used = new Set<number>();
  const assigned = expected.map(() => [] as number[]);
  const covered = expected.map(() => new Set<number>());
  const eligible = (target: TimedExpectedEvent, note: PerformedMidiEvent) => {
    const d = note.timestampMs - target.expectedMs;
    return d >= -options.earlyToleranceMs && d <= options.lateToleranceMs && (!note.hand || note.hand === target.hand);
  };
  // Reserve the nearest correct pitch assignments across the whole passage first.
  // A missed earlier target must never steal the next target's correct attack.
  const edges = expected.flatMap((target, ti) => notes.flatMap((note, ni) =>
    eligible(target, note) ? target.pitches.flatMap((pitch, pi) => pitchMatches(target, pitch.midi, note.midiNote)
      ? [{ ti, ni, pi, distance: Math.abs(note.timestampMs - target.expectedMs) }] : []) : []));
  edges.sort((a, b) => a.distance - b.distance || a.ti - b.ti || a.ni - b.ni);
  for (const { ti, ni, pi } of edges) {
    if (used.has(ni) || covered[ti]!.has(pi)) continue;
    const group = assigned[ti]!;
    const times = [...group, ni].map(i => notes[i]!.timestampMs);
    if (Math.max(...times) - Math.min(...times) > options.simultaneityWindowMs) continue;
    group.push(ni); covered[ti]!.add(pi); used.add(ni);
  }
  // Fold redundant octave/register voices of the same left-hand button into its
  // attack, without consuming a note already reserved for a neighboring target.
  expected.forEach((target, ti) => {
    if (target.hand !== "left" || !assigned[ti]!.length) return;
    const onset = Math.min(...assigned[ti]!.map(i => notes[i]!.timestampMs));
    notes.forEach((note, ni) => {
      if (!used.has(ni) && eligible(target, note) && Math.abs(note.timestampMs - onset) <= options.simultaneityWindowMs && target.pitches.some(p => pitchMatches(target, p.midi, note.midiNote))) {
        assigned[ti]!.push(ni); used.add(ni);
      }
    });
  });
  // Only unmatched notes may be assigned as wrong pitches, again by proximity.
  const wrongEdges = expected.flatMap((target, ti) => assigned[ti]!.length ? [] : notes.flatMap((note, ni) =>
    !used.has(ni) && eligible(target, note) ? [{ ti, ni, distance: Math.abs(note.timestampMs - target.expectedMs) }] : []));
  wrongEdges.sort((a, b) => a.distance - b.distance || a.ti - b.ti);
  for (const { ti, ni } of wrongEdges) if (!used.has(ni) && !assigned[ti]!.length) {
    assigned[ti]!.push(ni); used.add(ni);
  }

  // Pair releases by channel-normalized hand and pitch, preserving retriggers.
  const releases = new Map<PerformedMidiEvent, number>();
  const held = new Map<string, PerformedMidiEvent[]>();
  for (const event of [...performed].sort((a, b) => a.timestampMs - b.timestampMs)) {
    const key = `${event.hand ?? "unknown"}:${event.midiNote}`;
    const queue = held.get(key) ?? [];
    if (event.type === "noteOn") queue.push(event);
    else { const attack = queue.shift(); if (attack) releases.set(attack, event.timestampMs); }
    held.set(key, queue);
  }
  const hasReleases = performed.some(event => event.type === "noteOff");
  const result: EventMatch[] = expected.map((target, ti) => {
    const selected = assigned[ti]!.map(i => notes[i]!);
    if (!selected.length) return { expected: target, performed: [], classification: "missed" };
    const error = selected.reduce((sum, note) => sum + note.timestampMs - target.expectedMs, 0) / selected.length;
    const complete = covered[ti]!.size === target.pitches.length;
    const durationCorrect = !hasReleases || !complete ? undefined : selected.every(note => {
      const release = releases.get(note);
      if (release === undefined) return false;
      const duration = release - note.timestampMs;
      return duration >= target.durationMs * .35 && duration <= target.durationMs + Math.max(150, target.durationMs * .35);
    });
    return { expected: target, performed: selected, timingErrorMs: error, durationCorrect,
      classification: !complete ? "wrongPitch" : error < -(options.correctEarlyMs ?? options.earlyToleranceMs / 2) ? "early"
        : error > (options.correctLateMs ?? options.lateToleranceMs / 2) ? "late" : "correct" };
  });
  notes.forEach((note, i) => { if (!used.has(i)) result.push({ performed: [note], classification: "extra" }); });
  return result;
};
