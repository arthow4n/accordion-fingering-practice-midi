import { describe, expect, it } from "vitest";
import type { Exercise, ExerciseEvent, Hand, PerformedMidiEvent } from "../core/model";
import { defaultTimingSettings, timingOptions } from "../core/performance/timingSettings";
import { PracticeSession } from "./practiceSession";
import { generateExercise } from "../core/generation/generateExercise";
import { defaultTrainingRequest, parseTrainingRequest } from "../core/training/trainingIntent";
import { createExpectedTimeline } from "../core/performance/timeline";
import { evaluatePerformance } from "../core/performance/evaluatePerformance";

const note=(onset:number,pitches:number[],hand:Hand="right",duration=480):ExerciseEvent=>({id:`${hand}-${onset}`,onset,duration,pitches:pitches.map(midi=>({midi,name:"C4"})),hand,metadata:{challengeTags:[]}});
const base=generateExercise(defaultTrainingRequest(),0);
const exercise=(rightHand:ExerciseEvent[],leftHand:ExerciseEvent[]=[]):Exercise=>({...base,tempoBpm:120,totalDuration:1920,rightHand,leftHand});
const midi=(midiNote:number,timestampMs:number,hand:Hand="right",type:"noteOn"|"noteOff"="noteOn"):PerformedMidiEvent=>({midiNote,timestampMs,hand,type,velocity:100});
const timing=()=>({...defaultTimingSettings(),followAfterPause:false});

describe("synchronous practice sessions",()=>{
 it("anchors a leading rest to the first sounding note and retains a starting MIDI burst",()=>{
  const s=new PracticeSession(exercise([note(0,[]),note(480,[60])],[note(0,[48],"left")]),"right","sightReading",timing());
  s.accept(midi(60,1000));expect(s.expected[0]!.expectedMs).toBe(1000);expect(s.positionMs(1000)).toBe(500);
  s.accept(midi(61,1001));expect(s.performed).toHaveLength(2);
 });
 it("records all notes in a starting chord without restarting the clock",()=>{
  const s=new PracticeSession(exercise([note(0,[60,64,67])]),"right","sightReading",timing());
  for(const p of [60,64,67])s.accept(midi(p,1000));
  expect(s.performed).toHaveLength(3);expect(s.finish().pitchAccuracy).toBe(1);
 });
 it("advances both hands atomically and completes simultaneous final events once",()=>{
  const s=new PracticeSession(exercise([note(0,[60]),note(480,[62])],[note(0,[48],"left"),note(480,[50],"left")]),"both","correction",timing());
  expect(s.accept(midi(60,1000)).accepted).toBe(1);
  expect(s.accept(midi(62,1100)).wrong).toBe(1); // Other hand still owes beat 1.
  s.accept(midi(48,1200,"left"));expect(s.correctionOnset).toBe(480);
  s.accept(midi(62,1500));expect(s.accept(midi(50,1500,"left")).completed).toBe(true);
  expect(s.accept(midi(50,1501,"left")).completed).toBe(false);
 });
 it("requires the notes of a correction chord within the chord-spread window",()=>{
  const s=new PracticeSession(exercise([],[note(0,[48,52,55],"left")]),"left","correction",timing());
  s.accept(midi(48,1000,"left"));s.accept(midi(52,2000,"left"));s.accept(midi(55,2020,"left"));
  expect(s.done).toBe(false);expect(s.accept(midi(48,2040,"left")).completed).toBe(true);
 });
 it("recovers after a hesitation, shifts later targets, and records the pause",()=>{
  const s=new PracticeSession(exercise([note(0,[60]),note(480,[62]),note(960,[64])]),"right","sightReading",defaultTimingSettings());
  s.accept(midi(60,1000));expect(s.isWaiting(2500)).toBe(true);expect(s.shouldFinish(5000)).toBe(false);
  s.accept(midi(62,3000));expect(s.expected.map(e=>e.expectedMs)).toEqual([1000,3000,3500]);
  s.accept(midi(64,3500));const metrics=s.finish();
  expect(metrics.pitchAccuracy).toBe(1);expect(metrics.longestHesitationMs).toBe(1500);expect(metrics.continuity).toBeLessThan(1);
 });
 it("keeps the absolute pulse when recovery assistance is disabled",()=>{
  const s=new PracticeSession(exercise([note(0,[60]),note(480,[62])]),"right","sightReading",timing());
  s.accept(midi(60,1000));s.accept(midi(62,3000));
  expect(s.expected[1]!.expectedMs).toBe(1500);expect(s.finish().pitchAccuracy).toBe(.5);
 });
 it("waits for the late tolerance at the end instead of discarding a final attack",()=>{
  const e=exercise([note(1800,[60],"right",120)]);
  const s=new PracticeSession(e,"right","sightReading",timing());s.accept(midi(60,2000));
  expect(s.shouldFinish(2125)).toBe(false);expect(s.shouldFinish(2500)).toBe(true);
 });
 it("uses loose tempo-relative defaults and honors custom tolerances",()=>{
  expect(timingOptions(defaultTimingSettings(),60).correctLateMs).toBe(500);
  expect(timingOptions(defaultTimingSettings(),120).correctLateMs).toBe(250);
  const custom={...timing(),strictness:"custom" as const,earlyMs:600,lateMs:900,chordMs:200};
  expect(timingOptions(custom,120)).toMatchObject({correctEarlyMs:600,correctLateMs:900,simultaneityWindowMs:200});
 });
 it("merges tied durations and does not reward silence with perfect continuity",()=>{
  const first=note(0,[60]),second=note(480,[60]);first.metadata.tieToNext=true;second.metadata.tieFromPrevious=true;
  const e=exercise([first,second]);expect(createExpectedTimeline(e)[0]!.durationMs).toBe(1000);
  const metrics=evaluatePerformance(e,[],0).metrics;expect(metrics.continuity).toBe(0);expect(metrics.longestHesitationMs).toBe(1000);
 });
 it("migrates old settings to forgiving timing and avoids empty left-only recognition",()=>{
  const raw={...defaultTrainingRequest(),timing:undefined,intent:"noteRecognition",hands:"left"};
  const parsed=parseTrainingRequest(raw);expect(parsed.timing).toEqual(defaultTimingSettings());expect(parsed.hands).toBe("right");
 });
 it("migrates the old note-frequency controls to an equivalent mixed rhythm",()=>{
  const raw=defaultTrainingRequest() as unknown as {rhythm:Record<string,unknown>};delete raw.rhythm.noteValue;delete raw.rhythm.style;raw.rhythm.smallestSubdivision="sixteenth";raw.rhythm.noteDensity=.85;
  expect(parseTrainingRequest(raw).rhythm).toMatchObject({noteValue:"sixteenth",style:"mixed"});
 });
});

