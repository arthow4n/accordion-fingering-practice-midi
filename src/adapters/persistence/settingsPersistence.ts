import { defaultRuntimeMode, defaultTrainingRequest, parseTrainingRequest, type TrainingRequest } from "../../core/training/trainingIntent";

export type RuntimeMode = "correction" | "sightReading";

export const STORAGE_KEY_PREFIX = "accordion-fingering-practice-midi:";
export const SETTINGS_KEY = `${STORAGE_KEY_PREFIX}settings`;
export const PRESETS_KEY = `${STORAGE_KEY_PREFIX}presets`;
export const LEGACY_SETTINGS_KEY = "accordion-trainer-v3-settings";

export interface StoredSession {
  settings: TrainingRequest;
  mode: RuntimeMode;
}

export interface ConfigPreset {
  id: string;
  name: string;
  settings: TrainingRequest;
  mode?: RuntimeMode;
  updatedAt: number;
}

const getStorage = (): Storage | undefined => {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    // SecurityError or restricted storage access
  }
  return undefined;
};

export const parseStoredSettings = (value: string | null): TrainingRequest | undefined => {
  if (!value) return undefined;
  try {
    const raw = JSON.parse(value);
    if (raw && typeof raw === "object") {
      if ("settings" in raw && raw.settings) {
        return parseTrainingRequest(raw.settings);
      }
      if ("request" in raw && raw.request) {
        return parseTrainingRequest(raw.request);
      }
      return parseTrainingRequest(raw);
    }
    return undefined;
  } catch {
    return undefined;
  }
};

export const parseStoredSession = (value: string | null): StoredSession | undefined => {
  if (!value) return undefined;
  try {
    const raw = JSON.parse(value);
    if (raw && typeof raw === "object") {
      const settings = ("settings" in raw && raw.settings)
        ? parseTrainingRequest(raw.settings)
        : ("request" in raw && raw.request)
          ? parseTrainingRequest(raw.request)
          : parseTrainingRequest(raw);
      const rawMode = ("mode" in raw && typeof raw.mode === "string") ? raw.mode : undefined;
      const mode: RuntimeMode = (rawMode === "correction" || rawMode === "sightReading")
        ? rawMode
        : defaultRuntimeMode(settings.intent);
      return { settings, mode };
    }
    return undefined;
  } catch {
    return undefined;
  }
};

export const loadStoredSession = (): StoredSession => {
  const storage = getStorage();
  if (storage) {
    try {
      const stored = storage.getItem(SETTINGS_KEY) ?? storage.getItem(LEGACY_SETTINGS_KEY);
      const parsed = parseStoredSession(stored);
      if (parsed) return parsed;
    } catch {
      // Ignore storage errors
    }
  }
  const settings = defaultTrainingRequest();
  return { settings, mode: defaultRuntimeMode(settings.intent) };
};

export const loadSettings = (): TrainingRequest => loadStoredSession().settings;

export const saveSettings = (request: TrainingRequest, mode?: RuntimeMode): void => {
  const storage = getStorage();
  if (!storage) return;
  try {
    const parsed = parseTrainingRequest(request);
    const resolvedMode = mode ?? defaultRuntimeMode(parsed.intent);
    const payload: StoredSession = { settings: parsed, mode: resolvedMode };
    storage.setItem(SETTINGS_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage errors
  }
};

export const clearSettings = (): void => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(SETTINGS_KEY);
    storage.removeItem(LEGACY_SETTINGS_KEY);
  } catch {
    // Ignore storage errors
  }
};

export const loadPresets = (): ConfigPreset[] => {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: ConfigPreset[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : undefined;
      const name = typeof item.name === "string" && item.name.trim() ? item.name.trim() : undefined;
      if (!id || !name) continue;
      try {
        const settings = parseTrainingRequest(item.settings);
        const mode: RuntimeMode | undefined =
          item.mode === "correction" || item.mode === "sightReading" ? item.mode : undefined;
        const updatedAt = typeof item.updatedAt === "number" ? item.updatedAt : Date.now();
        valid.push({ id, name, settings, mode, updatedAt });
      } catch {
        // Skip invalid preset
      }
    }
    return valid;
  } catch {
    return [];
  }
};

export const savePreset = (name: string, request: TrainingRequest, mode?: RuntimeMode): ConfigPreset => {
  const presets = loadPresets();
  const trimmedName = name.trim() || `Preset ${presets.length + 1}`;
  const parsed = parseTrainingRequest(request);
  const resolvedMode: RuntimeMode = mode ?? defaultRuntimeMode(parsed.intent);
  const existingIndex = presets.findIndex((p) => p.name.toLowerCase() === trimmedName.toLowerCase());
  const now = Date.now();
  let saved: ConfigPreset;
  if (existingIndex >= 0) {
    saved = {
      ...presets[existingIndex],
      name: trimmedName,
      settings: parsed,
      mode: resolvedMode,
      updatedAt: now,
    };
    presets[existingIndex] = saved;
  } else {
    const id = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
      ? crypto.randomUUID()
      : `preset-${now}-${Math.random().toString(36).slice(2, 8)}`;
    saved = {
      id,
      name: trimmedName,
      settings: parsed,
      mode: resolvedMode,
      updatedAt: now,
    };
    presets.push(saved);
  }
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(PRESETS_KEY, JSON.stringify(presets));
    } catch {
      // Ignore storage errors
    }
  }
  return saved;
};

export const deletePreset = (id: string): void => {
  const presets = loadPresets();
  const filtered = presets.filter((p) => p.id !== id && p.name !== id);
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(PRESETS_KEY, JSON.stringify(filtered));
    } catch {
      // Ignore storage errors
    }
  }
};

export const clearPresets = (): void => {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(PRESETS_KEY);
    } catch {
      // Ignore storage errors
    }
  }
};
