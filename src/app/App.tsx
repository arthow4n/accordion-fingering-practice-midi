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
import { evaluatePerformance } from "../core/performance/evaluatePerformance";
import type { PerformanceMetrics } from "../core/performance/performanceMetrics";
import { AbsoluteTimeline, ticksToMs } from "../core/performance/timeline";
import { defaultRuntimeMode, defaultTrainingRequest, type TrainingRequest } from "../core/training/trainingIntent";

type HandMode=TrainingRequest["hands"];
type SessionStats={completedExercises:number;completedEvents:number;attempts:number;correct:number;timingCorrect:number;missed:number;extra:number};
type CorrectionTarget={onset:number;duration:number;pitches:number[];eventCount:number};
const emptySessionStats:SessionStats={completedExercises:0,completedEvents:0,attempts:0,correct:0,timingCorrect:0,missed:0,extra:0};
const nextSeed=()=>Math.floor(Math.random()*0x2aaaaaaa)*3;
const intents:readonly {value:TrainingIntent;label:string}[]=[{value:"general",label:"General sight-reading"},{value:"noteRecognition",label:"Note recognition"},{value:"patternsIntervals",label:"Patterns and intervals"},{value:"rhythm",label:"Rhythm"},{value:"leftHand",label:"Left-hand reading"},{value:"coordination",label:"Two-hand coordination"}];
const patternFamilies:readonly {value:string;label:string}[]=[{value:"repeated",label:"Repeated notes"},{value:"scale",label:"Scale fragments"},{value:"thirds",label:"Thirds"},{value:"triad",label:"Triads"},{value:"arpeggio",label:"Arpeggios"},{value:"neighbor",label:"Neighbor notes"},{value:"passing",label:"Passing notes"},{value:"leapRecovery",label:"Leap and recovery"},{value:"sequence",label:"Sequences"},{value:"cadence",label:"Cadential figures"},{value:"chordTone",label:"Chord-tone turns"}];
const keys=["C major","G major","D major","F major","Bb major","Eb major","A minor","D minor","E minor"];
const bassRoots=["Ab","Eb","Bb","F","C","G","D","A","E","B"] as const;
const bassPatterns:readonly TrainingRequest["leftHand"]["accompanimentStyle"][]=["bassChord","alternatingBass","polka","waltz","tango","swing"];
const legacyLines=[{id:"legacy-tonic-pedal-descending",label:"Tonic pedal: C/C–C/B–C/A–C/G"},{id:"legacy-transition-to-IV",label:"Counterbass walk: C/C–C/D–C/E–F"},{id:"legacy-bb-fdim-line",label:"Bb–Fdim/B–Fdim/G–Fdim/G–F/C–D7"}] as const;
const noteFrequencyOptions=[
 {value:"verySlow",label:"Very slow — half & quarter notes",smallestSubdivision:"quarter",noteDensity:0},
 {value:"slow",label:"Slow — mostly quarter notes",smallestSubdivision:"quarter",noteDensity:.3},
 {value:"medium",label:"Medium — quarter & eighth notes",smallestSubdivision:"eighth",noteDensity:.55},
 {value:"busy",label:"Busy — eighth & sixteenth notes",smallestSubdivision:"sixteenth",noteDensity:.85},
] as const;
const includesHand=(mode:HandMode,hand:"right"|"left")=>mode==="both"||mode===hand;
const noteFrequencyValue=(rhythm:TrainingRequest["rhythm"])=>(
 rhythm.smallestSubdivision==="quarter"
  ?rhythm.noteDensity<.15?"verySlow":"slow"
  :rhythm.smallestSubdivision==="sixteenth"||rhythm.noteDensity>.7?"busy":"medium"
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
 const scoreRef=useRef<HTMLDivElement>(null);const performedRef=useRef<PerformedMidiEvent[]>([]);const rightNotesRef=useRef(new Map<number,number>());const leftNotesRef=useRef(new Map<number,number>());const timelineRef=useRef<AbsoluteTimeline>();const frameRef=useRef<number>();const midiListenerRef=useRef<MidiListener>(()=>{});
 const [initial]=useState(()=>{const session=loadStoredSession(),seed=session.settings.seed??nextSeed();try{return {settings:session.settings,mode:session.mode,seed,exercise:generateExercise(session.settings,seed),error:""};}catch(error){return {settings:session.settings,mode:session.mode,seed,exercise:generateExercise(defaultTrainingRequest(),0),error:error instanceof Error?error.message:String(error)};}});
 const [settings,setSettings]=useState(initial.settings);const [seed,setSeed]=useState(initial.seed);const [exercise,setExercise]=useState(initial.exercise);
 const [mode,setMode]=useState<RuntimeMode>(initial.mode);const [status,setStatus]=useState<"ready"|"playing">(initial.mode==="correction"?"playing":"ready");const [positionMs,setPositionMs]=useState(0);const [metrics,setMetrics]=useState<PerformanceMetrics>();const [sessionStats,setSessionStats]=useState(emptySessionStats);const [devices,setDevices]=useState<string[]>([]);const [midiError,setMidiError]=useState("");const [generationError,setGenerationError]=useState(initial.error);
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

 const rightTargets=useMemo<CorrectionTarget[]>(()=>{
  if(!includesHand(settings.hands,"right"))return[];
  return exercise.rightHand.filter(e=>e.pitches.length&&!e.metadata.tieFromPrevious).map(e=>({onset:e.onset,duration:e.duration,pitches:e.pitches.map(p=>p.midi),eventCount:1}));
 },[exercise.rightHand,settings.hands]);

 const leftTargets=useMemo<CorrectionTarget[]>(()=>{
  if(!includesHand(settings.hands,"left"))return[];
  return exercise.leftHand.filter(e=>e.pitches.length&&!e.metadata.tieFromPrevious).map(e=>({onset:e.onset,duration:e.duration,pitches:e.pitches.map(p=>p.midi),eventCount:1}));
 },[exercise.leftHand,settings.hands]);

 const hasRight=includesHand(settings.hands,"right")&&rightTargets.length>0;
 const hasLeft=includesHand(settings.hands,"left")&&leftTargets.length>0;

 const changeMode=(nextMode:RuntimeMode)=>{
  cancelAnimationFrame(frameRef.current??0);
  setMode(nextMode);
  saveSettings(settings,nextMode);
  setStatus(nextMode==="correction"?"playing":"ready");
  setRightIndex(0);
  setLeftIndex(0);
  rightNotesRef.current.clear();
  leftNotesRef.current.clear();
 };

 const updateSettings=(next:TrainingRequest,persist=true,nextMode=mode)=>{
  cancelAnimationFrame(frameRef.current??0);
  setSettings(next);
  if(persist)saveSettings(next,nextMode);
  setMode(nextMode);
  setStatus(nextMode==="correction"?"playing":"ready");
  setMetrics(undefined);
  setPositionMs(0);
  setRightIndex(0);
  setLeftIndex(0);
  performedRef.current=[];
  rightNotesRef.current.clear();
  leftNotesRef.current.clear();
  try{
   const newSeed=nextSeed(),generated=generateExercise(next,newSeed);
   setSeed(newSeed);
   setExercise(generated);
   setGenerationError("");
  }catch(error){
   setGenerationError(error instanceof Error?error.message:String(error));
  }
 };

 const regenerate=useCallback((newSeed=seed+1,preserveMetrics=false)=>{
  cancelAnimationFrame(frameRef.current??0);
  try{
   const next=generateExercise(settings,newSeed);
   setSeed(newSeed);
   setExercise(next);
   setStatus(mode==="correction"?"playing":"ready");
   if(!preserveMetrics)setMetrics(undefined);
   setPositionMs(0);
   setRightIndex(0);
   setLeftIndex(0);
   performedRef.current=[];
   rightNotesRef.current.clear();
   leftNotesRef.current.clear();
   setGenerationError("");
   console.debug(exerciseDiagnostics(next));
  }catch(error){
   setStatus("ready");
   setGenerationError(error instanceof Error?error.message:String(error));
  }
 },[settings,mode,seed]);

 const finish=useCallback(()=>{
  const timeline=timelineRef.current;
  if(!timeline)return;
  cancelAnimationFrame(frameRef.current??0);
  const evaluated={...exercise,rightHand:includesHand(settings.hands,"right")?exercise.rightHand:[],leftHand:includesHand(settings.hands,"left")?exercise.leftHand:[]};
  const result=evaluatePerformance(evaluated,performedRef.current,timeline.sessionStartMs()).metrics;
  setMetrics(result);
  const attempts=result.rightHand.attempts+result.leftHand.attempts;
  const correct=result.rightHand.correct+result.leftHand.correct;
  setSessionStats(x=>({...x,completedExercises:x.completedExercises+1,completedEvents:x.completedEvents+attempts,attempts:x.attempts+attempts,correct:x.correct+correct,timingCorrect:x.timingCorrect+Math.round(result.timingAccuracy*attempts),missed:x.missed+result.missedNotes,extra:x.extra+result.extraNotes}));
  regenerate(seed+1,true);
 },[exercise,settings.hands,regenerate,seed]);

 const start=useCallback(()=>{
  if(mode==="correction"){setStatus("playing");return;}
  performedRef.current=[];
  const timeline=new AbsoluteTimeline(exercise,0,0);
  timelineRef.current=timeline;
  timeline.start(performance.now());
  setStatus("playing");
  const tick=()=>{
   const now=performance.now();
   setPositionMs(timeline.positionAt(now));
   if(timeline.isFinished(now)){finish();return;}
   frameRef.current=requestAnimationFrame(tick);
  };
  frameRef.current=requestAnimationFrame(tick);
 },[mode,exercise,finish]);

 const acceptMidi=useCallback((event:PerformedMidiEvent)=>{
  if(event.type!=="noteOn"||(event.hand&&!includesHand(settings.hands,event.hand)))return;

  if(mode==="sightReading"){
   if(status==="ready"){
    start();
    performedRef.current.push(event);
    return;
   }
   if(status==="playing")performedRef.current.push(event);
   return;
  }

  if(status!=="playing")setStatus("playing");

  const targetHasPitch=(target:CorrectionTarget|undefined,midiNote:number,isLeft:boolean,notesRef:React.MutableRefObject<Map<number,number>>)=>{
   if(!target)return false;
   let p=target.pitches.find(pitch=>pitch===midiNote);
   if(p===undefined&&isLeft)p=target.pitches.find(pitch=>pitch%12===((midiNote%12)+12)%12);
   if(p===undefined)return false;
   const used=notesRef.current.get(p)??0;
   const req=target.pitches.filter(x=>x===p).length;
   return used<req;
  };

  const rightTarget=hasRight&&rightIndex<rightTargets.length?rightTargets[rightIndex]:undefined;
  const leftTarget=hasLeft&&leftIndex<leftTargets.length?leftTargets[leftIndex]:undefined;

  const handUsed:"right"|"left"=event.hand??(
   targetHasPitch(rightTarget,event.midiNote,false,rightNotesRef)
    ?"right"
    :targetHasPitch(leftTarget,event.midiNote,true,leftNotesRef)
     ?"left"
     :(hasRight?"right":"left")
  );

  if(handUsed==="right"){
   if(!rightTarget)return;
   const required=rightTarget.pitches.filter(p=>p===event.midiNote).length;
   const used=rightNotesRef.current.get(event.midiNote)??0;
   if(!required||used>=required){
    setSessionStats(x=>({...x,attempts:x.attempts+1}));
    return;
   }
   rightNotesRef.current.set(event.midiNote,used+1);
   const complete=rightTarget.pitches.every(p=>(rightNotesRef.current.get(p)??0)>=rightTarget.pitches.filter(expectedPitch=>expectedPitch===p).length);
   if(complete){
    rightNotesRef.current.clear();
    const nextRight=rightIndex+1;
    setRightIndex(nextRight);
    setSessionStats(x=>({...x,completedEvents:x.completedEvents+1,attempts:x.attempts+1,correct:x.correct+1}));
    setPositionMs(ticksToMs(rightTarget.onset+rightTarget.duration,exercise.tempoBpm));
    const rightDone=nextRight>=rightTargets.length;
    const leftDone=!hasLeft||leftIndex>=leftTargets.length;
    if(rightDone&&leftDone){
     setSessionStats(x=>({...x,completedExercises:x.completedExercises+1}));
     regenerate(seed+1,true);
    }
   }
   return;
  }

  if(handUsed==="left"){
   if(!leftTarget)return;
   let matchedPitch=leftTarget.pitches.find(p=>p===event.midiNote);
   if(matchedPitch===undefined){
    matchedPitch=leftTarget.pitches.find(p=>p%12===((event.midiNote%12)+12)%12&&(leftNotesRef.current.get(p)??0)<leftTarget.pitches.filter(x=>x===p).length);
   }
   if(matchedPitch===undefined){
    setSessionStats(x=>({...x,attempts:x.attempts+1}));
    return;
   }
   const required=leftTarget.pitches.filter(p=>p===matchedPitch).length;
   const used=leftNotesRef.current.get(matchedPitch)??0;
   if(used>=required){
    setSessionStats(x=>({...x,attempts:x.attempts+1}));
    return;
   }
   leftNotesRef.current.set(matchedPitch,used+1);
   const complete=leftTarget.pitches.every(p=>(leftNotesRef.current.get(p)??0)>=leftTarget.pitches.filter(expectedPitch=>expectedPitch===p).length);
   if(complete){
    leftNotesRef.current.clear();
    const nextLeft=leftIndex+1;
    setLeftIndex(nextLeft);
    setSessionStats(x=>({...x,completedEvents:x.completedEvents+1,attempts:x.attempts+1,correct:x.correct+1}));
    if(!hasRight)setPositionMs(ticksToMs(leftTarget.onset+leftTarget.duration,exercise.tempoBpm));
    const leftDone=nextLeft>=leftTargets.length;
    const rightDone=!hasRight||rightIndex>=rightTargets.length;
    if(leftDone&&rightDone){
     setSessionStats(x=>({...x,completedExercises:x.completedExercises+1}));
     regenerate(seed+1,true);
    }
   }
   return;
  }
 },[hasRight,hasLeft,mode,status,rightIndex,leftIndex,rightTargets,leftTargets,exercise.tempoBpm,seed,settings.hands,start,regenerate]);

 useEffect(()=>{midiListenerRef.current=acceptMidi;},[acceptMidi]);
 useEffect(()=>{let cancelled=false;let disconnect:undefined|(()=>void);connectWebMidi(event=>midiListenerRef.current(event),names=>{if(!cancelled)setDevices(names);}).then(x=>{if(cancelled)x.disconnect();else{setDevices(x.deviceNames);disconnect=x.disconnect;setMidiError("");}}).catch(e=>{if(!cancelled)setMidiError(e instanceof Error?e.message:String(e));});return()=>{cancelled=true;disconnect?.();};},[]);

 const r=hasRight&&rightIndex<rightTargets.length?rightTargets[rightIndex]?.onset:undefined;
 const l=hasLeft&&leftIndex<leftTargets.length?leftTargets[leftIndex]?.onset:undefined;
 const correctionPlayhead=r!==undefined&&l!==undefined?Math.min(r,l):(r??l);

 const playhead=mode==="correction"
  ?correctionPlayhead
  :(status==="playing"
     ?(positionMs/60_000)*exercise.tempoBpm*480
     :(exercise.rightHand[0]?.onset??0));

 const markedOnset=playhead===undefined
  ?undefined
  :(exercise.rightHand.find(event=>playhead>=event.onset&&playhead<event.onset+event.duration)?.onset
     ??(hasRight&&rightIndex<rightTargets.length?rightTargets[rightIndex]?.onset:exercise.rightHand[0]?.onset));

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
     ?`Right hand: ${rightIndex>=rightTargets.length?"done":`${rightIndex+1} of ${rightTargets.length}`} · Left hand: ${leftIndex>=leftTargets.length?"done":`${leftIndex+1} of ${leftTargets.length}`}`
     :hasRight
      ?`Event ${Math.min(rightIndex+1,rightTargets.length)} of ${rightTargets.length}`
      :`Event ${Math.min(leftIndex+1,leftTargets.length)} of ${leftTargets.length}`
    :status==="playing"
     ?"Sight-reading—keep the pulse"
     :"Ready — play the first note on the accordion to begin"
  }</p>
  <p>Completed {sessionStats.completedExercises} exercises · {sessionStats.completedEvents} events · correct {sessionStats.attempts?`${(sessionStats.correct/sessionStats.attempts*100).toFixed(0)}%`:"—"} · missed {sessionStats.missed} · extra {sessionStats.extra}</p>
  {metrics&&<p>Last exercise: pitch {(metrics.pitchAccuracy*100).toFixed(0)}% · timing {(metrics.timingAccuracy*100).toFixed(0)}% · continuity {(metrics.continuity*100).toFixed(0)}%</p>}
  {generationError&&<p role="alert">These settings could not generate an exercise: {generationError}</p>}
  <p><button onClick={()=>regenerate()}>New exercise</button>{" "}<button onClick={()=>regenerate(seed)}>Replay seed</button>{" "}<button onClick={()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen({navigationUI:"hide"})}>Full screen</button></p>
  <fieldset><legend>Practice settings</legend>
   <label>Training mode <select value={settings.intent} onChange={e=>setIntent(e.target.value as TrainingIntent)}>{intents.map(intent=><option key={intent.value} value={intent.value}>{intent.label}</option>)}</select></label>{" "}
   <label>Execution <select value={mode} onChange={e=>changeMode(e.target.value as RuntimeMode)}><option value="sightReading">Timed sight-reading</option><option value="correction">Correction / drill</option></select></label>{" "}
   <label>Hands <select value={settings.hands} onChange={e=>updateSettings({...settings,hands:e.target.value as HandMode,leftHand:{...settings.leftHand,enabled:true}})}><option value="both">Both</option><option value="right">Right hand only</option><option value="left">Left hand only</option></select></label>{" "}
   <label>Key <select value={settings.tonal.keys.length===1?settings.tonal.keys[0]:"pool"} onChange={e=>updateSettings({...settings,tonal:{...settings.tonal,keys:e.target.value==="pool"?["C major","G major","D major","F major"]:[e.target.value],selection:e.target.value==="pool"?"random":"fixed"}})}><option value="pool">Easy key pool</option>{keys.map(x=><option key={x}>{x}</option>)}</select></label>{" "}
   <label>Pitch range <select value={settings.pitchRegister} onChange={e=>updateSettings({...settings,pitchRegister:e.target.value as TrainingRequest["pitchRegister"]})}><option value="rotating">Full range — rotating</option><option value="low">Low (G3–G4)</option><option value="middle">Middle (G4–G5)</option><option value="high">High (G5–G6)</option><option value="custom">Custom</option></select></label>
   {settings.pitchRegister==="rotating"&&<span>Current register: {registerForSeed(seed)} </span>}
   {settings.pitchRegister==="custom"&&(["low","high"] as const).map(bound=><label key={bound}>{bound==="low"?"Lowest note":"Highest note"} <select value={settings.rightHand.range[bound]} onChange={e=>{const value=Number(e.target.value);const range={...settings.rightHand.range,[bound]:value};if(bound==="low")range.high=Math.max(value,range.high);else range.low=Math.min(value,range.low);updateSettings({...settings,rightHand:{...settings.rightHand,range}});}}>{Array.from({length:37},(_,i)=>i+55).map(midi=><option key={midi} value={midi}>{Note.fromMidi(midi)}</option>)}</select></label>)}
   <label>Time signature <select value={`${settings.rhythm.meters[0]!.beats}/${settings.rhythm.meters[0]!.beatUnit}`} onChange={e=>{const [beats,beatUnit]=e.target.value.split("/").map(Number),meter={beats,beatUnit:beatUnit as 4|8},styles=accompanimentStylesForMeter(meter),accompanimentStyle=styles.includes(settings.leftHand.accompanimentStyle)?settings.leftHand.accompanimentStyle:"bassChord";updateSettings({...settings,rhythm:{...settings.rhythm,meters:[meter]},leftHand:{...settings.leftHand,accompanimentStyle,templateId:undefined}});}}><option value="3/4">3/4</option><option value="4/4">4/4</option></select></label>{" "}
   <IntegerInput label="Tempo" value={settings.tempoBpm} min={30} max={240} onCommit={tempoBpm=>updateSettings({...settings,tempoBpm})}/>{" "}
   <label>Note frequency <select value={noteFrequencyValue(settings.rhythm)} onChange={e=>{const option=noteFrequencyOptions.find(item=>item.value===e.target.value)!;updateSettings({...settings,rhythm:{...settings.rhythm,smallestSubdivision:option.smallestSubdivision,noteDensity:option.noteDensity}});}}>{noteFrequencyOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>{" "}
   <IntegerInput label="Measures" value={settings.measures} min={2} max={32} onCommit={measures=>updateSettings({...settings,measures})}/>{" "}
   <label>Bass pattern <select value={settings.leftHand.accompanimentStyle} onChange={e=>updateSettings({...settings,leftHand:{...settings.leftHand,enabled:true,accompanimentStyle:e.target.value as TrainingRequest["leftHand"]["accompanimentStyle"],templateId:undefined}})}>{bassPatterns.filter(pattern=>accompanimentStylesForMeter(settings.rhythm.meters[0]!).includes(pattern)).map(pattern=><option key={pattern} value={pattern}>{accompanimentOptionLabel(pattern,settings.rhythm.meters[0]!)}</option>)}</select></label>{" "}
   <label>Curated bass exercise <select value={settings.leftHand.templateId??""} onChange={e=>{const templateId=e.target.value||undefined;const isBb=templateId==="legacy-bb-fdim-line";updateSettings({...settings,measures:templateId?(isBb?6:4):settings.measures,tonal:isBb?{...settings.tonal,keys:["Bb major"],selection:"fixed"}:settings.tonal,rhythm:templateId?{...settings.rhythm,meters:[{beats:3,beatUnit:4}]}:settings.rhythm,leftHand:{...settings.leftHand,enabled:true,accompanimentStyle:"polka",templateId:templateId as TrainingRequest["leftHand"]["templateId"]}});}}><option value="">None</option>{legacyLines.map(line=><option key={line.id} value={line.id}>{line.label}</option>)}</select></label>
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
