import { useState } from "react";
import {
  deletePreset,
  loadPresets,
  savePreset,
  type ConfigPreset,
  type RuntimeMode,
} from "../../adapters/persistence/settingsPersistence";
import {
  defaultRuntimeMode,
  type TrainingRequest,
} from "../../core/training/trainingIntent";

export function usePresets(
  settings: TrainingRequest,
  mode: RuntimeMode,
  updateSettings: (
    raw: TrainingRequest,
    persist?: boolean,
    nextMode?: RuntimeMode,
  ) => boolean,
) {
  const [presets, setPresets] = useState<ConfigPreset[]>(() => loadPresets());
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [presetDraft, setPresetDraft] = useState<string>("");

  const handleSelectPreset = (id: string) => {
    setSelectedPresetId(id);
    const target = presets.find((p) => p.id === id);
    if (target) {
      setPresetDraft(target.name);
    }
  };

  const handleSavePreset = () => {
    const name = presetDraft.trim() || `Preset ${presets.length + 1}`;
    const saved = savePreset(name, settings, mode);
    const updated = loadPresets();
    setPresets(updated);
    setSelectedPresetId(saved.id);
    setPresetDraft(saved.name);
  };

  const handleLoadPreset = () => {
    const target = presets.find((p) => p.id === selectedPresetId);
    if (!target) return;
    const targetMode = target.mode ?? defaultRuntimeMode();
    updateSettings(target.settings, true, targetMode);
    setPresetDraft(target.name);
  };

  const handleDeletePreset = () => {
    if (!selectedPresetId) return;
    deletePreset(selectedPresetId);
    const updated = loadPresets();
    setPresets(updated);
    setSelectedPresetId("");
    setPresetDraft("");
  };

  return {
    presets,
    selectedPresetId,
    presetDraft,
    setPresetDraft,
    handleSelectPreset,
    handleSavePreset,
    handleLoadPreset,
    handleDeletePreset,
  };
}
