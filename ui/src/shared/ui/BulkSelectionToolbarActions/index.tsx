// Bulk edit/delete on the left; selected count + clear (X) on the right edge of the slot.
import type { ReactNode } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/Button";

export type BulkSelectionToolbarActionsProps = Readonly<{
  selectedCount: number;
  busy?: boolean;
  /** When false, hides the pencil (bulk edit) control. Default true. */
  showBulkEdit?: boolean;
  onEdit?: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
  extraActions?: ReactNode;
  className?: string;
}>;

const iconBtnClass =
  "rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-40";

export function BulkSelectionToolbarActions({
  selectedCount,
  busy = false,
  showBulkEdit = true,
  onEdit,
  onDelete,
  onClearSelection,
  extraActions,
  className,
}: BulkSelectionToolbarActionsProps) {
  if (selectedCount <= 0) return null;

  return (
    <fieldset
      className={cn(
        "m-0 flex w-full min-w-0 items-center justify-between gap-3 border-0 border-l border-[var(--border)] pl-3",
        className,
      )}
      aria-label={`${selectedCount} selected`}
    >
      <div className="flex shrink-0 items-center gap-1">
        {showBulkEdit ? (
          <Button
            unstyled
            type="button"
            className={iconBtnClass}
            disabled={busy}
            title="Edit selected"
            aria-label={`Edit ${selectedCount} selected`}
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ) : null}
        <Button
          unstyled
          type="button"
          className={cn(iconBtnClass, "hover:text-[var(--destructive)]")}
          disabled={busy}
          title="Delete selected"
          aria-label={`Delete ${selectedCount} selected`}
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        {extraActions}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="whitespace-nowrap text-xs tabular-nums text-[var(--muted-foreground)]" title={`${selectedCount} selected`}>
          <span className="font-medium text-[var(--foreground)]">{selectedCount}</span> selected
        </span>
        <Button
          unstyled
          type="button"
          className={iconBtnClass}
          disabled={busy}
          title="Clear selection"
          aria-label="Clear selection"
          onClick={onClearSelection}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </fieldset>
  );
}
