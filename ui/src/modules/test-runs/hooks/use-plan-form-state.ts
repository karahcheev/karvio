import { useEffect, useState } from "react";
import type { SuiteDto, TestCaseDto, TestPlanDto } from "@/shared/api";
import { selectionSetsToPlanPayload, useTestCaseSelectionState } from "./use-test-case-selection-state";

export type { TestCaseSelectionMode as SelectionMode } from "./use-test-case-selection-state";
export { UNSORTED_SUITE_ID } from "./use-test-case-selection-state";

export type PlanFormSubmitPayload = {
  name: string;
  description: string;
  tags: string[];
  milestone_id: string | null;
  suite_ids: string[];
  case_ids: string[];
};

type UsePlanFormStateParams = {
  isOpen: boolean;
  loading: boolean;
  plan: TestPlanDto | null;
  defaultMilestoneId?: string;
  projectId?: string;
  suites: SuiteDto[];
  testCases: TestCaseDto[];
  onClose: () => void;
  onSubmit: (payload: PlanFormSubmitPayload) => void | Promise<void>;
};

function parseTagsInput(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formatTagsForInput(tags: string[]): string {
  return tags.join(", ");
}

export function usePlanFormState({
  isOpen,
  loading,
  plan,
  defaultMilestoneId,
  projectId,
  suites,
  testCases,
  onClose,
  onSubmit,
}: UsePlanFormStateParams) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [milestoneId, setMilestoneId] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setName(plan?.name ?? "");
    setDescription(plan?.description ?? "");
    setTagsInput(formatTagsForInput(plan?.tags ?? []));
    setMilestoneId(plan?.milestone_id ?? defaultMilestoneId ?? "");
  }, [defaultMilestoneId, isOpen, plan]);

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
    clearSuiteAndCaseSelection,
    activeTestCases,
  } = useTestCaseSelectionState({ isOpen, projectId, suites, testCases, plan });

  const resetAndClose = () => {
    setName("");
    setDescription("");
    setTagsInput("");
    setMilestoneId("");
    clearSuiteAndCaseSelection();
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim() || loading) return;

    const tags = parseTagsInput(tagsInput);
    const { suite_ids, case_ids } = selectionSetsToPlanPayload(
      selectedSuiteIds,
      selectedCaseIds,
      casesBySuite,
      selectedTags,
      activeTestCases,
    );

    await onSubmit({
      name: name.trim(),
      description: description.trim() || "",
      tags,
      milestone_id: milestoneId.trim() || null,
      suite_ids,
      case_ids,
    });
  };

  const isValid = name.trim() !== "";

  return {
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
    filteredCases,
    filteredSuitesForTree,
    availableTags,
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
  };
}
