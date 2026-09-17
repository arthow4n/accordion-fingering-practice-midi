import type { Exercise } from "../model";
import type { InstrumentProfile } from "../instrument/instrumentProfile";
export type ValidationResult={valid:boolean;errors:string[]};
export const validateExercise=(exercise:Exercise,instrument:InstrumentProfile):ValidationResult=>{
 const errors:string[]=[];
 for(const hand of ["rightHand","leftHand"] as const){
  const events=exercise[hand];
  for(const event of events){
   if(event.duration<=0)errors.push(`${event.id}: non-positive duration`);
   if(event.onset<0||event.onset+event.duration>exercise.totalDuration)errors.push(`${event.id}: outside timeline`);
   if(hand==="rightHand"&&!instrument.canPlayRightHandChord(event.pitches))errors.push(`${event.id}: unplayable RH`);
   if(hand==="leftHand"&&!instrument.canPlayBass(event))errors.push(`${event.id}: unplayable LH`);
  }
 }
 if(exercise.harmony.reduce((s,h)=>s+h.duration,0)!==exercise.totalDuration)errors.push("harmony duration is incomplete");
 for(const value of Object.values(exercise.difficulty))if(!Number.isFinite(value))errors.push("non-finite difficulty");
 return {valid:errors.length===0,errors};
};
