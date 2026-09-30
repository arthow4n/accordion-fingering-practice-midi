import type { CadenceType, ChordQuality, Meter, Mode, PhraseRole } from "../model";
import type { Rng } from "../random/rng";

export type MelodicApproachDirection = "descending" | "ascending" | "leapAndStep" | "neighbor" | "direct";

export type MelodicCadenceShape = {
  id: string;
  degrees: number[]; // scale degree path to arrival, e.g. [2, 1], [3, 2, 1], etc.
  arrivalDegree: number;
  direction: MelodicApproachDirection;
  suitableTypes: CadenceType[];
};

export type CadenceMetricArrival =
  | "beat1Sustain"
  | "beat3Arrival"
  | "lateArrival"
  | "earlyWithRepetition";

export type CadencePlan = {
  id: string;
  cadenceType: CadenceType;
  penultimateDegree: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  penultimateQuality: ChordQuality;
  penultimateSymbol: string;
  finalDegree: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  finalQuality: ChordQuality;
  finalSymbol: string;
  melodicShape: MelodicCadenceShape;
  arrivalMetric: CadenceMetricArrival;
  arrivalDegree: number;
};

export const MELODIC_CADENCE_SHAPES: MelodicCadenceShape[] = [
  // Tonic closures ending on 1
  { id: "step-down-2-1", degrees: [2, 1], arrivalDegree: 1, direction: "descending", suitableTypes: ["strongTonic", "weakTonic"] },
  { id: "leading-tone-7-1", degrees: [7, 1], arrivalDegree: 1, direction: "ascending", suitableTypes: ["strongTonic", "weakTonic"] },
  { id: "step-down-3-2-1", degrees: [3, 2, 1], arrivalDegree: 1, direction: "descending", suitableTypes: ["strongTonic", "weakTonic"] },
  { id: "skip-recovery-2-7-1", degrees: [2, 7, 1], arrivalDegree: 1, direction: "leapAndStep", suitableTypes: ["strongTonic", "weakTonic"] },
  { id: "leap-recovery-6-2-1", degrees: [6, 2, 1], arrivalDegree: 1, direction: "leapAndStep", suitableTypes: ["strongTonic", "weakTonic"] },
  { id: "triad-fall-5-3-1", degrees: [5, 3, 1], arrivalDegree: 1, direction: "descending", suitableTypes: ["strongTonic", "weakTonic"] },

  // Tonic closures ending on 3 (imperfect tonic closure)
  { id: "step-down-5-4-3", degrees: [5, 4, 3], arrivalDegree: 3, direction: "descending", suitableTypes: ["strongTonic", "weakTonic", "plagal"] },
  { id: "step-down-4-3", degrees: [4, 3], arrivalDegree: 3, direction: "descending", suitableTypes: ["strongTonic", "weakTonic", "plagal"] },
  { id: "step-up-2-3", degrees: [2, 3], arrivalDegree: 3, direction: "ascending", suitableTypes: ["weakTonic", "strongTonic"] },

  // Tonic closures ending on 5 (open/fifth tonic closure)
  { id: "step-up-3-4-5", degrees: [3, 4, 5], arrivalDegree: 5, direction: "ascending", suitableTypes: ["weakTonic", "plagal"] },
  { id: "step-down-6-5", degrees: [6, 5], arrivalDegree: 5, direction: "descending", suitableTypes: ["weakTonic", "half"] },

  // Plagal approach
  { id: "plagal-4-3", degrees: [4, 3], arrivalDegree: 3, direction: "descending", suitableTypes: ["plagal"] },
  { id: "plagal-4-1", degrees: [4, 1], arrivalDegree: 1, direction: "leapAndStep", suitableTypes: ["plagal"] },
  { id: "plagal-6-1", degrees: [6, 1], arrivalDegree: 1, direction: "ascending", suitableTypes: ["plagal"] },

  // Half cadences (ending on dominant degree 2, 5, or 7)
  { id: "half-1-2", degrees: [1, 2], arrivalDegree: 2, direction: "ascending", suitableTypes: ["half", "open"] },
  { id: "half-3-2", degrees: [3, 2], arrivalDegree: 2, direction: "descending", suitableTypes: ["half", "open"] },
  { id: "half-4-5", degrees: [4, 5], arrivalDegree: 5, direction: "ascending", suitableTypes: ["half", "open"] },
  { id: "half-6-5", degrees: [6, 5], arrivalDegree: 5, direction: "descending", suitableTypes: ["half", "open"] },
  { id: "half-2-7", degrees: [2, 7], arrivalDegree: 7, direction: "descending", suitableTypes: ["half", "open"] },

  // Deceptive cadences (ending on 6 or 1)
  { id: "deceptive-7-6", degrees: [7, 6], arrivalDegree: 6, direction: "descending", suitableTypes: ["deceptive"] },
  { id: "deceptive-5-6", degrees: [5, 6], arrivalDegree: 6, direction: "ascending", suitableTypes: ["deceptive"] },
];

