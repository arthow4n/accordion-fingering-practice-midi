import { beforeEach,expect,it,vi } from "vitest";

type Handler=(event:unknown)=>void;
const webMidi={enabled:false,inputs:[] as FakeInput[],listeners:new Map<string,Set<Handler>>(),enable:vi.fn(async()=>{webMidi.enabled=true;}),addListener:vi.fn((event:string,handler:Handler)=>{const handlers=webMidi.listeners.get(event)??new Set();handlers.add(handler);webMidi.listeners.set(event,handlers);}),removeListener:vi.fn((event:string,handler:Handler)=>webMidi.listeners.get(event)?.delete(handler))};
class FakeInput{
 listeners=new Map<string,Set<Handler>>();
 constructor(readonly id:string,readonly name:string,readonly manufacturer="Roland"){}
 addListener(event:string,handler:Handler){const handlers=this.listeners.get(event)??new Set();handlers.add(handler);this.listeners.set(event,handlers);}
 removeListener(event:string,handler:Handler){this.listeners.get(event)?.delete(handler);}
 emit(event:string,value:unknown){this.listeners.get(event)?.forEach(handler=>handler(value));}
}
vi.mock("webmidi",()=>({WebMidi:webMidi}));
const midiEvent={note:{number:60},timestamp:42,rawValue:100,message:{channel:1}};

beforeEach(()=>{vi.useFakeTimers();webMidi.enabled=false;webMidi.inputs=[];webMidi.listeners.clear();vi.clearAllMocks();});

it("reconciles hot-plugged inputs and reports the current device list",async()=>{
 const {connectWebMidi}=await import("./webMidiInput");const notes=vi.fn();const devices=vi.fn();
 const connection=await connectWebMidi(notes,devices);const input=new FakeInput("one","FR-1XB");webMidi.inputs=[input];
 webMidi.listeners.get("connected")?.forEach(handler=>handler({}));input.emit("noteon",midiEvent);
 expect(devices).toHaveBeenLastCalledWith(["Roland FR-1XB"]);expect(notes).toHaveBeenCalledWith(expect.objectContaining({midiNote:60,type:"noteOn",hand:"right"}));
 const reconnected=new FakeInput("one","FR-1XB");webMidi.inputs=[reconnected];vi.advanceTimersByTime(1000);expect(input.listeners.get("noteon")?.size).toBe(0);expect(reconnected.listeners.get("noteon")?.size).toBe(1);
 webMidi.inputs=[];vi.advanceTimersByTime(1000);expect(devices).toHaveBeenLastCalledWith([]);expect(reconnected.listeners.get("noteon")?.size).toBe(0);
 connection.disconnect();expect(webMidi.listeners.get("connected")?.size).toBe(0);vi.useRealTimers();
});

it("maps Roland FR-1XB MIDI channels to right and left hands",async()=>{
 const {connectWebMidi}=await import("./webMidiInput");const notes=vi.fn();
 const connection=await connectWebMidi(notes);const input=new FakeInput("one","FR-1XB");webMidi.inputs=[input];
 webMidi.listeners.get("connected")?.forEach(handler=>handler({}));
 // Channel 1: Treble (right hand)
 input.emit("noteon",{note:{number:60},timestamp:100,rawValue:90,message:{channel:1}});
 expect(notes).toHaveBeenLastCalledWith({midiNote:60,type:"noteOn",timestampMs:100,velocity:90,hand:"right"});
 // Channel 2: Bass (left hand)
 input.emit("noteon",{note:{number:48},timestamp:110,rawValue:90,message:{channel:2}});
 expect(notes).toHaveBeenLastCalledWith({midiNote:48,type:"noteOn",timestampMs:110,velocity:90,hand:"left"});
 // Channel 3: Chord (left hand)
 input.emit("noteon",{note:{number:52},timestamp:120,rawValue:90,message:{channel:3}});
 expect(notes).toHaveBeenLastCalledWith({midiNote:52,type:"noteOn",timestampMs:120,velocity:90,hand:"left"});
 // Channel 4: Unassigned / generic
 input.emit("noteon",{note:{number:70},timestamp:130,rawValue:90,message:{channel:4}});
 expect(notes).toHaveBeenLastCalledWith({midiNote:70,type:"noteOn",timestampMs:130,velocity:90,hand:undefined});
 connection.disconnect();
});
