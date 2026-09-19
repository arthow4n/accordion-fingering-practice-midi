import type { PitchRange } from "../model";
import { createRng } from "../random/rng";

export type PitchRegister="rotating"|"low"|"middle"|"high"|"custom";
export const registerRanges={low:{low:55,high:67},middle:{low:67,high:79},high:{low:79,high:91}};

// Consecutive exercise seeds form reproducible, shuffled three-exercise cycles.
export const registerForSeed=(seed:number):keyof typeof registerRanges=>{
 const cycle=Math.floor(seed/3),index=((seed%3)+3)%3;
 const rng=createRng(cycle);const registers:Array<keyof typeof registerRanges>=["low","middle","high"];
 for(let i=2;i>0;i--){const j=rng.integer(0,i);[registers[i],registers[j]]=[registers[j]!,registers[i]!];}
 return registers[index]!;
};
export const pitchWindow=(mode:PitchRegister,custom:PitchRange,seed:number,instrument:PitchRange):PitchRange=>{
 const range=mode==="custom"?custom:registerRanges[mode==="rotating"?registerForSeed(seed):mode];
 let low=Math.max(55,instrument.low,range.low),high=Math.min(91,instrument.high,range.high);
 if(low>high)throw new Error("The selected pitch range is outside the instrument's G3–G6 range.");
 // Shift an octave-sized window slightly within the register across exercises.
 // Twelve chromatic pitches still allow every pitch class in the chosen key.
 if(mode!=="custom"&&high-low===12){
  const placement=createRng(seed).integer(0,2);
  if(placement===1)low++;
  if(placement===2)high--;
 }
 return {low,high};
};
