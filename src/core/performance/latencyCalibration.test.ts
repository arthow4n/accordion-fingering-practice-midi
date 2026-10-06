import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  applyLatencyOffset,
  calculateBeatOffset,
  calculateCalibratedLatency,
} from "./latencyCalibration";

describe("latencyCalibration", () => {
  it("calculates offset against closest beat", () => {
    const beats = [1000, 2000, 3000, 4000];
    expect(calculateBeatOffset(1040, beats)).toBe(40);
    expect(calculateBeatOffset(1980, beats)).toBe(-20);
    expect(calculateBeatOffset(3000, beats)).toBe(0);
    expect(calculateBeatOffset(3100, beats)).toBe(100);
  });

  it("handles empty beat list gracefully", () => {
    expect(calculateBeatOffset(1000, [])).toBe(0);
  });

  it("handles empty offset list gracefully", () => {
    const result = calculateCalibratedLatency([]);
    expect(result.tapCount).toBe(0);
    expect(result.recommendedLatencyMs).toBe(0);
  });

  it("computes accurate median, mean, and stdDev for steady taps", () => {
    const taps = [40, 42, 38, 45, 40];
    const result = calculateCalibratedLatency(taps);
    expect(result.tapCount).toBe(5);
    expect(result.medianOffsetMs).toBe(40);
    expect(result.recommendedLatencyMs).toBe(40);
    expect(result.minOffsetMs).toBe(38);
    expect(result.maxOffsetMs).toBe(45);
    expect(result.stdDevMs).toBeLessThan(3);
  });

  it("resists single accidental outliers", () => {
    const taps = [45, 47, 43, 46, 44, 45, 380];
    const result = calculateCalibratedLatency(taps);
    expect(result.tapCount).toBe(7);
    // Outlier 380 should not distort recommended latency
    expect(result.recommendedLatencyMs).toBeGreaterThanOrEqual(44);
    expect(result.recommendedLatencyMs).toBeLessThanOrEqual(46);
  });

  it("clamps recommended latency within [-500, 500]", () => {
    expect(calculateCalibratedLatency([600, 700]).recommendedLatencyMs).toBe(500);
    expect(calculateCalibratedLatency([-800, -700]).recommendedLatencyMs).toBe(-500);
  });

  it("applies latency offset in reverse to compensate delay", () => {
    // If input arrives 50ms late, compensation shifts timestamp 50ms earlier
    expect(applyLatencyOffset(1050, 50)).toBe(1000);
    // If input arrives 30ms early, compensation shifts timestamp 30ms later
    expect(applyLatencyOffset(970, -30)).toBe(1000);
  });

  it("property: recommended latency is always finite and bounded [-500, 500]", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -1000, max: 1000 }), { minLength: 0, maxLength: 50 }),
        (offsets) => {
          const res = calculateCalibratedLatency(offsets);
          expect(Number.isFinite(res.recommendedLatencyMs)).toBe(true);
          expect(res.recommendedLatencyMs).toBeGreaterThanOrEqual(-500);
          expect(res.recommendedLatencyMs).toBeLessThanOrEqual(500);
        },
      ),
    );
  });
});
