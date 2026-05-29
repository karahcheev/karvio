// Filter section with optional search, selected-first ordering, collapse, and a
// render cap that keeps very large option lists responsive.

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { SearchField } from "@/shared/ui/SearchField";

export type FilterOption = Readonly<{ value: string; label: string }>;

type SearchableFilterChecklistSectionProps = Readonly<{
  title: string;
  options: FilterOption[];
  selectedValues: Set<string>;
  onToggle: (value: string) => void;
  /** "single" keeps at most one value selected (parent enforces); renders radio-style controls. */
  mode?: "multi" | "single";
  /** Show the search input once options exceed this count. */
  searchThreshold?: number;
  searchPlaceholder?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Cap how many matching options render at once (protects huge lists). */
  maxVisible?: number;
  emptyLabel?: string;
  className?: string;
}>;

export function SearchableFilterChecklistSection({
  title,
  options,
  selectedValues,
  onToggle,
  mode = "multi",
  searchThreshold = 8,
  searchPlaceholder,
  collapsible = false,
  defaultOpen = true,
  maxVisible = 100,
  emptyLabel = "No options found",
  className,
}: SearchableFilterChecklistSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");

  const selectedCount = selectedValues.size;
  const showSearch = options.length > searchThreshold;

  const orderedOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    // Preserve the incoming option order; only filter by the search query.
    return normalizedQuery
      ? options.filter((option) => option.label.toLowerCase().includes(normalizedQuery))
      : options;
  }, [options, query]);

  const visibleOptions = orderedOptions.slice(0, maxVisible);
  const hiddenCount = orderedOptions.length - visibleOptions.length;

  const body = (
    <>
      {showSearch ? (
        <SearchField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder ?? `Search ${title.toLowerCase()}...`}
          className="mb-2"
          inputClassName="py-1.5 text-sm"
        />
      ) : null}
      {options.length === 0 ? (
        <div className="text-sm text-[var(--muted-foreground)]">{emptyLabel}</div>
      ) : orderedOptions.length === 0 ? (
        <div className="text-sm text-[var(--muted-foreground)]">No matches</div>
      ) : (
        <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
          {visibleOptions.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-2">
              <input
                // Always a checkbox so clicking a selected single-select option can clear it
                // (native radios never fire onChange when re-clicking the checked option).
                type="checkbox"
                checked={selectedValues.has(option.value)}
                onChange={() => onToggle(option.value)}
                className={cn(
                  "h-4 w-4 border-[var(--border)] text-[var(--highlight-foreground)]",
                  mode === "single" ? "rounded-full" : "rounded",
                )}
              />
              <span className="truncate text-sm text-[var(--foreground)]" title={option.label}>
                {option.label}
              </span>
            </label>
          ))}
          {hiddenCount > 0 ? (
            <div className="pt-1 text-xs text-[var(--muted-foreground)]">
              Showing {visibleOptions.length} of {orderedOptions.length} — refine your search to narrow down.
            </div>
          ) : null}
        </div>
      )}
    </>
  );

  return (
    <div className={cn("mb-4 last:mb-0", className)}>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="mb-2 flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
            {title}
            {selectedCount > 0 ? (
              <span className="rounded-full bg-[var(--highlight-strong)] px-1.5 py-0.5 text-xs text-[var(--highlight-strong-foreground)]">
                {selectedCount}
              </span>
            ) : null}
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-[var(--muted-foreground)] transition-transform", open ? "rotate-180" : "")}
          />
        </button>
      ) : (
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
          {title}
          {selectedCount > 0 ? (
            <span className="rounded-full bg-[var(--highlight-strong)] px-1.5 py-0.5 text-xs text-[var(--highlight-strong-foreground)]">
              {selectedCount}
            </span>
          ) : null}
        </div>
      )}
      {!collapsible || open ? body : null}
    </div>
  );
}
