import type { CbaKeyboardLayout, CbaPhysicalLocation } from "./cbaLayout";
import { DEFAULT_CBA_LAYOUT, getCbaLocationsForMidi } from "./cbaLayout";

export interface CbaTransition {
  from: CbaPhysicalLocation;
  to: CbaPhysicalLocation;
  columnTravel: number;
  rowTravel: number;
  isDescending: boolean;
  isRetreatToDevilRows: boolean; // Moving from support rows (4/5) back down into rows 1/2
  isSupportRowRelief: boolean; // Stepping out to row 4/5 to prevent finger cramping
  frictionCost: number;
}

export interface CbaPathStep {
  index: number;
  midi: number;
  location: CbaPhysicalLocation;
  transitionFromPrevious?: CbaTransition;
}

export interface CbaErgonomicAnalysis {
  steps: CbaPathStep[];
  totalCost: number;
  averageFrictionPerNote: number;
  /** Number of times the unique Row 3 (middle axis) is visited */
  row3PivotCount: number;
  /** Percentage of notes that are locked onto Row 3 */
  row3BottleneckRatio: number;
  /** Percentage of notes played on the lower "devil rows" (1, 2, 3) */
  devilRowRatio: number;
  /** Percentage of notes played on the support rows (4, 5) */
  supportRowUtilization: number;
  /** Directional friction score (higher means more backward contractions/cramping) */
  directionalFrictionScore: number;
  /** Maximum single transition difficulty spike */
  maxSingleTransitionCost: number;
}

/**
 * Calculates the physical friction of moving between two buttons on the 5-row CBA grid.
 *
 * Grounded in the biomechanical realities of the chromatic button accordion:
 * 1. Column travel (along minor-third diagonals) represents arm/hand shifts.
 * 2. Forward motion (ascending pitch / extending outward) flows with arm weight.
 * 3. Backward motion (descending pitch / contracting upward against gravity) has
 *    directional resistance ("going back is harder").
 * 4. Stepping to support rows (4 & 5) relieves wrist crowding against the bellows.
 * 5. Retreating from outer rows (4/5) back into the "devil rows" (1/2) incurs a
 *    hand collapse penalty.
 */
export function calculateCbaTransition(
  from: CbaPhysicalLocation,
  to: CbaPhysicalLocation,
  previousDeltaColumn = 0
): CbaTransition {
  const dc = to.column - from.column;
  const dr = to.row - from.row;
  const columnTravel = Math.abs(dc);
  const rowTravel = Math.abs(dr);
  const isDescending = to.midi < from.midi;

  // Devil rows (1, 2, 3) vs. Support rows (4, 5)
  const isSupportRowRelief = !from.isSupportRow && to.isSupportRow;
  const isRetreatToDevilRows = from.isSupportRow && !to.isSupportRow && to.row <= 2;

  // Base physical distance
  let frictionCost = 2.5 * columnTravel + 1.2 * rowTravel;

  // Devil row inner-edge crowding penalty: Row 1 is crowded against the palm/keyboard edge
  if (to.row === 1) {
    frictionCost += 0.8;
  }

  // Directional Friction: descending motion requires pulling the forearm upward
  // and tucking fingers inward under the hand
  if (isDescending && columnTravel > 0) {
    frictionCost += 1.8 * columnTravel;
  }

  // Directional reversal friction (snapping back and forth along the column axis)
  if (previousDeltaColumn !== 0 && Math.sign(dc) !== 0 && Math.sign(dc) !== Math.sign(previousDeltaColumn)) {
    frictionCost += 2.2;
  }

  // Support row relief bonus: opening the hand to rows 4/5 reduces tension
  if (isSupportRowRelief) {
    frictionCost = Math.max(0, frictionCost - 0.8);
  }

  // Retreat penalty: collapsing from support row back down to inner devil row
  if (isRetreatToDevilRows && columnTravel > 1) {
    frictionCost += 2.5;
  }

  return {
    from,
    to,
    columnTravel,
    rowTravel,
    isDescending,
    isRetreatToDevilRows,
    isSupportRowRelief,
    frictionCost,
  };
}

/**
 * Finds the most ergonomic physical button path for a melody on the 5-row CBA grid
 * using dynamic programming (Viterbi path search).
 *
 * For each note, evaluates all available buttons (including duplicate support rows)
 * to find the path that minimizes hand strain, respects the Row 3 pivot axis,
 * and avoids directional friction bottlenecks.
 */
