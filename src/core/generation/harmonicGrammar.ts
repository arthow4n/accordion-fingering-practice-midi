import type { ChordQuality, HarmonyEvent, Meter, Mode, ScaleDegreeNumber, TonalContext } from "../model";
import type { Rng } from "../random/rng";
import { qualityForDegree } from "../music/key";
import { ticksPerMeasure } from "../music/meter";
import { PROGRESSIONS } from "../patterns/progressionTemplates";
import { legacyBassLineById } from "../patterns/accompanimentTemplates";
import type { CadencePlan } from "./cadenceGrammar";
import type { PhraseSection } from "../model";

export type FunctionalRegion = "T" | "TE" | "PD" | "D" | "R";

export type HarmonicRhythmPattern =
  | "onePerMeasure"
  | "twoPerMeasure"
  | "onePerTwoMeasures"
  | "changeOnBeat3"
  | "lateDominant";

const romanFor = (degree: number, quality: ChordQuality, seventh: boolean): string => {
  const numeral = ["", "I", "II", "III", "IV", "V", "VI", "VII"][degree]!;
  const cased = quality === "minor" ? numeral.toLowerCase() : numeral;
  return `${cased}${quality === "diminished" ? "°" : ""}${seventh ? "7" : ""}`;
};

export interface ChordRealization {
  degree: ScaleDegreeNumber;
  quality: ChordQuality;
  fn: HarmonyEvent["function"];
  symbol: string;
}

const chordsForFunction = (
  fn: FunctionalRegion,
  mode: Mode,
  allowedQualities: readonly ChordQuality[]
): ChordRealization[] => {
  const list: { degree: ScaleDegreeNumber; quality: ChordQuality; fn: HarmonyEvent["function"]; seventh?: boolean }[] = [];

  if (mode === "major") {
    switch (fn) {
      case "T":
      case "R":
        list.push({ degree: 1, quality: "major", fn: "tonic" });
        list.push({ degree: 6, quality: "minor", fn: "tonic" });
        break;
      case "TE":
        list.push({ degree: 3, quality: "minor", fn: "tonic" });
        list.push({ degree: 6, quality: "minor", fn: "tonic" });
        list.push({ degree: 4, quality: "major", fn: "predominant" });
        break;
      case "PD":
        list.push({ degree: 4, quality: "major", fn: "predominant" });
        list.push({ degree: 2, quality: "minor", fn: "predominant" });
        break;
      case "D":
        list.push({ degree: 5, quality: "major", fn: "dominant" });
        list.push({ degree: 5, quality: "dominant7", fn: "dominant", seventh: true });
        list.push({ degree: 7, quality: "diminished", fn: "dominant" });
        break;
    }
  } else {
    // minor mode
    switch (fn) {
      case "T":
      case "R":
        list.push({ degree: 1, quality: "minor", fn: "tonic" });
        list.push({ degree: 6, quality: "major", fn: "tonic" });
        break;
      case "TE":
        list.push({ degree: 3, quality: "major", fn: "tonic" });
        list.push({ degree: 6, quality: "major", fn: "tonic" });
        list.push({ degree: 4, quality: "minor", fn: "predominant" });
        break;
      case "PD":
        list.push({ degree: 4, quality: "minor", fn: "predominant" });
        list.push({ degree: 2, quality: "diminished", fn: "predominant" });
        break;
      case "D":
        list.push({ degree: 5, quality: "major", fn: "dominant" });
        list.push({ degree: 5, quality: "dominant7", fn: "dominant", seventh: true });
        list.push({ degree: 7, quality: "diminished", fn: "dominant" });
        break;
    }
  }

  const compatible = list.filter((c) => allowedQualities.includes(c.quality));
  const pool = compatible.length > 0 ? compatible : list;

  return pool.map((c) => ({
    degree: c.degree,
    quality: c.quality,
    fn: c.fn,
    symbol: romanFor(c.degree, c.quality, c.seventh ?? false),
  }));
};

