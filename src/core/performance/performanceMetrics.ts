import type { Hand } from "../model";
import type { EventMatch } from "./eventMatcher";
export type FeatureMetrics = { attempts: number; correct: number; pitchAccuracy: number; timingAccuracy: number };
export type HandMetrics = FeatureMetrics & { missed: number; extra: number };
export type PerformanceMetrics = {
  pitchAccuracy: number; timingAccuracy: number; missedNotes: number; extraNotes: number;
  continuity: number; durationAccuracy?: number; longestHesitationMs: number; lateEventClusters: number;
  recoveryMetrics: { meanRecoveryMsAfterError: number; meanRecoveryBeatsAfterError: number };
  rightHand: HandMetrics; leftHand: HandMetrics; byFeature: Record<string, FeatureMetrics>;
};
const pitchCorrect = (match: EventMatch) => ["correct", "early", "late"].includes(match.classification);
const summarize = (matches: EventMatch[], hand?: Hand): HandMetrics => {
  const selected = hand ? matches.filter(m => m.expected?.hand === hand || (!m.expected && m.performed[0]?.hand === hand)) : matches;
  const attempts = selected.filter(m => m.expected).length, correct = selected.filter(pitchCorrect).length;
  return { attempts, correct, pitchAccuracy: attempts ? correct / attempts : 1,
    timingAccuracy: attempts ? selected.filter(m => m.classification === "correct").length / attempts : 1,
    missed: selected.filter(m => m.classification === "missed").length, extra: selected.filter(m => m.classification === "extra").length };
};
export const featureKeys = (match: EventMatch): string[] => {
  if (!match.expected) return [];
  const md = match.expected.metadata;
  return [`scaleDegree:${md.scaleDegree?.degree}`, `pattern:${md.patternFamily}`, `rhythm:${md.rhythmCellId}`, `interval:${Math.abs(md.intervalFromPrevious ?? 0)}`,
    ...md.challengeTags.map(x => `challenge:${x}`)].filter(x => !x.endsWith("undefined"));
};
export const computeMetrics = (matches: EventMatch[], beatMs = 750): PerformanceMetrics => {
  const overall = summarize(matches);
  const targets = matches.filter(m => m.expected).sort((a, b) => a.expected!.expectedMs - b.expected!.expectedMs);
  const byFeature: Record<string, FeatureMetrics> = {};
  for (const match of matches) for (const key of featureKeys(match)) {
    const value = byFeature[key] ?? { attempts: 0, correct: 0, pitchAccuracy: 0, timingAccuracy: 0 };
    value.attempts++; if (pitchCorrect(match)) value.correct++;
    value.pitchAccuracy = value.correct / value.attempts;
    value.timingAccuracy = (value.timingAccuracy * (value.attempts - 1) + (match.classification === "correct" ? 1 : 0)) / value.attempts;
    byFeature[key] = value;
  }
  // Silence at a complete onset group is a hesitation; a missed bass under a
  // continuing melody affects accuracy, but is not a pause in the performance.
  const groups = new Map<number, EventMatch[]>();
  for (const target of targets) { const time = target.expected!.expectedMs; groups.set(time, [...(groups.get(time) ?? []), target]); }
  let gapStart: number | undefined, longestGap = 0;
  for (const [time, group] of groups) {
    const attacks = group.flatMap(m => m.performed);
    if (!attacks.length) gapStart ??= time;
    else if (gapStart !== undefined) { longestGap = Math.max(longestGap, Math.min(...attacks.map(e => e.timestampMs)) - gapStart); gapStart = undefined; }
  }
  if (gapStart !== undefined) longestGap = Math.max(longestGap, Math.max(...targets.map(m => m.expected!.expectedMs + m.expected!.durationMs)) - gapStart);
  const recovery = matches.filter(m => !pitchCorrect(m)).flatMap(error => {
    const time = error.expected?.expectedMs ?? error.performed[0]?.timestampMs ?? 0;
    const next = targets.find(m => m.expected!.expectedMs > time && pitchCorrect(m));
    return next ? [next.expected!.expectedMs - time] : [];
  });
  const mean = recovery.length ? recovery.reduce((a, b) => a + b, 0) / recovery.length : 0;
  const durations = matches.filter(m => m.durationCorrect !== undefined);
  const continuous = targets.filter(m => m.performed.length && Math.abs(m.timingErrorMs ?? 0) <= beatMs / 2).length;
  return {
    pitchAccuracy: overall.pitchAccuracy, timingAccuracy: overall.timingAccuracy, missedNotes: overall.missed, extraNotes: overall.extra,
    continuity: overall.attempts ? continuous / overall.attempts : 1,
    durationAccuracy: durations.length ? durations.filter(m => m.durationCorrect).length / durations.length : undefined,
    longestHesitationMs: Math.max(0, longestGap, ...matches.map(m => m.timingErrorMs ?? 0)),
    lateEventClusters: targets.filter((m, i) => m.classification === "late" && targets[i - 1]?.classification !== "late").length,
    recoveryMetrics: { meanRecoveryMsAfterError: mean, meanRecoveryBeatsAfterError: mean / beatMs },
    rightHand: summarize(matches, "right"), leftHand: summarize(matches, "left"), byFeature,
  };
};
