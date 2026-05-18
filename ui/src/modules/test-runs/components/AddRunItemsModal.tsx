// Modal to add test cases to an existing run — supports suite tree, flat list, and tag modes.
import { Plus } from "lucide-react";
import { AppModal, StandardModalLayout } from "@/shared/ui/Modal";
import { Button } from "@/shared/ui/Button";
import { useAddRunItemsModalState } from "../hooks/use-add-run-items-modal-state";
import { TestCaseSelectionPanel } from "./TestCaseSelectionPanel";

type AddRunItemsModalProps = Readonly<{
  isOpen: boolean;
  projectId: string | undefined;
  excludeTestCaseIds: string[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (testCaseIds: string[]) => void;
}>;

export function AddRunItemsModal({
  isOpen,
  projectId,
  excludeTestCaseIds,
  loading,
  onClose,
  onSubmit,
}: AddRunItemsModalProps) {
  const {
    selectionMode,
    setSelectionMode,
    selectedSuiteIds,
    selectedCaseIds,
    selectedTags,
    expandedSuiteIds,
    searchQuery,
    setSearchQuery,
    casesBySuite,
    suiteNameById,
    availableTags,
    filteredCases,
    filteredSuitesForTree,
    tagViewFilteredCases,
    loadedCaseCount,
    loadedSuiteCount,
    hasMoreSelectionData,
    isFetchingSelectionData,
    isFetchingMoreSelectionData,
    newCaseCount,
    alreadyInRunCount,
    resetAndClose,
    toggleSuite,
    toggleCase,
    toggleCaseInSuite,
    toggleTag,
    toggleExpand,
    selectAll,
    clearAll,
    loadMoreSelectionData,
    submit,
  } = useAddRunItemsModalState({
    isOpen,
    projectId,
    excludeTestCaseIds,
    loading,
    onClose,
    onSubmit,
  });

  if (!isOpen) return null;

  return (
    <AppModal
      isOpen={isOpen}
      onClose={resetAndClose}
      contentClassName="flex h-[85vh] max-w-5xl flex-col overflow-hidden rounded-xl sm:max-w-5xl"
    >
      <StandardModalLayout
        title="Add Test Cases"
        description="Add active test cases to this existing run"
        onClose={resetAndClose}
        closeButtonDisabled={loading}
        footerClassName="justify-end"
        footer={(
          <>
            <div className="mr-auto text-xs text-[var(--muted-foreground)]">
              {newCaseCount > 0 ? (
                <>
                  <span>{newCaseCount} case{newCaseCount !== 1 ? "s" : ""} to add</span>
                  {alreadyInRunCount > 0 && (
                    <span className="ml-1">· {alreadyInRunCount} already in run</span>
                  )}
                </>
              ) : alreadyInRunCount > 0 ? (
                <span>All selected cases are already in this run</span>
              ) : (
                <span>No cases selected</span>
              )}
            </div>
            <Button
              unstyled
              type="button"
              onClick={resetAndClose}
              disabled={loading}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </Button>
            <Button
              unstyled
              type="button"
              onClick={submit}
              disabled={loading || newCaseCount === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {loading ? "Adding..." : "Add to Run"}
            </Button>
          </>
        )}
      >
        <TestCaseSelectionPanel
          loading={loading}
          bulkTitle="Select Test Cases"
          selectionMode={selectionMode}
          onSelectionModeChange={setSelectionMode}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onSelectAll={selectAll}
          onClearAll={clearAll}
          casesBySuite={casesBySuite}
          filteredSuitesForTree={filteredSuitesForTree}
          filteredCases={filteredCases}
          expandedSuiteIds={expandedSuiteIds}
          selectedSuiteIds={selectedSuiteIds}
          selectedCaseIds={selectedCaseIds}
          availableTags={availableTags}
          selectedTags={selectedTags}
          tagViewFilteredCases={tagViewFilteredCases}
          loadedCaseCount={loadedCaseCount}
          loadedSuiteCount={loadedSuiteCount}
          hasMoreSelectionData={hasMoreSelectionData}
          isFetchingSelectionData={isFetchingSelectionData}
          isFetchingMoreSelectionData={isFetchingMoreSelectionData}
          suiteNameById={suiteNameById}
          onToggleExpand={toggleExpand}
          onToggleSuite={toggleSuite}
          onToggleCase={toggleCase}
          onToggleCaseInSuite={toggleCaseInSuite}
          onToggleTag={toggleTag}
          onLoadMoreSelectionData={loadMoreSelectionData}
        />
      </StandardModalLayout>
    </AppModal>
  );
}
