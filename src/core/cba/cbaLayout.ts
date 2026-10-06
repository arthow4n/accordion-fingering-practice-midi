/**
 * Chromatic Button Accordion (CBA) Keyboard Layout Specification
 *
 * Grounded in the European C-Griff (C-System) 5-row geometry, matching the
 * physical Roland FR-1XB specifications.
 *
 * Physical Row Layout (Interval Structure):
 * - Horizontal Step (Δcol = +1 on same row): +3 semitones (Minor 3rd)
 * - Up-Inward Diagonal Step (Δrow = +1 on same col): +1 semitone (Minor 2nd)
 *
 * Row 1 (Outer edge / closest to fingertips): Pitch classes [0, 3, 6, 9] (C, Eb, F#, A)
 * Row 2 (Middle of primary 3 rows):           Pitch classes [1, 4, 7, 10] (C#, E, G, Bb)
 * Row 3 (Unique center / bellows-side core):  Pitch classes [2, 5, 8, 11] (D, F, Ab, B)
 * Row 4 (Support / Auxiliary Row 1):          Duplicate of Row 1 [0, 3, 6, 9]
 * Row 5 (Support / Auxiliary Row 2):          Duplicate of Row 2 [1, 4, 7, 10]
 *
 * Crucial Structural Fact:
 * Row 3 has NO duplicate row. Notes in Row 3 only exist in that single center column,
 * acting as physical pivot points and bottlenecks on the instrument.
 */

export type CbaPhysicalRow = 1 | 2 | 3 | 4 | 5;

export interface CbaRowBounds {
  row: CbaPhysicalRow;
  minColumn: number;
  maxColumn: number;
}

export interface CbaPhysicalLocation {
  row: CbaPhysicalRow;
  column: number;
  midi: number;
  pitchClass: number; // 0..11, where 0 = C
  isSupportRow: boolean; // true for rows 4 & 5
  isMiddleRow: boolean; // true for row 3 (the unique row)
}

export interface CbaKeyboardLayout {
  id: string;
  displayName: string;
  trebleSystem: "c-griff-europe";
  rows: readonly CbaRowBounds[];
  reference: {
    row: CbaPhysicalRow;
    column: number;
    midi: number; // 60 = C4
  };
  playableMidi: {
    lowest: number;
    highest: number;
  };
}

/** Semitone offsets for rows in the C-system layout */
export const CBA_ROW_SEMITONE_OFFSETS: Record<CbaPhysicalRow, 0 | 1 | 2> = {
  1: 0,
  2: 1,
  3: 2,
  4: 0, // duplicates row 1
  5: 1, // duplicates row 2
};

/**
 * Roland FR-1XB European C-Griff 5-row factory profile.
 * Contains 62 physical buttons:
 * Row 1: 12 buttons (cols 4..15)
 * Row 2: 13 buttons (cols 3..15)
 * Row 3: 12 buttons (cols 3..14)
 * Row 4: 13 buttons (cols 3..15)
 * Row 5: 12 buttons (cols 3..14)
 * Playable range: MIDI 54 (F#3) to MIDI 91 (G6).
 */
export const ROLAND_FR1XB_C_GRIFF: CbaKeyboardLayout = {
  id: "roland-fr1xb-c-griff-europe",
  displayName: "Roland FR-1XB · C-Griff Europe",
  trebleSystem: "c-griff-europe",
  rows: [
    { row: 1, minColumn: 4, maxColumn: 15 },
    { row: 2, minColumn: 3, maxColumn: 15 },
    { row: 3, minColumn: 3, maxColumn: 14 },
    { row: 4, minColumn: 3, maxColumn: 15 },
    { row: 5, minColumn: 3, maxColumn: 14 },
  ],
  reference: {
    row: 1,
    column: 5,
    midi: 60, // C4
  },
  playableMidi: {
    lowest: 54, // F#3
    highest: 91, // G6
  },
};

export const DEFAULT_CBA_LAYOUT = ROLAND_FR1XB_C_GRIFF;

/**
 * Returns the sounding MIDI note at the specified button coordinate.
 */
export function getCbaMidiAt(
  row: CbaPhysicalRow,
  column: number,
  layout: CbaKeyboardLayout = DEFAULT_CBA_LAYOUT
): number | undefined {
  const rowBounds = layout.rows.find((r) => r.row === row);
  if (!rowBounds || column < rowBounds.minColumn || column > rowBounds.maxColumn) {
    return undefined;
  }
  return getCbaMidiAtUnchecked(row, column, layout);
}

export function getCbaMidiAtUnchecked(
  row: CbaPhysicalRow,
  column: number,
  layout: CbaKeyboardLayout = DEFAULT_CBA_LAYOUT
): number {
  const refOffset = CBA_ROW_SEMITONE_OFFSETS[layout.reference.row];
  const rowOffset = CBA_ROW_SEMITONE_OFFSETS[row];
  return (
    layout.reference.midi +
    3 * (column - layout.reference.column) +
    rowOffset -
    refOffset
  );
}

/**
 * Returns all physical button locations on the keyboard that sound the given MIDI note.
 * For Row 3 notes, returns exactly 1 location per octave.
 * For Rows 1 and 2 notes, returns 2 locations (the primary row and its duplicate on Row 4 or 5).
 */
export function getCbaLocationsForMidi(
  midi: number,
  layout: CbaKeyboardLayout = DEFAULT_CBA_LAYOUT
): CbaPhysicalLocation[] {
  if (midi < layout.playableMidi.lowest || midi > layout.playableMidi.highest) {
    return [];
  }

  const results: CbaPhysicalLocation[] = [];
  for (const bounds of layout.rows) {
    for (let col = bounds.minColumn; col <= bounds.maxColumn; col++) {
      if (getCbaMidiAtUnchecked(bounds.row, col, layout) === midi) {
        results.push({
          row: bounds.row,
          column: col,
          midi,
          pitchClass: ((midi % 12) + 12) % 12,
          isSupportRow: bounds.row === 4 || bounds.row === 5,
          isMiddleRow: bounds.row === 3,
        });
      }
    }
  }

  // Stable sort: primary rows (1-3) first, then support rows (4-5)
  return results.sort((a, b) => a.row - b.row || a.column - b.column);
}

/**
 * Total physical button count on the layout.
 */
export function getCbaTotalButtonCount(layout: CbaKeyboardLayout = DEFAULT_CBA_LAYOUT): number {
  return layout.rows.reduce((sum, r) => sum + (r.maxColumn - r.minColumn + 1), 0);
}
