import { compact } from "lodash-es";
import { createBassPattern as bass, createRightHandPattern as right } from "./pattern.helper";
import { BassPattern, RightHandPattern, BassPatternType as T } from "./type";

// Bass keys available on Roland FR-1XB = 72 bass buttons
const stradellaBassRows = [
  [{ name: "F", notesString: "F3" }, { name: "Db", notesString: "C#3" }, { name: "Db", notesString: "C#3,F3,G#3" }, { name: "Dbm", notesString: "C#3,E3,G#3" }, { name: "Db7", notesString: "C#3,F3,B3,G#3" }, { name: "Dbdim", notesString: "C#3,E3,A#3,G3" }], 
  [{ name: "C", notesString: "C3" }, { name: "Ab", notesString: "G#3" }, { name: "Ab", notesString: "G#2,C3,D#3" }, { name: "Abm", notesString: "G#2,B3,D#3" }, { name: "Ab7", notesString: "G#2,C3,F#3,D#3" }, { name: "Abdim", notesString: "G#2,B3,F3,D3" }], 
  [{ name: "G", notesString: "G3" }, { name: "Eb", notesString: "D#3" }, { name: "Eb", notesString: "D#3,G3,A#3" }, { name: "Ebm", notesString: "D#3,F#3,A#3" }, { name: "Eb7", notesString: "D#2,G3,C#3,A#3" }, { name: "Ebdim", notesString: "D#2,F#3,C3,A3" }], 
  [{ name: "D", notesString: "D3" }, { name: "Bb", notesString: "A#3" }, { name: "Bb", notesString: "A#2,D3,F3" }, { name: "Bbm", notesString: "A#2,C#3,F3" }, { name: "Bb7", notesString: "A#2,D3,G#3,F3" }, { name: "Bbdim", notesString: "A#2,C#3,G3,E3" }], 
  [{ name: "A", notesString: "A3" }, { name: "F", notesString: "F3" }, { name: "F", notesString: "F2,A3,C3" }, { name: "Fm", notesString: "F2,G#3,C3" }, { name: "F7", notesString: "F2,A3,D#3,C3" }, { name: "Fdim", notesString: "F2,G#3,D3,B3" }], 
  [{ name: "E", notesString: "E3" }, { name: "C", notesString: "C3" }, { name: "C", notesString: "C3,E3,G3" }, { name: "Cm", notesString: "C3,D#3,G3" }, { name: "C7", notesString: "C3,E3,A#3,G3" }, { name: "Cdim", notesString: "C3,D#3,A3,F#3" }], 
  [{ name: "B", notesString: "B3" }, { name: "G", notesString: "G3" }, { name: "G", notesString: "G2,B3,D3" }, { name: "Gm", notesString: "G2,A#3,D3" }, { name: "G7", notesString: "G2,B3,F3,D3" }, { name: "Gdim", notesString: "G2,A#3,E3,C#3" }], 
  [{ name: "F#", notesString: "F#3" }, { name: "D", notesString: "D3" }, { name: "D", notesString: "D3,F#3,A3" }, { name: "Dm", notesString: "D3,F3,A3" }, { name: "D7", notesString: "D2,F#3,C3,A3" }, { name: "Ddim", notesString: "D3,F3,B3,G#3" }], 
  [{ name: "C#", notesString: "C#3" }, { name: "A", notesString: "A3" }, { name: "A", notesString: "A2,C#3,E3" }, { name: "Am", notesString: "A2,C3,E3" }, { name: "A7", notesString: "A2,C#3,G3,E3" }, { name: "Adim", notesString: "A2,C3,F#3,D#3" }], 
  [{ name: "G#", notesString: "G#3" }, { name: "E", notesString: "E3" }, { name: "E", notesString: "E3,G#3,B3" }, { name: "Em", notesString: "E3,G3,B3" }, { name: "E7", notesString: "E2,G#3,D3,B3" }, { name: "Edim", notesString: "E2,G3,C#3,A#3" }], 
  [{ name: "D#", notesString: "D#3" }, { name: "B", notesString: "B3" }, { name: "B", notesString: "B2,D#3,F#3" }, { name: "Bm", notesString: "B2,D3,F#3" }, { name: "B7", notesString: "B2,D#3,F#3,A3" }, { name: "Bdim", notesString: "B2,D3,G#3,F3" }], 
  [{ name: "A#", notesString: "A#3" }, { name: "F#", notesString: "F#3"}, { name: "F#", notesString: "F#2,A#3,C#3" }, { name: "F#m", notesString: "F#2,A3,C#3" }, { name: "F#7", notesString: "F#2,A#3,E3,C#3" }, { name: "F#dim", notesString: "F#2,A3,D#3,C3" }]
] as const;

