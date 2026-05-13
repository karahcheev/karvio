// Presentational shell for table bulk-selection toolbars: count, optional status, action slots, clear.
import * as React from "react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/Button";

const shellClassByVariant = {
  borderBottom: "border-b border-[var(--highlight-border)] bg-[var(--highlight-bg-soft)] px-3 py-3",
  roundedCard: "mb-4 rounded-lg border border-[var(--highlight-border)] bg-[var(--highlight-bg-soft)] px-3 py-2",
} as const;

export type BulkActionsBarVariant = keyof typeof shellClassByVariant;

export type BulkActionsBarProps = Readonly<{
  selectedCount: number;
  /** @default true */
  hideWhenEmpty?: boolean;
  variant?: BulkActionsBarVariant;
  className?: string;
  /** Shown inline after the selection summary (hints, loading text, etc.). */
  statusText?: React.ReactNode;
  /** Override default `{n} selected` label. */
  renderSelectionSummary?: (selectedCount: number) => React.ReactNode;
  /** Left cluster after the summary: filters, dropdowns, primary apply, etc. */
  startContent?: React.ReactNode;
  /** Right cluster before “Clear selection”: secondary / destructive actions, extra controls. */
  endContent?: React.ReactNode;
  onClearSelection: () => void;
  clearSelectionDisabled?: boolean;
  clearSelectionLabel?: string;
  clearButtonClassName?: string;
}>;

export function BulkActionsBar({
  selectedCount,
  hideWhenEmpty = true,
  variant = "borderBottom",
  className,
  statusText,
  renderSelectionSummary,
  startContent,
  endContent,
  onClearSelection,
  clearSelectionDisabled,
  clearSelectionLabel = "Clear selection",
  clearButtonClassName,
}: BulkActionsBarProps) {
  if (hideWhenEmpty && selectedCount === 0) return null;

  const summary =
    renderSelectionSummary?.(selectedCount) ?? (
      <span className="text-sm font-medium text-[var(--foreground)]">{selectedCount} selected</span>
    );

  const showStatus =
    statusText !== undefined && statusText !== null && statusText !== false && statusText !== "";

  return (
    <div className={cn(shellClassByVariant[variant], className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {summary}
          {showStatus && <span className="text-sm text-[var(--muted-foreground)]">{statusText}</span>}
          {startContent}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {endContent}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            disabled={clearSelectionDisabled}
            className={cn(
              "h-auto min-h-0 px-0 py-0 text-sm text-[var(--highlight-foreground)] hover:bg-transparent hover:text-[var(--highlight-foreground)] disabled:opacity-50",
              clearButtonClassName,
            )}
          >
            {clearSelectionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

const toolbarOutlineButtonClass =
  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50";

export type BulkActionsToolbarButtonProps = Readonly<Omit<React.ComponentProps<typeof Button>, "variant">>;

/** Filled primary action (e.g. Apply) aligned with bulk bar density. */
export function BulkActionsPrimaryButton({ className, size = "sm", ...props }: BulkActionsToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="primary"
      size={size}
      className={cn("rounded-lg disabled:bg-[var(--action-primary-disabled-fill)]", className)}
      {...props}
    />
  );
}

/** Outlined neutral/secondary control (e.g. bulk “Change status”). */
export function BulkActionsSecondaryButton({ className, ...props }: BulkActionsToolbarButtonProps) {
  return (
    <Button
      unstyled
      type="button"
      className={cn(
        toolbarOutlineButtonClass,
        "border-[var(--highlight-border)] bg-[var(--card)] text-[var(--highlight-foreground)] hover:bg-[var(--highlight-bg)]",
        className,
      )}
      {...props}
    />
  );
}

/** Outlined destructive control (e.g. bulk delete). */
export function BulkActionsDestructiveButton({ className, ...props }: BulkActionsToolbarButtonProps) {
  return (
    <Button
      unstyled
      type="button"
      className={cn(
        toolbarOutlineButtonClass,
        "border-[var(--tone-danger-border-strong)] bg-[var(--card)] text-[var(--status-failure)] hover:bg-[var(--tone-danger-bg-soft)]",
        className,
      )}
      {...props}
    />
  );
}
