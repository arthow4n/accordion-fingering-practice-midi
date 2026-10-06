# Lessons Learned & Historical Case Studies

This document records historical distribution issues, diagnosed causes, resolved solutions, and architectural invariants learned in this repository.

---

## Case Study 1: Steady Rhythm Cadence Collapse & Unison Flooding

### Date: 2026-10-06
### Problem
The user noticed that sight-reading practice in steady rhythm (`rhythm.style === "steady"`) felt formulaic and monotonous, especially in the final cadence measure.

### Empirical Findings (200 Seeds)
- **Overall Unisons (`+0` semitones):** 28.0% in quarter notes (672 notes), 22.4% in eighth notes (1256 notes).
- **Dominant Cadence Sequence:** `3->3->1->1` appeared in **33.0%** of all exercises. In eighth notes, `3->3->2->3->3->2->2->1` appeared in 17.5%.
- **Flat Contours:** 40.0% of cadence measures were completely flat due to repeated unisons.

### Root Causes
1. **Metric Strength Snapping:** In 4/4 meter, beats 1, 2, 3, and 4 were all classified as strong or medium. Snapping non-weak beats to chord tones forcibly turned passing/approach notes on beats 2 and 4 (such as degree 2 before tonic 1) into chord tones (1 or 3), creating runs of identical notes.
2. **Grammar Length Clamping:** 2-note shapes like `[2, 1]` clamped beats 1, 2, and 3 to degree 2 in 4-beat measures (`Math.max(0, ...)`), which the chord-tone enforcer then flattened into `3->3->1->1`.
3. **Gesture Tail Stalling:** Melodic gestures (`upperNeighbor`, `enclosure`) padded extra notes with identical base steps.

### Resolution
- Metric strength corrected: 4/4 Beat 1 is strong, Beat 3 is medium, Beats 2 and 4 are weak.
- Added 4- and 5-note cadence shapes in `cadenceGrammar.ts`.
- Replaced index clamping with directional pre-shape interpolation.
- Refined multi-note gestures into complete turns and smooth fills.

### Outcome
- Unisons dropped from **28.0% to 3.1%** in quarter notes, and **22.4% to 1.4%** in eighth notes.
- `3->3->1->1` dropped from **33.0% to 0%**, replaced by diverse moving lines (`3->2->1->1`, `3->2->1->3`, `3->2->7->1`, `1->3->2->1`, etc.).
- Upward contours increased from 7.5% to 27.5% (quarters) and 44.5% (eighths).

---

## Case Study 2: Strong Tonic (PAC) soprano Rule & Test Invariants

### Problem
After adding post-arrival chord tone completion (resolving beat 4 to degree 3 or 5 when arrival landed on beat 3), `cadenceArrival.test.ts` failed with:
`AssertionError: expected 3 to be 1`

### Root Cause
In classical music theory and in the repository's invariants (`expectCadenceClosure`):
- A **Strong Tonic Cadence** (Perfect Authentic Cadence, PAC) requires the soprano/right-hand melody to resolve to **scale degree 1** on the final tonic closure.
- Imperfect Authentic Cadences (IAC / weakTonic) may resolve to degrees 3 or 5, but `strongTonic` must strictly close on 1.

### Lesson Learned
- For `strongTonic` cadences, the resolution to scale degree 1 must be preserved on the final note of the phrase.
- Mid-bar arrival with varied completion tones (3 or 5) is musically appropriate for `weakTonic`, `plagal`, or open cadences, but never for `strongTonic`.

---

## Case Study 3: Deterministic RNG State & RNG Warmup Invariants

### Problem
An attempt to add an RNG warmup (`state.next()` calls to discard initial linear congruential state in `createRng()`) broke deterministic regression tests (`minorLeadingTone.test.ts`, `targetedHarmony.test.ts`).

### Root Cause
Regression tests assert exact deterministic harmonic progressions and note layouts for specific numeric seeds (e.g., `seed = 73`, `seed = 12`). Modifying the RNG stream shifts the seed sequence globally across all generators.

### Lesson Learned
- **Never modify the initial RNG step sequence** in `src/core/random/rng.ts`.
- All generator improvements must preserve determinism: identical request + seed = identical exercise.
- Avoid introducing unseeded randomness; always use the injected `Rng`.

---

## Case Study 4: Defensive Octave Clamping in Diatonic Step Realization

### Problem
Property-based tests with `melodicPatterns` (`targetedHarmony.test.ts`) failed with:
`Error: Invalid pitch A9`

### Root Cause
When leaping gestures or sequential patterns accumulated large step offsets, `realizeDiatonicStep` calculated:
`const oct = Math.floor(step / 7);`
Without bounds clamping, `oct` reached 5+, producing `A9` which exceeds standard MIDI range (0–127).

### Lesson Learned
- Always clamp octave offsets defensively in `realizeDiatonicStep`:
  `const oct = Math.max(-3, Math.min(3, Math.floor(step / 7)));`
- In `MELODIC_CADENCE_SHAPES`, all scale degrees must be standard scale degree numbers `1 | 2 | 3 | 4 | 5 | 6 | 7` (never `8`).
