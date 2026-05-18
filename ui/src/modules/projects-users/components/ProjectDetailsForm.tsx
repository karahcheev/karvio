// Editable project name/description with save action.
import { useId } from "react";

type ProjectDetailsFormProps = Readonly<{
  projectId: string | undefined;
  name: string;
  description: string;
  isLoading: boolean;
  isEditMode: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}>;

export function ProjectDetailsForm({
  projectId,
  name,
  description,
  isLoading,
  isEditMode,
  onNameChange,
  onDescriptionChange,
}: ProjectDetailsFormProps) {
  const nameFieldId = useId();
  const projectIdFieldId = useId();
  const descriptionFieldId = useId();

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
      <h2 className="mb-6 text-lg font-semibold text-[var(--foreground)]">Project Details</h2>

      {isLoading ? (
        <p className="text-sm text-[var(--muted-foreground)]">Loading project details...</p>
      ) : (
        <div className="space-y-6">
          {/* Identity */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor={nameFieldId}>
                Project Name
              </label>
              <input
                id={nameFieldId}
                type="text"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                readOnly={!isEditMode}
                className={`w-full rounded-lg border px-3 py-2 ${isEditMode ? "border-[var(--border)] bg-[var(--card)]" : "border-[var(--border)] bg-[var(--input-readonly-background)] text-[var(--muted-foreground)]"}`}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor={projectIdFieldId}>
                Project ID
              </label>
              <input
                id={projectIdFieldId}
                type="text"
                value={projectId ?? ""}
                readOnly
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-readonly-background)] px-3 py-2 text-[var(--muted-foreground)]"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor={descriptionFieldId}>
              Description
            </label>
            <textarea
              id={descriptionFieldId}
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              rows={4}
              readOnly={!isEditMode}
              className={`w-full rounded-lg border px-3 py-2 ${isEditMode ? "border-[var(--border)] bg-[var(--card)]" : "border-[var(--border)] bg-[var(--input-readonly-background)] text-[var(--muted-foreground)]"}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
