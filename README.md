# Accordion sight-reading trainer

A browser-only procedural music trainer for MIDI accordions. V3 generates tonal phrases—not bags of unrelated notes—so practice develops pattern recognition, pulse, recovery, key fluency, and coordination.

## Practice model

Balanced, pattern-focus, key-fluency, rhythm-focus, interval-focus, read-ahead, left-hand, and coordination modes generate music from a shared harmonic plan. The deliberately different **random decoding** mode trains direct staff-symbol-to-button recognition.

Timed sight-reading uses an absolute clock: a wrong note is recorded but never pauses the score. Correction mode waits for the expected pitch and is useful for fingering drills. Each event retains its scale degree, harmony, motif, pattern, rhythm cell, metric position, interval, and challenge tags for feature-level analysis.

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

The GitHub Pages workflow runs `npm ci` and the complete `npm run check` gate before uploading `dist` and deploying. The app remains a static Vite site: no backend, account, or database is required. Settings and optional learning data stay in local storage.
