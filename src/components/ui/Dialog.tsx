import { useEffect, type ReactNode } from "react";

import { cx } from "../../lib/cx";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}

const SIZE = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" } as const;

/** Accessible modal dialog. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-midnight/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "max-h-full w-full overflow-auto rounded-card bg-porcelain p-6 shadow-pop dark:bg-navy",
          SIZE[size],
        )}
      >
        {title && <h2 className="mb-4 text-section font-semibold">{title}</h2>}
        {children}
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
