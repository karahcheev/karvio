// Sortable table of test plans with row actions.
import type { TestPlanDto } from "@/shared/api";
import { Pencil, Play, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { RowActionsMenu } from "@/shared/ui/RowActionsMenu";
import { UnifiedTable, type UnifiedTableColumn, type UnifiedTableProps } from "@/shared/ui/Table";
import { DateTimeCell, TagsCell } from "@/shared/ui/table-cells";

export type TestPlanColumn = "name" | "description" | "milestone" | "tags" | "suites" | "created";

type Props = Readonly<{
  projectId: string;
  plans: TestPlanDto[];
  visibleColumns: Set<TestPlanColumn>;
  columnsOpen: boolean;
  selectedPlanId: string | null;
  openActionsPlanId: string | null;
  resolveUserName: (userId: string | null | undefined) => string;
  onColumnsOpenChange: (open: boolean) => void;
  onToggleColumn: (column: TestPlanColumn) => void;
  onRowClick: (planId: string) => void;
  onOpenActionsChange: (planId: string | null) => void;
  onEditPlan: (plan: TestPlanDto) => void;
  onDeletePlan: (plan: TestPlanDto) => void;
  onCreateRun: (plan: TestPlanDto) => void;
  createRunLoading: boolean;
  pagination: NonNullable<UnifiedTableProps<TestPlanDto, TestPlanColumn>["pagination"]>;
}>;

export function TestPlansTable(props: Props) {
  const {
    plans,
    visibleColumns,
    columnsOpen,
    selectedPlanId,
    openActionsPlanId,
    onColumnsOpenChange,
    onToggleColumn,
    onRowClick,
    onOpenActionsChange,
    onEditPlan,
    onDeletePlan,
    onCreateRun,
    createRunLoading,
    pagination,
  } = props;
  // Column definitions
  const columns: UnifiedTableColumn<TestPlanDto, TestPlanColumn>[] = [
    {
      id: "name",
      label: "Name",
      menuLabel: "Name",
      defaultWidth: 220,
      minWidth: 120,
      locked: true,
      renderCell: (plan) => (
        <span className="font-medium text-[var(--foreground)]">{plan.name}</span>
      ),
    },
    {
      id: "milestone",
      label: "Milestone",
      menuLabel: "Milestone",
      defaultWidth: 170,
      minWidth: 110,
      renderCell: (plan) => (
        plan.milestone_id ? (
          <Link
            to={`/projects/${props.projectId}/products/milestones/${plan.milestone_id}`}
            className="text-sm text-[var(--highlight-foreground)] hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {plan.milestone_name ?? plan.milestone_id}
          </Link>
        ) : (
          <span className="text-sm text-[var(--foreground)]">—</span>
        )
      ),
    },
    {
      id: "tags",
      label: "Tags",
      menuLabel: "Tags",
      defaultWidth: 180,
      minWidth: 80,
      renderCell: (plan) => <TagsCell tags={plan.tags ?? []} mode="wrap" emptyLabel="—" />,
    },
    {
      id: "suites",
      label: "Suites / Cases",
      menuLabel: "Suites / Cases",
      defaultWidth: 160,
      minWidth: 100,
      renderCell: (plan) => {
        const suiteCount = plan.suite_names?.length ?? plan.suite_ids?.length ?? 0;
        const caseCount = plan.case_ids?.length ?? 0;
        const parts = [];
        if (suiteCount > 0) parts.push(`${suiteCount} suite(s)`);
        if (caseCount > 0) parts.push(`${caseCount} case(s)`);
        return (
          <span className="text-sm text-[var(--muted-foreground)]">
            {parts.length > 0 ? parts.join(", ") : "—"}
          </span>
        );
      },
    },
    {
      id: "created",
      label: "Created",
      menuLabel: "Created",
      defaultWidth: 200,
      minWidth: 140,
      renderCell: (plan) => <DateTimeCell value={plan.created_at} fallback="-" truncate={false} />,
    },
  ];

  return (
    <UnifiedTable
      className="p-0"
      items={plans}
      columns={columns}
      visibleColumns={visibleColumns}
      getRowId={(plan) => plan.id}
      onRowClick={(plan) => {
        onOpenActionsChange(null);
        onRowClick(plan.id);
      }}
      rowClassName={(plan) => (selectedPlanId === plan.id ? "bg-[var(--highlight-bg-soft)] hover:bg-[var(--highlight-bg)]" : undefined)}
      columnsMenu={{
        open: columnsOpen,
        onOpenChange: onColumnsOpenChange,
        onToggleColumn,
      }}
      actions={{
        render: (plan) => (
          <RowActionsMenu
            open={openActionsPlanId === plan.id}
            onOpenChange={(open) => onOpenActionsChange(open ? plan.id : null)}
            triggerLabel={`Actions for ${plan.name}`}
            contentClassName="w-52"
            items={[
              {
                key: "create-run",
                label: "Create run",
                icon: <Play className="h-4 w-4" />,
                onSelect: () => onCreateRun(plan),
                disabled: createRunLoading,
              },
              {
                key: "edit",
                label: "Edit",
                icon: <Pencil className="h-4 w-4" />,
                onSelect: () => onEditPlan(plan),
              },
              {
                key: "delete",
                label: "Delete",
                icon: <Trash2 className="h-4 w-4" />,
                onSelect: () => onDeletePlan(plan),
                variant: "destructive",
              },
            ]}
          />
        ),
      }}
      pagination={pagination}
    />
  );
}
