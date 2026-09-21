import { Note } from "tonal";
import type { ExerciseEvent, HarmonyEvent, Meter, Pitch, TonalContext } from "../model";
import type { TrainingRequest } from "../training/trainingIntent";
import { qualityForDegree, realizeScaleDegree } from "../music/key";
import { pitchFromMidi, pitchFromName } from "../music/pitch";
import { ticksPerMeasure } from "../music/meter";
import { accompanimentTemplateFor, legacyBassLineById, meterKey, type BassRelation } from "../patterns/accompanimentTemplates";
import { findStradellaBassButton, findStradellaButton, stradellaMovementCost, type StradellaButton, type StradellaRow } from "../instrument/stradella";

const relationSemitones:Record<BassRelation,number>={root:0,second:2,fifth:7,tritone:6,leadingTone:-1,sixth:-3,counterThird:4};
const uniquePitches=(pitches:Pitch[])=>[...new Map(pitches.map(pitch=>[pitch.midi,pitch])).values()];
const bassPitch=(root:Pitch,relation:BassRelation,preferFlats:boolean)=>pitchFromMidi(root.midi+relationSemitones[relation],preferFlats);
const chordRow=(quality:HarmonyEvent["quality"]):StradellaRow=>quality==="major"?"major":quality==="minor"?"minor":quality==="dominant7"?"seventh":"diminished";
const buttonPitches=(button:StradellaButton|undefined,fallback:Pitch[])=>button?button.pitchNames.map(pitchFromName):fallback;

export const generateBass=(context:TonalContext,meter:Meter,harmony:HarmonyEvent[],request:TrainingRequest):ExerciseEvent[]=>{
 if(!request.leftHand.enabled)return[];const measure=ticksPerMeasure(meter);const template=accompanimentTemplateFor(request.leftHand.accompanimentStyle,meter);const bassLine=legacyBassLineById(request.leftHand.templateId);if(bassLine&&bassLine.meter!==meterKey(meter))throw new Error(`${bassLine.id} requires ${bassLine.meter}`);if(bassLine?.fixedKey&&bassLine.fixedKey!==`${context.tonic} ${context.mode}`)throw new Error(`${bassLine.id} requires ${bassLine.fixedKey}`);if(bassLine&&(harmony.length!==bassLine.harmony.length||harmony.some((event,index)=>{const required=bassLine.harmony[index]!;return event.rootDegree.degree!==required.degree||event.quality!==(required.quality??qualityForDegree(context.mode,required.degree));})))throw new Error(`${bassLine.id} requires its prescribed harmony plan`);let previousButton:StradellaButton|undefined;
 return harmony.flatMap((h,measureIndex)=>{
  const root=realizeScaleDegree(context,{...h.rootDegree,octaveOffset:-1},3);const rootClass=Note.pitchClass(root.name);const harmonyButton=findStradellaButton(rootClass,chordRow(h.quality));const chord=buttonPitches(harmonyButton,[]);
  const atoms=bassLine?.measures[measureIndex%bassLine.measures.length]??template.atoms;const realizedTemplateId=bassLine?.id??template.id;
  return atoms.map((templateAtom,index)=>{
   const action={...templateAtom.action};
   // The original 3/4 PolkaAlt is a two-measure root/fifth cycle.
   if(realizedTemplateId==="legacy-polka-3"&&measureIndex%2===1&&action.kind!=="chord")action.bassRelation="fifth";
   const relation=action.bassRelation??"root";const targetBass=bassPitch(root,relation,context.tonic.includes("b"));const row=(action.buttonRow??"fundamental") as Extract<StradellaRow,"counterbass"|"fundamental">;const bassButton=findStradellaBassButton(Note.pitchClass(targetBass.name),row);const bass=buttonPitches(bassButton,[targetBass]);const pitches=action.kind==="chord"?chord:action.kind==="bassChord"?uniquePitches([...bass,...chord]):bass;
   const activeButton=action.kind==="chord"?harmonyButton:bassButton;const distance=previousButton&&activeButton?stradellaMovementCost(previousButton.root,activeButton.root,previousButton.row,activeButton.row):0;if(activeButton)previousButton=activeButton;
   const onset=Math.round(measureIndex*measure+templateAtom.offset*measure),duration=Math.round(templateAtom.duration*measure);
   const label=action.kind==="bassChord"?`${bassButton?.label??Note.pitchClass(targetBass.name)} bass + ${harmonyButton?.label??h.symbol} chord`:activeButton?`${activeButton.label} ${activeButton.row}`:`${h.symbol} ${action.kind}`;
   // The pre-V3 3/4 PolkaAlt pattern spans two measures: its chord label is
   // authored on the root-bass measure, not repeated on the fifth-bass measure.
   const previousHarmony=harmony[measureIndex-1];
   const unchanged=previousHarmony&&previousHarmony.rootDegree.degree===h.rootDegree.degree&&previousHarmony.rootDegree.alteration===h.rootDegree.alteration&&previousHarmony.quality===h.quality;
   const showNotation=templateAtom.notation&&!(realizedTemplateId==="legacy-polka-3"&&measureIndex%2===1&&unchanged);
   const leadSheetAnnotation=showNotation?{chordRoot:rootClass,quality:h.quality,...(templateAtom.notation==="chordWithBass"?{bass:Note.pitchClass(targetBass.name)}:{})}:undefined;
   return{id:`lh-${measureIndex}-${index}`,onset,duration,pitches,hand:"left",metadata:{harmonyId:h.id,scaleDegree:h.rootDegree,rhythmCellId:realizedTemplateId,metricStrength:templateAtom.offset===0?"strong":templateAtom.offset*meter.beats%1===0?"medium":"weak",challengeTags:[],accompaniment:`${h.symbol} ${action.kind}`,bassDistance:distance,accompanimentTemplateId:realizedTemplateId,stradellaButton:label,leadSheetAnnotation,stradellaColumn:activeButton?.column,stradellaRow:activeButton?.row}} satisfies ExerciseEvent;
  });
 });
};
