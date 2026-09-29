import { create } from "zustand";

export type Language = "en" | "ar";

const LANGUAGE_KEY = "aster-vault.language";

/** Read the persisted language, defaulting to English. */
export function getStoredLanguage(): Language {
  if (typeof localStorage === "undefined") {
    return "en";
  }
  return localStorage.getItem(LANGUAGE_KEY) === "ar" ? "ar" : "en";
}

/** Persist the language. Local only; never a secret. */
export function setStoredLanguage(language: Language): void {
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Storage may be unavailable (private mode); the in-memory setting still works.
  }
}

interface SettingsState {
  language: Language;
  /** Auto-lock after this many minutes of inactivity (0 disables). */
  autoLockMinutes: number;
  /** Seconds before a copied secret is cleared from the clipboard. */
  clipboardClearSeconds: number;
  /** Reduced-motion mode. */
  reducedMotion: boolean;
  setLanguage: (language: Language) => void;
  setAutoLockMinutes: (minutes: number) => void;
  setClipboardClearSeconds: (seconds: number) => void;
  setReducedMotion: (reduced: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: getStoredLanguage(),
  autoLockMinutes: 5,
  clipboardClearSeconds: 30,
  reducedMotion: false,
  setLanguage: (language) => {
    setStoredLanguage(language);
    set({ language });
  },
  setAutoLockMinutes: (autoLockMinutes) => set({ autoLockMinutes }),
  setClipboardClearSeconds: (clipboardClearSeconds) =>
    set({ clipboardClearSeconds }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}));
