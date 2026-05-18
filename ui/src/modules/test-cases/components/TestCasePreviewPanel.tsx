// Read-only side preview with tabs: details, steps, attachments, history.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  FileText,
  FolderOpen,
  History,
  ListTodo,
  Pencil,
  Tag,
  Trash2,
  User,
} from "lucide-react";
import { Link, useLocation } from "react-router";
import {
  downloadTestCaseAttachment,
  getAuditLogs,
  useTestCaseAttachmentsQuery,
  useTestCaseQuery,
  useTestCaseStepsQuery,
} from "@/shared/api";
import { formatPriorityLabel } from "@/shared/domain/priority";
import { formatTestCaseTypeLabel } from "@/shared/domain/testCaseType";
import { Button } from "@/shared/ui/Button";
import { RichTextPreview } from "@/shared/ui/RichTextPreview";
import { TagChip } from "@/shared/ui/TagChip";
import { TagList } from "@/shared/ui/TagList";
import {
  SidePanel,
  SidePanelCard,
  SidePanelMetaRow,
  SidePanelSection,
  SidePanelTabs,
  sidePanelHeaderActions,
} from "@/shared/ui/SidePanel";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { AttachmentSection } from "./AttachmentSection";
import {
  formatTestCaseStatusLabel,
  getPriorityTone,
  getStatusTone,
} from "./TestCaseBadges";
import { TestCaseResultsHistory } from "./TestCaseResultsHistory";
import type { TestCaseListItem } from "./types";
import {
  collectChangedFields,
  formatUtcTimestamp,
  isIgnoredChangePath,
  shouldDisplayChangesForAction,
  stringifyJson,
} from "@/modules/audit-logs/utils";
import { TestCaseCodeBlock } from "./TestCaseCodeBlock";
import type { TestCaseDto, TestStepDto } from "@/shared/api/tms/types";

type Props = Readonly<{
  projectId: string | undefined;
  testCase: TestCaseListItem;
  isDeleting: boolean;
  onDelete: (testCase: TestCaseListItem) => void;
  onClose: () => void;
}>;

type PreviewTab = "details" | "results-history" | "history";

const sidePanelTabs = [
  { value: "details", label: "Details", icon: <FileText className="h-4 w-4" /> },
  { value: "results-history", label: "Results history", icon: <ListTodo className="h-4 w-4" /> },
  { value: "history", label: "History", icon: <History className="h-4 w-4" /> },
] as const;

