import type { Exercise, PerformedMidiEvent } from "../model";
import { matchEvents, type MatchOptions } from "./eventMatcher";
import { computeMetrics } from "./performanceMetrics";
import { createExpectedTimeline } from "./timeline";
export const evaluatePerformance=(exercise:Exercise,performed:PerformedMidiEvent[],sessionStartMs:number,options?:MatchOptions)=>{const matches=matchEvents(createExpectedTimeline(exercise,sessionStartMs),performed,options);return{matches,metrics:computeMetrics(matches,60_000/exercise.tempoBpm)};};
