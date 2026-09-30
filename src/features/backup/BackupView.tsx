import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge, Button, Card, Input, toast } from "../../components/ui";
import * as api from "../../lib/tauri";
import type { BackupDto } from "../../lib/tauri";
import {
  getRememberedBackupDir,
  pickDirectory,
  pickExistingVault,
  pickSaveVaultPath,
  rememberBackupDir,
} from "../../lib/paths";

function formatAge(seconds: number): string {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} d`;
}

/** Backup center: create, list, verify, and restore. */
export function BackupView() {
  const { t } = useTranslation();
  const [dir, setDir] = useState<string | null>(getRememberedBackupDir());
  const [backups, setBackups] = useState<BackupDto[]>([]);
  const [age, setAge] = useState<number | null>(null);

  const [restorePath, setRestorePath] = useState("");
  const [restorePassword, setRestorePassword] = useState("");
  const [restoreDest, setRestoreDest] = useState("");

  const reload = useCallback(async (target: string | null) => {
    if (!target) return;
    try {
      setBackups(await api.listBackups(target));
      setAge(await api.secondsSinceLatestBackup(target));
    } catch (err) {
      toast(String(err), "amber");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload(dir);
  }, [dir, reload]);

  const chooseFolder = async () => {
    const chosen = await pickDirectory(t("backup.chooseFolder"));
    if (chosen) {
      setDir(chosen);
      rememberBackupDir(chosen);
    }
  };

  const createBackup = async () => {
    if (!dir) return;
    try {
      await api.exportBackup(dir);
      await api.applyBackupRetention(dir, 10);
      toast(t("backup.verified"), "emerald");
      await reload(dir);
    } catch (err) {
      toast(String(err), "amber");
    }
  };

  const verify = async (path: string) => {
    try {
      const created = await api.verifyBackup(path);
      toast(
        `${t("backup.verified")} — ${new Date(created * 1000).toLocaleString()}`,
        "emerald",
      );
    } catch {
      toast(t("backup.couldNotVerify"), "amber");
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
      toast(
        t("backup.restored", { count: result.item_count, path: restoreDest }),
        "emerald",
      );
      setRestorePassword("");
    } catch (err) {
      toast(String(err), "amber");
    }
  };

  const chooseRestoreFile = async () => {
    const chosen = await pickExistingVault();
    if (chosen) setRestorePath(chosen);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-title font-semibold">{t("backup.title")}</h1>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("backup.health")}</h2>
          {age === null ? (
            <Badge tone="amber">{t("status.neverBackedUp")}</Badge>
          ) : (
            <Badge tone="emerald">
              {t("home.lastBackup")}: {formatAge(age)}
            </Badge>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => void chooseFolder()}>
            {t("backup.chooseFolder")}
          </Button>
          <Button disabled={!dir} onClick={() => void createBackup()}>
            {t("backup.create")}
          </Button>
          {dir && <span className="break-all text-xs text-muted">{dir}</span>}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">{t("backup.versions")}</h2>
        {backups.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t("backup.noBackups")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {backups.map((backup) => (
              <li
                key={backup.path}
                className="flex items-center justify-between gap-2 rounded-control bg-mist/40 px-3 py-2 text-sm dark:bg-navy-deep/50"
              >
                <span className="min-w-0 flex-1 truncate tnum">
                  {new Date(backup.created_at * 1000).toLocaleString()} ·{" "}
                  {Math.round(backup.size / 1024)} KB
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void verify(backup.path)}
                >
                  {t("backup.testBackup")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setRestorePath(backup.path);
                    if (dir) setRestoreDest(dir);
                  }}
                >
                  {t("backup.restore")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">{t("backup.restore")}</h2>
        <p className="mt-1 text-sm text-muted">{t("backup.restoreIntro")}</p>
        <div className="mt-3 space-y-3">
          <div className="flex items-end gap-2">
            <Input
              label={t("backup.versions")}
              value={restorePath}
              onChange={(event) => setRestorePath(event.target.value)}
            />
            <Button
              variant="secondary"
              className="shrink-0"
              onClick={() => void chooseRestoreFile()}
            >
              {t("onboarding.browse")}
            </Button>
          </div>
          <Input
            label={t("backup.passwordForRestore")}
            type="password"
            value={restorePassword}
            onChange={(event) => setRestorePassword(event.target.value)}
          />
          <div className="flex items-end gap-2">
            <Input
              label={t("backup.destination")}
              value={restoreDest}
              onChange={(event) => setRestoreDest(event.target.value)}
            />
            <Button
              variant="secondary"
              className="shrink-0"
              onClick={() =>
                void pickSaveVaultPath()
                  .then((p) => p && setRestoreDest(p))
                  .catch(() => undefined)
              }
            >
              {t("backup.chooseDestination")}
            </Button>
          </div>
          <Button
            disabled={!restorePath || !restoreDest || !restorePassword}
            onClick={() => void restore()}
          >
            {t("backup.restore")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
