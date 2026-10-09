# Repository agent guidance

## Working style

- Work autonomously within the requested scope and make reasonable implementation decisions without waiting for routine confirmation.
- Prefer completing a requested change end to end, including tests, documentation, and CI changes that are directly required.
- Preserve unrelated user changes in a dirty worktree.
- After a completed, validated unit of work, prefer creating a focused commit and pushing it to the current upstream branch. Do not push broken or partially validated work. If pushing is unavailable, report the exact blocker and leave the local commit ready.

## Architecture

- Keep this application frontend-only and deployable as a static Vite/React GitHub Pages site.
- Keep the domain core in `src/core` pure: no React, DOM, ABCJS, WebMIDI, local storage, or URL-state imports.
- Maintain the dependency direction `UI/browser adapters -> application/session -> pure core`.
- Generate musical structure before concrete pitches. Both hands must derive from the same harmony.
- All core generation randomness must use the injected deterministic RNG. Do not call `Math.random()` in `src/core`.
- ABCJS and WebMIDI belong behind adapters. Core performance code consumes normalized MIDI events.

## Validation

Use the current Node.js LTS line, matching GitHub Actions. Install dependencies from the committed lockfile:

```sh
npm ci
```

Run the full required validation before committing and pushing:

```sh
npm run check
```

`npm run check` runs ESLint, the Vitest suite (including fast-check properties), TypeScript project compilation, and the Vite production build. Useful narrower commands are:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

When dependency metadata changes, verify the CI install from a clean directory with `npm ci`; an existing `node_modules` directory is not sufficient to validate `package-lock.json` consistency.

For generator changes, add or update deterministic and property-based tests. At minimum preserve these invariants:

- identical request, instrument profile, and seed produce identical exercises;
- every measure and hand timeline is complete and all durations are positive;
- pitches and bass events stay within the active instrument profile;
- harmony, scale-degree metadata, chromatic tags, and left-hand realization agree;
- computed difficulty values are finite;
- ABC serialization succeeds for every supported key;
- rejection sampling is bounded.

## Deployment

`.github/workflows/deploy-pages.yml` must run `npm ci` followed by `npm run check` before uploading `dist`. Do not routinely monitor GitHub Actions or the deployed site after ordinary application changes; that is usually unnecessary. Inspect the remote run only when the task directly concerns CI/deployment or there is concrete evidence that deployment may be broken.

## Programmatic UI review & virtual MIDI bridge

To review UI states programmatically (in browser agents, Playwright, or browser DevTools) without physical MIDI hardware, the application exposes a global bridge at `window.accordionBridge` (and alias `window.__accordionBridge`) in all environments (both dev and production).

### Bridge API

- `window.accordionBridge.getState()`: Returns a snapshot of the current state:
  ```ts
  {
    mode: "sightReading" | "correction",
    status: "ready" | "playing" | "review",
    waiting: boolean,
    positionMs: number,
    playheadOnset: number | undefined,
    markedOnset: number | undefined,
    exercise: Exercise,
    metrics: PerformanceMetrics | undefined,
    reviewAnnotations: ReviewAnnotation[],
    sessionStats: SessionStats,
    devices: string[],
    settings: TrainingRequest,
    seed: number
  }
  ```
- `window.accordionBridge.sendNoteOn(midiNote, { hand?, velocity?, timestampMs? })`: Sends a normalized `noteOn`.
- `window.accordionBridge.sendNoteOff(midiNote, { hand?, timestampMs? })`: Sends a normalized `noteOff`.
- `window.accordionBridge.sendEvent(performedEvent)`: Sends any raw `PerformedMidiEvent`.
- `window.accordionBridge.playNextNote({ mistake?, hand? })`: Advances to the next expected note (with correct or incorrect pitch).
- `window.accordionBridge.fastForwardToReview({ mistakeCount?: number })`: Simulates completing an exercise (default 2 mistakes) and immediately transitions to the `"review"` status, rendering colored score annotations and performance metrics.
- `window.accordionBridge.simulatePause()`: Compatibility no-op (timed sight-reading maintains a continuous pulse without pausing).
- `window.accordionBridge.dismissReview()`: Sends a note to dismiss the review screen and advance to the next exercise.
- `window.accordionBridge.sendDeviceNames(["Device 1", "Device 2"])`: Updates detected MIDI device list.
- `window.accordionBridge.setMode("sightReading" | "correction")`: Changes practice mode.
- `window.accordionBridge.resetSession()` / `regenerate(seed?)`: Resets or generates new exercises.
- `window.accordionBridge.resetStats()`: Resets exercise completion history and session statistics.

### Recipes for agents

#### 1. Jump to the Review Screen (annotated score + metrics)
```js
window.accordionBridge.fastForwardToReview({ mistakeCount: 2 });
const state = window.accordionBridge.getState();
console.log(state.status); // "review"
console.log(state.reviewAnnotations); // note error highlights on the ABC score
```

#### 2. Sight-Reading Playing State
```js
window.accordionBridge.playNextNote();
const state = window.accordionBridge.getState();
console.log(state.status); // "playing"
console.log(state.waiting); // false (continuous pulse)
```

#### 3. Step Through Notes One-by-One
```js
// Play next expected note correctly
window.accordionBridge.playNextNote();

// Play next expected note with wrong pitch
window.accordionBridge.playNextNote({ mistake: true });
```

#### 4. Test MIDI Device Detection UI
```js
// Simulate connected Roland accordion
window.accordionBridge.sendDeviceNames(["Roland FR-1x"]);

// Simulate disconnected devices
window.accordionBridge.sendDeviceNames([]);
```

