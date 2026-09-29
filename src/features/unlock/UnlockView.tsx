import { useState } from "react";
import { useTranslation } from "react-i18next";

import { LanguageSwitcher } from "../../components/common/LanguageSwitcher";

interface UnlockViewProps {
  onUnlocked: () => void;
}

/**
 * Unlock screen.
 *
 * Phase 0 scaffold: this does not yet perform real key derivation. Phase 4 wires
 * it to `vault_core::unlock_with_password` / `unlock_with_recovery_key` through
 * the typed bridge. It intentionally performs no password handling yet.
 */
export function UnlockView({ onUnlocked }: UnlockViewProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-vault border border-mist bg-white/60 p-8 shadow-sm dark:border-navy dark:bg-navy/40">
        <div className="mb-6 flex items-start justify-between">
          <span
            aria-hidden="true"
            className="inline-block h-10 w-10 rounded-[10px] bg-emerald"
          />
          <LanguageSwitcher />
        </div>

        <h1 className="text-2xl font-semibold">{t("lock.title")}</h1>
        <p className="mt-2 text-sm text-muted">{t("lock.subtitle")}</p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            // Placeholder: real unlock arrives in Phase 4.
            onUnlocked();
          }}
        >
          <div>
            <label htmlFor="credential" className="block text-sm font-medium">
              {useRecovery ? t("lock.recoveryKey") : t("lock.masterPassword")}
            </label>
            <input
              id="credential"
              type={revealed ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="off"
              className="mt-1 w-full rounded-vault border border-mist bg-transparent px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-emerald dark:border-navy"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={revealed}
              onChange={(event) => setRevealed(event.target.checked)}
            />
            {revealed ? t("lock.hide") : t("lock.reveal")}
          </label>

          <button
            type="submit"
            className="min-h-11 w-full rounded-vault bg-emerald px-4 py-2 font-medium text-white focus-visible:outline-2 focus-visible:outline-emerald"
          >
            {t("lock.unlock")}
          </button>

          <button
            type="button"
            onClick={() => setUseRecovery((value) => !value)}
            className="w-full text-center text-sm text-muted underline hover:text-ink dark:hover:text-porcelain"
          >
            {t("lock.useRecoveryKey")}
          </button>
        </form>
      </div>
    </div>
  );
}
