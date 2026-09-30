import type { PatternTransformation, PhraseRole, PhraseSection } from "../model";
import type { Rng } from "../random/rng";
import { defaultGrammarWeights, type GrammarWeights, type PhraseContourPhase } from "./grammarWeights";
import type { AntiRepetitionTracker } from "./antiRepetition";

export type PhraseContourPoint = {
  measure: number;
  position: number;
  registerTarget: number;
  tension: number;
  phase: PhraseContourPhase;
};

export type PhraseContourTrajectoryId =
  | "stableRisePeakResolve"
  | "riseFallRiseRelease"
  | "stableUpwardSequenceClimaxDescend"
  | "lowOpeningExpansionDominantClosure"
  | "fallRecoverRiseWeakEnding";

export interface PhrasePlanResult {
  archetypeId: string;
  sections: PhraseSection[];
  contourTrajectoryId: PhraseContourTrajectoryId;
  contourPoints: PhraseContourPoint[];
}

export type PhraseArchetype = {
  id: string;
  name: string;
  supportsLength: (measures: number) => boolean;
  build: (measures: number, rng: Rng) => { archetypeId: string; sections: PhraseSection[] };
};

const ARCHETYPES: PhraseArchetype[] = [
  {
    id: "sentence-4",
    name: "Classical Sentence (statement → variation → continuation → cadence)",
    supportsLength: (m) => m === 4,
    build: (_m, rng) => {
      const varChoice: PatternTransformation = rng.pick(["sequenceUp", "sequenceDown", "newStart", "newPitches"]);
      return {
        archetypeId: "sentence-4",
        sections: [
          { id: "sec-0", label: "A", measure: 0, role: "statement", phraseIndex: 0, transformation: "exact" },
          { id: "sec-1", label: "A'", measure: 1, role: "variation", phraseIndex: 0, transformation: varChoice },
          { id: "sec-2", label: "B", measure: 2, role: "continuation", phraseIndex: 0, transformation: "continuation" },
          { id: "sec-3", label: "cadence", measure: 3, role: "cadence", phraseIndex: 0, transformation: "changedEnding" },
        ],
      };
    },
  },
  {
    id: "statement-response-4",
    name: "Statement-Response (statement → response → sequence → cadence)",
    supportsLength: (m) => m === 4,
    build: (_m, rng) => {
      const seqChoice: PatternTransformation = rng.pick(["sequenceUp", "sequenceDown", "continuation"]);
      return {
        archetypeId: "statement-response-4",
        sections: [
          { id: "sec-0", label: "A", measure: 0, role: "statement", phraseIndex: 0, transformation: "exact" },
          { id: "sec-1", label: "B", measure: 1, role: "response", phraseIndex: 0, transformation: "newStart" },
          { id: "sec-2", label: "B'", measure: 2, role: "sequence", phraseIndex: 0, transformation: seqChoice },
          { id: "sec-3", label: "cadence", measure: 3, role: "cadence", phraseIndex: 0, transformation: "changedEnding" },
        ],
      };
    },
  },
  {
    id: "opening-contrast-return-4",
    name: "Ternary Micro-Form (opening → contrast → return → cadence)",
    supportsLength: (m) => m === 4,
    build: (m, rng) => {
      void m;
      void rng;
      return {
        archetypeId: "opening-contrast-return-4",
        sections: [
          { id: "sec-0", label: "A", measure: 0, role: "opening", phraseIndex: 0, transformation: "exact" },
          { id: "sec-1", label: "B", measure: 1, role: "contrast", phraseIndex: 0, transformation: "newPitches" },
          { id: "sec-2", label: "A'", measure: 2, role: "repetition", phraseIndex: 0, transformation: "exact" },
          { id: "sec-3", label: "cadence", measure: 3, role: "cadence", phraseIndex: 0, transformation: "changedEnding" },
        ],
      };
    },
  },
  {
    id: "statement-sequence-cadence-4",
    name: "Statement-Sequence (statement → sequence → prep → cadence)",
    supportsLength: (m) => m === 4,
    build: (_m, rng) => ({
      archetypeId: "statement-sequence-cadence-4",
      sections: [
        { id: "sec-0", label: "A", measure: 0, role: "statement", phraseIndex: 0, transformation: "exact" },
        { id: "sec-1", label: "A_seq", measure: 1, role: "sequence", phraseIndex: 0, transformation: rng.pick(["sequenceUp", "sequenceDown"]) },
        { id: "sec-2", label: "prep", measure: 2, role: "cadentialPreparation", phraseIndex: 0, transformation: "continuation" },
        { id: "sec-3", label: "cadence", measure: 3, role: "cadence", phraseIndex: 0, transformation: "changedEnding" },
      ],
    }),
  },
  {
    id: "statement-climax-closure-4",
    name: "Climax trajectory (statement → continuation → climax → cadence)",
    supportsLength: (m) => m === 4,
    build: (_m, rng) => ({
      archetypeId: "statement-climax-closure-4",
      sections: [
        { id: "sec-0", label: "A", measure: 0, role: "statement", phraseIndex: 0, transformation: "exact" },
        { id: "sec-1", label: "cont", measure: 1, role: "continuation", phraseIndex: 0, transformation: rng.pick(["extended", "sequenceUp"]) },
        { id: "sec-2", label: "climax", measure: 2, role: "climax", phraseIndex: 0, transformation: "continuation" },
        { id: "sec-3", label: "cadence", measure: 3, role: "cadence", phraseIndex: 0, transformation: "changedEnding" },
      ],
    }),
  },
  {
    id: "arch-form-4",
    name: "Arch trajectory (opening → variation → sequence → cadence)",
    supportsLength: (m) => m === 4,
    build: (_m, rng) => ({
      archetypeId: "arch-form-4",
      sections: [
        { id: "sec-0", label: "A", measure: 0, role: "opening", phraseIndex: 0, transformation: "exact" },
        { id: "sec-1", label: "A'", measure: 1, role: "variation", phraseIndex: 0, transformation: rng.pick(["newStart", "rhythmicVariation"]) },
        { id: "sec-2", label: "seq", measure: 2, role: "sequence", phraseIndex: 0, transformation: "sequenceDown" },
        { id: "sec-3", label: "cadence", measure: 3, role: "cadence", phraseIndex: 0, transformation: "changedEnding" },
      ],
    }),
  },
  {
    id: "period-8",
    name: "8-bar Period (4-bar Antecedent → 4-bar Consequent)",
    supportsLength: (m) => m === 8,
    build: (_m, rng) => {
      const antSeq: PatternTransformation = rng.pick(["sequenceUp", "sequenceDown", "newStart"]);
      const consSeq: PatternTransformation = rng.pick(["continuation", "extended", "newPitches"]);
      return {
        archetypeId: "period-8",
        sections: [
          { id: "sec-0", label: "A", measure: 0, role: "statement", phraseIndex: 0, transformation: "exact" },
          { id: "sec-1", label: "A'", measure: 1, role: "variation", phraseIndex: 0, transformation: antSeq },
          { id: "sec-2", label: "B", measure: 2, role: "continuation", phraseIndex: 0, transformation: "continuation" },
          { id: "sec-3", label: "half_cad", measure: 3, role: "continuation", phraseIndex: 0, transformation: "changedEnding" },
          { id: "sec-4", label: "A''", measure: 4, role: "statement", phraseIndex: 1, transformation: "exact" },
          { id: "sec-5", label: "B'", measure: 5, role: "contrast", phraseIndex: 1, transformation: consSeq },
          { id: "sec-6", label: "climax", measure: 6, role: "climax", phraseIndex: 1, transformation: "continuation" },
          { id: "sec-7", label: "cadence", measure: 7, role: "cadence", phraseIndex: 1, transformation: "changedEnding" },
        ],
      };
    },
  },
  {
    id: "sentence-8",
    name: "8-bar Expanded Sentence",
    supportsLength: (m) => m === 8,
    build: (_m, rng) => ({
      archetypeId: "sentence-8",
      sections: [
        { id: "sec-0", label: "A", measure: 0, role: "opening", phraseIndex: 0, transformation: "exact" },
        { id: "sec-1", label: "A'", measure: 1, role: "repetition", phraseIndex: 0, transformation: rng.pick(["exact", "sequenceUp"]) },
        { id: "sec-2", label: "B", measure: 2, role: "continuation", phraseIndex: 0, transformation: "continuation" },
        { id: "sec-3", label: "B_seq", measure: 3, role: "sequence", phraseIndex: 0, transformation: "sequenceDown" },
        { id: "sec-4", label: "C_dev", measure: 4, role: "contrast", phraseIndex: 0, transformation: "newStart" },
        { id: "sec-5", label: "climax", measure: 5, role: "climax", phraseIndex: 0, transformation: "continuation" },
        { id: "sec-6", label: "cad_prep", measure: 6, role: "cadentialPreparation", phraseIndex: 0, transformation: "shortened" },
        { id: "sec-7", label: "cadence", measure: 7, role: "cadence", phraseIndex: 0, transformation: "changedEnding" },
      ],
    }),
  },
  {
    id: "a-a-b-closure-8",
    name: "8-bar A → A' → B → Closing",
    supportsLength: (m) => m === 8,
    build: (_m, rng) => ({
      archetypeId: "a-a-b-closure-8",
      sections: [
        { id: "sec-0", label: "A", measure: 0, role: "statement", phraseIndex: 0, transformation: "exact" },
        { id: "sec-1", label: "A_ext", measure: 1, role: "continuation", phraseIndex: 0, transformation: "extended" },
        { id: "sec-2", label: "A'", measure: 2, role: "variation", phraseIndex: 0, transformation: rng.pick(["sequenceUp", "newPitches"]) },
        { id: "sec-3", label: "A'_ext", measure: 3, role: "sequence", phraseIndex: 0, transformation: "continuation" },
        { id: "sec-4", label: "B", measure: 4, role: "contrast", phraseIndex: 0, transformation: "newStart" },
        { id: "sec-5", label: "B_climax", measure: 5, role: "climax", phraseIndex: 0, transformation: "continuation" },
        { id: "sec-6", label: "closure_prep", measure: 6, role: "cadentialPreparation", phraseIndex: 0, transformation: "shortened" },
        { id: "sec-7", label: "cadence", measure: 7, role: "cadence", phraseIndex: 0, transformation: "changedEnding" },
      ],
    }),
  },
  {
    id: "two-bar-dialogue",
    name: "2-bar Dialogue (statement → cadence)",
    supportsLength: (m) => m === 2,
    build: (_m, rng) => ({
      archetypeId: "two-bar-dialogue",
      sections: [
        { id: "sec-0", label: "A", measure: 0, role: "statement", phraseIndex: 0, transformation: "exact" },
        { id: "sec-1", label: "cadence", measure: 1, role: "cadence", phraseIndex: 0, transformation: rng.pick(["changedEnding", "continuation"]) },
      ],
    }),
  },
];

