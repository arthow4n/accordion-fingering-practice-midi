import { Note } from "tonal";
import type {
  ConfigPreset,
  RuntimeMode,
} from "../../adapters/persistence/settingsPersistence";
import type { RightHandEmphasis } from "../../core/model";
import { registerForSeed } from "../../core/generation/pitchRegister";
import {
  accompanimentOptionLabel,
  accompanimentStylesForMeter,
} from "../../core/patterns/accompanimentTemplates";
import { timingOptions } from "../../core/performance/timingSettings";
import type { TrainingRequest } from "../../core/training/trainingIntent";
import { AdvancedSettingsSection } from "./AdvancedSettingsSection";
import { IntegerInput } from "./IntegerInput";
import { PresetControls } from "./PresetControls";

type HandMode = TrainingRequest["hands"];

export interface PracticeSettingsFormProps {
  settings: TrainingRequest;
  mode: RuntimeMode;
  seed: number;
  tempoBpm: number;
  presets: ConfigPreset[];
  selectedPresetId: string;
  presetDraft: string;
  onUpdateSettings: (next: TrainingRequest) => void;
  onUpdateTiming: (timing: TrainingRequest["timing"]) => void;
  onChangeMode: (mode: RuntimeMode) => void;
  onResetSettings: () => void;
  onSelectPreset: (id: string) => void;
  onPresetDraftChange: (draft: string) => void;
  onLoadPreset: () => void;
  onSavePreset: () => void;
  onDeletePreset: () => void;
  onOpenCalibration?: () => void;
}

const emphasisOptions: readonly { value: RightHandEmphasis; label: string }[] =
  [
    { value: "everything", label: "Everything" },
    { value: "melodicPatterns", label: "Melodic patterns" },
    { value: "intervals", label: "Intervals" },
    { value: "arpeggios", label: "Arpeggios" },
    { value: "cadencesApproaches", label: "Cadences & approaches" },
    { value: "rhythm", label: "Rhythm" },
  ];

const keys = [
  "C major",
  "G major",
  "D major",
  "F major",
  "Bb major",
  "Eb major",
  "A minor",
  "D minor",
  "E minor",
];

const bassPatterns: readonly TrainingRequest["leftHand"]["accompanimentStyle"][] =
  ["bassChord", "alternatingBass", "polka", "waltz", "tango", "swing"];

const legacyLines = [
  {
    id: "legacy-tonic-pedal-descending",
    label: "Tonic pedal: C/C–C/B–C/A–C/G",
  },
  { id: "legacy-transition-to-IV", label: "Counterbass walk: C/C–C/D–C/E–F" },
  { id: "legacy-bb-fdim-line", label: "Bb–Fdim/B–Fdim/G–Fdim/G–F/C–D7" },
] as const;

const noteValues = [
  { value: "half", label: "Half notes" },
  { value: "quarter", label: "Quarter notes" },
  { value: "eighth", label: "Eighth notes" },
  { value: "sixteenth", label: "Sixteenth notes" },
] as const;

const rhythmStyles = [
  { value: "steady", label: "Steady — selected value only" },
  { value: "mostlySteady", label: "Mostly steady — occasional longer notes" },
  { value: "mixed", label: "Mixed — varied note values" },
  { value: "challenge", label: "Rhythm challenge — dotted and syncopated" },
] as const;

const rhythmLegacyValues = (
  noteValue: TrainingRequest["rhythm"]["noteValue"],
  style: TrainingRequest["rhythm"]["style"],
) => ({
  smallestSubdivision:
    noteValue === "sixteenth"
      ? ("sixteenth" as const)
      : noteValue === "eighth"
        ? ("eighth" as const)
        : ("quarter" as const),
  noteDensity:
    style === "steady"
      ? noteValue === "sixteenth"
        ? 1
        : noteValue === "eighth"
          ? 0.55
          : 0.3
      : style === "mostlySteady"
        ? 0.55
        : style === "challenge"
          ? 0.85
          : 0.65,
});

