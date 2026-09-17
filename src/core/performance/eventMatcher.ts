import type { PerformedMidiEvent } from "../model";
import type { TimedExpectedEvent } from "./timeline";
export type MatchClassification="correct"|"wrongPitch"|"missed"|"extra"|"early"|"late";
export type EventMatch={expected?:TimedExpectedEvent;performed:PerformedMidiEvent[];classification:MatchClassification;timingErrorMs?:number};
export type MatchOptions={earlyToleranceMs:number;lateToleranceMs:number;simultaneityWindowMs:number};
export const defaultMatchOptions:MatchOptions={earlyToleranceMs:180,lateToleranceMs:250,simultaneityWindowMs:80};
export const matchEvents=(expected:TimedExpectedEvent[],performed:PerformedMidiEvent[],options=defaultMatchOptions):EventMatch[]=>{
 const notes=performed.filter(p=>p.type==="noteOn").sort((a,b)=>a.timestampMs-b.timestampMs); const used=new Set<number>(); const result:EventMatch[]=[];
 for(const target of expected){
  const candidates=notes.map((p,i)=>({p,i,d:p.timestampMs-target.expectedMs})).filter(x=>!used.has(x.i)&&x.d>=-options.earlyToleranceMs&&x.d<=options.lateToleranceMs);
  const exact=candidates.filter(x=>target.pitches.some(p=>p.midi===x.p.midiNote));
  const selected=(target.pitches.length>1?exact.filter(x=>Math.abs(x.p.timestampMs-(exact[0]?.p.timestampMs??0))<=options.simultaneityWindowMs):exact.slice(0,1));
  if(selected.length){selected.forEach(x=>used.add(x.i));const error=selected.reduce((s,x)=>s+x.d,0)/selected.length;const complete=new Set(selected.map(x=>x.p.midiNote)).size===new Set(target.pitches.map(x=>x.midi)).size;result.push({expected:target,performed:selected.map(x=>x.p),classification:!complete?"wrongPitch":error < -options.earlyToleranceMs/2?"early":error>options.lateToleranceMs/2?"late":"correct",timingErrorMs:error});}
  else if(candidates.length){const x=candidates[0]!;used.add(x.i);result.push({expected:target,performed:[x.p],classification:"wrongPitch",timingErrorMs:x.d});}
  else result.push({expected:target,performed:[],classification:"missed"});
 }
 notes.forEach((p,i)=>{if(!used.has(i))result.push({performed:[p],classification:"extra"});}); return result;
};
