import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { changeLanguage } from "../../i18n/changeLanguage";
import * as api from "../../lib/tauri";
import type { AppInfo } from "../../lib/tauri";
import { useSettingsStore, type Language } from "../../stores/settingsStore";

/** Settings screen: security, appearance, language, and about. */
export function SettingsView() {
  const { t } = useTranslation();
  const settings = useSettingsStore();
  const [info, setInfo] = useState<AppInfo | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void api
      .appInfo()
      .then(setInfo)
      .catch(() => undefined);
  }, []);

  const setLanguage = (language: Language) => {
    settings.setLanguage(language);
    void changeLanguage(language);
  };

  const changePassword = async () => {
    try {
      await api.changeMasterPassword(currentPassword, newPassword);
      setMessage(t("settings.changed"));
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setMessage(String(err));
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">{t("settings.title")}</h1>

      <section className="space-y-3 rounded-vault border border-mist p-4 dark:border-navy">
        <h2 className="text-sm font-semibold">{t("settings.security")}</h2>
        <label className="block text-sm">
          {t("settings.autoLock")}
          <input
            type="number"
            min={0}
            max={120}
            value={settings.autoLockMinutes}
            onChange={(event) =>
              settings.setAutoLockMinutes(Number(event.target.value))
            }
            className="mt-1 w-28 rounded-vault border border-mist bg-transparent px-3 py-2 dark:border-navy"
          />
        </label>
        <label className="block text-sm">
          {t("settings.clipboardClear")}
          <input
            type="number"
            min={5}
            max={300}
            value={settings.clipboardClearSeconds}
            onChange={(event) =>
              settings.setClipboardClearSeconds(Number(event.target.value))
            }
            className="mt-1 w-28 rounded-vault border border-mist bg-transparent px-3 py-2 dark:border-navy"
          />
        </label>
        <div className="border-t border-mist pt-3 dark:border-navy">
          <h3 className="text-sm font-medium">
            {t("settings.changePassword")}
          </h3>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder={t("settings.currentPassword")}
            className="mt-2 w-full rounded-vault border border-mist bg-transparent px-3 py-2 text-sm dark:border-navy"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder={t("settings.newPassword")}
            className="mt-2 w-full rounded-vault border border-mist bg-transparent px-3 py-2 text-sm dark:border-navy"
          />
          <button
            type="button"
            onClick={() => void changePassword()}
            disabled={!currentPassword || newPassword.length < 8}
            className="mt-2 rounded-vault bg-emerald px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {t("settings.changePasswordAction")}
          </button>
          {message && (
            <p role="status" className="mt-2 text-sm text-muted">
              {message}
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-vault border border-mist p-4 dark:border-navy">
        <h2 className="text-sm font-semibold">{t("settings.appearance")}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={settings.language === "en"}
            onClick={() => setLanguage("en")}
            className={
              "rounded-vault border px-3 py-2 text-sm dark:border-navy " +
              (settings.language === "en"
                ? "border-emerald text-emerald"
                : "border-mist")
            }
          >
            {t("settings.english")}
          </button>
          <button
            type="button"
            aria-pressed={settings.language === "ar"}
            onClick={() => setLanguage("ar")}
            className={
              "rounded-vault border px-3 py-2 text-sm dark:border-navy " +
              (settings.language === "ar"
                ? "border-emerald text-emerald"
                : "border-mist")
            }
          >
            {t("settings.arabic")}
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={(event) =>
              settings.setReducedMotion(event.target.checked)
            }
          />
          {t("settings.reducedMotion")}
        </label>
      </section>

      <section className="space-y-2 rounded-vault border border-mist p-4 dark:border-navy">
        <h2 className="text-sm font-semibold">{t("settings.about")}</h2>
        <p className="text-sm text-muted">
          {t("settings.version")}: {info?.version ?? "…"} ·{" "}
          {t("settings.formatVersion")}: {info?.format_version ?? "…"}
        </p>
        <p className="text-sm text-amber">{t("settings.limitations")}</p>
      </section>
    </div>
  );
}
