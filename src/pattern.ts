import { createBassPattern as bass, createRightHandPattern as right } from "./pattern.helper";
import { BassPattern, RightHandPattern, BassPatternType as T } from "./type";

// TODO: Add counter bass
const stradellaBassRows = [
  /* TODO: Add missing keys */
  [{ name: "Ab", notesString: "G#3" }, { name: "Ab", notesString: "G#2,C3,D#3" }, { name: "Abm", notesString: "G#2,B3,D#3" }, { name: "Ab7", notesString: "G#2,C3,F#3,D#3" }, { name: "Abdim", notesString: "G#2,B3,F3,D3" }], 
  [{ name: "Eb", notesString: "D#3" }, { name: "Eb", notesString: "D#3,G3,A#3" }, { name: "Ebm", notesString: "D#3,F#3,A#3" }, { name: "Eb7", notesString: "D#2,G3,C#3,A#3" }, { name: "Ebdim", notesString: "D#2,F#3,C3,A3" }], 
  [{ name: "Bb", notesString: "A#3" }, { name: "Bb", notesString: "A#2,D3,F3" }, { name: "Bbm", notesString: "A#2,C#3,F3" }, { name: "Bb7", notesString: "A#2,D3,G#3,F3" }, { name: "Bbdim", notesString: "A#2,C#3,G3,E3" }], 
  [{ name: "F", notesString: "F3" }, { name: "F", notesString: "F2,A3,C3" }, { name: "Fm", notesString: "F2,G#3,C3" }, { name: "F7", notesString: "F2,A3,D#3,C3" }, { name: "Fdim", notesString: "F2,G#3,D3,B3" }], 
  [{ name: "C", notesString: "C3" }, { name: "C", notesString: "C3,E3,G3" }, { name: "Cm", notesString: "C3,D#3,G3" }, { name: "C7", notesString: "C3,E3,A#3,G3" }, { name: "Cdim", notesString: "C3,D#3,A3,F#3" }], 
  [{ name: "G", notesString: "G3" }, { name: "G", notesString: "G2,B3,D3" }, { name: "Gm", notesString: "G2,A#3,D3" }, { name: "G7", notesString: "G2,B3,F3,D3" }, { name: "Gdim", notesString: "G2,A#3,E3,C#3" }], 
  [{ name: "D", notesString: "D3" }, { name: "D", notesString: "D3,F#3,A3" }, { name: "Dm", notesString: "D3,F3,A3" }, { name: "D7", notesString: "D2,F#3,C3,A3" }, { name: "Ddim", notesString: "D3,F3,B3,G#3" }], 
  [{ name: "A", notesString: "A3" }, { name: "A", notesString: "A2,C#3,E3" }, { name: "Am", notesString: "A2,C3,E3" }, { name: "A7", notesString: "A2,C#3,G3,E3" }, { name: "Adim", notesString: "A2,C3,F#3,D#3" }], 
  [{ name: "E", notesString: "E3" }, { name: "E", notesString: "E3,G#3,B3" }, { name: "Em", notesString: "E3,G3,B3" }, { name: "E7", notesString: "E2,G#3,D3,B3" }, { name: "Edim", notesString: "E2,G3,C#3,A#3" }], 
  [{ name: "B", notesString: "B3" }, { name: "B", notesString: "B2,D#3,F#3" }, { name: "Bm", notesString: "B2,D3,F#3" }, { name: "B7", notesString: "B2,D#3,F#3,A3" }, { name: "Bdim", notesString: "B2,D3,G#3,F3" }], 
  /* TODO: Add missing keys */
  [{ name: "F#", notesString: "F#3"}, { name: "F#", notesString: "F#3" }, { name: "F#m", notesString: "F#3" }, { name: "F#7", notesString: "F#3" }, { name: "F#dim", notesString: "F#3" }]
] as const;

export const rightHandPatterns: RightHandPattern[] = [
  right(3, 4, "16 16 16"),
  right(3, 4, "16 24 8"),
  right(3, 4, "16 8z 8 16"),
  right(3, 4, "16 8z 8 8 8"),
  right(4, 4, "16 16 16 16"),
];

