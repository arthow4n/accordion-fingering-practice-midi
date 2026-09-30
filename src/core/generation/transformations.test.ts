import { describe, expect, it } from "vitest";
import { createRng } from "../random/rng";
import { applyMotifTransformation, storeMotif } from "./motifMemory";
import type { HarmonyEvent, PatternTransformation, PitchRange, TonalContext } from "../model";
import type { GeneratedPatternNote } from "../patterns/melodicPatterns";
import type { RhythmAtom } from "./rhythmGrammar";

describe("motif transformations", () => {
  const context: TonalContext = { tonic: "C", mode: "major" };
  const range: PitchRange = { low: 60, high: 84 };
  const harmony: HarmonyEvent = {
    id: "h-0",
    onset: 0,
    duration: 1920,
    rootDegree: { degree: 1, alteration: 0, octaveOffset: 1 },
    quality: "major",
    function: "tonic",
    symbol: "I",
  };

  // Centered around C5 (midi 72) well within range 60..84
  const sampleNotes: GeneratedPatternNote[] = [
    { degree: { degree: 1, alteration: 0, octaveOffset: 1 }, pitch: { midi: 72, name: "C5" }, role: "chord tone", chromatic: false },
    { degree: { degree: 2, alteration: 0, octaveOffset: 1 }, pitch: { midi: 74, name: "D5" }, role: "passing tone", chromatic: false },
    { degree: { degree: 3, alteration: 0, octaveOffset: 1 }, pitch: { midi: 76, name: "E5" }, role: "chord tone", chromatic: false },
    { degree: { degree: 4, alteration: 0, octaveOffset: 1 }, pitch: { midi: 77, name: "F5" }, role: "passing tone", chromatic: false },
  ];

  const sampleRhythm: RhythmAtom[] = [
    { duration: 480 },
    { duration: 480 },
    { duration: 480 },
    { duration: 480 },
  ];

  const baseMotif = storeMotif(
    "base",
    sampleNotes,
    sampleRhythm,
    [{ type: "stepUpward", notes: sampleNotes }],
    { degree: 1, alteration: 0, octaveOffset: 1 }
  );

  const transformations: PatternTransformation[] = [
    "exact",
    "sequenceUp",
    "sequenceDown",
    "newStart",
    "newPitches",
    "changedEnding",
    "shortened",
    "extended",
    "continuation",
    "rhythmicVariation",
  ];

  it("implements distinct transformations with measurable structural outcomes", () => {
    const outcomes = new Map<PatternTransformation, { midiSequence: number[]; durations: number[] }>();

    for (const trans of transformations) {
      const rng = createRng(42);
      const result = applyMotifTransformation(baseMotif, trans, context, harmony, range, rng);
      outcomes.set(trans, {
        midiSequence: result.notes.map((n) => n.pitch.midi),
        durations: result.rhythm.map((r) => r.duration),
      });
    }

    // Exact preserves original pitches
    expect(outcomes.get("exact")!.midiSequence).toEqual([72, 74, 76, 77]);

    // SequenceUp shifts pitches upward
    const seqUp = outcomes.get("sequenceUp")!.midiSequence;
    expect(seqUp[0]).toBeGreaterThan(72);

    // SequenceDown shifts pitches downward
    const seqDown = outcomes.get("sequenceDown")!.midiSequence;
    expect(seqDown[0]).toBeLessThan(72);

    // NewStart shifts starting degree
    const newStart = outcomes.get("newStart")!.midiSequence;
    expect(newStart[0]).not.toBe(72);

    // ChangedEnding preserves opening note but alters ending note
    const changedEnd = outcomes.get("changedEnding")!.midiSequence;
    expect(changedEnd[0]).toBe(72);
    expect(changedEnd.at(-1)).not.toBe(77);

    // Shortened has fewer notes or modified rhythm
    const shortened = outcomes.get("shortened")!;
    expect(shortened.midiSequence.length).toBeLessThan(sampleNotes.length);

    // Extended has more notes or split durations
    const extended = outcomes.get("extended")!;
    expect(extended.midiSequence.length).toBeGreaterThan(sampleNotes.length);

    // Continuation develops trajectory forward
    const cont = outcomes.get("continuation")!.midiSequence;
    expect(cont[0]).toBeGreaterThan(72);

    // Verify all transformations produce diverse outcomes
    const uniqueMidiSignatures = new Set([...outcomes.values()].map((o) => o.midiSequence.join(",")));
    expect(uniqueMidiSignatures.size).toBeGreaterThanOrEqual(8);
  });
});