export const generateHarmonyWithGrammar = (
  context: TonalContext,
  meter: Meter,
  measures: number,
  allowedProgressionIds: readonly string[],
  chordVocabulary: readonly ChordQuality[],
  phraseSections: PhraseSection[],
  cadencePlan: CadencePlan,
  rng: Rng,
  legacyTemplateId?: string,
  jumpMode = false
): { events: HarmonyEvent[]; progressionId: string; harmonicRhythmId: string } => {
  const duration = ticksPerMeasure(meter);

  // 1. Legacy accompaniment template check
  const legacy = legacyBassLineById(legacyTemplateId);
  if (legacy) {
    if (legacy.meter !== `${meter.beats}/${meter.beatUnit}`) {
      throw new Error(`${legacy.id} requires ${legacy.meter}`);
    }
    if (legacy.fixedKey && legacy.fixedKey !== `${context.tonic} ${context.mode}`) {
      throw new Error(`${legacy.id} requires ${legacy.fixedKey}`);
    }
    if (measures !== legacy.harmony.length) {
      throw new Error(`${legacy.id} requires exactly ${legacy.harmony.length} measures`);
    }
    const events = legacy.harmony.map((step, index) => {
      const quality = step.quality ?? qualityForDegree(context.mode, step.degree);
      const fn: HarmonyEvent["function"] = step.degree === 1 || step.degree === 6 ? "tonic" : step.degree === 5 || step.degree === 7 ? "dominant" : "predominant";
      return {
        id: `harmony-${index}`,
        onset: index * duration,
        duration,
        rootDegree: { degree: step.degree, alteration: 0, octaveOffset: 0 },
        quality,
        function: fn,
        symbol: step.symbol ?? romanFor(step.degree, quality, false),
      } satisfies HarmonyEvent;
    });
    return { events, progressionId: legacy.id, harmonicRhythmId: "1/bar" };
  }

  // 2. Explicit single progression requested or jump progression mode
  const singleExplicitProgression = allowedProgressionIds.length === 1 && PROGRESSIONS.some((p) => p.id === allowedProgressionIds[0]);
  if (jumpMode || singleExplicitProgression) {
    const compatible = (template: (typeof PROGRESSIONS)[number]) =>
      template.degrees.every((degree, index) =>
        chordVocabulary.includes(qualityForDegree(context.mode, degree, template.sevenths?.includes(index) ?? false))
      );
    const available = PROGRESSIONS.filter((x) => allowedProgressionIds.includes(x.id) && compatible(x));
    const progression = available.length ? rng.pick(available) : PROGRESSIONS[0]!;

    const events = Array.from({ length: measures }, (_, i) => {
      const isCadence = i === measures - 1;
      const degree = isCadence ? progression.degrees[i % progression.degrees.length]! : progression.degrees[i % progression.degrees.length]!;
      const seventh = progression.sevenths?.includes(i % progression.degrees.length) ?? false;
      const fn: HarmonyEvent["function"] = degree === 1 || degree === 6 ? "tonic" : degree === 5 || degree === 7 ? "dominant" : "predominant";
      const quality = qualityForDegree(context.mode, degree, seventh);
      return {
        id: `harmony-${i}`,
        onset: i * duration,
        duration,
        rootDegree: { degree: degree as ScaleDegreeNumber, alteration: 0, octaveOffset: 0 },
        quality,
        function: fn,
        symbol: romanFor(degree, quality, seventh),
      } satisfies HarmonyEvent;
    });
    return { events, progressionId: progression.id, harmonicRhythmId: "1/bar" };
  }

  // 3. Functional Grammar with Variable Harmonic Rhythm
  let harmonicRhythmId: HarmonicRhythmPattern = "onePerMeasure";
  const allowVariable = chordVocabulary.length >= 2 && meter.beats === 4;

  if (allowVariable && measures >= 4) {
    const roll = rng.next();
    if (roll < 0.60) {
      harmonicRhythmId = "onePerMeasure";
    } else if (roll < 0.85) {
      harmonicRhythmId = "lateDominant";
    } else if (roll < 0.95) {
      harmonicRhythmId = "changeOnBeat3";
    } else {
      harmonicRhythmId = "twoPerMeasure";
    }
  }

  // Build functional path across measures
  const functions: FunctionalRegion[] = [];
  let currentFn: FunctionalRegion = "T";
  functions.push(currentFn);

  for (let m = 1; m < measures; m++) {
    const section = phraseSections[m];
    const isPenultimate = m === measures - 2;
    const isCadence = m === measures - 1 || section?.role === "cadence";

    if (isCadence) {
      currentFn = cadencePlan.cadenceType === "half" ? "D" : "R";
    } else if (isPenultimate) {
      currentFn = currentFn === "D" ? "D" : rng.next() < 0.6 ? "PD" : "D";
    } else if (section?.role === "climax") {
      currentFn = rng.next() < 0.7 ? "D" : "PD";
    } else {
      switch (currentFn) {
        case "T":
          currentFn = rng.weightedPick([
            { value: "T" as const, weight: 1.0 },
            { value: "TE" as const, weight: 1.5 },
            { value: "PD" as const, weight: 2.0 },
            { value: "D" as const, weight: 1.2 },
          ]);
          break;
        case "TE":
          currentFn = rng.weightedPick([
            { value: "PD" as const, weight: 2.5 },
            { value: "D" as const, weight: 1.8 },
            { value: "T" as const, weight: 0.8 },
          ]);
          break;
        case "PD":
          currentFn = rng.weightedPick([
            { value: "D" as const, weight: 3.5 },
            { value: "PD" as const, weight: 0.8 },
          ]);
          break;
        case "D":
          currentFn = rng.weightedPick([
            { value: "T" as const, weight: 3.0 },
            { value: "TE" as const, weight: 0.5 },
          ]);
          break;
        case "R":
          currentFn = "T";
          break;
      }
    }
    functions.push(currentFn);
  }

  // Realize chords per measure
  const events: HarmonyEvent[] = [];
  let eventIdx = 0;

  for (let m = 0; m < measures; m++) {
    const fn = functions[m]!;
    const isLast = m === measures - 1;
    const isPenultimate = m === measures - 2;

    if (isLast) {
      if (harmonicRhythmId === "lateDominant" || harmonicRhythmId === "changeOnBeat3" || harmonicRhythmId === "twoPerMeasure") {
        const splitTick = Math.floor(duration / 2);
        events.push({
          id: `harmony-${eventIdx++}`,
          onset: m * duration,
          duration: splitTick,
          rootDegree: { degree: cadencePlan.penultimateDegree, alteration: 0, octaveOffset: 0 },
          quality: cadencePlan.penultimateQuality,
          function: cadencePlan.penultimateDegree === 5 ? "dominant" : "predominant",
          symbol: cadencePlan.penultimateSymbol,
        });
        events.push({
          id: `harmony-${eventIdx++}`,
          onset: m * duration + splitTick,
          duration: duration - splitTick,
          rootDegree: { degree: cadencePlan.finalDegree, alteration: 0, octaveOffset: 0 },
          quality: cadencePlan.finalQuality,
          function: cadencePlan.finalDegree === 1 ? "tonic" : "dominant",
          symbol: cadencePlan.finalSymbol,
        });
      } else {
        events.push({
          id: `harmony-${eventIdx++}`,
          onset: m * duration,
          duration,
          rootDegree: { degree: cadencePlan.finalDegree, alteration: 0, octaveOffset: 0 },
          quality: cadencePlan.finalQuality,
          function: cadencePlan.finalDegree === 1 ? "tonic" : "dominant",
          symbol: cadencePlan.finalSymbol,
        });
      }
      continue;
    }

    if (isPenultimate && harmonicRhythmId === "lateDominant") {
      const splitTick = Math.floor(duration / 2);
      const ch1 = rng.pick(chordsForFunction("PD", context.mode, chordVocabulary));
      events.push({
        id: `harmony-${eventIdx++}`,
        onset: m * duration,
        duration: splitTick,
        rootDegree: { degree: ch1.degree, alteration: 0, octaveOffset: 0 },
        quality: ch1.quality,
        function: ch1.fn,
        symbol: ch1.symbol,
      });
      events.push({
        id: `harmony-${eventIdx++}`,
        onset: m * duration + splitTick,
        duration: duration - splitTick,
        rootDegree: { degree: cadencePlan.penultimateDegree, alteration: 0, octaveOffset: 0 },
        quality: cadencePlan.penultimateQuality,
        function: "dominant",
        symbol: cadencePlan.penultimateSymbol,
      });
      continue;
    }

    if (harmonicRhythmId === "twoPerMeasure" || (harmonicRhythmId === "changeOnBeat3" && meter.beats === 4 && m % 2 === 1)) {
      const splitTick = Math.floor(duration / 2);
      const ch1 = rng.pick(chordsForFunction(fn, context.mode, chordVocabulary));
      const nextFn = fn === "T" ? "PD" : fn === "PD" ? "D" : "T";
      const ch2 = rng.pick(chordsForFunction(nextFn, context.mode, chordVocabulary));

      events.push({
        id: `harmony-${eventIdx++}`,
        onset: m * duration,
        duration: splitTick,
        rootDegree: { degree: ch1.degree, alteration: 0, octaveOffset: 0 },
        quality: ch1.quality,
        function: ch1.fn,
        symbol: ch1.symbol,
      });
      events.push({
        id: `harmony-${eventIdx++}`,
        onset: m * duration + splitTick,
        duration: duration - splitTick,
        rootDegree: { degree: ch2.degree, alteration: 0, octaveOffset: 0 },
        quality: ch2.quality,
        function: ch2.fn,
        symbol: ch2.symbol,
      });
      continue;
    }

    const ch = rng.pick(chordsForFunction(fn, context.mode, chordVocabulary));
    events.push({
      id: `harmony-${eventIdx++}`,
      onset: m * duration,
      duration,
      rootDegree: { degree: ch.degree, alteration: 0, octaveOffset: 0 },
      quality: ch.quality,
      function: ch.fn,
      symbol: ch.symbol,
    });
  }

  const totalPlannedDuration = duration * measures;
  const currentTotal = events.reduce((sum, e) => sum + e.duration, 0);
  if (currentTotal !== totalPlannedDuration) {
    const lastEv = events.at(-1);
    if (lastEv) {
      lastEv.duration += (totalPlannedDuration - currentTotal);
    }
  }

  const progressionId = `functional-${functions.join("-")}`;
  return { events, progressionId, harmonicRhythmId };
};
