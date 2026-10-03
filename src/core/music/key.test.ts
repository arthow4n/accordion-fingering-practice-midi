import { describe,expect,it } from "vitest";
import { realizeScaleDegree } from "./key";
import { realizeDiatonicStep } from "../patterns/melodicPatterns";
const degrees=[1,2,3,4,5] as const;
describe("tonal realization",()=>{
 it("realizes D major",()=>expect(degrees.map(degree=>realizeScaleDegree({tonic:"D",mode:"major"},{degree,alteration:0,octaveOffset:0}).name)).toEqual(["D4","E4","F#4","G4","A4"]));
 it("realizes Eb major",()=>expect(degrees.map(degree=>realizeScaleDegree({tonic:"Eb",mode:"major"},{degree,alteration:0,octaveOffset:0}).name)).toEqual(["Eb4","F4","G4","Ab4","Bb4"]));

 it("realizes all alterations -2 through +2 with correct semitone offsets", () => {
   const context = { tonic: "C", mode: "major" as const };
   expect(realizeScaleDegree(context, { degree: 1, alteration: 2, octaveOffset: 0 })).toEqual({ name: "C##4", midi: 62 });
   expect(realizeScaleDegree(context, { degree: 1, alteration: 1, octaveOffset: 0 })).toEqual({ name: "C#4", midi: 61 });
   expect(realizeScaleDegree(context, { degree: 1, alteration: 0, octaveOffset: 0 })).toEqual({ name: "C4", midi: 60 });
   expect(realizeScaleDegree(context, { degree: 1, alteration: -1, octaveOffset: 0 })).toEqual({ name: "Cb4", midi: 59 });
   expect(realizeScaleDegree(context, { degree: 1, alteration: -2, octaveOffset: 0 })).toEqual({ name: "Cbb4", midi: 58 });
 });

 it("preserves scale degree spelling in F major, D minor, and edge keys", () => {
   const fMajor = realizeDiatonicStep({ tonic: "F", mode: "major" }, 3); // degree 4
   expect(fMajor.pitch.name).toBe("Bb4");
   expect(fMajor.degree).toEqual({ degree: 4, alteration: 0, octaveOffset: 0 });

   const dMinor = realizeDiatonicStep({ tonic: "D", mode: "minor" }, 5); // degree 6
   expect(dMinor.pitch.name).toBe("Bb4");
   expect(dMinor.degree).toEqual({ degree: 6, alteration: 0, octaveOffset: 0 });

   const cSharp = realizeDiatonicStep({ tonic: "C#", mode: "major" }, 6); // degree 7
   expect(cSharp.pitch.name).toBe("B#4");
   expect(cSharp.pitch.midi).toBe(72);
   expect(cSharp.degree).toEqual({ degree: 7, alteration: 0, octaveOffset: 0 });
   expect(realizeScaleDegree({ tonic: "C#", mode: "major" }, cSharp.degree).midi).toBe(72);

   const cFlat = realizeDiatonicStep({ tonic: "Cb", mode: "major" }, 3); // degree 4
   expect(cFlat.pitch.name).toBe("Fb4");
   expect(cFlat.pitch.midi).toBe(64);
   expect(realizeScaleDegree({ tonic: "Cb", mode: "major" }, cFlat.degree).midi).toBe(64);
 });
});
