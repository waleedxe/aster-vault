import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Button,
  Card,
  Checkbox,
  Input,
  Logo,
  toast,
} from "../../components/ui";
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
      toast(t("backup.verified"), "emerald");
      setStep(4);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card tone="raised" className="w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-2">
          <Logo size={32} withWordmark />
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <h1 className="text-welcome font-semibold">
              {t("onboarding.welcome")}
            </h1>
            <p className="text-sm text-muted">{t("onboarding.welcomeBody")}</p>
            <p className="text-sm text-emerald-text">{t("app.tagline")}</p>
            <Button size="lg" className="w-full" onClick={() => setStep(1)}>
              {t("onboarding.next")}
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h1 className="text-section font-semibold">
              {t("onboarding.chooseLocation")}
            </h1>
            <div className="flex items-end gap-2">
              <Input
                label={t("onboarding.location")}
                value={path}
                onChange={(event) => setPath(event.target.value)}
              />
              <Button
                variant="secondary"
                className="shrink-0"
                onClick={() => void choosePath()}
              >
                {t("onboarding.browse")}
              </Button>
            </div>

            <h2 className="pt-1 text-sm font-semibold">
              {t("onboarding.createMasterPassword")}
            </h2>
            <Input
              label={t("lock.masterPassword")}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              hint={t("onboarding.passwordHint")}
            />
            <Input
              label={t("lock.masterPassword")}
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
            {error && <p className="text-sm text-amber-text">{error}</p>}
            <Button
              size="lg"
              className="w-full"
              disabled={busy}
              onClick={() => void createVault()}
            >
              {t("onboarding.create")}
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h1 className="text-section font-semibold">
              {t("onboarding.generateRecoveryKey")}
            </h1>
            <p className="text-sm text-muted">
              {t("onboarding.recoveryIntro")}
            </p>
            <code className="block break-all rounded-control bg-mist/60 p-3 text-sm tnum dark:bg-midnight/60">
              {recoveryKey}
            </code>
            <Checkbox
              checked={confirmedKey}
              onChange={(event) => setConfirmedKey(event.target.checked)}
            >
              {t("onboarding.recoveryConfirm")}
            </Checkbox>
            <Button
              size="lg"
              className="w-full"
              disabled={!confirmedKey}
              onClick={() => setStep(3)}
            >
              {t("onboarding.next")}
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h1 className="text-section font-semibold">
              {t("onboarding.testFirstBackup")}
            </h1>
            <p className="text-sm text-muted">{t("onboarding.backupIntro")}</p>
            <div className="flex items-end gap-2">
              <Input
                label={t("backup.folder")}
                value={backupDir}
                onChange={(event) => setBackupDir(event.target.value)}
              />
              <Button
                variant="secondary"
                className="shrink-0"
                onClick={() => void chooseBackupDir()}
              >
                {t("onboarding.browse")}
              </Button>
            </div>
            {error && <p className="text-sm text-amber-text">{error}</p>}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={() => setStep(4)}
              >
                {t("onboarding.skip")}
              </Button>
              <Button
                size="lg"
                className="flex-1"
                disabled={!backupDir || busy}
                onClick={() => void createBackup()}
              >
                {t("onboarding.createBackup")}
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h1 className="text-title font-semibold">{t("onboarding.done")}</h1>
            <p className="text-sm text-muted">{t("lock.keepKeySeparate")}</p>
            <Button
              size="lg"
              className="w-full"
              onClick={() => onComplete(path)}
            >
              {t("onboarding.finish")}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
