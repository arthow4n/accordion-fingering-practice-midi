import type { ChordQuality, HarmonyEvent, Meter, TonalContext } from "../model";
import type { Rng } from "../random/rng";
import { ticksPerMeasure } from "../music/meter";
import { qualityForDegree } from "../music/key";
import { PROGRESSIONS } from "../patterns/progressionTemplates";
const romanFor=(degree:number,quality:HarmonyEvent["quality"],seventh:boolean)=>{
  const numeral=["","I","II","III","IV","V","VI","VII"][degree]!;
  const cased=quality==="minor"?numeral.toLowerCase():numeral;
  return `${cased}${quality==="diminished"?"°":""}${seventh?"7":""}`;
};
export const generateHarmony = (context:TonalContext,meter:Meter,measures:number,allowed:readonly string[],chordVocabulary:readonly ChordQuality[],rng:Rng): {events:HarmonyEvent[];progressionId:string} => {
  const compatible=(template:(typeof PROGRESSIONS)[number])=>template.degrees.every((degree,index)=>chordVocabulary.includes(qualityForDegree(context.mode,degree,template.sevenths?.includes(index)??false)));
  const available = PROGRESSIONS.filter(x=>allowed.includes(x.id)&&compatible(x));
  if(!available.length)throw new Error(`No progression satisfies the requested progression and chord vocabularies in ${context.tonic} ${context.mode}`);
  const progression = rng.pick(available);
  const duration=ticksPerMeasure(meter);
  const events=Array.from({length:measures},(_,i)=>{
    const cadence=i===measures-1; const degree=cadence?1:progression.degrees[i%progression.degrees.length]!;
    const seventh=progression.sevenths?.includes(i%progression.degrees.length) ?? false;
    const fn=degree===1||degree===6?"tonic":degree===5||degree===7?"dominant":"predominant";
    const quality=qualityForDegree(context.mode,degree,seventh);
    return {id:`harmony-${i}`,onset:i*duration,duration,rootDegree:{degree:degree as 1|2|3|4|5|6|7,alteration:0,octaveOffset:0},quality,function:fn,symbol:romanFor(degree,quality,seventh)} satisfies HarmonyEvent;
  });
  return {events,progressionId:progression.id};
};
