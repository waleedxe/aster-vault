import { useEffect, useState } from "react";

import { OnboardingView } from "../features/onboarding/OnboardingView";
import { UnlockView } from "../features/unlock/UnlockView";
import { vaultExists } from "../lib/tauri";
import { getRememberedVaultPath } from "../lib/paths";
import { useSettingsStore } from "../stores/settingsStore";
import { useVaultStore } from "../stores/vaultStore";
import { AppShell } from "./AppShell";

type Phase = "loading" | "onboarding" | "unlock" | "unlocked";

/** Application root: first-run onboarding, unlock, or the unlocked shell. */
export function App() {
  const [phase, setPhase] = useState<Phase>("loading");
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const init = useVaultStore((state) => state.init);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const path = getRememberedVaultPath();
        if (path && (await vaultExists(path))) {
          await init();
          if (active) setPhase("unlock");
        } else if (active) {
          setPhase("onboarding");
        }
      } catch {
        if (active) setPhase("onboarding");
      }
    })();
    return () => {
      active = false;
    };
  }, [init]);

  const enter = () => {
    void init();
    setPhase("unlocked");
  };

  return (
    <div
      data-reduced-motion={reducedMotion ? "true" : "false"}
      className="h-full bg-porcelain text-ink dark:bg-midnight dark:text-porcelain"
    >
      {phase === "loading" && <div className="h-full" />}
      {phase === "onboarding" && <OnboardingView onComplete={enter} />}
      {phase === "unlock" && <UnlockView onUnlocked={enter} />}
      {phase === "unlocked" && <AppShell onLock={() => setPhase("unlock")} />}
    </div>
  );
}
