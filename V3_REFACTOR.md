Your task is to perform a **big-bang refactor** that turns the existing accordion fingering/random-note practice app into a **real procedural sight-reading trainer**.

Work autonomously and make commits and push on the way.

Do not preserve old generator logic merely for compatibility. You may delete, replace, rename, and reorganize the current core logic extensively. Preserve the existing overall visual experience and interaction style where practical, but the internal architecture and practice logic should be redesigned from first principles.

Do not stop to ask design questions unless absolutely blocked. Make reasonable engineering and musical decisions autonomously. Finish the implementation, tests, documentation, and build pipeline in one pass.

# 1. Product goal

The app should train actual sight-reading rather than primarily random note recognition.

The generated material should resemble simple, structurally plausible music:

* it should belong to a real key;
* melodies should consist largely of recognizable musical patterns;
* rhythm should use recurring metric cells rather than arbitrary durations;
* both hands should derive from a shared harmonic plan;
* phrases should contain repetition and variation;
* difficulty should be controllable across independent dimensions;
* genuine sight-reading mode must continue according to time even when the player makes mistakes;
* exercises should be deterministic from a random seed;
* performance analysis should identify which musical features caused problems.

The core principle is:

**Generate musical structure first, concrete notes second.**

The generation hierarchy should be approximately:

training intent
→ key/meter/tempo
→ harmony
→ phrase structure
→ motifs/patterns
→ rhythm realization
→ right-hand realization
→ left-hand realization
→ instrument constraints
→ difficulty analysis
→ accepted exercise
→ notation rendering

Do not implement “musical generation” merely as random notes with weighted probabilities.

# 2. Keep the application frontend-only

Keep the project as a static Vite/React application deployable to GitHub Pages.

Do not introduce:

* a backend;
* a database server;
* authentication;
* Redux;
* a large state-management framework;
* an LLM;
* a machine-learning music generator.

Retain and reuse where appropriate:

* React;
* Vite;
* abcjs;
* WebMIDI/webmidi;
* nuqs;
* GitHub Pages deployment.

The UI may require small changes to expose new concepts, but do not redesign the application visually.

Focus effort on the domain engine and training logic.

# 3. Add the technical foundations

Add appropriate current compatible versions of:

* `tonal` for low-level pitch/key/scale/chord/interval operations;
* `vitest` for unit and integration testing;
* `fast-check` for property-based testing;
* `zod` for runtime configuration validation and versioned settings;
* `pure-rand` or an equivalently small deterministic PRNG library.

Upgrade Node/Vite/tooling if required for current Vitest compatibility.

Add scripts equivalent to:

```json
{
  "dev": "vite",
  "typecheck": "tsc -b",
  "test": "vitest run",
  "test:watch": "vitest",
  "lint": "eslint .",
  "build": "tsc -b && vite build",
  "check": "npm run lint && npm run test && npm run build"
}
```

Update GitHub Actions so deployment runs only after the full check passes.

The CI flow should be:

checkout
→ supported Node version
→ npm ci
→ npm run check
→ build/upload GitHub Pages artifact
→ deploy

# 4. Use a functional-core architecture

The music engine must contain no React, DOM, ABCJS, WebMIDI, browser-storage, or URL-state dependencies.

Use approximately this architecture. Exact filenames may differ if a better organization becomes obvious.

```text
src/
  app/
    App.tsx
    session/
    settings/

  core/
    music/
      pitch.ts
      key.ts
      scaleDegree.ts
      interval.ts
      harmony.ts
      rhythm.ts
      meter.ts

    generation/
      generateExercise.ts
      generateCompositionPlan.ts
      generateHarmony.ts
      generatePhrase.ts
      generateMelody.ts
      generateBass.ts
      realizeExercise.ts
      validateExercise.ts
      analyzeDifficulty.ts

    patterns/
      melodicPatterns.ts
      rhythmCells.ts
      progressionTemplates.ts
      phraseTemplates.ts

    instrument/
      instrumentProfile.ts
      accordionProfile.ts
      stradella.ts

    performance/
      timeline.ts
      eventMatcher.ts
      evaluatePerformance.ts
      performanceMetrics.ts

    training/
      trainingIntent.ts
      presets.ts
      adaptiveProfile.ts

    random/
      rng.ts

  adapters/
    abc/
      exerciseToAbc.ts

    midi/
      webMidiInput.ts

    persistence/
      settingsPersistence.ts
      learningProfilePersistence.ts

  ui/
    existing/preserved UI components
```

