import { AlertTriangle, X } from "lucide-react";

import { cx } from "../../lib/cx";

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  className?: string;
}

/** Non-blocking error banner with an amber tone. */
export function ErrorBanner({
  message,
  onDismiss,
  className,
}: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cx(
        "flex items-center gap-2 rounded-control border border-amber/50 bg-amber/10 px-3 py-2 text-sm text-amber-text",
        className,
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 hover:bg-amber/20"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
