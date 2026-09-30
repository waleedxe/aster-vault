import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "../../lib/cx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-emerald-strong text-white hover:bg-emerald-deep",
  secondary:
    "border border-mist text-ink hover:bg-mist/60 dark:border-navy dark:text-porcelain dark:hover:bg-navy/40",
  ghost:
    "text-muted hover:bg-mist/50 hover:text-ink dark:hover:bg-navy/40 dark:hover:text-porcelain",
  danger: "border border-amber/60 text-amber-text hover:bg-amber/10",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-body",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Optional leading icon. */
  icon?: ReactNode;
}

/** Primary interactive control. */
export function Button({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors duration-[var(--duration-fast)] disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
