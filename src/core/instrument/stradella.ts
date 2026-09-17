import { Note } from "tonal";

export type StradellaRow="counterbass"|"fundamental"|"major"|"minor"|"seventh"|"diminished";
export type StradellaButton={column:number;root:string;row:StradellaRow;label:string;pitchNames:readonly string[]};
export const STRADELLA_ROOTS=["Db","Ab","Eb","Bb","F","C","G","D","A","E","B","F#"] as const;
export const STRADELLA_ROWS:readonly StradellaRow[]=["counterbass","fundamental","major","minor","seventh","diminished"];

// Exact Roland FR-1XB MIDI voicings migrated from the original curated table.
const legacyRows:readonly (readonly [string,readonly string[]])[][]=[
 [["F",["F3"]],["Db",["C#3"]],["Db",["C#3","F3","G#3"]],["Dbm",["C#3","E3","G#3"]],["Db7",["C#3","F3","B3","G#3"]],["Dbdim",["C#3","E3","A#3","G3"]]],
 [["C",["C3"]],["Ab",["G#3"]],["Ab",["G#2","C3","D#3"]],["Abm",["G#2","B3","D#3"]],["Ab7",["G#2","C3","F#3","D#3"]],["Abdim",["G#2","B3","F3","D3"]]],
 [["G",["G3"]],["Eb",["D#3"]],["Eb",["D#3","G3","A#3"]],["Ebm",["D#3","F#3","A#3"]],["Eb7",["D#2","G3","C#3","A#3"]],["Ebdim",["D#2","F#3","C3","A3"]]],
 [["D",["D3"]],["Bb",["A#3"]],["Bb",["A#2","D3","F3"]],["Bbm",["A#2","C#3","F3"]],["Bb7",["A#2","D3","G#3","F3"]],["Bbdim",["A#2","C#3","G3","E3"]]],
 [["A",["A3"]],["F",["F3"]],["F",["F2","A3","C3"]],["Fm",["F2","G#3","C3"]],["F7",["F2","A3","D#3","C3"]],["Fdim",["F2","G#3","D3","B3"]]],
 [["E",["E3"]],["C",["C3"]],["C",["C3","E3","G3"]],["Cm",["C3","D#3","G3"]],["C7",["C3","E3","A#3","G3"]],["Cdim",["C3","D#3","A3","F#3"]]],
 [["B",["B3"]],["G",["G3"]],["G",["G2","B3","D3"]],["Gm",["G2","A#3","D3"]],["G7",["G2","B3","F3","D3"]],["Gdim",["G2","A#3","E3","C#3"]]],
 [["F#",["F#3"]],["D",["D3"]],["D",["D3","F#3","A3"]],["Dm",["D3","F3","A3"]],["D7",["D2","F#3","C3","A3"]],["Ddim",["D3","F3","B3","G#3"]]],
 [["C#",["C#3"]],["A",["A3"]],["A",["A2","C#3","E3"]],["Am",["A2","C3","E3"]],["A7",["A2","C#3","G3","E3"]],["Adim",["A2","C3","F#3","D#3"]]],
 [["G#",["G#3"]],["E",["E3"]],["E",["E3","G#3","B3"]],["Em",["E3","G3","B3"]],["E7",["E2","G#3","D3","B3"]],["Edim",["E2","G3","C#3","A#3"]]],
 [["D#",["D#3"]],["B",["B3"]],["B",["B2","D#3","F#3"]],["Bm",["B2","D3","F#3"]],["B7",["B2","D#3","F#3","A3"]],["Bdim",["B2","D3","G#3","F3"]]],
 [["A#",["A#3"]],["F#",["F#3"]],["F#",["F#2","A#3","C#3"]],["F#m",["F#2","A3","C#3"]],["F#7",["F#2","A#3","E3","C#3"]],["F#dim",["F#2","A3","D#3","C3"]]],
];

export const STRADELLA_BUTTONS:readonly StradellaButton[]=legacyRows.flatMap((buttons,column)=>buttons.map(([label,pitchNames],rowIndex)=>({column,root:STRADELLA_ROOTS[column]!,row:STRADELLA_ROWS[rowIndex]!,label,pitchNames})));
const normalized=(name:string)=>Note.chroma(name);
export const stradellaColumn=(pitchClass:string)=>STRADELLA_ROOTS.findIndex(root=>normalized(root)===normalized(pitchClass));
export const findStradellaButton=(root:string,row:StradellaRow)=>STRADELLA_BUTTONS.find(button=>button.row===row&&normalized(button.root)===normalized(root));
export const findStradellaBassButton=(pitchClass:string,preferredRow:Extract<StradellaRow,"counterbass"|"fundamental">="fundamental")=>STRADELLA_BUTTONS.find(button=>button.row===preferredRow&&normalized(button.label)===normalized(pitchClass));
export const stradellaMovementCost=(fromRoot:string,toRoot:string,fromRow:StradellaRow="fundamental",toRow:StradellaRow="fundamental")=>{const from=stradellaColumn(fromRoot),to=stradellaColumn(toRoot);if(from<0||to<0)return 1;return Math.min(1,(Math.abs(from-to)+Math.abs(STRADELLA_ROWS.indexOf(fromRow)-STRADELLA_ROWS.indexOf(toRow))*.35)/6);};
