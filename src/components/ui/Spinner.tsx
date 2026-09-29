import { cx } from "../../lib/cx";

/** Indeterminate loading spinner. */
export function Spinner({
  size = 16,
  className,
  label = "Loading",
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cx(
        "inline-block animate-spin rounded-full border-2 border-current border-e-transparent",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
