// Full-screen modal to configure a new test run and pick cases.
import type { SuiteDto, TestCaseDto } from "@/shared/api";
import { AppModal, WizardModalLayout } from "@/shared/ui/Modal";
import { RunMetadataFields, RunSubmitActions } from "./RunFormSections";
import { TestCaseSelectionPanel } from "./TestCaseSelectionPanel";
import { useCreateTestRunFormState } from "../hooks/use-create-test-run-form-state";

export type CreateTestRunPayload = {
  name: string;
  description: string;
  environment_id?: string;
  milestone_id?: string | null;
  build: string;
  assignee: string | null;
  selectedSuiteIds: string[];
  selectedCaseIds: string[];
};

export type AssigneeOption = Readonly<{
  id: string;
  label: string;
}>;

export type EnvironmentOption = Readonly<{
  id: string;
  label: string;
  revisionNumber: number | null | undefined;
}>;

export type MilestoneOption = Readonly<{
  id: string;
  label: string;
}>;

type CreateTestRunModalProps = Readonly<{
  isOpen: boolean;
  loading: boolean;
  defaultMilestoneId?: string;
  projectId?: string;
  suites: SuiteDto[];
  testCases: TestCaseDto[];
  assigneeOptions: AssigneeOption[];
  environmentOptions: EnvironmentOption[];
  milestoneOptions: MilestoneOption[];
  onClose: () => void;
  onSubmit: (payload: CreateTestRunPayload, startImmediately: boolean) => void;
}>;

export function CreateTestRunModal({
  isOpen,
  loading,
  defaultMilestoneId,
  projectId,
  suites,
  testCases,
  assigneeOptions,
  environmentOptions,
  milestoneOptions,
  onClose,
  onSubmit,
}: CreateTestRunModalProps) {
  const {
    runName,
    setRunName,
    description,
    setDescription,
    environmentId,
    setEnvironmentId,
    milestoneId,
    setMilestoneId,
    build,
    setBuild,
    selectedAssignee,
    setSelectedAssignee,
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
    selectedCaseIdsResolved,
    totalSelectedCount,
    isValid,
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
  } = useCreateTestRunFormState({
    isOpen,
    loading,
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
        title="Create Test Run"
        description="Configure a run now and add test cases immediately or later"
        onClose={resetAndClose}
        closeButtonDisabled={loading}
        titleClassName="text-2xl"
        sidebar={(
          <RunMetadataFields
            values={{
              name: runName,
              description,
              environmentId,
              milestoneId,
              build,
              assignee: selectedAssignee,
            }}
            assigneeOptions={assigneeOptions}
            environmentOptions={environmentOptions}
            milestoneOptions={milestoneOptions}
            onNameChange={setRunName}
            onDescriptionChange={setDescription}
            onEnvironmentChange={setEnvironmentId}
            onMilestoneChange={setMilestoneId}
            onBuildChange={setBuild}
            onAssigneeChange={setSelectedAssignee}
            showHeading
          />
        )}
        footer={(
          <>
            <div className="mr-auto max-w-[55%] text-xs text-[var(--muted-foreground)]">
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
              {selectedSuiteIds.size === 0 && selectedCaseIdsResolved.length === 0 ? (
                <span className="mt-1 block text-[var(--muted-foreground)]">
                  No cases in selection. You can create an empty run and add cases later.
                </span>
              ) : null}
            </div>
            <RunSubmitActions
              loading={loading}
              disabled={!isValid || loading}
              onCancel={resetAndClose}
              onCreate={() => submit(false)}
              onCreateAndStart={() => submit(true)}
            />
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
