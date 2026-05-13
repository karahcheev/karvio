import { useState, type Dispatch, type SetStateAction } from "react";
import {
  getRunCaseRows,
  useAddRunCasesMutation,
  useCreateJiraIssueFromRunCaseMutation,
  useCreateJiraIssueFromRunCasesMutation,
  useDeleteRunCaseMutation,
  useLinkJiraIssueMutation,
  useLinkJiraIssueToRunCasesMutation,
  usePatchRunCaseMutation,
  usePatchRunCaseRowMutation,
} from "@/shared/api";
import { useDeleteConfirmation } from "@/shared/lib/use-delete-confirmation";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import type { RunOverviewRow, SnapshotStep } from "@/modules/test-runs/components";
import type { StatusUpdatePayload } from "./use-update-run-item-status-form-state";

function buildRunCaseCommentFromPayload(payload: StatusUpdatePayload, steps: SnapshotStep[]): string | undefined {
  const baseComment = payload.comment.trim();
  if (payload.status !== "failure") {
    return baseComment || undefined;
  }
  const parts: string[] = [];
  if (payload.failedStepId) {
    const stepIndex = steps.findIndex((step) => step.id === payload.failedStepId);
    const step = stepIndex >= 0 ? steps[stepIndex] : null;
    if (step && stepIndex >= 0) parts.push(`Failed step: Step ${stepIndex + 1} - ${step.action}`);
  }
  if (payload.actualResult?.trim()) parts.push(`Actual result: ${payload.actualResult.trim()}`);
  if (baseComment) parts.push(baseComment);
  return parts.join("\n\n") || undefined;
}

function pickExplicitIssueReference(payload: StatusUpdatePayload): string | undefined {
  const first = payload.defectRefs.find((value) => value.trim().length > 0);
  return first?.trim();
}

/** Stable idempotency key: sorted ids (Sonar S2871 — explicit locale-aware string order). */
function compareRunCaseIdForSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

async function runJiraFollowUpAfterBulkStatusUpdate(
  runId: string,
  updatedRunCaseIds: string[],
  payload: StatusUpdatePayload,
  linkJiraIssueToRunCasesMutation: ReturnType<typeof useLinkJiraIssueToRunCasesMutation>,
  createJiraIssueFromRunCasesMutation: ReturnType<typeof useCreateJiraIssueFromRunCasesMutation>,
): Promise<void> {
  const issueRef = pickExplicitIssueReference(payload);
  if (issueRef) {
    const response = await linkJiraIssueToRunCasesMutation.mutateAsync({
      run_case_ids: updatedRunCaseIds,
      issue_key_or_url: issueRef,
    });
    if (response.items.length > 0) {
      notifySuccess(`Linked Jira issue to ${response.items.length} run item(s).`);
    }
    return;
  }
  if (!payload.autoCreateJiraIssue || payload.status !== "failure") {
    return;
  }
  const idempotencyKey = `${runId}:bulk:${updatedRunCaseIds.slice().sort(compareRunCaseIdForSort).join(",")}`;
  const response = await createJiraIssueFromRunCasesMutation.mutateAsync({
    run_case_ids: updatedRunCaseIds,
    idempotency_key: idempotencyKey,
  });
  if (response.items.length > 0) {
    notifySuccess(`Created one Jira issue and linked ${response.items.length} run item(s).`);
  }
}

type UseTestRunMutationsParams = {
  runId: string | undefined;
  rows: RunOverviewRow[];
  selectedRunItemIds: Set<string>;
  stepsByCaseId: Record<string, SnapshotStep[]>;
  canAddRunItems: boolean;
  runItemStatusLocked: boolean;
  statusModalRow: RunOverviewRow | null;
  statusModalSteps: SnapshotStep[];
  confirmDelete: ReturnType<typeof useDeleteConfirmation>["confirmDelete"];
  setSelectedRunItemIds: Dispatch<SetStateAction<Set<string>>>;
  setOpenActionsRunItemId: Dispatch<SetStateAction<string | null>>;
  setSelectedRunItemId: Dispatch<SetStateAction<string | null>>;
  setStatusModalRunItemId: Dispatch<SetStateAction<string | null>>;
  setRunItemsBulkEditOpen: Dispatch<SetStateAction<boolean>>;
  ensureStepsLoaded: (testCaseId: string) => void;
  onAddRunItemsSuccess: () => void;
};