export const bassPatterns: BassPattern[] = stradellaBassRows.flatMap(([root, maj, min, seventh, dim], index, array) => {
  if (index === array.length - 1)
  {
    return [];
  }

  const alt = {
    root: array[index + 1][0],
    maj: array[index + 1][1],
    min: array[index + 1][2],
    seventh: array[index + 1][3],
    dim: array[index + 1][4],
  };

  return [
    bass(root.name, 3, 4, T.PolkaAlt, `16(${root.notesString}) 16(${maj.notesString}) 16(${maj.notesString}) 16(${alt.root.notesString}) 16(${maj.notesString}) 16(${maj.notesString})`),
    bass(min.name, 3, 4, T.PolkaAlt, `16(${root.notesString}) 16(${min.notesString}) 16(${min.notesString}) 16(${alt.root.notesString}) 16(${min.notesString}) 16(${min.notesString})`),
    bass(seventh.name, 3, 4, T.PolkaAlt, `16(${root.notesString}) 16(${seventh.notesString}) 16(${seventh.notesString}) 16(${alt.root.notesString}) 16(${seventh.notesString}) 16(${seventh.notesString})`),
    bass(dim.name, 3, 4, T.PolkaAlt, `16(${root.notesString}) 16(${dim.notesString}) 16(${dim.notesString}) 16(${alt.root.notesString}) 16(${dim.notesString}) 16(${dim.notesString})`),

    bass(root.name, 4, 4, T.PolkaAlt, `16(${root.notesString}) 16(${maj.notesString})`),
    bass(min.name, 4, 4, T.PolkaAlt, `16(${root.notesString}) 16(${min.notesString})`),
    bass(seventh.name, 4, 4, T.PolkaAlt, `16(${root.notesString}) 16(${seventh.notesString})`),
    bass(dim.name, 4, 4, T.PolkaAlt, `16(${root.notesString}) 16(${dim.notesString})`),
    bass(root.name, 4, 4, T.PolkaAlt, `16(${root.notesString}) 16(${maj.notesString}) 16(${alt.root.notesString}) 16(${maj.notesString})`),
    bass(min.name, 4, 4, T.PolkaAlt, `16(${root.notesString}) 16(${min.notesString}) 16(${alt.root.notesString}) 16(${min.notesString})`),
    bass(seventh.name, 4, 4, T.PolkaAlt, `16(${root.notesString}) 16(${seventh.notesString}) 16(${alt.root.notesString}) 16(${seventh.notesString})`),
    bass(dim.name, 4, 4, T.PolkaAlt, `16(${root.notesString}) 16(${dim.notesString}) 16(${alt.root.notesString}) 16(${dim.notesString})`),

    bass(root.name, 4, 4, T.TangoAlt, `16(${root.notesString},${maj.notesString}) 16(${root.notesString},${maj.notesString}) 16(${root.notesString},${maj.notesString}) 8(${root.notesString},${maj.notesString}) 8(${alt.root.notesString})`),
    bass(min.name, 4, 4, T.TangoAlt, `16(${root.notesString},${min.notesString}) 16(${root.notesString},${min.notesString}) 16(${root.notesString},${min.notesString}) 8(${root.notesString},${min.notesString}) 8(${alt.root.notesString})`),
    bass(seventh.name, 4, 4, T.TangoAlt, `16(${root.notesString},${seventh.notesString}) 16(${root.notesString},${seventh.notesString}) 16(${root.notesString},${seventh.notesString}) 8(${root.notesString},${seventh.notesString}) 8(${alt.root.notesString})`),
    bass(dim.name, 4, 4, T.TangoAlt, `16(${root.notesString},${dim.notesString}) 16(${root.notesString},${dim.notesString}) 16(${root.notesString},${dim.notesString}) 8(${root.notesString},${dim.notesString}) 8(${alt.root.notesString})`),

    bass(root.name, 4, 4, T.SwingAlt, `16(${root.notesString},${maj.notesString}) 16(${root.notesString},${maj.notesString}) 16(${alt.root.notesString},${maj.notesString}) 16(${alt.root.notesString},${maj.notesString})`),
    bass(min.name, 4, 4, T.SwingAlt, `16(${root.notesString},${min.notesString}) 16(${root.notesString},${min.notesString}) 16(${alt.root.notesString},${min.notesString}) 16(${alt.root.notesString},${min.notesString})`),
    bass(seventh.name, 4, 4, T.SwingAlt, `16(${root.notesString},${seventh.notesString}) 16(${root.notesString},${seventh.notesString}) 16(${alt.root.notesString},${seventh.notesString}) 16(${alt.root.notesString},${seventh.notesString})`),
    bass(dim.name, 4, 4, T.SwingAlt, `16(${root.notesString},${dim.notesString}) 16(${root.notesString},${dim.notesString}) 16(${alt.root.notesString},${dim.notesString}) 16(${alt.root.notesString},${dim.notesString})`),
  ]
});
