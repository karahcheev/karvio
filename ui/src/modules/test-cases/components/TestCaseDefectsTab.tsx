import { useId, useMemo, useState } from "react";
import { useTestCaseRunCasesPageQuery, type ExternalIssueLinkDto } from "@/shared/api";
import { Button } from "@/shared/ui/Button";
import { AppModal, StandardModalLayout } from "@/shared/ui/Modal";

type Props = Readonly<{
  projectId?: string;
  testCaseId?: string;
  directIssues: ExternalIssueLinkDto[];
  canManageExternalIssues: boolean;
  externalIssueActionLoading: boolean;
  onLinkIssue: (issueKeyOrUrl: string) => Promise<void> | void;
  onUnlinkIssue: (issue: ExternalIssueLinkDto) => void;
}>;

type DefectEntry = {
  issue: ExternalIssueLinkDto;
  sourceLabel: string;
  executedAt: string | null;
};

export function TestCaseDefectsTab({
  projectId,
  testCaseId,
  directIssues,
  canManageExternalIssues,
  externalIssueActionLoading,
  onLinkIssue,
  onUnlinkIssue,
}: Props) {
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const linkIssueFieldId = useId();
  const query = useTestCaseRunCasesPageQuery(projectId, testCaseId, {
    pageSize: 25,
    sortBy: "last_executed_at",
    sortDirection: "desc",
  });

  const runCaseItems = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  const entries = useMemo<DefectEntry[]>(() => {
    const result: DefectEntry[] = [];
    for (const issue of directIssues) {
      result.push({
        issue,
        sourceLabel: "Linked on test case",
        executedAt: null,
      });
    }
    for (const runCase of runCaseItems) {
      for (const issue of runCase.external_issues ?? []) {
        result.push({
          issue,
          sourceLabel: `Run: ${runCase.test_run_name ?? runCase.test_run_id}`,
          executedAt: runCase.last_executed_at,
        });
      }
    }
    return result.sort((left, right) => {
      const leftTs = Date.parse(left.issue.created_at);
      const rightTs = Date.parse(right.issue.created_at);
      if (!Number.isNaN(leftTs) && !Number.isNaN(rightTs) && leftTs !== rightTs) {
        return rightTs - leftTs;
      }
      return right.issue.created_at.localeCompare(left.issue.created_at);
    });
  }, [directIssues, runCaseItems]);

  const handleLinkSubmit = async () => {
    const issueKeyOrUrl = linkValue.trim();
    if (!issueKeyOrUrl || externalIssueActionLoading) return;
    await Promise.resolve(onLinkIssue(issueKeyOrUrl));
    setLinkValue("");
    setIsLinkModalOpen(false);
  };

  if (!projectId || !testCaseId) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] px-4 py-5 text-sm text-[var(--muted-foreground)]">
        Test case context is missing.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-[var(--foreground)]">Defects history</div>
        {canManageExternalIssues ? (
          <Button
            unstyled
            type="button"
            onClick={() => setIsLinkModalOpen(true)}
            disabled={externalIssueActionLoading}
            className="rounded-md bg-[var(--action-primary-fill)] px-3 py-1.5 text-xs font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] disabled:opacity-60"
          >
            Link
          </Button>
        ) : null}
      </div>

      {(() => {
        if (query.isLoading) {
          return (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] px-4 py-5 text-sm text-[var(--muted-foreground)]">
              Loading defects history...
            </div>
          );
        }
        if (entries.length === 0) {
          return (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] px-4 py-5 text-sm text-[var(--muted-foreground)]">
              No defects linked to this test case yet.
            </div>
          );
        }
        return (
        <>
          {entries.map(({ issue, sourceLabel, executedAt }) => (
            <div key={issue.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <a
                    href={issue.external_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-[var(--status-in-progress)] hover:underline"
                  >
                    {issue.external_key}
                  </a>
                  <div className="text-xs text-[var(--muted-foreground)]">{sourceLabel}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    Linked: {new Date(issue.created_at).toLocaleString()}
                    {executedAt ? ` • Executed: ${new Date(executedAt).toLocaleString()}` : ""}
                  </div>
                  {issue.snapshot_summary ? (
                    <div className="text-sm text-[var(--foreground)]">{issue.snapshot_summary}</div>
                  ) : null}
                  <div className="text-xs text-[var(--muted-foreground)]">
                    Status: {issue.snapshot_status ?? "Unknown"}
                    {issue.snapshot_priority ? ` • Priority: ${issue.snapshot_priority}` : ""}
                    {issue.snapshot_assignee ? ` • Assignee: ${issue.snapshot_assignee}` : ""}
                  </div>
                </div>
                {canManageExternalIssues ? (
                  <Button
                    unstyled
                    type="button"
                    onClick={() => onUnlinkIssue(issue)}
                    disabled={externalIssueActionLoading}
                    className="rounded-md border border-[var(--tone-danger-border-strong)] px-2.5 py-1 text-xs font-medium text-[var(--status-failure)] hover:bg-[var(--tone-danger-bg-soft)] disabled:opacity-50"
                  >
                    unlink
                  </Button>
                ) : null}
              </div>
            </div>
          ))}

          {query.hasNextPage ? (
            <div className="flex justify-center">
              <Button
                unstyled
                type="button"
                onClick={() => void query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-60"
              >
                {query.isFetchingNextPage ? "Loading..." : "Load more defects"}
              </Button>
            </div>
          ) : null}
        </>
        );
      })()}

      <AppModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        contentClassName="w-full max-w-lg rounded-xl"
      >
        <StandardModalLayout
          title="Link Defect"
          description="Link Jira issue to this test case."
          onClose={() => setIsLinkModalOpen(false)}
          closeButtonDisabled={externalIssueActionLoading}
          footerClassName="justify-end"
          footer={(
            <>
              <Button
                unstyled
                type="button"
                onClick={() => setIsLinkModalOpen(false)}
                disabled={externalIssueActionLoading}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-50"
              >
                Cancel
              </Button>
              <Button
                unstyled
                type="button"
                onClick={() => void handleLinkSubmit()}
                disabled={externalIssueActionLoading || linkValue.trim().length === 0}
                className="rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] disabled:opacity-50"
              >
                {externalIssueActionLoading ? "Linking..." : "Link"}
              </Button>
            </>
          )}
        >
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--foreground)]" htmlFor={linkIssueFieldId}>
              Jira key or URL
            </label>
            <input
              id={linkIssueFieldId}
              value={linkValue}
              onChange={(event) => setLinkValue(event.target.value)}
              placeholder="ABC-123 or Jira URL"
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--highlight-border)] focus:outline-none focus:ring-1 focus:ring-[var(--control-focus-ring)]"
              autoFocus
            />
          </div>
        </StandardModalLayout>
      </AppModal>
    </div>
  );
}
