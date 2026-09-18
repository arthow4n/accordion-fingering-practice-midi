import { Note } from "tonal";
import type { Exercise, ExerciseEvent, HarmonyEvent, Pitch, TonalContext } from "../../core/model";
import { realizeScaleDegree, scaleNotes } from "../../core/music/key";
import { ticksPerMeasure } from "../../core/music/meter";
const accidental=(name:string)=>name.includes("#")?"^":name.includes("b")?"_":"";
const letter=(name:string)=>name[0]!.toUpperCase();
const abcBase=(pitch:Pitch)=>{const parsed=Note.get(pitch.name);let text=parsed.letter!;if((parsed.oct??4)>=5)text=text.toLowerCase()+"'".repeat(Math.max(0,(parsed.oct??4)-5));else text+=",".repeat(Math.max(0,4-(parsed.oct??4)));return text;};
const signatureMap=(context:TonalContext)=>new Map(scaleNotes(context).map(n=>[letter(n),accidental(n)]));
const chordName=(harmony:HarmonyEvent,context:TonalContext)=>{
 const root=Note.pitchClass(realizeScaleDegree(context,harmony.rootDegree,4));
 return `${root}${harmony.quality==="minor"?"m":harmony.quality==="dominant7"?"7":harmony.quality==="diminished"?"dim":""}`;
};
const accompanimentLabels=(exercise:Exercise)=>{
 const labels=new Map<number,string>();let previous="";
 for(const event of exercise.leftHand){
  const kind=event.metadata.accompaniment?.split(" ").at(-1);if(kind!=="bass"&&kind!=="bassChord")continue;
  const harmony=exercise.harmony.find(h=>event.onset>=h.onset&&event.onset<h.onset+h.duration);if(!harmony)continue;
  const chord=chordName(harmony,exercise.tonalContext);const bass=event.metadata.stradellaButton?.split(" ")[0];const label=bass&&bass!==chord.replace(/m|7|dim/g,"")?`${chord}/${bass}`:chord;
  if(label!==previous)labels.set(event.onset,label);previous=label;
 }
 return labels;
};
const serializeVoice=(events:ExerciseEvent[],exercise:Exercise,labels=new Map<number,string>(),markedOnset?:number)=>{
 const signature=signatureMap(exercise.tonalContext), measure=ticksPerMeasure(exercise.meter);let currentMeasure=-1;let state=new Map<string,string>();const parts:string[]=[];
 const renderPitch=(p:Pitch)=>{const parsed=Note.get(p.name),key=`${parsed.letter}${parsed.oct}`,desired=accidental(p.name),active=state.get(key)??signature.get(letter(p.name))??"";let prefix="";if(desired!==active){prefix=desired||"=";state.set(key,desired);}return prefix+abcBase(p);};
 for(const event of events){const mi=Math.floor(event.onset/measure);if(mi!==currentMeasure){if(currentMeasure>=0)parts.push("|");currentMeasure=mi;state=new Map();}const duration=event.duration/240;const suffix=duration===1?"":Number.isInteger(duration)?String(duration):`/${Math.round(1/duration)}`;const tie=event.metadata.tieToNext?"-":"";const annotation=labels.get(event.onset);const prefix=`${markedOnset!==undefined&&markedOnset>=event.onset&&markedOnset<event.onset+event.duration?"!mark!":""}${annotation?`"${annotation}"`:""}`;if(!event.pitches.length)parts.push(`${prefix}z${suffix}`);else if(event.pitches.length===1)parts.push(`${prefix}${renderPitch(event.pitches[0]!)}${suffix}${tie}`);else parts.push(`${prefix}[${event.pitches.map(renderPitch).join("")}]${suffix}${tie}`);}parts.push("|");return parts.join(" ");
};
export const exerciseToAbc=(exercise:Exercise,markedOnset?:number)=>{
 const key=`${exercise.tonalContext.tonic}${exercise.tonalContext.mode==="minor"?"m":""}`;
 return `X:1\nM:${exercise.meter.beats}/${exercise.meter.beatUnit}\nL:1/8\nK:${key}\n${serializeVoice(exercise.rightHand,exercise,accompanimentLabels(exercise),markedOnset)}\n`;
};
