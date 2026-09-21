import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultTrainingRequest } from "../../core/training/trainingIntent";
import {
  clearPresets,
  clearSettings,
  deletePreset,
  LEGACY_SETTINGS_KEY,
  loadPresets,
  loadSettings,
  loadStoredSession,
  parseStoredSettings,
  PRESETS_KEY,
  savePreset,
  saveSettings,
  SETTINGS_KEY,
  STORAGE_KEY_PREFIX,
} from "./settingsPersistence";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

describe("settingsPersistence", () => {
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: new MemoryStorage(),
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: originalLocalStorage,
      configurable: true,
      writable: true,
    });
  });

  it("prefixes storage keys with the repository name", () => {
    expect(STORAGE_KEY_PREFIX).toBe("accordion-fingering-practice-midi:");
    expect(SETTINGS_KEY.startsWith("accordion-fingering-practice-midi:")).toBe(true);
    expect(PRESETS_KEY.startsWith("accordion-fingering-practice-midi:")).toBe(true);
  });

  it("parses stored settings from raw or wrapped json and rejects invalid data", () => {
    const settings = defaultTrainingRequest();
    settings.tempoBpm = 96;

    // Direct serialized TrainingRequest
    expect(parseStoredSettings(JSON.stringify(settings))?.tempoBpm).toBe(96);

    // Wrapped in { settings, mode }
    expect(parseStoredSettings(JSON.stringify({ settings, mode: "correction" }))?.tempoBpm).toBe(96);

    // Wrapped in { request, mode }
    expect(parseStoredSettings(JSON.stringify({ request: settings, mode: "sightReading" }))?.tempoBpm).toBe(96);

    // Invalid json or null
    expect(parseStoredSettings("not json")).toBeUndefined();
    expect(parseStoredSettings(null)).toBeUndefined();
    expect(parseStoredSettings("{}")).toBeUndefined();
  });

  it("persists and restores settings and execution mode across sessions without touching URL", () => {
    const settings = defaultTrainingRequest();
    settings.tempoBpm = 112;
    settings.hands = "right";

    saveSettings(settings, "correction");

    // Persisted to prefixed key
    const raw = localStorage.getItem(SETTINGS_KEY);
    expect(raw).toBeTruthy();

    const session = loadStoredSession();
    expect(session.settings.tempoBpm).toBe(112);
    expect(session.settings.hands).toBe("right");
    expect(session.mode).toBe("correction");

    expect(loadSettings().tempoBpm).toBe(112);
  });

  it("falls back to legacy storage key when prefixed key is not yet set", () => {
    const settings = defaultTrainingRequest();
    settings.tempoBpm = 88;
    localStorage.setItem(LEGACY_SETTINGS_KEY, JSON.stringify(settings));

    const session = loadStoredSession();
    expect(session.settings.tempoBpm).toBe(88);
  });

  it("returns default settings and default runtime mode when storage is empty", () => {
    const session = loadStoredSession();
    expect(session.settings.tempoBpm).toBe(72);
    expect(session.mode).toBe("sightReading");
  });

  it("clears stored settings from both prefixed and legacy keys", () => {
    const settings = defaultTrainingRequest();
    saveSettings(settings, "correction");
    localStorage.setItem(LEGACY_SETTINGS_KEY, JSON.stringify(settings));

    clearSettings();
    expect(localStorage.getItem(SETTINGS_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_SETTINGS_KEY)).toBeNull();
  });

  describe("presets system", () => {
    it("has no defaults and starts empty", () => {
      expect(loadPresets()).toEqual([]);
    });

    it("saves and loads multiple user presets", () => {
      const s1 = defaultTrainingRequest();
      s1.tempoBpm = 100;
      s1.hands = "left";

      const s2 = defaultTrainingRequest();
      s2.tempoBpm = 130;
      s2.hands = "both";

      const p1 = savePreset("Left Hand Focus", s1, "correction");
      const p2 = savePreset("Fast Sight Reading", s2, "sightReading");

      const loaded = loadPresets();
      expect(loaded).toHaveLength(2);
      expect(loaded[0]!.id).toBe(p1.id);
      expect(loaded[0]!.name).toBe("Left Hand Focus");
      expect(loaded[0]!.settings.tempoBpm).toBe(100);
      expect(loaded[0]!.settings.hands).toBe("left");
      expect(loaded[0]!.mode).toBe("correction");

      expect(loaded[1]!.id).toBe(p2.id);
      expect(loaded[1]!.name).toBe("Fast Sight Reading");
      expect(loaded[1]!.settings.tempoBpm).toBe(130);
      expect(loaded[1]!.mode).toBe("sightReading");
    });

    it("updates an existing preset when saving with the same name (case-insensitive)", () => {
      const s1 = defaultTrainingRequest();
      s1.tempoBpm = 100;
      const original = savePreset("My Preset", s1, "sightReading");

      const s2 = defaultTrainingRequest();
      s2.tempoBpm = 120;
      const updated = savePreset("my preset", s2, "correction");

      expect(updated.id).toBe(original.id);
      expect(updated.settings.tempoBpm).toBe(120);
      expect(updated.mode).toBe("correction");

      const list = loadPresets();
      expect(list).toHaveLength(1);
      expect(list[0]!.settings.tempoBpm).toBe(120);
    });

    it("deletes a preset by id or name", () => {
      const s = defaultTrainingRequest();
      const p1 = savePreset("Preset A", s);
      savePreset("Preset B", s);

      expect(loadPresets()).toHaveLength(2);

      deletePreset(p1.id);
      const remaining = loadPresets();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]!.name).toBe("Preset B");
    });

    it("clears all presets", () => {
      savePreset("Preset 1", defaultTrainingRequest());
      savePreset("Preset 2", defaultTrainingRequest());
      expect(loadPresets()).toHaveLength(2);

      clearPresets();
      expect(loadPresets()).toEqual([]);
    });

    it("gracefully ignores corrupt entries in presets storage", () => {
      localStorage.setItem(
        PRESETS_KEY,
        JSON.stringify([
          null,
          { id: "bad1" },
          { id: "bad2", name: "Invalid", settings: "not-an-object" },
          { id: "good", name: "Valid Preset", settings: defaultTrainingRequest() },
        ])
      );

      const loaded = loadPresets();
      expect(loaded).toHaveLength(1);
      expect(loaded[0]!.name).toBe("Valid Preset");
    });
  });

it("persists custom timing and recovery preferences in settings and presets",()=>{
 const request=defaultTrainingRequest();request.timing={strictness:"custom",followAfterPause:false,earlyMs:500,lateMs:800,chordMs:175};
 saveSettings(request,"sightReading");expect(loadStoredSession().settings.timing).toEqual(request.timing);
 savePreset("Custom timing",request,"sightReading");expect(loadPresets().find(p=>p.name==="Custom timing")?.settings.timing).toEqual(request.timing);
});

});
