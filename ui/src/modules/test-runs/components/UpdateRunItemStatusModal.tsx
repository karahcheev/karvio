// Modal to set run item status, comment, defects, and failed step.
import { useId } from "react";
import { Clock, ChevronDown } from "lucide-react";
import { AppModal, StandardModalLayout } from "@/shared/ui/Modal";
import { Button } from "@/shared/ui/Button";
import {
  STATUS_OPTIONS,
  type RunItemStatus,
  type StatusUpdatePayload,
  type TestStep,
  useUpdateRunItemStatusFormState,
} from "../hooks/use-update-run-item-status-form-state";

type UpdateRunItemStatusModalProps = Readonly<{
  isOpen: boolean;
  loading: boolean;
  currentStatus: RunItemStatus;
  testCaseKey: string;
  testCaseTitle: string;
  /** When set, shown instead of "key — title" under the title (e.g. bulk selection). */
  descriptionOverride?: string;
  testSteps?: TestStep[];
  /** When true, form is read-only and save is disabled (e.g. completed run). */
  locked?: boolean;
  lockedReason?: string;
  onClose: () => void;
  onUpdate: (payload: StatusUpdatePayload) => void;
}>;

export function UpdateRunItemStatusModal({
  isOpen,
  loading,
  currentStatus,
  testCaseKey,
  testCaseTitle,
  descriptionOverride,
  testSteps,
  locked = false,
  lockedReason,
  onClose,
  onUpdate,
}: UpdateRunItemStatusModalProps) {
  const {
    selectedStatus,
    setSelectedStatus,
    time,
    setTime,
    comment,
    setComment,
    defectRefsInput,
    setDefectRefsInput,
    failedStepId,
    setFailedStepId,
    actualResult,
    setActualResult,
    autoCreateJiraIssue,
    setAutoCreateJiraIssue,
    selectedOption,
    requiresComment,
    isErrorStatus,
    isFailureStatus,
    showDefectField,
    hasStepOptions,
    isValid,
    handleSubmit,
  } = useUpdateRunItemStatusFormState({
    isOpen,
    loading: loading || locked,
    currentStatus,
    testSteps,
    onUpdate,
  });

  const statusFieldId = useId();
  const timeFieldId = useId();
  const failedStepFieldId = useId();
  const actualResultFieldId = useId();
  const defectRefsFieldId = useId();
  const jiraAutoCreateFieldId = useId();
  const commentFieldId = useId();

  if (!isOpen) return null;

  const baseDescription = descriptionOverride ?? `${testCaseKey} - ${testCaseTitle}`;
  const description =
    locked && lockedReason ? `${lockedReason}\n\n${baseDescription}` : baseDescription;

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="flex max-h-[min(90dvh,48rem)] min-h-0 w-full max-w-2xl flex-col rounded-xl"
    >
      <StandardModalLayout
        className="min-h-0 flex-1"
        title="Add Run Result"
        description={description}
        onClose={onClose}
        closeButtonDisabled={loading}
        footerClassName="justify-end"
        bodyClassName="min-h-0"
        footer={(
          <>
            <div className="mr-auto text-xs text-[var(--muted-foreground)]">Ctrl/Cmd + Enter to submit</div>
            <Button unstyled
              onClick={onClose}
              disabled={loading}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-50"
            >
              Cancel
            </Button>
            <Button unstyled
              onClick={handleSubmit}
              disabled={!isValid || loading || locked}
              className="rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Result"}
            </Button>
          </>
        )}
      >
        <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor={statusFieldId}>
                Select Status <span className="text-[var(--status-failure)]">*</span>
              </label>
              <div className="relative">
                <select
                  id={statusFieldId}
                  value={selectedStatus}
                  onChange={(event) => setSelectedStatus(event.target.value as RunItemStatus)}
                  disabled={locked}
                  className="w-full appearance-none rounded-lg border border-[var(--border)] py-2.5 pl-3 pr-10 text-sm focus:border-[var(--highlight-border)] focus:outline-none focus:ring-1 focus:ring-[var(--control-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              </div>
              <div className="mt-2 flex items-center gap-2">
                {(() => {
                  const Icon = selectedOption?.icon ?? Clock;
                  return (
                    <>
                      <div className={`rounded-lg p-1.5 ${selectedOption?.bgColor ?? "bg-[var(--accent)]"}`}>
                        <Icon className={`h-4 w-4 ${selectedOption?.color ?? "text-[var(--foreground)]"}`} />
                      </div>
                      <span className="text-sm text-[var(--muted-foreground)]">{requiresComment ? "Comment required for this status" : ""}</span>
                    </>
                  );
                })()}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor={timeFieldId}>
                Time
              </label>
              <input
                id={timeFieldId}
                type="text"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                disabled={locked}
                placeholder="e.g. 10m, 1h, 00:15:00"
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--highlight-border)] focus:outline-none focus:ring-1 focus:ring-[var(--control-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div>
              {isFailureStatus && hasStepOptions && (
                <div className="mb-6">
                  <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor={failedStepFieldId}>
                    Failed Step <span className="text-[var(--status-failure)]">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id={failedStepFieldId}
                      value={failedStepId}
                      onChange={(event) => setFailedStepId(event.target.value)}
                      disabled={locked}
                      className={`w-full appearance-none rounded-lg border py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-60 ${
                        failedStepId.trim().length === 0
                          ? "border-[var(--tone-danger-border-strong)] focus:border-[var(--status-failure)] focus:ring-[var(--action-danger-focus-ring)]"
                          : "border-[var(--border)] focus:border-[var(--highlight-border)] focus:ring-[var(--control-focus-ring)]"
                      }`}
                    >
                      <option value="">Select failed step...</option>
                      {testSteps?.map((step, index) => (
                        <option key={step.id} value={step.id}>
                          Step {index + 1}: {step.action}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                  </div>
                  {failedStepId.trim().length === 0 && (
                    <p className="mt-1 text-xs text-[var(--status-failure)]">Failed step is required for failure status</p>
                  )}
                </div>
              )}

              {isFailureStatus && (
                <div className="mb-6">
                  <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor={actualResultFieldId}>
                    Actual Result <span className="text-[var(--status-failure)]">*</span>
                  </label>
                  <textarea
                    id={actualResultFieldId}
                    value={actualResult}
                    onChange={(event) => setActualResult(event.target.value)}
                    disabled={locked}
                    placeholder="Describe what actually happened"
                    rows={3}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-60 ${
                      actualResult.trim().length === 0
                        ? "border-[var(--tone-danger-border-strong)] focus:border-[var(--status-failure)] focus:ring-[var(--action-danger-focus-ring)]"
                        : "border-[var(--border)] focus:border-[var(--highlight-border)] focus:ring-[var(--control-focus-ring)]"
                    }`}
                  />
                  {actualResult.trim().length === 0 && (
                    <p className="mt-1 text-xs text-[var(--status-failure)]">Actual result is required for failure status</p>
                  )}
                </div>
              )}

              {showDefectField && (
                <div className="mb-6">
                  <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor={defectRefsFieldId}>
                    Defect ID / Link
                  </label>
                  <textarea
                    id={defectRefsFieldId}
                    value={defectRefsInput}
                    onChange={(event) => setDefectRefsInput(event.target.value)}
                    disabled={locked}
                    placeholder="e.g. BUG-123 or https://jira.example.com/browse/BUG-123 (comma or new line separated)"
                    rows={2}
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--highlight-border)] focus:outline-none focus:ring-1 focus:ring-[var(--control-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              )}

              {showDefectField ? (
                <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3">
                  <div className="mb-2 text-sm font-medium text-[var(--foreground)]">Jira integration</div>
                  {isFailureStatus ? (
                    <label
                      className="mb-3 inline-flex items-center gap-2 text-sm text-[var(--foreground)]"
                      htmlFor={jiraAutoCreateFieldId}
                    >
                      <input
                        id={jiraAutoCreateFieldId}
                        type="checkbox"
                        checked={autoCreateJiraIssue}
                        onChange={(event) => setAutoCreateJiraIssue(event.target.checked)}
                        disabled={locked || defectRefsInput.trim().length > 0}
                        className="h-4 w-4 rounded border-[var(--border)]"
                      />
                      {" "}
                      Auto-create Jira issue on failure
                    </label>
                  ) : null}
                  <p className="text-xs text-[var(--muted-foreground)]">
                    If `Defect ID / Link` is provided, it will be linked to the run case. Auto-create is used only when this field is empty.
                  </p>
                </div>
              ) : null}

              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor={commentFieldId}>
                Comment {requiresComment && <span className="text-[var(--status-failure)]">*</span>}
              </label>
              <textarea
                id={commentFieldId}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                disabled={locked}
                placeholder={(() => {
                  if (!requiresComment) {
                    return "Add any additional notes (optional)";
                  }
                  if (isErrorStatus) {
                    return "Describe the execution error...";
                  }
                  return "Please provide details about the failure or blocker...";
                })()}
                rows={4}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-60 ${
                  requiresComment && !comment.trim()
                    ? "border-[var(--tone-danger-border-strong)] focus:border-[var(--status-failure)] focus:ring-[var(--action-danger-focus-ring)]"
                    : "border-[var(--border)] focus:border-[var(--highlight-border)] focus:ring-[var(--control-focus-ring)]"
                }`}
                autoFocus={!locked}
              />
              {requiresComment && !comment.trim() && <p className="mt-1 text-xs text-[var(--status-failure)]">Comment is required for this status</p>}
            </div>

            {testSteps && testSteps.length > 0 && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3">
                <div className="mb-2 text-sm font-medium text-[var(--foreground)]">Test Steps</div>
                <div className="max-h-40 space-y-1 overflow-y-auto text-sm text-[var(--muted-foreground)]">
                  {testSteps.map((step, index) => (
                    <div key={step.id}>
                      {index + 1}. {step.action}
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      </StandardModalLayout>
    </AppModal>
  );
}
