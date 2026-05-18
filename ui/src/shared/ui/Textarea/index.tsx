// Multi-line text area with shared input styling.

import * as React from "react";
import { cn } from "@/shared/lib/cn";

export type TextareaProps = Readonly<React.ComponentProps<"textarea">>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-24 w-full rounded-md border border-[var(--input)] bg-[var(--input-background)] px-3 py-2 text-sm text-[var(--foreground)] shadow-xs outline-none transition focus:border-[var(--ring)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ring),transparent_75%)] read-only:cursor-default read-only:bg-[var(--input-readonly-background)] read-only:text-[var(--muted-foreground)] disabled:cursor-not-allowed disabled:bg-[var(--muted)] disabled:text-[var(--muted-foreground)]",
        className,
      )}
      {...props}
    />
  );
});
