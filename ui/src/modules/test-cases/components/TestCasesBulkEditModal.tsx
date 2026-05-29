// Modal for bulk-editing selected test cases: any combination of suite, status, owner, tag, priority.
import type { ReactNode } from "react";
import { invokeMaybeAsync } from "@/shared/lib/invoke-maybe-async";
import {
  AppModal,
  Button,
  Card,
  CardContent,
  CheckboxField,
  FieldHint,
  SelectField,
  StandardModalLayout,
  TextField,
} from "@/shared/ui";
import { formatTestCaseStatusLabel } from "./TestCaseBadges";
import type { TestCaseListItem } from "../utils/types";
import {
  formatPriorityLabel,
  PRIORITY_OPTIONS,
  type TestCasePriority,
} from "@/shared/domain/priority";

type OwnerOption = {
  id: string;
  username: string;
};

type CatalogOption = {
  id: string;
  name: string;
};

type SuiteWithMeta = {
  id: string;
  name: string;
  parent: string | null;
  count: number;
  depth: number;
};

type Props = Readonly<{
  isOpen: boolean;
  selectedCount: number;
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
  onClose: () => void;
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

function BulkFieldToggle({
  id,
  checked,
  onCheckedChange,
  disabled,
  label,
  children,
}: Readonly<{
  id: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
  children?: ReactNode;
}>) {
  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardContent className="space-y-2 px-3 py-3">
        <CheckboxField
          id={id}
          label={label}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onCheckedChange(event.target.checked)}
        />
        {checked && children ? <div className="border-t border-[color-mix(in_srgb,var(--border),transparent_40%)] pt-2 sm:pl-6">{children}</div> : null}
      </CardContent>
    </Card>
  );
}

export function TestCasesBulkEditModal({
  isOpen,
  selectedCount,
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
  onClose,
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
}: Props) {
  const toggleComponent = (componentId: string, checked: boolean) => {
    if (checked) {
      if (bulkComponentIds.includes(componentId)) return;
      onBulkComponentIdsChange([...bulkComponentIds, componentId]);
    } else {
      onBulkComponentIdsChange(bulkComponentIds.filter((id) => id !== componentId));
    }
  };
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="flex max-h-[min(90dvh,36rem)] min-h-0 w-full max-w-lg flex-col"
    >
      <StandardModalLayout
        className="min-h-0 flex-1"
        title="Edit selected test cases"
        description={`Changes apply to ${selectedCount} selected test case(s).`}
        onClose={onClose}
        closeButtonDisabled={isApplying}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isApplying}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={() => invokeMaybeAsync(() => onApply())} disabled={isApplying}>
              {isApplying ? "Applying…" : "Apply"}
            </Button>
          </>
        }
        bodyClassName="min-h-0"
      >
        <div className="space-y-3 pb-1">
          <FieldHint>
            Turn on each field you want to change. You can update several at once in a single request.
          </FieldHint>

          <BulkFieldToggle
            id="bulk-apply-suite"
            checked={bulkApplySuite}
            onCheckedChange={onBulkApplySuiteChange}
            disabled={isApplying}
            label="Suite"
          >
            <SelectField
              label="Move to suite"
              value={bulkSuiteId}
              onChange={(event) => onBulkSuiteIdChange(event.target.value)}
              disabled={isApplying}
            >
              <option value="unsorted">Unsorted</option>
              {suites.map((suite) => (
                <option key={suite.id} value={suite.id}>
                  {suite.name}
                </option>
              ))}
            </SelectField>
          </BulkFieldToggle>

          <BulkFieldToggle
            id="bulk-apply-status"
            checked={bulkApplyStatus}
            onCheckedChange={onBulkApplyStatusChange}
            disabled={isApplying}
            label="Status"
          >
            <SelectField
              label="Status"
              value={bulkStatus}
              onChange={(event) => onBulkStatusChange(event.target.value as TestCaseListItem["status"])}
              disabled={isApplying}
            >
              <option value="draft">{formatTestCaseStatusLabel("draft")}</option>
              <option value="active">{formatTestCaseStatusLabel("active")}</option>
              <option value="archived">{formatTestCaseStatusLabel("archived")}</option>
            </SelectField>
          </BulkFieldToggle>

          <BulkFieldToggle
            id="bulk-apply-owner"
            checked={bulkApplyOwner}
            onCheckedChange={onBulkApplyOwnerChange}
            disabled={isApplying}
            label="Owner"
          >
            <SelectField
              label="Owner"
              value={bulkOwnerId}
              onChange={(event) => onBulkOwnerIdChange(event.target.value)}
              disabled={isApplying}
            >
              <option value="unassigned">Unassigned</option>
              {ownerOptions.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.username}
                </option>
              ))}
            </SelectField>
          </BulkFieldToggle>

          <BulkFieldToggle
            id="bulk-apply-tag"
            checked={bulkApplyTag}
            onCheckedChange={onBulkApplyTagChange}
            disabled={isApplying}
            label="Add tag"
          >
            <TextField
              label="Tag"
              value={bulkTag}
              onChange={(event) => onBulkTagChange(event.target.value)}
              placeholder="Tag name…"
              disabled={isApplying}
              required
            />
          </BulkFieldToggle>

          <BulkFieldToggle
            id="bulk-apply-priority"
            checked={bulkApplyPriority}
            onCheckedChange={onBulkApplyPriorityChange}
            disabled={isApplying}
            label="Priority"
          >
            <SelectField
              label="Priority"
              value={bulkPriority}
              onChange={(event) => onBulkPriorityChange(event.target.value as TestCasePriority)}
              disabled={isApplying}
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {formatPriorityLabel(opt)}
                </option>
              ))}
            </SelectField>
          </BulkFieldToggle>

          <BulkFieldToggle
            id="bulk-apply-product"
            checked={bulkApplyProduct}
            onCheckedChange={onBulkApplyProductChange}
            disabled={isApplying}
            label="Primary product"
          >
            <SelectField
              label="Primary product"
              value={bulkProductId}
              onChange={(event) => onBulkProductIdChange(event.target.value)}
              disabled={isApplying}
            >
              <option value="none">None</option>
              {productOptions.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </SelectField>
          </BulkFieldToggle>

          <BulkFieldToggle
            id="bulk-apply-components"
            checked={bulkApplyComponents}
            onCheckedChange={onBulkApplyComponentsChange}
            disabled={isApplying}
            label="Add components"
          >
            <div className="space-y-2">
              <FieldHint>
                Selected components are added as coverage to each test case. Existing coverage is kept.
              </FieldHint>
              {componentOptions.length === 0 ? (
                <div className="text-sm text-[var(--muted-foreground)]">No components available.</div>
              ) : (
                <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                  {componentOptions.map((component) => (
                    <CheckboxField
                      key={component.id}
                      id={`bulk-component-${component.id}`}
                      label={component.name}
                      checked={bulkComponentIds.includes(component.id)}
                      disabled={isApplying}
                      onChange={(event) => toggleComponent(component.id, event.target.checked)}
                    />
                  ))}
                </div>
              )}
            </div>
          </BulkFieldToggle>
        </div>
      </StandardModalLayout>
    </AppModal>
  );
}