export const planCadence = (
  mode: Mode,
  meter: Meter,
  isFinalPhrase: boolean,
  role: PhraseRole,
  rng: Rng
): CadencePlan => {
  let cadenceType: CadenceType;

  if (isFinalPhrase) {
    const roll = rng.next();
    if (roll < 0.60) {
      cadenceType = "strongTonic";
    } else if (roll < 0.85) {
      cadenceType = "weakTonic";
    } else {
      cadenceType = "plagal";
    }
  } else {
    // Internal cadence (e.g. antecedent or continuation)
    if (role === "cadentialPreparation" || role === "statement" || role === "opening") {
      const roll = rng.next();
      if (roll < 0.55) {
        cadenceType = "half";
      } else if (roll < 0.80) {
        cadenceType = "open";
      } else if (roll < 0.92) {
        cadenceType = "weakTonic";
      } else {
        cadenceType = "deceptive";
      }
    } else {
      cadenceType = rng.next() < 0.6 ? "half" : "weakTonic";
    }
  }

  // Harmonic realization
  let penultimateDegree: 1 | 2 | 3 | 4 | 5 | 6 | 7 = 5;
  let penultimateQuality: ChordQuality = mode === "minor" ? "major" : "major";
  let penultimateSymbol = mode === "minor" ? "V" : "V";

  let finalDegree: 1 | 2 | 3 | 4 | 5 | 6 | 7 = 1;
  let finalQuality: ChordQuality = mode === "minor" ? "minor" : "major";
  let finalSymbol = mode === "minor" ? "i" : "I";

  switch (cadenceType) {
    case "strongTonic":
      penultimateDegree = 5;
      penultimateQuality = rng.next() < 0.4 ? "dominant7" : "major";
      penultimateSymbol = penultimateQuality === "dominant7" ? "V7" : "V";
      finalDegree = 1;
      finalQuality = mode === "minor" ? "minor" : "major";
      finalSymbol = mode === "minor" ? "i" : "I";
      break;

    case "weakTonic":
      if (rng.next() < 0.5) {
        penultimateDegree = 5;
        penultimateQuality = "major";
        penultimateSymbol = "V";
      } else {
        penultimateDegree = 2;
        penultimateQuality = mode === "minor" ? "diminished" : "minor";
        penultimateSymbol = mode === "minor" ? "ii°" : "ii";
      }
      finalDegree = 1;
      finalQuality = mode === "minor" ? "minor" : "major";
      finalSymbol = mode === "minor" ? "i" : "I";
      break;

    case "half":
    case "open":
      penultimateDegree = rng.next() < 0.5 ? 4 : 2;
      penultimateQuality = penultimateDegree === 4
        ? (mode === "minor" ? "minor" : "major")
        : (mode === "minor" ? "diminished" : "minor");
      penultimateSymbol = penultimateDegree === 4
        ? (mode === "minor" ? "iv" : "IV")
        : (mode === "minor" ? "ii°" : "ii");
      finalDegree = 5;
      finalQuality = "major";
      finalSymbol = "V";
      break;

    case "plagal":
      penultimateDegree = 4;
      penultimateQuality = mode === "minor" ? "minor" : "major";
      penultimateSymbol = mode === "minor" ? "iv" : "IV";
      finalDegree = 1;
      finalQuality = mode === "minor" ? "minor" : "major";
      finalSymbol = mode === "minor" ? "i" : "I";
      break;

    case "deceptive":
      penultimateDegree = 5;
      penultimateQuality = "major";
      penultimateSymbol = "V";
      finalDegree = 6;
      finalQuality = mode === "minor" ? "major" : "minor";
      finalSymbol = mode === "minor" ? "VI" : "vi";
      break;
  }

  // Melodic cadence shapes compatible with cadenceType
  const compatibleShapes = MELODIC_CADENCE_SHAPES.filter((s) => s.suitableTypes.includes(cadenceType));
  const melodicShape = compatibleShapes.length > 0 ? rng.pick(compatibleShapes) : MELODIC_CADENCE_SHAPES[0]!;

  // Metric arrival choice
  let arrivalMetric: CadenceMetricArrival;
  if (meter.beats === 4) {
    const roll = rng.next();
    if (roll < 0.45) arrivalMetric = "beat1Sustain";
    else if (roll < 0.75) arrivalMetric = "beat3Arrival";
    else if (roll < 0.90) arrivalMetric = "lateArrival";
    else arrivalMetric = "earlyWithRepetition";
  } else if (meter.beats === 3) {
    const roll = rng.next();
    if (roll < 0.6) arrivalMetric = "beat1Sustain";
    else if (roll < 0.85) arrivalMetric = "lateArrival";
    else arrivalMetric = "earlyWithRepetition";
  } else {
    arrivalMetric = rng.next() < 0.7 ? "beat1Sustain" : "lateArrival";
  }

  return {
    id: `cadence-${cadenceType}-${melodicShape.id}`,
    cadenceType,
    penultimateDegree,
    penultimateQuality,
    penultimateSymbol,
    finalDegree,
    finalQuality,
    finalSymbol,
    melodicShape,
    arrivalMetric,
    arrivalDegree: melodicShape.arrivalDegree,
  };
};
