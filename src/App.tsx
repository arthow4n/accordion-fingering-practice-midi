import { Fragment, useCallback, useEffect, useRef } from "react";
import { renderScore } from "./score";
import { Key, Measure } from "./score.types";
import { useImmer } from "use-immer";
import { enableMapSet } from "immer";
import { generateMeasuresForChallenge, isCorrectAnswer } from "./challenge";
import { useMidiNoteOnHandler } from "./midi";

enableMapSet();

type AppState = {
  currentInputs: Key[];
  measures: Measure[];
};

export const App: React.FC = () => {
  const outputDivRef = useRef<HTMLDivElement>(null);
  const [appState, setAppState] = useImmer<AppState>({
    currentInputs: [],
    measures: generateMeasuresForChallenge(null),
  });

  const setCurrentInputsAndCheckProgress = useCallback((keys: Key[]) => {
    setAppState(draft => {
      {
        keys.forEach(key => draft.currentInputs.push(key));
      }

      {
        const notes = draft.measures.flatMap(m => m.notes);
        const currentNoteIndex = notes.findIndex(x => x.isCurrentProgress);
        if (currentNoteIndex === -1) {
          throw new Error("Couldn't find a note with isCurrentProgress = true.")
        }
        const currentNote = notes[currentNoteIndex];
        const allKeys = currentNote.keys.concat(currentNote.bassPatternKeys);
        if (isCorrectAnswer(draft.currentInputs, allKeys)) {
          const isLastNoteCompleted = currentNoteIndex === notes.length - 1;
          if (isLastNoteCompleted) {
            draft.measures = generateMeasuresForChallenge(draft.measures);
          } else {
            const nextNote = notes[currentNoteIndex + 1];
            currentNote.isCurrentProgress = false;
            nextNote.isCurrentProgress = true;
            draft.currentInputs = [];
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
    // TODO: Support accidentals
    const input = `${event.note.name.toLowerCase()}/${event.note.octave}` as Key;
    console.log("MIDI input: ", input);
    setCurrentInputsAndCheckProgress([input])
  }, [setCurrentInputsAndCheckProgress]));

  return <div>
    <div ref={outputDivRef}></div>
    <div>
      Trigger input for testing: {testInputValues.map((keys, index) => {
        return <Fragment key={index}><button onClick={() => setCurrentInputsAndCheckProgress(keys)}>{keys.join(",")}</button><span>{" "}</span></Fragment>
      })}
    </div>
  </div>;
};
