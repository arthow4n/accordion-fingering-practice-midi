import { WebMidi, type Input, type NoteMessageEvent } from "webmidi";
import type { PerformedMidiEvent } from "../../core/model";

export type MidiListener=(event:PerformedMidiEvent)=>void;
export type MidiDevicesListener=(deviceNames:string[])=>void;

const normalize=(event:NoteMessageEvent,type:"noteOn"|"noteOff"):PerformedMidiEvent=>({midiNote:event.note.number,type,timestampMs:event.timestamp??performance.now(),velocity:event.rawValue??0,hand:event.message.channel===1?"right":event.message.channel===2||event.message.channel===3?"left":undefined});
const inputName=(input:Input)=>`${input.manufacturer??""} ${input.name}`.trim();

export const connectWebMidi=async(listener:MidiListener,onDevicesChanged:MidiDevicesListener=()=>{})=>{
 if(!WebMidi.enabled)await WebMidi.enable();
 const attached=new Map<string,{input:Input;disconnect:()=>void}>();let stopped=false;let previousNames="";
 const syncInputs=()=>{
  if(stopped)return;
  const available=new Map(WebMidi.inputs.map(input=>[input.id,input]));
  for(const [id,connection] of attached)if(available.get(id)!==connection.input){connection.disconnect();attached.delete(id);}
  for(const [id,input] of available)if(!attached.has(id)){
   const on=(event:NoteMessageEvent)=>listener(normalize(event,"noteOn"));const off=(event:NoteMessageEvent)=>listener(normalize(event,"noteOff"));
   input.addListener("noteon",on);input.addListener("noteoff",off);
   attached.set(id,{input,disconnect:()=>{input.removeListener("noteon",on);input.removeListener("noteoff",off);}});
  }
  const names=[...available.values()].map(inputName).sort();const serialized=names.join("\n");
  if(serialized!==previousNames){previousNames=serialized;onDevicesChanged(names);}
 };
 const portsChanged=()=>syncInputs();
 WebMidi.addListener("connected",portsChanged);WebMidi.addListener("disconnected",portsChanged);syncInputs();
 const poll=setInterval(syncInputs,1000);
 return{deviceNames:[...WebMidi.inputs].map(inputName).sort(),disconnect:()=>{stopped=true;clearInterval(poll);WebMidi.removeListener("connected",portsChanged);WebMidi.removeListener("disconnected",portsChanged);for(const connection of attached.values())connection.disconnect();attached.clear();}};
};
