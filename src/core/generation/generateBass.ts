import type { ExerciseEvent, HarmonyEvent, Meter, Pitch, TonalContext } from "../model";
import type { TrainingRequest } from "../training/trainingIntent";
import { chordPitches } from "../music/harmony";
import { realizeScaleDegree } from "../music/key";
import { pitchFromMidi } from "../music/pitch";
import { ticksPerBeat, ticksPerMeasure } from "../music/meter";

type BassAtom={offset:number;duration:number;kind:"root"|"fifth"|"chord"};
const atomsFor=(style:TrainingRequest["leftHand"]["accompanimentStyle"],meter:Meter):BassAtom[]=>{
 const beat=ticksPerBeat(meter),measure=ticksPerMeasure(meter);
 if(meter.beatUnit===8)return style==="waltz"?[{offset:0,duration:beat*2,kind:"root"},{offset:beat*2,duration:measure-beat*2,kind:"chord"}]:[{offset:0,duration:beat*3,kind:"root"},{offset:beat*3,duration:measure-beat*3,kind:"chord"}];
 if(style==="bassChord")return[{offset:0,duration:measure/2,kind:"root"},{offset:measure/2,duration:measure/2,kind:"chord"}];
 if(style==="waltz")return[{offset:0,duration:beat,kind:"root"},{offset:beat,duration:beat,kind:"chord"},{offset:beat*2,duration:measure-beat*2,kind:"chord"}];
 if(style==="tango"){const atoms:BassAtom[]=[{offset:0,duration:beat,kind:"root"},{offset:beat,duration:beat/2,kind:"chord"},{offset:beat*1.5,duration:beat/2,kind:"chord"},{offset:beat*2,duration:beat,kind:"fifth"},{offset:beat*3,duration:measure-beat*3,kind:"chord"}];return atoms.filter(x=>x.duration>0&&x.offset<measure).map(x=>({...x,duration:Math.min(x.duration,measure-x.offset)}));}
 if(style==="swing")return Array.from({length:meter.beats},(_,i):BassAtom[]=>[{offset:i*beat,duration:beat*2/3,kind:i%2?"fifth":"root"},{offset:i*beat+beat*2/3,duration:beat/3,kind:"chord"}]).flat();
 return Array.from({length:meter.beats},(_,i)=>({offset:i*beat,duration:beat,kind:i%2?"chord":style==="alternatingBass"&&i===2?"fifth":"root" as BassAtom["kind"]}));
};

export const generateBass=(context:TonalContext,meter:Meter,harmony:HarmonyEvent[],request:TrainingRequest):ExerciseEvent[]=>{
 if(!request.leftHand.enabled)return[];const measure=ticksPerMeasure(meter);let previousRoot:Pitch|undefined;
 return harmony.flatMap((h,mi)=>{
  const root=realizeScaleDegree(context,{...h.rootDegree,octaveOffset:-1},3);const fifth=pitchFromMidi(root.midi+7,context.tonic.includes("b"));const chord=chordPitches(context,h,2).filter(p=>p.midi>=36&&p.midi<=67);
  return atomsFor(request.leftHand.accompanimentStyle,meter).map((atom,i)=>{
   const effectiveKind=atom.kind==="fifth"&&request.leftHand.movementDifficulty<.35?"root":atom.kind;
   const pitches=effectiveKind==="root"?[root]:effectiveKind==="fifth"?[fifth]:chord;const bassDistance=previousRoot?Math.abs(root.midi-previousRoot.midi):0;if(effectiveKind!=="chord")previousRoot=pitches[0];
   return{id:`lh-${mi}-${i}`,onset:mi*measure+atom.offset,duration:atom.duration,pitches,hand:"left",metadata:{harmonyId:h.id,scaleDegree:h.rootDegree,rhythmCellId:`${request.leftHand.accompanimentStyle}-${effectiveKind}`,metricStrength:atom.offset===0?"strong":atom.offset%ticksPerBeat(meter)===0?"medium":"weak",challengeTags:[],accompaniment:`${h.symbol} ${effectiveKind}`,bassDistance}} satisfies ExerciseEvent;
  });
 });
};
