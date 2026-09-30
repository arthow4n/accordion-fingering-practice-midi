import type { Exercise } from "../model";
import { computeStructuralSignature } from "./structuralSignature";

export const exerciseDiagnostics = (x: Exercise): string => {
  const sig = computeStructuralSignature(x);
  const rhNotes = x.rightHand.filter((e) => e.pitches.length > 0 && !e.metadata.tieFromPrevious);
  const lastNote = rhNotes.at(-1);

  // Group motifs by measure
  const motifDescriptions = x.phrase.map((section, idx) => {
    const eventsInMeasure = x.rightHand.filter(
      (e) => e.onset >= (idx * x.totalDuration) / x.phrase.length &&
        e.onset < ((idx + 1) * x.totalDuration) / x.phrase.length
    );
    const gestures = [...new Set(eventsInMeasure.map((e) => e.metadata.gestureType).filter(Boolean))];
    const trans = section.transformation !== "exact" ? ` (${section.transformation})` : "";
    return `${section.label}${trans} = ${gestures.join(" + ") || "notes"}`;
  });

  const lines: string[] = [
    `seed: ${x.seed}`,
    `source: ${x.source?.type ?? "generated"}`,
    `generator version: ${x.source?.type === "generated" ? x.source.generatorVersion : "4"}`,
    ...(x.metadata.studyStep
      ? [`study arc: step ${x.metadata.studyStep} (${x.metadata.studyLabel}), cycle ${x.metadata.studyCycle}${x.metadata.studyTopic ? ` · ${x.metadata.studyTopic}` : ""}`]
      : []),
    `key: ${x.tonalContext.tonic} ${x.tonalContext.mode}`,
    `meter: ${x.meter.beats}/${x.meter.beatUnit}`,
    `tempo: ${x.tempoBpm}`,
    "",
    "phrase:",
    sig.phraseArchetype,
    "",
    "phrase contour:",
    sig.contour,
    "",
    "harmonic functions:",
    sig.harmonicFunctions.join(" → "),
    "",
    "harmonic rhythm:",
    sig.harmonicRhythm,
    "",
    "motifs:",
    ...motifDescriptions,
    "",
    "cadence:",
    sig.cadenceType,
    "",
    "harmonic cadence:",
    x.harmony.slice(-2).map((h) => h.symbol).join(" → "),
    "",
    "melodic approach:",
    sig.cadenceContour,
    "",
    "arrival:",
    `beat ${sig.arrivalBeat ?? 1}`,
    "",
    "final scale degree:",
    String(sig.finalScaleDegree ?? lastNote?.metadata.scaleDegree?.degree ?? 1),
    "",
    `computed difficulty: ${Object.entries(x.difficulty).map(([k, v]) => `${k}=${v.toFixed(2)}`).join(", ")}`,
  ];

  return lines.join("\n");
};
