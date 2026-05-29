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

type CatalogOption = Readonly<{
  id: string;
  name: string;
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
  bulkApplyProduct: boolean;
  bulkApplyComponents: boolean;
  bulkSuiteId: string;
  bulkStatus: TestCaseListItem["status"];
  bulkOwnerId: string;
  bulkTag: string;
  bulkPriority: TestCasePriority;
  bulkProductId: string;
  bulkComponentIds: string[];
  suites: SuiteWithMeta[];
  ownerOptions: OwnerOption[];
  productOptions: CatalogOption[];
  componentOptions: CatalogOption[];
  isApplying: boolean;
  onBulkApplySuiteChange: (value: boolean) => void;
  onBulkApplyStatusChange: (value: boolean) => void;
  onBulkApplyOwnerChange: (value: boolean) => void;
  onBulkApplyTagChange: (value: boolean) => void;
  onBulkApplyPriorityChange: (value: boolean) => void;
  onBulkApplyProductChange: (value: boolean) => void;
  onBulkApplyComponentsChange: (value: boolean) => void;
  onBulkSuiteIdChange: (suiteId: string) => void;
  onBulkStatusChange: (status: TestCaseListItem["status"]) => void;
  onBulkOwnerIdChange: (ownerId: string) => void;
  onBulkTagChange: (tag: string) => void;
  onBulkPriorityChange: (priority: TestCasePriority) => void;
  onBulkProductIdChange: (productId: string) => void;
  onBulkComponentIdsChange: (componentIds: string[]) => void;
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
  bulkApplyProduct,
  bulkApplyComponents,
  bulkSuiteId,
  bulkStatus,
  bulkOwnerId,
  bulkTag,
  bulkPriority,
  bulkProductId,
  bulkComponentIds,
  suites,
  ownerOptions,
  productOptions,
  componentOptions,
  isApplying,
  onBulkApplySuiteChange,
  onBulkApplyStatusChange,
  onBulkApplyOwnerChange,
  onBulkApplyTagChange,
  onBulkApplyPriorityChange,
  onBulkApplyProductChange,
  onBulkApplyComponentsChange,
  onBulkSuiteIdChange,
  onBulkStatusChange,
  onBulkOwnerIdChange,
  onBulkTagChange,
  onBulkPriorityChange,
  onBulkProductIdChange,
  onBulkComponentIdsChange,
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
      bulkApplyProduct={bulkApplyProduct}
      bulkApplyComponents={bulkApplyComponents}
      bulkSuiteId={bulkSuiteId}
      bulkStatus={bulkStatus}
      bulkOwnerId={bulkOwnerId}
      bulkTag={bulkTag}
      bulkPriority={bulkPriority}
      bulkProductId={bulkProductId}
      bulkComponentIds={bulkComponentIds}
      suites={suites}
      ownerOptions={ownerOptions}
      productOptions={productOptions}
      componentOptions={componentOptions}
      isApplying={isApplying}
      onClose={() => onBulkEditModalOpenChange(false)}
      onBulkApplySuiteChange={onBulkApplySuiteChange}
      onBulkApplyStatusChange={onBulkApplyStatusChange}
      onBulkApplyOwnerChange={onBulkApplyOwnerChange}
      onBulkApplyTagChange={onBulkApplyTagChange}
      onBulkApplyPriorityChange={onBulkApplyPriorityChange}
      onBulkApplyProductChange={onBulkApplyProductChange}
      onBulkApplyComponentsChange={onBulkApplyComponentsChange}
      onBulkSuiteIdChange={onBulkSuiteIdChange}
      onBulkStatusChange={onBulkStatusChange}
      onBulkOwnerIdChange={onBulkOwnerIdChange}
      onBulkTagChange={onBulkTagChange}
      onBulkPriorityChange={onBulkPriorityChange}
      onBulkProductIdChange={onBulkProductIdChange}
      onBulkComponentIdsChange={onBulkComponentIdsChange}
      onApply={onApply}
    />
  );
}
