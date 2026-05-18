// Run items table with selection, sorting, and row actions.
import { Edit, ExternalLink, Eye, Trash2, User } from "lucide-react";
import type { ExternalIssueLinkDto, RunCaseDto } from "@/shared/api";
import { EntityTableWithStates } from "@/shared/ui/EntityTableWithStates";
import { RowActionsMenu } from "@/shared/ui/RowActionsMenu";
import { UnifiedTable, type UnifiedTableColumn, type UnifiedTableSorting } from "@/shared/ui/Table";
import { StatusCell, TagsCell } from "@/shared/ui/table-cells";
import { getRunItemStatusTone, formatRunItemStatusLabel } from "../constants";

export type RunOverviewRow = {
  id: string;
  testCaseId: string;
  key: string;
  title: string;
  status: RunCaseDto["status"];
  time: string | null;
  assignee: string;
  lastExecuted: string;
  comment: string | null;
  priority: string;
  tags: string[];
  suite: string;
  externalIssues: ExternalIssueLinkDto[];
};

export type RunItemColumn = "title" | "tags" | "suite" | "status" | "assignee" | "lastExecuted";

// Column definitions
const runItemColumns: UnifiedTableColumn<RunOverviewRow, RunItemColumn>[] = [
  {
    id: "title",
    label: "Title",
    menuLabel: "Title",
    sortable: true,
    defaultSortDirection: "asc",
    defaultWidth: 420,
    minWidth: 260,
    nowrap: false,
    renderCell: (item) => <span className="text-sm text-[var(--foreground)]">{item.title}</span>,
  },
  {
    id: "tags",
    label: "Tags",
    menuLabel: "Tags",
    defaultWidth: 230,
    minWidth: 170,
    nowrap: false,
    renderCell: (item) => <TagsCell tags={item.tags} mode="wrap" />,
  },
  {
    id: "suite",
    label: "Suite",
    menuLabel: "Suite",
    sortable: true,
    defaultSortDirection: "asc",
    defaultWidth: 240,
    minWidth: 170,
    nowrap: false,
    renderCell: (item) => <span className="text-sm text-[var(--foreground)]">{item.suite}</span>,
  },
  {
    id: "status",
    label: "Status",
    menuLabel: "Status",
    sortable: true,
    defaultSortDirection: "asc",
    defaultWidth: 180,
    minWidth: 150,
    renderCell: (item) => (
      <StatusCell tone={getRunItemStatusTone(item.status)} withBorder>
        {formatRunItemStatusLabel(item.status)}
      </StatusCell>
    ),
  },
  {
    id: "assignee",
    label: "Assignee",
    menuLabel: "Assignee",
    sortable: true,
    defaultSortDirection: "asc",
    defaultWidth: 220,
    minWidth: 170,
    renderCell: (item) => (
      <div className="flex items-center gap-2 text-sm text-[var(--foreground)]">
        <User className="h-4 w-4 text-[var(--muted-foreground)]" />
        {item.assignee}
      </div>
    ),
  },
  {
    id: "lastExecuted",
    label: "Last Executed",
    menuLabel: "Last Executed",
    sortable: true,
    defaultSortDirection: "desc",
    defaultWidth: 220,
    minWidth: 170,
    cellClassName: "text-[var(--muted-foreground)]",
    renderCell: (item) => item.lastExecuted,
  },
];

