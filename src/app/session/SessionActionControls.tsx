import type { RuntimeMode } from "../../adapters/persistence/settingsPersistence";
import type { SightReadingStatus } from "../../application/sightReadingCoordinator";

export interface SessionActionControlsProps {
  mode: RuntimeMode;
  status: SightReadingStatus;
  seed: number;
  onFinish: () => void;
  onRegenerate: (
    newSeed?: number,
    preserveMetrics?: boolean,
    retry?: boolean,
  ) => void;
  onOpenCalibration?: () => void;
}

export function SessionActionControls({
  mode,
  status,
  seed,
  onFinish,
  onRegenerate,
  onOpenCalibration,
}: SessionActionControlsProps) {
  const toggleFullScreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen({ navigationUI: "hide" });
    }
  };

  return (
    <p>
      {mode === "sightReading" && status === "playing" && (
        <>
          <button type="button" onClick={onFinish}>
            Finish exercise
          </button>{" "}
        </>
      )}
      <button type="button" onClick={() => onRegenerate()}>
        New exercise
      </button>{" "}
      <button type="button" onClick={() => onRegenerate(seed, false, false)}>
        Replay seed
      </button>{" "}
      {onOpenCalibration && (
        <>
          <button type="button" onClick={onOpenCalibration}>
            Calibrate latency
          </button>{" "}
        </>
      )}
      <button type="button" onClick={toggleFullScreen}>
        Full screen
      </button>
    </p>
  );
}
