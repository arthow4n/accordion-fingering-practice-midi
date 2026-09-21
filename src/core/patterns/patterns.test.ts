import { expect,it } from "vitest";
import { transformPattern } from "./melodicPatterns";
import { accompanimentInstruction, accompanimentStylesForMeter } from "./accompanimentTemplates";
it("sequences a relationship diatonically",()=>expect(transformPattern([0,2,4,2],"sequenceUp")).toEqual([1,3,5,3]));
it("explains configured lead-sheet bass patterns",()=>{
 expect(accompanimentInstruction("bassChord",{beats:4,beatUnit:4})).toContain("Root bass");
 expect(accompanimentInstruction("waltz",{beats:3,beatUnit:4})).toContain("beats 2 and 3");
 expect(accompanimentInstruction("polka",{beats:3,beatUnit:4})).toContain("alternate root and fifth");
 expect(accompanimentInstruction("tango",{beats:4,beatUnit:4},"legacy-transition-to-IV")).toContain("counterbass walk");
 expect(new Set(accompanimentStylesForMeter({beats:3,beatUnit:4}))).toEqual(new Set(["bassChord","polka","waltz"]));
 expect(accompanimentStylesForMeter({beats:4,beatUnit:4})).not.toContain("waltz");
});