export function findOptimalCbaPath(
  midiNotes: readonly number[],
  layout: CbaKeyboardLayout = DEFAULT_CBA_LAYOUT
): CbaErgonomicAnalysis {
  if (midiNotes.length === 0) {
    return {
      steps: [],
      totalCost: 0,
      averageFrictionPerNote: 0,
      row3PivotCount: 0,
      row3BottleneckRatio: 0,
      devilRowRatio: 0,
      supportRowUtilization: 0,
      directionalFrictionScore: 0,
      maxSingleTransitionCost: 0,
    };
  }

  // 1. Get candidate button locations for each note
  const candidatesPerStep: CbaPhysicalLocation[][] = midiNotes.map((midi) => {
    const locs = getCbaLocationsForMidi(midi, layout);
    if (locs.length > 0) return locs;
    // Fallback if note is slightly outside standard profile
    return [
      {
        row: 1,
        column: 5,
        midi,
        pitchClass: ((midi % 12) + 12) % 12,
        isSupportRow: false,
        isMiddleRow: false,
      },
    ];
  });

  interface DpNode {
    location: CbaPhysicalLocation;
    cumulativeCost: number;
    parentIndex?: number;
    transition?: CbaTransition;
    lastDeltaCol: number;
  }

  // Initialize step 0: prefer center rows (2, 3, 4) as natural neutral hand resting position
  let previousLayer: DpNode[] = candidatesPerStep[0]!.map((loc) => ({
    location: loc,
    cumulativeCost: loc.row === 1 ? 0.8 : loc.row === 5 ? 0.4 : 0.0,
    lastDeltaCol: 0,
  }));

  const backpointers: { parentIndex: number; transition: CbaTransition }[][] = [];

  // Viterbi forward pass
  for (let step = 1; step < candidatesPerStep.length; step++) {
    const currentCandidates = candidatesPerStep[step]!;
    const currentLayer: DpNode[] = [];
    const stepBackpointers: { parentIndex: number; transition: CbaTransition }[] = [];

    for (const cand of currentCandidates) {
      let bestCost = Infinity;
      let bestParentIdx = 0;
      let bestTransition: CbaTransition | undefined;

      for (let pIdx = 0; pIdx < previousLayer.length; pIdx++) {
        const prev = previousLayer[pIdx]!;
        const trans = calculateCbaTransition(prev.location, cand, prev.lastDeltaCol);
        const cost = prev.cumulativeCost + trans.frictionCost;

        if (cost < bestCost) {
          bestCost = cost;
          bestParentIdx = pIdx;
          bestTransition = trans;
        }
      }

      currentLayer.push({
        location: cand,
        cumulativeCost: bestCost,
        parentIndex: bestParentIdx,
        transition: bestTransition,
        lastDeltaCol: cand.column - previousLayer[bestParentIdx]!.location.column,
      });

      stepBackpointers.push({
        parentIndex: bestParentIdx,
        transition: bestTransition!,
      });
    }

    backpointers.push(stepBackpointers);
    previousLayer = currentLayer;
  }

  // Backtrack to find the optimal path
  let bestEndIdx = 0;
  let lowestCost = Infinity;
  for (let i = 0; i < previousLayer.length; i++) {
    if (previousLayer[i]!.cumulativeCost < lowestCost) {
      lowestCost = previousLayer[i]!.cumulativeCost;
      bestEndIdx = i;
    }
  }

  const chosenLocations: CbaPhysicalLocation[] = new Array(midiNotes.length);
  const transitions: (CbaTransition | undefined)[] = new Array(midiNotes.length);

  let currentIdx = bestEndIdx;
  chosenLocations[midiNotes.length - 1] = candidatesPerStep[midiNotes.length - 1]![currentIdx]!;

  for (let step = midiNotes.length - 1; step >= 1; step--) {
    const bp = backpointers[step - 1]![currentIdx]!;
    transitions[step] = bp.transition;
    currentIdx = bp.parentIndex;
    chosenLocations[step - 1] = candidatesPerStep[step - 1]![currentIdx]!;
  }

  // Compute ergonomic summary metrics
  const steps: CbaPathStep[] = chosenLocations.map((loc, idx) => ({
    index: idx,
    midi: midiNotes[idx]!,
    location: loc,
    transitionFromPrevious: transitions[idx],
  }));

  const row3Count = chosenLocations.filter((l) => l.isMiddleRow).length;
  const supportCount = chosenLocations.filter((l) => l.isSupportRow).length;
  const devilCount = chosenLocations.filter((l) => !l.isSupportRow).length;

  const validTransitions = transitions.filter((t): t is CbaTransition => t !== undefined);
  const directionalCost = validTransitions
    .filter((t) => t.isDescending)
    .reduce((sum, t) => sum + (t.frictionCost - (2.5 * t.columnTravel + 1.2 * t.rowTravel)), 0);

  const maxTransition = validTransitions.length
    ? Math.max(...validTransitions.map((t) => t.frictionCost))
    : 0;

  return {
    steps,
    totalCost: lowestCost,
    averageFrictionPerNote: midiNotes.length > 0 ? lowestCost / midiNotes.length : 0,
    row3PivotCount: row3Count,
    row3BottleneckRatio: midiNotes.length > 0 ? row3Count / midiNotes.length : 0,
    devilRowRatio: midiNotes.length > 0 ? devilCount / midiNotes.length : 0,
    supportRowUtilization: midiNotes.length > 0 ? supportCount / midiNotes.length : 0,
    directionalFrictionScore: directionalCost,
    maxSingleTransitionCost: maxTransition,
  };
}

export interface CbaChallengeProfile {
  supportRowDemand: number;
  directionalFrictionDemand: number;
  row3PivotDemand: number;
  averageFriction: number;
  peakTransitionFriction: number;
}

/**
 * Evaluates the deliberate technical challenges present in a melody:
 * - Support Row Demand: forces or rewards leaving the devil rows (1-3)
 * - Directional Friction Demand: tests backward/descending arm contraction against gravity
 * - Row 3 Pivot Demand: exercises middle-row bottleneck navigation
 */
export function evaluateCbaMelodicChallenge(
  midiNotes: readonly number[],
  layout: CbaKeyboardLayout = DEFAULT_CBA_LAYOUT
): CbaChallengeProfile {
  const analysis = findOptimalCbaPath(midiNotes, layout);
  const n = Math.max(1, midiNotes.length);

  return {
    supportRowDemand: Math.min(1, analysis.supportRowUtilization * 2.5),
    directionalFrictionDemand: Math.min(1, analysis.directionalFrictionScore / (n * 1.5)),
    row3PivotDemand: Math.min(1, analysis.row3PivotCount / (n * 0.4)),
    averageFriction: analysis.averageFrictionPerNote,
    peakTransitionFriction: analysis.maxSingleTransitionCost,
  };
}

