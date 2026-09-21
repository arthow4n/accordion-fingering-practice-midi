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
const harmonicDegrees=(context:TonalContext,harmony:HarmonyEvent):ScaleDegree[]=>{
 const intervals=harmony.quality==="major"?[0,4,7]:harmony.quality==="minor"?[0,3,7]:harmony.quality==="dominant7"?[0,4,7,10]:[0,3,6];
 const root=realizeScaleDegree(context,harmony.rootDegree,4).midi;
 return intervals.map((interval,index)=>{
  const degree=normalizeDegree(harmony.rootDegree.degree-1+index*2);
  const natural=realizeScaleDegree(context,degree,4).midi;
  const delta=((root+interval-natural+18)%12)-6;
  return {...degree,alteration:delta as ScaleDegree["alteration"]};
 });
};
const nearest=(degree:number,choices:number[])=>choices.map(choice=>[choice,Math.abs(choice-degree)] as const).sort((a,b)=>a[1]-b[1])[0]![0];
const jumpBand=(size:TrainingRequest["rightHand"]["jumpSize"],maximum:number):readonly [number,number]=>size==="small"?[1,Math.min(4,maximum)]:size==="medium"?[5,Math.min(7,maximum)]:size==="large"?[8,Math.min(11,maximum)]:size==="octave"?[12,Math.min(12,maximum)]:[13,maximum];

