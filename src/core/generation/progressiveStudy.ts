import type { Meter, RightHandEmphasis } from "../model";
import type { TrainingRequest } from "../training/trainingIntent";
import { createRng } from "../random/rng";

export interface StudyStepInfo {
  step: 1 | 2 | 3;
  label: "Theme" | "Variation" | "Challenge";
  cycle: number;
  topic: string;
  emphasis: RightHandEmphasis;
}

export const STUDY_TOPICS: readonly { emphasis: RightHandEmphasis; label: string }[] = [
  { emphasis: "melodicPatterns", label: "Linear Fluency" },
  { emphasis: "arpeggios", label: "Harmonic Outlines" },
  { emphasis: "intervals", label: "Interval Dexterity" },
  { emphasis: "cadencesApproaches", label: "Cadence & Integration" },
  { emphasis: "rhythm", label: "Rhythmic Articulation" },
];

export const topicForCycle = (cycle: number): { emphasis: RightHandEmphasis; label: string } => {
  const index = ((cycle % STUDY_TOPICS.length) + STUDY_TOPICS.length) % STUDY_TOPICS.length;
  return STUDY_TOPICS[index]!;
};

const formatEmphasisLabel = (emphasis: RightHandEmphasis): string => {
  switch (emphasis) {
    case "melodicPatterns": return "Melodic Patterns";
    case "intervals": return "Intervals";
    case "arpeggios": return "Arpeggios";
    case "cadencesApproaches": return "Cadences & Approaches";
    case "rhythm": return "Rhythm";
    case "everything":
    default:
      return "General Practice";
  }
};

export const studyStepForSeed = (seed: number, baseEmphasis: RightHandEmphasis = "everything"): StudyStepInfo => {
  const cycle = Math.floor(seed / 3);
  const stepIndex = ((seed % 3) + 3) % 3;
  const topic = topicForCycle(cycle);
  const activeEmphasis = baseEmphasis === "everything" ? topic.emphasis : baseEmphasis;
  const activeTopicLabel = baseEmphasis === "everything" ? topic.label : formatEmphasisLabel(baseEmphasis);

  switch (stepIndex) {
    case 0:
      return { step: 1, label: "Theme", cycle, topic: activeTopicLabel, emphasis: activeEmphasis };
    case 1:
      return { step: 2, label: "Variation", cycle, topic: activeTopicLabel, emphasis: activeEmphasis };
    case 2:
    default:
      return { step: 3, label: "Challenge", cycle, topic: activeTopicLabel, emphasis: activeEmphasis };
  }
};

/**
 * Deterministic shuffle-bag for key selection across cycles.
 * Guarantees every key in the pool is selected once per round before repeating,
 * and eliminates back-to-back duplicate keys across cycle boundaries.
 */
export const keyForCycle = (keys: readonly string[], cycle: number): string => {
  if (keys.length <= 1) return keys[0]!;
  const round = Math.floor(cycle / keys.length);
  const indexInRound = ((cycle % keys.length) + keys.length) % keys.length;
  const roundRng = createRng(round * 997 + 13);
  const shuffled = [...keys];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = roundRng.integer(0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled[indexInRound]!;
};

export const meterForCycle = (meters: readonly Meter[], cycle: number): Meter => {
  if (meters.length <= 1) return meters[0]!;
  const rng = createRng(cycle * 31 + 7);
  return rng.pick(meters);
};

export const progressionForCycle = (progressions: readonly string[], cycle: number): string => {
  if (progressions.length <= 1) return progressions[0]!;
  const round = Math.floor(cycle / progressions.length);
  const indexInRound = ((cycle % progressions.length) + progressions.length) % progressions.length;
  const roundRng = createRng(round * 991 + 19);
  const shuffled = [...progressions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = roundRng.integer(0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled[indexInRound]!;
};

export const applyProgressiveStudy = (request: TrainingRequest, seed: number): TrainingRequest => {
  if (request.sessionProgression === "independent" || request.leftHand.templateId) {
    return request;
  }

  const stepInfo = studyStepForSeed(seed, request.emphasis);
  const cycle = stepInfo.cycle;
  const step = stepInfo.step;

  // 1. Shared harmonic and rhythmic foundation across the 3 exercises in this cycle
  // If the user specified a single key or fixed key, that key is preserved 100%.
  // Only rotate if the request has multiple keys/meters/progressions to choose from.
  const selectedKey = request.tonal.selection === "fixed" || request.tonal.keys.length <= 1
    ? request.tonal.keys[0]!
    : keyForCycle(request.tonal.keys, cycle);

  const selectedMeter = request.rhythm.meters.length <= 1
    ? request.rhythm.meters[0]!
    : meterForCycle(request.rhythm.meters, cycle);

  const leftJumpProgression = !request.leftHand.enabled || request.leftHand.jumpFrequency === "none"
    ? request.harmony.progressionVocabulary
    : [`jump-${request.leftHand.jumpSize}-${request.leftHand.jumpFrequency}`];

  const selectedProgression = leftJumpProgression.length <= 1
    ? leftJumpProgression[0]!
    : progressionForCycle(leftJumpProgression, cycle);

  // 2. Modulate difficulty, variation, and coordination cleanly across Step 1, 2, 3
  const patterns = { ...request.patterns };
  const challenge = { ...request.challenge };
  const coordination = { ...request.coordination };
  let rhythmStyle = request.rhythm.style;
  let syncopation = request.rhythm.syncopation;

  if (step === 1) {
    // Step 1: Theme / Exposition (Grounded, predictable, theme establishment)
    patterns.repetition = Math.min(1, request.patterns.repetition * 1.25);
    patterns.variation = Math.max(0, request.patterns.variation * 0.5);
    challenge.density = 0;
    coordination.difficulty = Math.max(0.1, request.coordination.difficulty * 0.7);
    syncopation = Math.max(0, request.rhythm.syncopation * 0.5);
    if (rhythmStyle === "challenge") {
      rhythmStyle = "mostlySteady";
    }
  } else if (step === 2) {
    // Step 2: Variation (Dexterity, rhythmic variety, exploring the theme)
    patterns.repetition = Math.max(0.2, request.patterns.repetition * 0.85);
    patterns.variation = Math.min(1, request.patterns.variation * 1.4);
    challenge.density = request.challenge.density * 0.5;
    coordination.difficulty = request.coordination.difficulty;
    syncopation = request.rhythm.syncopation;
  } else {
    // Step 3: Challenge / Integration (Peak expression, cadential closure, integration)
    patterns.repetition = request.patterns.repetition;
    patterns.variation = request.patterns.variation;
    challenge.density = Math.min(1, Math.max(request.challenge.density, 0.08));
    coordination.difficulty = Math.min(1, request.coordination.difficulty * 1.2);
    syncopation = Math.min(1, request.rhythm.syncopation * 1.2);
  }

  return {
    ...request,
    tonal: {
      ...request.tonal,
      keys: [selectedKey],
      selection: "fixed",
    },
    rhythm: {
      ...request.rhythm,
      meters: [selectedMeter],
      style: rhythmStyle,
      syncopation,
    },
    harmony: {
      ...request.harmony,
      progressionVocabulary: [selectedProgression],
    },
    emphasis: stepInfo.emphasis,
    patterns,
    challenge,
    coordination,
  };
};
