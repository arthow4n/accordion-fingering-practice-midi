import { Note } from "tonal";
import type { Exercise, ExerciseEvent, HarmonyEvent, Pitch, TonalContext } from "../../core/model";
import { realizeScaleDegree, scaleNotes } from "../../core/music/key";
import { ticksPerMeasure } from "../../core/music/meter";
import { pitchFromMidi } from "../../core/music/pitch";
import type { ReviewAnnotation } from "../../core/performance/reviewAnnotations";

export type ExerciseToAbcOptions = {
  markedOnset?: number;
  reviewAnnotations?: ReviewAnnotation[];
};

const accidental = (name: string) => {
  const acc = Note.get(name).acc;
  return acc.replaceAll("#", "^").replaceAll("b", "_");
};

const letter = (name: string) => name[0]!.toUpperCase();

const abcBase = (pitch: Pitch) => {
  const parsed = Note.get(pitch.name);
  let text = parsed.letter!;
  if ((parsed.oct ?? 4) >= 5) text = text.toLowerCase() + "'".repeat(Math.max(0, (parsed.oct ?? 4) - 5));
  else text += ",".repeat(Math.max(0, 4 - (parsed.oct ?? 4)));
  return text;
};

const signatureMap = (context: TonalContext) => new Map(scaleNotes(context).map(n => [letter(n), accidental(n)]));

const chordSuffix = (quality: HarmonyEvent["quality"]) =>
  quality === "minor" ? "m" : quality === "dominant7" ? "7" : quality === "diminished" ? "dim" : "";

const chordName = (harmony: HarmonyEvent, context: TonalContext) => {
  const root = Note.pitchClass(realizeScaleDegree(context, harmony.rootDegree, 4));
  return `${root}${chordSuffix(harmony.quality)}`;
};

const accompanimentLabels = (exercise: Exercise) => {
  const labels = new Map<number, string>();
  for (const event of exercise.leftHand) {
    const annotation = event.metadata.leadSheetAnnotation;
    if (!annotation) continue;
    labels.set(event.onset, `${annotation.chordRoot}${chordSuffix(annotation.quality)}${annotation.bass ? `/${annotation.bass}` : ""}`);
  }
  let previous = "";
  for (const harmony of exercise.harmony) {
    const chord = chordName(harmony, exercise.tonalContext);
    if (chord !== previous && !labels.has(harmony.onset)) {
      labels.set(harmony.onset, chord);
    }
    previous = chord;
  }
  return labels;
};

