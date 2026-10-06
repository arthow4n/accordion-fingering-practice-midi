import { useCallback, useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { applyUpdate } from "../adapters/pwa/pwaService";
import { exerciseDiagnostics } from "../core/generation/diagnostics";
import { AppFooter } from "./pwa/AppFooter";
import { UpdateBanner } from "./pwa/UpdateBanner";
import { ScoreDisplay } from "./session/ScoreDisplay";
import { SessionActionControls } from "./session/SessionActionControls";
import { SessionStatusBar } from "./session/SessionStatusBar";
import { usePracticeSessionController } from "./session/usePracticeSessionController";
import { PracticeSettingsForm } from "./settings/PracticeSettingsForm";
import { usePresets } from "./settings/usePresets";
import { LatencyCalibrationModal } from "./calibration/LatencyCalibrationModal";

export default function App() {
  const [swRegistration, setSwRegistration] = useState<
    ServiceWorkerRegistration | undefined
  >();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, r) {
      if (r) setSwRegistration(r);
    },
    onRegisterError(error) {
      console.error("SW registration error", error);
    },
  });

  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistration()
        .then((r) => {
          if (r) setSwRegistration(r);
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
      return;
    let refreshing = false;
    const onControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );
    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  const handleApplyUpdate = useCallback(async () => {
    await applyUpdate(swRegistration, updateServiceWorker);
  }, [swRegistration, updateServiceWorker]);

  const controller = usePracticeSessionController();
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const presets = usePresets(
    controller.settings,
    controller.mode,
    controller.updateSettings,
  );

  return (
    <main>
      <UpdateBanner
        show={needRefresh}
        onUpdate={handleApplyUpdate}
        onDismiss={() => setNeedRefresh(false)}
      />

      <ScoreDisplay
        exercise={controller.exercise}
        markedOnset={controller.markedOnset}
        reviewAnnotations={controller.reviewAnnotations}
        status={controller.status}
      />

      <SessionStatusBar
        exercise={controller.exercise}
        settings={controller.settings}
        mode={controller.mode}
        status={controller.status}
        waiting={controller.waiting}
        hasLeft={controller.hasLeft}
        sessionStats={controller.sessionStats}
        metrics={controller.metrics}
        generationError={controller.generationError}
        settingsPendingScore={controller.settingsPendingScore}
      />

      <SessionActionControls
        mode={controller.mode}
        status={controller.status}
        seed={controller.seed}
        onFinish={controller.finish}
        onRegenerate={controller.regenerate}
        onOpenCalibration={() => setIsCalibrationOpen(true)}
      />

      <PracticeSettingsForm
        settings={controller.settings}
        mode={controller.mode}
        seed={controller.seed}
        tempoBpm={controller.exercise.tempoBpm}
        presets={presets.presets}
        selectedPresetId={presets.selectedPresetId}
        presetDraft={presets.presetDraft}
        onUpdateSettings={controller.updateSettings}
        onUpdateTiming={controller.updateTiming}
        onChangeMode={controller.changeMode}
        onResetSettings={controller.resetToDefaults}
        onSelectPreset={presets.handleSelectPreset}
        onPresetDraftChange={presets.setPresetDraft}
        onLoadPreset={presets.handleLoadPreset}
        onSavePreset={presets.handleSavePreset}
        onDeletePreset={presets.handleDeletePreset}
        onOpenCalibration={() => setIsCalibrationOpen(true)}
      />

      <LatencyCalibrationModal
        isOpen={isCalibrationOpen}
        onClose={() => setIsCalibrationOpen(false)}
        currentLatencyMs={controller.settings.timing.latencyMs ?? 0}
        onSaveLatency={controller.updateLatency}
        onRegisterMidiListener={controller.registerCalibrationListener}
      />

      <details>
        <summary>Generator diagnostics</summary>
        <pre>{exerciseDiagnostics(controller.exercise)}</pre>
      </details>

      <p>
        Detected MIDI:{" "}
        {controller.devices.join(", ") ||
          controller.midiError ||
          "none (you can still inspect generated scores)"}
      </p>

      <AppFooter
        registration={swRegistration}
        needRefresh={needRefresh}
        onUpdateDetected={() => setNeedRefresh(true)}
        onApplyUpdate={handleApplyUpdate}
      />
    </main>
  );
}
