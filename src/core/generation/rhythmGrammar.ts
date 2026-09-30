import type { Meter, PhraseRole, Tick } from "../model";
import type { Rng } from "../random/rng";
import type { TrainingRequest } from "../training/trainingIntent";
import { ticksPerMeasure } from "../music/meter";

export type RhythmAtom = {
  duration: Tick;
  rest?: boolean;
  tie?: boolean;
  syncopated?: boolean;
};

export type RhythmCell = {
  id: string;
  duration: Tick;
  atoms: RhythmAtom[];
  complexity: number;
  syncopated?: boolean;
};

// 1-beat cells (480 ticks in /4 meters)
const ONE_BEAT_CELLS: RhythmCell[] = [
  { id: "quarter", duration: 480, atoms: [{ duration: 480 }], complexity: 0.05 },
  { id: "twoEighths", duration: 480, atoms: [{ duration: 240 }, { duration: 240 }], complexity: 0.15 },
  { id: "fourSixteenths", duration: 480, atoms: [{ duration: 120 }, { duration: 120 }, { duration: 120 }, { duration: 120 }], complexity: 0.5 },
  { id: "eighthTwoSixteenths", duration: 480, atoms: [{ duration: 240 }, { duration: 120 }, { duration: 120 }], complexity: 0.35 },
  { id: "twoSixteenthsEighth", duration: 480, atoms: [{ duration: 120 }, { duration: 120 }, { duration: 240 }], complexity: 0.35 },
  { id: "dottedEighthSixteenth", duration: 480, atoms: [{ duration: 360 }, { duration: 120 }], complexity: 0.4 },
  { id: "restAttack", duration: 480, atoms: [{ duration: 240, rest: true }, { duration: 240 }], complexity: 0.3 },
];

// 2-beat cells (960 ticks in /4 meters)
const TWO_BEAT_CELLS: RhythmCell[] = [
  { id: "half", duration: 960, atoms: [{ duration: 960 }], complexity: 0.02 },
  { id: "dottedQuarterEighth", duration: 960, atoms: [{ duration: 720 }, { duration: 240 }], complexity: 0.25 },
  { id: "syncopatedQuarter", duration: 960, atoms: [{ duration: 240 }, { duration: 480 }, { duration: 240 }], complexity: 0.6, syncopated: true },
  { id: "quarterTwoEighths", duration: 960, atoms: [{ duration: 480 }, { duration: 240 }, { duration: 240 }], complexity: 0.2 },
  { id: "twoEighthsQuarter", duration: 960, atoms: [{ duration: 240 }, { duration: 240 }, { duration: 480 }], complexity: 0.2 },
];

// 6/8 dotted-quarter beat cells (720 ticks)
const SIX_EIGHT_BEAT_CELLS: RhythmCell[] = [
  { id: "dottedQuarter", duration: 720, atoms: [{ duration: 720 }], complexity: 0.05 },
  { id: "threeEighths", duration: 720, atoms: [{ duration: 240 }, { duration: 240 }, { duration: 240 }], complexity: 0.2 },
  { id: "quarterEighth", duration: 720, atoms: [{ duration: 480 }, { duration: 240 }], complexity: 0.25 },
  { id: "eighthQuarter", duration: 720, atoms: [{ duration: 240 }, { duration: 480 }], complexity: 0.35, syncopated: true },
  { id: "dottedEighthSixteenthEighth", duration: 720, atoms: [{ duration: 360 }, { duration: 120 }, { duration: 240 }], complexity: 0.45 },
];

