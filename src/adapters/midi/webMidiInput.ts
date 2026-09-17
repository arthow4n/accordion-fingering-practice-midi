import { WebMidi, type NoteMessageEvent } from "webmidi";
import type { PerformedMidiEvent } from "../../core/model";
export type MidiListener=(event:PerformedMidiEvent)=>void;
const normalize=(event:NoteMessageEvent,type:"noteOn"|"noteOff"):PerformedMidiEvent=>({midiNote:event.note.number,type,timestampMs:event.timestamp,velocity:event.rawValue??0,hand:event.message.channel===1?"right":event.message.channel===2||event.message.channel===3?"left":undefined});
export const connectWebMidi=async(listener:MidiListener)=>{await WebMidi.enable();const cleanups=WebMidi.inputs.flatMap(input=>{const on=(e:NoteMessageEvent)=>listener(normalize(e,"noteOn"));const off=(e:NoteMessageEvent)=>listener(normalize(e,"noteOff"));input.addListener("noteon",on);input.addListener("noteoff",off);return[()=>input.removeListener("noteon",on),()=>input.removeListener("noteoff",off)];});return{deviceNames:WebMidi.inputs.map(x=>`${x.manufacturer??""} ${x.name}`.trim()),disconnect:()=>cleanups.forEach(x=>x())};};
