import type { Exercise } from "../model";
export const exerciseDiagnostics = (x: Exercise) => [
  `seed: ${x.seed}`,
  ...(x.metadata.studyStep ? [`study arc: step ${x.metadata.studyStep} (${x.metadata.studyLabel}), cycle ${x.metadata.studyCycle}`] : []),
  `key: ${x.tonalContext.tonic} ${x.tonalContext.mode}`,
  `meter: ${x.meter.beats}/${x.meter.beatUnit}`,
  `tempo: ${x.tempoBpm}`,
  `harmony: ${x.harmony.map(h => h.symbol).join(" | ")}`,
  `phrase: ${x.phrase.map(p => p.label).join(" | ")}`,
  `patterns: ${x.phrase.map((_, i) => `m${i + 1}: ${x.rightHand.find(e => e.onset >= i * x.totalDuration / x.phrase.length)?.metadata.patternId}`).join("; ")}`,
  `computed difficulty: ${Object.entries(x.difficulty).map(([k, v]) => `${k}=${v.toFixed(2)}`).join(", ")}`,
].join("\n");
