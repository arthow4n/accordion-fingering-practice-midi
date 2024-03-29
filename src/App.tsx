import { useCallback, useEffect, useRef } from "react";
import { renderScore } from "./score";
import { Key, Measure } from "./score.types";
import { useImmer } from "use-immer";
import { enableMapSet } from "immer";
import { AnswerCheckMode, AnswerKeys, createAnswerKeys, generateMeasuresForChallenge, checkICorrectAnswer } from "./challenge";
import { useMidiNoteOnHandler } from "./midi";
import { WebMidi } from "webmidi";
import { ensureNotNullish, useKeepScreenOn } from "./utils";

enableMapSet();

type AppState = {
  detectedMidiInputDevices: string;
  currentInputs: AnswerKeys;
  performance: {
    completedSets: number;
    perfectlyCompletedSets: number;
  },
  answerCheckMode: AnswerCheckMode,
  measures: Measure[];
  inputForCurrentMeasuresStartedAtTime: Date | null;
  timeTookToCompleteLastMeasuresInSeconds: number;
};

const getCurrentNote = (appState: AppState) => {
  const notes = appState.measures.flatMap(m => m.notes);
  const currentNoteIndex = notes.findIndex(x => x.isCurrentProgress);
  if (currentNoteIndex === -1) {
    throw new Error("Couldn't find a note with isCurrentProgress = true.")
  }
  const currentNote = notes[currentNoteIndex];
  return { currentNote, currentNoteIndex, notes };
}

export const App: React.FC = () => {
  const outputDivRef = useRef<HTMLDivElement>(null);
  const [appState, setAppState] = useImmer<AppState>({
    detectedMidiInputDevices: "",
    currentInputs: createAnswerKeys(),
    answerCheckMode: AnswerCheckMode.All,
    performance: {
      completedSets: 0,
      perfectlyCompletedSets: 0,
    },
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

        const inputStartedForCurrentMeasures = oldInputSize === 0 && newInputSize > 0 && !draft.inputForCurrentMeasuresStartedAtTime;
        if (inputStartedForCurrentMeasures) {
          draft.inputForCurrentMeasuresStartedAtTime = new Date();
        }
      }

      {
        const { currentNote, currentNoteIndex, notes } = getCurrentNote(draft);
        const answerKeys: AnswerKeys = {
          treble: new Set(currentNote.keys),
          bass: new Set(currentNote.bassPatternKeys),
        };

        const { isCorrectAnswer, isCorrectAnswerPerfectMatch } = checkICorrectAnswer(draft.currentInputs, answerKeys, draft.answerCheckMode);
        if (isCorrectAnswer) {
          draft.currentInputs = createAnswerKeys();

          draft.performance.completedSets += 1;
          if (isCorrectAnswerPerfectMatch) {
            draft.performance.perfectlyCompletedSets += 1;
          }

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

  const { currentNote } = getCurrentNote(appState);
  // Channel information is based on Roland FR-1XB
  const bassChannelToListenTo = currentNote.bassPatternKeys.length > 1 ? 3 : 2;

  useMidiNoteOnHandler(useCallback((event) => {
    const input = `${event.note.name.toLowerCase()}${event.note.accidental ?? ""}/${event.note.octave}` as Key;
    setCurrentInputsAndCheckProgress(createAnswerKeys({
      treble: event.message.channel === 1 ? [input] : [],
      bass: event.message.channel === bassChannelToListenTo ? [input] : [],
    }));
  }, [setCurrentInputsAndCheckProgress, bassChannelToListenTo]));

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

  // Known issue: Currently this doesn't really check if the count of keys pressed match, to check that we need to use array instead of set when storing the input state.
  const correctRate = (appState.performance.perfectlyCompletedSets / appState.performance.completedSets * 100);

  return <main>
    <div>
      <p>Time took for the last measures: {`${appState.timeTookToCompleteLastMeasuresInSeconds.toFixed(2)}s`}, correct rate: {correctRate >= 0 ? `${correctRate.toFixed(2)}%` : ""} ({appState.performance.perfectlyCompletedSets}/{appState.performance.completedSets})</p>
      <div ref={outputDivRef}></div>

      <p>Detected MIDI inputs: {appState.detectedMidiInputDevices}</p>

      <p>
        Answer check mode: {" "}
        <select defaultValue={appState.answerCheckMode} onChange={(e) => {
          const newAnswerCheckMode = e.target.value as unknown as AnswerCheckMode;
          setAppState(draft => {
            draft.answerCheckMode = newAnswerCheckMode;
            draft.performance.completedSets = 0;
            draft.performance.perfectlyCompletedSets = 0;
          });
        }}>
          {Object.values(AnswerCheckMode).map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </p>
    </div>
  </main>;
};