export function useTestRunMutations({
  runId,
  rows,
  selectedRunItemIds,
  stepsByCaseId,
  canAddRunItems,
  runItemStatusLocked,
  statusModalRow,
  statusModalSteps,
  confirmDelete,
  setSelectedRunItemIds,
  setOpenActionsRunItemId,
  setSelectedRunItemId,
  setStatusModalRunItemId,
  setRunItemsBulkEditOpen,
  ensureStepsLoaded,
  onAddRunItemsSuccess,
}: UseTestRunMutationsParams) {
  const addRunCasesMutation = useAddRunCasesMutation();
  const patchRunCaseMutation = usePatchRunCaseMutation();
  const patchRunCaseRowMutation = usePatchRunCaseRowMutation();
  const deleteRunCaseMutation = useDeleteRunCaseMutation();
  const createJiraIssueFromRunCaseMutation = useCreateJiraIssueFromRunCaseMutation();
  const createJiraIssueFromRunCasesMutation = useCreateJiraIssueFromRunCasesMutation();
  const linkJiraIssueMutation = useLinkJiraIssueMutation();
  const linkJiraIssueToRunCasesMutation = useLinkJiraIssueToRunCasesMutation();
  const [removeRunItemLoadingId, setRemoveRunItemLoadingId] = useState<string | null>(null);

  const patchRowsForRunCase = async (runCaseId: string, payload: StatusUpdatePayload, steps: SnapshotStep[]) => {
    if (!runId) return;
    const allRows: Awaited<ReturnType<typeof getRunCaseRows>>["items"] = [];
    let page = 1;
    let hasNext = true;
    while (hasNext) {
      const response = await getRunCaseRows(runCaseId, { page, pageSize: 200 });
      allRows.push(...response.items);
      hasNext = response.has_next;
      page += 1;
    }
    if (allRows.length === 0) {
      throw new Error("Run case has no rows.");
    }

    const comment = buildRunCaseCommentFromPayload(payload, steps);
    const rowPatch = {
      status: payload.status,
      comment,
      defect_ids: payload.defectRefs.length > 0 ? payload.defectRefs : undefined,
      actual_result: payload.actualResult?.trim() || undefined,
      finished_at: new Date().toISOString(),
    };

    await Promise.all(
      allRows.map((row) =>
        patchRunCaseRowMutation.mutateAsync({
          runCaseRowId: row.id,
          runCaseId,
          runId,
          payload: rowPatch,
        }),
      ),
    );
  };

  const handleBulkUpdateStatus = async (payload: StatusUpdatePayload) => {
    if (!runId || selectedRunItemIds.size === 0) return;
    if (runItemStatusLocked) {
      notifyError("Run results are unavailable for completed or archived runs.", "Add result is unavailable.");
      return;
    }

    const selectedIds = [...selectedRunItemIds];
    try {
      const results = await Promise.allSettled(
        selectedIds.map(async (runCaseId) => {
          const row = rows.find((item) => item.id === runCaseId);
          const steps = row ? (stepsByCaseId[row.testCaseId] ?? []) : [];
          await patchRowsForRunCase(runCaseId, payload, steps);
        }),
      );

      const updatedCount = results.filter((r) => r.status === "fulfilled").length;
      const failedCount = results.filter((r) => r.status === "rejected").length;
      const updatedRunCaseIds = selectedIds.filter((_, index) => results[index]?.status === "fulfilled");

      if (updatedCount > 0) notifySuccess(`Status changed for ${updatedCount} run item(s).`);
      if (failedCount > 0) {
        notifyError(
          `${failedCount} item(s) failed due to transition or permission constraints.`,
          "Bulk status update partially failed.",
        );
      }
      if (updatedRunCaseIds.length > 0) {
        try {
          await runJiraFollowUpAfterBulkStatusUpdate(
            runId,
            updatedRunCaseIds,
            payload,
            linkJiraIssueToRunCasesMutation,
            createJiraIssueFromRunCasesMutation,
          );
        } catch (error) {
          notifyError(error, "Status updated, but Jira action failed.");
        }
      }
    } catch (error) {
      notifyError(error, "Failed to change status for selected run items.");
    } finally {
      setRunItemsBulkEditOpen(false);
    }
  };

  const handleRemoveRunItemFromRun = async (runItemId: string) => {
    if (!runId) return;
    if (runItemStatusLocked) {
      notifyError("Run item removal is unavailable for completed or archived runs.", "Remove is unavailable.");
      return;
    }

    const row = rows.find((item) => item.id === runItemId);
    const targetLabel = row ? `${row.key} - ${row.title}` : "this run item";
    const confirmed = await confirmDelete({
      title: "Remove Run Item",
      description: `Remove ${targetLabel} from this test run?`,
      confirmLabel: "Remove Run Item",
    });
    if (!confirmed) return;

    try {
      setRemoveRunItemLoadingId(runItemId);
      await deleteRunCaseMutation.mutateAsync({ runCaseId: runItemId, runId });
      setSelectedRunItemIds((previous) => {
        if (!previous.has(runItemId)) return previous;
        const next = new Set(previous);
        next.delete(runItemId);
        return next;
      });
      setOpenActionsRunItemId(null);
      setSelectedRunItemId((previous) => (previous === runItemId ? null : previous));
      setStatusModalRunItemId((previous) => (previous === runItemId ? null : previous));
      notifySuccess("Run item removed from test run.");
    } catch (error) {
      notifyError(error, "Failed to remove run item from test run.");
    } finally {
      setRemoveRunItemLoadingId(null);
    }
  };

  const handleBulkDeleteRunItems = async () => {
    if (!runId || selectedRunItemIds.size === 0) return;

    const selectedIds = [...selectedRunItemIds];
    const confirmed = await confirmDelete({
      title: "Remove Run Items",
      description: `Remove ${selectedIds.length} selected run item(s) from this test run?`,
      confirmLabel: "Remove Run Items",
    });
    if (!confirmed) return;

    try {
      const results = await Promise.allSettled(
        selectedIds.map((runCaseId) => deleteRunCaseMutation.mutateAsync({ runCaseId, runId })),
      );
      const removedCount = results.filter((r) => r.status === "fulfilled").length;
      const failedCount = results.filter((r) => r.status === "rejected").length;

      if (removedCount > 0) {
        setSelectedRunItemIds(new Set());
        setOpenActionsRunItemId(null);
        setSelectedRunItemId(null);
        setStatusModalRunItemId(null);
        notifySuccess(`Removed ${removedCount} run item(s) from test run.`);
      }
      if (failedCount > 0) {
        notifyError(`${failedCount} item(s) could not be removed.`, "Bulk delete partially failed.");
      }
    } catch (error) {
      notifyError(error, "Failed to delete selected run items.");
    }
  };

  const handleOpenStatusModal = (runItemId: string) => {
    if (runItemStatusLocked) {
      notifyError("Run results are unavailable for completed or archived runs.", "Add result is unavailable.");
      return;
    }
    setRunItemsBulkEditOpen(false);
    const row = rows.find((item) => item.id === runItemId);
    setStatusModalRunItemId(runItemId);
    if (row) ensureStepsLoaded(row.testCaseId);
  };

  const handleUpdateStatus = async (payload: StatusUpdatePayload) => {
    if (!runId || !statusModalRow) return;
    if (runItemStatusLocked) {
      notifyError("Run case updates are unavailable for completed or archived runs.", "Add result is unavailable.");
      setStatusModalRunItemId(null);
      return;
    }

    try {
      await patchRowsForRunCase(statusModalRow.id, payload, statusModalSteps);
      try {
        const issueRef = pickExplicitIssueReference(payload);
        if (issueRef) {
          await linkJiraIssueMutation.mutateAsync({
            owner_type: "run_case",
            owner_id: statusModalRow.id,
            issue_key_or_url: issueRef,
          });
          notifySuccess("Jira issue linked.");
        } else if (payload.autoCreateJiraIssue && payload.status === "failure") {
          await createJiraIssueFromRunCaseMutation.mutateAsync({
            run_case_id: statusModalRow.id,
            idempotency_key: `${runId}:${statusModalRow.id}`,
          });
          notifySuccess("Jira issue created and linked.");
        }
      } catch (error) {
        notifyError(error, "Status updated, but Jira action failed.");
      }
      notifySuccess("Status updated");
      setStatusModalRunItemId(null);
    } catch (error) {
      notifyError(error, "Failed to save run case status.");
    }
  };

  const handleAddRunItems = async (testCaseIds: string[]) => {
    if (!runId) return;
    if (!canAddRunItems) {
      notifyError(
        "Adding test cases is available only for runs in not_started or in_progress status.",
        "Add run items is unavailable.",
      );
      return;
    }

    const uniqueCaseIds = Array.from(new Set(testCaseIds));
    if (uniqueCaseIds.length === 0) return;

    try {
      await addRunCasesMutation.mutateAsync({ runId, payload: { test_case_ids: uniqueCaseIds } });
      onAddRunItemsSuccess();
      notifySuccess(`Added ${uniqueCaseIds.length} test case(s) to this run.`);
    } catch (error) {
      notifyError(error, "Failed to add test cases to test run.");
    }
  };

  return {
    removeRunItemLoadingId,
    handleBulkUpdateStatus,
    handleRemoveRunItemFromRun,
    handleBulkDeleteRunItems,
    handleOpenStatusModal,
    handleUpdateStatus,
    handleAddRunItems,
    addRunCasesMutation,
    patchRunCaseMutation,
    patchRunCaseRowMutation,
    deleteRunCaseMutation,
  };
}
