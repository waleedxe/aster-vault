import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";

import { useVaultStore, type View } from "../../stores/vaultStore";

interface NavEntry {
  id: View;
  labelKey: string;
}

const NAV: NavEntry[] = [
  { id: "all", labelKey: "nav.allItems" },
  { id: "favorites", labelKey: "nav.favorites" },
  { id: "logins", labelKey: "nav.logins" },
  { id: "notes", labelKey: "nav.notes" },
  { id: "cards", labelKey: "nav.cards" },
  { id: "identities", labelKey: "nav.identities" },
  { id: "backup", labelKey: "nav.backup" },
  { id: "settings", labelKey: "nav.settings" },
];

/** Left navigation. Mirrors naturally under RTL via logical properties. */
export function Sidebar({ onLock }: { onLock: () => void }) {
  const { t } = useTranslation();
  const view = useVaultStore((state) => state.view);
  const setView = useVaultStore((state) => state.setView);
  const items = useVaultStore((state) => state.items);
  const folders = useVaultStore((state) => state.folders);

  const countFor = (id: View): number => {
    switch (id) {
      case "all":
        return items.length;
      case "favorites":
        return items.filter((item) => item.favorite).length;
      case "logins":
        return items.filter((item) => item.item_type === "login").length;
      case "notes":
        return items.filter((item) => item.item_type === "note").length;
      case "cards":
        return items.filter((item) => item.item_type === "card").length;
      case "identities":
        return items.filter((item) => item.item_type === "identity").length;
      default:
        return 0;
    }
  };

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
        {NAV.map((entry) => {
          const active = view === entry.id;
          const count = countFor(entry.id);
          return (
            <li key={entry.id}>
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setView(entry.id)}
                className={
                  "flex w-full items-center justify-between rounded-vault px-3 py-2 text-start text-sm focus-visible:outline-2 focus-visible:outline-emerald " +
                  (active
                    ? "bg-mint/70 font-medium dark:bg-midnight"
                    : "hover:bg-mint/60 dark:hover:bg-midnight")
                }
              >
                <span>{t(entry.labelKey)}</span>
                {count > 0 && (
                  <span className="text-xs text-muted tnum">{count}</span>
                )}
              </button>
            </li>
          );
        })}
        {folders.length > 0 && (
          <li className="px-3 pt-3 text-xs uppercase tracking-wide text-muted">
            {folders.length} folders
          </li>
        )}
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
