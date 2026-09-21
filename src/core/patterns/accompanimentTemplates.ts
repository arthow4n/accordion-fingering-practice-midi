import type { AccompanimentStyle, ChordQuality, Meter } from "../model";

export type BassRelation="root"|"second"|"fifth"|"tritone"|"leadingTone"|"sixth"|"counterThird";
export type AccompanimentAction={kind:"bass"|"chord"|"bassChord";bassRelation?:BassRelation;buttonRow?:"fundamental"|"counterbass"};
export type LeadSheetAnnotation="chord"|"chordWithBass";
export type AccompanimentAtom={offset:number;duration:number;action:AccompanimentAction;notation?:LeadSheetAnnotation};
export type AccompanimentTemplate={
 id:string;style:AccompanimentStyle;meters:readonly string[];atoms:readonly AccompanimentAtom[];
 legacySource:string;tags:readonly string[];
};
export type LegacyHarmonyStep={degree:1|2|3|4|5|6|7;quality?:ChordQuality;symbol?:string};
export type LegacyBassLineTemplate={id:string;meter:string;measures:readonly (readonly AccompanimentAtom[])[];harmony:readonly LegacyHarmonyStep[];legacySource:string;fixedKey?:string};
const atom=(offset:number,duration:number,kind:AccompanimentAction["kind"],bassRelation:BassRelation="root",buttonRow:AccompanimentAction["buttonRow"]="fundamental",notation?:LeadSheetAnnotation):AccompanimentAtom=>({offset,duration,action:{kind,bassRelation,buttonRow},notation});
const annotated=(atoms:readonly AccompanimentAtom[]):readonly AccompanimentAtom[]=>atoms.map((item,index)=>index===0?{...item,notation:"chord"}:item);

// Offsets and durations are fractions of a measure. These are the reusable
// rhythmic/physical ideas extracted from the old absolute-note pattern strings.
export const LEGACY_ACCOMPANIMENT_TEMPLATES:readonly AccompanimentTemplate[]=[
 {id:"legacy-bass-chord-4",style:"bassChord",meters:["4/4"],atoms:annotated([atom(0,.5,"bass"),atom(.5,.5,"chord")]),legacySource:"basic bass + chord",tags:["legacy","simple"]},
 {id:"bass-chord-3",style:"bassChord",meters:["3/4"],atoms:annotated([atom(0,1/3,"bass"),atom(1/3,2/3,"chord")]),legacySource:"3/4 basic bass + sustained chord",tags:["derived","simple"]},
 {id:"legacy-polka-4",style:"polka",meters:["4/4"],atoms:annotated([atom(0,.25,"bass"),atom(.25,.25,"chord"),atom(.5,.25,"bass","fifth"),atom(.75,.25,"chord")]),legacySource:"16(root) 16(chord) 16(V root) 16(chord)",tags:["legacy","polka","alternating-bass"]},
 {id:"legacy-polka-swamp-4",style:"alternatingBass",meters:["4/4"],atoms:annotated([atom(0,.25,"bass"),atom(.25,.125,"chord"),atom(.375,.125,"chord"),atom(.5,.25,"bass","fifth"),atom(.75,.25,"chord")]),legacySource:"16(root) 8(chord) 8(chord) 16(V root) 16(chord)",tags:["legacy","polka","split-chord"]},
 {id:"legacy-waltz-3",style:"waltz",meters:["3/4"],atoms:annotated([atom(0,1/3,"bass"),atom(1/3,1/3,"chord"),atom(2/3,1/3,"chord")]),legacySource:"16(root) 16(chord) 16(chord)",tags:["legacy","waltz"]},
 {id:"legacy-polka-3",style:"polka",meters:["3/4"],atoms:annotated([atom(0,1/3,"bass"),atom(1/3,1/3,"chord"),atom(2/3,1/3,"chord")]),legacySource:"two-bar 16(root) 16(chord) 16(chord) 16(V root) 16(chord) 16(chord)",tags:["legacy","polka","two-measure-cycle"]},
 {id:"legacy-tango-4",style:"tango",meters:["4/4"],atoms:annotated([atom(0,.25,"bassChord"),atom(.25,.25,"bassChord"),atom(.5,.25,"bassChord"),atom(.75,.125,"bassChord"),atom(.875,.125,"bass","fifth")]),legacySource:"16(root+chord) 16(root+chord) 16(root+chord) 8(root+chord) 8(V root)",tags:["legacy","tango"]},
 {id:"legacy-swing-4",style:"swing",meters:["4/4"],atoms:annotated([atom(0,.25,"bassChord"),atom(.25,.25,"bassChord"),atom(.5,.25,"bassChord","fifth"),atom(.75,.25,"bassChord","fifth")]),legacySource:"16(root+chord) 16(root+chord) 16(V root+chord) 16(V root+chord)",tags:["legacy","swing"]},
 {id:"legacy-compound-bass-chord",style:"bassChord",meters:["6/8"],atoms:annotated([atom(0,.5,"bass"),atom(.5,.5,"chord")]),legacySource:"compound-meter adaptation",tags:["legacy-derived","compound"]},
];

