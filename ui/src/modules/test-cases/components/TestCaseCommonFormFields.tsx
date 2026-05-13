import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { SelectField, TextField, Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui";
import {
  formatPriorityLabel,
  PRIORITY_OPTIONS,
  type TestCasePriority,
} from "@/shared/domain/priority";
import {
  formatTestCaseTemplateTypeLabel,
  TEST_CASE_TEMPLATE_TYPE_OPTIONS,
  type TestCaseTemplateType,
} from "@/shared/domain/testCaseTemplateType";
import {
  formatTestCaseTypeLabel,
  TEST_CASE_TYPE_OPTIONS,
  type TestCaseType,
} from "@/shared/domain/testCaseType";

export function FieldLabelWithHint({
  label,
  description,
}: Readonly<{ label: ReactNode; description: ReactNode }>) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex cursor-help items-center text-[color-mix(in_srgb,var(--muted-foreground),transparent_20%)] hover:text-[var(--foreground)]"
            aria-label={typeof description === "string" ? description : undefined}
          >
            <Info className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-xs">
          {description}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

type TemplateTypeFieldProps = Readonly<{
  value: TestCaseTemplateType;
  onChange: (value: TestCaseTemplateType) => void;
}>;

export function TestCaseTemplateTypeField({ value, onChange }: TemplateTypeFieldProps) {
  return (
    <SelectField
      label="Template"
      value={value}
      onChange={(event) => onChange(event.target.value as TestCaseTemplateType)}
    >
      {TEST_CASE_TEMPLATE_TYPE_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {formatTestCaseTemplateTypeLabel(option)}
        </option>
      ))}
    </SelectField>
  );
}

type AutomationIdFieldProps = Readonly<{
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}>;

export function TestCaseAutomationIdField({ value, placeholder, onChange }: AutomationIdFieldProps) {
  return (
    <TextField
      label="Automation ID"
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  );
}

type TypePriorityFieldsProps = Readonly<{
  typeValue: TestCaseType;
  typeDisabled?: boolean;
  onTypeChange: (value: TestCaseType) => void;
  priorityValue: TestCasePriority;
  onPriorityChange: (value: TestCasePriority) => void;
}>;

export function TestCaseTypePriorityFields({
  typeValue,
  typeDisabled = false,
  onTypeChange,
  priorityValue,
  onPriorityChange,
}: TypePriorityFieldsProps) {
  return (
    <>
      <SelectField
        label={
          <FieldLabelWithHint
            label="Type"
            description="Classification of the test (functional, integration, performance, automated, etc.). Helps filter and structure runs."
          />
        }
        value={typeValue}
        disabled={typeDisabled}
        onChange={(event) => onTypeChange(event.target.value as TestCaseType)}
      >
        {TEST_CASE_TYPE_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {formatTestCaseTypeLabel(opt)}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Priority"
        value={priorityValue}
        onChange={(event) => onPriorityChange(event.target.value as TestCasePriority)}
      >
        {PRIORITY_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {formatPriorityLabel(opt)}
          </option>
        ))}
      </SelectField>
    </>
  );
}

type ExpectedTimeFieldProps = Readonly<{
  value: string;
  onChange: (value: string) => void;
}>;

export function TestCaseExpectedTimeField({ value, onChange }: ExpectedTimeFieldProps) {
  return (
    <TextField
      label={
        <FieldLabelWithHint
          label="Expected Time"
          description="Estimated time to execute this case manually. Accepts shorthand like 10m, 1h, or HH:MM:SS."
        />
      }
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="e.g. 10m, 1h, 00:15:00"
    />
  );
}
