import type { InstrumentProfile } from "./instrumentProfile";
import { Note } from "tonal";
import { STRADELLA_ROOTS, stradellaMovementCost } from "./stradella";
export const accordionProfile: InstrumentProfile = {
  id:"standard-72-bass", rightHandRange:{low:55,high:91}, leftHandRange:{low:36,high:67},
  rightHandMovementCost:(a,b)=>Math.abs(a.midi-b.midi)/12,
  leftHandMovementCost:(a,b)=>{const fromColumn=a.metadata.stradellaColumn,toColumn=b.metadata.stradellaColumn;if(fromColumn!==undefined&&toColumn!==undefined)return stradellaMovementCost(STRADELLA_ROOTS[fromColumn]!,STRADELLA_ROOTS[toColumn]!,a.metadata.stradellaRow??"fundamental",b.metadata.stradellaRow??"fundamental");const from=a.pitches[0],to=b.pitches[0];return from&&to?stradellaMovementCost(Note.pitchClass(from.name),Note.pitchClass(to.name)):0;},
  canPlayRightHandChord:(p)=>p.length<=4 && p.every(x=>x.midi>=55&&x.midi<=91),
  canPlayBass:(e)=>e.pitches.every(x=>x.midi>=36&&x.midi<=67),
};
