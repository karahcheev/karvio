// Bulk run result dialog: same fields as single-item "Add Run Result".
import type { RunCaseDto } from "@/shared/api";
import { UpdateRunItemStatusModal } from "./UpdateRunItemStatusModal";

export type RunItemsBulkActionsProps = Readonly<{
  isOpen: boolean;
  loading: boolean;
  currentStatus: RunCaseDto["status"];
  testCaseKey: string;
  testCaseTitle: string;
  descriptionOverride?: string;
  testSteps?: Array<{ id: string; action: string; expectedResult: string }>;
  onClose: () => void;
  onUpdate: (payload: {
    status: RunCaseDto["status"];
    time: string;
    comment: string;
    defectRefs: string[];
    failedStepId?: string;
    actualResult?: string;
    autoCreateJiraIssue?: boolean;
  }) => void;
  runItemStatusLocked: boolean;
  runItemStatusLockedReason?: string;
}>;

export function RunItemsBulkActions({
  isOpen,
  loading,
  currentStatus,
  testCaseKey,
  testCaseTitle,
  descriptionOverride,
  testSteps,
  onClose,
  onUpdate,
  runItemStatusLocked,
  runItemStatusLockedReason,
}: RunItemsBulkActionsProps) {
  return (
    <UpdateRunItemStatusModal
      isOpen={isOpen}
      loading={loading}
      currentStatus={currentStatus}
      testCaseKey={testCaseKey}
      testCaseTitle={testCaseTitle}
      descriptionOverride={descriptionOverride}
      testSteps={testSteps}
      locked={runItemStatusLocked}
      lockedReason={runItemStatusLockedReason}
      onClose={onClose}
      onUpdate={onUpdate}
    />
  );
}
