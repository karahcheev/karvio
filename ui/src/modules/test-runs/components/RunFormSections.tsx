import type { LucideIcon } from "lucide-react";
import { Minus, Plus, Play } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { SelectField, TextareaField, TextField } from "@/shared/ui";

type AssigneeOption = Readonly<{
  id: string;
  label: string;
}>;

type EnvironmentOption = Readonly<{
  id: string;
  label: string;
  revisionNumber: number | null | undefined;
}>;

type MilestoneOption = Readonly<{
  id: string;
  label: string;
}>;

type RunMetadataFieldsProps = Readonly<{
  values: {
    name: string;
    description: string;
    environmentId: string;
    milestoneId: string;
    build: string;
    assignee: string;
  };
  assigneeOptions: AssigneeOption[];
  environmentOptions: EnvironmentOption[];
  milestoneOptions: MilestoneOption[];
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onEnvironmentChange: (value: string) => void;
  onMilestoneChange: (value: string) => void;
  onBuildChange: (value: string) => void;
  onAssigneeChange: (value: string) => void;
  showHeading?: boolean;
  descriptionRows?: number;
  hintsVariant?: "detailed" | "compact";
}>;

export function RunMetadataFields({
  values,
  assigneeOptions,
  environmentOptions,
  milestoneOptions,
  onNameChange,
  onDescriptionChange,
  onEnvironmentChange,
  onMilestoneChange,
  onBuildChange,
  onAssigneeChange,
  showHeading = false,
  descriptionRows = 3,
  hintsVariant = "detailed",
}: RunMetadataFieldsProps) {
  return (
    <>
      {showHeading ? <h3 className="mb-4 text-sm font-semibold text-[var(--foreground)]">Basic Information</h3> : null}
      <div className="space-y-4">
        <TextField
          label="Run Name"
          required
          value={values.name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="e.g., Regression Suite - Build 1.3.0"
          autoFocus
        />

        <TextareaField
          label="Description"
          value={values.description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder={hintsVariant === "compact" ? "Optional" : "Optional description"}
          rows={descriptionRows}
        />

        <SelectField
          label="Milestone"
          value={values.milestoneId}
          onChange={(event) => onMilestoneChange(event.target.value)}
          hint={
            hintsVariant === "detailed"
              ? "Optional. Use to group this run under a release milestone"
              : undefined
          }
        >
          <option value="">No milestone</option>
          {milestoneOptions.map((milestone) => (
            <option key={milestone.id} value={milestone.id}>
              {milestone.label}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Environment"
          value={values.environmentId}
          onChange={(event) => onEnvironmentChange(event.target.value)}
          hint={
            hintsVariant === "detailed"
              ? "Optional. If selected, pinned to current revision when run is created"
              : undefined
          }
        >
          <option value="">No environment</option>
          {environmentOptions.map((environment) => (
            <option key={environment.id} value={environment.id}>
              {environment.revisionNumber != null
                ? `${environment.label} · r${environment.revisionNumber}`
                : environment.label}
            </option>
          ))}
        </SelectField>

        <TextField
          label="Build/Version"
          value={values.build}
          onChange={(event) => onBuildChange(event.target.value)}
          placeholder={hintsVariant === "compact" ? "e.g., 1.0.0" : "e.g., 1.3.0, v2.1.5 (optional)"}
          hint={hintsVariant === "detailed" ? "Optional field" : undefined}
        />

        <SelectField
          label="Assignee"
          value={values.assignee}
          onChange={(event) => onAssigneeChange(event.target.value)}
          hint={
            hintsVariant === "detailed"
              ? "Default assignee for new run items in this run"
              : undefined
          }
        >
          <option value="unassigned">Unassigned</option>
          {assigneeOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectField>
      </div>
    </>
  );
}

type RunSubmitActionsProps = Readonly<{
  loading: boolean;
  disabled: boolean;
  onCancel: () => void;
  onCreate: () => void;
  onCreateAndStart: () => void;
}>;

export function RunSubmitActions({
  loading,
  disabled,
  onCancel,
  onCreate,
  onCreateAndStart,
}: RunSubmitActionsProps) {
  return (
    <>
      <Button
        unstyled
        onClick={onCancel}
        disabled={loading}
        className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-50"
      >
        Cancel
      </Button>
      <Button
        unstyled
        onClick={onCreate}
        disabled={disabled}
        className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create Run"}
      </Button>
      <Button
        unstyled
        onClick={onCreateAndStart}
        disabled={disabled}
        className="flex items-center gap-2 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Play className="h-4 w-4" />
        {loading ? "Starting..." : "Create & Start"}
      </Button>
    </>
  );
}

type SelectionBulkActionsProps = Readonly<{
  title: string;
  loading: boolean;
  selectAllLabel?: string;
  onSelectAll: () => void;
  onClearAll: () => void;
}>;

export function SelectionBulkActions({
  title,
  loading,
  selectAllLabel = "Select All",
  onSelectAll,
  onClearAll,
}: SelectionBulkActionsProps) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
      <div className="flex items-center gap-2">
        <Button
          unstyled
          onClick={onSelectAll}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--highlight-foreground)] hover:bg-[var(--highlight-bg-soft)]"
          disabled={loading}
        >
          <Plus className="h-3.5 w-3.5" />
          {selectAllLabel}
        </Button>
        <Button
          unstyled
          onClick={onClearAll}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--highlight-foreground)] hover:bg-[var(--highlight-bg-soft)]"
          disabled={loading}
        >
          <Minus className="h-3.5 w-3.5" />
          Clear
        </Button>
      </div>
    </div>
  );
}

type SelectionModeTabsOption<T extends string> = Readonly<{
  id: T;
  label: string;
  icon: LucideIcon;
}>;

type SelectionModeTabsProps<T extends string> = Readonly<{
  value: T;
  options: Array<SelectionModeTabsOption<T>>;
  onChange: (value: T) => void;
  className?: string;
}>;

export function SelectionModeTabs<T extends string>({
  value,
  options,
  onChange,
  className = "mb-3",
}: SelectionModeTabsProps<T>) {
  return (
    <div className={`${className} flex gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-1`}>
      {options.map((option) => {
        const Icon = option.icon;
        const isSelected = option.id === value;
        return (
          <Button
            key={option.id}
            unstyled
            onClick={() => onChange(option.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isSelected ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <Icon className="h-4 w-4" />
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
