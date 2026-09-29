import { useState } from "react";
import { useTranslation } from "react-i18next";

import * as api from "../../lib/tauri";
import {
  pickDirectory,
  pickSaveVaultPath,
  rememberBackupDir,
  rememberVaultPath,
} from "../../lib/paths";

/** Multi-step first-run setup wizard. */
export function OnboardingView({
  onComplete,
}: {
  onComplete: (path: string) => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);

  const [path, setPath] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [confirmedKey, setConfirmedKey] = useState(false);
  const [backupDir, setBackupDir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const choosePath = async () => {
    const chosen = await pickSaveVaultPath();
    if (chosen) setPath(chosen);
  };

  const createVault = async () => {
    setError(null);
    if (!path) {
      setError(t("onboarding.chooseLocation"));
      return;
    }
    if (password.length < 8) {
      setError(t("onboarding.passwordHint"));
      return;
    }
    if (password !== confirm) {
      setError(t("lock.failed"));
      return;
    }
    setBusy(true);
    try {
      const result = await api.createVault(path, password);
      setRecoveryKey(result.recovery_key);
      rememberVaultPath(path);
      setStep(2);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const chooseBackupDir = async () => {
    const chosen = await pickDirectory(t("onboarding.chooseBackupFolder"));
    if (chosen) {
      setBackupDir(chosen);
      rememberBackupDir(chosen);
    }
  };

  const createBackup = async () => {
    if (!backupDir) return;
    setBusy(true);
    try {
      await api.exportBackup(backupDir);
      setStep(4);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-vault border border-mist bg-white/60 p-8 shadow-sm dark:border-navy dark:bg-navy/40">
        <div className="mb-4 flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-8 w-8 rounded-[8px] bg-emerald"
          />
          <span className="text-lg font-semibold">{t("app.name")}</span>
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold">
              {t("onboarding.welcome")}
            </h1>
            <p className="text-sm text-muted">{t("onboarding.welcomeBody")}</p>
            <p className="text-sm text-muted">{t("app.tagline")}</p>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="min-h-11 w-full rounded-vault bg-emerald px-4 py-2 font-medium text-white"
            >
              {t("onboarding.next")}
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h1 className="text-xl font-semibold">
              {t("onboarding.chooseLocation")}
            </h1>
            <div className="flex gap-2">
              <input
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder={t("onboarding.location")}
                className="w-full rounded-vault border border-mist bg-transparent px-3 py-2 text-sm dark:border-navy"
              />
              <button
                type="button"
                onClick={() => void choosePath()}
                className="shrink-0 rounded-vault border border-mist px-3 text-sm dark:border-navy"
              >
                {t("onboarding.browse")}
              </button>
            </div>

            <h2 className="pt-2 text-sm font-semibold">
              {t("onboarding.createMasterPassword")}
            </h2>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("lock.masterPassword")}
              className="w-full rounded-vault border border-mist bg-transparent px-3 py-2 text-sm dark:border-navy"
            />
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder={t("lock.masterPassword")}
              className="w-full rounded-vault border border-mist bg-transparent px-3 py-2 text-sm dark:border-navy"
            />
            <p className="text-xs text-muted">{t("onboarding.passwordHint")}</p>
            {error && <p className="text-sm text-amber">{error}</p>}
            <button
              type="button"
              onClick={() => void createVault()}
              disabled={busy}
              className="min-h-11 w-full rounded-vault bg-emerald px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              {t("onboarding.create")}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h1 className="text-xl font-semibold">
              {t("onboarding.generateRecoveryKey")}
            </h1>
            <p className="text-sm text-muted">
              {t("onboarding.recoveryIntro")}
            </p>
            <code className="block break-all rounded-vault bg-mist/60 p-3 text-sm tnum dark:bg-midnight/60">
              {recoveryKey}
            </code>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmedKey}
                onChange={(event) => setConfirmedKey(event.target.checked)}
              />
              {t("onboarding.recoveryConfirm")}
            </label>
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={!confirmedKey}
              className="min-h-11 w-full rounded-vault bg-emerald px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              {t("onboarding.next")}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h1 className="text-xl font-semibold">
              {t("onboarding.testFirstBackup")}
            </h1>
            <p className="text-sm text-muted">{t("onboarding.backupIntro")}</p>
            <div className="flex gap-2">
              <input
                value={backupDir}
                onChange={(event) => setBackupDir(event.target.value)}
                placeholder={t("backup.folder")}
                className="w-full rounded-vault border border-mist bg-transparent px-3 py-2 text-sm dark:border-navy"
              />
              <button
                type="button"
                onClick={() => void chooseBackupDir()}
                className="shrink-0 rounded-vault border border-mist px-3 text-sm dark:border-navy"
              >
                {t("onboarding.browse")}
              </button>
            </div>
            {error && <p className="text-sm text-amber">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="min-h-11 flex-1 rounded-vault border border-mist px-4 py-2 text-sm dark:border-navy"
              >
                {t("onboarding.skip")}
              </button>
              <button
                type="button"
                onClick={() => void createBackup()}
                disabled={!backupDir || busy}
                className="min-h-11 flex-1 rounded-vault bg-emerald px-4 py-2 font-medium text-white disabled:opacity-50"
              >
                {t("onboarding.createBackup")}
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold">{t("onboarding.done")}</h1>
            <p className="text-sm text-muted">{t("lock.keepKeySeparate")}</p>
            <button
              type="button"
              onClick={() => onComplete(path)}
              className="min-h-11 w-full rounded-vault bg-emerald px-4 py-2 font-medium text-white"
            >
              {t("onboarding.finish")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
