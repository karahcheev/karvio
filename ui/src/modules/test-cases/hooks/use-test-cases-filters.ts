import { useCallback, useState } from "react";
import type { UnifiedTableSorting } from "@/shared/ui/Table";
import type { TestCaseColumn } from "../utils/types";

export function useTestCasesFilters() {
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [selectedPriorities, setSelectedPriorities] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectedComponents, setSelectedComponents] = useState<Set<string>>(new Set());
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [includeNestedSuites, setIncludeNestedSuites] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sorting, setSorting] = useState<UnifiedTableSorting<TestCaseColumn>>({
    column: "lastRun",
    direction: "desc",
  });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFiltersCount =
    selectedStatuses.size +
    selectedPriorities.size +
    selectedTags.size +
    selectedTypes.size +
    selectedProducts.size +
    selectedComponents.size +
    (selectedOwnerId ? 1 : 0) +
    (includeNestedSuites ? 0 : 1);

  const toggleFilter = useCallback(
    (filterSet: Set<string>, setFilter: (set: Set<string>) => void, value: string) => {
      const next = new Set(filterSet);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      setFilter(next);
    },
    [],
  );

  const toggleOwner = useCallback((value: string) => {
    setSelectedOwnerId((current) => (current === value ? null : value));
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedStatuses(new Set());
    setSelectedPriorities(new Set());
    setSelectedTags(new Set());
    setSelectedTypes(new Set());
    setSelectedProducts(new Set());
    setSelectedComponents(new Set());
    setSelectedOwnerId(null);
    setIncludeNestedSuites(true);
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
    selectedTags,
    setSelectedTags,
    selectedTypes,
    setSelectedTypes,
    selectedProducts,
    setSelectedProducts,
    selectedComponents,
    setSelectedComponents,
    selectedOwnerId,
    setSelectedOwnerId,
    toggleOwner,
    includeNestedSuites,
    setIncludeNestedSuites,
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