Dependency direction should be:

UI / browser adapters
→ application/session layer
→ pure domain core

The core must not import from the UI/adapters.

# 5. Replace the current music data model

Do not make literal rendered notes the primary generation representation.

Introduce an abstract tonal representation.

For example:

```ts
type ScaleDegree = {
  degree: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  alteration: -2 | -1 | 0 | 1 | 2;
  octaveOffset: number;
};
```

Introduce concepts roughly equivalent to:

```ts
type TonalContext = {
  tonic: PitchClass;
  mode: "major" | "minor";
};

type HarmonyEvent = {
  onset: Tick;
  duration: Tick;
  rootDegree: ScaleDegree;
  quality: ChordQuality;
  function?: "tonic" | "predominant" | "dominant";
};

type PhrasePlan = {
  sections: PhraseSection[];
};

type MotifOccurrence = {
  patternId: string;
  startDegree: ScaleDegree;
  transformation: PatternTransformation;
  rhythmCellIds: string[];
};

type ExerciseEvent = {
  onset: Tick;
  duration: Tick;
  pitches: Pitch[];
  hand: "right" | "left";
  metadata: EventMetadata;
};

type Exercise = {
  seed: number;
  tonalContext: TonalContext;
  meter: Meter;
  tempoBpm: number;
  totalDuration: Tick;
  harmony: HarmonyEvent[];
  rightHand: ExerciseEvent[];
  leftHand: ExerciseEvent[];
  difficulty: DifficultyVector;
  metadata: ExerciseMetadata;
};
```

Use Tonal internally where useful, but expose the app's own domain types rather than leaking Tonal-specific objects throughout the application.

# 6. Implement true key-aware generation

Support real major and minor keys.

A note belonging naturally to the key signature must not be treated as an “accidental difficulty.”

For example:

* F# in D major is a normal scale tone;
* Bb in F major is a normal scale tone;
* C-natural in D major is chromatic alteration.

Remove the old concept of “maximum accidentals per track” as the main tonal complexity model.

Replace it with concepts such as:

* allowed keys;
* selected/fixed key;
* key pool;
* major/minor;
* chromaticism amount;
* allowed chromatic-tone types;
* optional weighted rotation between keys.

The ABC adapter must correctly render all supported keys and appropriate accidental spelling.

Do not retain any C-major-only assumptions.

# 7. Create a melodic pattern vocabulary

Implement a declarative melodic-pattern library.

Initial useful pattern families should include at least:

* repeated notes;
* ascending scale fragments;
* descending scale fragments;
* three-note scale fragments;
* five-note scale fragments;
* ascending thirds;
* descending thirds;
* broken triads;
* triad up/down;
* arpeggio fragments;
* upper-neighbor figures;
* lower-neighbor figures;
* passing-note figures;
* leap followed by stepwise recovery;
* repeated motif;
* diatonic sequence up;
* diatonic sequence down;
* simple cadential figures;
* chord-tone-centered figures.

Patterns should describe relationships, not absolute pitches.

Example conceptually:

```ts
{
  id: "triad-up-down",
  family: "triad",
  relativeDegrees: [0, 2, 4, 2],
}
```

The same pattern should be realizable:

* in different keys;
* starting on different scale degrees;
* in different registers;
* over compatible harmony;
* with different rhythmic cells.

Support pattern transformations including:

* exact repetition;
* sequence one scale degree higher/lower;
* same contour from a new starting degree;
* same rhythm with different pitches;
* changed ending;
* motif shortening;
* motif extension.

Favor musically common transformations.

Do not overuse artificial transformations just because they are mathematically convenient.

# 8. Build phrase structure

Exercises should not be independent random bars.

Generate simple phrase plans such as:

