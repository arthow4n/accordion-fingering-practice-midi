import { renderAbc } from "abcjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { exerciseToAbc } from "../adapters/abc/exerciseToAbc";
import { connectWebMidi } from "../adapters/midi/webMidiInput";
import { loadSettings, saveSettings } from "../adapters/persistence/settingsPersistence";
import { generateExercise } from "../core/generation/generateExercise";
import { exerciseDiagnostics } from "../core/generation/diagnostics";
import type { PerformedMidiEvent, TrainingIntent } from "../core/model";
import { evaluatePerformance } from "../core/performance/evaluatePerformance";
import type { PerformanceMetrics } from "../core/performance/performanceMetrics";
import { AbsoluteTimeline, ticksToMs } from "../core/performance/timeline";
import { defaultRuntimeMode, type TrainingRequest } from "../core/training/trainingIntent";

type RuntimeMode="correction"|"sightReading";
const nextSeed=()=>Math.floor(Math.random()*0x7fffffff);
const intents:TrainingIntent[]=["balanced","patternFocus","keyFluency","rhythmFocus","pitchIntervalFocus","readAhead","leftHandFocus","coordination","randomDecoding"];
const keys=["C major","G major","D major","F major","Bb major","Eb major","A minor","D minor","E minor"];
const legacyLines=[{id:"legacy-tonic-pedal-descending",label:"Tonic pedal: C/C–C/B–C/A–C/G"},{id:"legacy-transition-to-IV",label:"Counterbass walk to IV"},{id:"legacy-bb-fdim-line",label:"Bb–Fdim/B–Fdim/G–Fdim/G–F/C–D7"}] as const;

