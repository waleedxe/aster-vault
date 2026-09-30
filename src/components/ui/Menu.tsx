import { useEffect, useRef, useState, type ReactNode } from "react";

import { cx } from "../../lib/cx";

/** A single menu entry. */
export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onSelect: () => void;
}

interface MenuProps {
  /** Accessible label for the trigger. */
  label: string;
  trigger: ReactNode;
  items: MenuItem[];
  align?: "start" | "end";
}

/** Small dropdown menu. */
export function Menu({ label, trigger, items, align = "end" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center justify-center rounded-control text-muted hover:text-ink dark:hover:text-porcelain"
      >
        {trigger}
      </button>
      {open && (
        <ul
          role="menu"
          className={cx(
            "absolute z-30 mt-1 min-w-40 overflow-hidden rounded-control border border-mist bg-porcelain py-1 shadow-pop dark:border-navy dark:bg-navy",
            align === "end" ? "end-0" : "start-0",
          )}
        >
          {items.map((item) => (
            <li key={item.id} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cx(
                  "flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-mist/60 dark:hover:bg-navy-deep/70",
                  item.danger
                    ? "text-amber-text"
                    : "text-ink dark:text-porcelain",
                )}
              >
                {item.icon}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