const generateGenericPhrasePlan = (measures: number, rng: Rng): { archetypeId: string; sections: PhraseSection[] } => {
  const sections: PhraseSection[] = [];
  const phraseSize = measures >= 8 ? 4 : measures >= 4 ? 4 : 2;
  const numPhrases = Math.ceil(measures / phraseSize);

  for (let m = 0; m < measures; m++) {
    const phraseIndex = Math.floor(m / phraseSize);
    const posInPhrase = m % phraseSize;
    const isLastInPhrase = posInPhrase === phraseSize - 1 || m === measures - 1;
    const isGlobalLast = m === measures - 1;

    let role: PhraseRole;
    let label: string;
    let transformation: PatternTransformation;

    if (isGlobalLast || isLastInPhrase) {
      role = "cadence";
      label = isGlobalLast ? "cadence" : `cadence-${phraseIndex}`;
      transformation = "changedEnding";
    } else if (posInPhrase === 0) {
      role = phraseIndex === 0 ? "statement" : phraseIndex % 2 === 1 ? "contrast" : "repetition";
      label = phraseIndex === 0 ? "A" : phraseIndex % 2 === 1 ? "B" : "A'";
      transformation = phraseIndex === 0 ? "exact" : rng.pick(["exact", "newStart", "sequenceUp"]);
    } else if (posInPhrase === 1) {
      role = "variation";
      label = `${sections[m - 1]!.label}'`;
      transformation = rng.pick(["sequenceUp", "sequenceDown", "newPitches", "continuation"]);
    } else if (posInPhrase === phraseSize - 2) {
      role = "cadentialPreparation";
      label = "prep";
      transformation = rng.pick(["continuation", "shortened"]);
    } else {
      role = "continuation";
      label = "cont";
      transformation = "continuation";
    }

    sections.push({
      id: `sec-${m}`,
      label,
      measure: m,
      role,
      phraseIndex,
      transformation,
    });
  }

  return { archetypeId: `generic-${measures}m-${numPhrases}p`, sections };
};

