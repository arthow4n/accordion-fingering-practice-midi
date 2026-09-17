import type { TrainingIntent } from "../model";
import type { TrainingRequest } from "./trainingIntent";

/** Intent presets lower unrelated dimensions before raising the target dimension. */
export const applyIntentPreset=(request:TrainingRequest,intent:TrainingIntent):TrainingRequest=>{
 const next=structuredClone(request); next.intent=intent;
 switch(intent){
  case "patternFocus": next.patterns.targetDensity=Math.max(.75,next.patterns.targetDensity);next.rhythm.smallestSubdivision="eighth";next.rhythm.syncopation=Math.min(.1,next.rhythm.syncopation);break;
  case "keyFluency": next.patterns.allowedFamilies=["scale","neighbor","cadence","chordTone"];next.rhythm.smallestSubdivision="quarter";next.tonal.chromaticism=0;break;
  case "rhythmFocus": next.patterns.allowedFamilies=["repeated","scale","chordTone"];next.rhythm.smallestSubdivision="sixteenth";next.rhythm.syncopation=Math.max(.5,next.rhythm.syncopation);next.rightHand.movementDifficulty=.15;break;
  case "pitchIntervalFocus": next.rhythm.smallestSubdivision="quarter";next.rhythm.syncopation=0;next.patterns.allowedFamilies=["scale","thirds","triad","leapRecovery"];break;
  case "readAhead": next.patterns.repetition=Math.max(.75,next.patterns.repetition);next.patterns.variation=Math.min(.3,next.patterns.variation);next.rhythm.syncopation=Math.min(.15,next.rhythm.syncopation);next.challenge.density=Math.max(.04,Math.min(.1,next.challenge.density));break;
  case "leftHandFocus": next.patterns.allowedFamilies=["repeated","scale","chordTone"];next.rhythm.smallestSubdivision="quarter";next.leftHand.movementDifficulty=Math.max(.7,next.leftHand.movementDifficulty);break;
  case "coordination": next.patterns.allowedFamilies=["repeated","scale"];next.rightHand.movementDifficulty=.2;next.leftHand.movementDifficulty=.2;next.coordination.difficulty=Math.max(.7,next.coordination.difficulty);break;
  case "randomDecoding": next.patterns.repetition=0;next.patterns.variation=1;next.rhythm.smallestSubdivision="quarter";next.leftHand.enabled=false;next.tonal.chromaticism=Math.max(.35,next.tonal.chromaticism);break;
  case "balanced": break;
 }
 return next;
};
