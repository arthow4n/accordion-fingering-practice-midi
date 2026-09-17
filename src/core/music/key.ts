import { Note, Scale } from "tonal";
import type { ChordQuality, Pitch, ScaleDegree, TonalContext } from "../model";
import { pitchFromName } from "./pitch";

export const keyName = (context: TonalContext) => `${context.tonic} ${context.mode}`;
export const scaleNotes = (context: TonalContext) => Scale.get(keyName(context)).notes;
export const realizeScaleDegree = (context: TonalContext, degree: ScaleDegree, baseOctave = 4): Pitch => {
  const scale = scaleNotes(context);
  if (scale.length !== 7) throw new Error(`Unsupported key ${keyName(context)}`);
  const zero = degree.degree - 1;
  const octave = baseOctave + degree.octaveOffset + Math.floor(zero / 7);
  let note = `${scale[((zero % 7) + 7) % 7]}${octave}`;
  if (degree.alteration) note = Note.transpose(note, degree.alteration > 0 ? `${degree.alteration}A` : `${Math.abs(degree.alteration)}d`);
  return pitchFromName(note);
};
export const qualityForDegree = (mode: TonalContext["mode"], degree: number, seventh = false): ChordQuality => {
  if (seventh && degree === 5) return "dominant7";
  const major = mode === "major" ? [1, 4, 5] : [3, 6, 7];
  const diminished = mode === "major" ? 7 : 2;
  return degree === diminished ? "diminished" : major.includes(degree) ? "major" : "minor";
};
