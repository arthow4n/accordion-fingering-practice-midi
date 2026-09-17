import type { ExerciseEvent, Pitch, PitchRange } from "../model";
export interface InstrumentProfile {
  id: string; rightHandRange: PitchRange; leftHandRange: PitchRange;
  rightHandMovementCost(from: Pitch, to: Pitch): number;
  leftHandMovementCost(from: ExerciseEvent, to: ExerciseEvent): number;
  canPlayRightHandChord(pitches: readonly Pitch[]): boolean;
  canPlayBass(event: ExerciseEvent): boolean;
}
