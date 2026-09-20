import { emptyAdaptiveProfile, type AdaptiveProfile } from "../../core/training/adaptiveProfile";

const KEY = "accordion-fingering-practice-midi:learning";
const LEGACY_KEY = "accordion-trainer-v3-learning";

const getStorage = (): Storage | undefined => {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    // SecurityError or restricted storage access
  }
  return undefined;
};

export const loadLearningProfile = (): AdaptiveProfile => {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(KEY) ?? storage.getItem(LEGACY_KEY);
      const x = JSON.parse(raw ?? "null") as AdaptiveProfile;
      return x?.version === 1 ? x : emptyAdaptiveProfile();
    } catch {
      return emptyAdaptiveProfile();
    }
  }
  return emptyAdaptiveProfile();
};

export const saveLearningProfile = (profile: AdaptiveProfile) => {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(KEY, JSON.stringify(profile));
    } catch {
      // Ignore storage errors
    }
  }
};
