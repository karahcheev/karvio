// Small pill label for tags; optional leading content, outline/fill, removable control.

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/Button";

const variantClasses = {
  fill: "border border-[var(--tag-fill-border)] bg-[var(--tag-fill-bg)] text-[var(--tag-fill-foreground)]",
  outline: "border border-[var(--tag-outline-border)] bg-[var(--tag-outline-bg)] text-[var(--tag-outline-foreground)]",
} as const;

const sizeClasses = {
  sm: "gap-1 px-2.5 py-0.5 text-xs",
  md: "gap-1.5 px-3 py-1 text-sm",
} as const;

export type TagChipVariant = keyof typeof variantClasses;
export type TagChipSize = keyof typeof sizeClasses;

export type TagChipProps = Readonly<
  React.ComponentProps<"span"> & {
    variant?: TagChipVariant;
    size?: TagChipSize;
    removable?: boolean;
    onRemove?: () => void;
    removeAriaLabel?: string;
    leading?: React.ReactNode;
  }
>;

export const TagChip = React.forwardRef<HTMLSpanElement, TagChipProps>(function TagChip(
  {
    variant = "fill",
    size = "sm",
    removable = false,
    onRemove,
    removeAriaLabel = "Remove",
    leading,
    className,
    children,
    ...props
  },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex max-w-full min-w-0 items-center rounded-full font-medium",
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {leading}
      <span className="min-w-0 truncate">{children}</span>
      {removable ? (
        <Button
          type="button"
          unstyled
          onClick={(event) => {
            event.stopPropagation();
            onRemove?.();
          }}
          aria-label={removeAriaLabel}
          className="shrink-0 rounded p-0.5 text-[var(--tag-remove-foreground)] transition-colors hover:bg-[var(--tag-remove-hover-bg)] hover:text-[var(--tag-remove-hover-foreground)]"
        >
          <X className="h-3 w-3" />
        </Button>
      ) : null}
    </span>
  );
});
