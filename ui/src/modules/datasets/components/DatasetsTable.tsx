import { Eye, Pencil, Trash2 } from "lucide-react";
import type { TestDatasetDto } from "@/shared/api";
import { invokeMaybeAsync } from "@/shared/lib/invoke-maybe-async";
import { RowActionsMenu } from "@/shared/ui/RowActionsMenu";
import { UnifiedTable, type UnifiedTableColumn, type UnifiedTableProps } from "@/shared/ui/Table";
import { DateTimeCell, PrimarySecondaryCell } from "@/shared/ui/table-cells";
import { formatDatasetSourceTypeLabel } from "@/shared/datasets";

type DatasetColumn = "name" | "source_type" | "linked_cases" | "updated_at";

type Props = Readonly<{
  datasets: TestDatasetDto[];
  selectedDatasetId: string | null;
  selectedRowIds: Set<string>;
  openActionsDatasetId: string | null;
  isActionBusy: boolean;
  canEditDatasets: boolean;
  canDeleteDatasets: boolean;
  onRowClick: (dataset: TestDatasetDto) => void;
  onToggleSelectAll: (checked: boolean, visibleRowIds?: string[]) => void;
  onToggleRowSelection: (datasetId: string) => void;
  onOpenDatasetActions: (datasetId: string) => void;
  onCloseDatasetActions: () => void;
  onViewDataset: (dataset: TestDatasetDto) => void;
  onEditDataset: (dataset: TestDatasetDto) => void;
  onDeleteDataset: (dataset: TestDatasetDto) => void;
  pagination: NonNullable<UnifiedTableProps<TestDatasetDto, DatasetColumn>["pagination"]>;
}>;

const visibleColumns = new Set<DatasetColumn>(["name", "source_type", "linked_cases", "updated_at"]);

export function DatasetsTable({
  datasets,
  selectedDatasetId,
  selectedRowIds,
  openActionsDatasetId,
  isActionBusy,
  canEditDatasets,
  canDeleteDatasets,
  onRowClick,
  onToggleSelectAll,
  onToggleRowSelection,
  onOpenDatasetActions,
  onCloseDatasetActions,
  onViewDataset,
  onEditDataset,
  onDeleteDataset,
  pagination,
}: Props) {
  const actionItemsForDataset = (dataset: TestDatasetDto) => {
    const items: {
      key: string;
      label: string;
      icon: JSX.Element;
      variant?: "default" | "destructive";
      disabled?: boolean;
      onSelect: () => void;
    }[] = [
      {
        key: "view",
        label: "View details",
        icon: <Eye className="h-4 w-4" />,
        onSelect: () => {
          onViewDataset(dataset);
          onCloseDatasetActions();
        },
      },
    ];

    if (canEditDatasets) {
      items.push({
        key: "edit",
        label: "Edit",
        icon: <Pencil className="h-4 w-4" />,
        disabled: isActionBusy,
        onSelect: () => {
          onEditDataset(dataset);
          onCloseDatasetActions();
        },
      });
    }

    if (canDeleteDatasets) {
      items.push({
        key: "delete",
        label: "Delete",
        icon: <Trash2 className="h-4 w-4" />,
        variant: "destructive",
        disabled: isActionBusy,
        onSelect: () => {
          invokeMaybeAsync(() => onDeleteDataset(dataset));
          onCloseDatasetActions();
        },
      });
    }

    return items;
  };

  const columns: UnifiedTableColumn<TestDatasetDto, DatasetColumn>[] = [
    {
      id: "name",
      label: "Name",
      menuLabel: "Name",
      defaultWidth: 260,
      minWidth: 160,
      locked: true,
      renderCell: (dataset) => (
        <PrimarySecondaryCell primary={dataset.name} secondary={dataset.description || dataset.id} />
      ),
    },
    {
      id: "source_type",
      label: "Source",
      menuLabel: "Source",
      defaultWidth: 180,
      minWidth: 120,
      renderCell: (dataset) => (
        <span className="text-sm text-[var(--foreground)]">{formatDatasetSourceTypeLabel(dataset.source_type)}</span>
      ),
    },
    {
      id: "linked_cases",
      label: "Linked Cases",
      menuLabel: "Linked Cases",
      defaultWidth: 120,
      minWidth: 100,
      renderCell: (dataset) => <span className="text-sm text-[var(--foreground)]">{dataset.test_cases_count}</span>,
    },
    {
      id: "updated_at",
      label: "Updated",
      menuLabel: "Updated",
      defaultWidth: 180,
      minWidth: 150,
      renderCell: (dataset) => <DateTimeCell value={dataset.updated_at} truncate={false} />,
    },
  ];

  return (
    <UnifiedTable
      className="p-0"
      items={datasets}
      columns={columns}
      visibleColumns={visibleColumns}
      getRowId={(dataset) => dataset.id}
      onRowClick={onRowClick}
      selection={
        canDeleteDatasets
          ? {
              selectedRowIds,
              onToggleSelectAll,
              onToggleRow: onToggleRowSelection,
              ariaLabel: (dataset) => `Select ${dataset.name}`,
              isRowSelectionDisabled: () => isActionBusy,
            }
          : undefined
      }
      actions={{
        render: (dataset) => (
          <RowActionsMenu
            triggerLabel="Open dataset actions"
            open={openActionsDatasetId === dataset.id}
            onOpenChange={(open) => (open ? onOpenDatasetActions(dataset.id) : onCloseDatasetActions())}
            contentClassName="w-44"
            items={actionItemsForDataset(dataset)}
          />
        ),
      }}
      rowClassName={(dataset) =>
        selectedDatasetId === dataset.id ? "bg-[var(--highlight-bg-soft)] hover:bg-[var(--highlight-bg)]" : undefined
      }
      pagination={pagination}
    />
  );
}
