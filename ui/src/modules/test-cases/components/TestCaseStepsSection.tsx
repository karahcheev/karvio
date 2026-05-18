// Editable numbered steps with rich text and per-step attachments.
import { useState, type DragEvent } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { RichTextField } from "@/shared/ui/RichTextField";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/lib/cn";
import type { AttachmentDto } from "@/shared/api";
import type { EditableStep } from "../utils/testCaseEditorTypes";

type TestCaseStepsSectionProps = Readonly<{
  isEditing: boolean;
  steps: EditableStep[];
  stepAttachments: Record<string, AttachmentDto[]>;
  testCaseId?: string;
  uploadingStepId: string | null;
  /** When false, inline image upload is hidden (e.g. creating a case before it exists). */
  stepImagesEnabled?: boolean;
  /** When true, no outer bordered panel (e.g. nested inside another form surface). */
  unboxed?: boolean;
  onAddStep: () => void;
  onInsertStepAfter: (afterId: string) => void;
  onRemoveStep: (stepId: string) => void;
  onUpdateStep: (stepId: string, field: "action" | "expectedResult", value: string) => void;
  onMoveStep?: (sourceId: string, targetId: string) => void;
  onStepImageUpload: (stepId: string, file: File) => Promise<string | null>;
}>;

export function TestCaseStepsSection({
  isEditing,
  steps,
  stepAttachments,
  testCaseId,
  uploadingStepId,
  stepImagesEnabled = true,
  unboxed = false,
  onAddStep,
  onInsertStepAfter,
  onRemoveStep,
  onUpdateStep,
  onMoveStep,
  onStepImageUpload,
}: TestCaseStepsSectionProps) {
  const rootClass = unboxed ? "space-y-3" : "mt-6 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3";
  const headerClass = unboxed ? "mb-2 flex items-center justify-between gap-4" : "mb-4 flex items-center justify-between gap-4";
  const dragEnabled = isEditing && Boolean(onMoveStep);

  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);
  const [dragHandleStepId, setDragHandleStepId] = useState<string | null>(null);
  const [dragOverStepId, setDragOverStepId] = useState<string | null>(null);

  const handleDragStart = (event: DragEvent<HTMLDivElement>, stepId: string) => {
    if (!dragEnabled) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", stepId);
    setDraggingStepId(stepId);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, stepId: string) => {
    if (!draggingStepId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOverStepId !== stepId) setDragOverStepId(stepId);
  };

  const handleDragLeave = (stepId: string) => {
    setDragOverStepId((current) => (current === stepId ? null : current));
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, targetId: string) => {
    event.preventDefault();
    if (draggingStepId && draggingStepId !== targetId) {
      onMoveStep?.(draggingStepId, targetId);
    }
    setDraggingStepId(null);
    setDragHandleStepId(null);
    setDragOverStepId(null);
  };

  const handleDragEnd = () => {
    setDraggingStepId(null);
    setDragHandleStepId(null);
    setDragOverStepId(null);
  };

  return (
    <div className={rootClass}>
      <div className={headerClass}>
        <div>
          <h2 className="text-lg font-semibold">Test Steps</h2>
          {isEditing ? (
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {stepImagesEnabled
                ? "You can embed images up to 10 MB directly into the step description and expected result."
                : "Add actions and expected results. Images can be added after the test case is saved."}
            </p>
          ) : null}
        </div>
      </div>
      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, index) => {
          const isDragging = draggingStepId === step.id;
          const isDragOver = dragOverStepId === step.id && draggingStepId && draggingStepId !== step.id;
          return (
            <div key={step.id} className="step-container">
              <div
                draggable={dragEnabled && dragHandleStepId === step.id}
                onDragStart={(event) => handleDragStart(event, step.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(event) => handleDragOver(event, step.id)}
                onDragLeave={() => handleDragLeave(step.id)}
                onDrop={(event) => handleDrop(event, step.id)}
                className={cn(
                  "rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 transition-colors hover:border-[var(--border)]",
                  isDragging && "opacity-60",
                  isDragOver && "border-[var(--highlight-border)] ring-1 ring-[var(--control-focus-ring)]",
                )}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {dragEnabled ? (
                      <Button
                        unstyled
                        type="button"
                        title="Drag to reorder"
                        aria-label={`Drag step ${index + 1} to reorder`}
                        onMouseDown={() => setDragHandleStepId(step.id)}
                        onMouseUp={() => setDragHandleStepId((current) => (current === step.id ? null : current))}
                        onTouchStart={() => setDragHandleStepId(step.id)}
                        onTouchEnd={() => setDragHandleStepId((current) => (current === step.id ? null : current))}
                        className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] cursor-grab active:cursor-grabbing"
                      >
                        <GripVertical className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <GripVertical className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                    )}
                    <div className="text-xs text-[var(--muted-foreground)]">Step {index + 1}</div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {isEditing ? (
                      <>
                        <Button unstyled
                          onClick={() => onInsertStepAfter(step.id)}
                          className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--highlight-bg-soft)] hover:text-[var(--highlight-foreground)]"
                          title="Add step after"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button unstyled
                          onClick={() => onRemoveStep(step.id)}
                          className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--tone-danger-bg-soft)] hover:text-[var(--status-failure)]"
                          title="Remove step"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <RichTextField
                    label="Action"
                    value={step.action}
                    editable={isEditing}
                    emptyMessage="No action specified."
                    placeholder="Describe the action..."
                    minRows={6}
                    onChange={(value) => onUpdateStep(step.id, "action", value)}
                    onImageUpload={stepImagesEnabled ? (file) => onStepImageUpload(step.id, file) : undefined}
                    canUploadImage={stepImagesEnabled && uploadingStepId !== step.id}
                    imageUploadTitle="Upload image"
                    attachments={stepAttachments[step.id] ?? []}
                    testCaseId={testCaseId}
                    stepId={step.id}
                  />
                  <RichTextField
                    label="Expected Result"
                    value={step.expectedResult}
                    editable={isEditing}
                    emptyMessage="No expected result specified."
                    placeholder="Describe expected result..."
                    minRows={6}
                    onChange={(value) => onUpdateStep(step.id, "expectedResult", value)}
                    onImageUpload={stepImagesEnabled ? (file) => onStepImageUpload(step.id, file) : undefined}
                    canUploadImage={stepImagesEnabled && uploadingStepId !== step.id}
                    imageUploadTitle="Upload image"
                    attachments={stepAttachments[step.id] ?? []}
                    testCaseId={testCaseId}
                    stepId={step.id}
                  />
                </div>
              </div>
            </div>
          );
        })}
        {steps.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-[var(--border)] p-8 text-center">
            <p className="mb-3 text-sm text-[var(--muted-foreground)]">No test steps yet</p>
            {isEditing ? (
              <Button unstyled
                onClick={onAddStep}
                className="mx-auto flex items-center gap-2 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)]"
              >
                <Plus className="h-4 w-4" />
                Add First Step
              </Button>
            ) : null}
          </div>
        ) : null}
        {isEditing && steps.length > 0 ? (
          <div className="pt-2">
            <Button unstyled
              onClick={onAddStep}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
            >
              <Plus className="h-4 w-4" />
              Add Step
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
