import { create } from "zustand";

export type ThemeMode = "system" | "light" | "dark";

const THEME_KEY = "aster-vault.theme";

/** Read the persisted theme choice, defaulting to following the OS. */
export function getStoredTheme(): ThemeMode {
  if (typeof localStorage === "undefined") return "system";
  const value = localStorage.getItem(THEME_KEY);
  return value === "light" || value === "dark" ? value : "system";
}

/** Resolve the effective theme for a mode using the OS preference. */
export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode !== "system") return mode;
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

/** Apply the resolved theme to the document root. */
export function applyTheme(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(
    "dark",
    resolveTheme(mode) === "dark",
  );
}

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: getStoredTheme(),
  setMode: (mode) => {
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch {
      // ignore storage failures
    }
    applyTheme(mode);
    set({ mode });
  },
  toggle: () => {
    const next = resolveTheme(get().mode) === "dark" ? "light" : "dark";
    get().setMode(next);
  },
}));

// Apply on load.
applyTheme(getStoredTheme());
