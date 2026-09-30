import { cx } from "../../lib/cx";

/** A single tab. */
export interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

/** Horizontal tab strip. */
export function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <div role="tablist" className={cx("flex gap-1", className)}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cx(
              "rounded-control px-3 py-1.5 text-sm transition-colors duration-[var(--duration-fast)]",
              active
                ? "bg-mint text-emerald-text dark:bg-navy dark:text-porcelain"
                : "text-muted hover:text-ink dark:hover:text-porcelain",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
