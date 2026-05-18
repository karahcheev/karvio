import { useMemo } from "react";
import {
  selectionSetsToRunCaseIds,
  useTestCaseSelectionState,
} from "./use-test-case-selection-state";

type Params = {
  isOpen: boolean;
  projectId: string | undefined;
  excludeTestCaseIds: string[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (testCaseIds: string[]) => void;
};

export function useAddRunItemsModalState({
  isOpen,
  projectId,
  excludeTestCaseIds,
  loading,
  onClose,
  onSubmit,
}: Params) {
  const excludeSet = useMemo(() => new Set(excludeTestCaseIds), [excludeTestCaseIds]);

  const selection = useTestCaseSelectionState({
    isOpen,
    projectId,
    suites: [],
    testCases: [],
    plan: null,
    resetUiOnOpen: true,
    excludeTestCaseIds,
  });

  const resolvedIds = useMemo(
    () =>
      selectionSetsToRunCaseIds(
        selection.selectedSuiteIds,
        selection.selectedCaseIds,
        selection.casesBySuite,
        selection.selectedTags,
        selection.activeTestCases,
      ),
    [
      selection.selectedSuiteIds,
      selection.selectedCaseIds,
      selection.casesBySuite,
      selection.selectedTags,
      selection.activeTestCases,
    ],
  );

  const newCaseIds = useMemo(
    () => resolvedIds.filter((id) => !excludeSet.has(id)),
    [resolvedIds, excludeSet],
  );

  const alreadyInRunCount = resolvedIds.length - newCaseIds.length;

  const resetAndClose = () => {
    if (loading) return;
    onClose();
  };

  const submit = () => {
    if (newCaseIds.length === 0 || loading) return;
    onSubmit(newCaseIds);
  };

  return {
    ...selection,
    newCaseIds,
    newCaseCount: newCaseIds.length,
    alreadyInRunCount,
    resetAndClose,
    submit,
  };
}
