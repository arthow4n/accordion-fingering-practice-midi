import type { TrainingRequest } from "../../core/training/trainingIntent";
import { STRADELLA_ROOTS } from "../../core/instrument/stradella";
import { IntegerInput } from "./IntegerInput";

export interface AdvancedSettingsSectionProps {
  settings: TrainingRequest;
  onUpdateSettings: (next: TrainingRequest) => void;
}

const bassRoots = STRADELLA_ROOTS;

export function AdvancedSettingsSection({
  settings,
  onUpdateSettings,
}: AdvancedSettingsSectionProps) {
  const leftHand = settings.leftHand;

  return (
    <details>
      <summary>Advanced generation</summary>
      <IntegerInput
        label="Max accidentals"
        value={settings.rightHand.maxAccidentalsPerExercise}
        min={0}
        max={64}
        onCommit={(maxAccidentalsPerExercise) =>
          onUpdateSettings({
            ...settings,
            rightHand: { ...settings.rightHand, maxAccidentalsPerExercise },
          })
        }
      />{" "}
      <label>
        Left jump frequency{" "}
        <select
          value={leftHand.jumpFrequency}
          onChange={(e) =>
            onUpdateSettings({
              ...settings,
              leftHand: {
                ...leftHand,
                jumpFrequency: e.target
                  .value as TrainingRequest["leftHand"]["jumpFrequency"],
              },
            })
          }
        >
          <option value="none">Normal movement</option>
          <option value="occasional">Occasional targeted jumps</option>
          <option value="frequent">Frequent targeted jumps</option>
        </select>
      </label>{" "}
      <label>
        Left jump size{" "}
        <select
          value={leftHand.jumpSize}
          onChange={(e) => {
            const jumpSize = e.target
              .value as TrainingRequest["leftHand"]["jumpSize"];
            const required =
              jumpSize === "nearby"
                ? 1
                : jumpSize === "moderate"
                  ? 3
                  : jumpSize === "large"
                    ? 5
                    : 11;
            onUpdateSettings({
              ...settings,
              measures:
                jumpSize === "veryLarge"
                  ? Math.max(3, settings.measures)
                  : settings.measures,
              leftHand: {
                ...leftHand,
                jumpSize,
                maxJump: Math.max(required, leftHand.maxJump),
              },
            });
          }}
        >
          <option value="nearby">Nearby — 1 column</option>
          <option value="moderate">Moderate — 2–3 columns</option>
          <option value="large">Large — 4–5 columns</option>
          <option value="veryLarge">Very large — 6+ columns</option>
        </select>
      </label>{" "}
      <IntegerInput
        label="Left maximum"
        value={leftHand.maxJump}
        min={
          leftHand.jumpFrequency === "none"
            ? 0
            : leftHand.jumpSize === "nearby"
              ? 1
              : leftHand.jumpSize === "moderate"
                ? 2
                : leftHand.jumpSize === "large"
                  ? 4
                  : 6
        }
        max={11}
        onCommit={(maxJump) =>
          onUpdateSettings({
            ...settings,
            leftHand: { ...leftHand, maxJump },
          })
        }
      />{" "}
      <label>
        Bass low{" "}
        <select
          value={leftHand.bassRootLow}
          onChange={(e) => {
            const bassRootLow = e.target
              .value as TrainingRequest["leftHand"]["bassRootLow"];
            const bassRootHigh =
              bassRoots.indexOf(bassRootLow) >
              bassRoots.indexOf(leftHand.bassRootHigh)
                ? bassRootLow
                : leftHand.bassRootHigh;
            onUpdateSettings({
              ...settings,
              leftHand: { ...leftHand, bassRootLow, bassRootHigh },
            });
          }}
        >
          {bassRoots.map((root) => (
            <option key={root}>{root}</option>
          ))}
        </select>
      </label>{" "}
      <label>
        Bass high{" "}
        <select
          value={leftHand.bassRootHigh}
          onChange={(e) => {
            const bassRootHigh = e.target
              .value as TrainingRequest["leftHand"]["bassRootHigh"];
            const bassRootLow =
              bassRoots.indexOf(bassRootHigh) <
              bassRoots.indexOf(leftHand.bassRootLow)
                ? bassRootHigh
                : leftHand.bassRootLow;
            onUpdateSettings({
              ...settings,
              leftHand: { ...leftHand, bassRootLow, bassRootHigh },
            });
          }}
        >
          {bassRoots.map((root) => (
            <option key={root}>{root}</option>
          ))}
        </select>
      </label>
    </details>
  );
}
