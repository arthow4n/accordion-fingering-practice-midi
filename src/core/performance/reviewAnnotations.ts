import { TICKS_PER_QUARTER, type Exercise } from "../model";
import { pitchMatches, type EventMatch } from "./eventMatcher";
import type { PerformanceReport } from "./evaluatePerformance";
import { ticksToMs } from "./timeline";

export type ReviewAnnotation =
  | {
      kind: "wrongPitch";
      expectedEventId: string;
      playedMidiNotes: number[];
    }
  | {
      kind: "missed";
      expectedEventId: string;
    }
  | {
      kind: "extra";
      musicalPosition: number;
      playedMidiNotes: number[];
    }
  | {
      kind: "timing";
      expectedEventId: string;
      direction: "early" | "late";
    };

export const deriveReviewAnnotations = (
  reportOrMatches: PerformanceReport | EventMatch[],
  exercise?: Exercise
): ReviewAnnotation[] => {
  const matches = Array.isArray(reportOrMatches) ? reportOrMatches : reportOrMatches.matches;
  const annotations: ReviewAnnotation[] = [];

  const tempoBpm = exercise?.tempoBpm ?? 120;
  const refExpected = matches.find(m => m.expected)?.expected;
  const sessionStartMs = refExpected ? refExpected.expectedMs - ticksToMs(refExpected.onset, tempoBpm) : 0;

  for (const match of matches) {
    if (match.classification === "correct") {
      continue;
    }

    if (match.classification === "missed") {
      if (match.expected) {
        annotations.push({
          kind: "missed",
          expectedEventId: match.expected.id,
        });
      }
      continue;
    }

    if (match.classification === "wrongPitch") {
      if (match.expected) {
        const expectedPitches = match.expected.pitches;
        const wrongPitches = match.performed
          .filter(p => !expectedPitches.some(ep => pitchMatches(match.expected!, ep.midi, p.midiNote)))
          .map(p => p.midiNote);

        annotations.push({
          kind: "wrongPitch",
          expectedEventId: match.expected.id,
          playedMidiNotes: wrongPitches,
        });
      }
      continue;
    }

    if (match.classification === "early" || match.classification === "late") {
      if (match.expected) {
        annotations.push({
          kind: "timing",
          expectedEventId: match.expected.id,
          direction: match.classification,
        });
      }
      continue;
    }

    if (match.classification === "extra") {
      const firstNote = match.performed[0];
      const noteMs = firstNote?.timestampMs ?? 0;
      const relativeMs = Math.max(0, noteMs - sessionStartMs);
      const rawTicks = Math.round((relativeMs / (60_000 / tempoBpm)) * TICKS_PER_QUARTER);

      let closestOnset = rawTicks;
      if (exercise && exercise.rightHand.length > 0) {
        closestOnset = exercise.rightHand[0]!.onset;
        let minDiff = Math.abs(rawTicks - closestOnset);
        for (const ev of exercise.rightHand) {
          const diff = Math.abs(rawTicks - ev.onset);
          if (diff < minDiff) {
            minDiff = diff;
            closestOnset = ev.onset;
          }
        }
      }

      annotations.push({
        kind: "extra",
        musicalPosition: closestOnset,
        playedMidiNotes: match.performed.map(p => p.midiNote),
      });
      continue;
    }
  }

  return annotations;
};
