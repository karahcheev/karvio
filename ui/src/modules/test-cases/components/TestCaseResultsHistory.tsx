import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ChevronDown, ChevronUp, FolderOpen, FlaskConical, Hammer, ListTree, Logs } from "lucide-react";
import { Link } from "react-router";
import { AttachmentSection } from "./AttachmentSection";
import {
  downloadAttachment,
  listAttachments,
  useRunCaseQuery,
  useTestCaseRunCasesPageQuery,
  type AttachmentDto,
  type RunCaseDto,
} from "@/shared/api";
import { formatRunItemStatusLabel, getRunItemStatusTone } from "@/modules/test-runs/utils/constants";
import { Button } from "@/shared/ui/Button";
import { StatusBadge } from "@/shared/ui/StatusBadge";

type Props = Readonly<{
  projectId?: string;
  testCaseId?: string;
  className?: string;
}>;

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not executed";
  return new Date(value).toLocaleString();
}

function formatDuration(value: number | null | undefined) {
  if (value == null) return "—";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)} s`;
}

function getRunStatusTone(status: RunCaseDto["test_run_status"]) {
  if (status === "completed") return "success";
  if (status === "in_progress") return "info";
  if (status === "archived") return "neutral";
  return "muted";
}

function ResultLogBlock({
  title,
  value,
  tone = "neutral",
}: Readonly<{
  title: string;
  value: string;
  tone?: "neutral" | "danger";
}>) {
  const wrapperClass =
    tone === "danger"
      ? "rounded-xl border border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg-soft)] p-3"
      : "rounded-xl border border-[var(--border)] bg-[var(--card)] p-3";
  const preClass =
    tone === "danger"
      ? "max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--tone-danger-border)] bg-[var(--card)] p-3 text-xs text-[var(--tone-danger-text)]"
      : "max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--tone-neutral-border)] bg-[var(--card)] p-3 text-xs text-[var(--tone-neutral-text)]";

  return (
    <div className={wrapperClass}>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">{title}</div>
      <pre className={preClass}>{value}</pre>
    </div>
  );
}

function ResultArtifacts({ runCaseId }: Readonly<{ runCaseId: string }>) {
  const attachmentsQuery = useQuery({
    queryKey: ["run-cases", runCaseId, "attachments"],
    queryFn: () => listAttachments({ run_case_id: runCaseId }),
  });

  if (attachmentsQuery.isLoading) {
    return <div className="text-sm text-[var(--muted-foreground)]">Loading artifacts...</div>;
  }

  const attachments = attachmentsQuery.data ?? [];
  return (
    <AttachmentSection
      title="Artifacts"
      subtitle="Execution evidence for this result, including logs and other files."
      attachments={attachments}
      emptyMessage="No artifacts attached to this result."
      uploadLabel="Upload"
      showUploadAction={false}
      showDeleteAction={false}
      onUpload={() => Promise.resolve()}
      onDelete={() => Promise.resolve()}
      onDownload={(attachment: AttachmentDto) => downloadAttachment(attachment.id, attachment.filename)}
    />
  );
}

function ResultDetails({ runCaseId }: Readonly<{ runCaseId: string }>) {
  const runCaseQuery = useRunCaseQuery(runCaseId);

  if (runCaseQuery.isLoading) {
    return <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--muted-foreground)]">Loading result details...</div>;
  }

  if (!runCaseQuery.data) {
    return <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--muted-foreground)]">Failed to load result details.</div>;
  }

  const detail = runCaseQuery.data;
  const hasLogs = Boolean(detail.system_out || detail.system_err);
  const defectIds = detail.defect_ids ?? [];
  const historyItems = detail.history?.items ?? [];

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--highlight-border)] bg-[var(--highlight-bg-soft)] p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Execution</div>
          <div className="space-y-2 text-sm text-[var(--foreground)]">
            <div>Executed: <span className="font-medium text-[var(--foreground)]">{formatDateTime(detail.last_executed_at)}</span></div>
            <div>Time: <span className="font-medium text-[var(--foreground)]">{detail.time ?? "—"}</span></div>
            <div>Duration: <span className="font-medium text-[var(--foreground)]">{formatDuration(detail.duration_ms)}</span></div>
            <div>Executor ID: <span className="font-medium text-[var(--foreground)]">{detail.executed_by_id ?? "—"}</span></div>
            <div>Assignee: <span className="font-medium text-[var(--foreground)]">{detail.assignee_name ?? "Unassigned"}</span></div>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Run</div>
          <div className="space-y-2 text-sm text-[var(--foreground)]">
            <div>Name: <span className="font-medium text-[var(--foreground)]">{detail.test_run_name ?? detail.test_run_id}</span></div>
            <div>
              Environment:{" "}
              <span className="font-medium text-[var(--foreground)]">
                {detail.test_run_environment_name
                  ? `${detail.test_run_environment_name}${detail.test_run_environment_revision_number != null ? ` · r${detail.test_run_environment_revision_number}` : ""}`
                  : "—"}
              </span>
            </div>
            <div>Build: <span className="font-medium text-[var(--foreground)]">{detail.test_run_build ?? "—"}</span></div>
            <div>Executions: <span className="font-medium text-[var(--foreground)]">{detail.execution_count}</span></div>
          </div>
        </div>
      </div>

      {detail.comment ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Comment</div>
          <div className="text-sm text-[var(--foreground)]">{detail.comment}</div>
        </div>
      ) : null}

      {detail.actual_result ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Actual result</div>
          <div className="whitespace-pre-wrap text-sm text-[var(--foreground)]">{detail.actual_result}</div>
        </div>
      ) : null}

      {hasLogs ? (
        <div className="grid gap-3 md:grid-cols-2">
          {detail.system_out ? (
            <ResultLogBlock title="Stdout / log" value={detail.system_out} />
          ) : null}
          {detail.system_err ? (
            <ResultLogBlock title="Stderr" value={detail.system_err} tone="danger" />
          ) : null}
        </div>
      ) : null}

      {defectIds.length > 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Defects</div>
          <div className="flex flex-wrap gap-2">
            {defectIds.map((defectId) => (
              <span key={defectId} className="rounded-full bg-[var(--tone-danger-bg)] px-2.5 py-1 text-xs font-medium text-[var(--status-failure)]">
                {defectId}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          <Logs className="h-4 w-4" />
          Result history
        </div>
        {historyItems.length === 0 ? (
          <div className="text-sm text-[var(--muted-foreground)]">No execution history for this run result.</div>
        ) : (
          <div className="space-y-2">
            {historyItems.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[var(--muted-foreground)]">
                      {entry.from_status ? `${entry.from_status} -> ` : ""}
                      {entry.to_status}
                    </span>
                    <StatusBadge tone={getRunItemStatusTone(entry.to_status as RunCaseDto["status"])} withBorder>
                      {formatRunItemStatusLabel(entry.to_status as RunCaseDto["status"])}
                    </StatusBadge>
                  </div>
                  <span className="text-xs text-[var(--muted-foreground)]">{formatDateTime(entry.changed_at)}</span>
                </div>
                {entry.comment ? <div className="mt-2 text-sm text-[var(--foreground)]">{entry.comment}</div> : null}
                {entry.system_out ? (
                  <div className="mt-2">
                    <ResultLogBlock title="Stdout / log" value={entry.system_out} />
                  </div>
                ) : null}
                {entry.system_err ? (
                  <div className="mt-2">
                    <ResultLogBlock title="Stderr" value={entry.system_err} tone="danger" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <ResultArtifacts runCaseId={runCaseId} />
    </div>
  );
}

export function TestCaseResultsHistory({ projectId, testCaseId, className }: Props) {
  const [expandedRunCaseId, setExpandedRunCaseId] = useState<string | null>(null);
  const query = useTestCaseRunCasesPageQuery(projectId, testCaseId, {
    pageSize: 10,
    sortBy: "last_executed_at",
    sortDirection: "desc",
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  if (query.isLoading) {
    return <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] px-4 py-5 text-sm text-[var(--muted-foreground)]">Loading results history...</div>;
  }

  if (!projectId || !testCaseId || items.length === 0) {
    return (
      <div className={`rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] px-4 py-5 text-sm text-[var(--muted-foreground)] ${className ?? ""}`}>
        No run results found for this test case yet.
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {items.map((item) => {
        const isExpanded = expandedRunCaseId === item.id;
        return (
          <div key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm shadow-gray-100/60">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={getRunItemStatusTone(item.status)} withBorder>
                    {formatRunItemStatusLabel(item.status)}
                  </StatusBadge>
                  <StatusBadge tone={getRunStatusTone(item.test_run_status)} withBorder>
                    {item.test_run_status?.replace("_", " ") ?? "unknown run"}
                  </StatusBadge>
                </div>
                <div className="text-base font-semibold text-[var(--foreground)]">{item.test_run_name ?? item.test_run_id}</div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--muted-foreground)]">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="h-4 w-4 text-[var(--muted-foreground)]" />
                    {formatDateTime(item.last_executed_at)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <FlaskConical className="h-4 w-4 text-[var(--muted-foreground)]" />
                    {item.test_run_environment_name
                      ? `${item.test_run_environment_name}${item.test_run_environment_revision_number != null ? ` · r${item.test_run_environment_revision_number}` : ""}`
                      : "No environment"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Hammer className="h-4 w-4 text-[var(--muted-foreground)]" />
                    {item.test_run_build ?? "No build"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ListTree className="h-4 w-4 text-[var(--muted-foreground)]" />
                    {item.suite_name ?? "Unsorted"}
                  </span>
                  <span>Time: {item.time ?? "—"}</span>
                </div>
                {item.comment ? <div className="line-clamp-2 text-sm text-[var(--foreground)]">{item.comment}</div> : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/projects/${projectId}/test-runs/${item.test_run_id}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Open run
                </Link>
                <Button
                  unstyled
                  type="button"
                  onClick={() => setExpandedRunCaseId(isExpanded ? null : item.id)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--action-primary-fill)] px-3 py-2 text-xs font-medium text-[var(--action-primary-foreground)] transition hover:bg-[var(--action-primary-fill-hover)]"
                >
                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {isExpanded ? "Hide details" : "View details"}
                </Button>
              </div>
            </div>

            {isExpanded ? <div className="mt-4"><ResultDetails runCaseId={item.id} /></div> : null}
          </div>
        );
      })}

      {query.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            unstyled
            type="button"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {query.isFetchingNextPage ? "Loading..." : "Load more results"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
