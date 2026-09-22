import { Note } from "tonal";
import { registerForSeed } from "../core/generation/pitchRegister";
import { renderScore } from "../adapters/abc/renderScore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { UpdateBanner } from "./pwa/UpdateBanner";
import { AppFooter } from "./pwa/AppFooter";
import { exerciseToAbc } from "../adapters/abc/exerciseToAbc";
import { connectWebMidi, type MidiListener } from "../adapters/midi/webMidiInput";
import {
  clearSettings,
  deletePreset,
  loadPresets,
  loadStoredSession,
  savePreset,
  saveSettings,
  type ConfigPreset,
  type RuntimeMode,
} from "../adapters/persistence/settingsPersistence";
import { generateExercise } from "../core/generation/generateExercise";
import { exerciseDiagnostics } from "../core/generation/diagnostics";
import { accompanimentInstruction, accompanimentOptionLabel, accompanimentStylesForMeter } from "../core/patterns/accompanimentTemplates";
import type { PerformedMidiEvent, TrainingIntent } from "../core/model";
import { PracticeSession } from "../application/practiceSession";
import { generateFirstValidCandidate } from "../application/generateCandidate";
import { timingOptions } from "../core/performance/timingSettings";
import type { PerformanceMetrics } from "../core/performance/performanceMetrics";

import { defaultRuntimeMode, defaultTrainingRequest, parseTrainingRequest, type TrainingRequest } from "../core/training/trainingIntent";

type HandMode=TrainingRequest["hands"];
type SessionStats={completedExercises:number;completedEvents:number;attempts:number;correct:number;timingCorrect:number;missed:number;extra:number};
const emptySessionStats:SessionStats={completedExercises:0,completedEvents:0,attempts:0,correct:0,timingCorrect:0,missed:0,extra:0};
const nextSeed=()=>Math.floor(Math.random()*0x2aaaaaaa)*3;
const randomSeeds=(first=nextSeed())=>[first,nextSeed(),nextSeed(),nextSeed(),nextSeed(),nextSeed()];
const sequentialSeeds=(first:number)=>[first,first+1,first+2,first+3,first+4,first+5];
const intents:readonly {value:TrainingIntent;label:string}[]=[{value:"general",label:"General sight-reading"},{value:"noteRecognition",label:"Note recognition"},{value:"patternsIntervals",label:"Patterns and intervals"},{value:"rhythm",label:"Rhythm"},{value:"leftHand",label:"Left-hand reading"},{value:"coordination",label:"Two-hand coordination"}];
const patternFamilies:readonly {value:string;label:string}[]=[{value:"repeated",label:"Repeated notes"},{value:"scale",label:"Scale fragments"},{value:"thirds",label:"Thirds"},{value:"triad",label:"Triads"},{value:"arpeggio",label:"Arpeggios"},{value:"neighbor",label:"Neighbor notes"},{value:"passing",label:"Passing notes"},{value:"leapRecovery",label:"Leap and recovery"},{value:"sequence",label:"Sequences"},{value:"cadence",label:"Cadential figures"},{value:"chordTone",label:"Chord-tone turns"}];
const keys=["C major","G major","D major","F major","Bb major","Eb major","A minor","D minor","E minor"];
const bassRoots=["Ab","Eb","Bb","F","C","G","D","A","E","B"] as const;
const bassPatterns:readonly TrainingRequest["leftHand"]["accompanimentStyle"][]=["bassChord","alternatingBass","polka","waltz","tango","swing"];
const legacyLines=[{id:"legacy-tonic-pedal-descending",label:"Tonic pedal: C/C–C/B–C/A–C/G"},{id:"legacy-transition-to-IV",label:"Counterbass walk: C/C–C/D–C/E–F"},{id:"legacy-bb-fdim-line",label:"Bb–Fdim/B–Fdim/G–Fdim/G–F/C–D7"}] as const;
const noteValues=[{value:"half",label:"Half notes"},{value:"quarter",label:"Quarter notes"},{value:"eighth",label:"Eighth notes"},{value:"sixteenth",label:"Sixteenth notes"}] as const;
const rhythmStyles=[{value:"steady",label:"Steady — selected value only"},{value:"mostlySteady",label:"Mostly steady — occasional longer notes"},{value:"mixed",label:"Mixed — varied note values"},{value:"challenge",label:"Rhythm challenge — dotted and syncopated"}] as const;
const rhythmLegacyValues=(noteValue:TrainingRequest["rhythm"]["noteValue"],style:TrainingRequest["rhythm"]["style"])=>(
 {smallestSubdivision:noteValue==="sixteenth"?"sixteenth" as const:noteValue==="eighth"?"eighth" as const:"quarter" as const,noteDensity:style==="steady"?noteValue==="sixteenth"?1:noteValue==="eighth"?.55:.3:style==="mostlySteady"?.55:style==="challenge"?.85:.65}
);

