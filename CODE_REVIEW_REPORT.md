# Code review — 2 October 2026

Reviewed the working tree based on commit `9171b613f8f71f8adbf5d5f364ab69f1b068b0cd`, including the existing dependency updates. Three specialist agents reviewed harmony/melody, rhythm/notation/Stradella, and MIDI/performance/session behavior; the coordinating review covered UI, architecture, settings, dependencies, and validation. Findings below were checked against source and deterministic runtime examples. This was a time-boxed review, without physical MIDI hardware or a visual browser audit.

The main concern is consistency between the harmonic plan, melodic realization, printed score, and evaluation. Most counterexamples pass the existing validator because it checks timelines and instrument playability rather than these musical relationships.

**Validation:** A clean, isolated copy of the working tree installed successfully using `npm ci --offline` on Node **24.21.0**, the installed current LTS line. The original full `npm run check` passed with **177 tests in 24 files**. After the notation fix, full validation passed again: ESLint, **178 tests in 24 files**, TypeScript, Vite, and PWA generation. Existing changes to `package.json` and `package-lock.json` were preserved.

**Fix progress:** Lead-sheet labels and focused drills now follow the active harmony. General practice uses the final cadence anchor, articulates its arrival beneath long notes, and protects it from inappropriate ties. Remaining findings are tracked below.

Priorities: **P1** affects normal practice or musical correctness; **P2** affects feedback, controls, or a narrower musical case; **P3** is an edge case or improvement.

| Priority | Finding | Status |
| --- | --- | --- |
| P1 | Mid-bar chord changes hidden while MIDI expects them | Fixed in this review |
| P1 | Focused drills use the wrong active harmony | Fixed |
| P1 | Split final cadence targets the earlier dominant anchor | Fixed |
| P1 | Minor leading-tone diminished chord has an unraised root | Open |
| P1 | Correct repeated notes can restart timed practice | Open |
| P2 | Independent random key pool stays on its first key | Open |
| P2 | General melody converts planned rests to notes | Open |
| P2 | Review ghost accidentals alter expected score pitches | Open |
| P2 | Advertised nonsteady rhythm styles have identical behavior | Open |
| P2 | Incorrect enharmonic spelling in ordinary supported keys | Open |
| P2 | Cadence classifications disagree with harmonic endings | Open |
| P2 | Restart retains the abandoned attempt in review metrics | Open |
| P2 | Octave-doubled bass burst advances multiple correction targets | Open |
| P2/P3 | Syncopation flags are lost between grammar and events | Open |
| P3 | Double alterations use interval numbers instead of semitone offsets | Open |

**1. Mid-bar changes missing from the score — P1, fixed**

