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
  bulkSuiteId: string;
  bulkStatus: TestCaseListItem["status"];
  bulkOwnerId: string;
  bulkTag: string;
  bulkPriority: TestCasePriority;
  suites: SuiteWithMeta[];
  ownerOptions: OwnerOption[];
  isApplying: boolean;
  onClose: () => void;
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
  bulkSuiteId,
  bulkStatus,
  bulkOwnerId,
  bulkTag,
  bulkPriority,
  suites,
  ownerOptions,
  isApplying,
  onClose,
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
}: Props) {
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
        </div>
      </StandardModalLayout>
    </AppModal>
  );
}
