import type { ConfigPreset } from "../../adapters/persistence/settingsPersistence";

export interface PresetControlsProps {
  presets: ConfigPreset[];
  selectedPresetId: string;
  presetDraft: string;
  onSelectPreset: (id: string) => void;
  onDraftChange: (name: string) => void;
  onLoadPreset: () => void;
  onSavePreset: () => void;
  onDeletePreset: () => void;
}

export function PresetControls({
  presets,
  selectedPresetId,
  presetDraft,
  onSelectPreset,
  onDraftChange,
  onLoadPreset,
  onSavePreset,
  onDeletePreset,
}: PresetControlsProps) {
  return (
    <div className="preset-controls">
      <label>
        Preset{" "}
        <select
          aria-label="Saved presets"
          value={selectedPresetId}
          onChange={(e) => onSelectPreset(e.target.value)}
        >
          <option value="">
            {presets.length === 0 ? "(No saved presets)" : "Select preset…"}
          </option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>{" "}
      <button type="button" onClick={onLoadPreset} disabled={!selectedPresetId}>
        Load
      </button>{" "}
      <input
        type="text"
        placeholder="Preset name"
        aria-label="Preset name"
        value={presetDraft}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSavePreset();
          }
        }}
      />{" "}
      <button type="button" onClick={onSavePreset}>
        Save preset
      </button>{" "}
      <button
        type="button"
        onClick={onDeletePreset}
        disabled={!selectedPresetId}
      >
        Delete
      </button>
    </div>
  );
}
