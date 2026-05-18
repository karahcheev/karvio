// Side panel: run item snapshot, execution history, and frozen test steps.
import { useMemo } from "react";
import { User, Calendar, Tag, Edit, Trash2 } from "lucide-react";
import type { ExternalIssueLinkDto, RunCaseHistoryDto, RunCaseDto } from "@/shared/api";
import {
  SidePanel,
  SidePanelCard,
  SidePanelMetaRow,
  SidePanelSection,
  sidePanelHeaderActions,
} from "@/shared/ui/SidePanel";
import { StatusBadge, type StatusBadgeTone } from "@/shared/ui/StatusBadge";
import { TagChip } from "@/shared/ui/TagChip";
import { TagList } from "@/shared/ui/TagList";
import { formatPriorityLabel } from "@/shared/domain/priority";
import { Button } from "@/shared/ui/Button";

export type SnapshotStep = {
  id: string;
  action: string;
  expectedResult: string;
};

export type RunItemSnapshot = {
  runItemId: string;
  key: string;
  title: string;
  priority: string;
  status: RunCaseDto["status"];
  time: string | null;
  assignee: string;
  suite: string;
  tags: string[];
  environment: string;
  build: string;
  executionDate: string;
  comment: string | null;
  steps: SnapshotStep[];
  externalIssues: ExternalIssueLinkDto[];
};

type RunItemSnapshotPanelProps = Readonly<{
  isOpen: boolean;
  snapshot: RunItemSnapshot | null;
  stepsLoading: boolean;
  history: RunCaseHistoryDto[];
  historyLoading: boolean;
  onClose: () => void;
  onUpdateStatus?: (runItemId: string) => void;
  onRemove?: (runItemId: string) => void;
  onUnlinkJiraIssue?: (linkId: string) => void;
  canUpdateStatus?: boolean;
  canRemove?: boolean;
  canManageJira?: boolean;
  jiraActionLoading?: boolean;
  removeLoading?: boolean;
  updateStatusDisabledReason?: string;
}>;

function getStatusTone(status: RunCaseDto["status"]): StatusBadgeTone {
  if (status === "passed") return "success";
  if (status === "error") return "error";
  if (status === "failure" || status === "xpassed") return "danger";
  if (status === "blocked") return "warning";
  if (status === "in_progress") return "info";
  if (status === "skipped") return "neutral";
  if (status === "xfailed") return "neutral";
  return "muted";
}

function getPriorityBadge(priority: string) {
  const value = priority.toLowerCase() as "low" | "medium" | "high";
  if (value === "high") return "bg-[var(--tone-danger-bg)] text-[var(--status-failure)]";
  if (value === "low") return "bg-[var(--accent)] text-[var(--foreground)]";
  return "bg-[var(--tone-warning-bg)] text-[var(--status-blocked)]";
}

function formatStatusLabel(status: RunCaseDto["status"]) {
  if (status === "xfailed") return "XFailed";
  if (status === "xpassed") return "XPassed";
  return status.replace("_", " ");
}

function formatResultTimestamp(value: string | null) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
}

