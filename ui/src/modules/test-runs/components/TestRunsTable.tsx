// Test runs table: columns, progress, and row actions.
import type { TestRunDto } from "@/shared/api";
import { invokeMaybeAsync } from "@/shared/lib/invoke-maybe-async";
import { ExternalLink, FileUp } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { RowActionsMenu } from "@/shared/ui/RowActionsMenu";
import {
  UnifiedTable,
  type UnifiedTableColumn,
  type UnifiedTableProps,
  type UnifiedTableSorting,
} from "@/shared/ui/Table";
import { DateTimeCell, PrimarySecondaryCell, StatusCell } from "@/shared/ui/table-cells";
import type { StatusBadgeTone } from "@/shared/ui/StatusBadge";
import { getRunProgressBarModel } from "@/shared/lib/run-progress-bar-model";
import { RunProgressBarMini } from "@/shared/ui";
import { getRunFlowAction } from "./RunDetailsSidePanel";
import { canImportJunitIntoRun } from "@/modules/test-runs/constants";

export interface RunView extends TestRunDto {
  progress: number;
  passed: number;
  error: number;
  failure: number;
  blocked: number;
  inProgress: number;
  skipped: number;
  xfailed: number;
  xpassed: number;
  passRate: number;
  total: number;
}

export type TestRunColumn = "name" | "milestone" | "build" | "environment" | "status" | "progress" | "passRate" | "created";

// Column helpers
function getStatusTone(status: string): StatusBadgeTone {
  if (status === "in_progress") return "info";
  if (status === "completed") return "success";
  if (status === "archived") return "warning";
  return "neutral";
}

function getStatusText(status: string) {
  if (status === "in_progress") return "In Progress";
  if (status === "not_started") return "Not started";
  if (status === "completed") return "Completed";
  if (status === "archived") return "Archived";
  return status;
}

type Props = Readonly<{
  projectId: string | undefined;
  runs: RunView[];
  visibleColumns: Set<TestRunColumn>;
  columnsOpen: boolean;
  selectedRunId: string | null;
  openActionsRunId: string | null;
  actionRunId: string | null;
  resolveUserName: (userId: string | null | undefined) => string;
  onColumnsOpenChange: (open: boolean) => void;
  onToggleColumn: (column: TestRunColumn) => void;
  sorting: UnifiedTableSorting<TestRunColumn>;
  onSortingChange: (sorting: UnifiedTableSorting<TestRunColumn>) => void;
  pagination: NonNullable<UnifiedTableProps<RunView, TestRunColumn>["pagination"]>;
  onRowClick: (runId: string) => void;
  onOpenActionsChange: (runId: string | null) => void;
  onRunFlowAction: (run: RunView) => void;
  onImportJunit: (runId: string) => void;
}>;

