import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Plus } from "lucide-react";
import {
  type TestPlanDto,
  type TestRunDto,
  useAddRunCasesMutation,
  useCreateTestPlanMutation,
  useCreateTestRunMutation,
  useEnvironmentsPageQuery,
  useMilestoneQuery,
  useMilestoneSummaryQuery,
  useProjectMembersQuery,
  useSetTestRunStatusMutation,
  useTestPlansPageQuery,
  useTestRunsPageQuery,
} from "@/shared/api";
import { CommonPage, UnderlineTabs } from "@/shared/ui";
import { Button } from "@/shared/ui/Button";
import { DetailPageHeader } from "@/shared/ui/DetailPageHeader";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { DateTimeCell, StatusCell } from "@/shared/ui/table-cells";
import { UnifiedTable, type UnifiedTableColumn } from "@/shared/ui/Table";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import { PlanFormModal } from "@/modules/test-runs/components/PlanFormModal";
import { CreateRunDialog } from "@/modules/test-runs/components/CreateRunDialog";
import { normalizeCreateRunPayload } from "@/modules/test-runs/utils/create-run";

function runStatusLabel(status: TestRunDto["status"]): string {
  if (status === "not_started") return "Not started";
  if (status === "in_progress") return "In progress";
  if (status === "completed") return "Completed";
  return "Archived";
}

function runStatusTone(status: TestRunDto["status"]): "neutral" | "info" | "success" | "warning" {
  if (status === "in_progress") return "info";
  if (status === "completed") return "success";
  if (status === "archived") return "warning";
  return "neutral";
}

function milestoneStatusLabel(status: "planned" | "active" | "completed" | "archived"): string {
  if (status === "planned") return "Planned";
  if (status === "active") return "Active";
  if (status === "completed") return "Completed";
  return "Archived";
}

function milestoneStatusTone(status: "planned" | "active" | "completed" | "archived"): "neutral" | "info" | "success" | "warning" {
  if (status === "active") return "info";
  if (status === "completed") return "success";
  if (status === "archived") return "warning";
  return "neutral";
}

type TabValue = "overview" | "plans" | "runs";

