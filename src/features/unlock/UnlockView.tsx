import { useState } from "react";
import { useTranslation } from "react-i18next";

import { LanguageSwitcher } from "../../components/common/LanguageSwitcher";
import * as api from "../../lib/tauri";
import {
  getRememberedVaultPath,
  pickExistingVault,
  rememberVaultPath,
} from "../../lib/paths";

/** Unlock screen, wired to the real backend. */
export function UnlockView({ onUnlocked }: { onUnlocked: () => void }) {
  const { t } = useTranslation();
  const [path, setPath] = useState<string>(getRememberedVaultPath() ?? "");
  const [credential, setCredential] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const chooseFile = async () => {
    const chosen = await pickExistingVault();
    if (chosen) {
      setPath(chosen);
      rememberVaultPath(chosen);
    }
  };

  const unlock = async () => {
    setError(null);
    if (!path) {
      setError(t("lock.chooseDifferent"));
      return;
    }
    setBusy(true);
    try {
      if (useRecovery) {
        await api.unlockVaultWithRecovery(path, credential);
      } else {
        await api.unlockVault(path, credential);
      }
      setCredential("");
      onUnlocked();
    } catch {
      setError(t("lock.failed"));
    } finally {
      setBusy(false);
    }
  };

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

        <div className="mt-4 flex gap-2">
          <input
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder={t("onboarding.location")}
            className="w-full rounded-vault border border-mist bg-transparent px-3 py-2 text-sm dark:border-navy"
          />
          <button
            type="button"
            onClick={() => void chooseFile()}
            className="shrink-0 rounded-vault border border-mist px-3 text-sm dark:border-navy"
          >
            {t("onboarding.browse")}
          </button>
        </div>

        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void unlock();
          }}
        >
          <div>
            <label htmlFor="credential" className="block text-sm font-medium">
              {useRecovery ? t("lock.recoveryKey") : t("lock.masterPassword")}
            </label>
            <input
              id="credential"
              type={revealed ? "text" : "password"}
              value={credential}
              onChange={(event) => setCredential(event.target.value)}
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

          {error && (
            <p role="alert" className="text-sm text-amber">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="min-h-11 w-full rounded-vault bg-emerald px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {t("lock.unlock")}
          </button>

          <button
            type="button"
            onClick={() => setUseRecovery((value) => !value)}
            className="w-full text-center text-sm text-muted underline hover:text-ink dark:hover:text-porcelain"
          >
            {useRecovery ? t("lock.usePassword") : t("lock.useRecoveryKey")}
          </button>
        </form>
      </div>
    </div>
  );
}
