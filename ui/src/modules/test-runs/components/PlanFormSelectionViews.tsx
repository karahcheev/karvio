import type { SuiteDto, TestCaseDto } from "@/shared/api";
import { SelectableCardList, TagToggleGroup, TreeSelection, type TreeSelectionNode } from "@/shared/ui";
import { UNSORTED_SUITE_ID } from "../hooks/use-test-case-selection-state";

type TreeSelectionViewProps = Readonly<{
  filteredSuitesForTree: SuiteDto[];
  casesBySuite: Map<string, TestCaseDto[]>;
  expandedSuiteIds: Set<string>;
  selectedSuiteIds: Set<string>;
  selectedCaseIds: Set<string>;
  searchQuery: string;
  onToggleExpand: (suiteId: string) => void;
  onToggleSuite: (suiteId: string) => void;
  onToggleCase: (caseId: string) => void;
  onToggleCaseInSuite: (caseId: string, suiteId: string) => void;
}>;

export function PlanTreeSelectionView({
  filteredSuitesForTree,
  casesBySuite,
  expandedSuiteIds,
  selectedSuiteIds,
  selectedCaseIds,
  searchQuery,
  onToggleExpand,
  onToggleSuite,
  onToggleCase,
  onToggleCaseInSuite,
}: TreeSelectionViewProps) {
  const query = searchQuery.trim().toLowerCase();
  const unsortedCases = casesBySuite.get(UNSORTED_SUITE_ID) ?? [];
  const filteredUnsorted = query
    ? unsortedCases.filter((testCase) => testCase.key.toLowerCase().includes(query) || (testCase.title ?? "").toLowerCase().includes(query))
    : unsortedCases;

  const nodes: TreeSelectionNode<TestCaseDto>[] = filteredSuitesForTree.map((suite) => {
    const casesInSuite = casesBySuite.get(suite.id) ?? [];
    const suiteCaseCount = Math.max(casesInSuite.length, suite.active_test_cases_count);
    const suiteChecked = selectedSuiteIds.has(suite.id);
    const checkedCount = casesInSuite.filter((testCase) => selectedCaseIds.has(testCase.id)).length;

    return {
      id: suite.id,
      label: suite.name,
      description: (
        <>
          {suiteCaseCount} case(s)
          {suiteCaseCount > casesInSuite.length ? ` · ${casesInSuite.length} loaded` : ""}
          {checkedCount > 0 && !suiteChecked ? ` · ${checkedCount} selected` : ""}
        </>
      ),
      expanded: expandedSuiteIds.has(suite.id),
      selected: suiteChecked,
      indeterminate: !suiteChecked && checkedCount > 0,
      onToggleExpand: () => onToggleExpand(suite.id),
      onToggleSelected: () => onToggleSuite(suite.id),
      children: casesInSuite
        .filter((testCase) => {
          if (!query) return true;
          return testCase.key.toLowerCase().includes(query) || (testCase.title ?? "").toLowerCase().includes(query);
        })
        .map((testCase) => ({
          id: testCase.id,
          value: testCase,
          selected: selectedCaseIds.has(testCase.id) || suiteChecked,
          highlighted: selectedCaseIds.has(testCase.id),
          onToggle: suiteChecked
            ? () => onToggleCaseInSuite(testCase.id, suite.id)
            : () => onToggleCase(testCase.id),
          render: () => (
            <>
              <div className="font-mono text-sm text-[var(--foreground)]">{testCase.key}</div>
              <div className="truncate text-xs text-[var(--muted-foreground)]">{testCase.title ?? ""}</div>
            </>
          ),
        })),
    };
  });

  if (unsortedCases.length > 0 && !(filteredUnsorted.length === 0 && unsortedCases.length > 0)) {
    nodes.push({
      id: UNSORTED_SUITE_ID,
      label: "Unsorted",
      description: `${casesBySuite.get(UNSORTED_SUITE_ID)?.length ?? 0} case(s)`,
      expanded: expandedSuiteIds.has(UNSORTED_SUITE_ID),
      selected: selectedSuiteIds.has(UNSORTED_SUITE_ID),
      onToggleExpand: () => onToggleExpand(UNSORTED_SUITE_ID),
      onToggleSelected: () => onToggleSuite(UNSORTED_SUITE_ID),
      children: (casesBySuite.get(UNSORTED_SUITE_ID) ?? [])
        .filter((testCase) => {
          if (!query) return true;
          return testCase.key.toLowerCase().includes(query) || (testCase.title ?? "").toLowerCase().includes(query);
        })
        .map((testCase) => ({
          id: testCase.id,
          value: testCase,
          selected: selectedCaseIds.has(testCase.id) || selectedSuiteIds.has(UNSORTED_SUITE_ID),
          highlighted: selectedCaseIds.has(testCase.id),
          onToggle: selectedSuiteIds.has(UNSORTED_SUITE_ID)
            ? () => onToggleCaseInSuite(testCase.id, UNSORTED_SUITE_ID)
            : () => onToggleCase(testCase.id),
          render: () => (
            <>
              <div className="font-mono text-sm text-[var(--foreground)]">{testCase.key}</div>
              <div className="truncate text-xs text-[var(--muted-foreground)]">{testCase.title ?? ""}</div>
            </>
          ),
        })),
    });
  }

  return (
    <TreeSelection
      nodes={nodes}
      emptyState={(
        <div className="rounded-lg border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted-foreground)]">
          {searchQuery.trim() ? "No matching suites or cases" : "No suites or cases found"}
        </div>
      )}
    />
  );
}

