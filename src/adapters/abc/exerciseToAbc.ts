import { Note } from "tonal";
import type { Exercise, ExerciseEvent, Pitch, TonalContext } from "../../core/model";
import { scaleNotes } from "../../core/music/key";
import { ticksPerMeasure } from "../../core/music/meter";
const accidental=(name:string)=>name.includes("#")?"^":name.includes("b")?"_":"";
const letter=(name:string)=>name[0]!.toUpperCase();
const abcBase=(pitch:Pitch)=>{const parsed=Note.get(pitch.name);let text=parsed.letter!;if((parsed.oct??4)>=5)text=text.toLowerCase()+"'".repeat(Math.max(0,(parsed.oct??4)-5));else text+=",".repeat(Math.max(0,4-(parsed.oct??4)));return text;};
const signatureMap=(context:TonalContext)=>new Map(scaleNotes(context).map(n=>[letter(n),accidental(n)]));
const serializeVoice=(events:ExerciseEvent[],exercise:Exercise)=>{
 const signature=signatureMap(exercise.tonalContext), measure=ticksPerMeasure(exercise.meter);let currentMeasure=-1;let state=new Map<string,string>();const parts:string[]=[];
 const renderPitch=(p:Pitch)=>{const parsed=Note.get(p.name),key=`${parsed.letter}${parsed.oct}`,desired=accidental(p.name),active=state.get(key)??signature.get(letter(p.name))??"";let prefix="";if(desired!==active){prefix=desired||"=";state.set(key,desired);}return prefix+abcBase(p);};
 for(const event of events){const mi=Math.floor(event.onset/measure);if(mi!==currentMeasure){if(currentMeasure>=0)parts.push("|");currentMeasure=mi;state=new Map();}const duration=event.duration/240;const suffix=duration===1?"":Number.isInteger(duration)?String(duration):`/${Math.round(1/duration)}`;const tie=event.metadata.tieToNext?"-":"";if(!event.pitches.length)parts.push(`z${suffix}`);else if(event.pitches.length===1)parts.push(`${renderPitch(event.pitches[0]!)}${suffix}${tie}`);else parts.push(`[${event.pitches.map(renderPitch).join("")}]${suffix}${tie}`);}parts.push("|");return parts.join(" ");
};
export const exerciseToAbc=(exercise:Exercise)=>{
 const key=`${exercise.tonalContext.tonic}${exercise.tonalContext.mode==="minor"?"m":""}`;
 return `X:1\nT:${exercise.metadata.intent} · seed ${exercise.seed}\nM:${exercise.meter.beats}/${exercise.meter.beatUnit}\nL:1/8\nQ:1/4=${exercise.tempoBpm}\nK:${key}\n%%score { RH LH }\nV:RH clef=treble name="Right"\n${serializeVoice(exercise.rightHand,exercise)}\nV:LH clef=bass name="Left"\n${exercise.leftHand.length?serializeVoice(exercise.leftHand,exercise):`z${exercise.totalDuration/240} |`}\n`;
};
