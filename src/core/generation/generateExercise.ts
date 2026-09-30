import type { Exercise, TonalContext } from "../model";
import type { InstrumentProfile } from "../instrument/instrumentProfile";
import { accordionProfile } from "../instrument/accordionProfile";
import { createRng } from "../random/rng";
import { parseTrainingRequest, type TrainingRequest } from "../training/trainingIntent";
import { ticksPerMeasure } from "../music/meter";
import { generatePhrasePlanWithGrammar } from "./phraseGrammar";
import { planCadence } from "./cadenceGrammar";
import { planMelodicAnchors } from "./melodicAnchors";
import { generateHarmony } from "./generateHarmony";
import { generateMelody } from "./generateMelody";
import { generateBass } from "./generateBass";
import { analyzeDifficulty } from "./analyzeDifficulty";
import { validateExercise } from "./validateExercise";
import { legacyBassLineById } from "../patterns/accompanimentTemplates";
import { manualConstraintViolations } from "./manualConstraints";
import { pitchWindow } from "./pitchRegister";
import { applyProgressiveStudy, studyStepForSeed } from "./progressiveStudy";
import { computeStructuralSignature } from "./structuralSignature";

const parseKey = (name: string): TonalContext => {
  const match = name.match(/^(.+?)\s+(major|minor)$/);
  if (!match) throw new Error(`Invalid key ${name}`);
  return { tonic: match[1]!, mode: match[2] as TonalContext["mode"] };
};

const leftJumpProgression = (request: TrainingRequest) =>
  !request.leftHand.enabled || request.leftHand.jumpFrequency === "none"
    ? request.harmony.progressionVocabulary
    : [`jump-${request.leftHand.jumpSize}-${request.leftHand.jumpFrequency}`];

export const generateExercise = (
  raw: TrainingRequest,
  seed = raw.seed ?? Date.now(),
  instrument: InstrumentProfile = accordionProfile,
  antiRepetition?: import("./antiRepetition").AntiRepetitionTracker
): Exercise => {
  const parsed = parseTrainingRequest(raw);
  const legacy = legacyBassLineById(parsed.leftHand.templateId);
  const [legacyBeats, legacyBeatUnit] = legacy?.meter.split("/").map(Number) ?? [];
  const normalized: TrainingRequest = legacy
    ? {
        ...parsed,
        measures: legacy.harmony.length,
        tonal: legacy.fixedKey ? { ...parsed.tonal, keys: [legacy.fixedKey], selection: "fixed" } : parsed.tonal,
        rhythm: { ...parsed.rhythm, meters: [{ beats: legacyBeats!, beatUnit: legacyBeatUnit as 4 | 8 }] },
        leftHand: { ...parsed.leftHand, enabled: true },
      }
    : parsed;

  const rng = createRng(seed);
  const request = applyProgressiveStudy({ ...normalized }, seed);
  request.rightHand.range = pitchWindow(request.pitchRegister, request.rightHand.range, seed, instrument.rightHandRange);

  let lastRejection: string[] = [];
  const studyInfo = studyStepForSeed(seed, parsed.emphasis);
  for (let attempt = 1; attempt <= 32; attempt++) {
    const keyCandidates = attempt <= 20 ? [request.tonal.keys[0]!] : request.tonal.keys;
    const progressionCandidates = leftJumpProgression(request);
    const context = parseKey(rng.pick(keyCandidates));
    const meter = rng.pick(request.rhythm.meters);

    // Generation Hierarchy
    const phrasePlanResult = generatePhrasePlanWithGrammar(request.measures, rng, undefined, antiRepetition);
    const cadencePlan = planCadence(context.mode, meter, true, "cadence", rng);
    const harmonyResult = generateHarmony(
      context,
      meter,
      request.measures,
      progressionCandidates,
      request.harmony.chordVocabulary,
      rng,
      request.leftHand.templateId,
      phrasePlanResult.sections,
      cadencePlan
    );
    const anchors = planMelodicAnchors(
      context,
      meter,
      harmonyResult.events,
      phrasePlanResult.contourPoints,
      request.rightHand.range,
      cadencePlan,
      rng
    );

    const base = {
      seed,
      source: {
        type: "generated" as const,
        seed,
        generatorVersion: "4",
      },
      tonalContext: context,
      meter,
      tempoBpm: request.tempoBpm,
      totalDuration: ticksPerMeasure(meter) * request.measures,
      harmony: harmonyResult.events,
      phrase: phrasePlanResult.sections,
      rightHand: generateMelody(
        context,
        meter,
        harmonyResult.events,
        phrasePlanResult.sections,
        request,
        rng,
        {
          phrasePlan: phrasePlanResult,
          cadencePlan,
          anchors,
          harmonicRhythmId: harmonyResult.harmonicRhythmId,
        }
      ),
      leftHand: generateBass(context, meter, harmonyResult.events, request),
      metadata: {
        emphasis: request.emphasis,
        progressionId: harmonyResult.progressionId,
        attempts: attempt,
        studyStep: studyInfo.step,
        studyLabel: studyInfo.label,
        studyCycle: studyInfo.cycle,
        studyTopic: studyInfo.topic,
      },
    };

    const exercise: Exercise = { ...base, difficulty: analyzeDifficulty(base) };
    const validation = validateExercise(exercise, instrument);
    const manualViolations = manualConstraintViolations(exercise, request);
    lastRejection = [...validation.errors, ...manualViolations];

    if (validation.valid && !manualViolations.length) {
      antiRepetition?.record(computeStructuralSignature(exercise));
      return exercise;
    }
  }

  throw new Error(`Unable to generate an exercise within constraints after 32 candidates (seed ${seed}): ${lastRejection.join("; ")}`);
};