it("does not let duplicate bass voices consume the next repeated correction target",()=>{
 const s=new PracticeSession(exercise([],[note(0,[48],"left"),note(480,[48],"left")]),"left","correction",timing());
 s.accept(midi(48,1000,"left"));expect(s.accept(midi(48,1001,"left")).accepted).toBe(0);
 s.accept(midi(48,1100,"left","noteOff"));expect(s.accept(midi(48,1500,"left")).completed).toBe(true);
});
it("leaves a silent final passage waiting in follow mode until finished explicitly",()=>{
 const s=new PracticeSession(exercise([note(0,[60]),note(480,[62])]),"right","sightReading",defaultTimingSettings());
 s.accept(midi(60,1000));expect(s.shouldFinish(10000)).toBe(false);
 const metrics=s.finish();expect(metrics.missedNotes).toBe(1);expect(s.done).toBe(true);
});
it("does not stretch the clock for an intentional rest",()=>{
 const s=new PracticeSession(exercise([note(0,[60]),note(1440,[62])]),"right","sightReading",defaultTimingSettings());
 s.accept(midi(60,1000));s.accept(midi(62,2500));expect(s.recoveryCount).toBe(0);expect(s.finish().pitchAccuracy).toBe(1);
});

it("allows overlapping bass and chord roots at distinct correction onsets",()=>{
 const s=new PracticeSession(exercise([],[note(0,[48],"left"),note(480,[48,52,55],"left")]),"left","correction",timing());
 s.accept(midi(48,1000,"left")); // Bass can remain held while the chord begins.
 s.accept(midi(48,1500,"left"));s.accept(midi(52,1501,"left"));
 expect(s.accept(midi(55,1502,"left")).completed).toBe(true);
});

it("recovers when a wrong restart note is followed by the correct note",()=>{
 const s=new PracticeSession(exercise([note(0,[60]),note(480,[62])]),"right","sightReading",defaultTimingSettings());
 s.accept(midi(60,1000));s.accept(midi(70,3000));s.accept(midi(62,3100));
 expect(s.recoveryCount).toBe(1);expect(s.expected[1]!.expectedMs).toBe(3100);
 expect(s.finish().pitchAccuracy).toBe(1);
});