// Display helpers for history tab
function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatActionLabel(action: string): string {
  return action
    .replace(/^test_case\./, "")
    .replaceAll("_", " ")
    .replaceAll(".", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// Single audit history card with optional diff
function HistoryEntryCard({
  action,
  actorLabel,
  requestId,
  result,
  timestamp,
  before,
  after,
}: Readonly<{
  action: string;
  actorLabel: string;
  requestId: string | null;
  result: "success" | "fail";
  timestamp: string;
  before: unknown;
  after: unknown;
}>) {
  const changes = collectChangedFields(before, after)
    .filter((change) => !isIgnoredChangePath(change.path))
    .slice(0, 4);
  const shouldDisplayChanges = shouldDisplayChangesForAction(action);

  return (
    <SidePanelCard className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={result === "success" ? "success" : "danger"} withBorder>
              {result}
            </StatusBadge>
            <span className="text-sm font-semibold text-[var(--foreground)]">{formatActionLabel(action)}</span>
          </div>
          <div className="text-xs text-[var(--muted-foreground)]">{formatUtcTimestamp(timestamp)}</div>
        </div>
        <div className="text-right text-xs text-[var(--muted-foreground)]">
          <div>{actorLabel}</div>
          {requestId ? <div className="font-mono">{requestId}</div> : null}
        </div>
      </div>

      {(() => {
        if (!shouldDisplayChanges) {
          return null;
        }
        if (changes.length === 0) {
          return (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)] px-3 py-3 text-sm text-[var(--muted-foreground)]">
              No field-level changes were detected for this event.
            </div>
          );
        }
        return (
          <div className="space-y-2">
            {changes.map((change) => (
              <div key={change.path} className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-3">
                <div className="mb-2 font-mono text-[11px] text-[var(--muted-foreground)]">{change.path}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Before</div>
                    <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 text-xs text-[var(--foreground)]">
                      {stringifyJson(change.before)}
                    </pre>
                  </div>
                  <div>
                    <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">After</div>
                    <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 text-xs text-[var(--foreground)]">
                      {stringifyJson(change.after)}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </SidePanelCard>
  );
}

function TestCasePreviewStepsBody({
  isLoading,
  steps,
}: Readonly<{
  isLoading: boolean;
  steps: readonly TestStepDto[];
}>) {
  if (isLoading) {
    return <SidePanelCard className="text-sm text-[var(--muted-foreground)]">Loading steps...</SidePanelCard>;
  }
  if (steps.length === 0) {
    return <SidePanelCard className="border-dashed text-sm text-[var(--muted-foreground)]">No steps added yet.</SidePanelCard>;
  }
  return (
    <div className="space-y-3">
      {steps.map((step, index) => (
        <SidePanelCard key={step.id} className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--highlight-bg-soft)] px-2.5 py-1 text-xs font-medium text-[var(--highlight-foreground)]">
            <ListTodo className="h-3.5 w-3.5" />
            Step {index + 1}
          </div>
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Action</div>
              <RichTextPreview value={step.action} emptyMessage="No action provided." />
            </div>
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Expected result</div>
              <RichTextPreview
                value={step.expected_result}
                emptyMessage="No expected result provided."
              />
            </div>
          </div>
        </SidePanelCard>
      ))}
    </div>
  );
}

function TestCasePreviewTemplateSection({
  detail,
  stepsLoading,
  steps,
}: Readonly<{
  detail: TestCaseDto | undefined;
  stepsLoading: boolean;
  steps: readonly TestStepDto[];
}>) {
  if (detail?.template_type === "automated") {
    return (
      <SidePanelSection>
        <TestCaseCodeBlock
          title="Raw Test"
          value={detail.raw_test ?? null}
          language={detail.raw_test_language ?? "text"}
          isEditing={false}
          placeholder=""
          onChange={() => undefined}
          onLanguageChange={() => undefined}
        />
      </SidePanelSection>
    );
  }
  if (detail?.template_type === "steps") {
    const stepsTitle = stepsLoading ? "Test Steps" : `Test Steps (${steps.length})`;
    return (
      <SidePanelSection title={stepsTitle} description="Action and expected result for each step.">
        <TestCasePreviewStepsBody isLoading={stepsLoading} steps={steps} />
      </SidePanelSection>
    );
  }
  return null;
}

export function TestCasePreviewPanel({
  projectId,
  testCase,
  isDeleting,
  onDelete,
  onClose,
}: Props) {
  const location = useLocation();
  // Sub-tab: details vs audit history
  const [activeTab, setActiveTab] = useState<PreviewTab>("details");

  // Detail, steps, attachments; history loaded when tab active
  const detailQuery = useTestCaseQuery(testCase.testCaseId);
  const shouldLoadSteps = detailQuery.data?.template_type === "steps";
  const stepsQuery = useTestCaseStepsQuery(testCase.testCaseId, shouldLoadSteps);
  const attachmentsQuery = useTestCaseAttachmentsQuery(testCase.testCaseId);
  const historyQuery = useQuery({
    queryKey: ["test-cases", testCase.testCaseId, "audit-history"],
    queryFn: () =>
      getAuditLogs({
        project_id: projectId,
        resource_type: "test_case",
        resource_id: testCase.testCaseId,
        page_size: 20,
        sort_by: "timestamp_utc",
        sort_order: "desc",
      }),
    enabled: activeTab === "history",
  });

  const detail = detailQuery.data;
  const steps = stepsQuery.data?.steps ?? [];
  const attachments = attachmentsQuery.data ?? [];
  const historyItems = historyQuery.data?.items ?? [];

  // Merged list row + API detail fields
  const title = detail?.title ?? testCase.title;
  const suiteLabel = detail?.suite_name ?? testCase.suite;
  const ownerLabel = detail?.owner_name ?? testCase.owner;
  const status = detail?.status ?? testCase.status;
  const priority = detail?.priority ?? testCase.priority;
  const type = detail?.test_case_type ?? testCase.testCaseType;
  const tags = detail?.tags ?? testCase.tags;
  const updatedAt = detail?.updated_at;
  const createdAt = detail?.created_at;
  const preconditions = detail?.preconditions;
  const time = detail?.time ?? testCase.time;

  return (
    <SidePanel
      title={title}
      onClose={onClose}
      actions={
        <>
          <Link
            to={{
              pathname: `/projects/${projectId}/test-cases/${testCase.testCaseId}`,
              search: location.search,
            }}
            className={sidePanelHeaderActions.secondary}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Open
          </Link>
          <Link
            to={{
              pathname: `/projects/${projectId}/test-cases/${testCase.testCaseId}`,
              search: location.search,
              hash: "#edit",
            }}
            className={sidePanelHeaderActions.secondary}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
          <Button type="button" variant="danger" size="panel" onClick={() => onDelete(testCase)} disabled={isDeleting}>
            <Trash2 className="h-3.5 w-3.5" />
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </>
      }
      tabs={
        <SidePanelTabs
          value={activeTab}
          onChange={setActiveTab}
          items={[...sidePanelTabs]}
        />
      }
    >
      {(() => {
        if (activeTab === "details") {
          return (
        <div className="space-y-5">
          <SidePanelSection title="Metadata">
            <SidePanelCard>
            <SidePanelMetaRow
                label="ID"
                value={testCase.id}
              />
              <SidePanelMetaRow
                label="Status"
                value={<StatusBadge tone={getStatusTone(status)}>{formatTestCaseStatusLabel(status)}</StatusBadge>}
              />
              <SidePanelMetaRow label="Type" value={formatTestCaseTypeLabel(type)} />
              <SidePanelMetaRow
                label="Tags"
                value={<TagList gap="md">{tags.map((tag) => (
                  <TagChip
                    key={tag}
                    variant="outline"
                    size="md"
                    leading={<Tag className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" aria-hidden />}
                  >
                    {tag}
                  </TagChip>
                ))}</TagList>}
              />
              <SidePanelMetaRow label="Expected Time" value={time || "—"} />
              <SidePanelMetaRow
                label="Priority"
                value={<StatusBadge tone={getPriorityTone(priority)}>{formatPriorityLabel(priority)}</StatusBadge>}
              />
              <SidePanelMetaRow
                label="Owner"
                value={
                  <span className="inline-flex items-center gap-2">
                    <User className="h-4 w-4 text-[var(--muted-foreground)]" />
                    {ownerLabel}
                  </span>
                }
              />
              <SidePanelMetaRow label="Suite" value={suiteLabel} />
              <SidePanelMetaRow
                label="Created"
                value={
                  <span className="inline-flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-[var(--muted-foreground)]" />
                    {formatDateTime(createdAt)}
                  </span>
                }
              />
              <SidePanelMetaRow
                label="Updated"
                value={
                  <span className="inline-flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-[var(--muted-foreground)]" />
                    {formatDateTime(updatedAt)}
                  </span>
                }
              />
            </SidePanelCard>
            
          </SidePanelSection>

              {preconditions ? (
            <SidePanelSection title="Preconditions">
                <RichTextPreview
                  value={preconditions}
                  emptyMessage="No preconditions specified."
                />
            </SidePanelSection>
          ) : null}

          <TestCasePreviewTemplateSection detail={detail} stepsLoading={stepsQuery.isLoading} steps={steps} />

          <SidePanelSection title="Attachments">
            <AttachmentSection
              title=""
              subtitle=""
              attachments={attachments}
              emptyMessage="No files attached to this test case."
              uploadLabel="Files"
              showUploadAction={false}
              showDeleteAction={false}
              onUpload={async () => undefined}
              onDelete={async () => undefined}
              onDownload={(attachment) =>
                downloadTestCaseAttachment(testCase.testCaseId, attachment.id, attachment.filename)
              }
            />
          </SidePanelSection>
        </div>
          );
        }
        if (activeTab === "results-history") {
          return <TestCaseResultsHistory projectId={projectId} testCaseId={testCase.testCaseId} />;
        }
        if (historyQuery.isLoading) {
          return <SidePanelCard className="text-sm text-[var(--muted-foreground)]">Loading history...</SidePanelCard>;
        }
        if (historyItems.length === 0) {
          return (
        <SidePanelCard className="border-dashed text-sm text-[var(--muted-foreground)]">
          No audit history is available for this test case yet.
        </SidePanelCard>
          );
        }
        return (
        <div className="space-y-3">
          {historyItems.map((entry) => (
            <HistoryEntryCard
              key={entry.event_id}
              action={entry.action}
              actorLabel={entry.actor_id ?? entry.actor_type}
              requestId={entry.request_id}
              result={entry.result}
              timestamp={entry.timestamp_utc}
              before={entry.before}
              after={entry.after}
            />
          ))}
        </div>
        );
      })()}
    </SidePanel>
  );
}