```text
A | A' | B | cadence
```

or:

```text
A | A' | A'' | cadence
```

For longer exercises, support antecedent/consequent-like structures.

Expose control over:

* motif repetition;
* variation amount;
* sequence probability;
* phrase length;
* cadence strength;
* structural predictability.

The intention is to teach recognition of recurring chunks and prediction.

# 9. Build a rhythm grammar

Replace the small/simple rhythm handling with a meter-aware rhythm-cell library.

Rhythm cells should understand beat placement and meter.

For 4/4 support progressively:

* quarter notes;
* half notes;
* paired eighths;
* four sixteenths;
* eighth + two sixteenths;
* two sixteenths + eighth;
* dotted eighth + sixteenth;
* dotted quarter + eighth;
* rests;
* ties;
* simple syncopation;
* off-beat entries.

Provide appropriate vocabularies for 3/4 and 6/8 as well.

Rhythm configuration should independently control:

* allowed meters;
* smallest subdivision;
* rhythmic-cell vocabulary;
* note density;
* rest density;
* tie density;
* syncopation;
* rhythmic repetition;
* rhythmic novelty.

Do not simply choose independent note durations whose sum happens to fill a measure.

# 10. Make harmony first-class

Generate harmony before either hand.

Start with common-practice beginner/intermediate tonal progressions.

Very easy vocabulary:

```text
I
IV
V
V7
vi
ii
```

Useful progressions include:

```text
I | I | V | I
I | IV | V | I
I | vi | IV | V
I | ii | V7 | I
I | IV | I | V
```

Harmony generation should understand phrase endings and cadences.

The right-hand melody must know the active harmony.

Strong metric positions should usually favor chord tones, while weaker positions may include appropriate:

* passing tones;
* neighboring tones;
* scale tones;
* simple embellishments.

This should remain rule-based and intentionally simple.

# 11. Generate both hands from the same harmony

Do not independently randomize the left hand.

The left hand should realize the `HarmonyEvent[]`.

Keep useful existing Stradella/bass pattern knowledge, but refactor it into accompaniment styles.

Support concepts such as:

* bass + chord;
* bass + alternating bass + chord;
* polka;
* waltz where applicable;
* tango-style pattern;
* swing-style pattern;
* existing useful patterns already present in the repository.

The accompaniment pattern chooses rhythmic realization.

The harmonic plan chooses the actual bass/chord roots and chord quality.

# 12. Introduce an instrument profile

Generation should not directly hard-code accordion movement assumptions.

Use an interface resembling:

```ts
interface InstrumentProfile {
  rightHandRange: PitchRange;
  leftHandRange: BassRange;

  rightHandMovementCost(from: Pitch, to: Pitch): number;
  leftHandMovementCost(from: BassEvent, to: BassEvent): number;

  canPlayRightHandChord(pitches: readonly Pitch[]): boolean;
  canPlayBass(event: BassEvent): boolean;
}
```

Implement the current accordion configuration as the default profile.

Where feasible, model actual button/Stradella geometry rather than only semitone distance.

Keep this architecture extensible enough that another accordion layout could later provide a different profile.

# 13. Difficulty must be multidimensional

Introduce a `DifficultyVector`, not merely one global level.

Track dimensions approximately equivalent to:

```ts
type DifficultyVector = {
  tonal: number;
  pitchMovement: number;
  patternComplexity: number;
  rhythm: number;
  density: number;
  harmony: number;
  rightHandMotor: number;
  leftHandMotor: number;
  coordination: number;
  predictability: number;
  tempo: number;
  challengeDensity: number;
};
```

Exact normalization is an implementation decision.

The important requirement is that difficulty dimensions remain independently controllable.

The generator should work by:

1. generate candidate;
2. analyze candidate;
3. validate candidate;
4. reject if outside requested constraints;
5. select/return an acceptable candidate.

Do not assume requested generation constraints automatically imply actual output difficulty.

Set a finite candidate/retry limit and fail gracefully rather than allowing infinite loops.

# 14. Implement explicit training intents

One common generator should power different practice modes.

Support at least:

## Balanced sight-reading

Normal tonal material.

