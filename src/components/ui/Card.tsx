import type { HTMLAttributes } from "react";

import { cx } from "../../lib/cx";

type Tone = "plain" | "raised" | "sunken";

const TONE: Record<Tone, string> = {
  plain: "border border-mist dark:border-navy",
  raised:
    "border border-mist bg-white/70 shadow-card dark:border-navy dark:bg-navy-deep/60",
  sunken: "bg-mist/50 dark:bg-navy/40",
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
}

/** Surface container. */
export function Card({ tone = "plain", className, ...rest }: CardProps) {
  return (
    <div className={cx("rounded-card", TONE[tone], className)} {...rest} />
  );
}