export default function App(){
 const scoreRef=useRef<HTMLDivElement>(null);const performedRef=useRef<PerformedMidiEvent[]>([]);const correctionNotesRef=useRef(new Set<number>());const timelineRef=useRef<AbsoluteTimeline>();const frameRef=useRef<number>();
 const [settings,setSettings]=useState(loadSettings);const [seed,setSeed]=useState(settings.seed??nextSeed);const [exercise,setExercise]=useState(()=>generateExercise(settings,seed));
 const [mode,setMode]=useState<RuntimeMode>(defaultRuntimeMode(settings.intent));const [status,setStatus]=useState<"ready"|"countIn"|"playing"|"finished">("ready");const [positionMs,setPositionMs]=useState(0);const [metrics,setMetrics]=useState<PerformanceMetrics>();const [devices,setDevices]=useState<string[]>([]);const [midiError,setMidiError]=useState("");const [correctionIndex,setCorrectionIndex]=useState(0);
 const expected=useMemo(()=>[...exercise.rightHand,...exercise.leftHand].filter(e=>e.pitches.length&&!e.metadata.tieFromPrevious).sort((a,b)=>a.onset-b.onset),[exercise]);
 const updateSettings=(next:TrainingRequest)=>{setSettings(next);saveSettings(next);};
 const regenerate=useCallback((newSeed=nextSeed())=>{const next=generateExercise(settings,newSeed);setSeed(newSeed);setExercise(next);setStatus("ready");setMetrics(undefined);setPositionMs(0);setCorrectionIndex(0);performedRef.current=[];correctionNotesRef.current.clear();console.debug(exerciseDiagnostics(next));},[settings]);
 const finish=useCallback(()=>{const timeline=timelineRef.current;if(!timeline)return;cancelAnimationFrame(frameRef.current??0);setMetrics(evaluatePerformance(exercise,performedRef.current,timeline.sessionStartMs()).metrics);setStatus("finished");},[exercise]);
 const acceptMidi=useCallback((event:PerformedMidiEvent)=>{if(event.type!=="noteOn")return;if(mode==="correction"){const target=expected[correctionIndex];if(target&&(!event.hand||event.hand===target.hand)&&target.pitches.some(p=>p.midi===event.midiNote)){correctionNotesRef.current.add(event.midiNote);if(target.pitches.every(p=>correctionNotesRef.current.has(p.midi))){correctionNotesRef.current.clear();const next=correctionIndex+1;setCorrectionIndex(next);setPositionMs(ticksToMs(target.onset+target.duration,exercise.tempoBpm));if(next>=expected.length)setStatus("finished");}}return;}if(status==="playing"||status==="countIn")performedRef.current.push(event);},[mode,expected,correctionIndex,exercise.tempoBpm,status]);
 useEffect(()=>{let disconnect:undefined|(()=>void);connectWebMidi(acceptMidi).then(x=>{setDevices(x.deviceNames);disconnect=x.disconnect;setMidiError("");}).catch(e=>setMidiError(e instanceof Error?e.message:String(e)));return()=>disconnect?.();},[acceptMidi]);
 useEffect(()=>{if(scoreRef.current)renderAbc(scoreRef.current,exerciseToAbc(exercise),{add_classes:true,responsive:"resize"});},[exercise]);
 useEffect(()=>()=>cancelAnimationFrame(frameRef.current??0),[]);
 const start=()=>{if(mode==="correction"){setStatus("playing");return;}performedRef.current=[];const timeline=new AbsoluteTimeline(exercise,0,4);timelineRef.current=timeline;const sessionStart=timeline.start(performance.now());setStatus("countIn");const tick=()=>{const now=performance.now();if(now>=sessionStart)setStatus("playing");setPositionMs(timeline.positionAt(now));if(timeline.isFinished(now)){finish();return;}frameRef.current=requestAnimationFrame(tick);};frameRef.current=requestAnimationFrame(tick);};
 const setIntent=(intent:TrainingIntent)=>{const next={...settings,intent};updateSettings(next);setMode(defaultRuntimeMode(intent));};
 const totalMs=ticksToMs(exercise.totalDuration,exercise.tempoBpm);const progress=Math.min(100,positionMs/totalMs*100);
 return <main>
  <p className="summary">{exercise.tonalContext.tonic} {exercise.tonalContext.mode} · {exercise.meter.beats}/{exercise.meter.beatUnit} · {exercise.tempoBpm} bpm · seed {seed}</p>
  <div className="track" ref={scoreRef}/><div className="progress"><span style={{width:`${progress}%`}}/></div>
  <p>{status==="countIn"?"Count in…":status==="playing"?mode==="correction"?`Event ${correctionIndex+1} of ${expected.length}`:"Sight-reading—keep the pulse":status==="finished"?"Exercise complete":"Ready"}</p>
  {metrics&&<p>Pitch {(metrics.pitchAccuracy*100).toFixed(0)}% · timing {(metrics.timingAccuracy*100).toFixed(0)}% · continuity {(metrics.continuity*100).toFixed(0)}% · missed {metrics.missedNotes} · extra {metrics.extraNotes}</p>}
  <p><button onClick={start} disabled={status==="playing"||status==="countIn"}>Start</button>{" "}<button onClick={()=>regenerate()}>New exercise</button>{" "}<button onClick={()=>regenerate(seed)}>Replay seed</button></p>
  <fieldset><legend>Practice settings</legend>
   <label>Training mode <select value={settings.intent} onChange={e=>setIntent(e.target.value as TrainingIntent)}>{intents.map(x=><option key={x}>{x}</option>)}</select></label>{" "}
   <label>Execution <select value={mode} onChange={e=>setMode(e.target.value as RuntimeMode)}><option value="sightReading">Timed sight-reading</option><option value="correction">Correction / drill</option></select></label>{" "}
   <label>Key <select value={settings.tonal.keys.length===1?settings.tonal.keys[0]:"pool"} onChange={e=>updateSettings({...settings,tonal:{...settings.tonal,keys:e.target.value==="pool"?["C major","G major","D major","F major"]:[e.target.value],selection:e.target.value==="pool"?"random":"fixed"}})}><option value="pool">Easy key pool</option>{keys.map(x=><option key={x}>{x}</option>)}</select></label>{" "}
   <label>Tempo <input type="number" min="30" max="240" value={settings.tempoBpm} onChange={e=>updateSettings({...settings,tempoBpm:Number(e.target.value)})}/></label>{" "}
   <label>Measures <input type="number" min="2" max="32" value={settings.measures} onChange={e=>updateSettings({...settings,measures:Number(e.target.value)})}/></label>{" "}
   <label><input type="checkbox" checked={settings.leftHand.enabled} onChange={e=>updateSettings({...settings,leftHand:{...settings.leftHand,enabled:e.target.checked}})}/> Left hand</label>
   {" "}<label>Curated bass line <select value={settings.leftHand.templateId??""} onChange={e=>{const templateId=e.target.value||undefined;const isBb=templateId==="legacy-bb-fdim-line";updateSettings({...settings,measures:templateId?(isBb?6:4):settings.measures,tonal:isBb?{...settings.tonal,keys:["Bb major"],selection:"fixed"}:settings.tonal,rhythm:templateId?{...settings.rhythm,meters:[{beats:3,beatUnit:4}]}:settings.rhythm,leftHand:{...settings.leftHand,enabled:true,accompanimentStyle:"polka",templateId:templateId as TrainingRequest["leftHand"]["templateId"]}});}}><option value="">Automatic style</option>{legacyLines.map(line=><option key={line.id} value={line.id}>{line.label}</option>)}</select></label>
  </fieldset>
  <details><summary>Generator diagnostics</summary><pre>{exerciseDiagnostics(exercise)}</pre></details>
  <p>Detected MIDI: {devices.join(", ")||midiError||"none (you can still inspect generated scores)"}</p>
 </main>;
}
