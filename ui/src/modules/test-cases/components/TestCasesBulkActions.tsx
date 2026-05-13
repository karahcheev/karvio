// Modals for bulk-editing / deleting test cases; actions live in the list toolbar (icons).
import type { TestCaseListItem } from "../utils/types";
import type { TestCasePriority } from "@/shared/domain/priority";
import { TestCasesBulkEditModal } from "./TestCasesBulkEditModal";

type OwnerOption = Readonly<{
  id: string;
  username: string;
}>;

type SuiteWithMeta = Readonly<{
  id: string;
  name: string;
  parent: string | null;
  count: number;
  depth: number;
}>;

type TestCasesBulkActionsProps = Readonly<{
  selectedCount: number;
  bulkEditModalOpen: boolean;
  onBulkEditModalOpenChange: (open: boolean) => void;
  bulkApplySuite: boolean;
  bulkApplyStatus: boolean;
  bulkApplyOwner: boolean;
  bulkApplyTag: boolean;
  bulkApplyPriority: boolean;
  bulkSuiteId: string;
  bulkStatus: TestCaseListItem["status"];
  bulkOwnerId: string;
  bulkTag: string;
  bulkPriority: TestCasePriority;
  suites: SuiteWithMeta[];
  ownerOptions: OwnerOption[];
  isApplying: boolean;
  onBulkApplySuiteChange: (value: boolean) => void;
  onBulkApplyStatusChange: (value: boolean) => void;
  onBulkApplyOwnerChange: (value: boolean) => void;
  onBulkApplyTagChange: (value: boolean) => void;
  onBulkApplyPriorityChange: (value: boolean) => void;
  onBulkSuiteIdChange: (suiteId: string) => void;
  onBulkStatusChange: (status: TestCaseListItem["status"]) => void;
  onBulkOwnerIdChange: (ownerId: string) => void;
  onBulkTagChange: (tag: string) => void;
  onBulkPriorityChange: (priority: TestCasePriority) => void;
  onApply: () => void | Promise<void>;
}>;

export function TestCasesBulkActions({
  selectedCount,
  bulkEditModalOpen,
  onBulkEditModalOpenChange,
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
  suites,
  ownerOptions,
  isApplying,
  onBulkApplySuiteChange,
  onBulkApplyStatusChange,
  onBulkApplyOwnerChange,
  onBulkApplyTagChange,
  onBulkApplyPriorityChange,
  onBulkSuiteIdChange,
  onBulkStatusChange,
  onBulkOwnerIdChange,
  onBulkTagChange,
  onBulkPriorityChange,
  onApply,
}: TestCasesBulkActionsProps) {
  return (
    <TestCasesBulkEditModal
      isOpen={bulkEditModalOpen}
      selectedCount={selectedCount}
      bulkApplySuite={bulkApplySuite}
      bulkApplyStatus={bulkApplyStatus}
      bulkApplyOwner={bulkApplyOwner}
      bulkApplyTag={bulkApplyTag}
      bulkApplyPriority={bulkApplyPriority}
      bulkSuiteId={bulkSuiteId}
      bulkStatus={bulkStatus}
      bulkOwnerId={bulkOwnerId}
      bulkTag={bulkTag}
      bulkPriority={bulkPriority}
      suites={suites}
      ownerOptions={ownerOptions}
      isApplying={isApplying}
      onClose={() => onBulkEditModalOpenChange(false)}
      onBulkApplySuiteChange={onBulkApplySuiteChange}
      onBulkApplyStatusChange={onBulkApplyStatusChange}
      onBulkApplyOwnerChange={onBulkApplyOwnerChange}
      onBulkApplyTagChange={onBulkApplyTagChange}
      onBulkApplyPriorityChange={onBulkApplyPriorityChange}
      onBulkSuiteIdChange={onBulkSuiteIdChange}
      onBulkStatusChange={onBulkStatusChange}
      onBulkOwnerIdChange={onBulkOwnerIdChange}
      onBulkTagChange={onBulkTagChange}
      onBulkPriorityChange={onBulkPriorityChange}
      onApply={onApply}
    />
  );
}