const serializeVoice = (
  events: ExerciseEvent[],
  exercise: Exercise,
  labels = new Map<number, string>(),
  markedOnset?: number,
  reviewAnnotations: ReviewAnnotation[] = []
) => {
  const signature = signatureMap(exercise.tonalContext);
  const measure = ticksPerMeasure(exercise.meter);
  const beamBeat =
    exercise.meter.beatUnit === 8 && exercise.meter.beats % 3 === 0
      ? 720
      : (480 * 4) / exercise.meter.beatUnit;
  let currentMeasure = -1;
  let state = new Map<string, string>();
  const parts: string[] = [];
  let previous: ExerciseEvent | undefined;

  const preferFlats = scaleNotes(exercise.tonalContext).some(n => n.includes("b"));

  const annotationsByEventId = new Map<string, ReviewAnnotation[]>();
  const extraAnnotationsByOnset = new Map<number, ReviewAnnotation[]>();
  for (const ann of reviewAnnotations) {
    if ("expectedEventId" in ann) {
      const list = annotationsByEventId.get(ann.expectedEventId) ?? [];
      list.push(ann);
      annotationsByEventId.set(ann.expectedEventId, list);
    } else if (ann.kind === "extra") {
      const list = extraAnnotationsByOnset.get(ann.musicalPosition) ?? [];
      list.push(ann);
      extraAnnotationsByOnset.set(ann.musicalPosition, list);
    }
  }

  const renderPitch = (p: Pitch) => {
    const parsed = Note.get(p.name);
    const key = `${parsed.letter}${parsed.oct}`;
    const desired = accidental(p.name);
    const active = state.get(key) ?? signature.get(letter(p.name)) ?? "";
    let prefix = "";
    if (desired !== active) {
      prefix = desired || "=";
      state.set(key, desired);
    }
    return prefix + abcBase(p);
  };

  const renderGhostPitch = (midiNote: number) => {
    const p = pitchFromMidi(midiNote, preferFlats);
    const parsed = Note.get(p.name);
    const key = `${parsed.letter}${parsed.oct}`;
    const desired = accidental(p.name);
    const active = state.get(key) ?? signature.get(letter(p.name)) ?? "";
    const prefix = desired !== active ? (desired || "=") : "";
    return prefix + abcBase(p);
  };

  // Keep every bass change visible even underneath a sustained melody note.
  const splitEvents = events.flatMap(event => {
    const boundaries = [
      event.onset,
      ...[...labels.keys()].filter(onset => onset > event.onset && onset < event.onset + event.duration).sort((a, b) => a - b),
      event.onset + event.duration,
    ];
    return boundaries.slice(0, -1).map((onset, index) => ({
      ...event,
      onset,
      duration: boundaries[index + 1]! - onset,
      metadata: {
        ...event.metadata,
        tieToNext: event.pitches.length > 0 && (index < boundaries.length - 2 || event.metadata.tieToNext),
        isTiedContinuation: index > 0,
      },
    }));
  });

  for (const event of splitEvents) {
    const mi = Math.floor(event.onset / measure);
    if (mi !== currentMeasure) {
      if (currentMeasure >= 0) parts.push(" |");
      currentMeasure = mi;
      state = new Map();
      previous = undefined;
    }
    const duration = event.duration / 240;
    const isEighthTriplet = event.duration === 160;
    const isQuarterTriplet = event.duration === 320;
    const tupletPrefix =
      isEighthTriplet && (previous?.duration !== 160 || event.onset % 480 === 0)
        ? "(3"
        : isQuarterTriplet && (previous?.duration !== 320 || event.onset % 960 === 0)
          ? "(3"
          : "";
    const suffix = isEighthTriplet
      ? ""
      : isQuarterTriplet
        ? "2"
        : duration === 1
          ? ""
          : Number.isInteger(duration)
            ? String(duration)
            : `${event.duration / 120}/2`;
    const tie = event.metadata.tieToNext ? "-" : "";
    const annotation = labels.get(event.onset);

    const eventAnns = event.metadata.isTiedContinuation ? [] : (annotationsByEventId.get(event.id) ?? []);
    const extraAnns = extraAnnotationsByOnset.get(event.onset) ?? [];

    const wrongAnn = eventAnns.find(a => a.kind === "wrongPitch");
    const missedAnn = eventAnns.find(a => a.kind === "missed");
    const timingAnn = eventAnns.find(a => a.kind === "timing");
    const extraAnn = extraAnns.find(a => a.kind === "extra");

    const ghostNotes: number[] = [];
    if (wrongAnn && wrongAnn.kind === "wrongPitch") {
      ghostNotes.push(...wrongAnn.playedMidiNotes);
    }
    if (extraAnn && extraAnn.kind === "extra") {
      ghostNotes.push(...extraAnn.playedMidiNotes);
    }

    const ghostPrefix = ghostNotes.length > 0 ? `{${ghostNotes.map(renderGhostPitch).join("")}}` : "";

    let reviewText = "";
    if (wrongAnn) {
      reviewText = `"_wrong"`;
    } else if (missedAnn) {
      reviewText = `"_missed"`;
    } else if (timingAnn && timingAnn.kind === "timing") {
      reviewText = timingAnn.direction === "early" ? `"_early"` : `"_late"`;
    } else if (extraAnn) {
      reviewText = `"_extra"`;
    }

    const markPrefix = markedOnset !== undefined && markedOnset >= event.onset && markedOnset < event.onset + event.duration ? "!mark!" : "";
    const chordPrefix = annotation ? `"${annotation}"` : "";
    const prefix = `${markPrefix}${chordPrefix}${ghostPrefix}${reviewText}${tupletPrefix}`;

    const text = !event.pitches.length
      ? `${prefix}z${suffix}`
      : event.pitches.length === 1
        ? `${prefix}${renderPitch(event.pitches[0]!)}${suffix}${tie}`
        : `${prefix}[${event.pitches.map(renderPitch).join("")}]${suffix}${tie}`;

    const beamed =
      previous &&
      previous.pitches.length > 0 &&
      event.pitches.length > 0 &&
      previous.duration < beamBeat &&
      event.duration < beamBeat &&
      Math.floor(previous.onset / beamBeat) === Math.floor(event.onset / beamBeat) &&
      !tupletPrefix;
    parts.push(`${beamed ? "" : " "}${text}`);
    previous = event;
  }
  parts.push(" |");
  return parts.join("").trim();
};

export const exerciseToAbc = (
  exercise: Exercise,
  optionsOrMarkedOnset?: number | ExerciseToAbcOptions
) => {
  const options: ExerciseToAbcOptions =
    typeof optionsOrMarkedOnset === "number"
      ? { markedOnset: optionsOrMarkedOnset }
      : optionsOrMarkedOnset ?? {};
  const { markedOnset, reviewAnnotations = [] } = options;

  const key = `${exercise.tonalContext.tonic}${exercise.tonalContext.mode === "minor" ? "m" : ""}`;
  return `X:1\nM:${exercise.meter.beats}/${exercise.meter.beatUnit}\nL:1/8\nK:${key}\n${serializeVoice(
    exercise.rightHand,
    exercise,
    accompanimentLabels(exercise),
    markedOnset,
    reviewAnnotations
  )}\n`;
};
