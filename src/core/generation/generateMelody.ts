import type { ExerciseEvent, HarmonyEvent, Meter, PatternCategory, PatternTransformation, PhraseSection, Pitch, RightHandEmphasis, ScaleDegree, TonalContext } from "../model";
import type { Rng } from "../random/rng";
import type { TrainingRequest } from "../training/trainingIntent";
import { metricStrength, ticksPerMeasure } from "../music/meter";
import { findChordTonesInRange, MELODIC_PATTERNS, type GeneratedPatternNote, type MelodicPattern } from "../patterns/melodicPatterns";
import { cellsForMeter, type RhythmCell } from "../patterns/rhythmCells";
import { generateNotesForPattern } from "../patterns/patternGenerators";

type MotifPlan = {
  pattern: MelodicPattern;
  notes: GeneratedPatternNote[];
  cell: RhythmCell;
  instanceId: string;
};

const categoryWeights = (emphasis: RightHandEmphasis = "everything"): { category: PatternCategory; weight: number }[] => {
  const categories: PatternCategory[] = ["melodicPatterns", "intervals", "arpeggios", "cadencesApproaches", "rhythm"];

  return categories.map((cat) => {
    let weight = 1;
    if (emphasis === cat) weight = 6;
    return { category: cat, weight };
  });
};

const choosePatternForCategory = (category: PatternCategory, rng: Rng): MelodicPattern => {
  const pool = MELODIC_PATTERNS.filter((p) => p.category === category);
  return pool.length ? rng.pick(pool) : MELODIC_PATTERNS[0]!;
};

export const generateMelody = (
  context: TonalContext,
  meter: Meter,
  harmony: HarmonyEvent[],
  phrase: PhraseSection[],
  request: TrainingRequest,
  rng: Rng,
): ExerciseEvent[] => {
  const measureTicks = ticksPerMeasure(meter);
  let previousPitch: Pitch | undefined;
  let baseMotif: MotifPlan | undefined;
  let tieIntoNext = false;
  let tiedPitch: Pitch | undefined;
  let tiedDegree: ScaleDegree | undefined;
  let tiedRole: ExerciseEvent["metadata"]["noteRole"];
  let tiedChromatic = false;
  let tiedChromaticRole: string | undefined;
  let accidentalsRemaining = request.rightHand.maxAccidentalsPerExercise;

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

  const chooseCategory = (): PatternCategory => {
    const weights = categoryWeights(request.emphasis);
    return rng.weightedPick(weights.map((w) => ({ value: w.category, weight: w.weight })));
  };

  return phrase.flatMap((section, measure) => {
    const isCadence = section.label === "cadence";
    const isRelated = section.label === "A'" || section.label === "A''";
    const activeHarmony = harmony[measure]!;
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
      if (transformation === "exact" && baseMotif.notes.length === count) {
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
        if (transformation === "changedEnding" && notes.length >= 2) {
          const lastIdx = notes.length - 1;
          const prevNote = notes[lastIdx - 1]!;
          const chordTones = findChordTonesInRange(context, activeHarmony, request.rightHand.range);
          const best = chordTones.length
            ? chordTones.reduce((prev, curr) => Math.abs(curr.pitch.midi - prevNote.pitch.midi) < Math.abs(prev.pitch.midi - prevNote.pitch.midi) ? curr : prev)
            : prevNote;
          notes[lastIdx] = {
            ...notes[lastIdx]!,
            pitch: best.pitch,
            degree: { ...best.degree },
            role: "chord tone",
          };
        }
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

    const motif: MotifPlan = { pattern, notes, cell, instanceId };
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
            const bestTone = chordTones.reduce((prev, curr) => Math.abs(curr.pitch.midi - pitch.midi) < Math.abs(prev.pitch.midi - pitch.midi) ? curr : prev);
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

      let targetedJump = false;
      if (!tieFromPrevious && !rest && previousPitch !== undefined) {
        const jump = Math.abs(pitch.midi - previousPitch.midi);
        if (jump >= 8) targetedJump = true;
      }

      const nextAtom = cell.atoms[index + 1];
      const tieToNext = !exactRhythm && !rest && !finalCadence && Boolean(nextAtom && !nextAtom.rest) && (atom.tie || rng.next() < (request.rhythm.tieDensity ?? 0.05));

      const challengeTags: ExerciseEvent["metadata"]["challengeTags"] = [];
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