type RunItemsTableProps = Readonly<{
  rows: RunOverviewRow[];
  isLoading: boolean;
  loadingMessage?: string;
  loadedItemsCount: number;
  totalItemsCount: number;
  hasMoreRunItems: boolean;
  runItemsLoadingMore: boolean;
  selectedRunItemIds: Set<string>;
  openActionsRunItemId: string | null;
  runItemStatusLocked: boolean;
  removeRunItemLoadingId: string | null;
  projectId: string | undefined;
  visibleColumns: Set<RunItemColumn>;
  columnsOpen: boolean;
  onColumnsOpenChange: (open: boolean) => void;
  onToggleColumn: (column: RunItemColumn) => void;
  sorting: UnifiedTableSorting<RunItemColumn>;
  onSortingChange: (sorting: UnifiedTableSorting<RunItemColumn>) => void;
  onRowClick: (item: RunOverviewRow) => void;
  onToggleSelectAll: (checked: boolean, visibleRowIds?: string[]) => void;
  onToggleRow: (runItemId: string) => void;
  onOpenActionsChange: (runItemId: string | null) => void;
  onOpenDetails: (item: RunOverviewRow) => void;
  onOpenTestCase: (item: RunOverviewRow) => void;
  onAddResult: (runItemId: string) => void;
  onRemove: (runItemId: string) => void;
  onLoadMore: () => void;
}>;

export function RunItemsTable({
  rows,
  isLoading,
  loadingMessage,
  selectedRunItemIds,
  openActionsRunItemId,
  runItemStatusLocked,
  removeRunItemLoadingId,
  projectId,
  visibleColumns,
  columnsOpen,
  onColumnsOpenChange,
  onToggleColumn,
  sorting,
  onSortingChange,
  onRowClick,
  onToggleSelectAll,
  onToggleRow,
  onOpenActionsChange,
  onOpenDetails,
  onOpenTestCase,
  onAddResult,
  onRemove,
}: RunItemsTableProps) {
  return (
    <EntityTableWithStates
      isLoading={isLoading}
      error={null}
      empty={rows.length === 0}
      colSpan={runItemColumns.length + 2}
      loadingMessage={loadingMessage}
      emptyMessage="No run items found"
    >
    <div className="space-y-3">
    <UnifiedTable
      className="p-0"
      items={rows}
      columns={runItemColumns}
      visibleColumns={visibleColumns}
      getRowId={(item) => item.id}
      onRowClick={onRowClick}
      rowClassName="[&>td]:py-2"
      columnsMenu={{
        open: columnsOpen,
        onOpenChange: onColumnsOpenChange,
        onToggleColumn,
      }}
      selection={{
        selectedRowIds: selectedRunItemIds,
        onToggleSelectAll,
        onToggleRow,
        ariaLabel: (item) => `Select ${item.key}`,
      }}
      sorting={{
        value: sorting,
        onChange: onSortingChange,
      }}
      actions={{
        render: (item) => (
          <RowActionsMenu
            triggerLabel={`Open actions for ${item.key}`}
            open={openActionsRunItemId === item.id}
            onOpenChange={(open) => onOpenActionsChange(open ? item.id : null)}
            items={[
              {
                key: "open",
                label: "Open Details",
                icon: <Eye className="h-4 w-4" />,
                onSelect: () => {
                  onOpenActionsChange(null);
                  onOpenDetails(item);
                },
              },
              {
                key: "open-test-case",
                label: "Open test case",
                icon: <ExternalLink className="h-4 w-4" />,
                disabled: !projectId,
                onSelect: () => {
                  if (!projectId) return;
                  onOpenActionsChange(null);
                  onOpenTestCase(item);
                },
              },
              {
                key: "update-status",
                label: "Add Result",
                icon: <Edit className="h-4 w-4" />,
                disabled: runItemStatusLocked,
                onSelect: () => {
                  onOpenActionsChange(null);
                  onAddResult(item.id);
                },
              },
              {
                key: "remove-from-test-run",
                label: removeRunItemLoadingId === item.id ? "Removing..." : "Remove",
                icon: <Trash2 className="h-4 w-4" />,
                variant: "destructive",
                separatorBefore: true,
                disabled: runItemStatusLocked || removeRunItemLoadingId === item.id,
                onSelect: () => {
                  onOpenActionsChange(null);
                  onRemove(item.id);
                },
              },
            ]}
          />
        ),
      }}
    />
    </div>
    </EntityTableWithStates>
  );
}
