// Titled checklist filter block with optional empty state.

import { cn } from "@/shared/lib/cn";

type FilterChecklistSectionProps = Readonly<{
  title: string;
  values: string[];
  selectedValues: Set<string>;
  onToggle: (value: string) => void;
  getLabel?: (value: string) => string;
  emptyLabel?: string;
  className?: string;
  maxHeightClassName?: string;
}>;

export function FilterChecklistSection({
  title,
  values,
  selectedValues,
  onToggle,
  getLabel,
  emptyLabel,
  className,
  maxHeightClassName,
}: FilterChecklistSectionProps) {
  return (
    <div className={cn("mb-4 last:mb-0", className)}>
      {/* Section title */}
      <div className="mb-2 text-sm font-medium text-[var(--foreground)]">{title}</div>
      {values.length === 0 ? (
        <div className="text-sm text-[var(--muted-foreground)]">{emptyLabel ?? "No options found"}</div>
      ) : (
        /* Scrollable option list */
        <div className={cn("space-y-2", maxHeightClassName)}>
          {values.map((value) => (
            <label key={value} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={selectedValues.has(value)}
                onChange={() => onToggle(value)}
                className="h-4 w-4 rounded border-[var(--border)] text-[var(--highlight-foreground)]"
              />
              <span className="truncate text-sm text-[var(--foreground)]">{getLabel ? getLabel(value) : value}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
