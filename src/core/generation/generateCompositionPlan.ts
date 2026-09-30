import type { PhraseSection } from "../model";
import type { Rng } from "../random/rng";
import { generatePhrasePlanWithGrammar, type PhrasePlanResult } from "./phraseGrammar";

export { generatePhrasePlanWithGrammar, type PhrasePlanResult };

export const generatePhrasePlan = (measures: number, rng: Rng): PhraseSection[] => {
  return generatePhrasePlanWithGrammar(measures, rng).sections;
};
