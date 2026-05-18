// Test cases table: tags cell, columns, selection, and row actions.
import { useMemo } from "react";
import { FolderOpen, Pencil, Trash2 } from "lucide-react";
import { Link, useLocation } from "react-router";
import { RowActionsMenu } from "@/shared/ui/RowActionsMenu";
import {
  UnifiedTable,
  type UnifiedTableColumn,
  type UnifiedTableProps,
  type UnifiedTableSorting,
} from "@/shared/ui/Table";
import { StatusCell, TagsCell } from "@/shared/ui/table-cells";
import { formatTestCaseStatusLabel, getLastStatusLabel, getPriorityTone, getStatusTone } from "./TestCaseBadges";
import { formatPriorityLabel } from "@/shared/domain/priority";
import { formatTestCaseTypeLabel } from "@/shared/domain/testCaseType";
import type { TestCaseColumn, TestCaseListItem } from "../utils/types";

type Props = Readonly<{
  projectId: string | undefined;
  tests: TestCaseListItem[];
  deletingTestCaseId: string | null;
  selectedTests: Set<string>;
  visibleColumns: Set<TestCaseColumn>;
  columnsOpen: boolean;
  openActionsTestId: string | null;
  onDeleteTestCase: (testCase: TestCaseListItem) => void;
  onColumnsOpenChange: (open: boolean) => void;
  onToggleColumn: (column: TestCaseColumn) => void;
  onToggleSelectAll: (checked: boolean, visibleRowIds?: string[]) => void;
  onToggleTestSelection: (testId: string) => void;
  onRowClick: (testId: string) => void;
  onToggleActions: (testId: string) => void;
  onCloseActions: () => void;
  sorting: UnifiedTableSorting<TestCaseColumn>;
  onSortingChange: (sorting: UnifiedTableSorting<TestCaseColumn>) => void;
  pagination: NonNullable<UnifiedTableProps<TestCaseListItem, TestCaseColumn>["pagination"]>;
}>;

export function TestCasesTable({
  projectId,
  tests,
  deletingTestCaseId,
  selectedTests,
  visibleColumns,
  columnsOpen,
  openActionsTestId,
  onDeleteTestCase,
  onColumnsOpenChange,
  onToggleColumn,
  onToggleSelectAll,
  onToggleTestSelection,
  onRowClick,
  onToggleActions,
  onCloseActions,
  sorting,
  onSortingChange,
  pagination,
}: Props) {
  const location = useLocation();

  // Column definitions
  const columns = useMemo<UnifiedTableColumn<TestCaseListItem, TestCaseColumn>[]>(
    () => [
      {
        id: "id",
        label: "ID",
        menuLabel: "ID",
        defaultWidth: 110,
        minWidth: 50,
        locked: true,
        onCellClick: (event) => event.stopPropagation(),
        renderCell: (test) => (
          <Link
            to={{
              pathname: `/projects/${projectId}/test-cases/${test.testCaseId}`,
              search: location.search,
            }}
            className="block truncate font-medium text-[var(--highlight-foreground)] hover:text-[var(--highlight-foreground)] hover:underline"
          >
            {test.id}
          </Link>
        ),
      },
      {
        id: "title",
        label: "Title",
        menuLabel: "Title",
        sortable: true,
        defaultSortDirection: "asc",
        defaultWidth: 380,
        minWidth: 50,
        locked: true,
        renderCell: (test) => <span className="block truncate font-medium text-[var(--foreground)]">{test.title}</span>,
      },
      {
        id: "suite",
        label: "Suite",
        menuLabel: "Suite",
        sortable: true,
        defaultSortDirection: "asc",
        defaultWidth: 180,
        minWidth: 50,
        renderCell: (test) => <span className="block truncate">{test.suite}</span>,
      },
      {
        id: "priority",
        label: "Priority",
        menuLabel: "Priority",
        sortable: true,
        defaultSortDirection: "asc",
        defaultWidth: 120,
        minWidth: 50,
        renderCell: (test) => (
          <StatusCell tone={getPriorityTone(test.priority)}>
            {test.priority ? formatPriorityLabel(test.priority) : "—"}
          </StatusCell>
        ),
      },
      {
        id: "type",
        label: "Type",
        menuLabel: "Type",
        defaultWidth: 110,
        minWidth: 50,
        renderCell: (test) => (
          <span className="text-sm text-[var(--foreground)]">{formatTestCaseTypeLabel(test.testCaseType)}</span>
        ),
      },
      {
        id: "status",
        label: "Status",
        menuLabel: "Status",
        sortable: true,
        defaultSortDirection: "asc",
        defaultWidth: 120,
        minWidth: 50,
        renderCell: (test) => (
          <StatusCell tone={getStatusTone(test.status)}>{formatTestCaseStatusLabel(test.status)}</StatusCell>
        ),
      },
      {
        id: "tags",
        label: "Tags",
        menuLabel: "Tags",
        defaultWidth: 120,
        minWidth: 50,
        nowrap: true,
        renderCell: (test) => <TagsCell tags={test.tags} />,
      },
      {
        id: "owner",
        label: "Owner",
        menuLabel: "Owner",
        sortable: true,
        defaultSortDirection: "asc",
        defaultWidth: 180,
        minWidth: 50,
        renderCell: (test) => <span className="block truncate">{test.owner}</span>,
      },
      {
        id: "lastRun",
        label: "Last Run",
        menuLabel: "Last Run",
        sortable: true,
        defaultSortDirection: "desc",
        defaultWidth: 180,
        minWidth: 50,
        nowrap: false,
        renderCell: (test) => (
          <div className="flex flex-col gap-0.5">
            <span className="truncate text-sm text-[var(--muted-foreground)]">{test.lastRun}</span>
            {getLastStatusLabel(test.lastStatus)}
          </div>
        ),
      },
    ],
    [location.search, projectId]
  );

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden">
      <UnifiedTable
        items={tests}
        columns={columns}
        visibleColumns={visibleColumns}
        getRowId={(test) => test.testCaseId}
        onRowClick={(test) => onRowClick(test.testCaseId)}
        selection={{
          selectedRowIds: selectedTests,
          onToggleSelectAll,
          onToggleRow: onToggleTestSelection,
          ariaLabel: (test) => `Select ${test.title}`,
        }}
        columnsMenu={{
          open: columnsOpen,
          onOpenChange: onColumnsOpenChange,
          onToggleColumn,
        }}
        sorting={{
          value: sorting,
          onChange: onSortingChange,
        }}
        actions={{
          render: (test) => (
            <RowActionsMenu
              triggerLabel="Open test case actions"
              open={openActionsTestId === test.testCaseId}
              onOpenChange={(open) => (open ? onToggleActions(test.testCaseId) : onCloseActions())}
              contentClassName="w-48"
              items={[
                {
                  key: "open",
                  label: "Open",
                  icon: <FolderOpen className="h-4 w-4" />,
                  to: `/projects/${projectId}/test-cases/${test.testCaseId}${location.search}`,
                  onSelect: onCloseActions,
                },
                {
                  key: "edit",
                  label: "Edit",
                  icon: <Pencil className="h-4 w-4" />,
                  to: `/projects/${projectId}/test-cases/${test.testCaseId}${location.search}#edit`,
                  onSelect: onCloseActions,
                },
                {
                  key: "delete",
                  label: "Delete",
                  icon: <Trash2 className="h-4 w-4" />,
                  variant: "destructive",
                  disabled: deletingTestCaseId === test.testCaseId,
                  onSelect: () => onDeleteTestCase(test),
                },
              ]}
            />
          ),
        }}
        pagination={pagination}
      />
    </div>
  );
}
