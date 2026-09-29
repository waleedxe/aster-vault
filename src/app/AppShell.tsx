import { useTranslation } from "react-i18next";

import { LanguageSwitcher } from "../components/common/LanguageSwitcher";
import { Sidebar } from "../components/common/Sidebar";

interface AppShellProps {
  onLock: () => void;
}

/** Main application chrome: sidebar plus content area. */
export function AppShell({ onLock }: AppShellProps) {
  const { t } = useTranslation();

  return (
    <div className="flex h-full">
      <Sidebar onLock={onLock} />
      <main className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-mist px-6 py-4 dark:border-navy">
          <div>
            <h1 className="text-2xl font-semibold">{t("nav.allItems")}</h1>
            <p className="text-sm text-muted">{t("app.tagline")}</p>
          </div>
          <LanguageSwitcher />
        </header>
        <section className="flex-1 overflow-auto p-6">
          <p className="text-sm text-muted">{t("common.search")}</p>
          <div className="mt-6 rounded-vault border border-dashed border-mist p-10 text-center text-muted dark:border-navy">
            {t("onboarding.welcome")}
          </div>
        </section>
      </main>
    </div>
  );
}
