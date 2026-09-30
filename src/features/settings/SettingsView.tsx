import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge, Button, Card, Input, Switch } from "../../components/ui";
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
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-title font-semibold">{t("settings.title")}</h1>

      <Card className="space-y-4 p-4">
        <h2 className="text-sm font-semibold">{t("settings.security")}</h2>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t("settings.autoLock")}
            type="number"
            min={0}
            max={120}
            value={settings.autoLockMinutes}
            onChange={(event) =>
              settings.setAutoLockMinutes(Number(event.target.value))
            }
          />
          <Input
            label={t("settings.clipboardClear")}
            type="number"
            min={5}
            max={300}
            value={settings.clipboardClearSeconds}
            onChange={(event) =>
              settings.setClipboardClearSeconds(Number(event.target.value))
            }
          />
        </div>

        <div className="space-y-3 border-t border-mist pt-4 dark:border-navy">
          <h3 className="text-sm font-medium">
            {t("settings.changePassword")}
          </h3>
          <Input
            label={t("settings.currentPassword")}
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <Input
            label={t("settings.newPassword")}
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <div className="flex items-center gap-3">
            <Button
              disabled={!currentPassword || newPassword.length < 8}
              onClick={() => void changePassword()}
            >
              {t("settings.changePasswordAction")}
            </Button>
            {message && <span className="text-sm text-muted">{message}</span>}
          </div>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="text-sm font-semibold">{t("settings.appearance")}</h2>
        <div className="flex items-center gap-2">
          <Button
            variant={settings.language === "en" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setLanguage("en")}
          >
            {t("settings.english")}
          </Button>
          <Button
            variant={settings.language === "ar" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setLanguage("ar")}
          >
            {t("settings.arabic")}
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">{t("settings.reducedMotion")}</span>
          <Switch
            checked={settings.reducedMotion}
            onChange={settings.setReducedMotion}
            label={t("settings.reducedMotion")}
          />
        </div>
      </Card>

      <Card className="space-y-2 p-4">
        <h2 className="text-sm font-semibold">{t("settings.about")}</h2>
        <div className="flex flex-wrap gap-2">
          <Badge>
            {t("settings.version")}: {info?.version ?? "…"}
          </Badge>
          <Badge>
            {t("settings.formatVersion")}: {info?.format_version ?? "…"}
          </Badge>
        </div>
        <p className="text-sm text-amber">{t("settings.limitations")}</p>
      </Card>
    </div>
  );
}
