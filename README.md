# Accordion sight-reading trainer

A browser-only procedural music trainer for MIDI accordions. V3 generates tonal phrases—not bags of unrelated notes—so practice develops pattern recognition, pulse, recovery, key fluency, and coordination.

## Practice model

Pitch range defaults to **Full range — rotating**. New practice starts a seeded, shuffled cycle of low (G3–G4), middle (G4–G5), and high (G5–G6) exercises. Automatic continuation and New exercise advance the cycle; Replay seed repeats the same register and score. Changing settings starts a new cycle. You can also select a fixed register or custom note limits within the original G3–G6 instrument range. Settings are included in shared URLs.

Every melody note must fit the selected register, while preserving pitch classes, harmony and configured jump limits. Incompatible custom limits produce a generation error after bounded attempts; the generator does not fall back to another register. Register choice affects the melody independently of the Hands evaluation setting.

Right-hand jump practice separately controls target size, frequency, and a maximum safety limit. Left-hand jump practice uses harmony plans with deliberate Stradella-column movement; its maximum is measured in physical columns rather than MIDI voicing octaves. Stable melody notes follow the actual chord quality, including curated diminished and seventh chords, and endings resolve to the final harmony's root.

Six focused modes generate material from a shared harmonic plan: **General sight-reading**, **Note recognition**, **Patterns and intervals**, **Rhythm**, **Left-hand reading**, and **Two-hand coordination**. Pattern practice exposes its melodic families directly; keys and note frequency remain independent settings rather than hidden modes.

Timed sight-reading offers forgiving timing with optional recovery after pauses, or a continuous clock for pulse practice. Correction mode waits for the expected pitches at a shared onset and is useful for fingering drills. Each event retains its scale degree, harmony, motif, pattern, rhythm cell, metric position, interval, and challenge tags for feature-level analysis.

The **Note value** and **Rhythm style** settings control rhythmic activity independently of tempo. Steady practice uses only the selected half, quarter, eighth, or sixteenth-note value (half notes require 4/4); Mostly steady introduces occasional longer notes, while Mixed and Rhythm challenge add progressively more variety. In timed sight-reading, completing an exercise generates the next score and waits there. The first accordion input starts its clock immediately, with no Start button or count-in.

The notation is intentionally an accordion lead sheet: one right-hand melodic staff with chord and slash-bass labels, never a second left-hand staff. A visible, configurable bass-pattern instruction explains how to realize those symbols, and the selected pattern determines left-hand MIDI evaluation. The hand selection changes evaluation scope, not the lead-sheet format.

Exercises are deterministic. A request plus instrument profile and seed always produces the same score; copy the displayed seed to reproduce an issue or replay material.

## Architecture

The dependency direction is `UI/browser adapters → session → pure core`.

- `src/core/music`, `patterns`, and `generation`: abstract scale degrees, harmony-first phrase generation, meter-aware rhythm cells, realization, validation, and difficulty analysis.
- `src/core/instrument`: playable ranges and accordion movement costs.
- `src/core/instrument/stradella.ts`: the migrated 72-button FR-1XB layout, including exact legacy MIDI voicings and physical row/column geometry.
- `src/core/performance`: absolute timelines, tolerant MIDI matching, continuity/recovery and feature metrics.
- `src/core/training`: versioned Zod requests and optional adaptive learning state.
- `src/adapters`: ABC serialization, normalized WebMIDI events, and local persistence.
- `src/app`: React orchestration only. The core has no browser or rendering dependencies.

The candidate generator has a finite retry limit. ABCJS is only a renderer; it does not participate in composition.

The left-hand accompaniment vocabulary preserves the pre-V3 hand-curated polka, split-chord, tango, swing, counterbass-transition, and fixed-key diminished patterns as declarative templates. Harmony selects the chord; the template selects its rhythm and physical bass/chord buttons; the Stradella profile supplies the device MIDI pitches.

## Development

Requires a currently supported Node release (CI uses the current LTS line).

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run lint
npm run check
```

Vitest covers tonal realization, transformation, notation, MIDI matching, determinism, and hundreds of property-generated exercises.

## MIDI

Use a WebMIDI-capable browser and grant MIDI permission. The default channel mapping follows a Roland FR-1XB: channel 1 is right hand and channels 2–3 are left hand. Inputs are normalized before entering the performance engine, so tests require no hardware.

## Deployment

The GitHub Pages workflow runs `npm ci` and the complete `npm run check` gate before uploading `dist` and deploying. The app remains a static Vite site: no backend, account, or database is required. Practice settings are mirrored to the URL for sharing and saved locally; optional learning data stays in local storage.

## Timing and forgiving practice

Timed practice defaults to **Very forgiving** timing and **Follow me after a pause**. Very forgiving accepts attacks up to half a quarter-note beat early or late as on time (about 417 ms at 72 BPM). Balanced allows 0.2 beats early / 0.25 late; Strict allows 0.1 / 0.125. Custom exposes early, late, and chord-spread allowances in milliseconds. Chord spread is 20% of a beat, capped at 180 ms, in Very forgiving; Balanced uses 100 ms and Strict 60 ms. These settings are saved locally and in presets. Changing timing restarts practice on the same score.

Pitch-correct attacks just outside the on-time allowance, up to 1.5 times that allowance, are reported as early/late and still receive pitch credit. Matching reserves nearby correct pitches before assigning wrong notes, so an omitted note does not consume the following correct attack. Repeated pitches are assigned by proximity; very wide custom windows can still make a player's intention ambiguous in fast passages.

Follow mode waits at an overdue onset. After a pause, a recognizable attack within the next four onset groups realigns the remaining timeline without changing tempo. The hesitation is recorded separately instead of turning the rest of the phrase into errors. Uncheck **Follow me after a pause** to practice against a continuous clock. Use **Finish exercise** to assess an unfinished passage, including when follow mode is waiting for a final note. The first MIDI attack anchors to the selected hands' first sounding onset, including scores that begin with a rest.

Correction practice advances both hands through shared onset groups. Both attacks at a shared onset must be completed before moving ahead. Chord pitches must arrive within the configured chord-spread window. Note recognition practices the right hand; older left-only recognition settings are migrated to right-only practice.

Pitch, timing, continuity, and note-length feedback are separate. When note-off data is available, note-length feedback allows short articulation down to 35% of the written duration, but flags very short taps and notes held substantially beyond their written end. Tied notes are evaluated as one sustained note. This feedback does not reduce pitch accuracy. A silent passage no longer receives perfect continuity.

Generation respects the accidental budget while constructing the melody, including long note-recognition exercises. Medium and Busy rhythms include the selected subdivisions in both 3/4 and 4/4. All required bass changes remain visible on the lead sheet, with held melody notes tied across intermediate slash-bass changes. If a requested configuration cannot generate a score, the previous settings and score remain active together.
