import type { Exercise } from "../model";

export type StructuralSignature = {
  phraseArchetype: string;
  contour: string;
  harmonicFunctions: string[];
  harmonicRhythm: string;
  cadenceType: string;
  cadenceContour: string;
  cadenceRhythm: string;
  mainMotifContour: string;
  finalScaleDegree?: number;
  arrivalBeat?: number;
};

export const computeStructuralSignature = (exercise: Exercise): StructuralSignature => {
  const rhNotes = exercise.rightHand.filter(e => e.pitches.length > 0 && !e.metadata.tieFromPrevious);
  const lastNote = rhNotes.at(-1);

  // Extract phrase archetype from metadata or phrase structure
  const firstEventMeta = rhNotes[0]?.metadata;
  const phraseArchetype = firstEventMeta?.phraseArchetypeId ?? exercise.phrase.map(p => p.role ?? p.label).join("→");

  // Contour summary
  const contourPhases = exercise.rightHand
    .map(e => e.metadata.contourPhase)
    .filter((phase): phase is NonNullable<typeof phase> => Boolean(phase));
  const uniqueContourSequence = contourPhases.filter((p, i) => i === 0 || p !== contourPhases[i - 1]);
  const contour = uniqueContourSequence.length ? uniqueContourSequence.join("→") : "stable";

  // Harmonic functions
  const harmonicFunctions = exercise.harmony.map(h => h.function);

  // Harmonic rhythm summary
  const harmonicRhythm = firstEventMeta?.harmonicRhythmId ?? (exercise.harmony.length === exercise.phrase.length ? "1/bar" : `${exercise.harmony.length} chords / ${exercise.phrase.length} bars`);

  // Cadence summary
  const cadenceType = lastNote?.metadata.cadenceType ?? "strongTonic";
  const cadenceContour = lastNote?.metadata.gestureType ?? "stepApproach";
  const cadenceRhythm = lastNote?.metadata.rhythmGestureId ?? `${lastNote?.duration ?? 480} ticks`;

  // Main motif contour (from first few notes)
  const motifNotes = rhNotes.slice(0, 4);
  const motifIntervals = motifNotes.slice(1).map((n, i) => {
    const diff = n.pitches[0]!.midi - motifNotes[i]!.pitches[0]!.midi;
    return diff > 0 ? "U" : diff < 0 ? "D" : "S";
  });
  const mainMotifContour = motifIntervals.join("") || "S";

  // Final scale degree and arrival beat
  const finalScaleDegree = lastNote?.metadata.scaleDegree?.degree;
  const lastOnset = lastNote?.onset ?? 0;
  const ticksPerBeat = 480;
  const arrivalBeat = Math.floor((lastOnset % (exercise.meter.beats * ticksPerBeat)) / ticksPerBeat) + 1;

  return {
    phraseArchetype,
    contour,
    harmonicFunctions,
    harmonicRhythm,
    cadenceType,
    cadenceContour,
    cadenceRhythm,
    mainMotifContour,
    finalScaleDegree,
    arrivalBeat,
  };
};
