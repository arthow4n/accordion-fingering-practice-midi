import { useEffect } from "react";
import { NoteMessageEvent, WebMidi } from "webmidi";

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
