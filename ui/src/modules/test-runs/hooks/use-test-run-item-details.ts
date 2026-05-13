import { useMemo } from "react";
import { useRunCaseQuery, useTestCaseStepsQuery, type TestRunDto } from "@/shared/api";
import type { RunItemSnapshot, RunOverviewRow, SnapshotStep } from "@/modules/test-runs/components";

type UseTestRunItemDetailsParams = {
  run: TestRunDto | null;
  selectedRunItemId: string | null;
  selectedRow: RunOverviewRow | null;
  statusModalRow: RunOverviewRow | null;
  /** Load steps for bulk status modal when all selected run items share this test case id. */
  bulkStepsCaseId: string | null;
};

export function useTestRunItemDetails({
  run,
  selectedRunItemId,
  selectedRow,
  statusModalRow,
  bulkStepsCaseId,
}: UseTestRunItemDetailsParams) {
  const stepsQueryForSnapshot = useTestCaseStepsQuery(selectedRow?.testCaseId ?? undefined);
  const stepsQueryForModal = useTestCaseStepsQuery(statusModalRow?.testCaseId ?? undefined);
  const stepsQueryForBulkModal = useTestCaseStepsQuery(bulkStepsCaseId ?? undefined);
  const runCaseQuery = useRunCaseQuery(selectedRunItemId ?? undefined, Boolean(selectedRunItemId));

  const stepsByCaseId = useMemo(() => {
    const map: Record<string, SnapshotStep[]> = {};
    const snapshotSteps = stepsQueryForSnapshot.data?.steps;
    if (selectedRow && snapshotSteps) {
      map[selectedRow.testCaseId] = snapshotSteps.map((step) => ({
        id: step.id,
        action: step.action,
        expectedResult: step.expected_result,
      }));
    }

    const modalSteps = stepsQueryForModal.data?.steps;
    if (statusModalRow && modalSteps && statusModalRow.testCaseId !== selectedRow?.testCaseId) {
      map[statusModalRow.testCaseId] = modalSteps.map((step) => ({
        id: step.id,
        action: step.action,
        expectedResult: step.expected_result,
      }));
    }

    const bulkSteps = stepsQueryForBulkModal.data?.steps;
    if (bulkStepsCaseId && bulkSteps) {
      const snapshotId = selectedRow?.testCaseId;
      const modalId = statusModalRow?.testCaseId;
      if (bulkStepsCaseId !== snapshotId && bulkStepsCaseId !== modalId) {
        map[bulkStepsCaseId] = bulkSteps.map((step) => ({
          id: step.id,
          action: step.action,
          expectedResult: step.expected_result,
        }));
      }
    }
    return map;
  }, [
    bulkStepsCaseId,
    selectedRow,
    statusModalRow,
    stepsQueryForBulkModal.data,
    stepsQueryForModal.data,
    stepsQueryForSnapshot.data,
  ]);

  const selectedSnapshot = useMemo<RunItemSnapshot | null>(() => {
    if (!selectedRow) return null;
    const detail = runCaseQuery.data;
    return {
      runItemId: selectedRow.id,
      key: selectedRow.key,
      title: selectedRow.title,
      priority: selectedRow.priority,
      status: detail?.status ?? selectedRow.status,
      time: detail?.time ?? selectedRow.time,
      assignee: selectedRow.assignee,
      suite: selectedRow.suite,
      tags: selectedRow.tags,
      environment: run?.environment_name
        ? `${run.environment_name}${run.environment_revision_number != null ? ` · r${run.environment_revision_number}` : ""}`
        : "-",
      build: run?.build ?? "-",
      executionDate: selectedRow.lastExecuted,
      comment: detail?.comment ?? selectedRow.comment,
      steps: stepsByCaseId[selectedRow.testCaseId] ?? [],
      externalIssues: detail?.external_issues ?? selectedRow.externalIssues ?? [],
    };
  }, [run?.build, run?.environment_name, run?.environment_revision_number, runCaseQuery.data, selectedRow, stepsByCaseId]);

  const selectedRunHistory = runCaseQuery.data?.history?.items ?? [];
  const stepsLoadingCaseId =
    (stepsQueryForSnapshot.isLoading && selectedRow ? selectedRow.testCaseId : null) ??
    (stepsQueryForModal.isLoading && statusModalRow ? statusModalRow.testCaseId : null) ??
    (stepsQueryForBulkModal.isLoading && bulkStepsCaseId ? bulkStepsCaseId : null);

  const statusModalSteps = useMemo(() => {
    if (!statusModalRow) return [];
    return stepsByCaseId[statusModalRow.testCaseId] ?? [];
  }, [statusModalRow, stepsByCaseId]);

  const bulkModalSteps = useMemo(() => {
    if (!bulkStepsCaseId) return [];
    return stepsByCaseId[bulkStepsCaseId] ?? [];
  }, [bulkStepsCaseId, stepsByCaseId]);

  const snapshotStepsLoading =
    !!selectedRow && stepsLoadingCaseId === selectedRow.testCaseId && !stepsByCaseId[selectedRow.testCaseId];

  return {
    selectedSnapshot,
    selectedRunHistory,
    historyLoading: Boolean(selectedRunItemId) && runCaseQuery.isLoading,
    statusModalSteps,
    bulkModalSteps,
    stepsByCaseId,
    snapshotStepsLoading,
  };
}