export function MilestoneDetailsPage() {
  const { projectId, milestoneId } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabValue>("overview");
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [runModalOpen, setRunModalOpen] = useState(false);

  const milestoneQuery = useMilestoneQuery(milestoneId, Boolean(milestoneId));
  const summaryQuery = useMilestoneSummaryQuery(milestoneId, Boolean(milestoneId));

  const plansQuery = useTestPlansPageQuery(
    projectId,
    {
      page: 1,
      pageSize: 100,
      milestoneIds: milestoneId ? [milestoneId] : undefined,
      search: undefined,
      tags: undefined,
    },
  );
  const runsQuery = useTestRunsPageQuery(
    projectId,
    {
      page: 1,
      pageSize: 100,
      milestoneIds: milestoneId ? [milestoneId] : undefined,
      statuses: ["not_started", "in_progress", "completed", "archived"],
      environmentIds: undefined,
      search: undefined,
      createdBy: undefined,
      createdFrom: undefined,
      createdTo: undefined,
      sortBy: "created_at",
      sortOrder: "desc",
    },
  );

  const membersQuery = useProjectMembersQuery(projectId);
  const environmentsQuery = useEnvironmentsPageQuery(
    projectId,
    { page: 1, pageSize: 200, sortBy: "name", sortOrder: "asc" },
    Boolean(projectId),
  );

  const createPlanMutation = useCreateTestPlanMutation();
  const createRunMutation = useCreateTestRunMutation();
  const addRunCasesMutation = useAddRunCasesMutation();
  const setRunStatusMutation = useSetTestRunStatusMutation();

  const milestone = milestoneQuery.data;
  const summary = summaryQuery.data;
  const ownerLabelById = useMemo(
    () => new Map((membersQuery.data ?? []).map((member) => [member.user_id, member.username ?? "Unknown"])),
    [membersQuery.data],
  );

  const assigneeOptions = useMemo(
    () => Array.from(ownerLabelById.entries()).map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label)),
    [ownerLabelById],
  );

  const environmentOptions = useMemo(
    () =>
      (environmentsQuery.data?.items ?? []).map((environment) => ({
        id: environment.id,
        label: environment.name,
        revisionNumber: environment.current_revision_number ?? null,
      })),
    [environmentsQuery.data?.items],
  );

  const milestoneOptions = milestone ? [{ id: milestone.id, label: milestone.name }] : [];

  const plansColumns: UnifiedTableColumn<TestPlanDto, string>[] = [
    {
      id: "name",
      label: "Name",
      menuLabel: "Name",
      defaultWidth: 280,
      minWidth: 180,
      renderCell: (item) => (
        <Link to={`/projects/${projectId}/products/test-plans`} className="text-[var(--highlight-foreground)] hover:underline">
          {item.name}
        </Link>
      ),
    },
    {
      id: "cases",
      label: "Cases",
      menuLabel: "Cases",
      defaultWidth: 100,
      minWidth: 80,
      renderCell: (item) => <span className="text-sm text-[var(--foreground)]">{item.case_ids.length}</span>,
    },
    {
      id: "created",
      label: "Created",
      menuLabel: "Created",
      defaultWidth: 220,
      minWidth: 180,
      renderCell: (item) => <DateTimeCell value={item.created_at} fallback="-" truncate={false} />,
    },
  ];

  const runsColumns: UnifiedTableColumn<TestRunDto, string>[] = [
    {
      id: "name",
      label: "Run",
      menuLabel: "Run",
      defaultWidth: 280,
      minWidth: 180,
      renderCell: (item) => (
        <Link to={`/projects/${projectId}/test-runs/${item.id}`} className="text-[var(--highlight-foreground)] hover:underline">
          {item.name}
        </Link>
      ),
    },
    {
      id: "status",
      label: "Status",
      menuLabel: "Status",
      defaultWidth: 140,
      minWidth: 110,
      renderCell: (item) => <StatusCell tone={runStatusTone(item.status)}>{runStatusLabel(item.status)}</StatusCell>,
    },
    {
      id: "created",
      label: "Created",
      menuLabel: "Created",
      defaultWidth: 220,
      minWidth: 180,
      renderCell: (item) => <DateTimeCell value={item.created_at} fallback="-" truncate={false} />,
    },
  ];

  if (!projectId || !milestoneId) {
    return null;
  }

  return (
    <CommonPage>
      <DetailPageHeader
        backLabel="Back to Milestones"
        backTo={`/projects/${projectId}/products/milestones`}
        title={milestone?.name ?? "Loading..."}
        titleTrailing={
          <StatusBadge tone={milestone ? milestoneStatusTone(milestone.status) : "neutral"} withBorder>
            {milestone ? milestoneStatusLabel(milestone.status) : "—"}
          </StatusBadge>
        }
        meta={
          <>
            <span>{milestone?.description ?? "Release milestone details"}</span>
            <span>Release {milestone?.release_label ?? "—"}</span>
            <span>Target {milestone?.target_date ?? "—"}</span>
            <span>Owner {milestone?.owner_id ? ownerLabelById.get(milestone.owner_id) ?? "Unknown" : "—"}</span>
          </>
        }
        actions={
          <>
            <Button
              unstyled
              onClick={() => setPlanModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm hover:bg-[var(--muted)]"
            >
              <Plus className="h-4 w-4" />
              New plan
            </Button>
            <Button
              unstyled
              onClick={() => setRunModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--action-primary-fill)] px-3 py-2 text-sm text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)]"
            >
              <Plus className="h-4 w-4" />
              New run
            </Button>
          </>
        }
      />

      <UnderlineTabs
        value={activeTab}
        onChange={setActiveTab}
        className="border-t"
        items={[
          { value: "overview", label: "Overview" },
          { value: "plans", label: "Test Plans" },
          { value: "runs", label: "Test Runs" },
        ]}
      />

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {activeTab === "overview" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <InfoCard title="Plans" value={summary?.plans_total ?? 0} />
              <InfoCard title="Runs" value={summary?.runs_total ?? 0} />
              <InfoCard title="Total tests" value={summary?.total_tests ?? 0} />
              <InfoCard title="Pass rate" value={`${summary?.pass_rate ?? 0}%`} />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <InfoCard title="Passed" value={summary?.passed ?? 0} />
              <InfoCard title="Failed" value={(summary?.error ?? 0) + (summary?.failure ?? 0)} />
              <InfoCard title="Blocked" value={summary?.blocked ?? 0} />
              <InfoCard title="Untested" value={summary?.untested ?? 0} />
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--table-canvas)] p-3 text-sm text-[var(--muted-foreground)]">
              Deadline: {milestone?.target_date ?? "—"} · Overdue: {summary?.overdue ? "Yes" : "No"}
            </div>
          </div>
        ) : null}

        {activeTab === "plans" ? (
          <UnifiedTable
            className="p-0"
            items={plansQuery.data?.items ?? []}
            columns={plansColumns}
            visibleColumns={new Set(plansColumns.map((column) => column.id))}
            getRowId={(item) => item.id}
            onRowClick={() => navigate(`/projects/${projectId}/products/test-plans`)}
          />
        ) : null}

        {activeTab === "runs" ? (
          <UnifiedTable
            className="p-0"
            items={runsQuery.data?.items ?? []}
            columns={runsColumns}
            visibleColumns={new Set(runsColumns.map((column) => column.id))}
            getRowId={(item) => item.id}
            onRowClick={(item) => navigate(`/projects/${projectId}/test-runs/${item.id}`)}
          />
        ) : null}
      </div>

      <PlanFormModal
        isOpen={planModalOpen}
        loading={createPlanMutation.isPending}
        plan={null}
        defaultMilestoneId={milestoneId}
        projectId={projectId}
        suites={[]}
        testCases={[]}
        milestoneOptions={milestoneOptions}
        onClose={() => setPlanModalOpen(false)}
        onSubmit={async (payload) => {
          try {
            await createPlanMutation.mutateAsync({
              project_id: projectId,
              name: payload.name,
              description: payload.description || null,
              tags: payload.tags,
              milestone_id: payload.milestone_id ?? milestoneId,
              suite_ids: payload.suite_ids,
              case_ids: payload.case_ids,
            });
            notifySuccess("Test plan created");
            setPlanModalOpen(false);
            await plansQuery.refetch();
          } catch (error) {
            notifyError(error, "Failed to create test plan.");
            throw error;
          }
        }}
      />

      <CreateRunDialog
        isOpen={runModalOpen}
        loading={
          createRunMutation.isPending ||
          addRunCasesMutation.isPending ||
          setRunStatusMutation.isPending
        }
        defaultMilestoneId={milestoneId}
        projectId={projectId}
        suites={[]}
        testCases={[]}
        assigneeOptions={assigneeOptions}
        environmentOptions={environmentOptions}
        milestoneOptions={milestoneOptions}
        onClose={() => setRunModalOpen(false)}
        onSubmit={async (payload, startImmediately) => {
          const normalized = normalizeCreateRunPayload(payload);
          if (!normalized.name) return;
          try {
            const createdRun = await createRunMutation.mutateAsync({
              project_id: projectId,
              name: normalized.name,
              description: normalized.description,
              environment_id: normalized.environment_id,
              milestone_id: normalized.milestone_id ?? milestoneId,
              build: normalized.build,
              assignee: normalized.assignee,
            });
            if (normalized.selectedCaseIds.length > 0) {
              await addRunCasesMutation.mutateAsync({
                runId: createdRun.id,
                payload: { test_case_ids: normalized.selectedCaseIds },
              });
            }
            for (const suiteId of normalized.selectedSuiteIds) {
              await addRunCasesMutation.mutateAsync({
                runId: createdRun.id,
                payload: { suite_id: suiteId },
              });
            }
            const finalRun = startImmediately
              ? await setRunStatusMutation.mutateAsync({ runId: createdRun.id, status: "in_progress" })
              : createdRun;
            notifySuccess(`Run "${finalRun.name}" created`);
            setRunModalOpen(false);
            await runsQuery.refetch();
            navigate(`/projects/${projectId}/test-runs/${finalRun.id}`);
          } catch (error) {
            notifyError(error, "Failed to create run.");
          }
        }}
      />
    </CommonPage>
  );
}

function InfoCard(props: Readonly<{ title: string; value: string | number }>) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--table-canvas)] p-3">
      <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">{props.title}</div>
      <div className="mt-1 text-xl font-semibold text-[var(--foreground)]">{props.value}</div>
    </div>
  );
}