export const samplePhraseContour = (
  trajectoryId: PhraseContourTrajectoryId,
  measures: number
): PhraseContourPoint[] => {
  return Array.from({ length: measures }, (_, measure) => {
    const position = measures <= 1 ? 0 : measure / (measures - 1);
    let registerTarget = 0.5;
    let tension = 0.5;
    let phase: PhraseContourPhase = "stable";

    switch (trajectoryId) {
      case "stableRisePeakResolve":
        if (position < 0.25) {
          registerTarget = 0.35 + position * 0.4;
          tension = 0.2 + position * 0.8;
          phase = "stable";
        } else if (position < 0.65) {
          registerTarget = 0.45 + (position - 0.25) * 1.0;
          tension = 0.4 + (position - 0.25) * 1.25;
          phase = "rise";
        } else if (position < 0.85) {
          registerTarget = 0.85 - (position - 0.65) * 0.5;
          tension = 0.9 - (position - 0.65) * 1.5;
          phase = "peak";
        } else {
          registerTarget = 0.4 - (position - 0.85) * 0.8;
          tension = 0.3 - (position - 0.85) * 1.5;
          phase = "release";
        }
        break;

      case "riseFallRiseRelease":
        if (position < 0.3) {
          registerTarget = 0.3 + position * 1.3;
          tension = 0.3 + position * 1.3;
          phase = "rise";
        } else if (position < 0.55) {
          registerTarget = 0.7 - (position - 0.3) * 1.2;
          tension = 0.7 - (position - 0.3) * 1.2;
          phase = "fall";
        } else if (position < 0.8) {
          registerTarget = 0.4 + (position - 0.55) * 1.6;
          tension = 0.4 + (position - 0.55) * 1.8;
          phase = "peak";
        } else {
          registerTarget = 0.8 - (position - 0.8) * 2.0;
          tension = 0.3 - (position - 0.8) * 1.0;
          phase = "release";
        }
        break;

      case "stableUpwardSequenceClimaxDescend":
        if (position < 0.3) {
          registerTarget = 0.35 + position * 0.3;
          tension = 0.2 + position * 0.6;
          phase = "stable";
        } else if (position < 0.7) {
          registerTarget = 0.45 + (position - 0.3) * 1.1;
          tension = 0.4 + (position - 0.3) * 1.2;
          phase = "rise";
        } else if (position < 0.85) {
          registerTarget = 0.9;
          tension = 0.95;
          phase = "peak";
        } else {
          registerTarget = 0.9 - (position - 0.85) * 3.5;
          tension = 0.4 - (position - 0.85) * 2.0;
          phase = "release";
        }
        break;

      case "lowOpeningExpansionDominantClosure":
        if (position < 0.25) {
          registerTarget = 0.2 + position * 0.4;
          tension = 0.15 + position * 0.6;
          phase = "stable";
        } else if (position < 0.6) {
          registerTarget = 0.3 + (position - 0.25) * 1.1;
          tension = 0.3 + (position - 0.25) * 1.1;
          phase = "rise";
        } else if (position < 0.85) {
          registerTarget = 0.7 - (position - 0.6) * 0.4;
          tension = 0.75 + (position - 0.6) * 0.6;
          phase = "peak";
        } else {
          registerTarget = 0.4 - (position - 0.85) * 1.0;
          tension = 0.2 - (position - 0.85) * 1.0;
          phase = "release";
        }
        break;

      case "fallRecoverRiseWeakEnding":
        if (position < 0.3) {
          registerTarget = 0.75 - position * 1.5;
          tension = 0.5 - position * 1.0;
          phase = "fall";
        } else if (position < 0.65) {
          registerTarget = 0.3 + (position - 0.3) * 1.1;
          tension = 0.2 + (position - 0.3) * 1.3;
          phase = "rise";
        } else if (position < 0.85) {
          registerTarget = 0.7 + (position - 0.65) * 0.5;
          tension = 0.65 + (position - 0.65) * 0.5;
          phase = "peak";
        } else {
          registerTarget = 0.6 - (position - 0.85) * 0.6;
          tension = 0.4 - (position - 0.85) * 1.0;
          phase = "release";
        }
        break;
    }

    return {
      measure,
      position,
      registerTarget: Math.max(0, Math.min(1, registerTarget)),
      tension: Math.max(0, Math.min(1, tension)),
      phase,
    };
  });
};

