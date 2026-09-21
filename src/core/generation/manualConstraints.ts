import type { Exercise } from "../model";
import type { TrainingRequest } from "../training/trainingIntent";
import { stradellaColumn } from "../instrument/stradella";




export const manualConstraintViolations=(exercise:Exercise,request:TrainingRequest)=>{
 const violations:string[]=[];const right=exercise.rightHand.filter(event=>event.pitches.length&&!event.metadata.tieFromPrevious);
 if(right.some(event=>event.pitches.some(pitch=>pitch.midi<request.rightHand.range.low||pitch.midi>request.rightHand.range.high)))violations.push("melody cannot fit the selected pitch range");
 for(let index=1;index<right.length;index++){const jump=Math.abs(right[index]!.pitches[0]!.midi-right[index-1]!.pitches[0]!.midi);if(jump>request.rightHand.maxJump)violations.push(`right-hand jump ${jump} exceeds ${request.rightHand.maxJump}`);}
 const accidentals=right.filter(event=>event.metadata.chromatic).length;if(accidentals>request.rightHand.maxAccidentalsPerExercise)violations.push(`${accidentals} right-hand accidentals exceeds ${request.rightHand.maxAccidentalsPerExercise}`);
 const bass=exercise.leftHand.filter(event=>event.pitches.length&&(event.metadata.stradellaRow==="fundamental"||event.metadata.stradellaRow==="counterbass"));
 const low=stradellaColumn(request.leftHand.bassRootLow),high=stradellaColumn(request.leftHand.bassRootHigh);
 for(const event of bass){const root=event.metadata.stradellaButton?.split(" ")[0]??"";const index=stradellaColumn(root);if(index<low||index>high)violations.push(`bass root ${root} outside ${request.leftHand.bassRootLow}..${request.leftHand.bassRootHigh}`);}
 for(let index=1;index<bass.length;index++){const jump=Math.abs((bass[index]!.metadata.stradellaColumn??0)-(bass[index-1]!.metadata.stradellaColumn??0));if(jump>request.leftHand.maxJump)violations.push(`left-hand jump ${jump} exceeds ${request.leftHand.maxJump}`);}
 return [...new Set(violations)];
};
