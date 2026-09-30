import type { ChordQuality, HarmonyEvent, Meter, PhraseSection, TonalContext } from "../model";
import type { Rng } from "../random/rng";
import { generateHarmonyWithGrammar } from "./harmonicGrammar";
import { planCadence, type CadencePlan } from "./cadenceGrammar";

export { generateHarmonyWithGrammar };

export const generateHarmony = (
  context: TonalContext,
  meter: Meter,
  measures: number,
  allowed: readonly string[],
  chordVocabulary: readonly ChordQuality[],
  rng: Rng,
  legacyTemplateId?: string,
  phraseSections?: PhraseSection[],
  cadencePlan?: CadencePlan
): { events: HarmonyEvent[]; progressionId: string; harmonicRhythmId: string } => {
  const isJumpMode = allowed.some((id) => id.startsWith("jump-"));
  const defaultCadence = cadencePlan ?? planCadence(context.mode, meter, true, "cadence", rng);
  const sections = phraseSections ?? Array.from({ length: measures }, (_, i) => ({
    id: `sec-${i}`,
    label: i === measures - 1 ? "cadence" : "A",
    measure: i,
    role: i === measures - 1 ? ("cadence" as const) : ("statement" as const),
    transformation: "exact" as const,
  }));

  return generateHarmonyWithGrammar(
    context,
    meter,
    measures,
    allowed,
    chordVocabulary,
    sections,
    defaultCadence,
    rng,
    legacyTemplateId,
    isJumpMode
  );
};
