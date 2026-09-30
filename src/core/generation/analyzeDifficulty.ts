import type { DifficultyVector, Exercise, ExerciseEvent } from "../model";
import { MELODIC_PATTERNS } from "../patterns/melodicPatterns";
import { RHYTHM_CELLS } from "../patterns/rhythmCells";

const clamp = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

const movement = (events: ExerciseEvent[]) => {
  const sounding = events.filter((event) => event.pitches.length);
  return average(sounding.slice(1).map((event, index) => Math.abs(event.pitches[0]!.midi - sounding[index]!.pitches[0]!.midi) / 12));
};

export const analyzeDifficulty = (exercise: Omit<Exercise, "difficulty">): DifficultyVector => {
  const all = [...exercise.rightHand, ...exercise.leftHand];
  const soundingNotes = all.filter((e) => e.pitches.length);
  const rhSounding = exercise.rightHand.filter((e) => e.pitches.length);
  const phraseCount = Math.max(1, exercise.phrase?.length || Math.round(exercise.totalDuration / 1920));

  // 1. Observable interval & pattern analysis
  const intervals = rhSounding.slice(1).map((e, i) => Math.abs(e.pitches[0]!.midi - rhSounding[i]!.pitches[0]!.midi));
  const uniqueIntervals = new Set(intervals).size;
  const leapRatio = intervals.length ? intervals.filter((int) => int >= 5).length / intervals.length : 0;
  const realizedPatternComplexity = clamp(leapRatio * 0.5 + (uniqueIntervals / 8) * 0.5);

  const knownPatternComplexities = [...new Set(exercise.rightHand.map((e) => e.metadata.patternId))]
    .map((id) => MELODIC_PATTERNS.find((p) => p.id === id)?.complexity)
    .filter((c): c is number => c !== undefined);

  const patternComplexity = knownPatternComplexities.length
    ? average(knownPatternComplexities)
    : realizedPatternComplexity;

  // 2. Observable rhythm analysis
  const durations = rhSounding.map((e) => e.duration);
  const minDuration = durations.length ? Math.min(...durations) : 480;
  const uniqueDurations = new Set(durations).size;
  const subdivisionScore = minDuration <= 120 ? 0.6 : minDuration <= 240 ? 0.35 : 0.1;
  const syncopatedCount = exercise.rightHand.filter(
    (e) => e.metadata.challengeTags.includes("syncopation") || (e.onset % 240 !== 0 && e.pitches.length > 0)
  ).length;
  const syncopationRatio = rhSounding.length ? syncopatedCount / rhSounding.length : 0;
  const realizedRhythmComplexity = clamp(subdivisionScore + syncopationRatio * 0.3 + (uniqueDurations / 6) * 0.2);

  const knownRhythmComplexities = [...new Set(all.map((e) => e.metadata.rhythmCellId))]
    .map((id) => RHYTHM_CELLS.find((cell) => cell.id === id)?.complexity)
    .filter((c): c is number => c !== undefined);

  const rhythmComplexity = knownRhythmComplexities.length
    ? average(knownRhythmComplexities)
    : realizedRhythmComplexity;

  // 3. Coordination & motor analysis
  const rightOnsets = new Set(rhSounding.map((e) => e.onset));
  const leftOnsets = new Set(exercise.leftHand.filter((e) => e.pitches.length).map((e) => e.onset));
  const independent = [...rightOnsets].filter((x) => !leftOnsets.has(x)).length +
    [...leftOnsets].filter((x) => !rightOnsets.has(x)).length;
  const totalOnsets = rightOnsets.size + leftOnsets.size;
  const coordination = exercise.leftHand.length ? clamp(independent / Math.max(1, totalOnsets)) : 0;

  // Left hand motor movement
  const lhDistances = exercise.leftHand.slice(1).map((e) => e.metadata.bassDistance ?? 0);
  const leftHandMotor = clamp(average(lhDistances));

  // Tonal & chromatic analysis
  const chromaticNotes = exercise.rightHand.filter((e) => e.metadata.chromatic || (e.pitches[0] && e.metadata.chromaticRole));
  const keyComplexity = exercise.tonalContext.tonic !== "C" ? 0.25 : 0;
  const chromaticRatio = rhSounding.length ? chromaticNotes.length / rhSounding.length : 0;
  const tonal = clamp(keyComplexity + chromaticRatio);

  // Density & harmony
  const totalBeats = Math.max(1, exercise.totalDuration / 480);
  const density = clamp(soundingNotes.length / totalBeats);
  const qualityCount = new Set(exercise.harmony.map((h) => h.quality)).size;
  const harmonyRate = exercise.harmony.length / phraseCount;
  const harmony = clamp((qualityCount / 4) * 0.6 + (harmonyRate / 2) * 0.4);

  // Predictability
  const patternNovelty = new Set(exercise.rightHand.map((e) => e.metadata.patternId || e.metadata.gestureType)).size / phraseCount;
  const predictability = clamp(1 - patternNovelty * 0.5);

  // Challenges
  const challenges = all.filter((e) => e.metadata.challengeTags.length > 0 || (e.metadata.intervalFromPrevious && Math.abs(e.metadata.intervalFromPrevious) >= 8));
  const challengeDensity = clamp(challenges.length / Math.max(1, all.length));

  return {
    tonal,
    pitchMovement: clamp(movement(exercise.rightHand)),
    patternComplexity: clamp(patternComplexity),
    rhythm: clamp(rhythmComplexity),
    density,
    harmony,
    rightHandMotor: clamp(movement(exercise.rightHand)),
    leftHandMotor,
    coordination,
    predictability,
    tempo: clamp((exercise.tempoBpm - 30) / 170),
    challengeDensity,
  };
};
