import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import * as api from "../../lib/tauri";
import type { BackupDto } from "../../lib/tauri";
import {
  getRememberedBackupDir,
  pickDirectory,
  pickExistingVault,
  pickSaveVaultPath,
  rememberBackupDir,
} from "../../lib/paths";

/** Backup center: create, list, verify, and restore. */
export function BackupView() {
  const { t } = useTranslation();
  const [dir, setDir] = useState<string | null>(getRememberedBackupDir());
  const [backups, setBackups] = useState<BackupDto[]>([]);
  const [age, setAge] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Restore form state.
  const [restorePath, setRestorePath] = useState("");
  const [restorePassword, setRestorePassword] = useState("");
  const [restoreDest, setRestoreDest] = useState("");

  const reload = useCallback(async (target: string | null) => {
    if (!target) return;
    try {
      setBackups(await api.listBackups(target));
      setAge(await api.secondsSinceLatestBackup(target));
    } catch (err) {
      setStatus(String(err));
    }
  }, []);

  useEffect(() => {
    // Load on mount and when the folder changes. setState happens after await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload(dir);
  }, [dir, reload]);

  const chooseFolder = async () => {
    const chosen = await pickDirectory(t("backup.chooseFolder"));
    if (chosen) {
      setDir(chosen);
      rememberBackupDir(chosen);
      setRestorePath(chosen);
    }
  };

  const createBackup = async () => {
    if (!dir) return;
    try {
      const path = await api.exportBackup(dir);
      await api.applyBackupRetention(dir, 10);
      setStatus(path);
      await reload(dir);
    } catch (err) {
      setStatus(String(err));
    }
  };

  const verify = async (path: string) => {
    try {
      const created = await api.verifyBackup(path);
      setStatus(
        `${t("backup.verified")} — ${new Date(created * 1000).toLocaleString()}`,
      );
    } catch {
      setStatus(t("backup.couldNotVerify"));
    }
  };

  const restore = async () => {
    if (!restorePath || !restoreDest) return;
    try {
      const result = await api.restoreBackup(
        restorePath,
        restorePassword,
        restoreDest,
      );
      setStatus(
        t("backup.restored", { count: result.item_count, path: restoreDest }),
      );
      setRestorePassword("");
    } catch (err) {
      setStatus(String(err));
    }
  };

  const chooseRestoreFile = async () => {
    const chosen = await pickExistingVault();
    if (chosen) setRestorePath(chosen);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">{t("backup.title")}</h1>

      <section className="rounded-vault border border-mist p-4 dark:border-navy">
        <h2 className="text-sm font-semibold">{t("backup.health")}</h2>
        <p className="mt-1 text-sm text-muted">
          {age === null
            ? t("status.neverBackedUp")
            : `${Math.round(age / 60)} min`}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void chooseFolder()}
            className="rounded-vault border border-mist px-3 py-2 text-sm dark:border-navy"
          >
            {t("backup.chooseFolder")}
          </button>
          <button
            type="button"
            onClick={() => void createBackup()}
            disabled={!dir}
            className="rounded-vault bg-emerald px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {t("backup.create")}
          </button>
          {dir && <span className="text-xs text-muted break-all">{dir}</span>}
        </div>
      </section>

      <section className="rounded-vault border border-mist p-4 dark:border-navy">
        <h2 className="text-sm font-semibold">{t("backup.versions")}</h2>
        {backups.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t("backup.noBackups")}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {backups.map((backup) => (
              <li
                key={backup.path}
                className="flex items-center justify-between gap-2 rounded-vault bg-mist/40 px-3 py-2 text-sm dark:bg-midnight/40"
              >
                <span className="min-w-0 flex-1 truncate">
                  {new Date(backup.created_at * 1000).toLocaleString()} ·{" "}
                  {Math.round(backup.size / 1024)} KB
                </span>
                <button
                  type="button"
                  onClick={() => void verify(backup.path)}
                  className="shrink-0 rounded px-2 py-1 text-xs text-emerald"
                >
                  {t("backup.testBackup")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRestorePath(backup.path);
                    setStatus(null);
                  }}
                  className="shrink-0 rounded px-2 py-1 text-xs text-muted"
                >
                  {t("backup.restore")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-vault border border-mist p-4 dark:border-navy">
        <h2 className="text-sm font-semibold">{t("backup.restore")}</h2>
        <p className="mt-1 text-sm text-muted">{t("backup.restoreIntro")}</p>
        <div className="mt-3 space-y-3">
          <div className="flex gap-2">
            <input
              value={restorePath}
              onChange={(event) => setRestorePath(event.target.value)}
              placeholder={t("backup.versions")}
              className="w-full rounded-vault border border-mist bg-transparent px-3 py-2 text-sm dark:border-navy"
            />
            <button
              type="button"
              onClick={() => void chooseRestoreFile()}
              className="shrink-0 rounded-vault border border-mist px-3 text-sm dark:border-navy"
            >
              {t("onboarding.browse")}
            </button>
          </div>
          <input
            type="password"
            value={restorePassword}
            onChange={(event) => setRestorePassword(event.target.value)}
            placeholder={t("backup.passwordForRestore")}
            className="w-full rounded-vault border border-mist bg-transparent px-3 py-2 text-sm dark:border-navy"
          />
          <div className="flex gap-2">
            <input
              value={restoreDest}
              onChange={(event) => setRestoreDest(event.target.value)}
              placeholder={t("backup.destination")}
              className="w-full rounded-vault border border-mist bg-transparent px-3 py-2 text-sm dark:border-navy"
            />
            <button
              type="button"
              onClick={() =>
                void pickSaveVaultPath()
                  .then((p) => p && setRestoreDest(p))
                  .catch(() => undefined)
              }
              className="shrink-0 rounded-vault border border-mist px-3 text-sm dark:border-navy"
            >
              {t("backup.chooseDestination")}
            </button>
          </div>
          <button
            type="button"
            onClick={() => void restore()}
            disabled={!restorePath || !restoreDest || !restorePassword}
            className="rounded-vault bg-emerald px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {t("backup.restore")}
          </button>
        </div>
      </section>

      {status && (
        <p role="status" className="text-sm text-muted break-all">
          {status}
        </p>
      )}
    </div>
  );
}
