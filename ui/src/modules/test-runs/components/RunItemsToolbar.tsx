// Run items section title and filter trigger.
import type { ReactNode } from "react";
import type { RunCaseDto } from "@/shared/api";
import { cn } from "@/shared/lib/cn";
import { RunItemsFilters } from "./RunItemsFilters";

type Props = Readonly<{
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
  activeFiltersCount: number;
  onClearFilters: () => void;
  searchFilter: string;
  onSearchFilterChange: (value: string) => void;
  selectedStatuses: Set<RunCaseDto["status"]>;
  onToggleStatusFilter: (status: RunCaseDto["status"]) => void;
  selectedAssignees: Set<string>;
  onToggleAssigneeFilter: (assignee: string) => void;
  assigneeOptions: string[];
  loadedItemsCount: number;
  totalItemsCount: number;
  hasMoreRunItems: boolean;
  /** Shown to the right of the filters popover (e.g. bulk selection icons). */
  bulkToolbarSlot?: ReactNode;
}>;

export function RunItemsToolbar({
  filtersOpen,
  onFiltersOpenChange,
  activeFiltersCount,
  onClearFilters,
  searchFilter,
  onSearchFilterChange,
  selectedStatuses,
  onToggleStatusFilter,
  selectedAssignees,
  onToggleAssigneeFilter,
  assigneeOptions,
  loadedItemsCount,
  totalItemsCount,
  hasMoreRunItems,
  bulkToolbarSlot,
}: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-start gap-3">
      <div className="min-w-0 shrink-0">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Run Items</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Showing {loadedItemsCount} of {totalItemsCount} run item(s)
          {hasMoreRunItems ? " — load more to fetch the remaining items." : ""}
        </p>
      </div>
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2",
          bulkToolbarSlot ? undefined : "justify-end",
        )}
      >
        <RunItemsFilters
          filtersOpen={filtersOpen}
          onFiltersOpenChange={onFiltersOpenChange}
          activeFiltersCount={activeFiltersCount}
          onClearFilters={onClearFilters}
          searchFilter={searchFilter}
          onSearchFilterChange={onSearchFilterChange}
          selectedStatuses={selectedStatuses}
          onToggleStatusFilter={onToggleStatusFilter}
          selectedAssignees={selectedAssignees}
          onToggleAssigneeFilter={onToggleAssigneeFilter}
          assigneeOptions={assigneeOptions}
        />
        {bulkToolbarSlot ? (
          <div className="flex min-w-0 flex-1 items-center">{bulkToolbarSlot}</div>
        ) : null}
      </div>
    </div>
  );
}
