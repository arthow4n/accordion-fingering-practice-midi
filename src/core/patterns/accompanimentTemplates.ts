import type { AccompanimentStyle, ChordQuality, Meter } from "../model";

export type BassRelation="root"|"second"|"fifth"|"tritone"|"leadingTone"|"sixth"|"counterThird";
export type AccompanimentAction={kind:"bass"|"chord"|"bassChord";bassRelation?:BassRelation;buttonRow?:"fundamental"|"counterbass"};
export type AccompanimentAtom={offset:number;duration:number;action:AccompanimentAction};
export type AccompanimentTemplate={
 id:string;style:AccompanimentStyle;meters:readonly string[];atoms:readonly AccompanimentAtom[];
 legacySource:string;tags:readonly string[];
};
export type LegacyHarmonyStep={degree:1|2|3|4|5|6|7;quality?:ChordQuality;symbol?:string};
export type LegacyBassLineTemplate={id:string;meter:string;measures:readonly (readonly AccompanimentAtom[])[];harmony:readonly LegacyHarmonyStep[];legacySource:string;fixedKey?:string};
const atom=(offset:number,duration:number,kind:AccompanimentAction["kind"],bassRelation:BassRelation="root",buttonRow:AccompanimentAction["buttonRow"]="fundamental"):AccompanimentAtom=>({offset,duration,action:{kind,bassRelation,buttonRow}});

// Offsets and durations are fractions of a measure. These are the reusable
// rhythmic/physical ideas extracted from the old absolute-note pattern strings.
export const LEGACY_ACCOMPANIMENT_TEMPLATES:readonly AccompanimentTemplate[]=[
 {id:"legacy-bass-chord-4",style:"bassChord",meters:["4/4"],atoms:[atom(0,.5,"bass"),atom(.5,.5,"chord")],legacySource:"basic bass + chord",tags:["legacy","simple"]},
 {id:"legacy-polka-4",style:"polka",meters:["4/4"],atoms:[atom(0,.25,"bass"),atom(.25,.25,"chord"),atom(.5,.25,"bass","fifth"),atom(.75,.25,"chord")],legacySource:"16(root) 16(chord) 16(V root) 16(chord)",tags:["legacy","polka","alternating-bass"]},
 {id:"legacy-polka-swamp-4",style:"alternatingBass",meters:["4/4"],atoms:[atom(0,.25,"bass"),atom(.25,.125,"chord"),atom(.375,.125,"chord"),atom(.5,.25,"bass","fifth"),atom(.75,.25,"chord")],legacySource:"16(root) 8(chord) 8(chord) 16(V root) 16(chord)",tags:["legacy","polka","split-chord"]},
 {id:"legacy-waltz-3",style:"waltz",meters:["3/4"],atoms:[atom(0,1/3,"bass"),atom(1/3,1/3,"chord"),atom(2/3,1/3,"chord")],legacySource:"16(root) 16(chord) 16(chord)",tags:["legacy","waltz"]},
 {id:"legacy-polka-3",style:"polka",meters:["3/4"],atoms:[atom(0,1/3,"bass"),atom(1/3,1/3,"chord"),atom(2/3,1/3,"chord")],legacySource:"two-bar 16(root) 16(chord) 16(chord) 16(V root) 16(chord) 16(chord)",tags:["legacy","polka","two-measure-cycle"]},
 {id:"legacy-tango-4",style:"tango",meters:["4/4"],atoms:[atom(0,.25,"bassChord"),atom(.25,.25,"bassChord"),atom(.5,.25,"bassChord"),atom(.75,.125,"bassChord"),atom(.875,.125,"bass","fifth")],legacySource:"16(root+chord) 16(root+chord) 16(root+chord) 8(root+chord) 8(V root)",tags:["legacy","tango"]},
 {id:"legacy-swing-4",style:"swing",meters:["4/4"],atoms:[atom(0,.25,"bassChord"),atom(.25,.25,"bassChord"),atom(.5,.25,"bassChord","fifth"),atom(.75,.25,"bassChord","fifth")],legacySource:"16(root+chord) 16(root+chord) 16(V root+chord) 16(V root+chord)",tags:["legacy","swing"]},
 {id:"legacy-compound-bass-chord",style:"bassChord",meters:["6/8"],atoms:[atom(0,.5,"bass"),atom(.5,.5,"chord")],legacySource:"compound-meter adaptation",tags:["legacy-derived","compound"]},
];

// Multi-measure exercises retained from the old hand-curated catalog. They are
// explicit phrase templates rather than ordinary one-measure accompaniment.
const oomPah=(relation:BassRelation,row:AccompanimentAction["buttonRow"]="fundamental"):readonly AccompanimentAtom[]=>[atom(0,1/3,"bass",relation,row),atom(1/3,1/3,"chord"),atom(2/3,1/3,"chord")];
export const LEGACY_BASS_LINE_TEMPLATES:readonly LegacyBassLineTemplate[]=[
 {id:"legacy-tonic-pedal-descending",meter:"3/4",measures:[oomPah("root"),oomPah("leadingTone","counterbass"),oomPah("sixth","counterbass"),oomPah("fifth")],harmony:[{degree:1},{degree:1},{degree:1},{degree:1}],legacySource:"C/C C/B C/A C/G"},
 {id:"legacy-transition-to-IV",meter:"3/4",measures:[oomPah("root"),oomPah("fifth"),[atom(0,1/3,"bass","root"),atom(1/3,1/3,"bass","second","counterbass"),atom(2/3,1/3,"bass","counterThird","counterbass")],oomPah("root")],harmony:[{degree:1},{degree:1},{degree:1},{degree:4}],legacySource:"I pattern, counterbass walk, IV"},
 {id:"legacy-bb-fdim-line",meter:"3/4",fixedKey:"Bb major",measures:[oomPah("root"),oomPah("tritone","counterbass"),oomPah("second"),oomPah("second"),oomPah("fifth"),oomPah("root")],harmony:[{degree:1,quality:"major",symbol:"I"},{degree:5,quality:"diminished",symbol:"v°"},{degree:5,quality:"diminished",symbol:"v°"},{degree:5,quality:"diminished",symbol:"v°"},{degree:5,quality:"major",symbol:"V"},{degree:3,quality:"dominant7",symbol:"III7"}],legacySource:"Bb | Fdim/B | Fdim/G | Fdim/G | F/C | D7"},
];

export const meterKey=(meter:Meter)=>`${meter.beats}/${meter.beatUnit}`;
export const accompanimentTemplateFor=(style:AccompanimentStyle,meter:Meter)=>{
 const exact=LEGACY_ACCOMPANIMENT_TEMPLATES.find(template=>template.style===style&&template.meters.includes(meterKey(meter)));
 if(exact)return exact;
 if(meter.beats===3)return LEGACY_ACCOMPANIMENT_TEMPLATES.find(template=>template.id===(style==="polka"||style==="alternatingBass"?"legacy-polka-3":"legacy-waltz-3"))!;
 if(meter.beatUnit===8)return LEGACY_ACCOMPANIMENT_TEMPLATES.find(template=>template.id==="legacy-compound-bass-chord")!;
 return LEGACY_ACCOMPANIMENT_TEMPLATES.find(template=>template.id==="legacy-polka-4")!;
};
export const legacyBassLineById=(id:string|undefined)=>LEGACY_BASS_LINE_TEMPLATES.find(template=>template.id===id);
