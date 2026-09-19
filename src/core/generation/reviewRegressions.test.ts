import fc from "fast-check";
import { expect,it } from "vitest";
import { generateExercise } from "./generateExercise";
import { defaultTrainingRequest } from "../training/trainingIntent";
import { chordPitches } from "../music/harmony";
import { analyzeDifficulty } from "./analyzeDifficulty";
import { manualConstraintViolations } from "./manualConstraints";

it("generates default Bb, rhythm drills and small-jump practice across seeds",()=>fc.assert(fc.property(fc.integer(),seed=>{
 for(const scenario of ["Bb","rhythm","smallJump"]){
  const request=defaultTrainingRequest();
  if(scenario==="Bb")request.tonal.keys=["Bb major"];
  if(scenario==="rhythm")request.intent="rhythmFocus";
  if(scenario==="smallJump")request.rightHand.maxJump=2;
  const exercise=generateExercise(request,seed);
  expect(exercise.metadata.attempts).toBeLessThanOrEqual(32);
  const notes=exercise.rightHand.filter(e=>e.pitches.length&&!e.metadata.tieFromPrevious);
  if(scenario==="smallJump")for(let i=1;i<notes.length;i++)expect(Math.abs(notes[i]!.pitches[0]!.midi-notes[i-1]!.pitches[0]!.midi)).toBeLessThanOrEqual(2);
 }
}),{numRuns:100}),30000);

it("uses physical bass movement independently of chord voicing octaves",()=>{
 const exercise=generateExercise(defaultTrainingRequest(),0);
 const moved=structuredClone(exercise);
 moved.leftHand.forEach((event,index)=>event.pitches.forEach(p=>{p.midi+=index%2?12:-12;}));
 expect(analyzeDifficulty(moved).leftHandMotor).toBe(analyzeDifficulty(exercise).leftHandMotor);
});

it("fits stable melody notes and the ending to the curated harmony",()=>fc.assert(fc.property(fc.integer(),seed=>{
 const request=defaultTrainingRequest();request.leftHand.templateId="legacy-bb-fdim-line";
 request.challenge.density=0;request.tonal.chromaticism=0;request.rhythm.tieDensity=0;
 const exercise=generateExercise(request,seed);
 for(const event of exercise.rightHand.filter(e=>e.pitches.length&&e.metadata.metricStrength!=="weak")){
  const harmony=exercise.harmony.find(h=>h.id===event.metadata.harmonyId)!;
  expect(chordPitches(exercise.tonalContext,harmony).map(p=>p.midi%12)).toContain(event.pitches[0]!.midi%12);
 }
 expect(exercise.rightHand.filter(e=>e.pitches.length).at(-1)!.pitches[0]!.midi%12).toBe(2);
}),{numRuns:30}));

it("checks actual counterbass notes and skips absent accompaniment",()=>{
 const request=defaultTrainingRequest();request.tonal.keys=["C major"];request.leftHand.templateId="legacy-tonic-pedal-descending";
 const exercise=generateExercise(request,0);
 request.leftHand.bassRootLow="C";request.leftHand.bassRootHigh="C";
 expect(manualConstraintViolations(exercise,request).some(message=>message.includes("bass root B"))).toBe(true);
 expect(()=>generateExercise(request,0)).toThrow(/bass root/);
 request.leftHand.templateId=undefined;request.leftHand.enabled=false;
 expect(generateExercise(request,0).leftHand).toEqual([]);
});
