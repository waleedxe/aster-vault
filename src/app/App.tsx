import { useState } from "react";

import { UnlockView } from "../features/unlock/UnlockView";
import { useSettingsStore } from "../stores/settingsStore";
import { AppShell } from "./AppShell";

/**
 * Application root.
 *
 * Phase 0 scaffold: the lock state is local. Phase 4 wires this to the backend
 * (create/unlock/auto-lock) through the typed bridge.
 */
export function App() {
  const [locked, setLocked] = useState(true);
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);

  return (
    <div
      data-reduced-motion={reducedMotion ? "true" : "false"}
      className="h-full bg-porcelain text-ink dark:bg-midnight dark:text-porcelain"
    >
      {locked ? (
        <UnlockView onUnlocked={() => setLocked(false)} />
      ) : (
        <AppShell onLock={() => setLocked(true)} />
      )}
    </div>
  );
}
