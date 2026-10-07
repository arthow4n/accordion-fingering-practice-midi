import { useState } from "react";

export interface IntegerInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}

export function IntegerInput({
  label,
  value,
  min,
  max,
  onCommit,
}: IntegerInputProps) {
  const [prevValue, setPrevValue] = useState(value);
  const [draft, setDraft] = useState(String(value));

  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(String(value));
  }

  const commit = () => {
    const parsed = /^\d+$/.test(draft) ? Number(draft) : NaN;
    if (Number.isInteger(parsed) && parsed >= min && parsed <= max) {
      onCommit(parsed);
    } else {
      setDraft(String(value));
    }
  };

  return (
    <label>
      {label}{" "}
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}
