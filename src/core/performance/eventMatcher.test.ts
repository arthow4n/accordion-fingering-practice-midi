import { describe,expect,it } from "vitest";
import type { TimedExpectedEvent } from "./timeline";
import { matchEvents } from "./eventMatcher";
const event=(pitches=[60,64,67]):TimedExpectedEvent=>({id:"e",onset:0,duration:480,pitches:pitches.map(midi=>({midi,name:"C4"})),hand:"right",metadata:{challengeTags:[]},expectedMs:1000,durationMs:500});
describe("event matching",()=>{
 it("classifies exact, wrong, missed and extra notes",()=>{expect(matchEvents([event([60])],[{midiNote:60,type:"noteOn",timestampMs:1000,velocity:1}])[0]?.classification).toBe("correct");expect(matchEvents([event([60])],[{midiNote:61,type:"noteOn",timestampMs:1000,velocity:1}])[0]?.classification).toBe("wrongPitch");expect(matchEvents([event([60])],[])[0]?.classification).toBe("missed");expect(matchEvents([],[{midiNote:60,type:"noteOn",timestampMs:1000,velocity:1}])[0]?.classification).toBe("extra");});
 it("accepts human chord spread",()=>expect(matchEvents([event()],[60,64,67].map((midiNote,i)=>({midiNote,type:"noteOn" as const,timestampMs:1000+i*20,velocity:1})))[0]?.classification).toBe("correct"));
 it("classifies early and late",()=>{expect(matchEvents([event([60])],[{midiNote:60,type:"noteOn",timestampMs:850,velocity:1}])[0]?.classification).toBe("early");expect(matchEvents([event([60])],[{midiNote:60,type:"noteOn",timestampMs:1200,velocity:1}])[0]?.classification).toBe("late");});
});
