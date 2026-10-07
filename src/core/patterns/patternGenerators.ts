import type { HarmonyEvent, NoteRole, Pitch, PitchRange, ScaleDegree, TonalContext } from "../model";
import { pitchFromMidi } from "../music/pitch";
import type { Rng } from "../random/rng";
import { findChordTonesInRange, realizeDiatonicStep, type GeneratedPatternNote, type MelodicPattern } from "./melodicPatterns";

export const fitNotesToRange = (notes: GeneratedPatternNote[], range: PitchRange, context: TonalContext): GeneratedPatternNote[] | undefined => {
  if (!notes.length) return notes;
  const minMidi = Math.min(...notes.map((n) => n.pitch.midi));
  const maxMidi = Math.max(...notes.map((n) => n.pitch.midi));
  const span = maxMidi - minMidi;
  const rangeSpan = range.high - range.low;

  if (span > rangeSpan) return undefined;

  if (minMidi >= range.low && maxMidi <= range.high) {
    return notes;
  }

  // Find octave shift (multiple of 12 semitones)
  let bestShift = 0;
  let fits = false;
  for (let shift = -36; shift <= 36; shift += 12) {
    if (minMidi + shift >= range.low && maxMidi + shift <= range.high) {
      bestShift = shift;
      fits = true;
      break;
    }
  }

  if (!fits) return undefined;

  const octShift = bestShift / 12;
  const preferFlats = context.tonic.includes("b");
  return notes.map((n) => {
    const newMidi = n.pitch.midi + bestShift;
    const newPitch = pitchFromMidi(newMidi, preferFlats);
    const newDegree: ScaleDegree = {
      ...n.degree,
      octaveOffset: n.degree.octaveOffset + octShift,
    };
    return {
      ...n,
      pitch: newPitch,
      degree: newDegree,
    };
  });
};


const createDiatonicNote = (context: TonalContext, step: number, role: NoteRole, activeHarmony?: HarmonyEvent, alteration = 0): GeneratedPatternNote => {
  const { degree, pitch } = realizeDiatonicStep(context, step, activeHarmony, alteration);
  return { degree, pitch, role, chromatic: false };
};

const createChromaticNote = (context: TonalContext, baseStep: number, semitoneOffset: number, role: NoteRole, chromaticRole: string, activeHarmony?: HarmonyEvent): GeneratedPatternNote => {
  const base = createDiatonicNote(context, baseStep, role, activeHarmony);
  const preferFlats = context.tonic.includes("b");
  const pitch = pitchFromMidi(base.pitch.midi + semitoneOffset, preferFlats);
  const degree: ScaleDegree = {
    ...base.degree,
    alteration: semitoneOffset as ScaleDegree["alteration"],
  };
  return {
    degree,
    pitch,
    role,
    chromatic: true,
    chromaticRole,
  };
};

