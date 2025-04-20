import { useImmer } from 'use-immer';
import { renderAbc } from 'abcjs';
import { useCallback, useEffect, useRef } from 'react';
import { NoteMessageEvent, WebMidi } from 'webmidi';
import { AnswerCheckMode, AppState, QuestionLeftHandGenerationMode, TimeSignature } from './type';
import { checkNextProgress, generateEmptyAnswerInput, generateQuestionTrack, getTotalDurationOfTrack, trackToAbc } from './challenge';
import { getNoteFromMidiEvent, useMidiNoteOnHandler } from './midi';
import { ensureNotNullish, logMidiInputIfNotNull, useKeepScreenOn } from './utils';
import { AppSetting, useAppSetting } from './settings';

const getDefaultAppState = (appSetting: AppSetting) => {
  return {
    questionTrack: generateQuestionTrack({
      previousQuestionTrack: null,
      questionGenerationSetting: appSetting.questionGenerationSetting,
    }),
    answerInput: generateEmptyAnswerInput(),

    questionGenerationSetting: appSetting.questionGenerationSetting,
    answerCheckMode: appSetting.answerCheckMode,

    detectedMidiInputDevices: "",
    metrics: {
      completedSets: 0,
      perfectlyCompletedSets: 0,
    },
    inputForCurrentMeasuresStartedAtTime: null,
    timeTookToCompleteLastMeasuresInSeconds: 0,
    rejectInputBeforeTime: new Date(),
  };
}

