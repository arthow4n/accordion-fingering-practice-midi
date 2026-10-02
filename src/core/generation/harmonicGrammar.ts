import type { ChordQuality, HarmonyEvent, Meter, Mode, ScaleDegreeNumber, TonalContext } from "../model";
import type { Rng } from "../random/rng";
import { harmonicRootDegree, qualityForDegree } from "../music/key";
import { ticksPerMeasure } from "../music/meter";
import { PROGRESSIONS } from "../patterns/progressionTemplates";
import { legacyBassLineById } from "../patterns/accompanimentTemplates";
import type { CadencePlan } from "./cadenceGrammar";
import type { PhraseSection } from "../model";
import { defaultGrammarWeights, type GrammarWeights } from "./grammarWeights";
import type { AntiRepetitionTracker } from "./antiRepetition";

export type FunctionalRegion = "T" | "TE" | "PD" | "D" | "R";

export type HarmonicRhythmPattern =
  | "onePerMeasure"
  | "twoPerMeasure"
  | "onePerTwoMeasures"
  | "changeOnBeat3"
  | "lateDominant";

const romanFor = (degree: number, quality: ChordQuality, seventh: boolean): string => {
  const numeral = ["", "I", "II", "III", "IV", "V", "VI", "VII"][degree]!;
  const cased = quality === "minor" || quality === "diminished" ? numeral.toLowerCase() : numeral;
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
  jumpMode = false,
  weights: GrammarWeights = defaultGrammarWeights,
  antiRepetition?: AntiRepetitionTracker
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
        rootDegree: harmonicRootDegree(context.mode, step.degree, quality),
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
        rootDegree: harmonicRootDegree(context.mode, degree as ScaleDegreeNumber, quality),
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
    const hrOptions: { id: HarmonicRhythmPattern; baseWeight: number }[] = [
      { id: "onePerMeasure", baseWeight: 0.60 },
      { id: "lateDominant", baseWeight: 0.25 },
      { id: "changeOnBeat3", baseWeight: 0.10 },
      { id: "twoPerMeasure", baseWeight: 0.05 },
    ];
    const weightedHr = hrOptions.map((opt) => ({
      value: opt.id,
      weight: opt.baseWeight * (antiRepetition ? antiRepetition.getHarmonicRhythmPenalty(opt.id) : 1.0),
    })).filter((o) => o.weight > 0);
    harmonicRhythmId = weightedHr.length ? rng.weightedPick(weightedHr) : "onePerMeasure";
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
      const candidates: ("T" | "TE" | "PD" | "D" | "R")[] = ["T", "TE", "PD", "D", "R"];
      const weightedCandidates = candidates.map((candidate) => ({
        value: candidate,
        weight: weights.harmonicTransitionWeight(
          {
            previousFunction: currentFn,
            phraseRole: section?.role ?? "continuation",
            measureIndex: m,
            totalMeasures: measures,
            mode: context.mode,
          },
          candidate
        ),
      })).filter((c) => c.weight > 0);
      currentFn = weightedCandidates.length ? rng.weightedPick(weightedCandidates) : "T";
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
      if (harmonicRhythmId === "changeOnBeat3" || harmonicRhythmId === "twoPerMeasure") {
        const splitTick = Math.floor(duration / 2);
        events.push({
          id: `harmony-${eventIdx++}`,
          onset: m * duration,
          duration: splitTick,
          rootDegree: harmonicRootDegree(context.mode, cadencePlan.penultimateDegree, cadencePlan.penultimateQuality),
          quality: cadencePlan.penultimateQuality,
          function: cadencePlan.penultimateDegree === 5 ? "dominant" : "predominant",
          symbol: cadencePlan.penultimateSymbol,
        });
        events.push({
          id: `harmony-${eventIdx++}`,
          onset: m * duration + splitTick,
          duration: duration - splitTick,
          rootDegree: harmonicRootDegree(context.mode, cadencePlan.finalDegree, cadencePlan.finalQuality),
          quality: cadencePlan.finalQuality,
          function: cadencePlan.finalDegree === 1 ? "tonic" : "dominant",
          symbol: cadencePlan.finalSymbol,
        });
      } else {
        events.push({
          id: `harmony-${eventIdx++}`,
          onset: m * duration,
          duration,
          rootDegree: harmonicRootDegree(context.mode, cadencePlan.finalDegree, cadencePlan.finalQuality),
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
        rootDegree: harmonicRootDegree(context.mode, ch1.degree, ch1.quality),
        quality: ch1.quality,
        function: ch1.fn,
        symbol: ch1.symbol,
      });
      events.push({
        id: `harmony-${eventIdx++}`,
        onset: m * duration + splitTick,
        duration: duration - splitTick,
        rootDegree: harmonicRootDegree(context.mode, cadencePlan.penultimateDegree, cadencePlan.penultimateQuality),
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
        rootDegree: harmonicRootDegree(context.mode, ch1.degree, ch1.quality),
        quality: ch1.quality,
        function: ch1.fn,
        symbol: ch1.symbol,
      });
      events.push({
        id: `harmony-${eventIdx++}`,
        onset: m * duration + splitTick,
        duration: duration - splitTick,
        rootDegree: harmonicRootDegree(context.mode, ch2.degree, ch2.quality),
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
      rootDegree: harmonicRootDegree(context.mode, ch.degree, ch.quality),
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
