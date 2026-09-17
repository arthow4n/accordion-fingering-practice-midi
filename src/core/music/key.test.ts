import { describe,expect,it } from "vitest";
import { realizeScaleDegree } from "./key";
const degrees=[1,2,3,4,5] as const;
describe("tonal realization",()=>{
 it("realizes D major",()=>expect(degrees.map(degree=>realizeScaleDegree({tonic:"D",mode:"major"},{degree,alteration:0,octaveOffset:0}).name)).toEqual(["D4","E4","F#4","G4","A4"]));
 it("realizes Eb major",()=>expect(degrees.map(degree=>realizeScaleDegree({tonic:"Eb",mode:"major"},{degree,alteration:0,octaveOffset:0}).name)).toEqual(["Eb4","F4","G4","Ab4","Bb4"]));
});
