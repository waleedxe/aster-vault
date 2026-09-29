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
 * PLACEHOLDER geometry until the supplied logo artwork is integrated; the
 * component API stays the same when the real vector is dropped in.
 */
export function Logo({
  size = 24,
  withWordmark = false,
  className,
}: LogoProps) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 96 96"
        role="img"
        aria-label="Aster Vault"
        className="shrink-0"
      >
        <g>
          <ellipse
            cx="48"
            cy="27"
            rx="19"
            ry="8.5"
            fill="#2E866F"
            transform="rotate(45 48 48)"
          />
          <ellipse
            cx="48"
            cy="27"
            rx="19"
            ry="8.5"
            fill="#CFEADC"
            transform="rotate(135 48 48)"
          />
          <ellipse
            cx="48"
            cy="27"
            rx="19"
            ry="8.5"
            fill="#2E866F"
            transform="rotate(225 48 48)"
          />
          <ellipse
            cx="48"
            cy="27"
            rx="19"
            ry="8.5"
            fill="#CFEADC"
            transform="rotate(315 48 48)"
          />
        </g>
      </svg>
      {withWordmark && (
        <span className="text-section font-semibold tracking-tight">
          Aster Vault
        </span>
      )}
    </span>
  );
}
