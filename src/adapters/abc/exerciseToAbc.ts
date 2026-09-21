import { Note } from "tonal";
import type { Exercise, ExerciseEvent, HarmonyEvent, Pitch, TonalContext } from "../../core/model";
import { realizeScaleDegree, scaleNotes } from "../../core/music/key";
import { ticksPerMeasure } from "../../core/music/meter";
const accidental=(name:string)=>{const acc=Note.get(name).acc;return acc.replaceAll("#","^").replaceAll("b","_");};
const letter=(name:string)=>name[0]!.toUpperCase();
const abcBase=(pitch:Pitch)=>{const parsed=Note.get(pitch.name);let text=parsed.letter!;if((parsed.oct??4)>=5)text=text.toLowerCase()+"'".repeat(Math.max(0,(parsed.oct??4)-5));else text+=",".repeat(Math.max(0,4-(parsed.oct??4)));return text;};
const signatureMap=(context:TonalContext)=>new Map(scaleNotes(context).map(n=>[letter(n),accidental(n)]));
const chordSuffix=(quality:HarmonyEvent["quality"])=>quality==="minor"?"m":quality==="dominant7"?"7":quality==="diminished"?"dim":"";
const chordName=(harmony:HarmonyEvent,context:TonalContext)=>{
 const root=Note.pitchClass(realizeScaleDegree(context,harmony.rootDegree,4));
 return `${root}${chordSuffix(harmony.quality)}`;
};
const accompanimentLabels=(exercise:Exercise)=>{
 const labels=new Map<number,string>();
 for(const event of exercise.leftHand){
  const annotation=event.metadata.leadSheetAnnotation;if(!annotation)continue;
  labels.set(event.onset,`${annotation.chordRoot}${chordSuffix(annotation.quality)}${annotation.bass?`/${annotation.bass}`:""}`);
 }
 if(!labels.size){
  let previous="";
  for(const harmony of exercise.harmony){
   const chord=chordName(harmony,exercise.tonalContext);
   if(chord!==previous)labels.set(harmony.onset,chord);previous=chord;
  }
 }
 return labels;
};
const serializeVoice=(events:ExerciseEvent[],exercise:Exercise,labels=new Map<number,string>(),markedOnset?:number)=>{
 const signature=signatureMap(exercise.tonalContext), measure=ticksPerMeasure(exercise.meter);let currentMeasure=-1;let state=new Map<string,string>();const parts:string[]=[];
 const renderPitch=(p:Pitch)=>{const parsed=Note.get(p.name),key=`${parsed.letter}${parsed.oct}`,desired=accidental(p.name),active=state.get(key)??signature.get(letter(p.name))??"";let prefix="";if(desired!==active){prefix=desired||"=";state.set(key,desired);}return prefix+abcBase(p);};
 // Keep every bass change visible even underneath a sustained melody note.
 const splitEvents=events.flatMap(event=>{
  const boundaries=[event.onset,...[...labels.keys()].filter(onset=>onset>event.onset&&onset<event.onset+event.duration).sort((a,b)=>a-b),event.onset+event.duration];
  return boundaries.slice(0,-1).map((onset,index)=>({...event,onset,duration:boundaries[index+1]!-onset,metadata:{...event.metadata,tieToNext:event.pitches.length>0&&(index<boundaries.length-2||event.metadata.tieToNext)}}));
 });
 for(const event of splitEvents){const mi=Math.floor(event.onset/measure);if(mi!==currentMeasure){if(currentMeasure>=0)parts.push("|");currentMeasure=mi;state=new Map();}const duration=event.duration/240;const suffix=duration===1?"":Number.isInteger(duration)?String(duration):`${event.duration/120}/2`;const tie=event.metadata.tieToNext?"-":"";const annotation=labels.get(event.onset);const prefix=`${markedOnset!==undefined&&markedOnset>=event.onset&&markedOnset<event.onset+event.duration?"!mark!":""}${annotation?`"${annotation}"`:""}`;if(!event.pitches.length)parts.push(`${prefix}z${suffix}`);else if(event.pitches.length===1)parts.push(`${prefix}${renderPitch(event.pitches[0]!)}${suffix}${tie}`);else parts.push(`${prefix}[${event.pitches.map(renderPitch).join("")}]${suffix}${tie}`);}parts.push("|");return parts.join(" ");
};
export const exerciseToAbc=(exercise:Exercise,markedOnset?:number)=>{
 const key=`${exercise.tonalContext.tonic}${exercise.tonalContext.mode==="minor"?"m":""}`;
 // Accordion lead-sheet notation is intentionally one melodic staff with
 // chord/slash-bass annotations. Never serialize the generated left hand as a
 // second staff; its configured pattern is explained by the application UI.
 return `X:1\nM:${exercise.meter.beats}/${exercise.meter.beatUnit}\nL:1/8\nK:${key}\n${serializeVoice(exercise.rightHand,exercise,accompanimentLabels(exercise),markedOnset)}\n`;
};
