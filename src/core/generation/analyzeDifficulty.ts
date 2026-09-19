import type { DifficultyVector, Exercise, ExerciseEvent } from "../model";
import { MELODIC_PATTERNS } from "../patterns/melodicPatterns";
import { RHYTHM_CELLS } from "../patterns/rhythmCells";
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const average=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
const movement=(events:ExerciseEvent[])=>{const sounding=events.filter(event=>event.pitches.length);return average(sounding.slice(1).map((event,index)=>Math.abs(event.pitches[0]!.midi-sounding[index]!.pitches[0]!.midi)/12));};
export const analyzeDifficulty=(exercise:Omit<Exercise,"difficulty">):DifficultyVector=>{
 const all=[...exercise.rightHand,...exercise.leftHand], notes=all.filter(e=>e.pitches.length), challenges=all.filter(e=>e.metadata.challengeTags.length);
 const patternNovelty=new Set(exercise.rightHand.map(e=>e.metadata.patternId)).size/Math.max(1,exercise.phrase.length);
 const rhythmNovelty=new Set(all.map(e=>e.metadata.rhythmCellId)).size/Math.max(1,exercise.phrase.length);
 const rightOnsets=new Set(exercise.rightHand.filter(e=>e.pitches.length).map(e=>e.onset)),leftOnsets=new Set(exercise.leftHand.filter(e=>e.pitches.length).map(e=>e.onset));const independent=[...rightOnsets].filter(x=>!leftOnsets.has(x)).length+[...leftOnsets].filter(x=>!rightOnsets.has(x)).length;
 const patternComplexity=average([...new Set(exercise.rightHand.map(e=>e.metadata.patternId))].map(id=>MELODIC_PATTERNS.find(pattern=>pattern.id===id)?.complexity??0));const rhythmComplexity=average([...new Set(all.map(e=>e.metadata.rhythmCellId))].map(id=>RHYTHM_CELLS.find(cell=>cell.id===id)?.complexity??0));
 return {tonal:clamp((exercise.tonalContext.tonic!=="C"?.25:0)+exercise.rightHand.filter(e=>e.metadata.chromatic).length/Math.max(1,exercise.rightHand.length)),pitchMovement:clamp(movement(exercise.rightHand)),patternComplexity:clamp(patternComplexity),rhythm:clamp(rhythmComplexity||rhythmNovelty),density:clamp(notes.length/(exercise.phrase.length*12)),harmony:clamp(new Set(exercise.harmony.map(h=>h.quality)).size/4),rightHandMotor:clamp(movement(exercise.rightHand)),leftHandMotor:clamp(average(exercise.leftHand.slice(1).map(event=>event.metadata.bassDistance??0))),coordination:clamp(exercise.leftHand.length?independent/Math.max(1,rightOnsets.size+leftOnsets.size):0),predictability:clamp(1-patternNovelty),tempo:clamp((exercise.tempoBpm-30)/170),challengeDensity:clamp(challenges.length/Math.max(1,all.length))};
};
