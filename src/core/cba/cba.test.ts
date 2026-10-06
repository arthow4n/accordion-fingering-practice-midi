import { describe, expect, it } from "vitest";
import {
  getCbaLocationsForMidi,
  getCbaMidiAt,
  getCbaTotalButtonCount,
  ROLAND_FR1XB_C_GRIFF,
} from "./cbaLayout";
import { calculateCbaTransition, findOptimalCbaPath } from "./cbaErgonomics";

describe("CBA Keyboard Layout Specification", () => {
  it("matches Roland FR-1XB European C-Griff physical specs", () => {
    expect(ROLAND_FR1XB_C_GRIFF.rows.length).toBe(5);
    expect(getCbaTotalButtonCount(ROLAND_FR1XB_C_GRIFF)).toBe(62);
    expect(ROLAND_FR1XB_C_GRIFF.playableMidi.lowest).toBe(54); // F#3
    expect(ROLAND_FR1XB_C_GRIFF.playableMidi.highest).toBe(91); // G6
  });

  it("places C4 at the verified reference buttons (Row 1 Col 5 and Row 4 Col 5)", () => {
    // Sounding MIDI 60 (C4)
    expect(getCbaMidiAt(1, 5)).toBe(60);
    expect(getCbaMidiAt(4, 5)).toBe(60);

    const c4Locs = getCbaLocationsForMidi(60);
    expect(c4Locs.length).toBe(2);
    expect(c4Locs.map((l) => l.row)).toEqual([1, 4]);
    expect(c4Locs.every((l) => l.column === 5)).toBe(true);
  });

  it("preserves the Row 3 Monopoly: notes on Row 3 have NO duplicate", () => {
    // Pitch class 2 = D (e.g. D4 = MIDI 62)
    // In C-system: Row 3 offset is 2 -> D is on Row 3
    const d4Locs = getCbaLocationsForMidi(62);
    expect(d4Locs.length).toBe(1);
    expect(d4Locs[0]!.row).toBe(3);
    expect(d4Locs[0]!.isMiddleRow).toBe(true);
    expect(d4Locs[0]!.isSupportRow).toBe(false);

    // Pitch class 5 = F (e.g. F4 = MIDI 65)
    const f4Locs = getCbaLocationsForMidi(65);
    expect(f4Locs.length).toBe(1);
    expect(f4Locs[0]!.row).toBe(3);
  });

  it("provides duplicates on rows 4 and 5 for notes on rows 1 and 2", () => {
    // Pitch class 1 = C# (e.g. C#4 = MIDI 61), on Row 2 and Row 5
    const cs4Locs = getCbaLocationsForMidi(61);
    expect(cs4Locs.length).toBe(2);
    expect(cs4Locs.map((l) => l.row)).toEqual([2, 5]);

    // Pitch class 0 = C (MIDI 60), on Row 1 and Row 4
    const c4Locs = getCbaLocationsForMidi(60);
    expect(c4Locs.length).toBe(2);
    expect(c4Locs.map((l) => l.row)).toEqual([1, 4]);
  });

  it("advances by +3 semitones (minor thirds) per column", () => {
    // Row 1 Col 5 = C4 (60)
    // Row 1 Col 6 = Eb4 (63)
    // Row 1 Col 7 = F#4 (66)
    // Row 1 Col 8 = A4 (69)
    // Row 1 Col 9 = C5 (72)
    expect(getCbaMidiAt(1, 6)).toBe(63);
    expect(getCbaMidiAt(1, 7)).toBe(66);
    expect(getCbaMidiAt(1, 8)).toBe(69);
    expect(getCbaMidiAt(1, 9)).toBe(72);
  });
});

describe("CBA Ergonomics and Friction Analysis", () => {
  it("imposes higher friction on descending movements (directional resistance)", () => {
    const locC4 = getCbaLocationsForMidi(60).find((l) => l.row === 1)!;
    const locG4 = getCbaLocationsForMidi(67).find((l) => l.row === 2)!;

    // Ascending from C4 to G4
    const forwardTrans = calculateCbaTransition(locC4, locG4);
    // Descending from G4 to C4
    const backwardTrans = calculateCbaTransition(locG4, locC4);

    expect(backwardTrans.isDescending).toBe(true);
    expect(forwardTrans.isDescending).toBe(false);
    expect(backwardTrans.frictionCost).toBeGreaterThan(forwardTrans.frictionCost);
  });

  it("solves an optimal physical path for an ascending C major scale", () => {
    const cMajorScale = [60, 62, 64, 65, 67, 69, 71, 72]; // C4 to C5
    const analysis = findOptimalCbaPath(cMajorScale);

    expect(analysis.steps.length).toBe(cMajorScale.length);
    expect(analysis.totalCost).toBeGreaterThan(0);
    expect(Number.isFinite(analysis.totalCost)).toBe(true);

    // Row 3 notes (D4=62, F4=65, B4=71) must be visited on Row 3
    const row3Steps = analysis.steps.filter((s) => [62, 65, 71].includes(s.midi));
    expect(row3Steps.every((s) => s.location.row === 3)).toBe(true);
    expect(analysis.row3PivotCount).toBeGreaterThanOrEqual(3);
  });

  it("utilizes support rows (4 & 5) to relieve crowding on wide passages", () => {
    // An arpeggio reaching outward
    const arpeggio = [60, 64, 67, 72, 76, 79]; // C4, E4, G4, C5, E5, G5
    const analysis = findOptimalCbaPath(arpeggio);

    // Should utilize support rows as the hand climbs outward
    expect(analysis.supportRowUtilization).toBeGreaterThan(0);
  });

  it("detects rapid back-and-forth reversals as higher friction", () => {
    const smoothAscending = [60, 62, 64, 67, 72];
    const jaggedZigzag = [60, 72, 62, 71, 64];

    const smoothAnalysis = findOptimalCbaPath(smoothAscending);
    const jaggedAnalysis = findOptimalCbaPath(jaggedZigzag);

    expect(jaggedAnalysis.averageFrictionPerNote).toBeGreaterThan(
      smoothAnalysis.averageFrictionPerNote
    );
  });
});
