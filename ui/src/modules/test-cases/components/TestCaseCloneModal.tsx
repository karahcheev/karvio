// Modal to configure and confirm cloning a test case.
import { useId } from "react";
import { invokeMaybeAsync } from "@/shared/lib/invoke-maybe-async";
import { AppModal, StandardModalLayout } from "@/shared/ui/Modal";
import { Button } from "@/shared/ui/Button";
import { TagInput } from "@/shared/ui/TagInput";
import { formatPriorityLabel, PRIORITY_OPTIONS } from "@/shared/domain/priority";
import { formatTestCaseTypeLabel, TEST_CASE_TYPE_OPTIONS } from "@/shared/domain/testCaseType";
import type { CloneWizardDraft } from "../utils/testCaseEditorTypes";

type OwnerOption = Readonly<{
  id: string;
  username: string;
}>;

type SuiteOption = Readonly<{
  id: string;
  name: string;
}>;

type TestCaseCloneModalProps = Readonly<{
  isOpen: boolean;
  isCloning: boolean;
  draft: CloneWizardDraft;
  owners: OwnerOption[];
  suites: SuiteOption[];
  stepsCount: number;
  onClose: () => void;
  onDraftChange: (field: keyof CloneWizardDraft, value: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  onCreate: () => void;
}>;

export function TestCaseCloneModal({
  isOpen,
  isCloning,
  draft,
  owners,
  suites,
  stepsCount,
  onClose,
  onDraftChange,
  onAddTag,
  onRemoveTag,
  onCreate,
}: TestCaseCloneModalProps) {
  const titleFieldId = useId();
  const typeFieldId = useId();
  const priorityFieldId = useId();
  const ownerFieldId = useId();
  const suiteFieldId = useId();
  const timeFieldId = useId();

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnOverlayClick={!isCloning}
      closeOnEscape={!isCloning}
      contentClassName="w-[min(720px,calc(100vw-2rem))] overflow-hidden rounded-xl"
    >
      <StandardModalLayout
        title="Clone Test Case"
        description="Review fields before creating a cloned test case."
        onClose={onClose}
        closeButtonDisabled={isCloning}
        headerClassName="px-4 py-3"
        bodyClassName="space-y-4 overflow-y-auto px-4 py-4"
        footerClassName="px-4 py-3"
        footer={(
          <>
            <Button
              unstyled
              type="button"
              onClick={onClose}
              disabled={isCloning}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </Button>
            <Button
              unstyled
              type="button"
              onClick={() => invokeMaybeAsync(() => onCreate())}
              disabled={isCloning || !draft.title.trim()}
              className="rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] disabled:cursor-not-allowed disabled:bg-[var(--action-primary-disabled-fill)]"
            >
              {isCloning ? "Creating..." : "Create"}
            </Button>
          </>
        )}
      >
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor={titleFieldId}>
              Title <span className="text-[var(--status-failure)]">*</span>
            </label>
            <input
              id={titleFieldId}
              type="text"
              value={draft.title}
              onChange={(event) => onDraftChange("title", event.target.value)}
              autoFocus
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--highlight-border)] focus:outline-none focus:ring-1 focus:ring-[var(--control-focus-ring)]"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor={typeFieldId}>
                Type
              </label>
              <select
                id={typeFieldId}
                value={draft.testCaseType}
                onChange={(event) => onDraftChange("testCaseType", event.target.value)}
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              >
                {TEST_CASE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {formatTestCaseTypeLabel(opt)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor={priorityFieldId}>
                Priority
              </label>
              <select
                id={priorityFieldId}
                value={draft.priority}
                onChange={(event) => onDraftChange("priority", event.target.value)}
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {formatPriorityLabel(opt)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor={ownerFieldId}>
                Owner
              </label>
              <select
                id={ownerFieldId}
                value={draft.ownerId}
                onChange={(event) => onDraftChange("ownerId", event.target.value)}
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              >
                <option value="unassigned">Unassigned</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.username}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor={suiteFieldId}>
                Suite
              </label>
              <select
                id={suiteFieldId}
                value={draft.suiteId}
                onChange={(event) => onDraftChange("suiteId", event.target.value)}
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              >
                <option value="unsorted">Unsorted</option>
                {suites.map((suite) => (
                  <option key={suite.id} value={suite.id}>
                    {suite.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor={timeFieldId}>
              Expected Time
            </label>
            <input
              id={timeFieldId}
              type="text"
              value={draft.time ?? ""}
              onChange={(event) => onDraftChange("time", event.target.value)}
              placeholder="e.g. 10m, 1h, 00:15:00"
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--highlight-border)] focus:outline-none focus:ring-1 focus:ring-[var(--control-focus-ring)]"
            />
          </div>

          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 block w-full text-sm font-medium text-[var(--foreground)]">Tags</legend>
            <TagInput
              tags={draft.tags}
              tagInput={draft.tagInput}
              onTagInputChange={(value) => onDraftChange("tagInput", value)}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
              layout="inline"
              addButtonStyle="primary"
            />
          </fieldset>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
            New test case will be created as draft.
            <br />
            Title, fields, {stepsCount} step(s), and attachments will be copied.
          </div>
      </StandardModalLayout>
    </AppModal>
  );
}