Moderate pattern repetition.

Moderate phrase structure.

Normal rhythmic/harmonic vocabulary appropriate to selected difficulty.

## Pattern focus

Selected pattern families appear at elevated frequency.

Everything unrelated should remain comparatively easy.

Example:

```text
target = broken triads
key difficulty = easy
rhythm = easy
target pattern density = high
```

## Key fluency

One or several keys dominate.

Keep rhythm/pattern complexity relatively low.

Material should strongly reinforce that key's scale-degree and physical mappings.

## Rhythm focus

Pitch material becomes easy and strongly tonal.

Rhythm complexity increases.

## Pitch / interval focus

Rhythm stays easy.

Pitch movement/interval vocabulary is deliberately controlled.

## Read-ahead / continuity

Use:

* easy/moderate motor demands;
* strongly recognizable patterns;
* clear tonal structure;
* moderate repetition;
* limited rhythmic complexity;
* occasional isolated surprise/challenge.

Scoring should emphasize continuity and recovery rather than local perfection.

## Left-hand focus

Right hand remains easy.

Increase:

* Stradella movement;
* accompaniment vocabulary;
* chord/root transitions.

## Coordination

Each hand should be individually easy.

Difficulty comes from increasing temporal independence and differing rhythmic placement.

## Random decoding

Retain a mode equivalent in spirit to the old random-note trainer.

This mode deliberately minimizes tonal prediction and trains direct:

staff symbol → button

mapping.

It should be explicitly treated as a decoding exercise rather than normal sight-reading.

# 15. Support mixed practice

Implement exercise-level mixing.

Example:

```ts
{
  mix: [
    { intent: "balanced", weight: 0.4 },
    { intent: "keyFocus", weight: 0.3 },
    { intent: "patternFocus", weight: 0.2 },
    { intent: "randomDecoding", weight: 0.1 }
  ]
}
```

Each generated exercise chooses one main intent according to these weights.

Also allow a main intent with secondary emphasis:

```text
balanced sight-reading
+ emphasize arpeggios
+ emphasize D major
```

Avoid simultaneously maximizing several unrelated difficulties.

# 16. Implement deliberate challenge events

Allow an exercise to be mostly manageable while occasionally introducing isolated difficulty.

Support challenge types such as:

* larger melodic leap;
* chromatic note;
* less familiar rhythmic cell;
* syncopation;
* larger bass jump;
* temporary hand independence;
* slightly less predictable continuation.

Configuration should include approximately:

```ts
challenge: {
  density: number;
  allowedTypes: ChallengeType[];
}
```

These events should be tagged in metadata.

Their purpose is to train:

difficulty encountered
→ maintain pulse
→ recover immediately

rather than making the entire score uniformly difficult.

# 17. Every generated event needs pedagogical metadata

Attach metadata explaining why each event exists.

Example:

```ts
type EventMetadata = {
  scaleDegree?: ScaleDegree;
  harmonyId?: string;
  motifId?: string;
  patternId?: string;
  patternFamily?: PatternFamily;
  rhythmCellId?: string;
  intervalFromPrevious?: number;
  metricStrength?: "strong" | "medium" | "weak";
  challengeTags: ChallengeType[];
};
```

Do not discard this information after realization.

The performance evaluator needs it to produce feature-level metrics.

# 18. Use deterministic randomness everywhere

All generated exercises must be reproducible.

Expose:

```ts
generateExercise(request, seed)
```

Do not directly call `Math.random()` inside core generation code.

Create an injected deterministic RNG abstraction:

```ts
interface Rng {
  next(): number;
  integer(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  weightedPick<T>(items: readonly Weighted<T>[]): T;
}
```

Store the seed on every generated exercise.

Given identical:

* configuration;
* instrument profile;
* seed;

the generated exercise must be identical.

# 19. Separate score representation from ABCJS

ABCJS must become only a rendering adapter.

Pipeline:

```text
abstract composition
→ realized Exercise
→ score/notation representation
→ ABC serialization
→ abcjs rendering
```

The generator must never produce ABC strings itself.

Implement arbitrary supported key signatures correctly.