export const generateMelody=(context:TonalContext,meter:Meter,harmony:HarmonyEvent[],phrase:PhraseSection[],request:TrainingRequest,rng:Rng):ExerciseEvent[]=>{
 const measureTicks=ticksPerMeasure(meter);let previousMidi:number|undefined;let baseMotif:MotifPlan|undefined;let priorMotif:MotifPlan|undefined;let tieIntoNext=false;let tiedPitch:Pitch|undefined;let tiedDegree:ScaleDegree|undefined;let tiedChromatic=false;let attackedNotes=0;let occasionalJumpPlaced=false;let accidentalsRemaining=request.rightHand.maxAccidentalsPerExercise;
 const allowed=MELODIC_PATTERNS.filter(pattern=>request.patterns.allowedFamilies.includes(pattern.family)&&Math.max(...pattern.relativeDegrees.map(Math.abs))/7<=request.rightHand.movementDifficulty+.25);
 const patterns=allowed.length?allowed:MELODIC_PATTERNS.filter(pattern=>request.patterns.allowedFamilies.includes(pattern.family));
 const target=patterns.filter(pattern=>request.patterns.targetFamilies.includes(pattern.family));
 const minimumDuration=request.rhythm.smallestSubdivision==="quarter"?480:request.rhythm.smallestSubdivision==="eighth"?240:120;
 const allCells=cellsForMeter(meter).filter(cell=>cell.atoms.every(atom=>atom.duration>=minimumDuration));
 const desiredAtoms=2+request.rhythm.noteDensity*14;
 const cells=allCells.filter(cell=>(!cell.syncopated||request.rhythm.syncopation>=.35));
 const activeCells=cells.length?cells:allCells;
 const subdivisionCells=request.rhythm.noteDensity>=.5?activeCells.filter(cell=>cell.atoms.some(atom=>atom.duration===minimumDuration)):activeCells;
 const chooseCell=()=>rng.pick((subdivisionCells.length?subdivisionCells:activeCells).map(cell=>({cell,difference:Math.abs(cell.atoms.length-desiredAtoms)})).sort((a,b)=>a.difference-b.difference).slice(0,3).map(x=>x.cell));
 const choosePattern=()=>rng.pick(target.length&&rng.next()<request.patterns.targetDensity?target:patterns);

 return phrase.flatMap((section,measure)=>{
  const noteRecognition=request.intent==="noteRecognition";
  const isRelated=section.label==="A'"||section.label==="A''";
  let motif:MotifPlan;
  if(isRelated&&baseMotif){
   const transformation:PatternTransformation=rng.next()<request.patterns.sequenceProbability?(rng.next()<.5?"sequenceUp":"sequenceDown"):section.transformation;
   motif={...baseMotif,relative:transformPattern(baseMotif.relative,transformation),start:transformation==="newStart"?rng.integer(0,3):baseMotif.start,cell:rng.next()<request.patterns.variation?chooseCell():baseMotif.cell};
  }else if(priorMotif&&rng.next()<request.patterns.repetition&&section.label!=="B"&&section.label!=="cadence"){
   motif={...priorMotif,relative:[...priorMotif.relative]};
  }else{
   const pattern=choosePattern();const raw=noteRecognition?Array.from({length:4},()=>rng.integer(-4,8)):[...pattern.relativeDegrees];
   motif={pattern,relative:raw,start:rng.integer(0,3),cell:chooseCell()};
  }
  if(measure===0)baseMotif=motif;priorMotif=motif;
  let onset=measure*measureTicks;const activeHarmony=harmony[measure]!;const chordTones=chordDegrees(activeHarmony);
  return motif.cell.atoms.map((atom,index)=>{
   const finalCadence=section.label==="cadence"&&index===motif.cell.atoms.length-1;
   const strength=metricStrength(onset%measureTicks,meter);let abstract=motif.start+(motif.relative[index%motif.relative.length]??0);
   // Stable beats articulate the current harmony; the final cadence resolves to tonic.
   if(!noteRecognition&&(strength==="strong"||strength==="medium"))abstract=nearest(abstract,chordTones);
   if(!noteRecognition&&finalCadence)abstract=activeHarmony.rootDegree.degree-1;
   const tieFromPrevious=tieIntoNext;let degree=normalizeDegree(abstract);
   // The dominant in minor uses the harmonic-minor leading tone. It belongs to
   // the active harmony and is not counted as an injected chromatic challenge.
   if(context.mode==="minor"&&activeHarmony.rootDegree.degree===5&&degree.degree===7)degree.alteration=1;
   const challenge=rng.next()<request.challenge.density?rng.pick(request.challenge.allowedTypes):undefined;
   let chromatic=accidentalsRemaining>0&&!finalCadence&&(challenge==="chromatic"||rng.next()<request.tonal.chromaticism);if(chromatic)degree.alteration=rng.next()<.5?-1:1;
   let pitch=realizeScaleDegree(context,degree,4);while(pitch.midi<request.rightHand.range.low){degree.octaveOffset++;pitch=realizeScaleDegree(context,degree,4);}while(pitch.midi>request.rightHand.range.high){degree.octaveOffset--;pitch=realizeScaleDegree(context,degree,4);}
   const rest=!tieFromPrevious&&!finalCadence&&(atom.rest||(index>0&&rng.next()<request.rhythm.restDensity));let targetedJump=false;
   if(!tieFromPrevious&&!rest){
    const harmonic=harmonicDegrees(context,activeHarmony);
    const degrees=!noteRecognition&&finalCadence?[harmonic[0]!] : !noteRecognition&&!chromatic&&(strength==="strong"||strength==="medium")?harmonic:Array.from({length:7},(_,i)=>({...normalizeDegree(i),alteration:chromatic?degree.alteration:0 as ScaleDegree["alteration"]}));
    const candidates=degrees.flatMap(candidate=>Array.from({length:7},(_,i)=>({...candidate,octaveOffset:i-3}))).map(candidate=>({degree:candidate,pitch:realizeScaleDegree(context,candidate,4)})).filter(candidate=>candidate.pitch.midi>=request.rightHand.range.low&&candidate.pitch.midi<=request.rightHand.range.high);
    const reachable=candidates.filter(candidate=>previousMidi===undefined||Math.abs(candidate.pitch.midi-previousMidi)<=request.rightHand.maxJump);
    const jumpDue=previousMidi!==undefined&&request.rightHand.jumpFrequency!=="none"&&(request.rightHand.jumpFrequency==="occasional"?!occasionalJumpPlaced&&attackedNotes>=2:attackedNotes>=2&&(attackedNotes+1)%3===0);
    const [jumpLow,jumpHigh]=jumpBand(request.rightHand.jumpSize,request.rightHand.maxJump);
    const jumpCandidates=jumpDue&&jumpLow<=jumpHigh?reachable.filter(candidate=>{const distance=Math.abs(candidate.pitch.midi-previousMidi!);return distance>=jumpLow&&distance<=jumpHigh;}):[];
    const selected=(jumpCandidates.length?jumpCandidates:reachable.length?reachable:candidates).sort((a,b)=>Math.abs(a.pitch.midi-pitch.midi)-Math.abs(b.pitch.midi-pitch.midi))[0];
    targetedJump=jumpCandidates.length>0;if(targetedJump)occasionalJumpPlaced=true;
    if(selected){pitch=selected.pitch;degree=selected.degree;}
   }
   if(tieFromPrevious&&tiedPitch&&tiedDegree){pitch=tiedPitch;degree={...tiedDegree};chromatic=tiedChromatic;}
   const nextAtom=motif.cell.atoms[index+1];
   const tieToNext=!rest&&!finalCadence&&Boolean(nextAtom&&!nextAtom.rest)&&(atom.tie||rng.next()<request.rhythm.tieDensity);
   const challengeTags=[...(challenge&&(challenge!=="chromatic"||chromatic)?[challenge]:[]),...(targetedJump&&challenge!=="largeLeap"?["largeLeap" as const]:[])];
   const event:ExerciseEvent={id:`rh-${measure}-${index}`,onset,duration:atom.duration,pitches:rest?[]:[pitch],hand:"right",metadata:{scaleDegree:degree,harmonyId:activeHarmony.id,motifId:isRelated?"motif-A":`motif-${measure}`,patternId:motif.pattern.id,patternFamily:motif.pattern.family as PatternFamily,rhythmCellId:motif.cell.id,intervalFromPrevious:tieFromPrevious?0:previousMidi===undefined?undefined:pitch.midi-previousMidi,metricStrength:strength,challengeTags,chromatic,tieFromPrevious,tieToNext}};
   tieIntoNext=tieToNext;if(tieToNext){tiedPitch=pitch;tiedDegree={...degree};tiedChromatic=chromatic;}if(!rest&&!tieFromPrevious){previousMidi=pitch.midi;attackedNotes++;if(chromatic)accidentalsRemaining--;}onset+=atom.duration;return event;
  });
 });
};
