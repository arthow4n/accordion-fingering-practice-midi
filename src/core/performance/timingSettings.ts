import { z } from "zod";
import type { MatchOptions } from "./eventMatcher";

export const timingSettingsSchema = z.object({
  strictness: z.enum(["veryForgiving", "balanced", "strict", "custom"]).default("veryForgiving"),
  followAfterPause: z.boolean().default(true),
  earlyMs: z.number().int().min(30).max(2000).default(400),
  lateMs: z.number().int().min(30).max(2000).default(600),
  chordMs: z.number().int().min(20).max(500).default(150),
});
export type TimingSettings = z.infer<typeof timingSettingsSchema>;
export const defaultTimingSettings = (): TimingSettings => timingSettingsSchema.parse({});
export const timingOptions = (settings: TimingSettings, tempoBpm: number): MatchOptions => {
  const beat = 60_000 / tempoBpm;
  const [early, late, chord] = settings.strictness === "custom"
    ? [settings.earlyMs, settings.lateMs, settings.chordMs]
    : settings.strictness === "veryForgiving" ? [beat * .5, beat * .5, Math.min(180, beat * .2)]
    : settings.strictness === "balanced" ? [beat * .2, beat * .25, 100]
    : [beat * .1, beat * .125, 60];
  return {
    earlyToleranceMs: early * 1.5, lateToleranceMs: late * 1.5,
    correctEarlyMs: early, correctLateMs: late, simultaneityWindowMs: chord,
  };
};
