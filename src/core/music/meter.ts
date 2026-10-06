import { TICKS_PER_QUARTER, type Meter, type Tick } from "../model";
export const ticksPerBeat = (meter: Meter) => TICKS_PER_QUARTER * 4 / meter.beatUnit;
export const ticksPerMeasure = (meter: Meter): Tick => meter.beats * ticksPerBeat(meter);
export const metricStrength = (onsetInMeasure: Tick, meter: Meter): "strong" | "medium" | "weak" => {
  if (onsetInMeasure === 0) return "strong";
  const beatTicks = ticksPerBeat(meter);
  const isExactBeat = onsetInMeasure % beatTicks === 0;
  if (!isExactBeat) return "weak";
  const beatIndex = Math.floor(onsetInMeasure / beatTicks);
  if (meter.beats === 4 && meter.beatUnit === 4) {
    return beatIndex === 2 ? "medium" : "weak";
  }
  if (meter.beats === 6 && meter.beatUnit === 8) {
    return beatIndex === 3 ? "medium" : "weak";
  }
  return "weak";
};
