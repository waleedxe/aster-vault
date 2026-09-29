import { useEffect } from "react";

import { cx } from "../../lib/cx";
import {
  useToastStore,
  type ToastEntry,
  type ToastTone,
} from "../../lib/toast";

const TONE: Record<ToastTone, string> = {
  neutral: "border-mist dark:border-navy",
  emerald: "border-emerald/50",
  amber: "border-amber/60",
};

/** Renders active toasts. Mount once near the app root. */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 end-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((entry) => (
        <ToastRow key={entry.id} entry={entry} onDismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastRow({
  entry,
  onDismiss,
}: {
  entry: ToastEntry;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(entry.id), 3200);
    return () => window.clearTimeout(timer);
  }, [entry.id, onDismiss]);

  return (
    <div
      role="status"
      className={cx(
        "pointer-events-auto max-w-sm rounded-control border bg-porcelain px-4 py-3 text-sm shadow-pop dark:bg-navy",
        TONE[entry.tone],
      )}
    >
      {entry.message}
    </div>
  );
}