export function PracticeSettingsForm({
  settings,
  mode,
  seed,
  tempoBpm,
  presets,
  selectedPresetId,
  presetDraft,
  onUpdateSettings,
  onUpdateTiming,
  onChangeMode,
  onResetSettings,
  onSelectPreset,
  onPresetDraftChange,
  onLoadPreset,
  onSavePreset,
  onDeletePreset,
  onOpenCalibration,
}: PracticeSettingsFormProps) {
  const currentMeter = settings.rhythm.meters[0]!;
  const tolerance = timingOptions(settings.timing, tempoBpm);

  return (
    <fieldset>
      <legend>Practice settings</legend>
      <label>
        Hands{" "}
        <select
          value={settings.hands}
          onChange={(e) =>
            onUpdateSettings({
              ...settings,
              hands: e.target.value as HandMode,
              leftHand: {
                ...settings.leftHand,
                enabled: true,
                templateId:
                  e.target.value === "right"
                    ? undefined
                    : settings.leftHand.templateId,
              },
            })
          }
        >
          <option value="both">Both</option>
          <option value="right">Right hand only</option>
          <option value="left">Left hand only</option>
        </select>
      </label>{" "}
      <label>
        Practice behavior{" "}
        <select
          value={mode}
          onChange={(e) => onChangeMode(e.target.value as RuntimeMode)}
        >
          <option value="sightReading">Timed sight-reading</option>
          <option value="correction">Correction / drill</option>
        </select>
      </label>{" "}
      <label>
        Right-hand emphasis{" "}
        <select
          value={settings.emphasis}
          onChange={(e) =>
            onUpdateSettings({
              ...settings,
              emphasis: e.target.value as RightHandEmphasis,
            })
          }
        >
          {emphasisOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>{" "}
      <label>
        Key{" "}
        <select
          value={
            settings.tonal.keys.length === 1 ? settings.tonal.keys[0] : "pool"
          }
          onChange={(e) =>
            onUpdateSettings({
              ...settings,
              tonal: {
                ...settings.tonal,
                keys:
                  e.target.value === "pool"
                    ? ["C major", "G major", "D major", "F major"]
                    : [e.target.value],
                selection: e.target.value === "pool" ? "random" : "fixed",
              },
            })
          }
        >
          <option value="pool">Easy key pool</option>
          {keys.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>{" "}
      <label>
        Pitch range{" "}
        <select
          value={settings.pitchRegister}
          onChange={(e) =>
            onUpdateSettings({
              ...settings,
              pitchRegister: e.target.value as TrainingRequest["pitchRegister"],
            })
          }
        >
          <option value="rotating">Full range — rotating</option>
          <option value="low">Low (G3–G4)</option>
          <option value="middle">Middle (G4–G5)</option>
          <option value="high">High (G5–G6)</option>
          <option value="custom">Custom</option>
        </select>
      </label>{" "}
      {settings.pitchRegister === "rotating" && (
        <span className="register-indicator">
          Register: <strong>{registerForSeed(seed)}</strong>
        </span>
      )}{" "}
      {settings.pitchRegister === "custom" &&
        (["low", "high"] as const).map((bound) => (
          <label key={bound}>
            {bound === "low" ? "Lowest note" : "Highest note"}{" "}
            <select
              value={settings.rightHand.range[bound]}
              onChange={(e) => {
                const value = Number(e.target.value);
                const range = { ...settings.rightHand.range, [bound]: value };
                if (bound === "low") range.high = Math.max(value, range.high);
                else range.low = Math.min(value, range.low);
                onUpdateSettings({
                  ...settings,
                  rightHand: { ...settings.rightHand, range },
                });
              }}
            >
              {Array.from({ length: 37 }, (_, i) => i + 55).map((midi) => (
                <option key={midi} value={midi}>
                  {Note.fromMidi(midi)}
                </option>
              ))}
            </select>
          </label>
        ))}{" "}
      <label>
        Time signature{" "}
        <select
          value={`${currentMeter.beats}/${currentMeter.beatUnit}`}
          onChange={(e) => {
            const [beats, beatUnit] = e.target.value.split("/").map(Number);
            const meter = { beats, beatUnit: beatUnit as 4 | 8 };
            const styles = accompanimentStylesForMeter(meter);
            const accompanimentStyle = styles.includes(
              settings.leftHand.accompanimentStyle,
            )
              ? settings.leftHand.accompanimentStyle
              : "bassChord";
            const noteValue =
              beats === 3 && settings.rhythm.noteValue === "half"
                ? "quarter"
                : settings.rhythm.noteValue;
            onUpdateSettings({
              ...settings,
              rhythm: {
                ...settings.rhythm,
                ...rhythmLegacyValues(noteValue, settings.rhythm.style),
                noteValue,
                meters: [meter],
              },
              leftHand: {
                ...settings.leftHand,
                accompanimentStyle,
                templateId: undefined,
              },
            });
          }}
        >
          <option value="3/4">3/4</option>
          <option value="4/4">4/4</option>
        </select>
      </label>{" "}
      <IntegerInput
        label="Tempo"
        value={settings.tempoBpm}
        min={30}
        max={240}
        onCommit={(tempoBpm) => onUpdateSettings({ ...settings, tempoBpm })}
      />{" "}
      <label>
        Note value{" "}
        <select
          value={settings.rhythm.noteValue}
          onChange={(e) => {
            const noteValue = e.target
              .value as TrainingRequest["rhythm"]["noteValue"];
            onUpdateSettings({
              ...settings,
              rhythm: {
                ...settings.rhythm,
                ...rhythmLegacyValues(noteValue, settings.rhythm.style),
                noteValue,
              },
            });
          }}
        >
          {noteValues.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.value === "half" && currentMeter.beats === 3}
            >
              {option.label}
            </option>
          ))}
        </select>
      </label>{" "}
      <label>
        Rhythm style{" "}
        <select
          value={settings.rhythm.style}
          onChange={(e) => {
            const style = e.target.value as TrainingRequest["rhythm"]["style"];
            onUpdateSettings({
              ...settings,
              rhythm: {
                ...settings.rhythm,
                ...rhythmLegacyValues(settings.rhythm.noteValue, style),
                style,
              },
            });
          }}
        >
          {rhythmStyles.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>{" "}
      <label>
        Timing strictness{" "}
        <select
          value={settings.timing.strictness}
          onChange={(e) =>
            onUpdateTiming({
              ...settings.timing,
              strictness: e.target
                .value as TrainingRequest["timing"]["strictness"],
            })
          }
        >
          <option value="veryForgiving">Very forgiving</option>
          <option value="balanced">Balanced</option>
          <option value="strict">Strict</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      {settings.timing.strictness === "custom" && (
        <>
          {(["earlyMs", "lateMs", "chordMs"] as const).map((field) => (
            <IntegerInput
              key={field}
              label={
                field === "earlyMs"
                  ? "Early allowance (ms)"
                  : field === "lateMs"
                    ? "Late allowance (ms)"
                    : "Chord spread (ms)"
              }
              value={settings.timing[field]}
              min={field === "chordMs" ? 20 : 30}
              max={field === "chordMs" ? 500 : 2000}
              onCommit={(value) =>
                onUpdateTiming({ ...settings.timing, [field]: value })
              }
            />
          ))}
        </>
      )}
      <IntegerInput
        label="Latency offset (ms)"
        value={settings.timing.latencyMs ?? 0}
        min={-500}
        max={500}
        onCommit={(value) =>
          onUpdateTiming({ ...settings.timing, latencyMs: value })
        }
      />
      {onOpenCalibration && (
        <>
          {" "}
          <button type="button" onClick={onOpenCalibration}>
            Calibrate latency...
          </button>
        </>
      )}
      <p>
        Timed practice accepts up to {Math.round(tolerance.correctEarlyMs!)} ms
        early or {Math.round(tolerance.correctLateMs!)} ms late as on time.
        Chord spread: {Math.round(tolerance.simultaneityWindowMs)} ms.
        {(settings.timing.latencyMs ?? 0) !== 0 && (
          <>
            {" "}
            Latency compensation:{" "}
            {(settings.timing.latencyMs ?? 0) > 0
              ? `+${settings.timing.latencyMs}`
              : settings.timing.latencyMs}{" "}
            ms.
          </>
        )}{" "}
        The clock keeps its continuous pulse through mistakes and pauses.
      </p>
      <IntegerInput
        label="Measures"
        value={settings.measures}
        min={2}
        max={32}
        onCommit={(measures) => onUpdateSettings({ ...settings, measures })}
      />{" "}
      <label>
        Bass pattern{" "}
        <select
          value={settings.leftHand.accompanimentStyle}
          onChange={(e) =>
            onUpdateSettings({
              ...settings,
              leftHand: {
                ...settings.leftHand,
                enabled: true,
                accompanimentStyle: e.target
                  .value as TrainingRequest["leftHand"]["accompanimentStyle"],
                templateId: undefined,
              },
            })
          }
        >
          {bassPatterns
            .filter((pattern) =>
              accompanimentStylesForMeter(currentMeter).includes(pattern),
            )
            .map((pattern) => (
              <option key={pattern} value={pattern}>
                {accompanimentOptionLabel(pattern, currentMeter)}
              </option>
            ))}
        </select>
      </label>{" "}
      <label>
        Curated bass exercise{" "}
        <select
          value={settings.leftHand.templateId ?? ""}
          onChange={(e) => {
            const templateId = e.target.value || undefined;
            const isBb = templateId === "legacy-bb-fdim-line";
            const noteValue =
              templateId && settings.rhythm.noteValue === "half"
                ? "quarter"
                : settings.rhythm.noteValue;
            onUpdateSettings({
              ...settings,
              measures: templateId ? (isBb ? 6 : 4) : settings.measures,
              tonal: isBb
                ? { ...settings.tonal, keys: ["Bb major"], selection: "fixed" }
                : settings.tonal,
              rhythm: templateId
                ? {
                    ...settings.rhythm,
                    ...rhythmLegacyValues(noteValue, settings.rhythm.style),
                    noteValue,
                    meters: [{ beats: 3, beatUnit: 4 }],
                  }
                : settings.rhythm,
              leftHand: {
                ...settings.leftHand,
                enabled: true,
                accompanimentStyle: "polka",
                templateId:
                  templateId as TrainingRequest["leftHand"]["templateId"],
              },
            });
          }}
        >
          <option value="">None</option>
          {legacyLines.map((line) => (
            <option key={line.id} value={line.id}>
              {line.label}
            </option>
          ))}
        </select>
      </label>{" "}
      <button type="button" onClick={onResetSettings}>
        Reset settings
      </button>
      <PresetControls
        presets={presets}
        selectedPresetId={selectedPresetId}
        presetDraft={presetDraft}
        onSelectPreset={onSelectPreset}
        onDraftChange={onPresetDraftChange}
        onLoadPreset={onLoadPreset}
        onSavePreset={onSavePreset}
        onDeletePreset={onDeletePreset}
      />
      <AdvancedSettingsSection
        settings={settings}
        onUpdateSettings={onUpdateSettings}
      />
    </fieldset>
  );
}
