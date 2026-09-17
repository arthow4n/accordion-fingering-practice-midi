import { TICKS_PER_QUARTER, type Meter, type Tick } from "../model";
export const ticksPerBeat = (meter: Meter) => TICKS_PER_QUARTER * 4 / meter.beatUnit;
export const ticksPerMeasure = (meter: Meter): Tick => meter.beats * ticksPerBeat(meter);
export const metricStrength = (onsetInMeasure: Tick, meter: Meter): "strong" | "medium" | "weak" => onsetInMeasure === 0 ? "strong" : onsetInMeasure % ticksPerBeat(meter) === 0 ? "medium" : "weak";
