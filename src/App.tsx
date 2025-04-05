import { useImmer } from 'use-immer';
import { renderAbc } from 'abcjs';
import { useCallback, useEffect, useRef } from 'react';
import { NoteMessageEvent, WebMidi } from 'webmidi';
import { AnswerCheckMode, AppState, QuestionLeftHandGenerationMode, QuestionGenerationSetting, QuestionRightHandGenerationMode } from './type';
import { checkNextProgress, generateEmptyAnswerInput, generateQuestionTrack, getCurrentStepFromHand, getTotalDurationOfTrack, trackToAbc } from './challenge';
import { getNoteFromMidiEvent, useMidiNoteOnHandler } from './midi';
import { ensureNotNullish, logMidiInputIfNotNull, useKeepScreenOn } from './utils';

const defaultQuestionGenerationSetting: QuestionGenerationSetting = {
  rightHand: {
    mode: QuestionRightHandGenerationMode.Single,
    minJump: 0,
    maxJump: 6,
    maxAccidentalsPerTrack: 2,
  },
  leftHand: {
    mode: QuestionLeftHandGenerationMode.PolkaAlt,
    minJump: 0,
    maxJump: 4,
    bassRootLow: "Bb",
    bassRootHigh: "B",
  }
};

function App() {
  const outputDivRef = useRef<HTMLDivElement>(null);

  const [{
    questionTrack,
    answerInput,
    answerCheckMode,
    detectedMidiInputDevices,
    timeTookToCompleteLastMeasuresInSeconds,
    metrics,
  }, setAppState] = useImmer<AppState>({
    questionTrack: generateQuestionTrack({
      previousQuestionTrack: null,
      questionGenerationSetting: defaultQuestionGenerationSetting
    }),
    answerInput: generateEmptyAnswerInput(),

    questionGenerationSetting: defaultQuestionGenerationSetting,
    answerCheckMode: AnswerCheckMode.LeftHandOnly,

    detectedMidiInputDevices: "",
    metrics: {
      completedSets: 0,
      perfectlyCompletedSets: 0,
    },
    inputForCurrentMeasuresStartedAtTime: null,
    timeTookToCompleteLastMeasuresInSeconds: 0,
    rejectInputBeforeTime: new Date(),
  });

  const currentStepLeft = getCurrentStepFromHand(questionTrack.leftHand, answerInput.totalDurationPlayedInTrack);

  // Channel information is based on Roland FR-1XB
  const bassChannelToListenTo = currentStepLeft?.notes.length === 1 ? 2 : 3;

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

    setCurrentInputsAndCheckProgress({
      leftHand: event.message.channel === bassChannelToListenTo ? event : null,
      rightHand: event.message.channel === 1 ? event : null,
    });
  }, [bassChannelToListenTo, setCurrentInputsAndCheckProgress]));

  useEffect(() => {
    if (!outputDivRef.current) {
      throw new Error();
    }

    renderAbc(outputDivRef.current, trackToAbc(questionTrack, answerInput.totalDurationPlayedInTrack), {
      add_classes: true,
    });
  }, [questionTrack, answerInput.totalDurationPlayedInTrack])


  // Known issue: Currently this doesn't really check if the count of keys pressed match, to check that we need to use array instead of set when storing the input state.
  const correctRate = (metrics.perfectlyCompletedSets / metrics.completedSets * 100);

  return <main>
    <div>
      <p>Time took for the last measures: {`${timeTookToCompleteLastMeasuresInSeconds.toFixed(2)}s`}, correct rate: {correctRate >= 0 ? `${correctRate.toFixed(2)}%` : ""} ({metrics.perfectlyCompletedSets}/{metrics.completedSets})</p>
      <div className="track" ref={outputDivRef}></div>

      <p>Detected MIDI inputs: {detectedMidiInputDevices}</p>

      <p>
        Answer check mode: {" "}
        <select defaultValue={answerCheckMode} onChange={(e) => {
          const newAnswerCheckMode = e.target.value as unknown as AnswerCheckMode;
          setAppState(draft => {
            draft.answerCheckMode = newAnswerCheckMode;
            draft.metrics.completedSets = 0;
            draft.metrics.perfectlyCompletedSets = 0;
          });
        }}>
          {Object.values(AnswerCheckMode).map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </p>
    </div>
  </main>;
}

export default App;