export const generatePhrasePlanWithGrammar = (
  measures: number,
  rng: Rng,
  weights: GrammarWeights = defaultGrammarWeights,
  antiRepetition?: AntiRepetitionTracker
): PhrasePlanResult => {
  // Diffuse PRNG state so low integer seeds explore all archetypes uniformly
  rng.next();
  rng.next();
  rng.next();

  const compatible = ARCHETYPES.filter((a) => a.supportsLength(measures));
  let archetypeResult: { archetypeId: string; sections: PhraseSection[] };

  if (compatible.length > 0) {
    const candidates = compatible.map((arch) => ({
      value: arch,
      weight: weights.phraseArchetypeWeight({ measures, phraseIndex: 0, totalPhrases: 1, mode: "major" }, arch.id) *
        (antiRepetition ? antiRepetition.getArchetypePenalty(arch.id) : 1.0),
    }));
    archetypeResult = rng.weightedPick(candidates).build(measures, rng);
  } else {
    archetypeResult = generateGenericPhrasePlan(measures, rng);
  }

  const trajectories: PhraseContourTrajectoryId[] = [
    "stableRisePeakResolve",
    "riseFallRiseRelease",
    "stableUpwardSequenceClimaxDescend",
    "lowOpeningExpansionDominantClosure",
    "fallRecoverRiseWeakEnding",
  ];
  const trajCandidates = trajectories.map((t) => ({
    value: t,
    weight: antiRepetition ? antiRepetition.getContourPenalty(t) : 1.0,
  }));
  const contourTrajectoryId = rng.weightedPick(trajCandidates);
  const contourPoints = samplePhraseContour(contourTrajectoryId, measures);

  return {
    archetypeId: archetypeResult.archetypeId,
    sections: archetypeResult.sections,
    contourTrajectoryId,
    contourPoints,
  };
};