Keep rendering-specific accidental state inside the ABC adapter.

# 20. Normalize MIDI input

Do not expose `webmidi` package events to the core evaluator.

Create a browser adapter that converts incoming MIDI into normalized domain events.

Example:

```ts
type PerformedMidiEvent = {
  midiNote: number;
  type: "noteOn" | "noteOff";
  timestampMs: number;
  velocity: number;
};
```

The core performance engine accepts only normalized events.

This must make evaluation testable without a physical MIDI device.

# 21. Rebuild sight-reading execution around an absolute timeline

This is critical.

In genuine sight-reading mode, the app must **not wait for a correct note**.

At exercise start:

1. optional preview period;
2. count-in;
3. record `performance.now()` session start;
4. create expected absolute event timestamps from tempo/ticks;
5. continuously accept MIDI input;
6. advance score position according to time;
7. record errors without pausing;
8. finish at the predetermined ending.

Wrong notes must not stop the exercise.

React renders current position but does not define musical timing.

Use absolute timing based on `performance.now()`.

Do not implement the musical clock as chained React state updates.

# 22. Keep a correction/drill mode too

There are two legitimate runtime semantics.

## Correction mode

Useful for fingering and note-learning.

Behavior:

```text
show event
wait until correct
advance
```

## Sight-reading mode

Behavior:

```text
time advances regardless of correctness
match input to expected timeline
record errors
never stop
```

Keep both concepts clearly separate.

Random decoding may default to correction mode.

Balanced/read-ahead/etc. should default to timed sight-reading mode.

# 23. Implement event matching

Performance matching must account for timing tolerance.

For single notes classify events approximately as:

* correct;
* wrong pitch;
* missed;
* extra;
* early;
* late.

For simultaneous notes/chords:

* group notes received within a configurable simultaneity window;
* compare expected pitch sets;
* tolerate realistic human onset spread.

Avoid requiring MIDI timestamps to be literally identical.

Handle left and right hands independently where possible.

# 24. Performance metrics

Replace simple completed/perfect counters with richer metrics.

At minimum compute:

```ts
type PerformanceMetrics = {
  pitchAccuracy: number;
  timingAccuracy: number;
  missedNotes: number;
  extraNotes: number;

  continuity: number;

  longestHesitationMs: number;
  lateEventClusters: number;

  recoveryMetrics: {
    meanRecoveryMsAfterError: number;
    meanRecoveryBeatsAfterError: number;
  };

  rightHand: HandMetrics;
  leftHand: HandMetrics;

  byFeature: Record<string, FeatureMetrics>;
};
```

Do not claim to measure literal eye position or read-ahead distance.

Instead measure observable symptoms related to continuity:

* lateness;
* hesitation clusters;
* recovery time;
* error cascades;
* whether timing stabilizes after an error.

# 25. Feature-level analysis

Because each expected event carries metadata, aggregate performance across categories such as:

```text
key:D
key:Eb
scaleDegree:7
pattern:triad
pattern:sequence
rhythm:dotted-eighth-sixteenth
interval:6
challenge:chromatic
bassJump:4
coordination:independent
```

This should let the application distinguish:

“bad at note reading”

from:

“errors disproportionately occur on scale degree 7 in sharp keys”

or:

“descending broken triads cause timing collapse.”

# 26. Add an optional adaptive learning profile

Implement a simple local adaptive profile.

Track for each feature:

```ts
type FeatureLearningState = {
  attempts: number;
  successes: number;
  pitchAccuracy: number;
  timingAccuracy: number;
  recentPerformance: number;
};
```

Adaptive generation should increase exposure to weaker categories while avoiding simultaneous unrelated difficulty increases.

Example:

If E-flat major is weak:

* increase E-flat exercises;
* keep rhythm and hand coordination comparatively easy.

If descending triads are weak:

* generate more descending triad patterns;
* vary their actual notes/keys.

Do not simply repeat the exact failed bar.

Make adaptation optional.

Manual configuration always overrides automatic selection.

Persistence may initially use localStorage or another lightweight local browser mechanism.

No backend.

# 27. Configuration model

Replace the old simple configuration with a versioned schema.

