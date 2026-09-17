import type { ExerciseEvent, HarmonyEvent, Meter, PatternFamily, PhraseSection, ScaleDegree, TonalContext } from "../model";
import type { Rng } from "../random/rng";
import type { TrainingRequest } from "../training/trainingIntent";
import { realizeScaleDegree } from "../music/key";
import { metricStrength, ticksPerMeasure } from "../music/meter";
import { MELODIC_PATTERNS, transformPattern } from "../patterns/melodicPatterns";
import { cellsForMeter } from "../patterns/rhythmCells";
const normalizeDegree=(abstract:number):ScaleDegree=>{ const wrapped=((abstract%7)+7)%7; return {degree:(wrapped+1) as ScaleDegree["degree"],alteration:0,octaveOffset:Math.floor(abstract/7)}; };
export const generateMelody=(context:TonalContext,meter:Meter,harmony:HarmonyEvent[],phrase:PhraseSection[],request:TrainingRequest,rng:Rng):ExerciseEvent[]=>{
  const measureTicks=ticksPerMeasure(meter); let previousMidi:number|undefined; let previousPatternId:string|undefined;
  return phrase.flatMap((section,measure)=>{
    const allowed=MELODIC_PATTERNS.filter(p=>request.patterns.allowedFamilies.includes(p.family));
    const target=allowed.filter(p=>request.patterns.targetFamilies.includes(p.family));
    const repeated=previousPatternId&&rng.next()<request.patterns.repetition?allowed.find(p=>p.id===previousPatternId):undefined;
    const pattern=repeated??rng.pick(target.length&&rng.next()<request.patterns.targetDensity?target:allowed);previousPatternId=pattern.id;
    const raw=request.intent==="randomDecoding"?Array.from({length:4},()=>rng.integer(-4,8)):pattern.relativeDegrees;
    const relative=transformPattern(raw,section.transformation);
    const cells=cellsForMeter(meter).filter(c=> request.rhythm.smallestSubdivision!=="quarter" || c.atoms.every(a=>a.duration>=480));
    const simple=cells.filter(c=>!c.syncopated); const cell=rng.pick((rng.next()<request.rhythm.syncopation?cells:simple).length?(rng.next()<request.rhythm.syncopation?cells:simple):cells);
    const start=section.label==="cadence"?4:rng.integer(0,3); let onset=measure*measureTicks;
    return cell.atoms.map((atom,index)=>{
      const abstract=start+(relative[index%relative.length]??0); const degree=normalizeDegree(abstract);
      const challenge=rng.next()<request.challenge.density?rng.pick(request.challenge.allowedTypes):undefined;
      const chromatic=challenge==="chromatic"||rng.next()<request.tonal.chromaticism;
      if(chromatic) degree.alteration=rng.next()<.5?-1:1;
      let pitch=realizeScaleDegree(context,degree,4);
      while(pitch.midi<request.rightHand.range.low){degree.octaveOffset++;pitch=realizeScaleDegree(context,degree,4);}
      while(pitch.midi>request.rightHand.range.high){degree.octaveOffset--;pitch=realizeScaleDegree(context,degree,4);}
      const event:ExerciseEvent={id:`rh-${measure}-${index}`,onset,duration:atom.duration,pitches:atom.rest?[]:[pitch],hand:"right",metadata:{scaleDegree:degree,harmonyId:harmony[measure]?.id,motifId:`motif-${measure}`,patternId:pattern.id,patternFamily:pattern.family as PatternFamily,rhythmCellId:cell.id,intervalFromPrevious:previousMidi===undefined?undefined:pitch.midi-previousMidi,metricStrength:metricStrength(onset%measureTicks,meter),challengeTags:challenge?[challenge]:[],chromatic}};
      if(!atom.rest)previousMidi=pitch.midi; onset+=atom.duration; return event;
    });
  });
};
