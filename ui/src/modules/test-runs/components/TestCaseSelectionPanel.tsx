// Shared suite/test case picker (same UX as the test plan form).
import { FolderTree, List, Tag } from "lucide-react";
import type { SuiteDto, TestCaseDto } from "@/shared/api";
import { LoadMoreFooter, SearchField } from "@/shared/ui";
import type { TestCaseSelectionMode } from "../hooks/use-test-case-selection-state";
import { PlanAllCasesSelectionView, PlanTreeSelectionView, TestCaseTagSelectionView } from "./PlanFormSelectionViews";
import { SelectionBulkActions, SelectionModeTabs } from "./RunFormSections";

type Props = Readonly<{
  loading: boolean;
  bulkTitle?: string;
  selectionMode: TestCaseSelectionMode;
  onSelectionModeChange: (mode: TestCaseSelectionMode) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  casesBySuite: Map<string, TestCaseDto[]>;
  filteredSuitesForTree: SuiteDto[];
  filteredCases: TestCaseDto[];
  expandedSuiteIds: Set<string>;
  selectedSuiteIds: Set<string>;
  selectedCaseIds: Set<string>;
  availableTags: string[];
  selectedTags: Set<string>;
  tagViewFilteredCases: TestCaseDto[];
  loadedCaseCount?: number;
  loadedSuiteCount?: number;
  hasMoreSelectionData?: boolean;
  isFetchingSelectionData?: boolean;
  isFetchingMoreSelectionData?: boolean;
  suiteNameById: Map<string, string>;
  onToggleExpand: (suiteId: string) => void;
  onToggleSuite: (suiteId: string) => void;
  onToggleCase: (caseId: string) => void;
  onToggleCaseInSuite: (caseId: string, suiteId: string) => void;
  onToggleTag: (tag: string) => void;
  onLoadMoreSelectionData?: () => void;
}>;

export function TestCaseSelectionPanel({
  loading,
  bulkTitle = "Select Suites & Test Cases",
  selectionMode,
  onSelectionModeChange,
  searchQuery,
  onSearchQueryChange,
  onSelectAll,
  onClearAll,
  casesBySuite,
  filteredSuitesForTree,
  filteredCases,
  expandedSuiteIds,
  selectedSuiteIds,
  selectedCaseIds,
  availableTags,
  selectedTags,
  tagViewFilteredCases,
  loadedCaseCount,
  loadedSuiteCount,
  hasMoreSelectionData,
  isFetchingSelectionData,
  isFetchingMoreSelectionData,
  suiteNameById,
  onToggleExpand,
  onToggleSuite,
  onToggleCase,
  onToggleCaseInSuite,
  onToggleTag,
  onLoadMoreSelectionData,
}: Props) {
  const searchPlaceholder =
    selectionMode === "tag"
      ? "Filter tests matching selected tags..."
      : "Search suites and cases...";

  return (
    <>
      <SelectionBulkActions
        title={bulkTitle}
        loading={loading}
        selectAllLabel="Select All"
        onSelectAll={onSelectAll}
        onClearAll={onClearAll}
      />
      <SelectionModeTabs
        value={selectionMode}
        onChange={onSelectionModeChange}
        options={[
          { id: "tree", label: "Tree", icon: FolderTree },
          { id: "all", label: "All Cases", icon: List },
          { id: "tag", label: "By Tag", icon: Tag },
        ]}
      />

      <SearchField
        className="mb-3"
        value={searchQuery}
        onChange={(e) => onSearchQueryChange(e.target.value)}
        placeholder={searchPlaceholder}
      />

      {selectionMode === "tree" && (
        <div className="space-y-1">
          <PlanTreeSelectionView
            filteredSuitesForTree={filteredSuitesForTree}
            casesBySuite={casesBySuite}
            expandedSuiteIds={expandedSuiteIds}
            selectedSuiteIds={selectedSuiteIds}
            selectedCaseIds={selectedCaseIds}
            searchQuery={searchQuery}
            onToggleExpand={onToggleExpand}
            onToggleSuite={onToggleSuite}
            onToggleCase={onToggleCase}
            onToggleCaseInSuite={onToggleCaseInSuite}
          />
        </div>
      )}

      {selectionMode === "all" && (
        <div className="space-y-2">
          <PlanAllCasesSelectionView
            filteredCases={filteredCases}
            selectedCaseIds={selectedCaseIds}
            suiteNameById={suiteNameById}
            onToggleCase={onToggleCase}
          />
        </div>
      )}

      {selectionMode === "tag" && (
        <TestCaseTagSelectionView
          availableTags={availableTags}
          selectedTags={selectedTags}
          tagViewFilteredCases={tagViewFilteredCases}
          onToggleTag={onToggleTag}
        />
      )}

      {onLoadMoreSelectionData && typeof loadedCaseCount === "number" ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-[var(--border)]">
          <LoadMoreFooter
            loadedCount={loadedCaseCount}
            noun="cases"
            hasMore={Boolean(hasMoreSelectionData)}
            isLoadingMore={Boolean(isFetchingMoreSelectionData)}
            onLoadMore={onLoadMoreSelectionData}
            hint={`${loadedSuiteCount ?? 0} suites${isFetchingSelectionData ? " · refreshing" : ""}`}
          />
        </div>
      ) : null}
    </>
  );
}
