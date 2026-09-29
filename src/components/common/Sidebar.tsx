import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";

interface NavEntry {
  id: string;
  labelKey: string;
}

const NAV: NavEntry[] = [
  { id: "all", labelKey: "nav.allItems" },
  { id: "favorites", labelKey: "nav.favorites" },
  { id: "logins", labelKey: "nav.logins" },
  { id: "notes", labelKey: "nav.notes" },
  { id: "cards", labelKey: "nav.cards" },
  { id: "identities", labelKey: "nav.identities" },
  { id: "archive", labelKey: "nav.archive" },
  { id: "backup", labelKey: "nav.backup" },
  { id: "settings", labelKey: "nav.settings" },
];

interface SidebarProps {
  onLock: () => void;
}

/** Left navigation. Mirrors naturally under RTL via logical properties. */
export function Sidebar({ onLock }: SidebarProps) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t("app.name")}
      className="flex w-64 shrink-0 flex-col border-e border-mist bg-mist/40 p-4 dark:border-navy dark:bg-navy/40"
    >
      <div className="mb-6 flex items-center gap-2 px-2">
        <span
          aria-hidden="true"
          className="inline-block h-6 w-6 rounded-[6px] bg-emerald"
        />
        <span className="text-lg font-semibold">{t("app.name")}</span>
      </div>

      <ul className="flex-1 space-y-1">
        {NAV.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              className="w-full rounded-vault px-3 py-2 text-start text-sm hover:bg-mint/60 focus-visible:outline-2 focus-visible:outline-emerald dark:hover:bg-midnight"
            >
              {t(entry.labelKey)}
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onLock}
        className="mt-4 flex items-center gap-2 rounded-vault px-3 py-2 text-sm text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-emerald dark:hover:text-porcelain"
      >
        <Lock className="h-4 w-4" aria-hidden="true" />
        {t("status.locked")}
      </button>
    </nav>
  );
}
