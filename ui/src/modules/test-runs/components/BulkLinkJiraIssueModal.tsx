import { useEffect, useId, useState } from "react";
import { AppModal, StandardModalLayout } from "@/shared/ui/Modal";
import { Button } from "@/shared/ui/Button";

type BulkLinkJiraIssueModalProps = Readonly<{
  isOpen: boolean;
  loading: boolean;
  selectedCount: number;
  onClose: () => void;
  onSubmit: (issueKeyOrUrl: string) => void;
}>;

export function BulkLinkJiraIssueModal({
  isOpen,
  loading,
  selectedCount,
  onClose,
  onSubmit,
}: BulkLinkJiraIssueModalProps) {
  const [issueKeyOrUrl, setIssueKeyOrUrl] = useState("");
  const issueKeyFieldId = useId();

  useEffect(() => {
    if (!isOpen) return;
    setIssueKeyOrUrl("");
  }, [isOpen]);

  if (!isOpen) return null;

  const value = issueKeyOrUrl.trim();

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="w-full max-w-lg rounded-xl"
    >
      <StandardModalLayout
        title="Link Jira Issue"
        description={`Link one Jira issue to ${selectedCount} selected run item(s).`}
        onClose={onClose}
        closeButtonDisabled={loading}
        footerClassName="justify-end"
        footer={(
          <>
            <Button
              unstyled
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-50"
            >
              Cancel
            </Button>
            <Button
              unstyled
              type="button"
              onClick={() => onSubmit(value)}
              disabled={loading || value.length === 0}
              className="rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] disabled:opacity-50"
            >
              {loading ? "Linking..." : "Link"}
            </Button>
          </>
        )}
      >
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--foreground)]" htmlFor={issueKeyFieldId}>
            Jira key or URL
          </label>
          <input
            id={issueKeyFieldId}
            value={issueKeyOrUrl}
            onChange={(event) => setIssueKeyOrUrl(event.target.value)}
            placeholder="ABC-123 or Jira URL"
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--highlight-border)] focus:outline-none focus:ring-1 focus:ring-[var(--control-focus-ring)]"
            autoFocus
          />
        </div>
      </StandardModalLayout>
    </AppModal>
  );
}
