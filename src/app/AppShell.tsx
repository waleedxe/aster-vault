import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Download, Moon, Search, Sun, Wand2 } from "lucide-react";

import { ErrorBanner, IconButton, Menu } from "../components/ui";
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

/** Time-of-day greeting key. */
function greetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "home.morning";
  if (hour < 18) return "home.afternoon";
  return "home.evening";
}

/** Main application chrome: sidebar plus content area. */
export function AppShell({ onLock }: { onLock: () => void }) {
  const { t } = useTranslation();
  const view = useVaultStore((state) => state.view);
  const query = useVaultStore((state) => state.query);
  const setQuery = useVaultStore((state) => state.setQuery);
  const refresh = useVaultStore((state) => state.refresh);
  const lock = useVaultStore((state) => state.lock);
  const error = useVaultStore((state) => state.error);
  const setError = useVaultStore((state) => state.setError);
  const autoLockMinutes = useSettingsStore((state) => state.autoLockMinutes);
  const themeMode = useThemeStore((state) => state.mode);
  const toggleTheme = useThemeStore((state) => state.toggle);
  const isDark = resolveTheme(themeMode) === "dark";
  const [showGenerator, setShowGenerator] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const lockNow = () => {
    void lock().then(onLock);
  };

  useAutoLock(true, autoLockMinutes, lockNow);

  useEffect(() => {
    void refresh();
  }, [query, refresh]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isVaultView = view !== "backup" && view !== "settings" && !showImport;

  return (
    <div className="flex h-full">
      <Sidebar onLock={lockNow} />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-mist px-6 pt-5 dark:border-navy">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-title font-semibold">
                {t(greetingKey())}
              </h1>
              <p className="truncate text-sm text-muted">
                {t("home.subtitle")}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <IconButton
                label={t("import.title")}
                onClick={() => setShowImport(true)}
              >
                <Download className="h-4 w-4" />
              </IconButton>
              <IconButton
                label={t("generator.title")}
                active={showGenerator}
                onClick={() => setShowGenerator((value) => !value)}
              >
                <Wand2 className="h-4 w-4" />
              </IconButton>
              <IconButton
                label={t("settings.appearance")}
                onClick={toggleTheme}
              >
                {isDark ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </IconButton>
              <Menu
                label={t("home.vault")}
                align="end"
                trigger={
                  <span className="inline-flex items-center gap-1 rounded-control border border-mist px-3 py-2 text-sm text-ink dark:border-navy dark:text-porcelain">
                    {t("home.vault")}
                    <ChevronDown className="h-4 w-4" />
                  </span>
                }
                items={[
                  {
                    id: "personal",
                    label: t("home.vault"),
                    onSelect: () => undefined,
                  },
                ]}
              />
              <LanguageSwitcher />
            </div>
          </div>

          {isVaultView && (
            <div className="relative my-4">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("vault.search")}
                className="h-11 w-full rounded-control border border-mist bg-transparent ps-9 pe-20 text-sm text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-emerald dark:border-navy dark:text-porcelain"
              />
              <kbd className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 rounded border border-mist px-1.5 py-0.5 text-2xs text-muted dark:border-navy">
                {t("vault.searchShortcut")}
              </kbd>
            </div>
          )}
          {!isVaultView && <div className="pb-4" />}
        </header>

        <section className="flex min-h-0 flex-1 flex-col">
          {error && (
            <div className="px-6 pt-4">
              <ErrorBanner message={error} onDismiss={() => setError(null)} />
            </div>
          )}
          {showImport ? (
            <div className="flex-1 overflow-auto">
              <ImportView />
            </div>
          ) : view === "backup" ? (
            <div className="flex-1 overflow-auto">
              <BackupView />
            </div>
          ) : view === "settings" ? (
            <div className="flex-1 overflow-auto">
              <SettingsView />
            </div>
          ) : (
            <VaultView />
          )}
        </section>
      </main>

      {showGenerator && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-30 flex items-center justify-center bg-midnight/40 p-4"
          onClick={() => setShowGenerator(false)}
        >
          <div
            className="w-full max-w-md rounded-card bg-porcelain p-6 dark:bg-navy"
            onClick={(event) => event.stopPropagation()}
          >
            <GeneratorPanel />
          </div>
        </div>
      )}
    </div>
  );
}
