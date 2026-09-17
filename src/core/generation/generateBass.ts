import type { ExerciseEvent, HarmonyEvent, Meter, TonalContext } from "../model";
import type { TrainingRequest } from "../training/trainingIntent";
import { chordPitches } from "../music/harmony";
import { realizeScaleDegree } from "../music/key";
import { ticksPerBeat, ticksPerMeasure } from "../music/meter";
export const generateBass=(context:TonalContext,meter:Meter,harmony:HarmonyEvent[],request:TrainingRequest):ExerciseEvent[]=>{
  if(!request.leftHand.enabled)return [];
  const beat=ticksPerBeat(meter), measure=ticksPerMeasure(meter);
  return harmony.flatMap((h,mi)=>Array.from({length:meter.beats},(_,i)=>{
    const chordBeat=request.leftHand.accompanimentStyle==="waltz"?i>0:i%2===1;
    const root=realizeScaleDegree(context,{...h.rootDegree,octaveOffset:-1},3);
    const pitches=chordBeat?chordPitches(context,h,2).filter(p=>p.midi>=36&&p.midi<=67):[root];
    return {id:`lh-${mi}-${i}`,onset:mi*measure+i*beat,duration:beat,pitches,hand:"left",metadata:{harmonyId:h.id,scaleDegree:h.rootDegree,rhythmCellId:`${request.leftHand.accompanimentStyle}-beat`,metricStrength:i===0?"strong":"medium",challengeTags:[],accompaniment:`${h.symbol} ${chordBeat?"chord":"bass"}`}};
  }));
};
