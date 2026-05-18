import { Plus } from "lucide-react";
import { DatasetsTable } from "./components";
import { useDatasetsPage } from "./hooks/use-datasets-page";
import { BulkSelectionToolbarActions, Button, CommonPage, EntityListPage, FilterChecklistSection, ListPageEmptyState } from "@/shared/ui";
import { DatasetDetailsModal, formatDatasetSourceTypeLabel } from "@/shared/datasets";

export function DatasetsModulePage() {
  const model = useDatasetsPage();

  return (
    <CommonPage>
      <EntityListPage
        title={<span className="text-xl">Datasets</span>}
        subtitle="Reusable parameter sets for manual and automated test cases"
        actions={
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={model.handleCreateStart}
            disabled={model.isSaving || !model.canEditDatasets}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            New Dataset
          </Button>
        }
        searchQuery={model.searchQuery}
        onSearchQueryChange={model.setSearchQuery}
        searchPlaceholder="Search datasets..."
        filtersOpen={model.filtersOpen}
        onFiltersOpenChange={model.setFiltersOpen}
        activeFiltersCount={model.activeFiltersCount}
        onClearFilters={model.onClearFilters}
        panelClassName="w-72"
        rightSlot={
          model.selectedRowIds.size > 0 && model.canDeleteDatasets ? (
            <BulkSelectionToolbarActions
              selectedCount={model.selectedRowIds.size}
              busy={model.isBulkDeleting}
              showBulkEdit={false}
              onDelete={() => void model.handleBulkDelete()}
              onClearSelection={model.clearRowSelection}
            />
          ) : null
        }
        filtersContent={
          <FilterChecklistSection
            title="Source Type"
            values={["manual", "pytest_parametrize", "imported"]}
            selectedValues={model.selectedSourceTypes as Set<string>}
            onToggle={(value) => model.onToggleSourceType(value as "manual" | "pytest_parametrize" | "imported")}
            getLabel={(value) => formatDatasetSourceTypeLabel(value as "manual" | "pytest_parametrize" | "imported")}
          />
        }
        isLoading={model.isLoading}
        error={model.listError}
        empty={model.datasets.length === 0}
        colSpan={6}
        loadingMessage="Loading datasets..."
        emptyMessage={
          <ListPageEmptyState
            title="No datasets found"
            description="Create a dataset to reuse parameter sets across manual and automated test cases."
            actions={
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={model.handleCreateStart}
                disabled={model.isSaving || !model.canEditDatasets}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                New Dataset
              </Button>
            }
          />
        }
      >
        <DatasetsTable
          datasets={model.datasets}
          selectedDatasetId={model.selectedDatasetId}
          selectedRowIds={model.selectedRowIds}
          openActionsDatasetId={model.openActionsDatasetId}
          isActionBusy={model.isSaving}
          canEditDatasets={model.canEditDatasets}
          canDeleteDatasets={model.canDeleteDatasets}
          onRowClick={model.onViewDataset}
          onToggleSelectAll={model.onToggleSelectAll}
          onToggleRowSelection={model.onToggleRowSelection}
          onOpenDatasetActions={model.onOpenDatasetActions}
          onCloseDatasetActions={model.onCloseDatasetActions}
          onViewDataset={model.onViewDataset}
          onEditDataset={model.handleEditStart}
          onDeleteDataset={model.handleDelete}
          pagination={model.tablePagination}
        />
      </EntityListPage>

      {model.isModalOpen ? (
        <DatasetDetailsModal
          isOpen={model.isModalOpen}
          dataset={model.selectedDataset}
          draft={model.draft}
          isEditing={Boolean(model.editingDatasetId)}
          isCreating={model.isCreating}
          isSaving={model.isSaving}
          canEditDatasets={model.canEditDatasets}
          canDeleteDatasets={model.canDeleteDatasets}
          onClose={model.handleCloseModal}
          onEditStart={model.handleEditStart}
          onDelete={model.handleDelete}
          onDraftChange={model.setDraft}
          onCancelEdit={model.handleCancelForm}
          onSave={model.handleSave}
        />
      ) : null}
    </CommonPage>
  );
}
