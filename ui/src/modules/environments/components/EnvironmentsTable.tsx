import type { EnvironmentDto } from "@/shared/api";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { invokeMaybeAsync } from "@/shared/lib/invoke-maybe-async";
import { RowActionsMenu } from "@/shared/ui/RowActionsMenu";
import { UnifiedTable, type UnifiedTableColumn, type UnifiedTableProps } from "@/shared/ui/Table";
import { DateTimeCell, PrimarySecondaryCell } from "@/shared/ui/table-cells";
import { OverflowTagList, StatusBadge } from "@/shared/ui";

export type EnvironmentColumn = "name" | "status" | "use_cases" | "topology" | "infra" | "revision" | "updated_at";

type Props = Readonly<{
  environments: EnvironmentDto[];
  selectedEnvironmentId: string | null;
  selectedRowIds: Set<string>;
  visibleColumns: Set<EnvironmentColumn>;
  columnsOpen: boolean;
  openActionsEnvironmentId: string | null;
  isActionBusy: boolean;
  onRowClick: (environment: EnvironmentDto) => void;
  onToggleSelectAll: (checked: boolean, visibleRowIds?: string[]) => void;
  onToggleRowSelection: (environmentId: string) => void;
  onColumnsOpenChange: (open: boolean) => void;
  onToggleColumn: (column: EnvironmentColumn) => void;
  onOpenEnvironmentActions: (environmentId: string) => void;
  onCloseEnvironmentActions: () => void;
  onEditEnvironment: (environment: EnvironmentDto) => void;
  onArchiveEnvironment: (environment: EnvironmentDto) => void;
  pagination: NonNullable<UnifiedTableProps<EnvironmentDto, EnvironmentColumn>["pagination"]>;
}>;

function formatList(values: string[]): string {
  if (values.length === 0) return "—";
  return values.join(", ");
}

function getEnvironmentStatusTone(status: string | undefined) {
  if (status === "active") return "success" as const;
  if (status === "maintenance") return "warning" as const;
  if (status === "deprecated") return "muted" as const;
  return "neutral" as const;
}

export function EnvironmentsTable({
  environments,
  selectedEnvironmentId,
  selectedRowIds,
  visibleColumns,
  columnsOpen,
  openActionsEnvironmentId,
  isActionBusy,
  onRowClick,
  onToggleSelectAll,
  onToggleRowSelection,
  onColumnsOpenChange,
  onToggleColumn,
  onOpenEnvironmentActions,
  onCloseEnvironmentActions,
  onEditEnvironment,
  onArchiveEnvironment,
  pagination,
}: Props) {
  const columns: UnifiedTableColumn<EnvironmentDto, EnvironmentColumn>[] = [
    {
      id: "name",
      label: "Name",
      menuLabel: "Name",
      defaultWidth: 280,
      minWidth: 180,
      locked: true,
      renderCell: (environment) => (
        <PrimarySecondaryCell
          primary={environment.name}
          secondary={environment.description || environment.id}
        />
      ),
    },
    {
      id: "status",
      label: "Status",
      menuLabel: "Status",
      defaultWidth: 120,
      minWidth: 100,
      renderCell: (environment) => (
        <StatusBadge tone={getEnvironmentStatusTone(environment.status)} withBorder>
          {(environment.status ?? "active").replace("_", " ")}
        </StatusBadge>
      ),
    },
    {
      id: "use_cases",
      label: "Use Cases",
      menuLabel: "Use Cases",
      defaultWidth: 220,
      minWidth: 140,
      renderCell: (environment) => (
        <OverflowTagList
          tags={environment.use_cases}
          mode="count"
          maxVisible={2}
          emptyContent={<span className="text-sm text-[var(--muted-foreground)]">—</span>}
        />
      ),
    },
    {
      id: "topology",
      label: "Topology",
      menuLabel: "Topology",
      defaultWidth: 220,
      minWidth: 160,
      renderCell: (environment) => (
        <span className="text-sm text-[var(--foreground)]">
          {(environment.topology_component_count ?? 0)} comp · {(environment.topology_node_count ?? 0)} nodes
        </span>
      ),
    },
    {
      id: "infra",
      label: "Infra",
      menuLabel: "Infra",
      defaultWidth: 240,
      minWidth: 180,
      renderCell: (environment) => (
        <PrimarySecondaryCell
          primary={formatList(environment.infra_host_types ?? [])}
          secondary={formatList(environment.infra_providers ?? [])}
        />
      ),
    },
    {
      id: "revision",
      label: "Revision",
      menuLabel: "Revision",
      defaultWidth: 120,
      minWidth: 100,
      renderCell: (environment) => (
        <span className="text-sm text-[var(--foreground)]">
          {environment.current_revision_number != null ? `r${environment.current_revision_number}` : "-"}
        </span>
      ),
    },
    {
      id: "updated_at",
      label: "Updated",
      menuLabel: "Updated",
      defaultWidth: 180,
      minWidth: 150,
      renderCell: (environment) => <DateTimeCell value={environment.updated_at} truncate={false} />,
    },
  ];

  return (
    <UnifiedTable
      className="p-0"
      items={environments}
      columns={columns}
      visibleColumns={visibleColumns}
      getRowId={(environment) => environment.id}
      onRowClick={onRowClick}
      selection={{
        selectedRowIds,
        onToggleSelectAll,
        onToggleRow: onToggleRowSelection,
        ariaLabel: (environment) => `Select ${environment.name}`,
        isRowSelectionDisabled: () => isActionBusy,
      }}
      columnsMenu={{
        open: columnsOpen,
        onOpenChange: onColumnsOpenChange,
        onToggleColumn,
      }}
      actions={{
        render: (environment) => (
          <RowActionsMenu
            triggerLabel="Open environment actions"
            open={openActionsEnvironmentId === environment.id}
            onOpenChange={(open) => (open ? onOpenEnvironmentActions(environment.id) : onCloseEnvironmentActions())}
            contentClassName="w-44"
            items={[
              {
                key: "view",
                label: "View details",
                icon: <Eye className="h-4 w-4" />,
                onSelect: () => {
                  onRowClick(environment);
                  onCloseEnvironmentActions();
                },
              },
              {
                key: "edit",
                label: "Edit",
                icon: <Pencil className="h-4 w-4" />,
                disabled: isActionBusy,
                onSelect: () => {
                  onEditEnvironment(environment);
                  onCloseEnvironmentActions();
                },
              },
              {
                key: "archive",
                label: "Archive",
                icon: <Trash2 className="h-4 w-4" />,
                variant: "destructive",
                disabled: isActionBusy,
                onSelect: () => {
                  invokeMaybeAsync(() => onArchiveEnvironment(environment));
                  onCloseEnvironmentActions();
                },
              },
            ]}
          />
        ),
      }}
      rowClassName={(environment) =>
        selectedEnvironmentId === environment.id
          ? "bg-[var(--highlight-bg-soft)] hover:bg-[var(--highlight-bg)]"
          : undefined
      }
      pagination={pagination}
    />
  );
}