Use Zod.

Something conceptually like:

```ts
type TrainingRequest = {
  version: 2;

  intent: TrainingIntent;

  tonal: {
    keys: KeyName[];
    selection: "fixed" | "random" | "weighted";
    modePolicy: "major" | "minor" | "both";
    chromaticism: number;
  };

  patterns: {
    allowedFamilies: PatternFamily[];
    targetFamilies: PatternFamily[];
    targetDensity: number;
    repetition: number;
    variation: number;
    sequenceProbability: number;
  };

  rhythm: {
    meters: Meter[];
    smallestSubdivision: NoteValue;
    syncopation: number;
    restDensity: number;
    tieDensity: number;
    noteDensity: number;
  };

  harmony: {
    progressionVocabulary: ProgressionTemplateId[];
    chordVocabulary: ChordQuality[];
  };

  rightHand: {
    range: PitchRange;
    movementDifficulty: number;
  };

  leftHand: {
    enabled: boolean;
    accompanimentStyle: AccompanimentStyle;
    movementDifficulty: number;
  };

  coordination: {
    difficulty: number;
  };

  challenge: {
    density: number;
    allowedTypes: ChallengeType[];
  };

  tempoBpm: number;
  measures: number;

  seed?: number;
};
```

Exact naming may change, but preserve the concepts.

Version settings and implement migration/fallback for old saved/query configurations where reasonable.

It is acceptable for obsolete old settings to be discarded if migration would introduce excessive complexity.

# 28. Preserve the UI experience without being constrained by old settings

Keep the same general app:

* notation visible;
* settings area;
* MIDI connection/input;
* practice interaction;
* basic performance feedback.

Do not spend large effort redesigning appearance.

It is acceptable to reorganize settings enough to expose:

* training mode;
* key/key pool;
* tempo;
* measure count;
* RH/LH;
* main difficulty dimensions;
* pattern/rhythm emphasis;
* correction vs sight-reading mode.

Advanced settings may remain collapsed/compact if needed.

The engine must not be constrained by which controls currently happen to exist.

# 29. Testing strategy

Testing is a core deliverable, not optional.

Use Vitest.

Use fast-check heavily for the procedural engine.

Add deterministic unit tests for:

## Tonal realization

For example:

```text
1-2-3-4-5 in D major
=> D E F# G A
```

and:

```text
1-2-3-4-5 in Eb major
=> Eb F G Ab Bb
```

## Harmony

Validate chord construction and progression realization across multiple keys.

## Patterns

Verify pattern transformations preserve intended abstract relationships.

## Rhythm

Verify all measures contain exactly the required duration.

## ABC rendering

Test key signatures, accidentals, naturals, measure resets, rests, and multiple keys.

## MIDI/event matching

Test:

* exact note;
* early;
* late;
* missed;
* extra;
* chords with realistic onset spread;
* recovery after errors.

## Seed determinism

Identical config + seed must create identical exercise.

Different seeds should ordinarily create different exercises.

# 30. Property-based generation tests

Create fast-check properties over broad generated configurations.

At minimum assert:

* generation terminates;
* no invalid duration exists;
* every measure is complete;
* both hands have the requested total duration;
* every note lies within instrument range;
* every bass event is playable;
* generated pitches correspond correctly to their abstract scale degrees;
* chromatic notes are explicitly tagged as chromatic;
* generated pattern occurrences actually satisfy their pattern definition;
* the requested key is correctly represented;
* harmony and left-hand realization agree;
* challenge-event density stays within sensible tolerance;
* computed difficulty contains finite values;
* accepted exercises satisfy validation;
* same seed produces same exercise;
* ABC conversion does not throw for any supported key.

Run hundreds/thousands of randomized cases where practical.

Protect all rejection-sampling loops with maximum iteration counts.

# 31. Add generator diagnostics

Create a useful debug representation.

A developer should be able to inspect an exercise and see:

