// Native select with chevron overlay and shared field styles.

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/cn";

export type SelectProps = Readonly<React.ComponentProps<"select">>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { children, className, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-10 w-full appearance-none rounded-md border border-[var(--input)] bg-[var(--input-background)] px-3 py-2 pr-9 text-sm text-[var(--foreground)] shadow-xs outline-none transition focus:border-[var(--ring)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ring),transparent_75%)] disabled:cursor-not-allowed disabled:bg-[var(--muted)] disabled:text-[var(--muted-foreground)]",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
    </div>
  );
});
