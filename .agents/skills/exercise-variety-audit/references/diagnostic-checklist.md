# Generator Diagnostic Checklist: The 5 Traps

This checklist details the architectural and procedural pitfalls that commonly degrade musical variety in the generator.

---

## 1. Metric Strength Snapping Trap

### Symptom
- High percentage of unisons (`> 20%`) throughout the exercise in steady quarter-note practice.
- Passing tones and diatonic approach notes (e.g. scale degree 2 before 1) disappear and get replaced by chord tones (1 or 3).

### Root Cause
In meter classification (`src/core/music/meter.ts`), all beats in 4/4 were previously marked as `"strong"` or `"medium"`:
```ts
// BUGGY: In 4/4, every beat (1, 2, 3, 4) is strong or medium!
onsetInMeasure === 0 ? "strong" : onsetInMeasure % ticksPerBeat === 0 ? "medium" : "weak"
```
In `generateMelody.ts`, every non-weak beat was snapped to a chord tone of the active harmony:
```ts
if (!rest && strength !== "weak" && !chromatic) {
  // Snaps degree 2 on beat 2 or 4 to chord tone 1 or 3!
  pitch = nearestChordTone.pitch;
}
```

### Remedy
1. Follow standard music theory metric hierarchy:
   - In 4/4: Beat 1 is `"strong"`, Beat 3 is `"medium"`, Beats 2 and 4 are `"weak"`.
   - In 3/4: Beat 1 is `"strong"`, Beats 2 and 3 are `"weak"`.
2. Weak beats allow natural diatonic passing and neighbor motion without forced chord-tone snapping.
3. Chord-tone snapping on strong/medium beats preserves harmonic clarity without starving the line of melodic motion.

---

## 2. Grammar Length Clamping Trap

### Symptom
- The last measure (cadence bar) repeats the same static scale degree for beats 1, 2, and 3 (e.g., `3->3->1->1` or `2->2->2->1`).
- Long measures (8 eighth notes) generate long strings of identical pitches.

### Root Cause
Melodic cadence shapes in `src/core/generation/cadenceGrammar.ts` typically define 2 or 3 scale degrees (e.g., `[2, 1]`, `[7, 1]`). When a measure has 4 quarter notes or 8 eighth notes:
```ts
// BUGGY: Clamping Math.max(0, ...) assigns shape.degrees[0] to all earlier notes!
const distFromArrival = arrivalIndex - idx;
const degreeOffset = shape.degrees[Math.max(0, shape.degrees.length - 1 - distFromArrival)];
```
If `distFromArrival >= shape.degrees.length`, every prior beat receives `shape.degrees[0]` (e.g., `[2, 2, 2, 1]`).

### Remedy
1. **Enrich Grammar Shapes:** Provide 4- and 5-note shapes in `MELODIC_CADENCE_SHAPES` (scalar descents `[4, 3, 2, 1]`, `[5, 4, 3, 2, 1]`, ascents `[5, 6, 7, 1]`, cambiata `[3, 4, 2, 1]`, enclosures `[3, 1, 2, 1]`).
2. **Directional Pre-Shape Interpolation:** When notes precede the shape path (`distFromArrival >= shape.degrees.length`), smoothly step into `shape.degrees[0]` based on `shape.direction` instead of clamping to index 0:
```ts
const shapeIdx = shape.degrees.length - 1 - distFromArrival;
if (shapeIdx >= 0) {
  degreeOffset = shape.degrees[shapeIdx]!;
} else {
  const stepsBefore = -shapeIdx;
  const startDeg = shape.degrees[0]!;
  if (shape.direction === "descending") degreeOffset = startDeg + stepsBefore;
  else if (shape.direction === "ascending") degreeOffset = startDeg - stepsBefore;
  else degreeOffset = startDeg + (stepsBefore % 2 === 1 ? 1 : -1);
}
```

---

## 3. Gesture Tail Stalling Trap

### Symptom
- Melodic gestures in measures with 4 or 8 notes generate repeated unisons in the middle or end of the bar.

### Root Cause
In `src/core/generation/melodicGestures.ts`, gestures like `upperNeighbor`, `lowerNeighbor`, `enclosure`, and `fillIntervalStepwise` only defined the first 2 or 3 notes and looped the remaining notes on the root:
```ts
// BUGGY: i >= 2 produces identical baseStep repetitions!
notes.push(makeNote(baseStep, "chord tone"));
if (count > 1) notes.push(makeNote(baseStep + 1, "neighbor tone"));
for (let i = 2; i < count; i++) {
  notes.push(makeNote(baseStep, "chord tone"));
}
```

### Remedy
- Complete the ornamentation musically for multi-note gestures:
  - Upper neighbor turn: `[baseStep, baseStep + 1, baseStep, baseStep - 1]`
  - Lower neighbor turn: `[baseStep, baseStep - 1, baseStep, baseStep + 1]`
  - Multi-note enclosure: approach from above, step below, wrap around, resolve.
  - Stepwise fill: add passing or neighbor embellishments if `Math.abs(stepDiff) < count - 1` rather than rounding to the same step.

---

## 4. Post-Arrival Duplication Trap

### Symptom
- Almost every cadence bar ends in `...->1->1` (repeating the arrival note on the final beat).

### Root Cause
When the arrival lands earlier in the measure (e.g. beat 3 in 4/4):
```ts
// BUGGY: Unconditionally returns targetArrivalTone for all notes after arrival!
if (idx > arrivalIndex) {
  return { degree: targetArrivalTone.degree, pitch: targetArrivalTone.pitch, ... };
}
```

### Remedy
1. **Strong Tonic (PAC):** The arrival note lands on the final beat of the measure (`arrivalIndex = count - 1`), allowing the entire measure to build towards authentic resolution.
2. **Imperfect / Half Cadences:** When arrival is on beat 3, post-arrival notes resolve to harmonic completion chord tones (e.g. 3rd, 5th, or octave tonic) unless `cadencePlan.arrivalMetric === "earlyWithRepetition"`:
```ts
if (idx > arrivalIndex) {
  if (cadencePlan.cadenceType === "strongTonic" || cadencePlan.arrivalMetric === "earlyWithRepetition") {
    return targetArrivalTone;
  }
  const chordTones = findChordTonesInRange(context, finalHarmony, request.rightHand.range);
  const otherTones = chordTones.filter((ct) => ct.pitch.midi !== targetArrivalTone.pitch.midi);
  return otherTones.length ? nearestOther(otherTones) : targetArrivalTone;
}
```

---

## 5. Unison Filter Loopholes

### Symptom
- Pre-cadence notes repeat the arrival note pitch, destroying melodic resolution momentum.

### Root Cause
Unison control logic in `generateMelody.ts` allowed duplicate notes because:
1. `maxUnisons = 2` allowed two consecutive repetitions (three identical notes).
2. The pre-cadence disambiguation guard required `consecutiveUnisons >= 1`. If the penultimate note was the first repetition of the cadence tone, `consecutiveUnisons` was 0, bypassing the check.
3. Unison control skipped `isFinalNote`, allowing the final note to repeat the penultimate note unchecked.

### Remedy
- Set `maxUnisons = 1` for steady melody practice unless the user explicitly requested a `"rhythm"` drill.
- Disambiguate pre-cadence notes unconditionally whenever `pitch.midi === cadenceAnchor.pitch.midi`, ensuring the arrival always has incoming melodic motion.
