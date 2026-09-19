import fc from "fast-check";
import { expect,it } from "vitest";
import { defaultTrainingRequest,parseTrainingRequest } from "../training/trainingIntent";
import { generateExercise } from "./generateExercise";
import { registerForSeed,registerRanges } from "./pitchRegister";

it("visits every register once per seeded cycle",()=>fc.assert(fc.property(fc.integer({min:-100000,max:100000}),cycle=>{
 expect(new Set([0,1,2].map(offset=>registerForSeed(cycle*3+offset))).size).toBe(3);
})));
it("generates reproducible melodies throughout the selected registers",()=>fc.assert(fc.property(fc.integer(),fc.constantFrom("low","middle","high") ,fc.constantFrom("C major","D major","Eb major","A minor"),(seed,register,key)=>{
 const request=defaultTrainingRequest();request.pitchRegister=register;request.tonal.keys=[key];
 const exercise=generateExercise(request,seed),range=registerRanges[register];
 const pitches=exercise.rightHand.flatMap(event=>event.pitches);
 expect(pitches.length).toBeGreaterThan(0);
 expect(pitches.every(p=>p.midi>=range.low&&p.midi<=range.high)).toBe(true);
 expect(generateExercise(request,seed)).toEqual(exercise);
}),{numRuns:100}));
it("enforces custom ranges and rejects impossible ones with bounded attempts",()=>{
 const request=defaultTrainingRequest();request.pitchRegister="custom";request.rightHand.range={low:79,high:91};
 expect(generateExercise(request,10).rightHand.flatMap(e=>e.pitches).every(p=>p.midi>=79&&p.midi<=91)).toBe(true);
 request.rightHand.range={low:90,high:90};
 expect(()=>generateExercise(request,10)).toThrow(/32 candidates/);
});
it("defaults older settings to rotating register practice",()=>{
 const request={...defaultTrainingRequest(),pitchRegister:undefined};
 expect(parseTrainingRequest(request).pitchRegister).toBe("rotating");
});
