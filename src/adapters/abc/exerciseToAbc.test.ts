import { expect,it } from "vitest";
import { generateExercise } from "../../core/generation/generateExercise";
import { defaultTrainingRequest } from "../../core/training/trainingIntent";
import { exerciseToAbc } from "./exerciseToAbc";
it("renders arbitrary key signatures",()=>{for(const key of ["D major","Eb major","A minor"]){const r=defaultTrainingRequest();r.tonal.keys=[key];expect(exerciseToAbc(generateExercise(r,10))).toContain(`K:${key.replace(" major","").replace(" minor","m")}`);}});
it("renders a single lead-sheet staff without title or tempo",()=>{const abc=exerciseToAbc(generateExercise(defaultTrainingRequest(),10));expect(abc).not.toContain("T:");expect(abc).not.toContain("Q:");expect(abc).not.toContain("V:");expect(abc).not.toContain("%%score");expect(abc).toMatch(/"[A-G][b#]?(?:m|7|dim)?(?:\/[A-G][b#]?)?"/);});
it("marks the score event containing the current position",()=>{const exercise=generateExercise(defaultTrainingRequest(),10);expect(exerciseToAbc(exercise,exercise.rightHand[1]!.onset)).toContain("!mark!");});
it("renders chords above the staff even when left hand is disabled",()=>{const r=defaultTrainingRequest();r.leftHand.enabled=false;const abc=exerciseToAbc(generateExercise(r,10));expect(abc).toMatch(/"[A-G][b#]?(?:m|7|dim)?"/);});
