import { useTranslation } from "react-i18next";
import {
  Archive,
  Clock,
  CreditCard,
  KeyRound,
  LayoutGrid,
  Lock,
  Settings,
  Star,
  StickyNote,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { Logo } from "../ui";
import { useVaultStore, type View } from "../../stores/vaultStore";

interface NavEntry {
  id: View;
  labelKey: string;
  icon: LucideIcon;
}

const PRIMARY: NavEntry[] = [
  { id: "all", labelKey: "nav.allItems", icon: LayoutGrid },
  { id: "favorites", labelKey: "nav.favorites", icon: Star },
  { id: "logins", labelKey: "nav.logins", icon: KeyRound },
  { id: "notes", labelKey: "nav.notes", icon: StickyNote },
  { id: "cards", labelKey: "nav.cards", icon: CreditCard },
  { id: "identities", labelKey: "nav.identities", icon: UserRound },
  { id: "archive", labelKey: "nav.archive", icon: Archive },
  { id: "backup", labelKey: "nav.backup", icon: Clock },
];

/** Left navigation. Mirrors naturally under RTL via logical properties. */
export function Sidebar({ onLock }: { onLock: () => void }) {
  const { t } = useTranslation();
  const view = useVaultStore((state) => state.view);
  const setView = useVaultStore((state) => state.setView);
  const items = useVaultStore((state) => state.items);

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

  const entry = (nav: NavEntry) => {
    const active = view === nav.id;
    const count = countFor(nav.id);
    const Icon = nav.icon;
    return (
      <li key={nav.id}>
        <button
          type="button"
          aria-current={active ? "page" : undefined}
          onClick={() => setView(nav.id)}
          className={
            "flex w-full items-center gap-3 rounded-control px-3 py-2 text-start text-sm transition-colors duration-[var(--duration-fast)] " +
            (active
              ? "bg-mint text-emerald-text dark:bg-navy-deep dark:text-porcelain"
              : "text-muted hover:bg-mist/60 hover:text-ink dark:hover:bg-navy/40 dark:hover:text-porcelain")
          }
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1 truncate">{t(nav.labelKey)}</span>
          {count > 0 && (
            <span className="text-2xs text-muted tnum">{count}</span>
          )}
        </button>
      </li>
    );
  };

  return (
    <nav
      aria-label={t("app.name")}
      className="flex w-64 shrink-0 flex-col border-e border-mist bg-mist/40 p-4 dark:border-navy dark:bg-navy/30"
    >
      <div className="mb-6 px-2">
        <Logo size={26} withWordmark />
      </div>

      <ul className="flex-1 space-y-1">{PRIMARY.map(entry)}</ul>

      <div className="space-y-1 border-t border-mist pt-3 dark:border-navy">
        <button
          type="button"
          aria-current={view === "settings" ? "page" : undefined}
          onClick={() => setView("settings")}
          className={
            "flex w-full items-center gap-3 rounded-control px-3 py-2 text-start text-sm transition-colors duration-[var(--duration-fast)] " +
            (view === "settings"
              ? "bg-mint text-emerald-text dark:bg-navy-deep dark:text-porcelain"
              : "text-muted hover:bg-mist/60 hover:text-ink dark:hover:bg-navy/40 dark:hover:text-porcelain")
          }
        >
          <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t("nav.settings")}
        </button>
        <button
          type="button"
          onClick={onLock}
          className="flex w-full items-center gap-3 rounded-control px-3 py-2 text-start text-sm text-muted transition-colors duration-[var(--duration-fast)] hover:bg-mist/60 hover:text-ink dark:hover:bg-navy/40 dark:hover:text-porcelain"
        >
          <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t("status.locked")}
        </button>
      </div>
    </nav>
  );
}
