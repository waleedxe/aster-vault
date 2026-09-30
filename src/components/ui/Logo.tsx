import markUrl from "../../../assets/brand/aster-mark.png";
import { cx } from "../../lib/cx";

interface LogoProps {
  /** Pixel size of the mark. */
  size?: number;
  /** Show the "Aster Vault" wordmark next to the mark. */
  withWordmark?: boolean;
  className?: string;
}

/**
 * Aster Vault brand mark.
 *
 * Source of truth: `assets/brand/aster-mark.png` (transparent RGBA), composited
 * onto the dark tile by `scripts/make-icon.py` for the app icon set.
 */
export function Logo({
  size = 24,
  withWordmark = false,
  className,
}: LogoProps) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <img
        src={markUrl}
        width={size}
        height={size}
        alt={withWordmark ? "" : "Aster Vault"}
        aria-hidden={withWordmark ? true : undefined}
        className="shrink-0 select-none"
        draggable={false}
      />
      {withWordmark && (
        <span className="text-section font-semibold tracking-tight">
          Aster Vault
        </span>
      )}
    </span>
  );
}
