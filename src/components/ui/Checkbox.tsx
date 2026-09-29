import type { InputHTMLAttributes, ReactNode } from "react";

import { cx } from "../../lib/cx";

interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  children?: ReactNode;
}

/** Checkbox with an inline label. */
export function Checkbox({ children, className, ...rest }: CheckboxProps) {
  return (
    <label className={cx("flex items-center gap-2 text-sm", className)}>
      <input type="checkbox" className="accent-emerald" {...rest} />
      {children}
    </label>
  );
}
