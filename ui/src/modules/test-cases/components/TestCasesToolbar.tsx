// Test cases list header: search, filters, optional bulk actions, and new test case.
import { Plus } from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { PageHeaderSection } from "@/shared/ui/PageHeader";
import { FilterChecklistSection } from "@/shared/ui/FilterChecklistSection";
import { SearchFiltersToolbar } from "@/shared/ui/SearchFiltersToolbar";
import { formatTestCaseStatusLabel } from "./TestCaseBadges";
import type { SuiteNode } from "../utils/types";
import { Button } from "@/shared/ui/Button";

type Props = Readonly<{
  suites: SuiteNode[];
  selectedSuite: string | null;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  filtersOpen: boolean;
  setFiltersOpen: Dispatch<SetStateAction<boolean>>;
  activeFiltersCount: number;
  selectedStatuses: Set<string>;
  selectedPriorities: Set<string>;
  onToggleFilter: (filterSet: Set<string>, setFilter: (set: Set<string>) => void, value: string) => void;
  setSelectedStatuses: (set: Set<string>) => void;
  setSelectedPriorities: (set: Set<string>) => void;
  onClearAllFilters: () => void;
  onNewTestCaseClick: () => void;
  /** Shown to the right of the filters control (e.g. bulk selection icons). */
  toolbarRightSlot?: ReactNode;
}>;

export function TestCasesToolbar({
  suites,
  selectedSuite,
  searchQuery,
  setSearchQuery,
  filtersOpen,
  setFiltersOpen,
  activeFiltersCount,
  selectedStatuses,
  selectedPriorities,
  onToggleFilter,
  setSelectedStatuses,
  setSelectedPriorities,
  onClearAllFilters,
  onNewTestCaseClick,
  toolbarRightSlot,
}: Props) {
  const selectedSuiteName = suites.find((suite) => suite.id === selectedSuite)?.name;

  return (
    <>
      <PageHeaderSection
        title="Test Cases"
        subtitle={selectedSuite ? `Viewing suite: ${selectedSuiteName}` : "All tests"}
        actions={
          <Button unstyled
            onClick={onNewTestCaseClick}
            className="flex items-center gap-2 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)]"
          >
            <Plus className="h-4 w-4" />
            New Test Case
          </Button>
        }
      />
      <SearchFiltersToolbar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchPlaceholder="Search test cases..."
        filtersOpen={filtersOpen}
        onFiltersOpenChange={setFiltersOpen}
        activeFiltersCount={activeFiltersCount}
        onClearFilters={onClearAllFilters}
        panelClassName="w-72"
        rightSlot={toolbarRightSlot}
        filtersContent={
          <>
            <FilterChecklistSection
              title="Status"
              values={["draft", "active", "archived"]}
              selectedValues={selectedStatuses}
              onToggle={(value) => onToggleFilter(selectedStatuses, setSelectedStatuses, value)}
              getLabel={formatTestCaseStatusLabel}
            />
            <FilterChecklistSection
              title="Priority"
              values={["high", "medium", "low"]}
              selectedValues={selectedPriorities}
              onToggle={(value) => onToggleFilter(selectedPriorities, setSelectedPriorities, value)}
              getLabel={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
            />
          </>
        }
      />
    </>
  );
}
