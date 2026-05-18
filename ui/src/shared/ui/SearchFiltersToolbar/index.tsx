// Toolbar pairing search input with filters popover and optional right slot.

import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { FiltersPopover } from "@/shared/ui/FiltersPopover";
import { cn } from "@/shared/lib/cn";

type SearchFiltersToolbarProps = Readonly<{
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchPlaceholder: string;
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
  activeFiltersCount: number;
  onClearFilters: () => void;
  filtersContent: ReactNode;
  rightSlot?: ReactNode;
  className?: string;
  searchWrapperClassName?: string;
  panelClassName?: string;
  filtersTitle?: string;
  filtersTriggerLabel?: string;
  filtersClearLabel?: string;
}>;

export function SearchFiltersToolbar({
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder,
  filtersOpen,
  onFiltersOpenChange,
  activeFiltersCount,
  onClearFilters,
  filtersContent,
  rightSlot,
  className,
  searchWrapperClassName,
  panelClassName,
  filtersTitle,
  filtersTriggerLabel,
  filtersClearLabel,
}: SearchFiltersToolbarProps) {
  return (
    <div className={cn("border-b border-[var(--border)] bg-[var(--card)] px-3 py-3", className)}>
      <div className="flex w-full min-w-0 items-center gap-3">
        {/* Search */}
        <div className={cn("relative min-w-0 max-w-md flex-1", searchWrapperClassName)}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-[var(--input)] bg-[var(--input-background)] py-2 pl-10 pr-4 text-sm text-[var(--foreground)] shadow-xs outline-none transition focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[color-mix(in_srgb,var(--ring),transparent_60%)]"
          />
        </div>

        {/* Filters */}
        <FiltersPopover
          open={filtersOpen}
          onOpenChange={onFiltersOpenChange}
          activeCount={activeFiltersCount}
          onClear={onClearFilters}
          panelClassName={panelClassName}
          title={filtersTitle}
          triggerLabel={filtersTriggerLabel}
          clearLabel={filtersClearLabel}
        >
          {filtersContent}
        </FiltersPopover>
        {rightSlot ? <div className="flex min-w-0 flex-1 items-center pl-1 sm:pl-2">{rightSlot}</div> : null}
      </div>
    </div>
  );
}
