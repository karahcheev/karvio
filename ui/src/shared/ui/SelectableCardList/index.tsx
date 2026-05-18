import * as React from "react";
import { cn } from "@/shared/lib/cn";

type SelectionType = "checkbox" | "radio";

export type SelectableCardListProps<T> = Readonly<{
  items: T[];
  getKey: (item: T) => string;
  isSelected: (item: T) => boolean;
  onToggle: (item: T) => void;
  renderItem: (item: T, selected: boolean) => React.ReactNode;
  selectionType?: SelectionType;
  name?: string;
  getInputAriaLabel?: (item: T) => string;
  getItemDisabled?: (item: T) => boolean;
  getItemClassName?: (item: T, selected: boolean, disabled: boolean) => string;
  showSelectedIndicator?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
}>;

export function SelectableCardList<T>({
  items,
  getKey,
  isSelected,
  onToggle,
  renderItem,
  selectionType = "checkbox",
  name,
  getInputAriaLabel,
  getItemDisabled,
  getItemClassName,
  showSelectedIndicator = false,
  emptyState,
  className,
}: SelectableCardListProps<T>) {
  if (items.length === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item) => {
        const key = getKey(item);
        const selected = isSelected(item);
        const disabled = getItemDisabled?.(item) ?? false;

        return (
          <label
            key={key}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
              selected ? "border-[var(--highlight-border)] bg-[var(--highlight-bg-soft)]" : "border-[var(--border)] hover:border-[var(--border)] hover:bg-[var(--muted)]",
              disabled && "cursor-not-allowed opacity-60",
              getItemClassName?.(item, selected, disabled),
            )}
          >
            <input
              type={selectionType}
              name={selectionType === "radio" ? name : undefined}
              checked={selected}
              disabled={disabled}
              onChange={() => onToggle(item)}
              aria-label={getInputAriaLabel?.(item)}
              className="mt-0.5 h-4 w-4 rounded border-[var(--border)] text-[var(--highlight-foreground)] disabled:opacity-50"
            />
            <div className="min-w-0 flex-1">{renderItem(item, selected)}</div>
            {showSelectedIndicator && selected ? <div className="h-2 w-2 shrink-0 rounded-full bg-[var(--action-primary-fill)]" aria-hidden /> : null}
          </label>
        );
      })}
    </div>
  );
}
