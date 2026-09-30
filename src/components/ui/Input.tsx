import { useId, type InputHTMLAttributes } from "react";

import { cx } from "../../lib/cx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

/** Text input with optional label, hint and error. */
export function Input({
  label,
  hint,
  error,
  className,
  id,
  ...rest
}: InputProps) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1 block text-xs text-muted">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cx(
          "h-10 w-full rounded-control border bg-transparent px-3 text-sm text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-emerald dark:text-porcelain",
          error ? "border-amber" : "border-mist dark:border-navy",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p className="mt-1 text-2xs text-amber-text">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-2xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
