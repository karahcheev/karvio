// Audit events table with sortable columns.
import { UnifiedTable, type UnifiedTableColumn, type UnifiedTableSorting } from "@/shared/ui/Table";
import { IdCell, StatusCell } from "@/shared/ui/table-cells";
import { formatUtcTimestamp } from "../utils";
import type { AuditColumn, AuditTableRow } from "../types";

// Static column config
const AUDIT_COLUMNS: UnifiedTableColumn<AuditTableRow, AuditColumn>[] = [
  {
    id: "timestamp",
    label: "Time (UTC)",
    menuLabel: "Time (UTC)",
    sortable: true,
    defaultSortDirection: "desc",
    defaultWidth: 184,
    minWidth: 144,
    renderCell: (item) => <span className="block truncate">{formatUtcTimestamp(item.timestamp_utc)}</span>,
    cellClassName: "text-[var(--foreground)]",
  },
  {
    id: "actor",
    label: "Actor",
    menuLabel: "Actor",
    sortable: true,
    defaultSortDirection: "asc",
    defaultWidth: 150,
    minWidth: 120,
    renderCell: (item) => <span className="block truncate">{item.actorLabel}</span>,
  },
  {
    id: "action",
    label: "Action",
    menuLabel: "Action",
    sortable: true,
    defaultSortDirection: "asc",
    defaultWidth: 220,
    minWidth: 120,
    renderCell: (item) => <span className="block truncate font-medium text-[var(--foreground)]">{item.action}</span>,
  },
  {
    id: "resource",
    label: "Resource",
    menuLabel: "Resource",
    sortable: true,
    defaultSortDirection: "asc",
    defaultWidth: 240,
    minWidth: 140,
    renderCell: (item) => (
      <span className="block truncate text-[var(--foreground)]">
        {item.resource_type ? `${item.resource_type}:${item.resource_id ?? "—"}` : "—"}
      </span>
    ),
  },
  {
    id: "result",
    label: "Result",
    menuLabel: "Result",
    sortable: true,
    defaultSortDirection: "asc",
    defaultWidth: 120,
    minWidth: 88,
    renderCell: (item) => (
      <StatusCell tone={item.result === "success" ? "success" : "danger"} className="px-2 py-1">
        {item.result}
      </StatusCell>
    ),
  },
  {
    id: "request_id",
    label: "Request ID",
    menuLabel: "Request ID",
    sortable: true,
    defaultSortDirection: "asc",
    defaultWidth: 220,
    minWidth: 120,
    renderCell: (item) => <IdCell value={item.request_id} className="text-[var(--muted-foreground)]" />,
    cellClassName: "text-[var(--muted-foreground)]",
  },
];

type Props = Readonly<{
  items: AuditTableRow[];
  visibleColumns: Set<AuditColumn>;
  columnsOpen: boolean;
  selectedLogEventId: string | null;
  sorting: UnifiedTableSorting<AuditColumn>;
  onColumnsOpenChange: (open: boolean) => void;
  onSortingChange: (sorting: UnifiedTableSorting<AuditColumn>) => void;
  onToggleColumn: (column: AuditColumn) => void;
  onRowClick: (item: AuditTableRow) => void;
}>;

export function AuditLogsTable({
  items,
  visibleColumns,
  columnsOpen,
  selectedLogEventId,
  sorting,
  onColumnsOpenChange,
  onSortingChange,
  onToggleColumn,
  onRowClick,
}: Props) {
  return (
    <UnifiedTable
      className="p-0"
      items={items}
      visibleColumns={visibleColumns}
      columns={AUDIT_COLUMNS}
      getRowId={(item) => item.event_id}
      onRowClick={(item) => onRowClick(item)}
      rowClassName={(item) => (item.event_id === selectedLogEventId ? "bg-[var(--highlight-bg-soft)] hover:bg-[var(--highlight-bg)]" : undefined)}
      columnsMenu={{
        open: columnsOpen,
        onOpenChange: onColumnsOpenChange,
        onToggleColumn,
      }}
      sorting={{
        value: sorting,
        onChange: onSortingChange,
      }}
    />
  );
}