Previously, [exerciseToAbc.ts](src/adapters/abc/exerciseToAbc.ts#L38) used harmonic-plan labels only when there were no accompaniment annotations. Ordinary bass patterns annotate their first atom, but [generateBass.ts](src/core/generation/generateBass.ts#L23) selects the active chord separately at every bass/chord onset.

Reproduction before the fix: `generateExercise(defaultTrainingRequest(), 4)` has ii at tick 3840, V at 4800, and I at 5760. The score showed Dm followed by C, omitting G at 4800, while the left hand was graded against G major. Seed 5 similarly omitted G7 at 2880 and C at 6720.

The fix merges changed harmony labels into accompaniment annotations, preserves curated labels, and uses the existing held-note splitting. The new regression checks those three labels at their musical onsets through ABCJS, rather than merely checking for text presence. Existing curated slash-bass tests also remain in the suite.

**2. Focused drills use the wrong active harmony — P1, fixed**

[generateMelody.ts:126](src/core/generation/generateMelody.ts#L126) selects `harmony[measure]` in the targeted branch and records that ID throughout the measure at line 306. This assumes exactly one chord per bar, although the harmonic grammar can emit two.

Reproduce with C major, emphasis `melodicPatterns`, steady eighth notes, ties/rests disabled, seed **4**. At tick **4800**, A4 is tagged as a chord tone of ii, while the actual active chord is V. The next measure still uses V after the accompaniment reaches I. Incorrect IDs were also reproduced for intervals, arpeggios, rhythm, and cadence approaches.

**Suggestion:** Look up harmony by each event's onset and split/replan patterns at harmonic boundaries. Test all focused modes with an independent onset-based oracle; comparing a note to its own recorded harmony ID misses this defect.

Implemented onset-based harmony lookup for both measure starts and individual events, with pattern replanning when an event enters a new harmony. Regression tests cover all five focused modes at seed 4; a property checks active-harmony metadata, stable attacks, and determinism across the nine UI keys and three rhythm styles.

**3. Split final cadences target the wrong anchor — P1, fixed**

[generateMelody.ts:392](src/core/generation/generateMelody.ts#L392) picks the first anchor in a bar and uses it as cadence arrival at line 425. [melodicAnchors.ts:62](src/core/generation/melodicAnchors.ts#L62) correctly creates a separate cadence anchor for the final harmony, but that anchor is overlooked.

Reproduce with C major, general emphasis, steady eighths, ties/rests disabled, seed **5**. The final bar changes V to I at tick **6720**, but the last note at **7440** is **D6**, degree 2, tagged `strongTonic`. D minor under the same settings ends **C#6** over D minor.

**Suggestion:** Select the final `cadence` anchor for arrival, use onset-aware intermediate anchors, and protect the arrival through subsequent pitch repairs. Test planned arrival against realized final harmony in major and minor, including split cadences.

Implemented final-anchor selection, rhythm splitting at harmonic arrival, and tie guards that preserve the closing pitch while allowing intervening melodic variation. Deterministic regressions cover steady and mixed seed 5 in C major/D minor, dense ties, and sustained-note seeds 109/136. A property checks closing harmony, strong tonic arrival, tie consistency, complete timelines, and determinism across the nine UI keys.

**4. Minor vii° has the wrong root — P1**

[harmonicGrammar.ts:83](src/core/generation/harmonicGrammar.ts#L83) offers degree-7 diminished as dominant harmony in minor, but realization hardcodes root alteration 0, including at line 326 and in the explicit progression path at line 163.

Reproduce A minor, steady eighths, ties/rests disabled, seed **3**. At tick **3840**, degree 7, alteration 0, diminished quality, and dominant function realize **G–Bb–Db**. The stated common-practice leading-tone chord is **G#–B–D**. Its Roman symbol is also uppercase `VII°` rather than lowercase `vii°`.

**Suggestion:** Encode the raised root for minor leading-tone diminished harmony in every generation path. Test root alteration, triad pitch classes, Roman symbol, and left-hand realization in A, D, and E minor.

**5. Correct repeated attacks restart timed practice — P1**

[practiceSession.ts:74](src/application/practiceSession.ts#L74) infers a pause from time since the last successful attack, even during a written held note. The restart condition at line 96 then overrides a valid pending note when it shares the initial pitch.

Reproduce two C4 half notes at ticks 0 and 960, 120 BPM, default timing. Send C4 at **1000 ms** and **2000 ms**: both attacks are on time and the session is not waiting. The second attack still resets expected times from `[1000, 2000]` to `[2000, 3000]`; only the first target remains completed.

**Suggestion:** Prefer a valid pending-target match before inferring a restart. Detect hesitation relative to the next expected onset, including written duration/rests. Test repeated half notes, repeated tonic after a rest, and genuine paused continuation on the initial pitch.

**6. Independent random key selection ignores the pool — P2**

[generateExercise.ts:58](src/core/generation/generateExercise.ts#L58) considers only `tonal.keys[0]` for the first 20 candidates. Typical generation succeeds long before that. With the default independent/random request, seeds **0–99 all generated C major**, although the pool contains C, G, F, and D; 95 succeeded on candidate 1 and five on candidate 2.

**Suggestion:** Apply selection policy before rejection sampling: independent random practice samples the full pool; fixed practice retains its fixed key; progressive practice preserves its scheduled key. Add deterministic pool coverage and property tests for key membership/reproducibility. Broaden melody repetition tests across individual keys when changing this selection, since existing default-seed tests mostly exercise C major.

**7. General practice turns planned rests into notes — P2**

The general branch unconditionally writes `pitches: [pitch]` at [generateMelody.ts:619](src/core/generation/generateMelody.ts#L619), ignoring `atom.rest` and `restDensity`; the targeted branch handles rests.

Reproduce default C-major general practice with `restDensity = 1`, `tieDensity = 0`, style `mixed`, seed **2**. Seven events belong to `restAttack` cells, but there are **zero silent events**. Planned rests are printed and graded as sounding notes.

**Suggestion:** Realize rests consistently and avoid tie continuation, pitch-state mutation, or accidental-budget consumption for silent atoms. Test a rest cell through generated events, ABC `z`, and the expected MIDI timeline. Also align 3/4 rest-cell filtering with the density policy used in 4/4.

**8. Review ghost accidentals alter the expected notes — P2**

[exerciseToAbc.ts:103](src/adapters/abc/exerciseToAbc.ts#L103) emits accidentals on grace-note ghosts without updating serializer accidental state. ABCJS nevertheless carries that accidental through the bar.

Reproduce a C-major score containing two F4 quarter notes and a wrong-pitch annotation with played MIDI **66** on the first. Output `{^F}"_wrong"F2 F2 |` makes ABCJS interpret both expected Fs as MIDI **66**, instead of **65**.

**Suggestion:** Account for grace-note accidental propagation and restore required ordinary-note accidentals, or render ghosts outside the pitch-bearing ABC stream. Compare ordinary-note pitch interpretation before/after annotations across sharps, flats, naturals, and repeated notes.

**9. Nonsteady rhythm styles do not match their advertised behavior — P2**

[rhythmGrammar.ts:64](src/core/generation/rhythmGrammar.ts#L64) distinguishes only `steady`. With seed **5**, default general practice using `mixed`/density 0.65 and `challenge`/density 0.85 yields identical complete exercises, despite the UI promising more dotted/syncopated variety. Both densities exceed the same grammar threshold.

There is a simpler selected-value inconsistency: with `noteValue = half`, subdivision quarter, and Mostly steady, seed **5** produces durations **480, 960, and 1440**. Quarter notes are shorter than the selected half-note value, while the UI describes occasional *longer* notes.

**Suggestion:** Give each style explicit selection/weighting rules. Measure duration distributions and syncopated/dotted incidence over deterministic seed sets; do not require every individual pair of exercises to differ.

**10. Scale spelling is lost in supported keys — P2**

[melodicPatterns.ts:151](src/core/patterns/melodicPatterns.ts#L151) prefers flats only if the tonic string contains `b`. F major and D minor therefore spell their diatonic Bb as A#, and ABC serializes that pitch name directly.

Reproduce default request with `tonal.keys = ["F major"]`, seed **0**: event `rh-0-3`, tick **1200**, is **A#3**, tagged unaltered degree 4. This creates an unnecessary accidental and obscures scale/interval reading. D minor has the same problem with degree 6.

There is an additional edge-key octave error at line 154: degree metadata derives its octave from a simplified enharmonic name. `realizeDiatonicStep(C# major, 6)` returns C5/MIDI 72, but realizing its recorded degree returns C6/MIDI 84; Gb/Cb have analogous cases.

**Suggestion:** Preserve scale-degree letter spelling and derive its octave before enharmonic simplification. Test MIDI/name/degree roundtrips across the UI keys plus B#/Cb edge cases.

**11. Cadence types disagree with the actual progression — P2**

[harmonicGrammar.ts:203](src/core/generation/harmonicGrammar.ts#L203) chooses the penultimate function independently; ordinary realization at line 321 does not apply the cadence plan's penultimate chord.

Reproduce C major, steady eighths, ties/rests disabled: seed **11** closes IV–I tagged `strongTonic`; seed **16** closes V–I tagged `plagal`; seed **14** closes ii–I also tagged `plagal`.

**Suggestion:** Realize the planned chord pair in every harmonic-rhythm path, or classify the completed music truthfully. Test each cadence type against both harmonic progression and melodic arrival.

**12. Restart history contaminates the new attempt — P2**

The restart at [practiceSession.ts:97](src/application/practiceSession.ts#L97) clears completed targets and timing state but retains `performed`. Finish at line 171 evaluates the entire history against the rebased exercise.

Reproduce C4–D4–E4 quarter notes at 120 BPM: C at **1000 ms**, restart C at **5000**, D at **5500**, E at **6000**. A perfect new attempt reports **one extra note** and **eight beats of recovery** from the abandoned C.

**Suggestion:** Clear or segment performed events when restarting. A regression should assert no extra/recovery penalties from the abandoned attempt.

**13. Octave-doubled bass can skip correction targets — P2**

[practiceSession.ts:49](src/application/practiceSession.ts#L49) suppresses duplicate attacks by exact MIDI note, whereas [eventMatcher.ts:15](src/core/performance/eventMatcher.ts#L15) matches left-hand pitches by pitch class.

Reproduce two left-hand C3 targets at ticks 0 and 480 in correction mode: MIDI **48 at 1000 ms**, then **60 at 1001 ms**. One octave-doubled button burst completes both targets and ends the passage.

**Suggestion:** Group equivalent octave voices into one physical attack within the simultaneity window, while preserving later retriggers and bass/chord overlap. Test doubled basses/chords, a still-pending right-hand target, and properly released repetitions.

**14. Syncopation provenance is lost — P2/P3**

[rhythmGrammar.ts:36](src/core/generation/rhythmGrammar.ts#L36) marks a cell syncopated but does not carry that flag onto its atoms. [generateMelody.ts:613](src/core/generation/generateMelody.ts#L613) reads only the atom flag; [analyzeDifficulty.ts:41](src/core/generation/analyzeDifficulty.ts#L41) also misses eighth-grid syncopation because those onsets are divisible by 240.

Reproduce C-major general practice, `syncopation = 1`, ties/rests disabled, seed **1**. A quarter-note attack at **3120**, halfway through the beat, comes from `syncopatedQuarter`; its challenge tags are empty.

**Suggestion:** Preserve rhythmic provenance or derive syncopation from attacks/sustains against the meter. Distinguish offbeat sustained accents from ordinary short subdivisions.

**15. Double alterations realize the wrong displacement — P3**

[key.ts:13](src/core/music/key.ts#L13) turns alteration magnitude into an interval number. `2A` means augmented second; `2d` means diminished second, not two chromatic semitones.

C-major degree 1 with alteration **+2** returns D#4/MIDI **63**, rather than C double-sharp/MIDI **62**; **−2** returns C4/MIDI **60**, rather than C double-flat/MIDI **58**. The model permits these values, but this review did not establish a common UI path producing them.

**Suggestion:** Apply a chromatic offset while preserving the degree's letter. Test all permitted alterations −2 through +2.

**Additional suggestions, separate from confirmed defects**

- Give 6/8 a distinct dotted-quarter pulse. [meter.ts:4](src/core/music/meter.ts#L4) currently treats every eighth boundary as a medium beat, while ABC beaming already groups dotted quarters. Core tests accept 6/8, but the UI currently exposes only 3/4 and 4/4. Separate measure-denominator units from perceptual pulse before expanding the UI.
- Clarify diminished triad versus diminished seventh. [harmony.ts](src/core/music/harmony.ts) uses `[0,3,6]`; preserved Stradella diminished-button voicings use `[0,3,6,9]`. Keep the intentional device table, but model and document its harmonic meaning explicitly.
- Separate pending preferences from the settings of the active score. [usePracticeSessionController.ts:235](src/app/session/usePracticeSessionController.ts#L235) intentionally saves ungeneratable settings while keeping the old score; the status bar explains this, but README says previous settings and score remain active together. Bass-pattern instructions should describe the score being graded.
- Audit accepted request fields against actual generator behavior. A seed-11 probe produced identical hand events after changing allowed pattern families, chromaticism, challenge controls, and coordination settings. Some of these are only accessible through stored requests/API state. Implement their intended effects or narrow/document the schema; do not imply active customization where it is ignored.
- Reconcile unused difficulty bounds with the current generation policy. Difficulty is measured, but `requestedDifficultyBounds` is not applied by the generator. Document whether those numbers are diagnostic or intended constraints before reintroducing rejection rules.
- Decide whether adaptive-learning and anti-repetition modules are future infrastructure. Learning-profile update/persistence helpers have no current app callers, and session generation does not pass an anti-repetition tracker. Connect them deliberately or describe the current behavior accurately.
- Consider lazy loading score-rendering/MIDI dependencies after correctness work. The production main JavaScript chunk is about **1.04 MB minified / 299 KB gzip**, and Vite emits a size warning. This is a performance suggestion, not a build failure.

**Recommended next work**

First align both melody branches, bass realization, and cadence anchors to the same onset-based harmony. Then fix minor vii°, timed restart interpretation, and correction attack grouping. Follow with accidental/spelling correctness and rhythm controls. Add properties using independent musical oracles: active harmony by onset, named pitch versus scale-degree MIDI, planned versus realized cadence, and ABCJS-parsed pitch/duration versus the exercise timeline. Existing properties are useful but often assert validity using the generator's own metadata.
