// Detail page header: navigation, edit/save, and overflow actions for a test case.
import { Archive, Copy, Download, Edit3, Loader2, MoreVertical, Paperclip, Save, Sparkles, Trash2 } from "lucide-react";
import { invokeMaybeAsync } from "@/shared/lib/invoke-maybe-async";
import { DetailPageHeader } from "@/shared/ui/DetailPageHeader";
import { Button } from "@/shared/ui/Button";
import { TEST_CASE_EXPORT_FORMATS, type TestCaseExportFormat } from "@/shared/api";

type TestCaseDetailHeaderProps = Readonly<{
  projectId: string | undefined;
  title: string;
  testCaseKey: string;
  createdAt: string | null;
  updatedAt: string | null;
  isEditing: boolean;
  isSaving: boolean;
  aiEnabled: boolean;
  isUploadingCaseAttachment: boolean;
  actionsMenuOpen: boolean;
  actionsMenuRef: React.RefObject<HTMLDivElement>;
  caseAttachmentInputRef: React.RefObject<HTMLInputElement>;
  locationSearch: string;
  onActionsMenuToggle: () => void;
  onCloneOpen: () => void;
  onReviewWithAi: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onExport: (format: TestCaseExportFormat) => void | Promise<void>;
  exportBusy: boolean;
  onCaseAttachmentSelect: (file: File) => void;
  onEditStart: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
}>;

export function TestCaseDetailHeader({
  projectId,
  title,
  testCaseKey,
  createdAt,
  updatedAt,
  isEditing,
  isSaving,
  aiEnabled,
  isUploadingCaseAttachment,
  actionsMenuOpen,
  actionsMenuRef,
  caseAttachmentInputRef,
  locationSearch,
  onActionsMenuToggle,
  onCloneOpen,
  onArchive,
  onDelete,
  onExport,
  exportBusy,
  onCaseAttachmentSelect,
  onEditStart,
  onCancelEdit,
  onSave,
  onReviewWithAi,
}: TestCaseDetailHeaderProps) {
  return (
    <DetailPageHeader
      className="sticky top-0 z-20"
      backLabel="Back to Test Cases"
      backTo={{
        pathname: `/projects/${projectId}/test-cases`,
        search: locationSearch,
      }}
      title={title || "Untitled test case"}
      meta={
        <>
          <span>{testCaseKey || "—"}</span>
          <span>Created {createdAt ? new Date(createdAt).toLocaleString() : "—"}</span>
          <span>Updated {updatedAt ? new Date(updatedAt).toLocaleString() : "—"}</span>
        </>
      }
      actions={
        <>
          <input
            ref={caseAttachmentInputRef}
            type="file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onCaseAttachmentSelect(file);
              event.target.value = "";
            }}
          />
          {!isEditing ? (
            <div className="relative" ref={actionsMenuRef}>
              <Button
                unstyled
                onClick={onActionsMenuToggle}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm hover:bg-[var(--muted)]"
              >
                <MoreVertical className="h-4 w-4" />
                Actions
              </Button>

              {actionsMenuOpen ? (
                <div className="absolute right-0 top-full z-10 mt-2 w-64 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg">
                  <div className="p-1">
                    <Button
                      unstyled
                      onClick={onCloneOpen}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
                    >
                      <Copy className="h-4 w-4" />
                      Clone Test Case
                    </Button>
                    {aiEnabled ? (
                      <Button
                        unstyled
                        onClick={onReviewWithAi}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
                      >
                        <Sparkles className="h-4 w-4" />
                        AI Review
                      </Button>
                    ) : null}
                    <Button
                      unstyled
                      onClick={() => invokeMaybeAsync(() => onArchive())}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
                    >
                      <Archive className="h-4 w-4" />
                      Archive
                    </Button>
                    <div className="my-1 border-t border-[var(--border)]" />
                    <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                      {exportBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      Export as
                    </div>
                    {TEST_CASE_EXPORT_FORMATS.map((format) => (
                      <Button
                        key={format.value}
                        unstyled
                        disabled={exportBusy}
                        onClick={() => invokeMaybeAsync(() => onExport(format.value))}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {format.label}
                      </Button>
                    ))}
                    <div className="my-1 border-t border-[var(--border)]" />
                    <Button
                      unstyled
                      onClick={() => invokeMaybeAsync(() => onDelete())}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--status-failure)] hover:bg-[var(--tone-danger-bg-soft)]"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <Button
              unstyled
              onClick={() => caseAttachmentInputRef.current?.click()}
              disabled={isUploadingCaseAttachment}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploadingCaseAttachment ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
              Upload Attachment
            </Button>
          )}
          {isEditing ? (
            <>
              <Button
                unstyled
                onClick={onCancelEdit}
                disabled={isSaving}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </Button>
              <Button
                unstyled
                onClick={() => invokeMaybeAsync(() => onSave())}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] disabled:cursor-not-allowed disabled:bg-[var(--action-primary-disabled-fill)]"
              >
                <Save className="h-4 w-4" />
                Save
              </Button>
            </>
          ) : (
            <Button
              unstyled
              onClick={onEditStart}
              className="flex items-center gap-2 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)]"
            >
              <Edit3 className="h-4 w-4" />
              Edit
            </Button>
          )}
        </>
      }
    />
  );
}
