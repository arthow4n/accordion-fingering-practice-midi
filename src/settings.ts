import { createParser, useQueryState } from "nuqs";
import {
  AnswerCheckMode,
  QuestionGenerationSetting,
  QuestionLeftHandGenerationMode,
  QuestionRightHandGenerationMode,
} from "./type";
import { bassKeyRange } from "./pattern.helper";
import { ensureNotNullish, validOrUndefined } from "./utils";
import { RecursivePartial } from "./utilTypes";
import { cloneDeep } from "lodash-es";

export type AppSetting = {
  answerCheckMode: AnswerCheckMode;
  questionGenerationSetting: QuestionGenerationSetting;
};

const defaultQuestionGenerationSetting: QuestionGenerationSetting = {
  timeSignature: {
    top: 4,
    bottom: 4,
  },
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
    bassRootLow: ensureNotNullish(bassKeyRange.at(0)),
    bassRootHigh: ensureNotNullish(bassKeyRange.at(-1)),
  },
};

const defaultAppSetting: AppSetting = {
  answerCheckMode: AnswerCheckMode.LeftHandOnly,
  questionGenerationSetting: defaultQuestionGenerationSetting,
};

const appSettingSchema = createParser<AppSetting>({
  parse: (json) => {
    try {
      const parsed = JSON.parse(json) as RecursivePartial<AppSetting>;
      return {
        answerCheckMode:
          AnswerCheckMode[
            validOrUndefined(
              parsed.answerCheckMode,
              (v) => v && !!AnswerCheckMode[v],
            ) ?? defaultAppSetting.answerCheckMode
          ],
        questionGenerationSetting: {
          timeSignature: {
            top:
              validOrUndefined(
                parsed.questionGenerationSetting?.timeSignature?.top,
                (v) => v !== undefined && v > 0 && Math.floor(v) === v,
              ) ?? 4,
            bottom:
              validOrUndefined(
                parsed.questionGenerationSetting?.timeSignature?.bottom,
                (v) => v !== undefined && v > 0 && Math.floor(v) === v,
              ) ?? 4,
          },
          leftHand: {
            bassRootHigh:
              validOrUndefined(
                parsed.questionGenerationSetting?.leftHand?.bassRootHigh,
                (v) => v && bassKeyRange.includes(v),
              ) ?? defaultQuestionGenerationSetting.leftHand.bassRootHigh,
            bassRootLow:
              validOrUndefined(
                parsed.questionGenerationSetting?.leftHand?.bassRootLow,
                (v) => v && bassKeyRange.includes(v),
              ) ?? defaultQuestionGenerationSetting.leftHand.bassRootLow,
            maxJump:
              validOrUndefined(
                parsed.questionGenerationSetting?.leftHand?.maxJump,
                (v) => v !== undefined && v >= 0 && Math.floor(v) === v,
              ) ?? defaultQuestionGenerationSetting.leftHand.maxJump,
            minJump:
              validOrUndefined(
                parsed.questionGenerationSetting?.leftHand?.minJump,
                (v) => v !== undefined && v >= 0 && Math.floor(v) === v,
              ) ?? defaultQuestionGenerationSetting.leftHand.minJump,
            mode: QuestionLeftHandGenerationMode[
              validOrUndefined(
                parsed.questionGenerationSetting?.leftHand?.mode,
                (v) => v && !!QuestionLeftHandGenerationMode[v],
              ) ?? defaultQuestionGenerationSetting.leftHand.mode
            ],
          },
          rightHand: {
            maxAccidentalsPerTrack:
              validOrUndefined(
                parsed.questionGenerationSetting?.rightHand
                  ?.maxAccidentalsPerTrack,
                (v) => v !== undefined && v >= 0 && Math.floor(v) === v,
              ) ??
              defaultQuestionGenerationSetting.rightHand.maxAccidentalsPerTrack,
            maxJump:
              validOrUndefined(
                parsed.questionGenerationSetting?.rightHand?.maxJump,
                (v) => v !== undefined && v >= 0 && Math.floor(v) === v,
              ) ?? defaultQuestionGenerationSetting.rightHand.maxJump,
            minJump:
              validOrUndefined(
                parsed.questionGenerationSetting?.rightHand?.minJump,
                (v) => v !== undefined && v >= 0 && Math.floor(v) === v,
              ) ?? defaultQuestionGenerationSetting.rightHand.minJump,
            mode: QuestionRightHandGenerationMode[
              validOrUndefined(
                parsed.questionGenerationSetting?.rightHand?.mode,
                (v) => v && !!QuestionRightHandGenerationMode[v],
              ) ?? defaultQuestionGenerationSetting.rightHand.mode
            ],
          },
        },
      } satisfies AppSetting;
    } catch {
      return defaultAppSetting;
    }
  },
  serialize: (value) => JSON.stringify(value),
})
  .withDefault(defaultAppSetting)
  .withOptions({
    history: "replace",
  });

export const useAppSetting = () => {
  const [appSetting, setState] = useQueryState("appSetting", appSettingSchema);

  return {
    appSetting,
    setAppSetting: (mutate: null | ((old: AppSetting) => void)) => {
      if (mutate === null) {
        setState(null);
        return;
      }

      setState((old) => {
        const clone = cloneDeep(old);
        mutate(clone);
        return clone;
      });
    },
  };
};