export const generateMeasureRhythm = (
  meter: Meter,
  role: PhraseRole,
  request: TrainingRequest,
  rng: Rng
): { atoms: RhythmAtom[]; rhythmCellId: string } => {
  const measureTicks = ticksPerMeasure(meter);
  const minDuration = request.rhythm.smallestSubdivision === "quarter"
    ? 480
    : request.rhythm.smallestSubdivision === "eighth"
      ? 240
      : 120;

  // Steady rhythm style check
  if (request.rhythm.style === "steady") {
    const fixedDur = request.rhythm.noteValue === "half" ? 960 : request.rhythm.noteValue === "quarter" ? 480 : request.rhythm.noteValue === "eighth" ? 240 : 120;
    if (measureTicks % fixedDur === 0) {
      const count = measureTicks / fixedDur;
      return {
        atoms: Array.from({ length: count }, () => ({ duration: fixedDur })),
        rhythmCellId: `steady-${request.rhythm.noteValue}`,
      };
    }
  }

  // Cadence role: favors longer final values or clear arrival rhythm
  if (role === "cadence") {
    if (meter.beats === 4 && meter.beatUnit === 4) {
      const cadenceOptions: RhythmAtom[][] = [
        // Two quarters + half
        [{ duration: 480 }, { duration: 480 }, { duration: 960 }],
        // Four eighths + half
        [{ duration: 240 }, { duration: 240 }, { duration: 240 }, { duration: 240 }, { duration: 960 }],
        // Half + half
        [{ duration: 960 }, { duration: 960 }],
        // Whole note
        [{ duration: 1920 }],
        // Dotted half + quarter
        [{ duration: 1440 }, { duration: 480 }],
      ];
      const valid = cadenceOptions.filter((opt) => opt.every((a) => a.duration >= minDuration));
      const atoms = valid.length ? rng.pick(valid) : cadenceOptions[0]!;
      return { atoms, rhythmCellId: "cadence-measure-4" };
    } else if (meter.beats === 3 && meter.beatUnit === 4) {
      const cadenceOptions: RhythmAtom[][] = [
        [{ duration: 480 }, { duration: 960 }],
        [{ duration: 240 }, { duration: 240 }, { duration: 960 }],
        [{ duration: 1440 }],
      ];
      const valid = cadenceOptions.filter((opt) => opt.every((a) => a.duration >= minDuration));
      const atoms = valid.length ? rng.pick(valid) : cadenceOptions[0]!;
      return { atoms, rhythmCellId: "cadence-measure-3" };
    } else if (meter.beats === 6 && meter.beatUnit === 8) {
      return {
        atoms: [{ duration: 720 }, { duration: 720 }],
        rhythmCellId: "cadence-measure-6-8",
      };
    }
  }

  // 6/8 meter generation
  if (meter.beats === 6 && meter.beatUnit === 8) {
    const validCells = SIX_EIGHT_BEAT_CELLS.filter((cell) =>
      cell.atoms.every((a) => a.duration >= minDuration) &&
      (!cell.syncopated || request.rhythm.syncopation >= 0.3)
    );
    const pool = validCells.length ? validCells : SIX_EIGHT_BEAT_CELLS.slice(0, 2);
    const b1 = rng.pick(pool);
    const b2 = rng.pick(pool);
    return {
      atoms: [...b1.atoms, ...b2.atoms],
      rhythmCellId: `${b1.id}+${b2.id}`,
    };
  }

  // 4/4 meter generation: compose from 1-beat and 2-beat cells
  if (meter.beats === 4 && meter.beatUnit === 4) {
    const valid1 = ONE_BEAT_CELLS.filter((cell) =>
      cell.atoms.every((a) => a.duration >= minDuration) &&
      (!cell.atoms.some((a) => a.rest) || (request.rhythm.restDensity ?? 0.05) > 0.1)
    );
    const valid2 = TWO_BEAT_CELLS.filter((cell) =>
      cell.atoms.every((a) => a.duration >= minDuration) &&
      (!cell.syncopated || request.rhythm.syncopation >= 0.35)
    );

    const pool1 = valid1.length ? valid1 : ONE_BEAT_CELLS.slice(0, 2);
    const pool2 = valid2.length ? valid2 : TWO_BEAT_CELLS.slice(0, 1);

    // Context-sensitive structure based on phrase role:
    if (role === "opening" && request.rhythm.noteDensity < 0.6) {
      // Moderate/stable: e.g. 2-beat half + two quarters
      const cell2 = rng.pick(pool2);
      const c1 = rng.pick(pool1);
      const c2 = rng.pick(pool1);
      const atoms = rng.next() < 0.5 ? [...cell2.atoms, ...c1.atoms, ...c2.atoms] : [...c1.atoms, ...c2.atoms, ...cell2.atoms];
      return { atoms, rhythmCellId: `open-${cell2.id}+2x1` };
    }

    if (role === "continuation" || role === "climax") {
      // Higher density: 4 single-beat cells
      const c1 = rng.pick(pool1);
      const c2 = rng.pick(pool1);
      const c3 = rng.pick(pool1);
      const c4 = rng.pick(pool1);
      return {
        atoms: [...c1.atoms, ...c2.atoms, ...c3.atoms, ...c4.atoms],
        rhythmCellId: `${c1.id}+${c2.id}+${c3.id}+${c4.id}`,
      };
    }

    // Default 4/4 composition: mix of 2-beat and 1-beat cells
    const roll = rng.next();
    if (roll < 0.4) {
      const c1 = rng.pick(pool2);
      const c2 = rng.pick(pool2);
      return { atoms: [...c1.atoms, ...c2.atoms], rhythmCellId: `${c1.id}+${c2.id}` };
    } else if (roll < 0.7) {
      const c1 = rng.pick(pool2);
      const b1 = rng.pick(pool1);
      const b2 = rng.pick(pool1);
      return { atoms: [...c1.atoms, ...b1.atoms, ...b2.atoms], rhythmCellId: `${c1.id}+${b1.id}+${b2.id}` };
    } else {
      const b1 = rng.pick(pool1);
      const b2 = rng.pick(pool1);
      const c2 = rng.pick(pool2);
      return { atoms: [...b1.atoms, ...b2.atoms, ...c2.atoms], rhythmCellId: `${b1.id}+${b2.id}+${c2.id}` };
    }
  }

  // 3/4 meter generation
  if (meter.beats === 3 && meter.beatUnit === 4) {
    const valid1 = ONE_BEAT_CELLS.filter((cell) => cell.atoms.every((a) => a.duration >= minDuration));
    const pool1 = valid1.length ? valid1 : ONE_BEAT_CELLS.slice(0, 2);

    const roll = rng.next();
    if (roll < 0.35 && minDuration <= 480) {
      // 2-beat + 1-beat
      const cell2 = rng.pick(TWO_BEAT_CELLS.filter((c) => c.atoms.every((a) => a.duration >= minDuration)) || [{ duration: 960, atoms: [{ duration: 960 }] }]);
      const cell1 = rng.pick(pool1);
      return { atoms: [...cell2.atoms, ...cell1.atoms], rhythmCellId: `${cell2.id}+${cell1.id}` };
    } else {
      // 3 single-beat cells
      const b1 = rng.pick(pool1);
      const b2 = rng.pick(pool1);
      const b3 = rng.pick(pool1);
      return { atoms: [...b1.atoms, ...b2.atoms, ...b3.atoms], rhythmCellId: `${b1.id}+${b2.id}+${b3.id}` };
    }
  }

  // Fallback
  return {
    atoms: [{ duration: measureTicks }],
    rhythmCellId: "fallback-whole",
  };
};
