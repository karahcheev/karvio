import { Plus } from "lucide-react";
import { FilterChecklistSection } from "@/shared/ui/FilterChecklistSection";
import { SearchFiltersToolbar } from "@/shared/ui/SearchFiltersToolbar";
import { Button } from "@/shared/ui/Button";
import { formatDatasetSourceTypeLabel } from "@/shared/datasets";

type SourceType = "manual" | "pytest_parametrize" | "imported";

type Props = Readonly<{
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
  selectedSourceTypes: Set<SourceType>;
  activeFiltersCount: number;
  onToggleSourceType: (value: SourceType) => void;
  onClearFilters: () => void;
  onCreateClick: () => void;
  disabled?: boolean;
}>;

export function DatasetsToolbar({
  searchQuery,
  onSearchQueryChange,
  filtersOpen,
  onFiltersOpenChange,
  selectedSourceTypes,
  activeFiltersCount,
  onToggleSourceType,
  onClearFilters,
  onCreateClick,
  disabled = false,
}: Props) {
  return (
    <SearchFiltersToolbar
      searchQuery={searchQuery}
      onSearchQueryChange={onSearchQueryChange}
      searchPlaceholder="Search datasets..."
      filtersOpen={filtersOpen}
      onFiltersOpenChange={onFiltersOpenChange}
      activeFiltersCount={activeFiltersCount}
      onClearFilters={onClearFilters}
      panelClassName="w-72"
      filtersContent={
        <FilterChecklistSection
          title="Source Type"
          values={["manual", "pytest_parametrize", "imported"]}
          selectedValues={selectedSourceTypes as Set<string>}
          onToggle={(value) => onToggleSourceType(value as SourceType)}
          getLabel={(value) => formatDatasetSourceTypeLabel(value as SourceType)}
        />
      }
      rightSlot={
        <Button type="button" variant="primary" size="md" onClick={onCreateClick} disabled={disabled} leftIcon={<Plus className="h-4 w-4" />}>
          New Dataset
        </Button>
      }
    />
  );
}
