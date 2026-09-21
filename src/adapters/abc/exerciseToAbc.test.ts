import { expect,it } from "vitest";
import { generateExercise } from "../../core/generation/generateExercise";
import { defaultTrainingRequest } from "../../core/training/trainingIntent";
import { exerciseToAbc } from "./exerciseToAbc";
it("renders arbitrary key signatures",()=>{for(const key of ["D major","Eb major","A minor"]){const r=defaultTrainingRequest();r.tonal.keys=[key];expect(exerciseToAbc(generateExercise(r,10))).toContain(`K:${key.replace(" major","").replace(" minor","m")}`);}});
it("renders a single lead-sheet staff without title or tempo",()=>{const abc=exerciseToAbc(generateExercise(defaultTrainingRequest(),10));expect(abc).not.toContain("T:");expect(abc).not.toContain("Q:");expect(abc).not.toContain("V:");expect(abc).not.toContain("%%score");expect(abc).toMatch(/"[A-G][b#]?(?:m|7|dim)?(?:\/[A-G][b#]?)?"/);});
it("marks the score event containing the current position",()=>{const exercise=generateExercise(defaultTrainingRequest(),10);expect(exerciseToAbc(exercise,exercise.rightHand[1]!.onset)).toContain("!mark!");});
it("renders chords above the staff even when left hand is disabled",()=>{const r=defaultTrainingRequest();r.leftHand.enabled=false;const abc=exerciseToAbc(generateExercise(r,10));expect(abc).toMatch(/"[A-G][b#]?(?:m|7|dim)?"/);});
it("preserves explicit root slash labels from a curated bass line",()=>{const r=defaultTrainingRequest();r.leftHand.templateId="legacy-tonic-pedal-descending";r.tonal.keys=["C major"];r.tonal.selection="fixed";r.rhythm.meters=[{beats:3,beatUnit:4}];r.measures=4;const abc=exerciseToAbc(generateExercise(r,10));for(const label of ["C/C","C/B","C/A","C/G"])expect(abc).toContain(`"${label}"`);});
it("preserves repeated curated labels instead of deduplicating them",()=>{const r=defaultTrainingRequest();r.leftHand.templateId="legacy-bb-fdim-line";r.tonal.keys=["Bb major"];r.tonal.selection="fixed";r.rhythm.meters=[{beats:3,beatUnit:4}];r.measures=6;const abc=exerciseToAbc(generateExercise(r,10));expect(abc.match(/"Fdim\/G"/g)).toHaveLength(2);expect(abc).toContain('"Bb"');expect(abc).toContain('"F/C"');expect(abc).toContain('"D7"');});

it("shows all counterbass changes beneath held melody notes",()=>{
 const request=defaultTrainingRequest();request.leftHand.templateId="legacy-transition-to-IV";request.tonal.keys=["C major"];
 for(let seed=0;seed<20;seed++){
  const exercise=generateExercise(request,seed),abc=exerciseToAbc(exercise);
  for(const label of ["C/C","C/D","C/E"])expect(abc).toContain(`"${label}"`);
 }
});
it("shows changed harmony on the fifth-bass measure of 3/4 polka",()=>{
 const request=defaultTrainingRequest();request.leftHand.accompanimentStyle="polka";request.rhythm.meters=[{beats:3,beatUnit:4}];
 const exercise=generateExercise(request,0);
 for(let i=1;i<exercise.harmony.length;i++){
  const h=exercise.harmony[i]!,previous=exercise.harmony[i-1]!;
  if(h.rootDegree.degree!==previous.rootDegree.degree||h.quality!==previous.quality)
   expect(exercise.leftHand.find(e=>e.onset===h.onset)?.metadata.leadSheetAnnotation).toBeDefined();
 }
});
it("serializes dotted eighths as three sixteenths",()=>{
 const exercise=generateExercise(defaultTrainingRequest(),0);
 exercise.rightHand=[{...exercise.rightHand[0]!,onset:0,duration:360,metadata:{challengeTags:[]}}];
 expect(exerciseToAbc(exercise)).toContain("3/2");
});
it("beams short notes together within beats",async()=>{
 const request=defaultTrainingRequest();request.rhythm.noteValue="sixteenth";request.rhythm.style="steady";request.rhythm.smallestSubdivision="sixteenth";request.rhythm.noteDensity=1;
 const abc=exerciseToAbc(generateExercise(request,0));
 expect(abc).toMatch(/[A-Ga-g][,']*1\/2[A-Ga-g][,']*1\/2/);
 const {parseOnly}=await import("abcjs"),notes=parseOnly(abc)[0].lines.flatMap(line=>line.staff??[]).flatMap(staff=>staff.voices??[]).flat().filter(e=>e.el_type==="note");
 expect(notes.some(note=>note.startBeam)).toBe(true);expect(notes.some(note=>note.endBeam)).toBe(true);
});
it("starts a new beam at each quarter-note beat",()=>{
 const request=defaultTrainingRequest();request.rhythm.noteValue="eighth";request.rhythm.style="steady";
 const body=exerciseToAbc(generateExercise(request,0)).trim().split("\n").at(-1)!;
 expect(body).toMatch(/[A-Ga-g][,']*[A-Ga-g][,']* [A-Ga-g]/);
});

it("ABCJS reads split held notes and dotted rhythms with the original total duration",async()=>{
 const {parseOnly}=await import("abcjs");
 for(const key of ["C major","G major","D major","F major","Bb major","Eb major","A minor","D minor","E minor"]){
  const request=defaultTrainingRequest();request.tonal.keys=[key];if(key==="C major"){request.leftHand.templateId="legacy-transition-to-IV";request.rhythm.smallestSubdivision="quarter";request.rhythm.noteDensity=0;}
  const exercise=generateExercise(request,1),parsed=parseOnly(exerciseToAbc(exercise))[0];
  expect(parsed.warnings??[]).toEqual([]);
  const notes=parsed.lines.flatMap(line=>line.staff??[]).flatMap(staff=>staff.voices??[]).flat().filter(e=>e.el_type==="note");
  expect(notes.reduce((sum,note)=>sum+note.duration,0)).toBe(exercise.totalDuration/1920);
 }
});
it("preserves double accidentals in chromatic note recognition",()=>{
 const exercise=generateExercise(defaultTrainingRequest(),0);
 exercise.rightHand=[{...exercise.rightHand[0]!,pitches:[{midi:67,name:"F##4"}],metadata:{challengeTags:[]}}];
 expect(exerciseToAbc(exercise)).toContain("^^F");
});
