import { useEffect } from "react";
import { NoteMessageEvent, WebMidi } from "webmidi";
import { Note } from "./type";

export type NoteOnHandler = (event: NoteMessageEvent) => void;
const noteOnHandlers = new Set<NoteOnHandler>();

export const useMidiNoteOnHandler = (callback: NoteOnHandler) => {
  useEffect(() => {
    noteOnHandlers.add(callback);

    return () => {
      noteOnHandlers.delete(callback);
    };
  }, [callback]);
};

export const getNoteFromMidiEvent = (event: NoteMessageEvent): Note => {
  if (!["A", "B", "C", "D", "E", "F", "G"].includes(event.note.name)) {
    throw new Error("Unsupported note name: " + event.note.name);
  }

  if (!["#", "b", null, undefined].includes(event.note.accidental)) {
    throw new Error("Unsupported note accidental: " + event.note.accidental);
  }

  return {
    letter: event.note.name as Note["letter"],
    accidental: event.note.accidental as Note["accidental"],
    octave: event.note.octave as Note["octave"],
  };
};

const runAllNoteOnHandlers = (event: NoteMessageEvent) => {
  noteOnHandlers.forEach((handler) => handler(event));
};

const listenToMidiInput = async () => {
  try {
    await WebMidi.enable();
  } catch (err) {
    console.log("listenToMidiInput failed: ", err);
  }

  console.log(
    "listenToMidiInput found inputs: ",
    WebMidi.inputs.map((input) => input.name).join(", "),
  );

  WebMidi.inputs.forEach((input) =>
    input.removeListener("noteon", runAllNoteOnHandlers),
  );
  WebMidi.inputs.forEach((input) =>
    input.addListener("noteon", runAllNoteOnHandlers),
  );
};

WebMidi.addListener("connected", () => {
  listenToMidiInput();
});

listenToMidiInput();