export const generateNotesForPattern = (
  pattern: MelodicPattern,
  context: TonalContext,
  activeHarmony: HarmonyEvent,
  count: number,
  range: PitchRange,
  rng: Rng,
  previousPitch: Pitch | undefined,
  accidentalsBudget: number,
  isCadence: boolean,
  stepOffset = 0,
): GeneratedPatternNote[] => {
  const isMinor = context.mode === "minor";

  const targetMidi = previousPitch && previousPitch.midi >= range.low && previousPitch.midi <= range.high
    ? previousPitch.midi
    : Math.round((range.low + range.high) / 2);

  const rootDeg = activeHarmony.rootDegree.degree - 1;
  const root4Midi = realizeDiatonicStep(context, rootDeg, activeHarmony).pitch.midi;
  const oct = Math.round((targetMidi - root4Midi) / 12);
  const baseStep = rootDeg + (oct * 7) + stepOffset;

  // 1. Cadences (for phrase ending)
  if (isCadence || pattern.category === "cadencesApproaches" && pattern.id.startsWith("cadence-")) {
    let formula: number[];
    let formulaRoles: NoteRole[];
    let formulaAlts: number[] = [0, 0];

    switch (pattern.id) {
      case "cadence-7-1":
        formula = [6, 7];
        formulaRoles = ["leading tone", "cadence tone"];
        formulaAlts = [isMinor ? 1 : 0, 0];
        break;
      case "cadence-2-1":
        formula = [1, 0];
        formulaRoles = ["cadence tone", "cadence tone"];
        break;
      case "cadence-4-3":
        formula = [3, 2];
        formulaRoles = ["cadence tone", "cadence tone"];
        break;
      case "cadence-2-7-1":
        formula = [1, -1, 0];
        formulaRoles = ["cadence tone", "leading tone", "cadence tone"];
        formulaAlts = [0, isMinor ? 1 : 0, 0];
        break;
      case "cadence-5-4-3":
        formula = [4, 3, 2];
        formulaRoles = ["cadence tone", "cadence tone", "cadence tone"];
        break;
      case "cadence-3-2-1":
      default:
        formula = [2, 1, 0];
        formulaRoles = ["cadence tone", "cadence tone", "cadence tone"];
        break;
    }

    const formulaLen = formula.length;
    const preambleLen = Math.max(0, count - formulaLen);
    const notes: GeneratedPatternNote[] = [];

    // Preamble: stepwise approach to formula[0]
    for (let i = 0; i < preambleLen; i++) {
      const pStep = formula[0]! + (preambleLen - i);
      notes.push(createDiatonicNote(context, baseStep + pStep, "scale tone", activeHarmony));
    }

    // Formula notes
    for (let i = 0; i < formulaLen; i++) {
      const step = formula[i]!;
      const role = formulaRoles[i]!;
      const alt = formulaAlts[i] ?? 0;
      notes.push(createDiatonicNote(context, baseStep + step, role, activeHarmony, alt));
    }

    const fitted = fitNotesToRange(notes, range, context);
    if (fitted) return fitted;
  }

  // 2. Chord-tone patterns and arpeggios
  if (pattern.category === "arpeggios") {
    const chordTones = findChordTonesInRange(context, activeHarmony, range);
    if (chordTones.length >= 3) {
      let startIndex = 0;
      if (previousPitch) {
        // Voice leading: find nearest chord tone
        let bestDist = Infinity;
        for (let i = 0; i < chordTones.length; i++) {
          const dist = Math.abs(chordTones[i]!.pitch.midi - previousPitch.midi);
          if (dist < bestDist) {
            bestDist = dist;
            startIndex = i;
          }
        }
      } else {
        startIndex = Math.min(chordTones.length - 1, rng.integer(0, Math.max(0, chordTones.length - 4)));
      }

      const notes: GeneratedPatternNote[] = [];
      let isDescending = pattern.id.includes("down") || pattern.id.includes("desc");
      let idx = startIndex;

      if (pattern.id === "chord-tone-1-3-5" || pattern.id === "arpeggio-1-3-5") {
        for (let i = 0; i < count; i++) {
          notes.push({ ...chordTones[(startIndex + (i % 3)) % chordTones.length]!, role: "chord tone" });
        }
      } else if (pattern.id === "chord-tone-1-3-5-3" || pattern.id === "arpeggio-1-3-5-3") {
        const shape = [0, 1, 2, 1];
        for (let i = 0; i < count; i++) {
          notes.push({ ...chordTones[(startIndex + shape[i % 4]!) % chordTones.length]!, role: "chord tone" });
        }
      } else if (pattern.id === "chord-tone-1-5-3-5" || pattern.id === "arpeggio-1-5-3-5") {
        const shape = [0, 2, 1, 2];
        for (let i = 0; i < count; i++) {
          notes.push({ ...chordTones[(startIndex + shape[i % 4]!) % chordTones.length]!, role: "chord tone" });
        }
      } else if (pattern.id === "chord-tone-3-5-1") {
        const shape = [1, 2, 0];
        for (let i = 0; i < count; i++) {
          notes.push({ ...chordTones[(startIndex + shape[i % 3]!) % chordTones.length]!, role: "chord tone" });
        }
      } else if (pattern.id === "chord-tone-5-3-1") {
        const shape = [2, 1, 0];
        for (let i = 0; i < count; i++) {
          notes.push({ ...chordTones[(startIndex + shape[i % 3]!) % chordTones.length]!, role: "chord tone" });
        }
      } else if (pattern.id === "chord-tone-1-3-5-8" || pattern.id === "arpeggio-1-3-5-8") {
        const shape = [0, 1, 2, 3];
        for (let i = 0; i < count; i++) {
          notes.push({ ...chordTones[(startIndex + shape[i % 4]!) % chordTones.length]!, role: "chord tone" });
        }
      } else if (pattern.id === "chord-tone-3-5-1-3") {
        const shape = [1, 2, 3, 1];
        for (let i = 0; i < count; i++) {
          notes.push({ ...chordTones[(startIndex + shape[i % 4]!) % chordTones.length]!, role: "chord tone" });
        }
      } else if (pattern.id === "chord-tone-5-1-3-5") {
        const shape = [2, 3, 4, 2];
        for (let i = 0; i < count; i++) {
          notes.push({ ...chordTones[(startIndex + shape[i % 4]!) % chordTones.length]!, role: "chord tone" });
        }
      } else if (pattern.id === "arpeggio-1-5-8-5") {
        const shape = [0, 2, 3, 2];
        for (let i = 0; i < count; i++) {
          notes.push({ ...chordTones[(startIndex + shape[i % 4]!) % chordTones.length]!, role: "chord tone" });
        }
      } else if (pattern.id === "arpeggio-1-3-5-8-5-3") {
        const shape = [0, 1, 2, 3, 2, 1];
        for (let i = 0; i < count; i++) {
          notes.push({ ...chordTones[(startIndex + shape[i % 6]!) % chordTones.length]!, role: "chord tone" });
        }
      } else if (pattern.id === "arpeggio-triad-up-down" || pattern.id === "arpeggio-triad-down-up") {
        const peak = Math.min(chordTones.length - 1, startIndex + Math.floor(count / 2));
        for (let i = 0; i < count; i++) {
          const cIndex = i <= count / 2 ? Math.min(peak, startIndex + i) : Math.max(0, peak - (i - Math.floor(count / 2)));
          notes.push({ ...chordTones[cIndex % chordTones.length]!, role: "chord tone" });
        }
      } else {
        // Continuous ascending or descending arpeggio
        for (let i = 0; i < count; i++) {
          notes.push({ ...chordTones[idx]!, role: "chord tone" });
          if (isDescending) {
            if (idx > 0) idx--;
            else { idx++; isDescending = false; }
          } else {
            if (idx < chordTones.length - 1) idx++;
            else { idx--; isDescending = true; }
          }
        }
      }

      if (notes.length) {
        const fitted = fitNotesToRange(notes, range, context);
        if (fitted) return fitted;
      }
    }
  }

  // 3. Passing, neighbor & chromatic approaches
  if (pattern.category === "cadencesApproaches") {
    const notes: GeneratedPatternNote[] = [];
    const targetStep = baseStep;

    switch (pattern.id) {
      case "upper-neighbor":
        for (let i = 0; i < count; i++) {
          const isNeighbor = i % 2 === 1;
          notes.push(createDiatonicNote(context, targetStep + (isNeighbor ? 1 : 0), isNeighbor ? "neighbor tone" : "chord tone", activeHarmony));
        }
        break;
      case "lower-neighbor":
        for (let i = 0; i < count; i++) {
          const isNeighbor = i % 2 === 1;
          notes.push(createDiatonicNote(context, targetStep - (isNeighbor ? 1 : 0), isNeighbor ? "neighbor tone" : "chord tone", activeHarmony));
        }
        break;
      case "double-neighbor":
        for (let i = 0; i < count; i++) {
          const off = i % 4 === 0 ? 0 : i % 4 === 1 ? 1 : i % 4 === 2 ? -1 : 0;
          const role = off === 0 ? "chord tone" : "neighbor tone";
          notes.push(createDiatonicNote(context, targetStep + off, role, activeHarmony));
        }
        break;
      case "ascending-passing":
        for (let i = 0; i < count; i++) {
          const step = targetStep + (i % 3);
          const role = i % 3 === 1 ? "passing tone" : "chord tone";
          notes.push(createDiatonicNote(context, step, role, activeHarmony));
        }
        break;
      case "descending-passing":
        for (let i = 0; i < count; i++) {
          const step = targetStep + 2 - (i % 3);
          const role = i % 3 === 1 ? "passing tone" : "chord tone";
          notes.push(createDiatonicNote(context, step, role, activeHarmony));
        }
        break;
      case "chromatic-passing":
        if (accidentalsBudget > 0) {
          notes.push(createDiatonicNote(context, targetStep, "chord tone", activeHarmony));
          notes.push(createChromaticNote(context, targetStep, 1, "passing tone", "chromaticPassing", activeHarmony));
          notes.push(createDiatonicNote(context, targetStep + 1, "chord tone", activeHarmony));
          while (notes.length < count) {
            notes.push(createDiatonicNote(context, targetStep + (notes.length % 2), "scale tone", activeHarmony));
          }
        }
        break;
      case "lower-chromatic-approach":
        if (accidentalsBudget > 0) {
          const preambleLen = Math.max(0, count - 2);
          for (let i = 0; i < preambleLen; i++) {
            notes.push(createDiatonicNote(context, targetStep - (preambleLen + 1 - i), "scale tone", activeHarmony));
          }
          notes.push(createChromaticNote(context, targetStep, -1, "chromatic approach", "lowerChromaticApproach", activeHarmony));
          notes.push(createDiatonicNote(context, targetStep, "chord tone", activeHarmony));
        }
        break;
      case "upper-chromatic-approach":
        if (accidentalsBudget > 0) {
          const preambleLen = Math.max(0, count - 2);
          for (let i = 0; i < preambleLen; i++) {
            notes.push(createDiatonicNote(context, targetStep + (preambleLen + 1 - i), "scale tone", activeHarmony));
          }
          notes.push(createChromaticNote(context, targetStep, 1, "chromatic approach", "upperChromaticApproach", activeHarmony));
          notes.push(createDiatonicNote(context, targetStep, "chord tone", activeHarmony));
        }
        break;
      case "upper-lower-enclosure":
        if (accidentalsBudget >= 2) {
          const preambleLen = Math.max(0, count - 3);
          for (let i = 0; i < preambleLen; i++) {
            notes.push(createDiatonicNote(context, targetStep + (preambleLen - i), "scale tone", activeHarmony));
          }
          notes.push(createChromaticNote(context, targetStep, 1, "chromatic approach", "upperLowerEnclosure", activeHarmony));
          notes.push(createChromaticNote(context, targetStep, -1, "chromatic approach", "upperLowerEnclosure", activeHarmony));
          notes.push(createDiatonicNote(context, targetStep, "chord tone", activeHarmony));
        }
        break;
      case "lower-upper-enclosure":
        if (accidentalsBudget >= 2) {
          const preambleLen = Math.max(0, count - 3);
          for (let i = 0; i < preambleLen; i++) {
            notes.push(createDiatonicNote(context, targetStep - (preambleLen - i), "scale tone", activeHarmony));
          }
          notes.push(createChromaticNote(context, targetStep, -1, "chromatic approach", "lowerUpperEnclosure", activeHarmony));
          notes.push(createChromaticNote(context, targetStep, 1, "chromatic approach", "lowerUpperEnclosure", activeHarmony));
          notes.push(createDiatonicNote(context, targetStep, "chord tone", activeHarmony));
        }
        break;
      case "leading-tone-to-tonic": {
        const preambleLen = Math.max(0, count - 2);
        for (let i = 0; i < preambleLen; i++) {
          notes.push(createDiatonicNote(context, baseStep + 5 - (preambleLen - 1 - i), "scale tone", activeHarmony));
        }
        notes.push(createDiatonicNote(context, baseStep + 6, "leading tone", activeHarmony, isMinor ? 1 : 0));
        notes.push(createDiatonicNote(context, baseStep + 7, "cadence tone", activeHarmony));
        break;
      }
      case "chromatic-neighbor":
        if (accidentalsBudget > 0) {
          const preambleLen = Math.max(0, count - 3);
          for (let i = 0; i < preambleLen; i++) {
            notes.push(createDiatonicNote(context, targetStep - (preambleLen - i), "scale tone", activeHarmony));
          }
          notes.push(createDiatonicNote(context, targetStep, "chord tone", activeHarmony));
          notes.push(createChromaticNote(context, targetStep, 1, "neighbor tone", "chromaticNeighbor", activeHarmony));
          notes.push(createDiatonicNote(context, targetStep, "chord tone", activeHarmony));
        }
        break;
    }

    if (notes.length >= count) {
      const truncated = notes.slice(0, count);
      const fitted = fitNotesToRange(truncated, range, context);
      if (fitted) return fitted;
    }
  }

  // 4. Repeated notes (rhythm category)
  if (pattern.category === "rhythm" || pattern.id.startsWith("repeated-")) {
    const notes: GeneratedPatternNote[] = [];
    if (pattern.id === "repeated-notes-embedded") {
      // Step, repeats, step
      notes.push(createDiatonicNote(context, baseStep, "scale tone", activeHarmony));
      const repeatStep = baseStep + 1;
      for (let i = 1; i < count - 1; i++) {
        notes.push(createDiatonicNote(context, repeatStep, i === 1 ? "scale tone" : "repeated tone", activeHarmony));
      }
      notes.push(createDiatonicNote(context, baseStep + 2, "scale tone", activeHarmony));
    } else if (pattern.id === "repeated-notes-short") {
      // Repeated pairs (e.g. 0, 0, 1, 1, 2, 2...)
      for (let i = 0; i < count; i++) {
        const step = baseStep + Math.floor(i / 2);
        notes.push(createDiatonicNote(context, step, i % 2 === 0 ? "scale tone" : "repeated tone", activeHarmony));
      }
    } else if (pattern.id === "repeated-notes-medium") {
      // Groups of 3 (e.g. 0, 0, 0, 1, 1, 1...)
      for (let i = 0; i < count; i++) {
        const step = baseStep + Math.floor(i / 3);
        notes.push(createDiatonicNote(context, step, i % 3 === 0 ? "scale tone" : "repeated tone", activeHarmony));
      }
    } else {
      // Direct repetition capped at at most 3 notes before shifting
      const repeatLimit = Math.min(3, count);
      for (let i = 0; i < count; i++) {
        const step = i < repeatLimit ? baseStep : baseStep + 1 + Math.floor((i - repeatLimit) / 2);
        notes.push(createDiatonicNote(context, step, i === 0 || i === repeatLimit ? "scale tone" : "repeated tone", activeHarmony));
      }
    }
    const fitted = fitNotesToRange(notes, range, context);
    if (fitted) return fitted;
  }

  // 5. Melodic intervals
  if (pattern.category === "intervals") {
    const rangeSpan = range.high - range.low;
    let leap: number;
    if (pattern.id.includes("octave")) {
      leap = rangeSpan >= 12 ? 7 : Math.max(2, Math.floor(rangeSpan / 2));
    } else {
      const maxLeap = Math.max(2, Math.min(5, Math.floor(rangeSpan / 3)));
      const leapOptions = [2, 3, 4, 5].filter((l) => l <= maxLeap);
      leap = rng.pick(leapOptions.length ? leapOptions : [2]);
    }

    const notes: GeneratedPatternNote[] = [];
    if (pattern.id === "interval-repeated-figure") {
      for (let i = 0; i < count; i++) {
        const step = i % 2 === 0 ? baseStep : baseStep + leap;
        notes.push(createDiatonicNote(context, step, "scale tone", activeHarmony));
      }
    } else if (pattern.id === "interval-leap-and-recovery") {
      for (let i = 0; i < count; i++) {
        const mod = i % 4;
        const step = mod === 0 ? baseStep : mod === 1 ? baseStep + leap : mod === 2 ? baseStep + leap - 1 : baseStep + leap - 2;
        notes.push(createDiatonicNote(context, step, "scale tone", activeHarmony));
      }
    } else if (pattern.id === "interval-step-then-leap") {
      for (let i = 0; i < count; i++) {
        const mod = i % 4;
        const step = mod === 0 ? baseStep : mod === 1 ? baseStep + 1 : mod === 2 ? baseStep + 2 : baseStep + 2 + leap;
        notes.push(createDiatonicNote(context, step, "scale tone", activeHarmony));
      }
    } else if (pattern.id === "interval-alternating-chain") {
      for (let i = 0; i < count; i++) {
        const pair = Math.floor(i / 2);
        const step = i % 2 === 0 ? baseStep + pair : baseStep + pair + leap;
        notes.push(createDiatonicNote(context, step, "scale tone", activeHarmony));
      }
    } else if (pattern.id === "interval-descending-chain") {
      for (let i = 0; i < count; i++) {
        const pair = Math.floor(i / 2);
        const step = i % 2 === 0 ? baseStep - pair : baseStep - pair - leap;
        notes.push(createDiatonicNote(context, step, "scale tone", activeHarmony));
      }
    } else {
      // Ascending chain
      for (let i = 0; i < count; i++) {
        const pair = Math.floor(i / 2);
        const step = i % 2 === 0 ? baseStep + pair : baseStep + pair + leap;
        notes.push(createDiatonicNote(context, step, "scale tone", activeHarmony));
      }
    }

    const fitted = fitNotesToRange(notes, range, context);
    if (fitted) return fitted;
  }

  // 6. Scales and Sequences (default / fallback)
  const notes: GeneratedPatternNote[] = [];
  for (let i = 0; i < count; i++) {
    let step: number;
    switch (pattern.id) {
      case "scale-descending":
        step = baseStep - i;
        break;
      case "scale-asc-desc": {
        const peak = Math.floor(count / 2);
        step = i <= peak ? baseStep + i : baseStep + peak - (i - peak);
        break;
      }
      case "scale-desc-asc": {
        const valley = Math.floor(count / 2);
        step = i <= valley ? baseStep - i : baseStep - valley + (i - valley);
        break;
      }
      case "scale-groups-3-up":
        step = baseStep + Math.floor(i / 3) + (i % 3);
        break;
      case "scale-groups-3-down":
        step = baseStep - Math.floor(i / 3) - (i % 3);
        break;
      case "scale-groups-4-up":
        step = baseStep + Math.floor(i / 4) + (i % 4);
        break;
      case "scale-groups-4-down":
        step = baseStep - Math.floor(i / 4) - (i % 4);
        break;
      case "sequence-1-2-3-1":
        step = baseStep + Math.floor(i / 4) + [0, 1, 2, 0][i % 4]!;
        break;
      case "sequence-1-2-3-5":
        step = baseStep + Math.floor(i / 4) + [0, 1, 2, 4][i % 4]!;
        break;
      case "sequence-1-3-2-4":
        step = baseStep + Math.floor(i / 4) + [0, 2, 1, 3][i % 4]!;
        break;
      case "continuous-thirds-up":
        step = i % 2 === 0 ? baseStep + Math.floor(i / 2) : baseStep + Math.floor(i / 2) + 2;
        break;
      case "continuous-thirds-down":
        step = i % 2 === 0 ? baseStep - Math.floor(i / 2) : baseStep - Math.floor(i / 2) - 2;
        break;
      case "continuous-fourths-up":
        step = i % 2 === 0 ? baseStep + Math.floor(i / 2) : baseStep + Math.floor(i / 2) + 3;
        break;
      case "continuous-fourths-down":
        step = i % 2 === 0 ? baseStep - Math.floor(i / 2) : baseStep - Math.floor(i / 2) - 3;
        break;
      case "continuous-fifths-up":
        step = i % 2 === 0 ? baseStep + Math.floor(i / 2) : baseStep + Math.floor(i / 2) + 4;
        break;
      case "continuous-fifths-down":
        step = i % 2 === 0 ? baseStep - Math.floor(i / 2) : baseStep - Math.floor(i / 2) - 4;
        break;
      case "continuous-sixths-up":
        step = i % 2 === 0 ? baseStep + Math.floor(i / 2) : baseStep + Math.floor(i / 2) + 5;
        break;
      case "continuous-sixths-down":
        step = i % 2 === 0 ? baseStep - Math.floor(i / 2) : baseStep - Math.floor(i / 2) - 5;
        break;
      case "octave-scale-run":
      case "scale-ascending":
      default:
        step = baseStep + i;
        break;
    }
    notes.push(createDiatonicNote(context, step, "scale tone", activeHarmony));
  }

  const fitted = fitNotesToRange(notes, range, context);
  if (fitted) return fitted;

  // If directional pattern didn't fit, try opposite direction
  if (notes.length) {
    const reversedNotes: GeneratedPatternNote[] = [];
    for (let i = 0; i < count; i++) {
      reversedNotes.push(createDiatonicNote(context, baseStep - i, "scale tone", activeHarmony));
    }
    const revFitted = fitNotesToRange(reversedNotes, range, context);
    if (revFitted) return revFitted;
  }

  // Absolute safety fallback: stepwise arch around a valid pitch
  const safeNotes: GeneratedPatternNote[] = [];
  const safeArch = [0, 1, 2, 1, 0, -1, 0, 1];
  for (let i = 0; i < count; i++) {
    safeNotes.push(createDiatonicNote(context, baseStep + safeArch[i % safeArch.length]!, "scale tone", activeHarmony));
  }
  const safeFitted = fitNotesToRange(safeNotes, range, context);
  if (safeFitted) return safeFitted;

  const fallbackChordTones = findChordTonesInRange(context, activeHarmony, range);
  if (fallbackChordTones.length) {
    const midTone = fallbackChordTones[Math.floor(fallbackChordTones.length / 2)]!;
    const safeBaseStep = (midTone.degree.degree - 1) + (midTone.degree.octaveOffset * 7);
    const inRangeSafeNotes: GeneratedPatternNote[] = [];
    for (let i = 0; i < count; i++) {
      const step = safeBaseStep + safeArch[i % safeArch.length]!;
      const note = createDiatonicNote(context, step, "scale tone", activeHarmony);
      if (note.pitch.midi >= range.low && note.pitch.midi <= range.high) {
        inRangeSafeNotes.push(note);
      } else {
        inRangeSafeNotes.push({ ...midTone, role: "scale tone" });
      }
    }
    return inRangeSafeNotes;
  }

  return safeNotes;
};
