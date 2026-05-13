// Single-line text input with shared focus and disabled styles.

import * as React from "react";
import { cn } from "@/shared/lib/cn";

export type InputProps = Readonly<React.ComponentProps<"input">>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-md border border-[var(--input)] bg-[var(--input-background)] px-3 py-2 text-sm text-[var(--foreground)] shadow-xs outline-none transition focus:border-[var(--ring)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ring),transparent_75%)] read-only:cursor-default read-only:bg-[var(--input-readonly-background)] read-only:text-[var(--muted-foreground)] disabled:cursor-not-allowed disabled:bg-[var(--muted)] disabled:text-[var(--muted-foreground)]",
        className,
      )}
      {...props}
    />
  );
});
