import { useId, type SelectHTMLAttributes } from "react";

import { cx } from "../../lib/cx";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

/** Native select with consistent styling. */
export function Select({
  label,
  className,
  id,
  children,
  ...rest
}: SelectProps) {
  const generated = useId();
  const selectId = id ?? generated;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="mb-1 block text-xs text-muted">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cx(
          "h-10 w-full rounded-control border border-mist bg-transparent px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-emerald dark:border-navy dark:text-porcelain",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}
