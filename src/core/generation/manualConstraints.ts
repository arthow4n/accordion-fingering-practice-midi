import type { Exercise } from "../model";
import type { TrainingRequest } from "../training/trainingIntent";
import { realizeScaleDegree } from "../music/key";
import { Note } from "tonal";

const bassRoots=["Ab","Eb","Bb","F","C","G","D","A","E","B"] as const;

export const manualConstraintViolations=(exercise:Exercise,request:TrainingRequest)=>{
 const violations:string[]=[];const right=exercise.rightHand.filter(event=>event.pitches.length&&!event.metadata.tieFromPrevious);
 if(right.some(event=>event.pitches.some(pitch=>pitch.midi<request.rightHand.range.low||pitch.midi>request.rightHand.range.high)))violations.push("melody cannot fit the selected pitch range");
 for(let index=1;index<right.length;index++){const jump=Math.abs(right[index]!.pitches[0]!.midi-right[index-1]!.pitches[0]!.midi);if(jump<request.rightHand.minJump||jump>request.rightHand.maxJump)violations.push(`right-hand jump ${jump} outside ${request.rightHand.minJump}..${request.rightHand.maxJump}`);}
 const accidentals=right.filter(event=>event.metadata.chromatic).length;if(accidentals>request.rightHand.maxAccidentalsPerExercise)violations.push(`${accidentals} right-hand accidentals exceeds ${request.rightHand.maxAccidentalsPerExercise}`);
 const bass=exercise.harmony.map(event=>Note.pitchClass(realizeScaleDegree(exercise.tonalContext,event.rootDegree,4).name));
 const low=bassRoots.indexOf(request.leftHand.bassRootLow),high=bassRoots.indexOf(request.leftHand.bassRootHigh);
 for(const root of bass){const index=bassRoots.indexOf(root as typeof bassRoots[number]);if(index<low||index>high)violations.push(`bass root ${root} outside ${request.leftHand.bassRootLow}..${request.leftHand.bassRootHigh}`);}
 for(let index=1;index<bass.length;index++){const jump=Math.abs(bassRoots.indexOf(bass[index] as typeof bassRoots[number])-bassRoots.indexOf(bass[index-1] as typeof bassRoots[number]));if(jump<request.leftHand.minJump||jump>request.leftHand.maxJump)violations.push(`left-hand jump ${jump} outside ${request.leftHand.minJump}..${request.leftHand.maxJump}`);}
 return [...new Set(violations)];
};
