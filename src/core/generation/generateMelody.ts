import type {
  ChallengeType,
  ExerciseEvent,
  HarmonyEvent,
  Meter,
  NoteRole,
  PatternCategory,
  PatternTransformation,
  PhraseRole,
  PhraseSection,
  Pitch,
  RightHandEmphasis,
  ScaleDegree,
  TonalContext,
} from "../model";
import type { Rng } from "../random/rng";
import type { TrainingRequest } from "../training/trainingIntent";
import { metricStrength, ticksPerMeasure } from "../music/meter";
import { pitchFromMidi } from "../music/pitch";
import { findChordTonesInRange, MELODIC_PATTERNS, realizeDiatonicStep, type GeneratedPatternNote, type MelodicPattern } from "../patterns/melodicPatterns";
import { cellsForMeter, type RhythmCell } from "../patterns/rhythmCells";
import { generateNotesForPattern } from "../patterns/patternGenerators";
import { generateMeasureRhythm, type RhythmAtom } from "./rhythmGrammar";
import { generateMelodicGesture, type MelodicGestureType } from "./melodicGestures";
import { applyMotifTransformation, createMotifMemory, storeMotif, type MotifMemory } from "./motifMemory";
import { planCadence, type CadencePlan } from "./cadenceGrammar";
import { samplePhraseContour, type PhrasePlanResult } from "./phraseGrammar";
import { planMelodicAnchors, type MelodicAnchor } from "./melodicAnchors";

type LegacyMotifPlan = {
  pattern: MelodicPattern;
  notes: GeneratedPatternNote[];
  cell: RhythmCell;
  instanceId: string;
};

const categoryWeights = (emphasis: RightHandEmphasis = "everything", rangeSpan = 36): { category: PatternCategory; weight: number }[] => {
  const categories: PatternCategory[] = ["melodicPatterns", "intervals", "arpeggios", "cadencesApproaches", "rhythm"];

  return categories.map((cat) => {
    let weight = 1;
    if (emphasis === cat) weight = 6;
    else if (emphasis === "everything" && cat === "rhythm") weight = 0.35;

    if (rangeSpan < 14 && (cat === "intervals" || cat === "arpeggios")) {
      weight = Math.min(weight, 1.5);
    }

    return { category: cat, weight };
  });
};

const choosePatternForCategory = (category: PatternCategory, rng: Rng): MelodicPattern => {
  const pool = MELODIC_PATTERNS.filter((p) => p.category === category);
  return pool.length ? rng.pick(pool) : MELODIC_PATTERNS[0]!;
};