function App() {
  const outputDivRef = useRef<HTMLDivElement>(null);

  const { appSetting, setAppSetting } = useAppSetting();

  const [{
    questionTrack,
    answerInput,
    answerCheckMode,
    detectedMidiInputDevices,
    timeTookToCompleteLastMeasuresInSeconds,
    metrics,
  }, setAppState] = useImmer<AppState>(getDefaultAppState(appSetting));

  useEffect(() => {
    setAppState(getDefaultAppState(appSetting));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(appSetting)]);

  const setCurrentInputsAndCheckProgress = useCallback((inputEvent: {
    leftHand: NoteMessageEvent | null,
    rightHand: NoteMessageEvent | null,
  }) => {
    setAppState(draft => {
      // console.log(+new Date(), +draft.rejectInputBeforeTime, new Date() < draft.rejectInputBeforeTime)
      if (new Date() < draft.rejectInputBeforeTime) {
        return;
      }

      {
        const oldInputSize = draft.answerInput.currentInputStep.leftHand.length + draft.answerInput.currentInputStep.rightHand.length;
        if (inputEvent.leftHand) {
          draft.answerInput.currentInputStep.leftHand.push(getNoteFromMidiEvent(inputEvent.leftHand));
        };
        if (inputEvent.rightHand) {
          draft.answerInput.currentInputStep.rightHand.push(getNoteFromMidiEvent(inputEvent.rightHand));
        };

        const newInputSize = draft.answerInput.currentInputStep.leftHand.length + draft.answerInput.currentInputStep.rightHand.length;

        const inputStartedForCurrentMeasures = oldInputSize === 0 && newInputSize > 0 && !draft.inputForCurrentMeasuresStartedAtTime;
        if (inputStartedForCurrentMeasures) {
          draft.inputForCurrentMeasuresStartedAtTime = new Date();
        }
      }

      {
        const playedDurationStart = draft.answerInput.totalDurationPlayedInTrack;

        let { nextProgress } = checkNextProgress(draft.questionTrack, draft.answerInput, draft.answerCheckMode, draft.metrics);
        if (draft.answerInput.totalDurationPlayedInTrack !== nextProgress.totalDurationPlayedInTrack) {
          draft.answerInput = generateEmptyAnswerInput();
          draft.answerInput.totalDurationPlayedInTrack = nextProgress.totalDurationPlayedInTrack;
        }
        draft.metrics = nextProgress.metrics;

        while (true) {
          const { nextProgress: nextProgress2 } = checkNextProgress(draft.questionTrack, draft.answerInput, draft.answerCheckMode, draft.metrics);

          if (draft.answerInput.totalDurationPlayedInTrack !== nextProgress2.totalDurationPlayedInTrack) {
            draft.answerInput = generateEmptyAnswerInput();
            draft.answerInput.totalDurationPlayedInTrack = nextProgress.totalDurationPlayedInTrack;
          }
          draft.metrics = nextProgress.metrics;

          const prevDuration = nextProgress.totalDurationPlayedInTrack;
          const nextDuration = nextProgress2.totalDurationPlayedInTrack;

          nextProgress = nextProgress2;

          if (prevDuration === nextDuration) {
            break;
          }
        }

        // Block the input briefly after each step to prevent mindless progress
        const durationPlayedByAnswer = draft.answerInput.totalDurationPlayedInTrack - playedDurationStart;
        // 1/4 = 180 bpm
        draft.rejectInputBeforeTime = new Date(Date.now() + (1000 / 64 * durationPlayedByAnswer))

        if (draft.answerInput.totalDurationPlayedInTrack >= getTotalDurationOfTrack(questionTrack)) {
          draft.questionTrack = generateQuestionTrack({
            previousQuestionTrack: draft.questionTrack,
            questionGenerationSetting: draft.questionGenerationSetting,
          });
          draft.answerInput = generateEmptyAnswerInput();

          const now = new Date();
          const timeTookToCompleteLastMeasures = now.getTime() - ensureNotNullish(draft.inputForCurrentMeasuresStartedAtTime).getTime();
          draft.timeTookToCompleteLastMeasuresInSeconds = timeTookToCompleteLastMeasures / 1000;
          draft.inputForCurrentMeasuresStartedAtTime = null;
        }
      }
    });
  }, [questionTrack, setAppState]);

  useKeepScreenOn();

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

  useMidiNoteOnHandler(useCallback((event) => {

    logMidiInputIfNotNull(event);

    // Channel information is based on Roland FR-1XB
    setCurrentInputsAndCheckProgress({
      leftHand: (event.message.channel === 2 || event.message.channel === 3) ? event : null,
      rightHand: event.message.channel === 1 ? event : null,
    });
  }, [setCurrentInputsAndCheckProgress]));

  useEffect(() => {
    if (!outputDivRef.current) {
      throw new Error();
    }

    renderAbc(outputDivRef.current, trackToAbc(questionTrack, answerInput.totalDurationPlayedInTrack), {
      add_classes: true,
      responsive: "resize"
    });
  }, [questionTrack, answerInput.totalDurationPlayedInTrack])


  // Known issue: Currently this doesn't really check if the count of keys pressed match, to check that we need to use array instead of set when storing the input state.
  const correctRate = (metrics.perfectlyCompletedSets / metrics.completedSets * 100);

  return <main>
    <p>Time took for the last measures: {`${timeTookToCompleteLastMeasuresInSeconds.toFixed(2)}s`}, correct rate: {correctRate >= 0 ? `${correctRate.toFixed(2)}%` : ""} ({metrics.perfectlyCompletedSets}/{metrics.completedSets})</p>
    <div className="track" ref={outputDivRef}></div>

    <p>Detected MIDI inputs: {detectedMidiInputDevices}</p>

    <p>
      <label>
        {"Answer: "}
        <select value={answerCheckMode} onChange={(e) => {
          const newAnswerCheckMode = e.target.value as unknown as AnswerCheckMode;
          setAppSetting(setting => {
            setting.answerCheckMode = newAnswerCheckMode;
          })
        }}>
          {Object.values(AnswerCheckMode).map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </label>
      {" "}
      <label>
        {"Bass mode: "}
        <select value={appSetting.questionGenerationSetting.leftHand.mode} onChange={(e) => {
          const newMode = e.target.value as unknown as QuestionLeftHandGenerationMode;
          setAppSetting(setting => {
            setting.questionGenerationSetting.leftHand.mode = newMode;
          })
        }}>
          {Object.values(QuestionLeftHandGenerationMode).map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </label>
      {" "}
      <label>
        {"Time signature: "}
        <select value={`${appSetting.questionGenerationSetting.timeSignature.top}/${appSetting.questionGenerationSetting.timeSignature.bottom}`} onChange={(e) => {
          const newMode = e.target.value;
          const [top, bottom] = newMode.split("/").map(v => parseInt(v, 10)) as [TimeSignature["top"], TimeSignature["bottom"]];
          setAppSetting(setting => {
            setting.questionGenerationSetting.timeSignature = {
              top,
              bottom,
            };
          })
        }}>
          {["3/4", "4/4"].map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </label>
      {" "}
      <button onClick={() => setAppSetting(null)}>Default</button>
    </p>
  </main>;
}

export default App;
