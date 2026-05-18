// Test plans toolbar: search and tag filters.
import { FilterChecklistSection } from "@/shared/ui/FilterChecklistSection";
import { SearchFiltersToolbar } from "@/shared/ui/SearchFiltersToolbar";

type Props = Readonly<{
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
  activeFiltersCount: number;
  selectedTags: Set<string>;
  availableTags: string[];
  onToggleTag: (value: string) => void;
  onClearAllFilters: () => void;
}>;

export function TestPlansToolbar({
  searchQuery,
  onSearchQueryChange,
  filtersOpen,
  onFiltersOpenChange,
  activeFiltersCount,
  selectedTags,
  availableTags,
  onToggleTag,
  onClearAllFilters,
}: Props) {
  return (
    <SearchFiltersToolbar
      searchQuery={searchQuery}
      onSearchQueryChange={onSearchQueryChange}
      searchPlaceholder="Search plans by name or description..."
      filtersOpen={filtersOpen}
      onFiltersOpenChange={onFiltersOpenChange}
      activeFiltersCount={activeFiltersCount}
      onClearFilters={onClearAllFilters}
      panelClassName="w-72"
      filtersContent={
        <FilterChecklistSection
          title="Tags"
          values={availableTags}
          selectedValues={selectedTags}
          onToggle={onToggleTag}
          emptyLabel="No tags found"
        />
      }
    />
  );
}
