import type { HarmonyEvent, Pitch, TonalContext } from "../model";
import { realizeScaleDegree } from "./key";
import { pitchFromMidi } from "./pitch";
export const chordPitches = (context: TonalContext, harmony: HarmonyEvent, octave = 3): Pitch[] => {
  const root = realizeScaleDegree(context, harmony.rootDegree, octave);
  const intervals = harmony.quality === "dominant7" ? [0, 4, 7, 10] : harmony.quality === "major" ? [0, 4, 7] : harmony.quality === "minor" ? [0, 3, 7] : [0, 3, 6];
  return intervals.map((interval) => pitchFromMidi(root.midi + interval, context.tonic.includes("b")));
};
