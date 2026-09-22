import type { DifficultyVector } from "../model";
import type { TrainingRequest } from "../training/trainingIntent";

type Bound={min:number;max:number};
export type DifficultyBounds={ [K in keyof DifficultyVector]: Bound };
const clamp=(value:number)=>Math.max(0,Math.min(1,value));
export const requestedDifficultyBounds=(request:TrainingRequest):DifficultyBounds=>{
 const subdivision=request.rhythm.noteValue==="sixteenth"?.9:request.rhythm.noteValue==="eighth"?.5:.2;
 const rhythmDensity=request.rhythm.style==="steady"?(request.rhythm.noteValue==="sixteenth"?1:request.rhythm.noteValue==="eighth"?.7:request.rhythm.noteValue==="quarter"?.4:.2):request.rhythm.noteDensity;
 const tempo=clamp((request.tempoBpm-30)/170);
 const jumpAllowance=request.rightHand.jumpFrequency==="none"?0:request.rightHand.jumpFrequency==="occasional"?.15:.4;
 const leftJumpAllowance=request.leftHand.jumpFrequency==="none"?0:request.leftHand.jumpFrequency==="occasional"?.15:.4;
 return{
  tonal:{min:0,max:clamp(.4+request.tonal.chromaticism)},
  pitchMovement:{min:0,max:clamp(request.rightHand.movementDifficulty+.25+jumpAllowance)},
  patternComplexity:{min:0,max:clamp(.25+request.patterns.variation*.6+request.patterns.targetDensity*.2)},
  rhythm:{min:0,max:clamp(subdivision+request.rhythm.syncopation*.4+.1)},
  // Overall density includes accompaniment events, while noteDensity controls
  // the right-hand rhythm. Leave room for the selected bass pattern even when
  // the melody is intentionally sparse.
  density:{min:0,max:clamp(.5+rhythmDensity*.65)},
  harmony:{min:0,max:clamp(request.harmony.chordVocabulary.length/4)},
  rightHandMotor:{min:0,max:clamp(request.rightHand.movementDifficulty+.25+jumpAllowance)},
  leftHandMotor:{min:0,max:request.leftHand.enabled?clamp(request.leftHand.movementDifficulty+.25+leftJumpAllowance):0},
  coordination:{min:0,max:request.leftHand.enabled?clamp(Math.max(request.coordination.difficulty+.35, rhythmDensity>=.7?.9:rhythmDensity>=.5?.8:0)):0},
  predictability:{min:clamp(request.patterns.repetition*.4),max:1},
  tempo:{min:Math.max(0,tempo-.001),max:Math.min(1,tempo+.001)},
  challengeDensity:{min:Math.max(0,request.challenge.density-.1),max:clamp(request.challenge.density+.15+jumpAllowance)},
 };
};
export const satisfiesDifficultyBounds=(difficulty:DifficultyVector,bounds:DifficultyBounds)=>Object.entries(bounds).every(([dimension,bound])=>{const value=difficulty[dimension as keyof DifficultyVector];return value>=bound.min&&value<=bound.max;});
export const difficultyViolations=(difficulty:DifficultyVector,bounds:DifficultyBounds)=>Object.entries(bounds).flatMap(([dimension,bound])=>{const value=difficulty[dimension as keyof DifficultyVector];return value<bound.min||value>bound.max?[`${dimension}=${value.toFixed(3)} outside ${bound.min.toFixed(3)}..${bound.max.toFixed(3)}`]:[];});
