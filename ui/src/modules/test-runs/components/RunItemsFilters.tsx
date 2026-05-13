// Popover filters: text search, status, and assignee.
import { Search } from "lucide-react";
import type { RunCaseDto } from "@/shared/api";
import { FiltersPopover } from "@/shared/ui/FiltersPopover";
import { RUN_ITEM_STATUS_OPTIONS } from "../constants";

type RunItemsFiltersProps = Readonly<{
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
}>;

export function RunItemsFilters({
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
}: RunItemsFiltersProps) {
  return (
    <FiltersPopover open={filtersOpen} onOpenChange={onFiltersOpenChange} activeCount={activeFiltersCount} onClear={onClearFilters}>
      <div>
        <label htmlFor="run-items-search-filter" className="mb-2 block text-sm font-medium text-[var(--foreground)]">
          Search
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            id="run-items-search-filter"
            type="text"
            value={searchFilter}
            onChange={(event) => onSearchFilterChange(event.target.value)}
            placeholder="By key or title"
            className="w-full rounded-lg border border-[var(--border)] py-2 pl-10 pr-3 text-sm focus:border-[var(--highlight-border)] focus:outline-none focus:ring-1 focus:ring-[var(--control-focus-ring)]"
          />
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium text-[var(--foreground)]">Status</div>
        <div className="grid grid-cols-2 gap-2">
          {RUN_ITEM_STATUS_OPTIONS.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={selectedStatuses.has(option.value)}
                onChange={() => onToggleStatusFilter(option.value)}
                className="h-4 w-4 rounded border-[var(--border)] text-[var(--highlight-foreground)]"
              />
              <span className="text-sm text-[var(--foreground)]">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium text-[var(--foreground)]">Assignee</div>
        {assigneeOptions.length === 0 ? (
          <div className="text-sm text-[var(--muted-foreground)]">No assignees</div>
        ) : (
          <div className="max-h-36 space-y-2 overflow-auto pr-1">
            {assigneeOptions.map((assignee) => (
              <label key={assignee} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedAssignees.has(assignee)}
                  onChange={() => onToggleAssigneeFilter(assignee)}
                  className="h-4 w-4 rounded border-[var(--border)] text-[var(--highlight-foreground)]"
                />
                <span className="truncate text-sm text-[var(--foreground)]">{assignee}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </FiltersPopover>
  );
}
