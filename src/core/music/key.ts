import { Note, Scale } from "tonal";
import type { ChordQuality, Mode, Pitch, ScaleDegree, ScaleDegreeNumber, TonalContext } from "../model";

export const keyName = (context: TonalContext) => `${context.tonic} ${context.mode}`;
export const scaleNotes = (context: TonalContext) => Scale.get(keyName(context)).notes;
export const harmonicRootDegree = (mode: Mode, degree: ScaleDegreeNumber, quality: ChordQuality): ScaleDegree => ({
  degree,
  alteration: mode === "minor" && degree === 7 && quality === "diminished" ? 1 : 0,
  octaveOffset: 0,
});
export const alterationInterval = (alt: number): string => {
  if (alt === 1) return "1A";
  if (alt === 2) return "1AA";
  if (alt === -1) return "1d";
  if (alt === -2) return "1dd";
  return "1P";
};
export const realizeScaleDegree = (context: TonalContext, degree: ScaleDegree, baseOctave = 4): Pitch => {
  const scale = scaleNotes(context);
  if (scale.length !== 7) throw new Error(`Unsupported key ${keyName(context)}`);
  const zero = degree.degree - 1;
  const octave = baseOctave + degree.octaveOffset + Math.floor(zero / 7);
  let note = `${scale[((zero % 7) + 7) % 7]}${octave}`;
  if (degree.alteration) note = Note.transpose(note, alterationInterval(degree.alteration));
  const midi = Note.midi(note);
  if (midi === null) throw new Error(`Invalid pitch ${note}`);
  return { name: note, midi };
};
export const qualityForDegree = (mode: TonalContext["mode"], degree: number, seventh = false): ChordQuality => {
  if (seventh && degree === 5) return "dominant7";
  // Minor-key common-practice harmony uses a raised leading tone in V and vii°.
  if (mode === "minor" && degree === 5) return "major";
  const major = mode === "major" ? [1, 4, 5] : [3, 6];
  const diminished = mode === "major" ? 7 : mode === "minor" && degree === 7 ? 7 : 2;
  return degree === diminished ? "diminished" : major.includes(degree) ? "major" : "minor";
};
