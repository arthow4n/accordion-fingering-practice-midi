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
- Treat `V3_REFACTOR.md` as the product and architecture specification for the V3 trainer.

## Validation

Use Node 22, matching GitHub Actions. Install dependencies from the committed lockfile:

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

`.github/workflows/deploy-pages.yml` must run `npm ci` followed by `npm run check` before uploading `dist`. After changing CI or deployment inputs, inspect the resulting GitHub Actions run and confirm the published Pages URL responds successfully.
