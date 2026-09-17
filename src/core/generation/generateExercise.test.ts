import fc from "fast-check";
import { describe,expect,it } from "vitest";
import { accordionProfile } from "../instrument/accordionProfile";
import { ticksPerMeasure } from "../music/meter";
import { defaultTrainingRequest } from "../training/trainingIntent";
import { exerciseToAbc } from "../../adapters/abc/exerciseToAbc";
import { generateExercise } from "./generateExercise";
import { validateExercise } from "./validateExercise";
describe("procedural generator",()=>{
 it("is deterministic",()=>{const request=defaultTrainingRequest();expect(generateExercise(request,847192)).toEqual(generateExercise(request,847192));expect(generateExercise(request,1)).not.toEqual(generateExercise(request,2));});
 it("generates valid complete exercises across seeds, keys and meters",()=>fc.assert(fc.property(fc.integer(),fc.constantFrom("C major","D major","Eb major","A minor"),fc.constantFrom({beats:4 as const,beatUnit:4 as const},{beats:3 as const,beatUnit:4 as const},{beats:6 as const,beatUnit:8 as const}),(seed,key,meter)=>{const request=defaultTrainingRequest();request.tonal.keys=[key];request.rhythm.meters=[meter];const exercise=generateExercise(request,seed);expect(exercise.totalDuration).toBe(ticksPerMeasure(meter)*request.measures);expect(validateExercise(exercise,accordionProfile).valid).toBe(true);expect([...exercise.rightHand,...exercise.leftHand].every(e=>e.duration>0)).toBe(true);expect(Object.values(exercise.difficulty).every(Number.isFinite)).toBe(true);expect(()=>exerciseToAbc(exercise)).not.toThrow();}),{numRuns:300}));
});
