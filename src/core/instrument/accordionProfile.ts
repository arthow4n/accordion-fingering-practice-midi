import type { InstrumentProfile } from "./instrumentProfile";
const circle = ["Db","Ab","Eb","Bb","F","C","G","D","A","E","B","F#"];
export const accordionProfile: InstrumentProfile = {
  id:"standard-72-bass", rightHandRange:{low:55,high:91}, leftHandRange:{low:36,high:67},
  rightHandMovementCost:(a,b)=>Math.abs(a.midi-b.midi)/12,
  leftHandMovementCost:(a,b)=>{ const ai=circle.findIndex(x=>a.pitches[0]?.name.startsWith(x)); const bi=circle.findIndex(x=>b.pitches[0]?.name.startsWith(x)); return ai < 0 || bi < 0 ? 1 : Math.abs(ai-bi)/6; },
  canPlayRightHandChord:(p)=>p.length<=4 && p.every(x=>x.midi>=55&&x.midi<=91),
  canPlayBass:(e)=>e.pitches.every(x=>x.midi>=36&&x.midi<=67),
};
