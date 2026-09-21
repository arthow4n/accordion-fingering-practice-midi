import { describe,expect,it } from "vitest";
import type { TimedExpectedEvent } from "./timeline";
import { matchEvents } from "./eventMatcher";
const event=(pitches=[60,64,67]):TimedExpectedEvent=>({id:"e",onset:0,duration:480,pitches:pitches.map(midi=>({midi,name:"C4"})),hand:"right",metadata:{challengeTags:[]},expectedMs:1000,durationMs:500});
describe("event matching",()=>{
 it("classifies exact, wrong, missed and extra notes",()=>{expect(matchEvents([event([60])],[{midiNote:60,type:"noteOn",timestampMs:1000,velocity:1}])[0]?.classification).toBe("correct");expect(matchEvents([event([60])],[{midiNote:61,type:"noteOn",timestampMs:1000,velocity:1}])[0]?.classification).toBe("wrongPitch");expect(matchEvents([event([60])],[])[0]?.classification).toBe("missed");expect(matchEvents([],[{midiNote:60,type:"noteOn",timestampMs:1000,velocity:1}])[0]?.classification).toBe("extra");});
 it("accepts human chord spread",()=>expect(matchEvents([event()],[60,64,67].map((midiNote,i)=>({midiNote,type:"noteOn" as const,timestampMs:1000+i*20,velocity:1})))[0]?.classification).toBe("correct"));
 it("counts repeated pitches for simultaneous hand events without using hand metadata",()=>{
  const right=event([60]);const left={...right,hand:"left" as const,id:"left"};
  const matches=matchEvents([right,left],[{midiNote:60,type:"noteOn",timestampMs:1000,velocity:1},{midiNote:60,type:"noteOn",timestampMs:1005,velocity:1}]);
  expect(matches.map(match=>match.classification)).toEqual(["correct","correct"]);
 });
 it("classifies early and late",()=>{expect(matchEvents([event([60])],[{midiNote:60,type:"noteOn",timestampMs:850,velocity:1}])[0]?.classification).toBe("early");expect(matchEvents([event([60])],[{midiNote:60,type:"noteOn",timestampMs:1200,velocity:1}])[0]?.classification).toBe("late");});
 it("isolates hands so left-hand notes do not match right-hand targets",()=>{
  const right=event([60]);
  const leftMatch=matchEvents([right],[{midiNote:60,type:"noteOn",timestampMs:1000,velocity:1,hand:"left"}]);
  expect(leftMatch[0]?.classification).toBe("missed");
  const rightMatch=matchEvents([right],[{midiNote:60,type:"noteOn",timestampMs:1000,velocity:1,hand:"right"}]);
  expect(rightMatch[0]?.classification).toBe("correct");
 });
 it("folds octaves for left-hand accordion buttons while enforcing exact octave on right hand",()=>{
  const leftTarget={...event([48]),hand:"left" as const};
  const foldedMatch=matchEvents([leftTarget],[{midiNote:36,type:"noteOn",timestampMs:1000,velocity:1,hand:"left"}]);
  expect(foldedMatch[0]?.classification).toBe("correct");
  const rightTarget=event([60]);
  const wrongOctaveMatch=matchEvents([rightTarget],[{midiNote:72,type:"noteOn",timestampMs:1000,velocity:1,hand:"right"}]);
  expect(wrongOctaveMatch[0]?.classification).toBe("wrongPitch");
 });
});

it("does not steal a correct following attack when the previous note is missed",()=>{
 const first=event([60]),second={...event([62]),id:"second",expectedMs:1125};
 const matches=matchEvents([first,second],[{midiNote:62,type:"noteOn",timestampMs:1125,velocity:100,hand:"right"}]);
 expect(matches.map(m=>m.classification)).toEqual(["missed","correct"]);
});
it("reserves the nearest repeated pitch rather than penalizing two notes",()=>{
 const first=event([60]),second={...event([60]),id:"second",expectedMs:1125};
 const matches=matchEvents([first,second],[{midiNote:60,type:"noteOn",timestampMs:1125,velocity:100,hand:"right"}]);
 expect(matches.map(m=>m.classification)).toEqual(["missed","correct"]);
});
it("reports short taps and unreleased notes separately from pitch accuracy",()=>{
 const performed=[{midiNote:60,type:"noteOn" as const,timestampMs:1000,velocity:100,hand:"right" as const},{midiNote:60,type:"noteOff" as const,timestampMs:1020,velocity:0,hand:"right" as const}];
 expect(matchEvents([event([60])],performed)[0]).toMatchObject({classification:"correct",durationCorrect:false});
 performed[1]!.timestampMs=1500;
 expect(matchEvents([event([60])],performed)[0]?.durationCorrect).toBe(true);
 performed[1]!.timestampMs=2500;
 expect(matchEvents([event([60])],performed)[0]?.durationCorrect).toBe(false);
});

it("keeps nearby complete chords intact with forgiving windows",()=>{
 const first={...event([48,52,55]),hand:"left" as const},second={...event([48,52,55]),hand:"left" as const,id:"second",expectedMs:1250};
 const notes=[1000,1250].flatMap(timestampMs=>[48,52,55].map(midiNote=>({midiNote,timestampMs,type:"noteOn" as const,velocity:100,hand:"left" as const})));
 expect(matchEvents([first,second],notes,{earlyToleranceMs:600,lateToleranceMs:600,simultaneityWindowMs:150}).map(m=>m.classification)).toEqual(["correct","correct"]);
});
it("does not mistake a duplicated bass/chord root for an extra note",()=>{
 const target={...event([48,52,55]),hand:"left" as const};
 const notes=[48,48,52,55].map(midiNote=>({midiNote,type:"noteOn" as const,timestampMs:1000,velocity:100,hand:"left" as const}));
 expect(matchEvents([target],notes).map(m=>m.classification)).toEqual(["correct"]);
});