function IntegerInput({label,value,min,max,onCommit}:{label:string;value:number;min:number;max:number;onCommit:(value:number)=>void}){
 const [draft,setDraft]=useState(String(value));
 useEffect(()=>setDraft(String(value)),[value]);
 const commit=()=>{const parsed=/^\d+$/.test(draft)?Number(draft):NaN;if(Number.isInteger(parsed)&&parsed>=min&&parsed<=max)onCommit(parsed);else setDraft(String(value));};
 return <label>{label} <input type="text" inputMode="numeric" value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}}/></label>;
}

export default function App(){
 const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | undefined>();
 const {
  needRefresh: [needRefresh, setNeedRefresh],
  updateServiceWorker,
 } = useRegisterSW({
  onRegisteredSW(_swUrl, r) {
   setSwRegistration(r);
  },
  onRegisterError(error) {
   console.error("SW registration error", error);
  },
 });
 const scoreRef=useRef<HTMLDivElement>(null);const frameRef=useRef<number>();const midiListenerRef=useRef<MidiListener>(()=>{});
 const [initial]=useState(()=>{const session=loadStoredSession(),seed=session.settings.seed??nextSeed();try{const candidate=generateFirstValidCandidate(randomSeeds(seed),candidateSeed=>generateExercise(session.settings,candidateSeed));return {settings:session.settings,mode:session.mode,seed:candidate.seed,exercise:candidate.value,error:""};}catch(error){const settings=defaultTrainingRequest();return {settings,mode:defaultRuntimeMode(settings.intent),seed:0,exercise:generateExercise(settings,0),error:error instanceof Error?error.message:String(error)};}});
 const [initialSession]=useState(()=>new PracticeSession(initial.exercise,initial.settings.hands,initial.mode,initial.settings.timing));
 const sessionRef=useRef(initialSession);
 const [waiting,setWaiting]=useState(false);
 const [settings,setSettings]=useState(initial.settings);const [seed,setSeed]=useState(initial.seed);const [exercise,setExercise]=useState(initial.exercise);
 const [mode,setMode]=useState<RuntimeMode>(initial.mode);const [status,setStatus]=useState<"ready"|"playing">(initial.mode==="correction"?"playing":"ready");const [positionMs,setPositionMs]=useState(0);const [metrics,setMetrics]=useState<PerformanceMetrics>();const [sessionStats,setSessionStats]=useState(emptySessionStats);const [devices,setDevices]=useState<string[]>([]);const [midiError,setMidiError]=useState("");const [generationError,setGenerationError]=useState(initial.error);const [settingsPendingScore,setSettingsPendingScore]=useState(false);
 const [rightIndex,setRightIndex]=useState(0);const [leftIndex,setLeftIndex]=useState(0);
 const [presets,setPresets]=useState<ConfigPreset[]>(()=>loadPresets());
 const [selectedPresetId,setSelectedPresetId]=useState<string>("");
 const [presetDraft,setPresetDraft]=useState<string>("");

 const handleSavePreset=()=>{
  const name=presetDraft.trim()||`Preset ${presets.length+1}`;
  const saved=savePreset(name,settings,mode);
  const updated=loadPresets();
  setPresets(updated);
  setSelectedPresetId(saved.id);
  setPresetDraft(saved.name);
 };

 const handleLoadPreset=()=>{
  const target=presets.find(p=>p.id===selectedPresetId);
  if(!target)return;
  const targetMode=target.mode??defaultRuntimeMode(target.settings.intent);
  updateSettings(target.settings,true,targetMode);
  setPresetDraft(target.name);
 };

 const handleDeletePreset=()=>{
  if(!selectedPresetId)return;
  deletePreset(selectedPresetId);
  const updated=loadPresets();
  setPresets(updated);
  setSelectedPresetId("");
  setPresetDraft("");
 };

 const rightCount=sessionRef.current.count("right"),leftCount=sessionRef.current.count("left");
 const hasRight=rightCount>0,hasLeft=leftCount>0;

 const resetSession=(nextExercise=exercise,nextSettings=settings,nextMode=mode)=>{
  cancelAnimationFrame(frameRef.current??0);
  sessionRef.current=new PracticeSession(nextExercise,nextSettings.hands,nextMode,nextSettings.timing);
  setStatus(nextMode==="correction"?"playing":"ready");
  setWaiting(false);setPositionMs(0);setRightIndex(0);setLeftIndex(0);
 };
 const changeMode=(nextMode:RuntimeMode)=>{
  resetSession(exercise,settings,nextMode);setMode(nextMode);setMetrics(undefined);saveSettings(settings,nextMode);
 };
 const updateSettings=(raw:TrainingRequest,persist=true,nextMode=mode,keepValidSettingsOnGenerationFailure=true)=>{
  // Generate before changing the active settings, score, or persisted session.
  let next:TrainingRequest|undefined;
  try{
   next=parseTrainingRequest(raw);const candidate=generateFirstValidCandidate(randomSeeds(),candidateSeed=>generateExercise(next!,candidateSeed));
   resetSession(candidate.value,next,nextMode);
   setSettings(next);setMode(nextMode);setSeed(candidate.seed);setExercise(candidate.value);setMetrics(undefined);setGenerationError("");setSettingsPendingScore(false);
   if(persist)saveSettings(next,nextMode);
   return true;
  }catch(error){
   if(next&&keepValidSettingsOnGenerationFailure){
    resetSession(exercise,next,nextMode);
    setSettings(next);setMode(nextMode);setMetrics(undefined);setSettingsPendingScore(true);
    if(persist)saveSettings(next,nextMode);
   }
   setGenerationError(error instanceof Error?error.message:String(error));return false;
  }
 };
 const updateTiming=(timing:TrainingRequest["timing"])=>{
  const next=parseTrainingRequest({...settings,timing});
  resetSession(exercise,next);setSettings(next);setMetrics(undefined);saveSettings(next,mode);
 };
 const regenerate=useCallback((newSeed=seed+1,preserveMetrics=false,retry=true)=>{
  try{
   const candidate=generateFirstValidCandidate(retry?sequentialSeeds(newSeed):[newSeed],candidateSeed=>generateExercise(settings,candidateSeed)),next=candidate.value;
   cancelAnimationFrame(frameRef.current??0);
   sessionRef.current=new PracticeSession(next,settings.hands,mode,settings.timing);
   setSeed(candidate.seed);setExercise(next);setStatus(mode==="correction"?"playing":"ready");
   setWaiting(false);setPositionMs(0);setRightIndex(0);setLeftIndex(0);
   if(!preserveMetrics)setMetrics(undefined);
   setGenerationError("");setSettingsPendingScore(false);
  }catch(error){
   cancelAnimationFrame(frameRef.current??0);setStatus("ready");
   setGenerationError(error instanceof Error?error.message:String(error));
  }
 },[settings,mode,seed]);
 const finish=useCallback(()=>{
  const session=sessionRef.current;
  if(session.done||!session.started)return;
  cancelAnimationFrame(frameRef.current??0);
  const result=session.finish();setMetrics(result);
  const attempts=result.rightHand.attempts+result.leftHand.attempts,correct=result.rightHand.correct+result.leftHand.correct;
  setSessionStats(x=>({...x,completedExercises:x.completedExercises+1,completedEvents:x.completedEvents+attempts,attempts:x.attempts+attempts,correct:x.correct+correct,timingCorrect:x.timingCorrect+Math.round(result.timingAccuracy*attempts),missed:x.missed+result.missedNotes,extra:x.extra+result.extraNotes}));
  regenerate(seed+1,true);
 },[regenerate,seed]);
 const acceptMidi=useCallback((event:PerformedMidiEvent)=>{
  const session=sessionRef.current,wasStarted=session.started;
  const result=session.accept(event);
  if(session.mode==="correction"){
   if(result.accepted||result.wrong){
    setRightIndex(session.completed("right"));setLeftIndex(session.completed("left"));
    setSessionStats(x=>({...x,completedEvents:x.completedEvents+result.accepted,attempts:x.attempts+result.accepted+result.wrong,correct:x.correct+result.accepted,completedExercises:x.completedExercises+(result.completed?1:0)}));
   }
   if(result.completed){
    // Leave the completed session in place through this MIDI burst.
    frameRef.current=requestAnimationFrame(()=>regenerate(seed+1,true));
   }
  }else if(!wasStarted&&session.started){
   setStatus("playing");
   const tick=()=>{
    if(sessionRef.current!==session)return;
    const now=performance.now();setPositionMs(session.positionMs(now));setWaiting(session.isWaiting(now));
    if(session.shouldFinish(now)){finish();return;}
    frameRef.current=requestAnimationFrame(tick);
   };
   frameRef.current=requestAnimationFrame(tick);
  }
 },[finish,regenerate,seed]);

 useEffect(()=>{midiListenerRef.current=acceptMidi;},[acceptMidi]);
 useEffect(()=>{let cancelled=false;let disconnect:undefined|(()=>void);connectWebMidi(event=>midiListenerRef.current(event),names=>{if(!cancelled)setDevices(names);}).then(x=>{if(cancelled)x.disconnect();else{setDevices(x.deviceNames);disconnect=x.disconnect;setMidiError("");}}).catch(e=>{if(!cancelled)setMidiError(e instanceof Error?e.message:String(e));});return()=>{cancelled=true;disconnect?.();};},[]);

 const playhead=mode==="correction"?sessionRef.current.correctionOnset:status==="playing"?(positionMs/60_000)*exercise.tempoBpm*480:0;
 // Pass the actual position so a held note split at a bass annotation highlights
 // the current segment rather than the beginning of the original melody event.
 const scorePositions=useMemo(()=>[...new Set([...exercise.rightHand.map(e=>e.onset),...exercise.leftHand.filter(e=>e.metadata.leadSheetAnnotation).map(e=>e.onset)])].sort((a,b)=>a-b),[exercise]);
 const markedOnset=playhead===undefined?undefined:scorePositions.filter(onset=>onset<=playhead).at(-1);
 const tolerance=timingOptions(settings.timing,exercise.tempoBpm);

 useEffect(()=>{if(scoreRef.current)renderScore(scoreRef.current,exerciseToAbc(exercise,markedOnset));},[exercise,markedOnset]);
 useEffect(()=>{if(!("wakeLock" in navigator))return;let lock:WakeLockSentinel|undefined;const acquire=async()=>{try{await lock?.release();lock=await navigator.wakeLock.request("screen");}catch{lock=undefined;}};const visibility=()=>{if(document.visibilityState==="visible")void acquire();};void acquire();document.addEventListener("visibilitychange",visibility);return()=>{document.removeEventListener("visibilitychange",visibility);void lock?.release();};},[]);
 useEffect(()=>()=>cancelAnimationFrame(frameRef.current??0),[]);
 const setIntent=(intent:TrainingIntent)=>{const nextMode=defaultRuntimeMode(intent);updateSettings({...settings,intent},true,nextMode);};
 const reset=()=>{if(!window.confirm("Reset all practice settings to their defaults? Saved presets will not be deleted."))return;const defaults=defaultTrainingRequest();clearSettings();updateSettings(defaults,false,defaultRuntimeMode(defaults.intent));};
 return <main>
  <UpdateBanner
   show={needRefresh}
   onUpdate={() => updateServiceWorker(true)}
   onDismiss={() => setNeedRefresh(false)}
  />
  <div className="track" ref={scoreRef}/>
  {hasLeft&&<p className="accompaniment-instruction"><strong>Left hand:</strong> {accompanimentInstruction(settings.leftHand.accompanimentStyle,exercise.meter,settings.leftHand.templateId)}</p>}
  <p>{mode==="correction"
    ?hasRight&&hasLeft
     ?`Right hand: ${rightIndex>=rightCount?"done":`${rightIndex+1} of ${rightCount}`} · Left hand: ${leftIndex>=leftCount?"done":`${leftIndex+1} of ${leftCount}`}`
     :hasRight
      ?`Event ${Math.min(rightIndex+1,rightCount)} of ${rightCount}`
      :`Event ${Math.min(leftIndex+1,leftCount)} of ${leftCount}${sessionRef.current.currentExpected("left")?.metadata.stradellaButton?` · Next: ${sessionRef.current.currentExpected("left")!.metadata.stradellaButton}`:""}`
    :status==="playing"
     ?waiting?"Paused — resume playing, or finish this exercise":"Sight-reading—keep the pulse"
     :"Ready — play the first note on the accordion to begin"
  }</p>
  <p>Completed {sessionStats.completedExercises} exercises · {sessionStats.completedEvents} events · correct {sessionStats.attempts?`${(sessionStats.correct/sessionStats.attempts*100).toFixed(0)}%`:"—"} · missed {sessionStats.missed} · extra {sessionStats.extra}</p>
  {metrics&&<p>Last exercise: pitch {(metrics.pitchAccuracy*100).toFixed(0)}% · timing {(metrics.timingAccuracy*100).toFixed(0)}% · continuity {(metrics.continuity*100).toFixed(0)}%{metrics.durationAccuracy!==undefined&&<> · note lengths {(metrics.durationAccuracy*100).toFixed(0)}%</>} · longest hesitation {(metrics.longestHesitationMs/1000).toFixed(1)}s</p>}
  {generationError&&<p role="alert">Requested settings could not generate a new exercise. {settingsPendingScore?"Your selection was saved; the current score remains active until a new one can be generated.":"The previous settings and score remain active."} {generationError}</p>}
  <p>{mode==="sightReading"&&status==="playing"&&<><button onClick={finish}>Finish exercise</button>{" "}</>}<button onClick={()=>regenerate()}>New exercise</button>{" "}<button onClick={()=>regenerate(seed,false,false)}>Replay seed</button>{" "}<button onClick={()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen({navigationUI:"hide"})}>Full screen</button></p>
  <fieldset><legend>Practice settings</legend>
   <label>Training mode <select value={settings.intent} onChange={e=>setIntent(e.target.value as TrainingIntent)}>{intents.map(intent=><option key={intent.value} value={intent.value}>{intent.label}</option>)}</select></label>{" "}
   <label>Execution <select value={mode} onChange={e=>changeMode(e.target.value as RuntimeMode)}><option value="sightReading">Timed sight-reading</option><option value="correction">Correction / drill</option></select></label>{" "}
   <label>Hands <select value={settings.hands} onChange={e=>updateSettings({...settings,hands:e.target.value as HandMode,leftHand:{...settings.leftHand,enabled:true,templateId:e.target.value==="right"?undefined:settings.leftHand.templateId}})}><option value="both">Both</option><option value="right">Right hand only</option><option value="left" disabled={settings.intent==="noteRecognition"}>Left hand only</option></select></label>{" "}
   {settings.intent==="noteRecognition"&&<span>Note recognition practices the right hand.</span>}
   <label>Key <select value={settings.tonal.keys.length===1?settings.tonal.keys[0]:"pool"} onChange={e=>updateSettings({...settings,tonal:{...settings.tonal,keys:e.target.value==="pool"?["C major","G major","D major","F major"]:[e.target.value],selection:e.target.value==="pool"?"random":"fixed"}})}><option value="pool">Easy key pool</option>{keys.map(x=><option key={x}>{x}</option>)}</select></label>{" "}
   <label>Pitch range <select value={settings.pitchRegister} onChange={e=>updateSettings({...settings,pitchRegister:e.target.value as TrainingRequest["pitchRegister"]})}><option value="rotating">Full range — rotating</option><option value="low">Low (G3–G4)</option><option value="middle">Middle (G4–G5)</option><option value="high">High (G5–G6)</option><option value="custom">Custom</option></select></label>
   {settings.pitchRegister==="rotating"&&<span>Current register: {registerForSeed(seed)} </span>}
   {settings.pitchRegister==="custom"&&(["low","high"] as const).map(bound=><label key={bound}>{bound==="low"?"Lowest note":"Highest note"} <select value={settings.rightHand.range[bound]} onChange={e=>{const value=Number(e.target.value);const range={...settings.rightHand.range,[bound]:value};if(bound==="low")range.high=Math.max(value,range.high);else range.low=Math.min(value,range.low);updateSettings({...settings,rightHand:{...settings.rightHand,range}});}}>{Array.from({length:37},(_,i)=>i+55).map(midi=><option key={midi} value={midi}>{Note.fromMidi(midi)}</option>)}</select></label>)}
   <label>Time signature <select value={`${settings.rhythm.meters[0]!.beats}/${settings.rhythm.meters[0]!.beatUnit}`} onChange={e=>{const [beats,beatUnit]=e.target.value.split("/").map(Number),meter={beats,beatUnit:beatUnit as 4|8},styles=accompanimentStylesForMeter(meter),accompanimentStyle=styles.includes(settings.leftHand.accompanimentStyle)?settings.leftHand.accompanimentStyle:"bassChord",noteValue=beats===3&&settings.rhythm.noteValue==="half"?"quarter":settings.rhythm.noteValue;updateSettings({...settings,rhythm:{...settings.rhythm,...rhythmLegacyValues(noteValue,settings.rhythm.style),noteValue,meters:[meter]},leftHand:{...settings.leftHand,accompanimentStyle,templateId:undefined}});}}><option value="3/4">3/4</option><option value="4/4">4/4</option></select></label>{" "}
   <IntegerInput label="Tempo" value={settings.tempoBpm} min={30} max={240} onCommit={tempoBpm=>updateSettings({...settings,tempoBpm})}/>{" "}
   <label>Note value <select value={settings.rhythm.noteValue} onChange={e=>{const noteValue=e.target.value as TrainingRequest["rhythm"]["noteValue"];updateSettings({...settings,rhythm:{...settings.rhythm,...rhythmLegacyValues(noteValue,settings.rhythm.style),noteValue}});}}>{noteValues.map(option=><option key={option.value} value={option.value} disabled={option.value==="half"&&settings.rhythm.meters[0]!.beats===3}>{option.label}</option>)}</select></label>{" "}
   <label>Rhythm style <select value={settings.rhythm.style} onChange={e=>{const style=e.target.value as TrainingRequest["rhythm"]["style"];updateSettings({...settings,rhythm:{...settings.rhythm,...rhythmLegacyValues(settings.rhythm.noteValue,style),style}});}}>{rhythmStyles.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>{" "}
   <label>Timing strictness <select value={settings.timing.strictness} onChange={e=>updateTiming({...settings.timing,strictness:e.target.value as TrainingRequest["timing"]["strictness"]})}><option value="veryForgiving">Very forgiving</option><option value="balanced">Balanced</option><option value="strict">Strict</option><option value="custom">Custom</option></select></label>
   {settings.timing.strictness==="custom"&&<>{(["earlyMs","lateMs","chordMs"] as const).map(field=><IntegerInput key={field} label={field==="earlyMs"?"Early allowance (ms)":field==="lateMs"?"Late allowance (ms)":"Chord spread (ms)"} value={settings.timing[field]} min={field==="chordMs"?20:30} max={field==="chordMs"?500:2000} onCommit={value=>updateTiming({...settings.timing,[field]:value})}/>)}</>}
   <label><input type="checkbox" checked={settings.timing.followAfterPause} onChange={e=>updateTiming({...settings.timing,followAfterPause:e.target.checked})}/> Follow me after a pause</label>
   <p>Timed practice accepts up to {Math.round(tolerance.correctEarlyMs!)} ms early or {Math.round(tolerance.correctLateMs!)} ms late as on time. Chord spread: {Math.round(tolerance.simultaneityWindowMs)} ms. {settings.timing.followAfterPause?"The score waits after a hesitation and realigns when you resume; the pause is still recorded.":"The clock keeps its original pulse through mistakes and pauses."}</p>
   <IntegerInput label="Measures" value={settings.measures} min={2} max={32} onCommit={measures=>updateSettings({...settings,measures})}/>{" "}
   <label>Bass pattern <select value={settings.leftHand.accompanimentStyle} onChange={e=>updateSettings({...settings,leftHand:{...settings.leftHand,enabled:true,accompanimentStyle:e.target.value as TrainingRequest["leftHand"]["accompanimentStyle"],templateId:undefined}})}>{bassPatterns.filter(pattern=>accompanimentStylesForMeter(settings.rhythm.meters[0]!).includes(pattern)).map(pattern=><option key={pattern} value={pattern}>{accompanimentOptionLabel(pattern,settings.rhythm.meters[0]!)}</option>)}</select></label>{" "}
   <label>Curated bass exercise <select value={settings.leftHand.templateId??""} onChange={e=>{const templateId=e.target.value||undefined,isBb=templateId==="legacy-bb-fdim-line",noteValue=templateId&&settings.rhythm.noteValue==="half"?"quarter":settings.rhythm.noteValue;updateSettings({...settings,measures:templateId?(isBb?6:4):settings.measures,tonal:isBb?{...settings.tonal,keys:["Bb major"],selection:"fixed"}:settings.tonal,rhythm:templateId?{...settings.rhythm,...rhythmLegacyValues(noteValue,settings.rhythm.style),noteValue,meters:[{beats:3,beatUnit:4}]}:settings.rhythm,leftHand:{...settings.leftHand,enabled:true,accompanimentStyle:"polka",templateId:templateId as TrainingRequest["leftHand"]["templateId"]}});}}><option value="">None</option>{legacyLines.map(line=><option key={line.id} value={line.id}>{line.label}</option>)}</select></label>
   {" "}<button type="button" onClick={reset}>Reset settings</button>
   {settings.intent==="patternsIntervals"&&<div className="pattern-family-controls"><span>Pattern families: </span>{patternFamilies.map(family=><label key={family.value}><input type="checkbox" checked={settings.patterns.allowedFamilies.includes(family.value)} onChange={e=>{const allowedFamilies=e.target.checked?[...settings.patterns.allowedFamilies,family.value]:settings.patterns.allowedFamilies.filter(value=>value!==family.value);if(allowedFamilies.length)updateSettings({...settings,patterns:{...settings.patterns,allowedFamilies}});}}/> {family.label}</label>)}</div>}
   <div className="preset-controls">
    <label>Preset{" "}
     <select
      aria-label="Saved presets"
      value={selectedPresetId}
      onChange={e=>{
       const id=e.target.value;
       setSelectedPresetId(id);
       const target=presets.find(p=>p.id===id);
       if(target)setPresetDraft(target.name);
      }}
     >
      <option value="">{presets.length===0?"(No saved presets)":"Select preset…"}</option>
      {presets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
     </select>
    </label>{" "}
    <button type="button" onClick={handleLoadPreset} disabled={!selectedPresetId}>Load</button>{" "}
    <input
     type="text"
     placeholder="Preset name"
     aria-label="Preset name"
     value={presetDraft}
     onChange={e=>setPresetDraft(e.target.value)}
     onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();handleSavePreset();}}}
    />{" "}
    <button type="button" onClick={handleSavePreset}>Save preset</button>{" "}
    <button type="button" onClick={handleDeletePreset} disabled={!selectedPresetId}>Delete</button>
   </div>
   <details><summary>Advanced generation</summary>
    <label>Right jump frequency <select value={settings.rightHand.jumpFrequency} onChange={e=>updateSettings({...settings,rightHand:{...settings.rightHand,jumpFrequency:e.target.value as TrainingRequest["rightHand"]["jumpFrequency"]}})}><option value="none">Normal movement</option><option value="occasional">Occasional targeted jumps</option><option value="frequent">Frequent targeted jumps</option></select></label>{" "}
    <label>Right jump size <select value={settings.rightHand.jumpSize} onChange={e=>{const jumpSize=e.target.value as TrainingRequest["rightHand"]["jumpSize"],required=jumpSize==="small"?4:jumpSize==="medium"?7:jumpSize==="large"?11:jumpSize==="octave"?12:24;updateSettings({...settings,pitchRegister:jumpSize==="octave"||jumpSize==="beyondOctave"?"custom":settings.pitchRegister,rightHand:{...settings.rightHand,jumpSize,maxJump:Math.max(required,settings.rightHand.maxJump)}});}}><option value="small">Small — seconds and thirds</option><option value="medium">Medium — fourths and fifths</option><option value="large">Large — sixths and sevenths</option><option value="octave">Octave</option><option value="beyondOctave">Beyond an octave</option></select></label>{" "}
    <IntegerInput label="Right maximum" value={settings.rightHand.maxJump} min={settings.rightHand.jumpFrequency==="none"?0:settings.rightHand.jumpSize==="small"?1:settings.rightHand.jumpSize==="medium"?5:settings.rightHand.jumpSize==="large"?8:settings.rightHand.jumpSize==="octave"?12:13} max={36} onCommit={maxJump=>updateSettings({...settings,rightHand:{...settings.rightHand,maxJump}})}/>{" "}
    <IntegerInput label="Max accidentals" value={settings.rightHand.maxAccidentalsPerExercise} min={0} max={64} onCommit={maxAccidentalsPerExercise=>updateSettings({...settings,rightHand:{...settings.rightHand,maxAccidentalsPerExercise}})}/>{" "}
    <label>Left jump frequency <select value={settings.leftHand.jumpFrequency} onChange={e=>updateSettings({...settings,leftHand:{...settings.leftHand,jumpFrequency:e.target.value as TrainingRequest["leftHand"]["jumpFrequency"]}})}><option value="none">Normal movement</option><option value="occasional">Occasional targeted jumps</option><option value="frequent">Frequent targeted jumps</option></select></label>{" "}
    <label>Left jump size <select value={settings.leftHand.jumpSize} onChange={e=>{const jumpSize=e.target.value as TrainingRequest["leftHand"]["jumpSize"],required=jumpSize==="nearby"?1:jumpSize==="moderate"?3:jumpSize==="large"?5:11;updateSettings({...settings,measures:jumpSize==="veryLarge"?Math.max(3,settings.measures):settings.measures,leftHand:{...settings.leftHand,jumpSize,maxJump:Math.max(required,settings.leftHand.maxJump)}});}}><option value="nearby">Nearby — 1 column</option><option value="moderate">Moderate — 2–3 columns</option><option value="large">Large — 4–5 columns</option><option value="veryLarge">Very large — 6+ columns</option></select></label>{" "}
    <IntegerInput label="Left maximum" value={settings.leftHand.maxJump} min={settings.leftHand.jumpFrequency==="none"?0:settings.leftHand.jumpSize==="nearby"?1:settings.leftHand.jumpSize==="moderate"?2:settings.leftHand.jumpSize==="large"?4:6} max={11} onCommit={maxJump=>updateSettings({...settings,leftHand:{...settings.leftHand,maxJump}})}/>{" "}
    <label>Bass low <select value={settings.leftHand.bassRootLow} onChange={e=>{const bassRootLow=e.target.value as TrainingRequest["leftHand"]["bassRootLow"],bassRootHigh=bassRoots.indexOf(bassRootLow)>bassRoots.indexOf(settings.leftHand.bassRootHigh)?bassRootLow:settings.leftHand.bassRootHigh;updateSettings({...settings,leftHand:{...settings.leftHand,bassRootLow,bassRootHigh}});}}>{bassRoots.map(root=><option key={root}>{root}</option>)}</select></label>{" "}
    <label>Bass high <select value={settings.leftHand.bassRootHigh} onChange={e=>{const bassRootHigh=e.target.value as TrainingRequest["leftHand"]["bassRootHigh"],bassRootLow=bassRoots.indexOf(bassRootHigh)<bassRoots.indexOf(settings.leftHand.bassRootLow)?bassRootHigh:settings.leftHand.bassRootLow;updateSettings({...settings,leftHand:{...settings.leftHand,bassRootLow,bassRootHigh}});}}>{bassRoots.map(root=><option key={root}>{root}</option>)}</select></label>
   </details>
  </fieldset>
  <details><summary>Generator diagnostics</summary><pre>{exerciseDiagnostics(exercise)}</pre></details>
  <p>Detected MIDI: {devices.join(", ")||midiError||"none (you can still inspect generated scores)"}</p>
  <AppFooter
   registration={swRegistration}
   onUpdateDetected={() => setNeedRefresh(true)}
  />
 </main>;
}
