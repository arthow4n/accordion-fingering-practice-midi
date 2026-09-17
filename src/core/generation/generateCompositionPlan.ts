import type { PhraseSection, PatternTransformation } from "../model";
import type { Rng } from "../random/rng";
export const generatePhrasePlan = (measures: number, rng: Rng): PhraseSection[] => Array.from({length:measures}, (_,measure) => {
  const last = measure === measures - 1;
  const label: PhraseSection["label"] = last ? "cadence" : measure === 0 ? "A" : measure === 1 ? "A'" : measure % 4 === 2 ? "B" : "A''";
  const choices: PatternTransformation[] = measure === 0 ? ["exact"] : ["exact","sequenceUp","sequenceDown","changedEnding","newStart"];
  return { id:`section-${measure}`, label, measure, transformation:last ? "changedEnding" : rng.pick(choices) };
});
