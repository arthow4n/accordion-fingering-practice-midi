import { Note } from "tonal";
import type { Pitch } from "../model";

export const pitchFromName = (name: string): Pitch => {
  const midi = Note.midi(name);
  if (midi === null) throw new Error(`Invalid pitch ${name}`);
  return { name: Note.simplify(name), midi };
};
export const pitchFromMidi = (midi: number, preferFlats = false): Pitch => {
  const sharp=Note.fromMidiSharps(midi);
  return { midi, name: preferFlats && sharp.includes("#") ? Note.enharmonic(sharp) : sharp };
};
