import type { Exercise, TonalContext } from "../model";
import type { InstrumentProfile } from "../instrument/instrumentProfile";
import { accordionProfile } from "../instrument/accordionProfile";
import { createRng } from "../random/rng";
import { parseTrainingRequest, type TrainingRequest } from "../training/trainingIntent";
import { ticksPerMeasure } from "../music/meter";
import { generatePhrasePlan } from "./generateCompositionPlan";
import { generateHarmony } from "./generateHarmony";
import { generateMelody } from "./generateMelody";
import { generateBass } from "./generateBass";
import { analyzeDifficulty } from "./analyzeDifficulty";
import { validateExercise } from "./validateExercise";
import { legacyBassLineById } from "../patterns/accompanimentTemplates";
import { manualConstraintViolations } from "./manualConstraints";
import { pitchWindow } from "./pitchRegister";
import { applyProgressiveStudy, studyStepForSeed } from "./progressiveStudy";

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
  instrument: InstrumentProfile = accordionProfile
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
    const context = parseKey(rng.pick(request.tonal.keys));
    const meter = rng.pick(request.rhythm.meters);
    const phrase = generatePhrasePlan(request.measures, rng);
    const harmonyResult = generateHarmony(
      context,
      meter,
      request.measures,
      leftJumpProgression(request),
      request.harmony.chordVocabulary,
      rng,
      request.leftHand.templateId
    );

    const base = {
      seed,
      tonalContext: context,
      meter,
      tempoBpm: request.tempoBpm,
      totalDuration: ticksPerMeasure(meter) * request.measures,
      harmony: harmonyResult.events,
      phrase,
      rightHand: generateMelody(context, meter, harmonyResult.events, phrase, request, rng),
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
      return exercise;
    }
  }

  throw new Error(`Unable to generate an exercise within constraints after 32 candidates (seed ${seed}): ${lastRejection.join("; ")}`);
};