// Targeted pattern practice implementation (retained for explicit drills)
const generateTargetedMelody = (
  context: TonalContext,
  meter: Meter,
  harmony: HarmonyEvent[],
  phrase: PhraseSection[],
  request: TrainingRequest,
  rng: Rng
): ExerciseEvent[] => {
  const measureTicks = ticksPerMeasure(meter);
  let previousPitch: Pitch | undefined;
  let baseMotif: LegacyMotifPlan | undefined;
  let tieIntoNext = false;
  let tiedPitch: Pitch | undefined;
  let tiedDegree: ScaleDegree | undefined;
  let tiedRole: ExerciseEvent["metadata"]["noteRole"];
  let tiedChromatic = false;
  let tiedChromaticRole: string | undefined;
  let accidentalsRemaining = request.rightHand.maxAccidentalsPerExercise;
  let consecutiveUnisons = 0;

  const selectedDuration = request.rhythm.noteValue === "half" ? 960 : request.rhythm.noteValue === "quarter" ? 480 : request.rhythm.noteValue === "eighth" ? 240 : 120;
  const minimumDuration = request.rhythm.smallestSubdivision === "quarter" ? 480 : request.rhythm.smallestSubdivision === "eighth" ? 240 : 120;
  const allCells = cellsForMeter(meter).filter((cell) => cell.atoms.every((atom) => atom.duration >= minimumDuration));
  const desiredAtoms = 2 + request.rhythm.noteDensity * 14;
  const cells = allCells.filter((cell) => !cell.syncopated || request.rhythm.syncopation >= 0.35);
  const activeCells = cells.length ? cells : allCells;
  const subdivisionCells = request.rhythm.noteDensity >= 0.5
    ? activeCells.filter((cell) => cell.atoms.some((atom) => atom.duration === minimumDuration))
    : activeCells;

  const steadyCell = (duration: number): RhythmCell => {
    const id = request.rhythm.noteValue === "half" ? "halves" : request.rhythm.noteValue === "quarter" ? (meter.beats === 3 ? "three-quarters" : "quarters") : request.rhythm.noteValue === "eighth" ? (meter.beats === 3 ? "three-paired-eighths" : "paired-eighths") : (meter.beats === 3 ? "three-sixteenths" : "four-sixteenths");
    return {
      id,
      meters: [`${meter.beats}/${meter.beatUnit}`],
      atoms: Array.from({ length: measureTicks / duration }, () => ({ duration })),
      complexity: duration <= 120 ? 0.55 : duration <= 240 ? 0.2 : 0.05,
    };
  };

  const selectable = request.rhythm.style === "mostlySteady"
    ? activeCells.filter((cell) => cell.atoms.every((atom) => atom.duration >= selectedDuration) && cell.atoms.some((atom) => atom.duration === selectedDuration))
    : request.rhythm.style === "challenge"
      ? activeCells.filter((cell) => cell.syncopated || new Set(cell.atoms.map((atom) => atom.duration)).size > 1)
      : subdivisionCells.length ? subdivisionCells : activeCells;

  const chooseCell = (): RhythmCell =>
    request.rhythm.style === "steady" && measureTicks % selectedDuration === 0
      ? steadyCell(selectedDuration)
      : rng.pick(
          (selectable.length ? selectable : activeCells)
            .map((cell) => ({ cell, difference: Math.abs(cell.atoms.length - desiredAtoms) }))
            .sort((a, b) => a.difference - b.difference)
            .slice(0, 3)
            .map((x) => x.cell)
        );

  const rangeSpan = request.rightHand.range.high - request.rightHand.range.low;

  const chooseCategory = (): PatternCategory => {
    const weights = categoryWeights(request.emphasis, rangeSpan);
    return rng.weightedPick(weights.map((w) => ({ value: w.category, weight: w.weight })));
  };

  return phrase.flatMap((section, measure) => {
    const isCadence = section.label === "cadence";
    const isRelated = section.label === "A'" || section.label === "A''";
    const activeHarmony = harmony[measure] ?? harmony[harmony.length - 1]!;
    const cell = isRelated && baseMotif && rng.next() >= (request.patterns?.variation ?? 0.35)
      ? baseMotif.cell
      : chooseCell();
    const count = cell.atoms.length;

    let pattern: MelodicPattern;
    let notes: GeneratedPatternNote[];
    let instanceId = `pattern-${measure}`;

    if (isCadence) {
      pattern = request.leftHand.templateId
        ? rng.pick(MELODIC_PATTERNS.filter((p) => p.category === "arpeggios"))
        : rng.pick(MELODIC_PATTERNS.filter((p) => p.id.startsWith("cadence-")));
      notes = generateNotesForPattern(
        pattern,
        context,
        activeHarmony,
        count,
        request.rightHand.range,
        rng,
        previousPitch,
        accidentalsRemaining,
        !request.leftHand.templateId
      );
    } else if (isRelated && baseMotif) {
      pattern = baseMotif.pattern;
      instanceId = baseMotif.instanceId;
      const transformation: PatternTransformation = rng.next() < (request.patterns?.sequenceProbability ?? 0.25)
        ? (rng.next() < 0.5 ? "sequenceUp" : "sequenceDown")
        : section.transformation;

      const stepOffset = transformation === "sequenceUp" ? 1 : transformation === "sequenceDown" ? -1 : 0;
      const allowExact = baseMotif.pattern.family !== "repeated";
      if (allowExact && transformation === "exact" && baseMotif.notes.length === count) {
        notes = [...baseMotif.notes];
      } else {
        notes = generateNotesForPattern(
          pattern,
          context,
          activeHarmony,
          count,
          request.rightHand.range,
          rng,
          previousPitch,
          accidentalsRemaining,
          false,
          stepOffset
        );
      }
    } else {
      const category = request.leftHand.templateId ? "arpeggios" : chooseCategory();
      pattern = choosePatternForCategory(category, rng);
      notes = generateNotesForPattern(
        pattern,
        context,
        activeHarmony,
        count,
        request.rightHand.range,
        rng,
        previousPitch,
        accidentalsRemaining,
        false
      );
    }

    const motif: LegacyMotifPlan = { pattern, notes, cell, instanceId };
    if (measure === 0) baseMotif = motif;

    let onset = measure * measureTicks;
    const exactRhythm = request.rhythm.style === "steady";

    return cell.atoms.map((atom, index) => {
      const finalCadence = isCadence && index === cell.atoms.length - 1;
      const strength = metricStrength(onset % measureTicks, meter);
      const generatedNote = notes[index] ?? notes[notes.length - 1]!;

      let degree = { ...generatedNote.degree };
      let pitch = { ...generatedNote.pitch };
      let role = generatedNote.role;
      let chromatic = generatedNote.chromatic && accidentalsRemaining > 0 && !finalCadence;
      let chromaticRole = chromatic ? generatedNote.chromaticRole : undefined;

      const tieFromPrevious = tieIntoNext;
      const rest = !exactRhythm && !tieFromPrevious && !finalCadence && (atom.rest || (index > 0 && rng.next() < (request.rhythm.restDensity ?? 0.05)));

      if (!tieFromPrevious && !rest) {
        if (finalCadence) {
          const chordTones = findChordTonesInRange(context, activeHarmony, request.rightHand.range);
          const rootTones = chordTones.filter((ct) => ct.degree.degree === activeHarmony.rootDegree.degree);
          const bestRoot = rootTones.length
            ? rootTones.reduce((prev, curr) => Math.abs(curr.pitch.midi - pitch.midi) < Math.abs(prev.pitch.midi - pitch.midi) ? curr : prev)
            : chordTones[0];
          if (bestRoot) {
            pitch = { ...bestRoot.pitch };
            degree = { ...bestRoot.degree, alteration: 0 };
            chromatic = false;
            chromaticRole = undefined;
            role = "cadence tone";
          }
        } else if (strength !== "weak" && !chromatic) {
          const chordTones = findChordTonesInRange(context, activeHarmony, request.rightHand.range);
          const isAlreadyChordTone = chordTones.some((ct) => ct.pitch.midi % 12 === pitch.midi % 12);
          if (!isAlreadyChordTone && chordTones.length) {
            const pool = previousPitch !== undefined && chordTones.length > 1
              ? chordTones.filter((ct) => ct.pitch.midi !== previousPitch!.midi)
              : chordTones;
            const bestTone = pool.length ? pool.reduce((prev, curr) => Math.abs(curr.pitch.midi - pitch.midi) < Math.abs(prev.pitch.midi - pitch.midi) ? curr : prev) : chordTones[0]!;
            pitch = { ...bestTone.pitch };
            degree = { ...bestTone.degree };
            role = "chord tone";
          }
        }
      }

      if (tieFromPrevious && tiedPitch && tiedDegree) {
        pitch = tiedPitch;
        degree = { ...tiedDegree };
        role = tiedRole ?? role;
        chromatic = tiedChromatic;
        chromaticRole = tiedChromaticRole;
      }

      if (!tieFromPrevious && !rest && !finalCadence) {
        if (previousPitch !== undefined && pitch.midi === previousPitch.midi) {
          consecutiveUnisons++;
        } else {
          consecutiveUnisons = 0;
        }

        const maxUnisons = request.emphasis === "rhythm" ? 3 : 2;
        if (consecutiveUnisons >= maxUnisons) {
          if (strength !== "weak") {
            const chordTones = findChordTonesInRange(context, activeHarmony, request.rightHand.range)
              .filter((ct) => ct.pitch.midi !== pitch.midi);
            if (chordTones.length) {
              const bestTone = chordTones.reduce((prev, curr) => Math.abs(curr.pitch.midi - pitch.midi) < Math.abs(prev.pitch.midi - pitch.midi) ? curr : prev);
              pitch = { ...bestTone.pitch };
              degree = { ...bestTone.degree };
              role = "chord tone";
              consecutiveUnisons = 0;
            }
          } else {
            const stepOffset = pitch.midi + 2 <= request.rightHand.range.high ? 1 : -1;
            const rawStep = (degree.degree - 1) + (degree.octaveOffset * 7) + stepOffset;
            const stepped = realizeDiatonicStep(context, rawStep, activeHarmony);
            if (stepped.pitch.midi >= request.rightHand.range.low && stepped.pitch.midi <= request.rightHand.range.high) {
              pitch = { ...stepped.pitch };
              degree = { ...stepped.degree };
              role = "scale tone";
              chromatic = false;
              chromaticRole = undefined;
              consecutiveUnisons = 0;
            }
          }
        }
      }

      let targetedJump = false;
      if (!tieFromPrevious && !rest && previousPitch !== undefined) {
        const jump = Math.abs(pitch.midi - previousPitch.midi);
        if (jump >= 8) targetedJump = true;
      }

      const nextAtom = cell.atoms[index + 1];
      const tieToNext = !exactRhythm && !rest && !finalCadence && Boolean(nextAtom && !nextAtom.rest) && (atom.tie || rng.next() < (request.rhythm.tieDensity ?? 0.05));

      const challengeTags: ChallengeType[] = [];
      if (chromatic) challengeTags.push("chromatic");
      if (targetedJump) challengeTags.push("largeLeap");
      if (cell.syncopated) challengeTags.push("syncopation");

      const event: ExerciseEvent = {
        id: `rh-${measure}-${index}`,
        onset,
        duration: atom.duration,
        pitches: rest ? [] : [pitch],
        hand: "right",
        metadata: {
          scaleDegree: degree,
          harmonyId: activeHarmony.id,
          motifId: isRelated ? "motif-A" : `motif-${measure}`,
          patternId: pattern.id,
          patternFamily: pattern.family,
          patternCategory: pattern.category,
          patternInstanceId: instanceId,
          positionInPattern: index,
          noteRole: role,
          chromaticRole,
          rhythmCellId: cell.id,
          intervalFromPrevious: tieFromPrevious ? 0 : previousPitch === undefined ? undefined : pitch.midi - previousPitch.midi,
          metricStrength: strength,
          challengeTags,
          chromatic: Boolean(chromatic),
          tieFromPrevious,
          tieToNext,
        },
      };

      tieIntoNext = tieToNext;
      if (tieToNext) {
        tiedPitch = pitch;
        tiedDegree = { ...degree };
        tiedRole = role;
        tiedChromatic = Boolean(chromatic);
        tiedChromaticRole = chromaticRole;
      }

      if (!rest && !tieFromPrevious) {
        previousPitch = pitch;
        if (chromatic) accidentalsRemaining--;
      }

      onset += atom.duration;
      return event;
    });
  });
};

