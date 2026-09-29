import type { HTMLAttributes } from "react";

import { cx } from "../../lib/cx";

type Tone = "neutral" | "emerald" | "amber" | "mint";

const TONE: Record<Tone, string> = {
  neutral: "bg-mist/70 text-muted dark:bg-navy/50",
  emerald: "bg-emerald/12 text-emerald",
  amber: "bg-amber/15 text-amber",
  mint: "bg-mint text-emerald-strong",
};

/** Small status pill. */
export function Badge({
  tone = "neutral",
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium tnum",
        TONE[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
