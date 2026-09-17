import type { DifficultyVector, Exercise, ExerciseEvent } from "../model";
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const average=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
const movement=(events:ExerciseEvent[])=>average(events.slice(1).map((e,i)=>Math.abs((e.pitches[0]?.midi??0)-(events[i]?.pitches[0]?.midi??0))/12));
export const analyzeDifficulty=(exercise:Omit<Exercise,"difficulty">):DifficultyVector=>{
 const all=[...exercise.rightHand,...exercise.leftHand], notes=all.filter(e=>e.pitches.length), challenges=all.filter(e=>e.metadata.challengeTags.length);
 const patternNovelty=new Set(exercise.rightHand.map(e=>e.metadata.patternId)).size/Math.max(1,exercise.phrase.length);
 const rhythmNovelty=new Set(all.map(e=>e.metadata.rhythmCellId)).size/Math.max(1,exercise.phrase.length);
 return {tonal:clamp((exercise.tonalContext.tonic!=="C"?.25:0)+exercise.rightHand.filter(e=>e.metadata.chromatic).length/Math.max(1,exercise.rightHand.length)),pitchMovement:clamp(movement(exercise.rightHand)),patternComplexity:clamp(patternNovelty),rhythm:clamp(rhythmNovelty),density:clamp(notes.length/(exercise.phrase.length*12)),harmony:clamp(new Set(exercise.harmony.map(h=>h.quality)).size/4),rightHandMotor:clamp(movement(exercise.rightHand)),leftHandMotor:clamp(movement(exercise.leftHand)),coordination:clamp(exercise.leftHand.length?Math.abs(exercise.rightHand.length-exercise.leftHand.length)/(exercise.rightHand.length+exercise.leftHand.length):0),predictability:clamp(1-patternNovelty),tempo:clamp((exercise.tempoBpm-30)/170),challengeDensity:clamp(challenges.length/Math.max(1,all.length))};
};
