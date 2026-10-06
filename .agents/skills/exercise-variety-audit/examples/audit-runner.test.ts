import { describe, it } from "vitest";
import { defaultTrainingRequest } from "../../../../src/core/training/trainingIntent";
import { generateExercise } from "../../../../src/core/generation/generateExercise";
import type { RhythmNoteValue, RhythmStyle } from "../../../../src/core/model";

interface AuditSummary {
  intervalCounts: Record<number, number>;
  totalIntervals: number;
  lastBarSequences: Record<string, number>;
  lastBarFinalDegrees: Record<number, number>;
  contourCounts: { downward: number; upward: number; flat: number };
  sampleSize: number;
}

const runAudit = (sampleSize: number, style: RhythmStyle, noteValue: RhythmNoteValue): AuditSummary => {
  const summary: AuditSummary = {
    intervalCounts: {},
    totalIntervals: 0,
    lastBarSequences: {},
    lastBarFinalDegrees: {},
    contourCounts: { downward: 0, upward: 0, flat: 0 },
    sampleSize,
  };

  for (let seed = 1; seed <= sampleSize; seed++) {
    const request = defaultTrainingRequest();
    request.tonal.keys = ["C major"];
    request.rhythm.style = style;
    request.rhythm.noteValue = noteValue;
    request.emphasis = "everything";

    const exercise = generateExercise(request, seed);
    const rh = exercise.rightHand.filter((e) => e.pitches.length > 0);

    // 1. Intervals
    for (let i = 1; i < rh.length; i++) {
      const prev = rh[i - 1]!.pitches[0]!.midi;
      const curr = rh[i]!.pitches[0]!.midi;
      const diff = curr - prev;
      summary.intervalCounts[diff] = (summary.intervalCounts[diff] ?? 0) + 1;
      summary.totalIntervals++;
    }

    // 2. Last bar analysis
    const lastBarEvents = rh.filter((e) => e.onset >= 5760); // Bar 3 onset in 4/4
    if (lastBarEvents.length > 0) {
      const degrees = lastBarEvents.map((e) => e.metadata.scaleDegree?.degree ?? 0);
      const seqStr = degrees.join("->");
      summary.lastBarSequences[seqStr] = (summary.lastBarSequences[seqStr] ?? 0) + 1;

      const finalDeg = degrees[degrees.length - 1] ?? 0;
      summary.lastBarFinalDegrees[finalDeg] = (summary.lastBarFinalDegrees[finalDeg] ?? 0) + 1;

      const firstPitch = lastBarEvents[0]!.pitches[0]!.midi;
      const lastPitch = lastBarEvents[lastBarEvents.length - 1]!.pitches[0]!.midi;
      if (lastPitch < firstPitch) summary.contourCounts.downward++;
      else if (lastPitch > firstPitch) summary.contourCounts.upward++;
      else summary.contourCounts.flat++;
    }
  }

  return summary;
};

const printSummary = (label: string, summary: AuditSummary) => {
  console.log(`\n================ ${label} (n = ${summary.sampleSize}) ================`);

  const unisons = summary.intervalCounts[0] ?? 0;
  const unisonPct = ((unisons / Math.max(1, summary.totalIntervals)) * 100).toFixed(1);
  console.log(`Unisons (+0 semitones): ${unisons} / ${summary.totalIntervals} (${unisonPct}%) [Target: < 5%]`);

  console.log("\nTop 5 Last Bar Sequences:");
  const sortedSeq = Object.entries(summary.lastBarSequences).sort((a, b) => b[1] - a[1]);
  sortedSeq.slice(0, 5).forEach(([seq, count]) => {
    const pct = ((count / summary.sampleSize) * 100).toFixed(1);
    console.log(`  ${seq}: ${count} (${pct}%)`);
  });

  console.log("\nLast Bar Final Scale Degrees:");
  const sortedDeg = Object.entries(summary.lastBarFinalDegrees).sort((a, b) => b[1] - a[1]);
  sortedDeg.forEach(([deg, count]) => {
    const pct = ((count / summary.sampleSize) * 100).toFixed(1);
    console.log(`  Degree ${deg}: ${count} (${pct}%)`);
  });

  console.log("\nLast Bar Melodic Contours:");
  console.log(`  Downward: ${summary.contourCounts.downward} (${((summary.contourCounts.downward / summary.sampleSize) * 100).toFixed(1)}%)`);
  console.log(`  Upward: ${summary.contourCounts.upward} (${((summary.contourCounts.upward / summary.sampleSize) * 100).toFixed(1)}%)`);
  console.log(`  Flat: ${summary.contourCounts.flat} (${((summary.contourCounts.flat / summary.sampleSize) * 100).toFixed(1)}%)`);
};

describe("Exercise Variety Audit Runner", () => {
  it("audits generator distributions across steady and mixed rhythm modes", () => {
    const quarterAudit = runAudit(100, "steady", "quarter");
    printSummary("STEADY MODE (quarter notes)", quarterAudit);

    const eighthAudit = runAudit(100, "steady", "eighth");
    printSummary("STEADY MODE (eighth notes)", eighthAudit);

    const mixedAudit = runAudit(100, "mixed", "quarter");
    printSummary("MIXED MODE", mixedAudit);
  });
});
