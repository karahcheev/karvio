import { formatTestCaseStatusLabel } from "./TestCaseBadges";
import type { TestCaseDetailsSharedProps } from "./TestCaseDetailsForm.types";
import { FormField, SelectField, TagInput, TextField } from "@/shared/ui";
import {
  TestCaseAutomationIdField,
  TestCaseExpectedTimeField,
  TestCaseTemplateTypeField,
  TestCaseTypePriorityFields,
} from "./TestCaseCommonFormFields";
import { TestCaseCoverageEditor } from "./TestCaseCoverageEditor";

export function TestCaseDetailsEditForm({
  title,
  onTitleChange,
  templateType,
  onTemplateTypeChange,
  automationId,
  onAutomationIdChange,
  time,
  onTimeChange,
  status,
  onStatusChange,
  priority,
  onPriorityChange,
  effectiveTestCaseType,
  testCaseTypeLocked,
  onTestCaseTypeChange,
  availableStatusOptions,
  tags,
  tagInput,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
  ownerId,
  onOwnerIdChange,
  ownerLabel,
  owners,
  primaryProductId,
  onPrimaryProductIdChange,
  componentCoverages,
  onAddCoverage,
  onRemoveCoverage,
  onCoverageComponentChange,
  onCoverageStrengthChange,
  onCoverageMandatoryChange,
  products,
  components,
  suiteId,
  onSuiteIdChange,
  suiteLabel,
  suites,
}: TestCaseDetailsSharedProps) {
  return (
    <div className="space-y-4">
      <TextField label="Title" type="text" value={title} onChange={(event) => onTitleChange(event.target.value)} />

      <TestCaseTemplateTypeField value={templateType} onChange={onTemplateTypeChange} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TestCaseAutomationIdField
          value={automationId ?? ""}
          onChange={onAutomationIdChange}
          placeholder="Stable id for JUnit XML mapping"
        />

        <SelectField label="Status" value={status} onChange={(event) => onStatusChange(event.target.value as typeof status)}>
          {availableStatusOptions.map((option) => (
            <option key={option} value={option}>
              {formatTestCaseStatusLabel(option)}
            </option>
          ))}
        </SelectField>

        <TestCaseTypePriorityFields
          typeValue={effectiveTestCaseType}
          typeDisabled={testCaseTypeLocked}
          onTypeChange={onTestCaseTypeChange}
          priorityValue={priority}
          onPriorityChange={onPriorityChange}
        />

        <TestCaseExpectedTimeField
          value={time ?? ""}
          onChange={onTimeChange}
        />
      </div>

      <FormField label="Tags">
        <TagInput
          tags={tags}
          tagInput={tagInput}
          onTagInputChange={onTagInputChange}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          layout="inline"
          addButtonStyle="primary"
          inputClassName="w-32 min-w-[8rem]"
        />
      </FormField>

      <div className="border-t border-[var(--border)] pt-3">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SelectField label="Owner" value={ownerId} onChange={(event) => onOwnerIdChange(event.target.value)} hint={`Current: ${ownerLabel}`}>
            <option value="unassigned">Unassigned</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.username}
              </option>
            ))}
          </SelectField>
          <SelectField label="Suite" value={suiteId} onChange={(event) => onSuiteIdChange(event.target.value)} hint={`Current: ${suiteLabel}`}>
            <option value="unsorted">Unsorted</option>
            {suites.map((suite) => (
              <option key={suite.id} value={suite.id}>
                {suite.name}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      <div className="border-t border-[var(--border)] pt-3">
        <TestCaseCoverageEditor
          isEditing
          primaryProductId={primaryProductId}
          onPrimaryProductIdChange={onPrimaryProductIdChange}
          componentCoverages={componentCoverages}
          onAddCoverage={onAddCoverage}
          onRemoveCoverage={onRemoveCoverage}
          onCoverageComponentChange={onCoverageComponentChange}
          onCoverageStrengthChange={onCoverageStrengthChange}
          onCoverageMandatoryChange={onCoverageMandatoryChange}
          productOptions={products}
          componentOptions={components}
        />
      </div>
    </div>
  );
}