export const rightHandPatterns: RightHandPattern[] = [
  right(3, 4, "16 16 16"),
  right(3, 4, "16 24 8"),
  right(3, 4, "16 8z 8 16"),
  right(3, 4, "16 8z 8 8 8"),
  right(4, 4, "16 16 16 16"),
];

export const bassPatterns: BassPattern[] = stradellaBassRows.flatMap((_, index, array) => {
  // Variables named to fit roman numeric chord progression

  const bVII = index - 2 >= 0 && array.at(index - 2) && {
    counter: array[index - 2][0],
    root: array[index - 2][1],
    maj: array[index - 2][2],
    min: array[index - 2][3],
    seventh: array[index - 2][4],
    dim: array[index - 2][5],
  };
  
  const IV = index - 1 >= 0 && array.at(index - 1) && {
    counter: array[index - 1][0],
    root: array[index - 1][1],
    maj: array[index - 1][2],
    min: array[index - 1][3],
    seventh: array[index - 1][4],
    dim: array[index - 1][5],
  };

  const I = {
    counter: array[index][0],
    root: array[index][1],
    maj: array[index][2],
    min: array[index][3],
    seventh: array[index][4],
    dim: array[index][5],
  };

  const V = array.at(index + 1) && {
    counter: array[index + 1][0],
    root: array[index + 1][1],
    maj: array[index + 1][2],
    min: array[index + 1][3],
    seventh: array[index + 1][4],
    dim: array[index + 1][5],
  };

  return compact([
    V && bass(I.root.name, 3, 4, T.PolkaAlt, `16(<${I.root.name}>${I.root.notesString}) 16(${I.maj.notesString}) 16(${I.maj.notesString}) 16(${V.root.notesString}) 16(${I.maj.notesString}) 16(${I.maj.notesString})`),
    V && bass(I.min.name, 3, 4, T.PolkaAlt, `16(<${I.min.name}>${I.root.notesString}) 16(${I.min.notesString}) 16(${I.min.notesString}) 16(${V.root.notesString}) 16(${I.min.notesString}) 16(${I.min.notesString})`),
    V && bass(I.seventh.name, 3, 4, T.PolkaAlt, `16(<${I.seventh.name}>${I.root.notesString}) 16(${I.seventh.notesString}) 16(${I.seventh.notesString}) 16(${V.root.notesString}) 16(${I.seventh.notesString}) 16(${I.seventh.notesString})`),
    V && bass(I.dim.name, 3, 4, T.PolkaAlt, `16(<${I.dim.name}>${I.root.notesString}) 16(${I.dim.notesString}) 16(${I.dim.notesString}) 16(${V.root.notesString}) 16(${I.dim.notesString}) 16(${I.dim.notesString})`),

    // Transitions I maj min seventh dim -> IV maj min seventh dim
    // TODO: Refine syntax before adding other kinds of transitions
    V && IV && bVII && bass(I.root.name, 3, 4, T.PolkaAlt, `16(<${I.root.name}>${I.root.notesString}) 16(${I.maj.notesString}) 16(${I.maj.notesString}) 16(${V.root.notesString}) 16(${I.maj.notesString}) 16(${I.maj.notesString}) 16(</${I.root.name}>${I.root.notesString}) 16(</${bVII.counter.name}>${bVII.counter.notesString}) 16(</${I.counter.name}>${I.counter.notesString}) 16(<${IV.root.name}>${IV.root.notesString}) 16(${IV.maj.notesString}) 16(${IV.maj.notesString})`),
    V && IV && bVII && bass(I.root.name, 3, 4, T.PolkaAlt, `16(<${I.root.name}>${I.root.notesString}) 16(${I.maj.notesString}) 16(${I.maj.notesString}) 16(${V.root.notesString}) 16(${I.maj.notesString}) 16(${I.maj.notesString}) 16(</${I.root.name}>${I.root.notesString}) 16(</${bVII.counter.name}>${bVII.counter.notesString}) 16(</${I.counter.name}>${I.counter.notesString}) 16(<${IV.min.name}>${IV.root.notesString}) 16(${IV.min.notesString}) 16(${IV.min.notesString})`),
    V && IV && bVII && bass(I.root.name, 3, 4, T.PolkaAlt, `16(<${I.root.name}>${I.root.notesString}) 16(${I.maj.notesString}) 16(${I.maj.notesString}) 16(${V.root.notesString}) 16(${I.maj.notesString}) 16(${I.maj.notesString}) 16(</${I.root.name}>${I.root.notesString}) 16(</${bVII.counter.name}>${bVII.counter.notesString}) 16(</${I.counter.name}>${I.counter.notesString}) 16(<${IV.seventh.name}>${IV.root.notesString}) 16(${IV.seventh.notesString}) 16(${IV.seventh.notesString})`),
    V && IV && bVII && bass(I.root.name, 3, 4, T.PolkaAlt, `16(<${I.root.name}>${I.root.notesString}) 16(${I.maj.notesString}) 16(${I.maj.notesString}) 16(${V.root.notesString}) 16(${I.maj.notesString}) 16(${I.maj.notesString}) 16(</${I.root.name}>${I.root.notesString}) 16(</${bVII.counter.name}>${bVII.counter.notesString}) 16(</${I.counter.name}>${I.counter.notesString}) 16(<${IV.dim.name}>${IV.root.notesString}) 16(${IV.dim.notesString}) 16(${IV.dim.notesString})`),
    V && IV && bVII && bass(I.min.name, 3, 4, T.PolkaAlt, `16(<${I.min.name}>${I.root.notesString}) 16(${I.min.notesString}) 16(${I.min.notesString}) 16(${V.root.notesString}) 16(${I.min.notesString}) 16(${I.min.notesString}) 16(</${I.root.name}>${I.root.notesString}) 16(</${bVII.counter.name}>${bVII.counter.notesString}) 16(</${I.counter.name}>${I.counter.notesString}) 16(<${IV.root.name}>${IV.root.notesString}) 16(${IV.maj.notesString}) 16(${IV.maj.notesString})`),
    V && IV && bVII && bass(I.min.name, 3, 4, T.PolkaAlt, `16(<${I.min.name}>${I.root.notesString}) 16(${I.min.notesString}) 16(${I.min.notesString}) 16(${V.root.notesString}) 16(${I.min.notesString}) 16(${I.min.notesString}) 16(</${I.root.name}>${I.root.notesString}) 16(</${bVII.counter.name}>${bVII.counter.notesString}) 16(</${I.counter.name}>${I.counter.notesString}) 16(<${IV.min.name}>${IV.root.notesString}) 16(${IV.min.notesString}) 16(${IV.min.notesString})`),
    V && IV && bVII && bass(I.min.name, 3, 4, T.PolkaAlt, `16(<${I.min.name}>${I.root.notesString}) 16(${I.min.notesString}) 16(${I.min.notesString}) 16(${V.root.notesString}) 16(${I.min.notesString}) 16(${I.min.notesString}) 16(</${I.root.name}>${I.root.notesString}) 16(</${bVII.counter.name}>${bVII.counter.notesString}) 16(</${I.counter.name}>${I.counter.notesString}) 16(<${IV.seventh.name}>${IV.root.notesString}) 16(${IV.seventh.notesString}) 16(${IV.seventh.notesString})`),
    V && IV && bVII && bass(I.min.name, 3, 4, T.PolkaAlt, `16(<${I.min.name}>${I.root.notesString}) 16(${I.min.notesString}) 16(${I.min.notesString}) 16(${V.root.notesString}) 16(${I.min.notesString}) 16(${I.min.notesString}) 16(</${I.root.name}>${I.root.notesString}) 16(</${bVII.counter.name}>${bVII.counter.notesString}) 16(</${I.counter.name}>${I.counter.notesString}) 16(<${IV.dim.name}>${IV.root.notesString}) 16(${IV.dim.notesString}) 16(${IV.dim.notesString})`),
    V && IV && bVII && bass(I.seventh.name, 3, 4, T.PolkaAlt, `16(<${I.seventh.name}>${I.root.notesString}) 16(${I.seventh.notesString}) 16(${I.seventh.notesString}) 16(${V.root.notesString}) 16(${I.seventh.notesString}) 16(${I.seventh.notesString}) 16(</${I.root.name}>${I.root.notesString}) 16(</${bVII.counter.name}>${bVII.counter.notesString}) 16(</${I.counter.name}>${I.counter.notesString}) 16(<${IV.root.name}>${IV.root.notesString}) 16(${IV.maj.notesString}) 16(${IV.maj.notesString})`),
    V && IV && bVII && bass(I.seventh.name, 3, 4, T.PolkaAlt, `16(<${I.seventh.name}>${I.root.notesString}) 16(${I.seventh.notesString}) 16(${I.seventh.notesString}) 16(${V.root.notesString}) 16(${I.seventh.notesString}) 16(${I.seventh.notesString}) 16(</${I.root.name}>${I.root.notesString}) 16(</${bVII.counter.name}>${bVII.counter.notesString}) 16(</${I.counter.name}>${I.counter.notesString}) 16(<${IV.min.name}>${IV.root.notesString}) 16(${IV.min.notesString}) 16(${IV.min.notesString})`),
    V && IV && bVII && bass(I.seventh.name, 3, 4, T.PolkaAlt, `16(<${I.seventh.name}>${I.root.notesString}) 16(${I.seventh.notesString}) 16(${I.seventh.notesString}) 16(${V.root.notesString}) 16(${I.seventh.notesString}) 16(${I.seventh.notesString}) 16(</${I.root.name}>${I.root.notesString}) 16(</${bVII.counter.name}>${bVII.counter.notesString}) 16(</${I.counter.name}>${I.counter.notesString}) 16(<${IV.seventh.name}>${IV.root.notesString}) 16(${IV.seventh.notesString}) 16(${IV.seventh.notesString})`),
    V && IV && bVII && bass(I.seventh.name, 3, 4, T.PolkaAlt, `16(<${I.seventh.name}>${I.root.notesString}) 16(${I.seventh.notesString}) 16(${I.seventh.notesString}) 16(${V.root.notesString}) 16(${I.seventh.notesString}) 16(${I.seventh.notesString}) 16(</${I.root.name}>${I.root.notesString}) 16(</${bVII.counter.name}>${bVII.counter.notesString}) 16(</${I.counter.name}>${I.counter.notesString}) 16(<${IV.dim.name}>${IV.root.notesString}) 16(${IV.dim.notesString}) 16(${IV.dim.notesString})`),
    V && IV && bVII && bass(I.dim.name, 3, 4, T.PolkaAlt, `16(<${I.dim.name}>${I.root.notesString}) 16(${I.dim.notesString}) 16(${I.dim.notesString}) 16(${V.root.notesString}) 16(${I.dim.notesString}) 16(${I.dim.notesString}) 16(</${I.root.name}>${I.root.notesString}) 16(</${bVII.counter.name}>${bVII.counter.notesString}) 16(</${I.counter.name}>${I.counter.notesString}) 16(<${IV.root.name}>${IV.root.notesString}) 16(${IV.maj.notesString}) 16(${IV.maj.notesString})`),
    V && IV && bVII && bass(I.dim.name, 3, 4, T.PolkaAlt, `16(<${I.dim.name}>${I.root.notesString}) 16(${I.dim.notesString}) 16(${I.dim.notesString}) 16(${V.root.notesString}) 16(${I.dim.notesString}) 16(${I.dim.notesString}) 16(</${I.root.name}>${I.root.notesString}) 16(</${bVII.counter.name}>${bVII.counter.notesString}) 16(</${I.counter.name}>${I.counter.notesString}) 16(<${IV.min.name}>${IV.root.notesString}) 16(${IV.min.notesString}) 16(${IV.min.notesString})`),
    V && IV && bVII && bass(I.dim.name, 3, 4, T.PolkaAlt, `16(<${I.dim.name}>${I.root.notesString}) 16(${I.dim.notesString}) 16(${I.dim.notesString}) 16(${V.root.notesString}) 16(${I.dim.notesString}) 16(${I.dim.notesString}) 16(</${I.root.name}>${I.root.notesString}) 16(</${bVII.counter.name}>${bVII.counter.notesString}) 16(</${I.counter.name}>${I.counter.notesString}) 16(<${IV.seventh.name}>${IV.root.notesString}) 16(${IV.seventh.notesString}) 16(${IV.seventh.notesString})`),
    V && IV && bVII && bass(I.dim.name, 3, 4, T.PolkaAlt, `16(<${I.dim.name}>${I.root.notesString}) 16(${I.dim.notesString}) 16(${I.dim.notesString}) 16(${V.root.notesString}) 16(${I.dim.notesString}) 16(${I.dim.notesString}) 16(</${I.root.name}>${I.root.notesString}) 16(</${bVII.counter.name}>${bVII.counter.notesString}) 16(</${I.counter.name}>${I.counter.notesString}) 16(<${IV.dim.name}>${IV.root.notesString}) 16(${IV.dim.notesString}) 16(${IV.dim.notesString})`),

    // Patterns like
    // C/C C/B C/A C/G
    V && IV && bass(I.root.name, 3, 4, T.PolkaAlt, `16(<${I.root.name}/${I.root.name}>${I.root.notesString}) 16(${I.maj.notesString}) 16(${I.maj.notesString}) 16(<${I.root.name}/${V.counter.name}>${V.counter.notesString}) 16(${I.maj.notesString}) 16(${I.maj.notesString}) 16(<${I.root.name}/${IV.counter.name}>${IV.counter.notesString}) 16(${I.maj.notesString}) 16(${I.maj.notesString}) 16(<${I.root.name}/${V.root.name}>${V.root.notesString}) 16(${I.maj.notesString}) 16(${I.maj.notesString})`),
    V && IV && bass(I.root.name, 4, 4, T.PolkaAlt, `16(<${I.root.name}/${I.root.name}>${I.root.notesString}) 16(${I.maj.notesString}) 16(<${I.root.name}/${V.counter.name}>${V.counter.notesString}) 16(${I.maj.notesString}) 16(<${I.root.name}/${IV.counter.name}>${IV.counter.notesString}) 16(${I.maj.notesString}) 16(<${I.root.name}/${V.root.name}>${V.root.notesString}) 16(${I.maj.notesString})`),

    V && bass(I.root.name, 4, 4, T.PolkaAlt, `16(<${I.root.name}>${I.root.notesString}) 16(${I.maj.notesString}) 16(${V.root.notesString}) 16(${I.maj.notesString})`),
    V && bass(I.min.name, 4, 4, T.PolkaAlt, `16(<${I.min.name}>${I.root.notesString}) 16(${I.min.notesString}) 16(${V.root.notesString}) 16(${I.min.notesString})`),
    V && bass(I.seventh.name, 4, 4, T.PolkaAlt, `16(<${I.seventh.name}>${I.root.notesString}) 16(${I.seventh.notesString}) 16(${V.root.notesString}) 16(${I.seventh.notesString})`),
    V && bass(I.dim.name, 4, 4, T.PolkaAlt, `16(<${I.dim.name}>${I.root.notesString}) 16(${I.dim.notesString}) 16(${V.root.notesString}) 16(${I.dim.notesString})`),

    V && bass(I.root.name, 4, 4, T.PolkaSwampAlt, `16(<${I.root.name}>${I.root.notesString}) 8(${I.maj.notesString}) 8(${I.maj.notesString}) 16(${V.root.notesString}) 16(${I.maj.notesString})`),
    V && bass(I.min.name, 4, 4, T.PolkaSwampAlt, `16(<${I.min.name}>${I.root.notesString}) 8(${I.min.notesString}) 8(${I.min.notesString}) 16(${V.root.notesString}) 16(${I.min.notesString})`),
    V && bass(I.seventh.name, 4, 4, T.PolkaSwampAlt, `16(<${I.seventh.name}>${I.root.notesString}) 8(${I.seventh.notesString}) 8(${I.seventh.notesString}) 16(${V.root.notesString}) 16(${I.seventh.notesString})`),
    V && bass(I.dim.name, 4, 4, T.PolkaSwampAlt, `16(<${I.dim.name}>${I.root.notesString}) 8(${I.dim.notesString}) 8(${I.dim.notesString}) 16(${V.root.notesString}) 16(${I.dim.notesString})`),

    V && bass(I.root.name, 4, 4, T.TangoAlt, `16(<${I.root.name}>${I.root.notesString},${I.maj.notesString}) 16(${I.root.notesString},${I.maj.notesString}) 16(${I.root.notesString},${I.maj.notesString}) 8(${I.root.notesString},${I.maj.notesString}) 8(${V.root.notesString})`),
    V && bass(I.min.name, 4, 4, T.TangoAlt, `16(<${I.min.name}>${I.root.notesString},${I.min.notesString}) 16(${I.root.notesString},${I.min.notesString}) 16(${I.root.notesString},${I.min.notesString}) 8(${I.root.notesString},${I.min.notesString}) 8(${V.root.notesString})`),
    V && bass(I.seventh.name, 4, 4, T.TangoAlt, `16(<${I.seventh.name}>${I.root.notesString},${I.seventh.notesString}) 16(${I.root.notesString},${I.seventh.notesString}) 16(${I.root.notesString},${I.seventh.notesString}) 8(${I.root.notesString},${I.seventh.notesString}) 8(${V.root.notesString})`),
    V && bass(I.dim.name, 4, 4, T.TangoAlt, `16(<${I.dim.name}>${I.root.notesString},${I.dim.notesString}) 16(${I.root.notesString},${I.dim.notesString}) 16(${I.root.notesString},${I.dim.notesString}) 8(${I.root.notesString},${I.dim.notesString}) 8(${V.root.notesString})`),

    V && bass(I.root.name, 4, 4, T.SwingAlt, `16(<${I.root.name}>${I.root.notesString},${I.maj.notesString}) 16(${I.root.notesString},${I.maj.notesString}) 16(${V.root.notesString},${I.maj.notesString}) 16(${V.root.notesString},${I.maj.notesString})`),
    V && bass(I.min.name, 4, 4, T.SwingAlt, `16(<${I.min.name}>${I.root.notesString},${I.min.notesString}) 16(${I.root.notesString},${I.min.notesString}) 16(${V.root.notesString},${I.min.notesString}) 16(${V.root.notesString},${I.min.notesString})`),
    V && bass(I.seventh.name, 4, 4, T.SwingAlt, `16(<${I.seventh.name}>${I.root.notesString},${I.seventh.notesString}) 16(${I.root.notesString},${I.seventh.notesString}) 16(${V.root.notesString},${I.seventh.notesString}) 16(${V.root.notesString},${I.seventh.notesString})`),
    V && bass(I.dim.name, 4, 4, T.SwingAlt, `16(<${I.dim.name}>${I.root.notesString},${I.dim.notesString}) 16(${I.root.notesString},${I.dim.notesString}) 16(${V.root.notesString},${I.dim.notesString}) 16(${V.root.notesString},${I.dim.notesString})`),
  ]);
});
