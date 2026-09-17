import type { HarmonyEvent, Meter, TonalContext } from "../model";
import type { Rng } from "../random/rng";
import { ticksPerMeasure } from "../music/meter";
import { qualityForDegree } from "../music/key";
import { PROGRESSIONS } from "../patterns/progressionTemplates";
const roman = ["","I","ii","iii","IV","V","vi","vii°"];
export const generateHarmony = (context:TonalContext,meter:Meter,measures:number,allowed:readonly string[],rng:Rng): {events:HarmonyEvent[];progressionId:string} => {
  const available = PROGRESSIONS.filter(x=>allowed.includes(x.id));
  const progression = rng.pick(available.length ? available : PROGRESSIONS);
  const duration=ticksPerMeasure(meter);
  const events=Array.from({length:measures},(_,i)=>{
    const cadence=i===measures-1; const degree=cadence?1:progression.degrees[i%progression.degrees.length]!;
    const seventh=progression.sevenths?.includes(i%progression.degrees.length) ?? false;
    const fn=degree===1||degree===6?"tonic":degree===5||degree===7?"dominant":"predominant";
    return {id:`harmony-${i}`,onset:i*duration,duration,rootDegree:{degree:degree as 1|2|3|4|5|6|7,alteration:0,octaveOffset:0},quality:qualityForDegree(context.mode,degree,seventh),function:fn,symbol:`${roman[degree]}${seventh?"7":""}`} satisfies HarmonyEvent;
  });
  return {events,progressionId:progression.id};
};
