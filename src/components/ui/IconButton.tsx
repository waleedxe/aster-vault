import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "../../lib/cx";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible label (required; the button has no visible text). */
  label: string;
  size?: "sm" | "md";
  active?: boolean;
  children: ReactNode;
}

/** Square icon-only button. */
export function IconButton({
  label,
  size = "md",
  active = false,
  className,
  children,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      aria-pressed={active || undefined}
      className={cx(
        "inline-flex items-center justify-center rounded-control text-muted transition-colors duration-[var(--duration-fast)] hover:bg-mist/60 hover:text-ink dark:hover:bg-navy/40 dark:hover:text-porcelain",
        size === "sm" ? "h-8 w-8" : "h-10 w-10",
        active && "bg-mist/60 text-ink dark:bg-navy/40 dark:text-porcelain",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
