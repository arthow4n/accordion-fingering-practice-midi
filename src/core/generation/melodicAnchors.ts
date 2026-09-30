import type { HarmonyEvent, Meter, Pitch, PitchRange, ScaleDegree, TonalContext } from "../model";
import type { Rng } from "../random/rng";
import { findChordTonesInRange } from "../patterns/melodicPatterns";
import { pitchFromMidi } from "../music/pitch";
import type { PhraseContourPoint } from "./phraseGrammar";
import type { CadencePlan } from "./cadenceGrammar";
import { ticksPerMeasure } from "../music/meter";

export type MelodicAnchorRole =
  | "phraseStart"
  | "strongBeat"
  | "harmonyChange"
  | "climax"
  | "cadence";

export type MelodicAnchor = {
  id: string;
  onset: number;
  measure: number;
  pitch: Pitch;
  degree: ScaleDegree;
  role: MelodicAnchorRole;
  harmonyId: string;
  targetScaleDegree: number; // 1..7
};

export const planMelodicAnchors = (
  context: TonalContext,
  meter: Meter,
  harmony: HarmonyEvent[],
  contourPoints: PhraseContourPoint[],
  range: PitchRange,
  cadencePlan: CadencePlan,
  rng: Rng
): MelodicAnchor[] => {
  const anchors: MelodicAnchor[] = [];
  const measureTicks = ticksPerMeasure(meter);
  const totalMeasures = contourPoints.length;
  let previousPitch: Pitch | undefined;

  const fallbackTone = {
    pitch: pitchFromMidi(range.low, context.tonic.includes("b")),
    degree: { degree: 1 as const, alteration: 0 as const, octaveOffset: 0 },
    role: "chord tone" as const,
    chromatic: false,
  };

  for (let m = 0; m < totalMeasures; m++) {
    const isCadence = m === totalMeasures - 1;
    const contour = contourPoints[m]!;
    const measureOnset = m * measureTicks;
    const activeHarmonies = harmony.filter(
      (h) => h.onset < measureOnset + measureTicks && h.onset + h.duration > measureOnset
    );

    const harmoniesToProcess = activeHarmonies.length ? activeHarmonies : [harmony[0]!];

    for (let hIdx = 0; hIdx < harmoniesToProcess.length; hIdx++) {
      const h = harmoniesToProcess[hIdx]!;
      const anchorOnset = Math.max(measureOnset, h.onset);
      const isStart = m === 0 && hIdx === 0;
      const isFinal = isCadence && hIdx === harmoniesToProcess.length - 1;
      const isClimaxMeasure = contour.phase === "peak" || contour.tension >= 0.85;

      const rawChordTones = findChordTonesInRange(context, h, range);
      const chordTones = rawChordTones.length ? rawChordTones : [fallbackTone];

      let chosenTone = chordTones[0]!;
      let anchorRole: MelodicAnchorRole = "strongBeat";

      if (isFinal) {
        anchorRole = "cadence";
        const matchingDegrees = chordTones.filter(
          (ct) => ct.degree.degree === cadencePlan.arrivalDegree
        );
        const candidates = matchingDegrees.length ? matchingDegrees : chordTones;

        const targetMidi = range.low + contour.registerTarget * Math.max(1, range.high - range.low);
        chosenTone = candidates.reduce((prev, curr) =>
          Math.abs(curr.pitch.midi - targetMidi) < Math.abs(prev.pitch.midi - targetMidi) ? curr : prev
        );
      } else if (isStart) {
        anchorRole = "phraseStart";
        const preferredDegrees = [1, 3, 5];
        const triadTones = chordTones.filter((ct) => preferredDegrees.includes(ct.degree.degree));
        const pool = triadTones.length ? triadTones : chordTones;

        const targetMidi = range.low + contour.registerTarget * Math.max(1, range.high - range.low);
        chosenTone = pool.reduce((prev, curr) =>
          Math.abs(curr.pitch.midi - targetMidi) < Math.abs(prev.pitch.midi - targetMidi) ? curr : prev
        );
      } else if (isClimaxMeasure && rng.next() < 0.8) {
        anchorRole = "climax";
        const sortedDesc = [...chordTones].sort((a, b) => b.pitch.midi - a.pitch.midi);
        chosenTone = sortedDesc[0]!;
      } else {
        anchorRole = hIdx > 0 ? "harmonyChange" : "strongBeat";
        const targetMidi = range.low + contour.registerTarget * Math.max(1, range.high - range.low);

        const scored = chordTones.map((ct) => {
          const contourDist = Math.abs(ct.pitch.midi - targetMidi);
          const voiceDist = previousPitch ? Math.abs(ct.pitch.midi - previousPitch.midi) : 0;
          const penalty = voiceDist > 9 ? 15 : voiceDist > 5 ? 5 : 0;
          return { tone: ct, score: contourDist + voiceDist * 0.5 + penalty };
        });
        scored.sort((a, b) => a.score - b.score);
        chosenTone = scored[0]!.tone;
      }

      previousPitch = chosenTone.pitch;
      anchors.push({
        id: `anchor-${m}-${hIdx}`,
        onset: anchorOnset,
        measure: m,
        pitch: chosenTone.pitch,
        degree: chosenTone.degree,
        role: anchorRole,
        harmonyId: h.id,
        targetScaleDegree: chosenTone.degree.degree,
      });
    }
  }

  return anchors;
};
