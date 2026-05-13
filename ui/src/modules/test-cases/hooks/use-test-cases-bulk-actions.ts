import { useCallback, useEffect, useState } from "react";
import { useBulkOperateTestCasesMutation, type TestCasesBulkPayload } from "@/shared/api";
import { useDeleteConfirmation } from "@/shared/lib/use-delete-confirmation";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import { BULK_ACTION_LABELS } from "../utils/constants";
import type { TestCaseListItem } from "../utils/types";
import type { TestCasePriority } from "@/shared/domain/priority";

export function useTestCasesBulkActions(
  projectId: string | undefined,
  selectedTests: Set<string>,
  setSelectedTests: (updater: (prev: Set<string>) => Set<string>) => void,
  onClearPreview?: () => void,
  onCloseActions?: () => void,
) {
  const { confirmDelete } = useDeleteConfirmation();
  const bulkOperateMutation = useBulkOperateTestCasesMutation();

  const [bulkApplySuite, setBulkApplySuite] = useState(false);
  const [bulkApplyStatus, setBulkApplyStatus] = useState(false);
  const [bulkApplyOwner, setBulkApplyOwner] = useState(false);
  const [bulkApplyTag, setBulkApplyTag] = useState(false);
  const [bulkApplyPriority, setBulkApplyPriority] = useState(false);

  const [bulkSuiteId, setBulkSuiteId] = useState<string>("unsorted");
  const [bulkStatus, setBulkStatus] = useState<TestCaseListItem["status"]>("active");
  const [bulkOwnerId, setBulkOwnerId] = useState<string>("unassigned");
  const [bulkTag, setBulkTag] = useState("");
  const [bulkPriority, setBulkPriority] = useState<TestCasePriority>("medium");
  const [bulkEditModalOpen, setBulkEditModalOpen] = useState(false);

  useEffect(() => {
    if (selectedTests.size === 0) setBulkEditModalOpen(false);
  }, [selectedTests.size]);

  const handleApplyBulkAction = useCallback(async () => {
    if (!projectId || selectedTests.size === 0 || bulkOperateMutation.isPending) return;
    const testCaseIds = Array.from(selectedTests);

    const anyField =
      bulkApplySuite || bulkApplyStatus || bulkApplyOwner || bulkApplyTag || bulkApplyPriority;
    if (!anyField) {
      notifyError("Select at least one field to update.", "Nothing to apply.");
      return;
    }
    if (bulkApplyTag && !bulkTag.trim()) {
      notifyError("Tag cannot be empty.", "Failed to apply bulk update.");
      return;
    }

    const payload: TestCasesBulkPayload = {
      project_id: projectId,
      test_case_ids: testCaseIds,
      action: "update",
    };
    if (bulkApplySuite) payload.suite_id = bulkSuiteId === "unsorted" ? null : bulkSuiteId;
    if (bulkApplyStatus) payload.status = bulkStatus;
    if (bulkApplyOwner) payload.owner_id = bulkOwnerId === "unassigned" ? null : bulkOwnerId;
    if (bulkApplyTag) payload.tag = bulkTag.trim();
    if (bulkApplyPriority) payload.priority = bulkPriority;

    try {
      const result = await bulkOperateMutation.mutateAsync(payload);
      setSelectedTests(() => new Set());
      onClearPreview?.();
      onCloseActions?.();
      if (bulkApplyTag) setBulkTag("");
      notifySuccess(`${result.affected_count} test case(s) ${BULK_ACTION_LABELS.update}`);
    } catch (error) {
      notifyError(error, "Failed to apply bulk update.");
    }
  }, [
    projectId,
    selectedTests,
    bulkOperateMutation,
    bulkApplySuite,
    bulkApplyStatus,
    bulkApplyOwner,
    bulkApplyTag,
    bulkApplyPriority,
    bulkSuiteId,
    bulkStatus,
    bulkOwnerId,
    bulkTag,
    bulkPriority,
    setSelectedTests,
    onClearPreview,
    onCloseActions,
  ]);

  const handleBulkDelete = useCallback(async () => {
    if (!projectId || selectedTests.size === 0 || bulkOperateMutation.isPending) return;
    const testCaseIds = Array.from(selectedTests);
    const confirmed = await confirmDelete({
      title: "Delete Test Cases",
      description: `Delete ${testCaseIds.length} selected test case(s)? This action cannot be undone.`,
      confirmLabel: "Delete Test Cases",
    });
    if (!confirmed) return;

    try {
      const result = await bulkOperateMutation.mutateAsync({
        project_id: projectId,
        test_case_ids: testCaseIds,
        action: "delete",
      });
      setSelectedTests(() => new Set());
      onClearPreview?.();
      onCloseActions?.();
      notifySuccess(`${result.affected_count} test case(s) ${BULK_ACTION_LABELS.delete}`);
    } catch (error) {
      notifyError(error, "Failed to delete test cases.");
    }
  }, [
    projectId,
    selectedTests,
    bulkOperateMutation,
    confirmDelete,
    setSelectedTests,
    onClearPreview,
    onCloseActions,
  ]);

  return {
    bulkApplySuite,
    setBulkApplySuite,
    bulkApplyStatus,
    setBulkApplyStatus,
    bulkApplyOwner,
    setBulkApplyOwner,
    bulkApplyTag,
    setBulkApplyTag,
    bulkApplyPriority,
    setBulkApplyPriority,
    bulkSuiteId,
    setBulkSuiteId,
    bulkStatus,
    setBulkStatus,
    bulkOwnerId,
    setBulkOwnerId,
    bulkTag,
    setBulkTag,
    bulkPriority,
    setBulkPriority,
    isApplying: bulkOperateMutation.isPending,
    onApply: handleApplyBulkAction,
    onBulkDelete: handleBulkDelete,
    bulkEditModalOpen,
    onBulkEditModalOpenChange: setBulkEditModalOpen,
    openBulkEditModal: () => setBulkEditModalOpen(true),
  };
}