```text
seed: 847192

key: D major
meter: 4/4
tempo: 72

harmony:
I | IV | V7 | I

phrase:
A | A' | B | cadence

patterns:
m1: triad-up-down
m2: same motif sequenced +3 diatonic steps
m3: scale-fragment
m4: cadence

computed difficulty:
tonal: ...
rhythm: ...
RH motor: ...
LH motor: ...
coordination: ...
predictability: ...
```

This may be console/debug utility code rather than UI.

The objective is to make weird generated exercises diagnosable by seed.

# 32. Documentation

Rewrite README so it explains:

* what the application now trains;
* difference between random decoding and sight-reading;
* generation architecture;
* training modes;
* how deterministic seeds work;
* development commands;
* testing;
* MIDI requirements;
* GitHub Pages deployment.

Include a short architecture section.

Document important design decisions in code where the rationale is not obvious.

# 33. Remove obsolete code

Delete old types, helpers, generator branches, and logic that no longer fit the architecture.

Do not maintain two competing generation engines merely to preserve history.

Keep only old pattern/bass data that is genuinely useful after being migrated to the new abstractions.

Avoid compatibility wrappers whose sole purpose is keeping obsolete functions alive.

The result should look like a deliberate rewritten architecture, not a new system bolted onto the previous one.

# 34. Engineering quality requirements

Use strict TypeScript.

Prefer small pure functions.

Avoid enormous utility files.

Avoid circular dependencies.

Avoid hidden mutable global state inside the core.

No direct random calls in generation.

No React dependencies in core.

No ABC dependencies in core.

No WebMIDI dependencies in core.

Use discriminated unions where useful.

Use branded/unit types if they improve safety for concepts like ticks and milliseconds.

Do not overengineer with dependency injection frameworks.

Plain functions/interfaces are preferred.

# 35. Final acceptance scenario

The following should work after the refactor.

User configures:

```text
training:
Pattern Focus

target:
Broken triads

key:
D major

tempo:
70 BPM

meter:
4/4

length:
8 measures

right hand:
easy/moderate

left hand:
enabled
simple Stradella accompaniment

rhythm:
easy

sight-reading mode:
timed / continuous
```

The engine might generate:

```text
Harmony:
I | IV | V | I
vi | IV | V7 | I

Phrase:
A A' B cadence
```

A pattern occurrence might produce:

```text
D F# A F#
```

followed later by structurally related:

```text
G B D B
```

and:

```text
A C# E C#
```

The score is valid D-major notation.

The left hand follows the same harmony.

The exercise is mostly easy but may contain one configured challenge event.

After a count-in, time advances continuously.

If the user plays one wrong note:

* the app records it;
* the clock continues;
* the score continues;
* subsequent notes are still matched normally.

After completion, performance information can distinguish:

* overall pitch accuracy;
* timing accuracy;
* continuity;
* RH/LH;
* pattern-family performance;
* key-related performance;
* challenge-event performance;
* recovery after error.

If the exercise looks strange, its seed reproduces it exactly.

# 36. Completion criteria

Do not consider the task complete until all of the following are true:

* old random generator is no longer the primary architecture;
* structured tonal generation works;
* multiple keys work;
* phrase/motif/pattern generation works;
* rhythm-cell generation works;
* both hands share harmony;
* deterministic seeded generation works;
* difficulty analysis exists;
* training intents exist;
* timed sight-reading execution exists;
* correction mode still exists where appropriate;
* normalized MIDI event handling exists;
* performance evaluation exists;
* feature metadata exists;
* ABC rendering works for supported keys;
* tests cover core musical behavior;
* property tests cover generated exercises;
* lint passes;
* typecheck passes;
* tests pass;
* production build passes;
* GitHub Pages CI is updated;
* README is updated;
* obsolete code has been removed.

At the end, provide a concise implementation summary including:

1. major architectural changes;
2. dependencies added/upgraded;
3. training modes implemented;
4. generation features implemented;
5. evaluation/scoring features implemented;
6. tests added;
7. any deliberate limitations that remain.

Do not leave major portions as TODO placeholders unless there is a genuine external blocker.

The objective is not to build a perfect automatic composer. The generated music may be deliberately simple or boring.

The objective is to create **simple, plausible, structured, highly varied sight-reading material whose pedagogical properties are known and controllable**.
