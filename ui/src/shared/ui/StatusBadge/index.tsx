// Pill status label with semantic tone colors and optional border.

import * as React from "react";
import { cn } from "@/shared/lib/cn";

// Tone palettes for fill and optional outline

const toneClasses = {
  neutral:
    "border border-[var(--tone-neutral-border)] bg-[var(--tone-neutral-bg)] text-[var(--tone-neutral-text)]",
  info: "border border-[var(--tone-info-border)] bg-[var(--tone-info-bg)] text-[var(--tone-info-text)]",
  success:
    "border border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]",
  danger:
    "border border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]",
  error:
    "border border-[var(--tone-error-border)] bg-[var(--tone-error-bg)] text-[var(--tone-error-text)]",
  warning:
    "border border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)]",
  muted: "border border-[var(--tone-neutral-border)] bg-[var(--tone-neutral-bg)] text-[var(--tone-neutral-text)]",
} as const;

const toneBorderClasses = {
  neutral: "border-[var(--tone-neutral-border-strong)]",
  info: "border-[var(--tone-info-border-strong)]",
  success: "border-[var(--tone-success-border-strong)]",
  danger: "border-[var(--tone-danger-border-strong)]",
  error: "border-[var(--tone-error-border-strong)]",
  warning: "border-[var(--tone-warning-border-strong)]",
  muted: "border-[var(--tone-neutral-border-strong)]",
} as const;

export type StatusBadgeTone = keyof typeof toneClasses;

type StatusBadgeProps = Readonly<
  React.ComponentProps<"span"> & {
    tone?: StatusBadgeTone;
    withBorder?: boolean;
  }
>;

export function StatusBadge({
  tone = "neutral",
  withBorder = false,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
        toneClasses[tone],
        withBorder && "border",
        withBorder && toneBorderClasses[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