type AllCasesSelectionViewProps = Readonly<{
  filteredCases: TestCaseDto[];
  selectedCaseIds: Set<string>;
  suiteNameById: Map<string, string>;
  onToggleCase: (caseId: string) => void;
}>;

export function PlanAllCasesSelectionView({
  filteredCases,
  selectedCaseIds,
  suiteNameById,
  onToggleCase,
}: AllCasesSelectionViewProps) {
  return (
    <SelectableCardList
      items={filteredCases}
      getKey={(testCase) => testCase.id}
      isSelected={(testCase) => selectedCaseIds.has(testCase.id)}
      onToggle={(testCase) => onToggleCase(testCase.id)}
      showSelectedIndicator
      getItemClassName={(_, selected) =>
        selected
          ? "items-center border-2 border-[var(--highlight-border)] bg-[var(--highlight-bg-soft)]"
          : "items-center border-2 border-[var(--border)] hover:border-[var(--border)] hover:bg-[var(--muted)]"
      }
      emptyState={<div className="rounded-lg border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted-foreground)]">No test cases found</div>}
      renderItem={(testCase) => (
        <>
          <div className="font-mono text-sm font-medium text-[var(--foreground)]">{testCase.key}</div>
          <div className="truncate text-sm text-[var(--muted-foreground)]">{testCase.title ?? ""}</div>
          <div className="mt-1 text-xs text-[var(--muted-foreground)]">
            {testCase.suite_id ? suiteNameById.get(testCase.suite_id) ?? "Unknown" : "Unsorted"}
          </div>
        </>
      )}
    />
  );
}

type TagSelectionViewProps = Readonly<{
  availableTags: string[];
  selectedTags: Set<string>;
  tagViewFilteredCases: TestCaseDto[];
  onToggleTag: (tag: string) => void;
}>;

export function TestCaseTagSelectionView({
  availableTags,
  selectedTags,
  tagViewFilteredCases,
  onToggleTag,
}: TagSelectionViewProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--border)] p-2">
        <TagToggleGroup
          tags={availableTags}
          selectedTags={selectedTags}
          onToggle={onToggleTag}
          className="max-h-44 overflow-y-auto pb-1"
          emptyState={(
            <div className="p-1 text-sm text-[var(--muted-foreground)]">
              No tags found in active test cases
            </div>
          )}
        />
      </div>
      {selectedTags.size > 0 ? (
        <div className="rounded-lg border border-[var(--highlight-border)] bg-[var(--highlight-bg-soft)] p-3">
          <div className="mb-2 text-sm font-medium text-[var(--foreground)]">
            Matching tests ({tagViewFilteredCases.length})
          </div>
          <div className="max-h-60 space-y-1.5 overflow-y-auto">
            {tagViewFilteredCases.length === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)]">No test cases match the selected tags.</p>
            ) : (
              tagViewFilteredCases.map((testCase) => (
                <div key={testCase.id} className="flex items-baseline gap-2 text-sm">
                  <span className="shrink-0 font-mono text-xs text-[var(--highlight-foreground)]">{testCase.key}</span>
                  <span className="truncate text-[var(--muted-foreground)]">{testCase.title ?? "—"}</span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
