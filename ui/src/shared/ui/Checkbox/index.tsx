// Styled native checkbox input with forwarded ref.

import * as React from "react";
import { cn } from "@/shared/lib/cn";

export type CheckboxProps = Readonly<Omit<React.ComponentProps<"input">, "type">>;

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, ...props },
  ref,
) {
  return <input ref={ref} type="checkbox" className={cn("h-4 w-4 rounded border-[var(--input)] text-[var(--primary)]", className)} {...props} />;
});
