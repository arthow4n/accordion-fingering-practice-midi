export interface LatencyCalibrationResult {
  tapCount: number;
  meanOffsetMs: number;
  medianOffsetMs: number;
  minOffsetMs: number;
  maxOffsetMs: number;
  stdDevMs: number;
  recommendedLatencyMs: number;
}

export function calculateBeatOffset(
  tapTimestampMs: number,
  beatTimestampsMs: number[],
): number {
  if (beatTimestampsMs.length === 0) return 0;
  let closestBeat = beatTimestampsMs[0]!;
  let minDiff = Math.abs(tapTimestampMs - closestBeat);
  for (let i = 1; i < beatTimestampsMs.length; i++) {
    const diff = Math.abs(tapTimestampMs - beatTimestampsMs[i]!);
    if (diff < minDiff) {
      minDiff = diff;
      closestBeat = beatTimestampsMs[i]!;
    }
  }
  return tapTimestampMs - closestBeat;
}

export function calculateCalibratedLatency(
  offsetsMs: number[],
): LatencyCalibrationResult {
  if (offsetsMs.length === 0) {
    return {
      tapCount: 0,
      meanOffsetMs: 0,
      medianOffsetMs: 0,
      minOffsetMs: 0,
      maxOffsetMs: 0,
      stdDevMs: 0,
      recommendedLatencyMs: 0,
    };
  }

  const sorted = [...offsetsMs].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((sum, v) => sum + v, 0) / n;
  const median =
    n % 2 === 1
      ? sorted[Math.floor(n / 2)]!
      : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;

  const variance =
    sorted.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  // If we have at least 4 taps, filter extreme outliers (beyond 2.5 std devs or 150ms from median)
  let effectiveOffsets = sorted;
  if (n >= 4 && stdDev > 0) {
    const threshold = Math.max(80, 2.5 * stdDev);
    const filtered = sorted.filter((v) => Math.abs(v - median) <= threshold);
    if (filtered.length >= 2) {
      effectiveOffsets = filtered;
    }
  }

  const effectiveMedian =
    effectiveOffsets.length % 2 === 1
      ? effectiveOffsets[Math.floor(effectiveOffsets.length / 2)]!
      : (effectiveOffsets[effectiveOffsets.length / 2 - 1]! +
          effectiveOffsets[effectiveOffsets.length / 2]!) /
        2;

  const recommended = Math.max(
    -500,
    Math.min(500, Math.round(effectiveMedian)),
  );

  return {
    tapCount: n,
    meanOffsetMs: Math.round(mean),
    medianOffsetMs: Math.round(median),
    minOffsetMs: Math.round(sorted[0]!),
    maxOffsetMs: Math.round(sorted[n - 1]!),
    stdDevMs: Math.round(stdDev),
    recommendedLatencyMs: recommended,
  };
}

export function applyLatencyOffset(
  timestampMs: number,
  latencyMs: number,
): number {
  return timestampMs - latencyMs;
}
