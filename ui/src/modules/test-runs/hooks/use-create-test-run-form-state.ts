import { useMemo } from "react";
import type { SuiteDto, TestCaseDto } from "@/shared/api";
import { UNASSIGNED_ASSIGNEE, useRunMetadataFormState } from "./use-run-metadata-form-state";
import {
  selectionSetsToPlanPayload,
  selectionSetsToRunCaseIds,
  useTestCaseSelectionState,
} from "./use-test-case-selection-state";

type CreateTestRunPayload = {
  name: string;
  description: string;
  environment_id?: string;
  milestone_id?: string | null;
  build: string;
  assignee: string | null;
  selectedSuiteIds: string[];
  selectedCaseIds: string[];
};

type UseCreateTestRunFormStateParams = {
  isOpen: boolean;
  loading: boolean;
  defaultMilestoneId?: string;
  projectId?: string;
  suites: SuiteDto[];
  testCases: TestCaseDto[];
  onClose: () => void;
  onSubmit: (payload: CreateTestRunPayload, startImmediately: boolean) => void;
};

export function useCreateTestRunFormState({
  isOpen,
  loading,
  defaultMilestoneId,
  projectId,
  suites,
  testCases,
  onClose,
  onSubmit,
}: UseCreateTestRunFormStateParams) {
  const {
    state: metadata,
    setName: setRunName,
    setDescription,
    setEnvironmentId,
    setMilestoneId,
    setBuild,
    setAssignee: setSelectedAssignee,
    reset: resetMetadata,
  } = useRunMetadataFormState({
    isOpen,
    getInitialState: () => ({
      name: "",
      description: "",
      environmentId: "",
      milestoneId: defaultMilestoneId ?? "",
      build: "",
      assignee: UNASSIGNED_ASSIGNEE,
    }),
  });

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
    toggleSuite,
    toggleCase,
    toggleCaseInSuite,
    toggleTag,
    toggleExpand,
    selectAll,
    clearAll,
    loadMoreSelectionData,
    totalSelectedCount,
    activeTestCases,
  } = useTestCaseSelectionState({
    isOpen,
    projectId,
    suites,
    testCases,
    plan: null,
    resetUiOnOpen: true,
  });

  const selectedCaseIdsResolved = useMemo(
    () =>
      selectionSetsToRunCaseIds(
        selectedSuiteIds,
        selectedCaseIds,
        casesBySuite,
        selectedTags,
        activeTestCases,
      ),
    [selectedSuiteIds, selectedCaseIds, casesBySuite, selectedTags, activeTestCases],
  );

  const isValid = metadata.name.trim() !== "";

  const resetAndClose = () => {
    resetMetadata();
    onClose();
  };

  const submit = (startImmediately: boolean) => {
    if (!isValid || loading) return;
    const selectionPayload = selectionSetsToPlanPayload(
      selectedSuiteIds,
      selectedCaseIds,
      casesBySuite,
      selectedTags,
      activeTestCases,
    );
    onSubmit(
      {
        name: metadata.name,
        description: metadata.description,
        environment_id: metadata.environmentId.trim() || undefined,
        milestone_id: metadata.milestoneId.trim() || null,
        build: metadata.build,
        assignee: metadata.assignee === UNASSIGNED_ASSIGNEE ? null : metadata.assignee,
        selectedSuiteIds: selectionPayload.suite_ids,
        selectedCaseIds: selectionPayload.case_ids,
      },
      startImmediately,
    );
  };

  return {
    runName: metadata.name,
    setRunName,
    description: metadata.description,
    setDescription,
    environmentId: metadata.environmentId,
    setEnvironmentId,
    milestoneId: metadata.milestoneId,
    setMilestoneId,
    build: metadata.build,
    setBuild,
    selectedAssignee: metadata.assignee,
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
  };
}
