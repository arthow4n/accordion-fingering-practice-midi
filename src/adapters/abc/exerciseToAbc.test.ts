import { expect,it } from "vitest";
import { generateExercise } from "../../core/generation/generateExercise";
import { defaultTrainingRequest } from "../../core/training/trainingIntent";
import { exerciseToAbc } from "./exerciseToAbc";
it("renders arbitrary key signatures",()=>{for(const key of ["D major","Eb major","A minor"]){const r=defaultTrainingRequest();r.tonal.keys=[key];expect(exerciseToAbc(generateExercise(r,10))).toContain(`K:${key.replace(" major","").replace(" minor","m")}`);}});
