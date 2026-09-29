import { useId } from "react";

import { cx } from "../../lib/cx";

interface LogoProps {
  /** Pixel size of the mark. */
  size?: number;
  /** Show the "Aster Vault" wordmark next to the mark. */
  withWordmark?: boolean;
  className?: string;
}

/**
 * Aster Vault brand mark: four petals in a pinwheel around a protected
 * four-point negative space.
 *
 * Geometry mirrors `assets/brand/aster-mark.svg`. When the final logo artwork
 * is supplied, replace the inner SVG here and in the asset file.
 */
export function Logo({
  size = 24,
  withWordmark = false,
  className,
}: LogoProps) {
  const maskId = useId();
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
        <defs>
          <mask id={maskId}>
            <rect width="96" height="96" fill="#ffffff" />
            <path
              d="M48 30 Q50 44 62 48 Q50 52 48 66 Q46 52 34 48 Q46 44 48 30 Z"
              fill="#000000"
            />
          </mask>
        </defs>
        <g mask={`url(#${maskId})`}>
          <ellipse
            cx="48"
            cy="27"
            rx="19"
            ry="8.6"
            fill="#2E866F"
            transform="rotate(45 48 48)"
          />
          <ellipse
            cx="48"
            cy="27"
            rx="19"
            ry="8.6"
            fill="#CFEADC"
            transform="rotate(135 48 48)"
          />
          <ellipse
            cx="48"
            cy="27"
            rx="19"
            ry="8.6"
            fill="#2E866F"
            transform="rotate(225 48 48)"
          />
          <ellipse
            cx="48"
            cy="27"
            rx="19"
            ry="8.6"
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
