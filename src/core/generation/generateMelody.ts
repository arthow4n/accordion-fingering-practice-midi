import type { ExerciseEvent, HarmonyEvent, Meter, PatternFamily, PatternTransformation, PhraseSection, Pitch, ScaleDegree, TonalContext } from "../model";
import type { Rng } from "../random/rng";
import type { TrainingRequest } from "../training/trainingIntent";
import { realizeScaleDegree } from "../music/key";
import { metricStrength, ticksPerMeasure } from "../music/meter";
import { MELODIC_PATTERNS, transformPattern, type MelodicPattern } from "../patterns/melodicPatterns";
import { cellsForMeter, type RhythmCell } from "../patterns/rhythmCells";

type MotifPlan={pattern:MelodicPattern;relative:number[];start:number;cell:RhythmCell};
const normalizeDegree=(abstract:number):ScaleDegree=>{const wrapped=((abstract%7)+7)%7;return{degree:(wrapped+1) as ScaleDegree["degree"],alteration:0,octaveOffset:Math.floor(abstract/7)};};
const chordDegrees=(harmony:HarmonyEvent)=>{const root=harmony.rootDegree.degree-1;return [root,root+2,root+4,...(harmony.quality==="dominant7"?[root+6]:[])];};
const nearest=(degree:number,choices:number[])=>choices.map(choice=>[choice,Math.abs(choice-degree)] as const).sort((a,b)=>a[1]-b[1])[0]![0];

export const generateMelody=(context:TonalContext,meter:Meter,harmony:HarmonyEvent[],phrase:PhraseSection[],request:TrainingRequest,rng:Rng):ExerciseEvent[]=>{
 const measureTicks=ticksPerMeasure(meter);let previousMidi:number|undefined;let baseMotif:MotifPlan|undefined;let priorMotif:MotifPlan|undefined;let tieIntoNext=false;let tiedPitch:Pitch|undefined;let tiedDegree:ScaleDegree|undefined;let tiedChromatic=false;
 const allowed=MELODIC_PATTERNS.filter(pattern=>request.patterns.allowedFamilies.includes(pattern.family)&&Math.max(...pattern.relativeDegrees.map(Math.abs))/7<=request.rightHand.movementDifficulty+.25);
 const patterns=allowed.length?allowed:MELODIC_PATTERNS.filter(pattern=>request.patterns.allowedFamilies.includes(pattern.family));
 const target=patterns.filter(pattern=>request.patterns.targetFamilies.includes(pattern.family));
 const allCells=cellsForMeter(meter).filter(cell=>request.rhythm.smallestSubdivision!=="quarter"||cell.atoms.every(atom=>atom.duration>=480));
 const desiredAtoms=2+request.rhythm.noteDensity*14;
 const cells=allCells.filter(cell=>cell.complexity<=Math.max(.15,request.rhythm.syncopation+.35));
 const chooseCell=()=>rng.pick((cells.length?cells:allCells).map(cell=>({cell,difference:Math.abs(cell.atoms.length-desiredAtoms)})).sort((a,b)=>a.difference-b.difference).slice(0,3).map(x=>x.cell));
 const choosePattern=()=>rng.pick(target.length&&rng.next()<request.patterns.targetDensity?target:patterns);

 return phrase.flatMap((section,measure)=>{
  const isRelated=section.label==="A'"||section.label==="A''";
  let motif:MotifPlan;
  if(isRelated&&baseMotif){
   const transformation:PatternTransformation=rng.next()<request.patterns.sequenceProbability?(rng.next()<.5?"sequenceUp":"sequenceDown"):section.transformation;
   motif={...baseMotif,relative:transformPattern(baseMotif.relative,transformation),start:transformation==="newStart"?rng.integer(0,3):baseMotif.start,cell:rng.next()<request.patterns.variation?chooseCell():baseMotif.cell};
  }else if(priorMotif&&rng.next()<request.patterns.repetition&&section.label!=="B"&&section.label!=="cadence"){
   motif={...priorMotif,relative:[...priorMotif.relative]};
  }else{
   const pattern=choosePattern();const raw=request.intent==="randomDecoding"?Array.from({length:4},()=>rng.integer(-4,8)):[...pattern.relativeDegrees];
   motif={pattern,relative:raw,start:rng.integer(0,3),cell:chooseCell()};
  }
  if(measure===0)baseMotif=motif;priorMotif=motif;
  let onset=measure*measureTicks;const activeHarmony=harmony[measure]!;const chordTones=chordDegrees(activeHarmony);
  return motif.cell.atoms.map((atom,index)=>{
   const finalCadence=section.label==="cadence"&&index===motif.cell.atoms.length-1;
   const strength=metricStrength(onset%measureTicks,meter);let abstract=motif.start+(motif.relative[index%motif.relative.length]??0);
   // Stable beats articulate the current harmony; the final cadence resolves to tonic.
   if(strength==="strong"||strength==="medium")abstract=nearest(abstract,chordTones);
   if(finalCadence)abstract=0;
   const tieFromPrevious=tieIntoNext;let degree=normalizeDegree(abstract);
   // The dominant in minor uses the harmonic-minor leading tone. It belongs to
   // the active harmony and is not counted as an injected chromatic challenge.
   if(context.mode==="minor"&&activeHarmony.rootDegree.degree===5&&degree.degree===7)degree.alteration=1;
   const challenge=rng.next()<request.challenge.density?rng.pick(request.challenge.allowedTypes):undefined;
   let chromatic=!finalCadence&&(challenge==="chromatic"||rng.next()<request.tonal.chromaticism);if(chromatic)degree.alteration=rng.next()<.5?-1:1;
   let pitch=realizeScaleDegree(context,degree,4);while(pitch.midi<request.rightHand.range.low){degree.octaveOffset++;pitch=realizeScaleDegree(context,degree,4);}while(pitch.midi>request.rightHand.range.high){degree.octaveOffset--;pitch=realizeScaleDegree(context,degree,4);}
   if(tieFromPrevious&&tiedPitch&&tiedDegree){pitch=tiedPitch;degree={...tiedDegree};chromatic=tiedChromatic;}
   const rest=!tieFromPrevious&&!finalCadence&&(atom.rest||(index>0&&rng.next()<request.rhythm.restDensity));const nextAtom=motif.cell.atoms[index+1];
   const tieToNext=!rest&&!finalCadence&&Boolean(nextAtom&&!nextAtom.rest)&&(atom.tie||rng.next()<request.rhythm.tieDensity);
   const event:ExerciseEvent={id:`rh-${measure}-${index}`,onset,duration:atom.duration,pitches:rest?[]:[pitch],hand:"right",metadata:{scaleDegree:degree,harmonyId:activeHarmony.id,motifId:isRelated?"motif-A":`motif-${measure}`,patternId:motif.pattern.id,patternFamily:motif.pattern.family as PatternFamily,rhythmCellId:motif.cell.id,intervalFromPrevious:tieFromPrevious?0:previousMidi===undefined?undefined:pitch.midi-previousMidi,metricStrength:strength,challengeTags:challenge?[challenge]:[],chromatic,tieFromPrevious,tieToNext}};
   tieIntoNext=tieToNext;if(tieToNext){tiedPitch=pitch;tiedDegree={...degree};tiedChromatic=chromatic;}if(!rest&&!tieFromPrevious)previousMidi=pitch.midi;onset+=atom.duration;return event;
  });
 });
};