export function TestRunsTable({
  projectId,
  runs,
  visibleColumns,
  columnsOpen,
  selectedRunId,
  openActionsRunId,
  actionRunId,
  resolveUserName,
  onColumnsOpenChange,
  onToggleColumn,
  sorting,
  onSortingChange,
  pagination,
  onRowClick,
  onOpenActionsChange,
  onRunFlowAction,
  onImportJunit,
}: Props) {
  const navigate = useNavigate();

  // Column definitions
  const tableColumns: UnifiedTableColumn<RunView, TestRunColumn>[] = [
    {
      id: "name",
      label: "Run Name",
      menuLabel: "Run Name",
      sortable: true,
      defaultSortDirection: "asc",
      defaultWidth: 285,
      minWidth: 180,
      locked: true,
      onCellClick: (event) => event.stopPropagation(),
      renderCell: (run) => (
        <div className="min-w-0">
          <Link
            to={`/projects/${projectId}/test-runs/${run.id}`}
            className="block truncate font-medium text-[var(--highlight-foreground)] hover:text-[var(--highlight-foreground)] hover:underline"
            onClick={(event) => event.stopPropagation()}
            title={run.name}
          >
            {run.name}
          </Link>
        </div>
      ),
    },

    {
      id: "status",
      label: "Status",
      menuLabel: "Status",
      sortable: true,
      defaultSortDirection: "asc",
      defaultWidth: 170,
      minWidth: 140,
      renderCell: (run) => (
        <StatusCell tone={getStatusTone(run.status)}>
          {getStatusText(run.status)}
        </StatusCell>
      ),
    },
    {
      id: "milestone",
      label: "Milestone",
      menuLabel: "Milestone",
      defaultWidth: 170,
      minWidth: 120,
      renderCell: (run) => (
        run.milestone_id && projectId ? (
          <Link
            to={`/projects/${projectId}/products/milestones/${run.milestone_id}`}
            className="text-sm text-[var(--highlight-foreground)] hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {run.milestone_name ?? run.milestone_id}
          </Link>
        ) : (
          <span className="text-sm text-[var(--foreground)]">-</span>
        )
      ),
    },
    {
      id: "progress",
      label: "Progress",
      menuLabel: "Progress",
      defaultWidth: 200,
      minWidth: 160,
      renderCell: (run) => <RunProgressBarMini {...getRunProgressBarModel(run)} />,
    },
    {
      id: "passRate",
      label: "Pass Rate",
      menuLabel: "Pass Rate",
      defaultWidth: 190,
      minWidth: 150,
      nowrap: false,
      renderCell: (run) => (
        <PrimarySecondaryCell
          primary={`${run.passRate}%`}
          secondary={`${run.passed}P / ${run.error}E / ${run.failure}F / ${run.xfailed}XF / ${run.xpassed}XP`}
        />
      ),
    },
    {
      id: "build",
      label: "Build",
      menuLabel: "Build",
      sortable: true,
      defaultSortDirection: "asc",
      defaultWidth: 150,
      minWidth: 50,
      renderCell: (run) => (
        <span className="text-sm text-[var(--foreground)]">{run.build ?? "-"}</span>
      ),
    },
    {
      id: "environment",
      label: "Environment",
      menuLabel: "Environment",
      sortable: true,
      defaultSortDirection: "asc",
      defaultWidth: 160,
      minWidth: 50,
      renderCell: (run) => (
        <span className="inline-flex rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-xs font-medium text-[var(--foreground)]">
          {run.environment_name
            ? `${run.environment_name}${run.environment_revision_number != null ? ` · r${run.environment_revision_number}` : ""}`
            : "-"}
        </span>
      ),
    },
    {
      id: "created",
      label: "Created",
      menuLabel: "Created",
      sortable: true,
      defaultSortDirection: "desc",
      defaultWidth: 240,
      minWidth: 180,
      nowrap: false,
      renderCell: (run) => (
        <PrimarySecondaryCell
          primary={resolveUserName(run.created_by)}
          secondary={<DateTimeCell value={run.created_at} className="text-xs text-[var(--muted-foreground)]" />}
          primaryClassName="text-sm font-normal text-[var(--foreground)]"
          secondaryClassName="text-xs text-[var(--muted-foreground)]"
        />
      ),
    },
  ];

  return (
    <UnifiedTable
      className="p-0"
      items={runs}
      columns={tableColumns}
      visibleColumns={visibleColumns}
      getRowId={(run) => run.id}
      onRowClick={(run) => {
        onOpenActionsChange(null);
        onRowClick(run.id);
      }}
      rowClassName={(run) => (selectedRunId === run.id ? "bg-[var(--highlight-bg-soft)] hover:bg-[var(--highlight-bg)]" : undefined)}
      columnsMenu={{
        open: columnsOpen,
        onOpenChange: onColumnsOpenChange,
        onToggleColumn,
      }}
      sorting={{
        value: sorting,
        onChange: onSortingChange,
      }}
      pagination={pagination}
      actions={{
        render: (run) => {
          const flowAction = getRunFlowAction(run.status);
          const menuItems = [
            ...(flowAction
              ? [
                  {
                    key: flowAction.key,
                    label: flowAction.label,
                    icon: flowAction.icon,
                    disabled: actionRunId === run.id,
                    onSelect: () => {
                      onOpenActionsChange(null);
                      invokeMaybeAsync(() => onRunFlowAction(run));
                    },
                  },
                ]
              : []),
            {
              key: "import-junit",
              label: "Import JUnit XML",
              icon: <FileUp className="h-4 w-4" />,
              disabled: !canImportJunitIntoRun(run.status),
              onSelect: () => {
                onOpenActionsChange(null);
                onImportJunit(run.id);
              },
            },
            {
              key: "open",
              label: "Open",
              icon: <ExternalLink className="h-4 w-4" />,
              onSelect: () => {
                onOpenActionsChange(null);
                if (projectId) navigate(`/projects/${projectId}/test-runs/${run.id}`);
              },
            },
          ];

          return (
            <RowActionsMenu
              triggerLabel={`Open actions for ${run.name}`}
              open={openActionsRunId === run.id}
              onOpenChange={(open) => onOpenActionsChange(open ? run.id : null)}
              contentClassName="w-52"
              items={menuItems}
            />
          );
        },
      }}
    />
  );
}
