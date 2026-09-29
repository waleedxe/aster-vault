import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Moon, Sun, Wand2 } from "lucide-react";

import { IconButton } from "../components/ui";
import { GeneratorPanel } from "../features/generator/GeneratorPanel";
import { BackupView } from "../features/backup/BackupView";
import { ImportView } from "../features/import/ImportView";
import { SettingsView } from "../features/settings/SettingsView";
import { VaultView } from "../features/vault/VaultView";
import { useAutoLock } from "../hooks/useAutoLock";
import { useSettingsStore } from "../stores/settingsStore";
import { resolveTheme, useThemeStore } from "../stores/themeStore";
import { useVaultStore } from "../stores/vaultStore";
import { LanguageSwitcher } from "../components/common/LanguageSwitcher";
import { Sidebar } from "../components/common/Sidebar";

/** Main application chrome: sidebar plus content area. */
export function AppShell({ onLock }: { onLock: () => void }) {
  const { t } = useTranslation();
  const view = useVaultStore((state) => state.view);
  const query = useVaultStore((state) => state.query);
  const refresh = useVaultStore((state) => state.refresh);
  const lock = useVaultStore((state) => state.lock);
  const autoLockMinutes = useSettingsStore((state) => state.autoLockMinutes);
  const themeMode = useThemeStore((state) => state.mode);
  const toggleTheme = useThemeStore((state) => state.toggle);
  const isDark = resolveTheme(themeMode) === "dark";
  const [showGenerator, setShowGenerator] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const lockNow = () => {
    void lock().then(onLock);
  };

  useAutoLock(true, autoLockMinutes, lockNow);

  useEffect(() => {
    void refresh();
  }, [query, refresh]);

  const title =
    view === "backup"
      ? t("backup.title")
      : view === "settings"
        ? t("settings.title")
        : t("nav.allItems");

  const content = showImport ? (
    <ImportView />
  ) : view === "backup" ? (
    <BackupView />
  ) : view === "settings" ? (
    <SettingsView />
  ) : (
    <VaultView />
  );

  return (
    <div className="flex h-full">
      <Sidebar onLock={lockNow} />
      <main className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-mist px-6 py-4 dark:border-navy">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">{title}</h1>
            <p className="truncate text-sm text-muted">{t("app.tagline")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <IconButton label={t("settings.appearance")} onClick={toggleTheme}>
              {isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </IconButton>
            <button
              type="button"
              onClick={() => {
                setShowImport(false);
                setShowGenerator((value) => !value);
              }}
              aria-label={t("generator.title")}
              className="rounded-vault border border-mist p-2 dark:border-navy"
            >
              <Wand2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowGenerator(false);
                setShowImport((value) => !value);
              }}
              className="rounded-vault border border-mist px-3 py-2 text-sm dark:border-navy"
            >
              {t("import.title")}
            </button>
            <LanguageSwitcher />
          </div>
        </header>
        <section className="flex-1 overflow-auto">{content}</section>
      </main>

      {showGenerator && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-20 flex items-center justify-center bg-midnight/40 p-4"
          onClick={() => setShowGenerator(false)}
        >
          <div
            className="w-full max-w-md rounded-vault bg-porcelain p-6 dark:bg-navy"
            onClick={(event) => event.stopPropagation()}
          >
            <GeneratorPanel />
          </div>
        </div>
      )}
    </div>
  );
}
