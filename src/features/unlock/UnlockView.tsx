import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Info, X } from "lucide-react";

import { Button, Card, Checkbox, Input, Logo } from "../../components/ui";
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
  const [betaDismissed, setBetaDismissed] = useState(false);

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
      <Card tone="raised" className="w-full max-w-sm p-8">
        <div className="mb-6 flex items-start justify-between">
          <Logo size={40} />
          <LanguageSwitcher />
        </div>

        <h1 className="text-2xl font-semibold">{t("lock.title")}</h1>
        <p className="mt-2 text-sm text-muted">{t("lock.subtitle")}</p>

        {!betaDismissed && (
          <div
            role="note"
            className="mt-4 flex items-start gap-2 rounded-control border border-amber/50 bg-amber/10 px-3 py-2 text-sm text-amber-text"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{t("beta.notice")}</span>
            <button
              type="button"
              aria-label={t("beta.dismiss")}
              onClick={() => setBetaDismissed(true)}
              className="shrink-0 rounded p-0.5 hover:bg-amber/20"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="mt-4 flex items-end gap-2">
          <Input
            label={t("onboarding.location")}
            value={path}
            onChange={(event) => setPath(event.target.value)}
          />
          <Button
            variant="secondary"
            onClick={() => void chooseFile()}
            className="shrink-0"
          >
            {t("onboarding.browse")}
          </Button>
        </div>

        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void unlock();
          }}
        >
          <Input
            label={
              useRecovery ? t("lock.recoveryKey") : t("lock.masterPassword")
            }
            type={revealed ? "text" : "password"}
            value={credential}
            autoComplete="off"
            onChange={(event) => setCredential(event.target.value)}
          />
          {error && <p className="text-sm text-amber-text">{error}</p>}

          <Checkbox
            checked={revealed}
            onChange={(event) => setRevealed(event.target.checked)}
          >
            {revealed ? t("lock.hide") : t("lock.reveal")}
          </Checkbox>

          <Button type="submit" size="lg" disabled={busy} className="w-full">
            {t("lock.unlock")}
          </Button>

          <button
            type="button"
            onClick={() => setUseRecovery((value) => !value)}
            className="w-full text-center text-sm text-muted underline hover:text-ink dark:hover:text-porcelain"
          >
            {useRecovery ? t("lock.usePassword") : t("lock.useRecoveryKey")}
          </button>
        </form>
      </Card>
    </div>
  );
}
