import { useId, type TextareaHTMLAttributes } from "react";

import { cx } from "../../lib/cx";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

/** Multi-line text input. */
export function Textarea({ label, className, id, ...rest }: TextareaProps) {
  const generated = useId();
  const textareaId = id ?? generated;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={textareaId} className="mb-1 block text-xs text-muted">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={cx(
          "w-full rounded-control border border-mist bg-transparent px-3 py-2 text-sm text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-emerald dark:border-navy dark:text-porcelain",
          className,
        )}
        {...rest}
      />
    </div>
  );
}