function formatDuration(value: number | null) {
  if (value === null) return null;
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)} s`;
}

function HistoryLogBlock({
  value,
  tone = "neutral",
}: Readonly<{
  value: string;
  tone?: "neutral" | "danger";
}>) {
  return (
    <pre
      className={
        tone === "danger"
          ? "max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--tone-danger-border)] bg-[var(--card)] p-3 text-xs text-[var(--tone-danger-text)]"
          : "max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--tone-neutral-border)] bg-[var(--card)] p-3 text-xs text-[var(--tone-neutral-text)]"
      }
    >
      {value}
    </pre>
  );
}

function RunItemExecutionHistorySection({
  historyLoading,
  history,
}: Readonly<{
  historyLoading: boolean;
  history: RunCaseHistoryDto[];
}>) {
  if (historyLoading) {
    return <SidePanelCard className="text-sm text-[var(--muted-foreground)]">Loading history...</SidePanelCard>;
  }
  if (history.length === 0) {
    return <SidePanelCard className="border-dashed text-sm text-[var(--muted-foreground)]">No execution history yet.</SidePanelCard>;
  }
  return (
    <div className="space-y-3">
      {history.map((entry) => (
        <SidePanelCard key={entry.id} className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-[var(--muted-foreground)]">
                {entry.from_status ? `${entry.from_status} → ` : ""}
                {entry.to_status}
              </span>
              <StatusBadge tone={getStatusTone(entry.to_status as RunCaseDto["status"])} withBorder>
                {formatStatusLabel(entry.to_status as RunCaseDto["status"])}
              </StatusBadge>
            </div>
            <span className="text-xs text-[var(--muted-foreground)]">{formatResultTimestamp(entry.changed_at)}</span>
          </div>
          <div className="grid gap-2 text-sm text-[var(--foreground)] sm:grid-cols-2">
            <div>
              <span className="text-[var(--muted-foreground)]">Executed by:</span>{" "}
              <span className="font-medium text-[var(--foreground)]">{entry.executed_by_id ?? "Unknown user"}</span>
            </div>
            <div>
              <span className="text-[var(--muted-foreground)]">Time:</span>{" "}
              <span className="font-medium text-[var(--foreground)]">{entry.time || "—"}</span>
            </div>
            <div>
              <span className="text-[var(--muted-foreground)]">Duration:</span>{" "}
              <span className="font-medium text-[var(--foreground)]">{formatDuration(entry.duration_ms) ?? "—"}</span>
            </div>
          </div>
          {entry.defect_ids.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {entry.defect_ids.map((defectId) => (
                <span
                  key={defectId}
                  className="rounded-full bg-[var(--tone-danger-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--status-failure)]"
                >
                  {defectId}
                </span>
              ))}
            </div>
          ) : null}
          {entry.comment ? <p className="text-sm text-[var(--foreground)]">{entry.comment}</p> : null}
          {entry.system_out ? <HistoryLogBlock value={entry.system_out} /> : null}
          {entry.system_err ? <HistoryLogBlock value={entry.system_err} tone="danger" /> : null}
        </SidePanelCard>
      ))}
    </div>
  );
}

function RunItemSnapshotHeaderActions({
  snapshot,
  onUpdateStatus,
  onRemove,
  canUpdateStatus,
  canRemove,
  removeLoading,
}: Readonly<{
  snapshot: RunItemSnapshot;
  onUpdateStatus?: (runItemId: string) => void;
  onRemove?: (runItemId: string) => void;
  canUpdateStatus: boolean;
  canRemove: boolean;
  removeLoading: boolean;
}>) {
  return (
    <>
      {onUpdateStatus ? (
        <Button
          unstyled
          type="button"
          onClick={() => onUpdateStatus(snapshot.runItemId)}
          disabled={!canUpdateStatus}
          className={
            canUpdateStatus
              ? sidePanelHeaderActions.primary
              : "inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--accent)] px-3 py-2 text-xs font-medium text-[var(--muted-foreground)]"
          }
        >
          <Edit className="h-3.5 w-3.5" />
          Add Result
        </Button>
      ) : null}
      {onRemove ? (
        <Button
          unstyled
          type="button"
          onClick={() => onRemove(snapshot.runItemId)}
          disabled={!canRemove || removeLoading}
          className={
            canRemove && !removeLoading
              ? sidePanelHeaderActions.danger
              : "inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--accent)] px-3 py-2 text-xs font-medium text-[var(--muted-foreground)]"
          }
        >
          <Trash2 className="h-3.5 w-3.5" />
          {removeLoading ? "Removing..." : "Remove"}
        </Button>
      ) : null}
    </>
  );
}

function RunItemSnapshotPanelBody({
  snapshot,
  stepTitle,
  stepsLoading,
  history,
  historyLoading,
  onUnlinkJiraIssue,
  canManageJira,
  jiraActionLoading,
}: Readonly<{
  snapshot: RunItemSnapshot;
  stepTitle: string;
  stepsLoading: boolean;
  history: RunCaseHistoryDto[];
  historyLoading: boolean;
  onUnlinkJiraIssue?: (linkId: string) => void;
  canManageJira: boolean;
  jiraActionLoading: boolean;
}>) {
  return (
    <div className="space-y-5">
      <SidePanelSection title="Execution">
        <SidePanelCard>
          <SidePanelMetaRow
            label="Assignee"
            value={
              <span className="inline-flex items-center gap-2">
                <User className="h-4 w-4 text-[var(--muted-foreground)]" />
                {snapshot.assignee}
              </span>
            }
          />
          <SidePanelMetaRow
            label="Status"
            value={
              <StatusBadge tone={getStatusTone(snapshot.status)} withBorder>
                {formatStatusLabel(snapshot.status)}
              </StatusBadge>
            }
          />
          <SidePanelMetaRow label="Test Case ID" value={snapshot.key} />
          <SidePanelMetaRow
            label="Last run"
            value={
              <span className="inline-flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[var(--muted-foreground)]" />
                {snapshot.executionDate}
              </span>
            }
          />
          <SidePanelMetaRow label="Time" value={snapshot.time || "—"} />
        </SidePanelCard>
      </SidePanelSection>

      <SidePanelSection title="Test case">
        <SidePanelCard>
          <SidePanelMetaRow
            label="Priority"
            value={
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getPriorityBadge(snapshot.priority)}`}>
                {formatPriorityLabel(snapshot.priority)}
              </span>
            }
          />
          <SidePanelMetaRow label="Suite" value={snapshot.suite} />
          <SidePanelMetaRow label="Environment" value={snapshot.environment} />
          <SidePanelMetaRow label="Build" value={snapshot.build} />
          <SidePanelMetaRow
            label="Tags"
            value={
              snapshot.tags.length > 0 ? (
                <TagList gap="sm">
                  {snapshot.tags.map((tag) => (
                    <TagChip key={tag} variant="outline" leading={<Tag className="h-3 w-3 shrink-0 text-[var(--muted-foreground)]" aria-hidden />}>
                      {tag}
                    </TagChip>
                  ))}
                </TagList>
              ) : (
                "—"
              )
            }
            alignTop
          />
        </SidePanelCard>
      </SidePanelSection>

      {snapshot.comment ? (
        <SidePanelSection title="Latest comment">
          <SidePanelCard className="border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg-soft)]">
            <p className="text-sm text-[var(--foreground)]">{snapshot.comment}</p>
          </SidePanelCard>
        </SidePanelSection>
      ) : null}

      <SidePanelSection title="External issues">
        <SidePanelCard className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {snapshot.externalIssues.length === 0 ? (
              <span className="text-sm text-[var(--muted-foreground)]">No linked Jira issues.</span>
            ) : (
              snapshot.externalIssues.map((issue) => (
                <div key={issue.id} className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1">
                  <a
                    href={issue.external_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-[var(--status-in-progress)] hover:underline"
                  >
                    {issue.external_key}
                  </a>
                  <span className="text-xs text-[var(--muted-foreground)]">{issue.snapshot_status ?? "Unknown"}</span>
                  {onUnlinkJiraIssue ? (
                    <button
                      type="button"
                      onClick={() => onUnlinkJiraIssue(issue.id)}
                      disabled={!canManageJira || jiraActionLoading}
                      className="rounded px-1 text-[11px] text-[var(--status-failure)] hover:bg-[var(--tone-danger-bg-soft)] disabled:opacity-50"
                    >
                      unlink
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </SidePanelCard>
      </SidePanelSection>

      <SidePanelSection title="Execution history">
        <RunItemExecutionHistorySection historyLoading={historyLoading} history={history} />
      </SidePanelSection>

      <SidePanelSection title={stepTitle}>
        <RunItemSnapshotStepsSection stepsLoading={stepsLoading} steps={snapshot.steps} />
      </SidePanelSection>
    </div>
  );
}

function RunItemSnapshotStepsSection({
  stepsLoading,
  steps,
}: Readonly<{
  stepsLoading: boolean;
  steps: SnapshotStep[];
}>) {
  if (stepsLoading) {
    return <SidePanelCard className="text-sm text-[var(--muted-foreground)]">Loading steps...</SidePanelCard>;
  }
  if (steps.length === 0) {
    return <SidePanelCard className="border-dashed text-sm text-[var(--muted-foreground)]">No steps for this test case.</SidePanelCard>;
  }
  return (
    <div className="space-y-3">
      {steps.map((step, index) => (
        <SidePanelCard key={step.id} className="space-y-3">
          <div className="font-mono text-sm font-medium text-[var(--muted-foreground)]">Step {index + 1}</div>
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Action</div>
            <div className="text-sm text-[var(--foreground)]">{step.action}</div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Expected result</div>
            <div className="text-sm text-[var(--foreground)]">{step.expectedResult}</div>
          </div>
        </SidePanelCard>
      ))}
    </div>
  );
}

export function RunItemSnapshotPanel({
  isOpen,
  snapshot,
  stepsLoading,
  history,
  historyLoading,
  onClose,
  onUpdateStatus,
  onRemove,
  onUnlinkJiraIssue,
  canUpdateStatus = true,
  canRemove = true,
  canManageJira = true,
  jiraActionLoading = false,
  removeLoading = false,
  updateStatusDisabledReason,
}: RunItemSnapshotPanelProps) {
  // Derived: steps section title
  const stepTitle = useMemo(() => {
    if (!snapshot) return "Test Steps";
    if (stepsLoading) return "Test Steps";
    return `Test Steps (${snapshot.steps.length})`;
  }, [snapshot, stepsLoading]);

  if (!isOpen || !snapshot) return null;

  return (
    <SidePanel
      title={snapshot.title}
      onClose={onClose}
      className="w-full sm:w-[34rem] xl:w-[40rem]"
      actions={
        <RunItemSnapshotHeaderActions
          snapshot={snapshot}
          onUpdateStatus={onUpdateStatus}
          onRemove={onRemove}
          canUpdateStatus={canUpdateStatus}
          canRemove={canRemove}
          removeLoading={removeLoading}
        />
      }
    >
      {((!canUpdateStatus && onUpdateStatus) || (!canRemove && onRemove)) && updateStatusDisabledReason ? (
        <p className="mb-4 text-xs text-[var(--muted-foreground)]">{updateStatusDisabledReason}</p>
      ) : null}

      <RunItemSnapshotPanelBody
        snapshot={snapshot}
        stepTitle={stepTitle}
        stepsLoading={stepsLoading}
        history={history}
        historyLoading={historyLoading}
        onUnlinkJiraIssue={onUnlinkJiraIssue}
        canManageJira={canManageJira}
        jiraActionLoading={jiraActionLoading}
      />
    </SidePanel>
  );
}
