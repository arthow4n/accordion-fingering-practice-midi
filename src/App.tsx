import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { renderScore } from "./score";
import { Key, Measure } from "./score.types";
import { useImmer } from "use-immer";
import { enableMapSet } from "immer";
import { AnswerKeys, createAnswerKeys, generateMeasuresForChallenge, isCorrectAnswer } from "./challenge";
import { useMidiNoteOnHandler } from "./midi";
import { WebMidi } from "webmidi";

enableMapSet();

type AppState = {
  currentInputs: AnswerKeys;
  measures: Measure[];
};

export const App: React.FC = () => {
  const outputDivRef = useRef<HTMLDivElement>(null);
  const [detectedMidiInputs, setDetectedMidiInputs] = useState("");

  const [appState, setAppState] = useImmer<AppState>({
    currentInputs: createAnswerKeys(),
    measures: generateMeasuresForChallenge(null),
  });

  const setCurrentInputsAndCheckProgress = useCallback((inputAnswerKeys: AnswerKeys) => {
    setAppState(draft => {
      {
        inputAnswerKeys.treble.forEach(v => draft.currentInputs.treble.add(v));
        inputAnswerKeys.bass.forEach(v => draft.currentInputs.bass.add(v));
      }

      {
        const notes = draft.measures.flatMap(m => m.notes);

        const currentNoteIndex = notes.findIndex(x => x.isCurrentProgress);
        if (currentNoteIndex === -1) {
          throw new Error("Couldn't find a note with isCurrentProgress = true.")
        }
        const currentNote = notes[currentNoteIndex];

        const answerKeys: AnswerKeys = {
          treble: new Set(currentNote.keys),
          bass: new Set(currentNote.bassPatternKeys),
        };

        if (isCorrectAnswer(draft.currentInputs, answerKeys)) {
          const isLastNoteCompleted = currentNoteIndex === notes.length - 1;
          if (isLastNoteCompleted) {
            draft.measures = generateMeasuresForChallenge(draft.measures);
          } else {
            const nextNote = notes[currentNoteIndex + 1];
            currentNote.isCurrentProgress = false;
            nextNote.isCurrentProgress = true;
            draft.currentInputs = createAnswerKeys();
          }
        }
      }
    });
  }, [setAppState]);

  useEffect(() => {
    const element = outputDivRef.current;
    if (!element) {
      return;
    }

    renderScore(element, appState.measures)

    return () => {
      if (element) {
        element.innerHTML = "";
      }
    };
  }, [appState]);

  const testInputValues: Key[][] = [["c/4"], ["e/4"], ["g/4"], ["c/3"], ["g/3"], ["c/3", "e/3", "g/3"]];

  useMidiNoteOnHandler(useCallback((event) => {
    const input = `${event.note.name.toLowerCase()}${event.note.accidental ?? ""}/${event.note.octave}` as Key;

    // Channel information is based on Roland FR-1XB
    setCurrentInputsAndCheckProgress(createAnswerKeys({
      treble: event.message.channel === 1 ? [input] : [],
      bass: event.message.channel === 2 || event.message.channel === 3 ? [input] : [],
    }));
  }, [setCurrentInputsAndCheckProgress]));

  useEffect(() => {
    const interval = setInterval(() => {
      setDetectedMidiInputs(
        WebMidi.inputs.map(x => `${x.manufacturer} ${x.name}`).sort().join(", "));
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return <main>
    <div>
      <div ref={outputDivRef}></div>
      <p>Detected MIDI inputs: {detectedMidiInputs}</p>
      <p>
        Trigger input for testing treble: {testInputValues.map((keys, index) => {
          return <Fragment key={index}><button onClick={() => setCurrentInputsAndCheckProgress(createAnswerKeys({
            treble: keys,
            bass: []
          }))}>{keys.join(",")}</button><span>{" "}</span></Fragment>
        })}
      </p>

      <p>
        Trigger input for testing bass: {testInputValues.map((keys, index) => {
          return <Fragment key={index}><button onClick={() => setCurrentInputsAndCheckProgress(createAnswerKeys({
            treble: [],
            bass: keys
          }))}>{keys.join(",")}</button><span>{" "}</span></Fragment>
        })}
      </p>
    </div>
  </main>;
};