// General sight-reading procedural generator
export const generateMelody = (
  context: TonalContext,
  meter: Meter,
  harmony: HarmonyEvent[],
  phrase: PhraseSection[],
  request: TrainingRequest,
  rng: Rng,
  options?: {
    phrasePlan?: PhrasePlanResult;
    cadencePlan?: CadencePlan;
    anchors?: MelodicAnchor[];
    harmonicRhythmId?: string;
  }
): ExerciseEvent[] => {
  // Explicit drills and legacy bass templates use targeted generator
  if (request.emphasis !== "everything" || request.leftHand.templateId) {
    return generateTargetedMelody(context, meter, harmony, phrase, request, rng);
  }

  const measureTicks = ticksPerMeasure(meter);
  const totalMeasures = phrase.length;
  const cadencePlan = options?.cadencePlan ?? planCadence(context.mode, meter, true, "cadence", rng);
  const contourPoints = options?.phrasePlan?.contourPoints ?? samplePhraseContour("stableRisePeakResolve", totalMeasures);
  const anchors = options?.anchors ?? planMelodicAnchors(context, meter, harmony, contourPoints, request.rightHand.range, cadencePlan, rng);

  const motifMemory: MotifMemory = createMotifMemory();
  const events: ExerciseEvent[] = [];

  let previousPitch: Pitch | undefined;
  let previousDegree: ScaleDegree | undefined;
  let accidentalsRemaining = request.rightHand.maxAccidentalsPerExercise;
  let consecutiveUnisons = 0;
  let tieIntoNext = false;
  let tiedPitch: Pitch | undefined;
  let tiedDegree: ScaleDegree | undefined;

  const isSteady = request.rhythm.style === "steady";
  const steadyDuration = request.rhythm.noteValue === "half" ? 960 : request.rhythm.noteValue === "quarter" ? 480 : request.rhythm.noteValue === "eighth" ? 240 : 120;

  for (let m = 0; m < totalMeasures; m++) {
    const section = phrase[m]!;
    const isCadence = m === totalMeasures - 1 || section.role === "cadence";
    const role: PhraseRole = section.role ?? (isCadence ? "cadence" : m === 0 ? "opening" : "continuation");
    const contour = contourPoints[m] ?? { measure: m, position: m / totalMeasures, registerTarget: 0.5, tension: 0.5, phase: "stable" };
    const measureOnset = m * measureTicks;

    const measureAnchor = anchors.find((a) => a.measure === m) ?? anchors[anchors.length - 1]!;
    const nextAnchor = anchors.find((a) => a.measure === m + 1) ?? measureAnchor;

    // Rhythmic plan for this measure
    let measureRhythm: { atoms: RhythmAtom[]; rhythmCellId: string };
    if (isSteady && measureTicks % steadyDuration === 0) {
      measureRhythm = {
        atoms: Array.from({ length: measureTicks / steadyDuration }, () => ({ duration: steadyDuration })),
        rhythmCellId: `steady-${request.rhythm.noteValue}`,
      };
    } else {
      measureRhythm = generateMeasureRhythm(meter, role, request, rng);
    }

    let measureNotes: GeneratedPatternNote[] = [];
    let activeGestureType: MelodicGestureType = "stepUpward";

    // Active harmony at measure start
    const startHarmony = harmony.find(
      (h) => h.onset <= measureOnset && measureOnset < h.onset + h.duration
    ) ?? harmony[0]!;

    if (isCadence) {
      const shape = cadencePlan.melodicShape;
      const count = measureRhythm.atoms.length;
      activeGestureType = shape.direction === "ascending"
        ? "stepUpward"
        : shape.direction === "descending"
        ? "stepDownward"
        : shape.direction === "leapAndStep"
        ? "leapAndStepwiseRecovery"
        : "approachTargetFromAbove";

      const targetArrivalTone = measureAnchor;
      const arrivalDegreeNum = cadencePlan.arrivalDegree;
      const targetStep = (targetArrivalTone.degree.degree - 1) + (targetArrivalTone.degree.octaveOffset * 7);

      let arrivalIndex = count - 1;
      if (cadencePlan.arrivalMetric === "beat1Sustain") {
        arrivalIndex = 0;
      } else if (cadencePlan.arrivalMetric === "beat3Arrival" && count >= 3) {
        arrivalIndex = Math.floor(count / 2);
      } else if (cadencePlan.arrivalMetric === "earlyWithRepetition" && count >= 2) {
        arrivalIndex = Math.max(0, count - 2);
      }

      measureNotes = measureRhythm.atoms.map((_, idx) => {
        if (idx >= arrivalIndex) {
          return {
            degree: targetArrivalTone.degree,
            pitch: targetArrivalTone.pitch,
            role: "cadence tone" as NoteRole,
            chromatic: false,
          };
        }
        const distFromArrival = arrivalIndex - idx;
        const degreeOffset = shape.degrees[Math.max(0, shape.degrees.length - 1 - distFromArrival)] ?? (arrivalDegreeNum + distFromArrival);
        const relStep = targetStep + (degreeOffset - arrivalDegreeNum);
        const realized = realizeDiatonicStep(context, relStep, startHarmony);
        return {
          degree: realized.degree,
          pitch: realized.pitch,
          role: "approach tone" as NoteRole,
          chromatic: false,
        };
      });
    } else if ((role === "variation" || role === "repetition") && motifMemory.primary) {
      const transformed = applyMotifTransformation(
        motifMemory.primary,
        section.transformation,
        context,
        startHarmony,
        request.rightHand.range,
        rng
      );
      measureNotes = transformed.notes;
      activeGestureType = transformed.gestureType;
      const transformedDur = transformed.rhythm.reduce((s, a) => s + a.duration, 0);
      if (!isSteady && transformedDur === measureTicks && transformed.rhythm.length > 0) {
        measureRhythm = { atoms: transformed.rhythm, rhythmCellId: `trans-${section.transformation}` };
      }
    } else {
      const count = measureRhythm.atoms.length;
      const startPitch = previousPitch ?? measureAnchor.pitch;
      const startDegree = (previousPitch && previousDegree) ? previousDegree : measureAnchor.degree;

      const generated = generateMelodicGesture(
        context,
        {
          from: startPitch,
          fromDegree: startDegree,
          target: nextAnchor.pitch,
          targetDegree: nextAnchor.degree,
          harmony: startHarmony,
          noteCount: count,
          metricPosition: 0,
          phraseRole: role,
          contourGoal: contour.registerTarget,
          accidentalsRemaining,
          range: request.rightHand.range,
        },
        undefined,
        rng
      );
      measureNotes = generated.notes;
      activeGestureType = generated.type;

      if (m === 0) {
        motifMemory.primary = storeMotif(
          "motif-primary",
          measureNotes,
          measureRhythm.atoms,
          [generated],
          startDegree
        );
      } else if (role === "contrast" && !motifMemory.secondary) {
        motifMemory.secondary = storeMotif(
          "motif-secondary",
          measureNotes,
          measureRhythm.atoms,
          [generated],
          startDegree
        );
      }
    }

    // Realize notes into ExerciseEvents
    let onset = measureOnset;
    measureRhythm.atoms.forEach((atom, index) => {
      const activeHarmonyForEvent = harmony.find(
        (h) => h.onset <= onset && onset < h.onset + h.duration
      ) ?? startHarmony;

      const generatedNote = measureNotes[index] ?? measureNotes[measureNotes.length - 1]!;
      let pitch = { ...generatedNote.pitch };
      let degree = { ...generatedNote.degree };
      let noteRole = generatedNote.role;
      const chromatic = generatedNote.chromatic && accidentalsRemaining > 0;
      const chromaticRole = chromatic ? generatedNote.chromaticRole : undefined;

      const strength = metricStrength(onset % measureTicks, meter);
      const isFinalNote = isCadence && index === measureRhythm.atoms.length - 1;

      // Strong / medium beats must agree with active harmony
      if (strength !== "weak" && !chromatic && !tieIntoNext) {
        const chordTones = findChordTonesInRange(context, activeHarmonyForEvent, request.rightHand.range);
        const isChordTone = chordTones.some((ct) => ct.pitch.midi % 12 === pitch.midi % 12);
        if (!isChordTone && chordTones.length) {
          const nearest = chordTones.reduce((prev, curr) =>
            Math.abs(curr.pitch.midi - pitch.midi) < Math.abs(prev.pitch.midi - pitch.midi) ? curr : prev
          );
          pitch = { ...nearest.pitch };
          degree = { ...nearest.degree };
          noteRole = "chord tone";
        }
      }

      // In minor key dominant V, ensure scale degree 7 has leading tone alteration
      if (context.mode === "minor" && activeHarmonyForEvent.rootDegree.degree === 5 && degree.degree === 7 && degree.alteration !== 1) {
        degree.alteration = 1;
        pitch = pitchFromMidi(pitch.midi + 1, false);
      }

      // Range enforcement
      if (pitch.midi < request.rightHand.range.low || pitch.midi > request.rightHand.range.high) {
        const chordTones = findChordTonesInRange(context, activeHarmonyForEvent, request.rightHand.range);
        if (chordTones.length) {
          const nearest = chordTones.reduce((prev, curr) =>
            Math.abs(curr.pitch.midi - pitch.midi) < Math.abs(prev.pitch.midi - pitch.midi) ? curr : prev
          );
          pitch = { ...nearest.pitch };
          degree = { ...nearest.degree };
        }
      }

      // Tie handling
      const tieFromPrevious = !isSteady && tieIntoNext;
      if (tieFromPrevious && tiedPitch && tiedDegree) {
        pitch = tiedPitch;
        degree = { ...tiedDegree };
      }

      // Unison control (strict <= 2 unisons, or <= 3 in rhythm drill)
      if (!tieFromPrevious && !isFinalNote) {
        if (previousPitch !== undefined && pitch.midi === previousPitch.midi) {
          consecutiveUnisons++;
        } else {
          consecutiveUnisons = 0;
        }

        const maxUnisons = (request.emphasis === "rhythm" || activeGestureType === "repeatNote") ? 3 : 2;
        if (consecutiveUnisons >= maxUnisons) {
          const chordTones = findChordTonesInRange(context, activeHarmonyForEvent, request.rightHand.range)
            .filter((ct) => ct.pitch.midi !== pitch.midi);
          if (chordTones.length && strength !== "weak") {
            const nearest = chordTones.reduce((prev, curr) =>
              Math.abs(curr.pitch.midi - pitch.midi) < Math.abs(prev.pitch.midi - pitch.midi) ? curr : prev
            );
            pitch = { ...nearest.pitch };
            degree = { ...nearest.degree };
            noteRole = "chord tone";
            consecutiveUnisons = 0;
          } else {
            const stepOffset = pitch.midi + 2 <= request.rightHand.range.high ? 1 : -1;
            const rawStep = (degree.degree - 1) + (degree.octaveOffset * 7) + stepOffset;
            const stepped = realizeDiatonicStep(context, rawStep, activeHarmonyForEvent);
            if (stepped.pitch.midi >= request.rightHand.range.low && stepped.pitch.midi <= request.rightHand.range.high) {
              pitch = { ...stepped.pitch };
              degree = { ...stepped.degree };
              consecutiveUnisons = 0;
            }
          }
        }
      }

      const nextAtom = measureRhythm.atoms[index + 1];
      const tieToNext = !isSteady && !isFinalNote && Boolean(nextAtom && !nextAtom.rest) && (atom.tie || rng.next() < (request.rhythm.tieDensity ?? 0.05));

      const challengeTags: ChallengeType[] = [];
      if (chromatic) challengeTags.push("chromatic");
      if (previousPitch && Math.abs(pitch.midi - previousPitch.midi) >= 8) challengeTags.push("largeLeap");
      if (atom.syncopated) challengeTags.push("syncopation");

      const event: ExerciseEvent = {
        id: `rh-${m}-${index}`,
        onset,
        duration: atom.duration,
        pitches: [pitch],
        hand: "right",
        metadata: {
          scaleDegree: degree,
          harmonyId: activeHarmonyForEvent.id,
          phraseArchetypeId: options?.phrasePlan?.archetypeId ?? "phrase-archetype",
          phraseIndex: section.phraseIndex ?? 0,
          phraseRole: role,
          contourPhase: contour.phase,
          harmonicFunction: activeHarmonyForEvent.function,
          harmonicRhythmId: options?.harmonicRhythmId ?? "1/bar",
          cadenceType: isCadence ? cadencePlan.cadenceType : undefined,
          cadenceInstanceId: isCadence ? cadencePlan.id : undefined,
          anchorId: measureAnchor.id,
          motifId: section.label,
          motifTransformation: section.transformation,
          gestureType: activeGestureType,
          positionInGesture: index,
          rhythmCellId: measureRhythm.rhythmCellId,
          noteRole,
          chromaticRole,
          metricStrength: strength,
          challengeTags,
          chromatic: Boolean(chromatic),
          tieFromPrevious,
          tieToNext,
          intervalFromPrevious: tieFromPrevious || previousPitch === undefined ? undefined : pitch.midi - previousPitch.midi,
        },
      };

      events.push(event);

      tieIntoNext = tieToNext;
      if (tieToNext) {
        tiedPitch = pitch;
        tiedDegree = { ...degree };
      }

      if (!tieFromPrevious) {
        previousPitch = pitch;
        previousDegree = { ...degree };
        if (chromatic) accidentalsRemaining--;
      }

      onset += atom.duration;
    });
  }

  return events;
};