// Multi-measure exercises retained from the old hand-curated catalog. They are
// explicit phrase templates rather than ordinary one-measure accompaniment.
const oomPah=(relation:BassRelation,row:AccompanimentAction["buttonRow"]="fundamental"):readonly AccompanimentAtom[]=>[atom(0,1/3,"bass",relation,row),atom(1/3,1/3,"chord"),atom(2/3,1/3,"chord")];
const markedOomPah=(relation:BassRelation,notation:LeadSheetAnnotation="chord",row:AccompanimentAction["buttonRow"]="fundamental"):readonly AccompanimentAtom[]=>[atom(0,1/3,"bass",relation,row,notation),atom(1/3,1/3,"chord"),atom(2/3,1/3,"chord")];
export const LEGACY_BASS_LINE_TEMPLATES:readonly LegacyBassLineTemplate[]=[
 {id:"legacy-tonic-pedal-descending",meter:"3/4",measures:[markedOomPah("root","chordWithBass"),markedOomPah("leadingTone","chordWithBass","counterbass"),markedOomPah("sixth","chordWithBass","counterbass"),markedOomPah("fifth","chordWithBass")],harmony:[{degree:1},{degree:1},{degree:1},{degree:1}],legacySource:"C/C C/B C/A C/G"},
 {id:"legacy-transition-to-IV",meter:"3/4",measures:[markedOomPah("root"),oomPah("fifth"),[atom(0,1/3,"bass","root","fundamental","chordWithBass"),atom(1/3,1/3,"bass","second","counterbass","chordWithBass"),atom(2/3,1/3,"bass","counterThird","counterbass","chordWithBass")],markedOomPah("root")],harmony:[{degree:1},{degree:1},{degree:1},{degree:4}],legacySource:"I pattern, counterbass walk, IV"},
 {id:"legacy-bb-fdim-line",meter:"3/4",fixedKey:"Bb major",measures:[markedOomPah("root"),markedOomPah("tritone","chordWithBass","counterbass"),markedOomPah("second","chordWithBass"),markedOomPah("second","chordWithBass"),markedOomPah("fifth","chordWithBass"),markedOomPah("root")],harmony:[{degree:1,quality:"major",symbol:"I"},{degree:5,quality:"diminished",symbol:"v°"},{degree:5,quality:"diminished",symbol:"v°"},{degree:5,quality:"diminished",symbol:"v°"},{degree:5,quality:"major",symbol:"V"},{degree:3,quality:"dominant7",symbol:"III7"}],legacySource:"Bb | Fdim/B | Fdim/G | Fdim/G | F/C | D7"},
];

export const meterKey=(meter:Meter)=>`${meter.beats}/${meter.beatUnit}`;
export const accompanimentTemplateFor=(style:AccompanimentStyle,meter:Meter)=>{
 const exact=LEGACY_ACCOMPANIMENT_TEMPLATES.find(template=>template.style===style&&template.meters.includes(meterKey(meter)));
 if(exact)return exact;
 if(meter.beats===3)return LEGACY_ACCOMPANIMENT_TEMPLATES.find(template=>template.id===(style==="polka"||style==="alternatingBass"?"legacy-polka-3":"legacy-waltz-3"))!;
 if(meter.beatUnit===8)return LEGACY_ACCOMPANIMENT_TEMPLATES.find(template=>template.id==="legacy-compound-bass-chord")!;
 return LEGACY_ACCOMPANIMENT_TEMPLATES.find(template=>template.id==="legacy-polka-4")!;
};
export const accompanimentStylesForMeter=(meter:Meter):AccompanimentStyle[]=>[...new Set(LEGACY_ACCOMPANIMENT_TEMPLATES.filter(template=>template.meters.includes(meterKey(meter))).map(template=>template.style))];
export const legacyBassLineById=(id:string|undefined)=>LEGACY_BASS_LINE_TEMPLATES.find(template=>template.id===id);

/** Lead-sheet instruction for the exact generated pattern; the left hand is intentionally not rendered as a second staff. */
export const accompanimentInstruction=(style:AccompanimentStyle,meter:Meter,legacyId?:string):string=>{
 if(legacyId==="legacy-tonic-pedal-descending")return "In 3/4, play bass–chord–chord; follow the descending slash basses C, B, A, G.";
 if(legacyId==="legacy-transition-to-IV")return "In 3/4, play bass–chord–chord, with the three-bass counterbass walk shown before IV.";
 if(legacyId==="legacy-bb-fdim-line")return "In 3/4, play bass–chord–chord through the displayed Bb, diminished, F/C, and D7 changes.";
 switch(accompanimentTemplateFor(style,meter).id){
  case "legacy-bass-chord-4": return "Root bass at the start of the measure, then the chord halfway through.";
  case "bass-chord-3": return "Root bass on beat 1, then hold the chord through beats 2 and 3.";
  case "legacy-polka-4": return "Root bass, chord, fifth bass, chord—one attack on each beat.";
  case "legacy-polka-swamp-4": return "Root bass, two short chords, fifth bass, then chord.";
  case "legacy-waltz-3": return "Root bass on beat 1, then the chord on beats 2 and 3.";
  case "legacy-polka-3": return "Bass on beat 1 and chords on beats 2 and 3; alternate root and fifth bass each measure.";
  case "legacy-tango-4": return "Bass and chord together on beats 1, 2, and 3; short chord then fifth bass on beat 4.";
  case "legacy-swing-4": return "Bass and chord together on every beat; use the root for beats 1–2 and the fifth for beats 3–4.";
  case "legacy-compound-bass-chord": return "Root bass for the first half of the measure, then the chord for the second half.";
  default: return "Follow the displayed chord symbols with the selected bass pattern.";
 }
};
