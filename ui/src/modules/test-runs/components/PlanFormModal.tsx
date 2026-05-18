// Create or edit a test plan: metadata and suite/case selection.
import type { SuiteDto, TestCaseDto, TestPlanDto } from "@/shared/api";
import { AppModal, WizardModalLayout } from "@/shared/ui/Modal";
import { Button } from "@/shared/ui/Button";
import { SelectField, TextareaField, TextField } from "@/shared/ui";
import { TestCaseSelectionPanel } from "./TestCaseSelectionPanel";
import { type PlanFormSubmitPayload, usePlanFormState } from "../hooks/use-plan-form-state";

type Props = Readonly<{
  isOpen: boolean;
  loading: boolean;
  plan: TestPlanDto | null;
  defaultMilestoneId?: string;
  projectId?: string;
  suites: SuiteDto[];
  testCases?: TestCaseDto[];
  milestoneOptions: Array<{ id: string; label: string }>;
  onClose: () => void;
  onSubmit: (payload: PlanFormSubmitPayload) => void | Promise<void>;
}>;

export function PlanFormModal({
  isOpen,
  loading,
  plan,
  defaultMilestoneId,
  projectId,
  suites,
  testCases = [],
  milestoneOptions,
  onClose,
  onSubmit,
}: Props) {
  const {
    name,
    setName,
    description,
    setDescription,
    tagsInput,
    setTagsInput,
    milestoneId,
    setMilestoneId,
    selectionMode,
    setSelectionMode,
    selectedSuiteIds,
    selectedCaseIds,
    selectedTags,
    expandedSuiteIds,
    searchQuery,
    setSearchQuery,
    resetAndClose,
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
    toggleSuite,
    toggleCase,
    toggleCaseInSuite,
    toggleTag,
    toggleExpand,
    selectAll,
    clearAll,
    loadMoreSelectionData,
    handleSubmit,
    isValid,
    totalSelectedCount,
  } = usePlanFormState({
    isOpen,
    loading,
    plan,
    defaultMilestoneId,
    projectId,
    suites,
    testCases,
    onClose,
    onSubmit,
  });

  if (!isOpen) return null;

  return (
    <AppModal
      isOpen={isOpen}
      onClose={resetAndClose}
      contentClassName="flex h-[90vh] max-w-5xl flex-col overflow-hidden rounded-xl sm:max-w-5xl"
    >
      <WizardModalLayout
        title={plan ? "Edit Test Plan" : "New Test Plan"}
        onClose={resetAndClose}
        closeButtonDisabled={loading}
        titleClassName="text-2xl"
        sidebar={(
          <div className="space-y-4">
            <TextField
              label="Plan Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Regression Plan"
              autoFocus
            />

            <TextareaField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />

            <TextField
              label="Tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g., regression, smoke (comma-separated)"
              hint="Optional tags for filtering and organization"
            />

            <SelectField
              label="Milestone"
              value={milestoneId}
              onChange={(event) => setMilestoneId(event.target.value)}
              hint="Optional release context for this plan"
            >
              <option value="">No milestone</option>
              {milestoneOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </div>
        )}
        footer={(
          <>
            <div className="mr-auto text-xs text-[var(--muted-foreground)]">
              {selectedSuiteIds.size > 0 && (
                <span>
                  {selectedSuiteIds.size} suite{selectedSuiteIds.size !== 1 ? "s" : ""}
                </span>
              )}
              {selectedSuiteIds.size > 0 && selectedCaseIds.size > 0 && " · "}
              {selectedCaseIds.size > 0 && (
                <span>
                  {selectedCaseIds.size} case{selectedCaseIds.size !== 1 ? "s" : ""} selected
                </span>
              )}
              {(selectedSuiteIds.size > 0 || selectedCaseIds.size > 0) && selectedTags.size > 0 && " · "}
              {selectedTags.size > 0 && (
                <span>
                  {selectedTags.size} tag{selectedTags.size !== 1 ? "s" : ""}
                </span>
              )}
              {totalSelectedCount > 0 && (
                <span className="ml-1 text-[var(--muted-foreground)]">
                  (~{totalSelectedCount} total in run)
                </span>
              )}
              {selectedSuiteIds.size === 0 && totalSelectedCount === 0 ? (
                <span className="mt-1 block text-[var(--muted-foreground)]">
                  No cases selected. You can create an empty plan and add cases later.
                </span>
              ) : null}
            </div>
            <Button
              unstyled
              onClick={resetAndClose}
              disabled={loading}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-50"
            >
              Cancel
            </Button>
            <Button
              unstyled
              onClick={handleSubmit}
              disabled={!isValid || loading}
              className="rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {(() => {
                if (loading) return "Saving...";
                if (plan) return "Save";
                return "Create";
              })()}
            </Button>
          </>
        )}
        footerClassName="justify-end"
      >
        <TestCaseSelectionPanel
          loading={loading}
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
      </WizardModalLayout>
    </AppModal>
  );
}
