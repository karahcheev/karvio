import { useCallback, useState } from "react";
import type { UnifiedTableSorting } from "@/shared/ui/Table";
import type { TestCaseColumn } from "../utils/types";

export function useTestCasesFilters() {
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [selectedPriorities, setSelectedPriorities] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [sorting, setSorting] = useState<UnifiedTableSorting<TestCaseColumn>>({
    column: "lastRun",
    direction: "desc",
  });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFiltersCount = selectedStatuses.size + selectedPriorities.size;

  const toggleFilter = useCallback(
    (filterSet: Set<string>, setFilter: (set: Set<string>) => void, value: string) => {
      const next = new Set(filterSet);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      setFilter(next);
    },
    [],
  );

  const clearAllFilters = useCallback(() => {
    setSelectedStatuses(new Set());
    setSelectedPriorities(new Set());
    setFiltersOpen(false);
  }, []);

  const handleSortingChange = useCallback(
    (nextSorting: UnifiedTableSorting<TestCaseColumn>, onPageReset?: () => void) => {
      if (nextSorting.column === sorting.column && nextSorting.direction === sorting.direction) return;
      setSorting(nextSorting);
      onPageReset?.();
    },
    [sorting.column, sorting.direction],
  );

  return {
    selectedStatuses,
    setSelectedStatuses,
    selectedPriorities,
    setSelectedPriorities,
    searchQuery,
    setSearchQuery,
    sorting,
    setSorting,
    filtersOpen,
    setFiltersOpen,
    activeFiltersCount,
    toggleFilter,
    clearAllFilters,
    onSortingChange: handleSortingChange,
  };
}
