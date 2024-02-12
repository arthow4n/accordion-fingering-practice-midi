import { useCallback, useEffect, useRef } from "react";
import { renderScore } from "./score";
import { Key, Measure } from "./score.types";
import { useImmer } from "use-immer";
import { enableMapSet } from "immer";
import { AnswerCheckMode, AnswerKeys, createAnswerKeys, generateMeasuresForChallenge, isCorrectAnswer } from "./challenge";
import { useMidiNoteOnHandler } from "./midi";
import { WebMidi } from "webmidi";
import { ensureNotNullish, useKeepScreenOn } from "./utils";

enableMapSet();

type AppState = {
  detectedMidiInputDevices: string;
  currentInputs: AnswerKeys;
  answerCheckMode: AnswerCheckMode,
  measures: Measure[];
  inputForCurrentMeasuresStartedAtTime: Date | null;
  timeTookToCompleteLastMeasuresInSeconds: number;
};

export const App: React.FC = () => {
  const outputDivRef = useRef<HTMLDivElement>(null);
  const [appState, setAppState] = useImmer<AppState>({
    detectedMidiInputDevices: "",
    currentInputs: createAnswerKeys(),
    answerCheckMode: AnswerCheckMode.All,
    measures: generateMeasuresForChallenge(null),
    inputForCurrentMeasuresStartedAtTime: null,
    timeTookToCompleteLastMeasuresInSeconds: 0,
  });

  const setCurrentInputsAndCheckProgress = useCallback((inputAnswerKeys: AnswerKeys) => {
    setAppState(draft => {
      {
        const oldInputSize = draft.currentInputs.treble.size + draft.currentInputs.bass.size;
        inputAnswerKeys.treble.forEach(v => draft.currentInputs.treble.add(v));
        inputAnswerKeys.bass.forEach(v => draft.currentInputs.bass.add(v));
        const newInputSize = draft.currentInputs.treble.size + draft.currentInputs.bass.size;

        if (oldInputSize === 0 && newInputSize > 0 && !draft.inputForCurrentMeasuresStartedAtTime) {
          draft.inputForCurrentMeasuresStartedAtTime = new Date();
        }
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

        if (isCorrectAnswer(draft.currentInputs, answerKeys, draft.answerCheckMode)) {
          const isLastNoteCompleted = currentNoteIndex === notes.length - 1;
          if (isLastNoteCompleted) {
            draft.measures = generateMeasuresForChallenge(draft.measures);
            const now = new Date();
            const timeTookToCompleteLastMeasures = now.getTime() - ensureNotNullish(draft.inputForCurrentMeasuresStartedAtTime).getTime();
            draft.timeTookToCompleteLastMeasuresInSeconds = timeTookToCompleteLastMeasures / 1000;
            draft.inputForCurrentMeasuresStartedAtTime = null;
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

  useKeepScreenOn();

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
      setAppState(draft => {
        draft.detectedMidiInputDevices = WebMidi.inputs.map(x => `${x.manufacturer} ${x.name}`).sort().join(", ");
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [setAppState]);

  return <main>
    <div>
      <p>Time took for the last measures: {`${appState.timeTookToCompleteLastMeasuresInSeconds.toFixed(2)}s`}</p>
      <div ref={outputDivRef}></div>

      <p>Detected MIDI inputs: {appState.detectedMidiInputDevices}</p>

      <p>
        Answer check mode: {" "}
        <select defaultValue={appState.answerCheckMode} onChange={(e) => {
          const newAnswerCheckMode = e.target.value as unknown as AnswerCheckMode;
          setAppState(draft => {
            draft.answerCheckMode = newAnswerCheckMode
          });
        }}>
          {Object.values(AnswerCheckMode).map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </p>
    </div>
  </main>;
};
