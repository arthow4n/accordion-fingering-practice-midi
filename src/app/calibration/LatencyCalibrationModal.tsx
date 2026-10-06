import { useCallback, useEffect, useId, useRef, useState } from "react";
import { MetronomeAudio } from "../../adapters/audio/metronomeAudio";
import type { PerformedMidiEvent } from "../../core/model";
import {
  calculateBeatOffset,
  calculateCalibratedLatency,
  type LatencyCalibrationResult,
} from "../../core/performance/latencyCalibration";

export interface LatencyCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLatencyMs: number;
  onSaveLatency: (latencyMs: number) => void;
  onRegisterMidiListener: (
    listener: ((event: PerformedMidiEvent) => void) | null,
  ) => void;
}

type CalibrationPhase = "idle" | "countdown" | "recording" | "finished";

interface RecordedTap {
  timestampMs: number;
  offsetMs: number;
  compensatedOffsetMs?: number;
}

export function LatencyCalibrationModal({
  isOpen,
  onClose,
  currentLatencyMs,
  onSaveLatency,
  onRegisterMidiListener,
}: LatencyCalibrationModalProps) {
  const [phase, setPhase] = useState<CalibrationPhase>("idle");
  const [tempoBpm, setTempoBpm] = useState(100);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [testWithCompensation, setTestWithCompensation] = useState(false);
  const [countdownBeat, setCountdownBeat] = useState(4);
  const [currentBeatIndex, setCurrentBeatIndex] = useState(0);
  const [totalRecordingBeats] = useState(12);
  const [visualPulse, setVisualPulse] = useState(false);
  const [taps, setTaps] = useState<RecordedTap[]>([]);
  const [latestOffset, setLatestOffset] = useState<number | null>(null);
  const [candidateLatency, setCandidateLatency] = useState(currentLatencyMs);
  const [stats, setStats] = useState<LatencyCalibrationResult | null>(null);

  const tempoId = useId();
  const audioId = useId();
  const compensateId = useId();

  const audioRef = useRef<MetronomeAudio | null>(null);
  const beatTimestampsRef = useRef<number[]>([]);
  const timerRef = useRef<number | null>(null);
  const candidateLatencyRef = useRef(candidateLatency);
  const testWithCompensationRef = useRef(testWithCompensation);

  useEffect(() => {
    candidateLatencyRef.current = candidateLatency;
  }, [candidateLatency]);

  useEffect(() => {
    testWithCompensationRef.current = testWithCompensation;
  }, [testWithCompensation]);

  useEffect(() => {
    setCandidateLatency(currentLatencyMs);
  }, [currentLatencyMs, isOpen]);

  // Lazy-initialize audio adapter
  useEffect(() => {
    if (isOpen && !audioRef.current) {
      audioRef.current = new MetronomeAudio();
    }
    return () => {
      if (!isOpen && audioRef.current) {
        audioRef.current.close();
        audioRef.current = null;
      }
    };
  }, [isOpen]);

  const recordTapAtTime = useCallback(
    (timestampMs: number) => {
      if (phase !== "recording") return;
      const beats = beatTimestampsRef.current;
      if (!beats.length) return;

      const rawOffset = calculateBeatOffset(timestampMs, beats);
      const compensation = testWithCompensationRef.current
        ? candidateLatencyRef.current
        : 0;
      const effectiveOffset = rawOffset - compensation;

      setLatestOffset(effectiveOffset);
      setTaps((prev) => [
        ...prev,
        {
          timestampMs,
          offsetMs: rawOffset,
          compensatedOffsetMs: testWithCompensationRef.current
            ? effectiveOffset
            : undefined,
        },
      ]);
    },
    [phase],
  );

  // Register MIDI intake when open
  useEffect(() => {
    if (!isOpen) {
      onRegisterMidiListener(null);
      return;
    }

    const handleMidi = (event: PerformedMidiEvent) => {
      if (event.type === "noteOn") {
        recordTapAtTime(event.timestampMs);
      }
    };

    onRegisterMidiListener(handleMidi);
    return () => {
      onRegisterMidiListener(null);
    };
  }, [isOpen, onRegisterMidiListener, recordTapAtTime]);

  // Keyboard Space listener for test tapping
  useEffect(() => {
    if (!isOpen || phase !== "recording") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        recordTapAtTime(performance.now());
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, phase, recordTapAtTime]);

  const finishRecording = useCallback(
    (recordedTaps: RecordedTap[]) => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setPhase("finished");
      setVisualPulse(false);

      const offsets = recordedTaps.map((t) => t.offsetMs);
      const computed = calculateCalibratedLatency(offsets);
      setStats(computed);
      if (!testWithCompensationRef.current) {
        setCandidateLatency(computed.recommendedLatencyMs);
      }
    },
    [],
  );

  const startCalibration = useCallback(
    (withExistingCompensation = false) => {
      setTestWithCompensation(withExistingCompensation);
      testWithCompensationRef.current = withExistingCompensation;
      setTaps([]);
      setLatestOffset(null);
      setStats(null);
      setPhase("countdown");
      setCountdownBeat(4);
      setCurrentBeatIndex(0);

      const beatIntervalMs = (60 / tempoBpm) * 1000;
      let count = 4;

      if (audioEnabled && audioRef.current) {
        audioRef.current.playClick(true);
      }
      setVisualPulse(true);
      setTimeout(() => setVisualPulse(false), 80);

      const countInterval = window.setInterval(() => {
        count -= 1;
        if (count > 0) {
          setCountdownBeat(count);
          if (audioEnabled && audioRef.current) {
            audioRef.current.playClick(count === 1);
          }
          setVisualPulse(true);
          setTimeout(() => setVisualPulse(false), 80);
        } else {
          window.clearInterval(countInterval);
          // Transition to recording
          setPhase("recording");
          const startTime = performance.now();
          const targetBeats: number[] = [];
          for (let i = 0; i < totalRecordingBeats; i++) {
            targetBeats.push(startTime + i * beatIntervalMs);
          }
          beatTimestampsRef.current = targetBeats;

          let beatIdx = 0;
          setCurrentBeatIndex(1);
          if (audioEnabled && audioRef.current) {
            audioRef.current.playClick(true);
          }
          setVisualPulse(true);
          setTimeout(() => setVisualPulse(false), 90);

          const recordInterval = window.setInterval(() => {
            beatIdx += 1;
            if (beatIdx < totalRecordingBeats) {
              setCurrentBeatIndex(beatIdx + 1);
              if (audioEnabled && audioRef.current) {
                audioRef.current.playClick(beatIdx % 4 === 0);
              }
              setVisualPulse(true);
              setTimeout(() => setVisualPulse(false), 90);
            } else {
              window.clearInterval(recordInterval);
              setTaps((current) => {
                finishRecording(current);
                return current;
              });
            }
          }, beatIntervalMs);

          timerRef.current = recordInterval;
        }
      }, beatIntervalMs);

      timerRef.current = countInterval;
    },
    [audioEnabled, finishRecording, tempoBpm, totalRecordingBeats],
  );

  const stopEarly = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    finishRecording(taps);
  };

  const cancelAndClose = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPhase("idle");
    onClose();
  };

  const handleSave = () => {
    onSaveLatency(candidateLatency);
    cancelAndClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="calibration-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="MIDI Latency Calibration"
    >
      <div className="calibration-modal-content">
        <header className="calibration-header">
          <h2>MIDI Latency Calibration</h2>
          <button
            type="button"
            className="calibration-close-btn"
            onClick={cancelAndClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <p className="calibration-description">
          Rhythm games adjust input latency so physical key strikes match the
          visual & audio pulse. Play along on any accordion key or button with
          the metronome beats to measure and compensate timing delay.
        </p>

        {phase === "idle" && (
          <div className="calibration-setup">
            <div className="calibration-settings-row">
              <label htmlFor={tempoId}>
                Metronome tempo:
                <select
                  id={tempoId}
                  value={tempoBpm}
                  onChange={(e) => setTempoBpm(Number(e.target.value))}
                >
                  <option value={80}>80 BPM (Slow)</option>
                  <option value={100}>100 BPM (Moderate)</option>
                  <option value={120}>120 BPM (Standard)</option>
                </select>
              </label>

              <label htmlFor={audioId} className="calibration-checkbox-label">
                <input
                  id={audioId}
                  type="checkbox"
                  checked={audioEnabled}
                  onChange={(e) => setAudioEnabled(e.target.checked)}
                />
                Audio clicks
              </label>
            </div>

            <div className="calibration-current-box">
              <span>Active Latency Offset:</span>
              <strong>
                {currentLatencyMs > 0 ? `+${currentLatencyMs}` : currentLatencyMs} ms
              </strong>
            </div>

            <div className="calibration-actions">
              <button
                type="button"
                className="calibration-primary-btn"
                onClick={() => startCalibration(false)}
              >
                Start Calibration Test
              </button>
            </div>
          </div>
        )}

        {(phase === "countdown" || phase === "recording") && (
          <div className="calibration-active-arena">
            {phase === "countdown" ? (
              <div className="calibration-countdown-view">
                <span className="calibration-subtext">Get ready...</span>
                <div
                  className={`calibration-pulse-circle ${
                    visualPulse ? "pulsing" : ""
                  }`}
                >
                  <span className="calibration-countdown-number">
                    {countdownBeat}
                  </span>
                </div>
                <p>Listen to the tempo and prepare to strike on beat</p>
              </div>
            ) : (
              <div className="calibration-recording-view">
                <span className="calibration-subtext">
                  Beat {currentBeatIndex} of {totalRecordingBeats}
                </span>

                <div
                  className={`calibration-pulse-circle recording ${
                    visualPulse ? "pulsing" : ""
                  }`}
                  onClick={() => recordTapAtTime(performance.now())}
                  role="button"
                  tabIndex={0}
                  aria-label="Tap on the beat"
                >
                  <span className="calibration-pulse-label">TAP</span>
                </div>

                <div className="calibration-tap-indicator">
                  {latestOffset !== null ? (
                    <span
                      className={`calibration-offset-badge ${
                        Math.abs(latestOffset) <= 25
                          ? "great"
                          : latestOffset > 0
                            ? "late"
                            : "early"
                      }`}
                    >
                      {latestOffset > 0 ? `+${latestOffset}` : latestOffset} ms{" "}
                      {Math.abs(latestOffset) <= 25
                        ? "(On beat)"
                        : latestOffset > 0
                          ? "(Late)"
                          : "(Early)"}
                    </span>
                  ) : (
                    <span className="calibration-hint">
                      Press any accordion key, button, or Spacebar on the beat
                    </span>
                  )}
                </div>

                <div className="calibration-taps-count">
                  Recorded taps: {taps.length}
                </div>

                <button
                  type="button"
                  className="calibration-stop-btn"
                  onClick={stopEarly}
                >
                  Calculate Now ({taps.length} taps)
                </button>
              </div>
            )}
          </div>
        )}

        {phase === "finished" && (
          <div className="calibration-results-view">
            <h3>Calibration Results</h3>

            {stats && stats.tapCount >= 2 ? (
              <>
                <div className="calibration-stats-grid">
                  <div className="calibration-stat-card">
                    <span className="stat-label">Recommended Offset</span>
                    <span className="stat-value primary">
                      {candidateLatency > 0
                        ? `+${candidateLatency}`
                        : candidateLatency}{" "}
                      ms
                    </span>
                  </div>
                  <div className="calibration-stat-card">
                    <span className="stat-label">Median Error</span>
                    <span className="stat-value">
                      {stats.medianOffsetMs > 0
                        ? `+${stats.medianOffsetMs}`
                        : stats.medianOffsetMs}{" "}
                      ms
                    </span>
                  </div>
                  <div className="calibration-stat-card">
                    <span className="stat-label">Jitter / Spread</span>
                    <span className="stat-value">±{stats.stdDevMs} ms</span>
                  </div>
                  <div className="calibration-stat-card">
                    <span className="stat-label">Sample Taps</span>
                    <span className="stat-value">{stats.tapCount}</span>
                  </div>
                </div>

                <p className="calibration-explanation">
                  {candidateLatency > 15
                    ? `Your notes register ~${candidateLatency} ms after the beat. Applying +${candidateLatency} ms latency compensation shifts input timing forward so notes evaluate on beat.`
                    : candidateLatency < -15
                      ? `Your notes register ~${Math.abs(candidateLatency)} ms before the beat. Applying ${candidateLatency} ms latency compensation adjusts timing accordingly.`
                      : `Your timing is well-centered (~${candidateLatency} ms). Little to no compensation needed!`}
                </p>
              </>
            ) : (
              <p className="calibration-warning">
                Fewer than 2 taps recorded. Try again and strike a key firmly on
                each metronome beat.
              </p>
            )}

            <div className="calibration-adjust-row">
              <label htmlFor={compensateId}>Adjust Latency (ms):</label>
              <div className="calibration-stepper">
                <button
                  type="button"
                  onClick={() =>
                    setCandidateLatency((l) => Math.max(-500, l - 10))
                  }
                >
                  -10
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCandidateLatency((l) => Math.max(-500, l - 1))
                  }
                >
                  -1
                </button>
                <input
                  id={compensateId}
                  type="number"
                  min={-500}
                  max={500}
                  value={candidateLatency}
                  onChange={(e) =>
                    setCandidateLatency(
                      Math.max(
                        -500,
                        Math.min(500, Number.parseInt(e.target.value, 10) || 0),
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    setCandidateLatency((l) => Math.min(500, l + 1))
                  }
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCandidateLatency((l) => Math.min(500, l + 10))
                  }
                >
                  +10
                </button>
              </div>
            </div>

            <div className="calibration-footer-actions">
              <button
                type="button"
                className="calibration-secondary-btn"
                onClick={() => startCalibration(true)}
              >
                Test With Offset ({candidateLatency} ms)
              </button>
              <button
                type="button"
                className="calibration-secondary-btn"
                onClick={() => setCandidateLatency(0)}
              >
                Reset to 0
              </button>
              <button
                type="button"
                className="calibration-primary-btn"
                onClick={handleSave}
              >
                Save & Apply Calibration
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
