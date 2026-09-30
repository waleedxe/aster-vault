import type { ReactNode } from "react";

interface EmptyStateProps {
  /** Optional icon or illustration. */
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Calm empty state used when a list has no content. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-mist p-10 text-center dark:border-navy">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="max-w-sm text-xs text-muted">{description}</p>
      )}
      {action}
    </div>
  );
}
