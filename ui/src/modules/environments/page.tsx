import { Plus } from "lucide-react";
import { EnvironmentDetailsSidePanel, EnvironmentWizardModal, EnvironmentsTable } from "./components";
import { useEnvironmentsPage } from "./hooks/use-environments-page";
import { BulkSelectionToolbarActions, Button, CommonPage, EntityListPage, FilterChecklistSection, ListPageEmptyState } from "@/shared/ui";

export function EnvironmentsModulePage() {
  const model = useEnvironmentsPage();

  return (
    <CommonPage>
      <EntityListPage
        title={<span className="text-xl">Environment Registry</span>}
        subtitle="Versioned infrastructure profiles for functional and performance runs"
        actions={
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={model.handleCreateStart}
            disabled={model.isSaving}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            New Environment
          </Button>
        }
        searchQuery={model.searchQuery}
        onSearchQueryChange={model.setSearchQuery}
        searchPlaceholder="Search environments..."
        filtersOpen={model.filtersOpen}
        onFiltersOpenChange={model.setFiltersOpen}
        activeFiltersCount={model.activeFiltersCount}
        onClearFilters={model.onClearFilters}
        panelClassName="w-72"
        rightSlot={
          model.selectedRowIds.size > 0 ? (
            <BulkSelectionToolbarActions
              selectedCount={model.selectedRowIds.size}
              busy={model.isSaving}
              showBulkEdit={false}
              onDelete={() => void model.handleBulkArchive()}
              onClearSelection={model.clearRowSelection}
            />
          ) : null
        }
        filtersContent={
          <FilterChecklistSection
            title="Use Cases"
            values={model.useCaseOptions}
            selectedValues={model.selectedUseCases}
            onToggle={model.onToggleUseCase}
            emptyLabel="No use cases found"
          />
        }
        isLoading={model.isLoading}
        error={null}
        empty={model.environments.length === 0}
        colSpan={8}
        loadingMessage="Loading environments..."
        emptyMessage={
          <ListPageEmptyState
            title="No environments found"
            description="Create an environment in the registry to reuse topology across functional and performance runs."
            actions={
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={model.handleCreateStart}
                disabled={model.isSaving}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                New Environment
              </Button>
            }
          />
        }
      >
        <EnvironmentsTable
          environments={model.environments}
          selectedEnvironmentId={model.selectedEnvironmentId}
          selectedRowIds={model.selectedRowIds}
          visibleColumns={model.visibleColumns}
          columnsOpen={model.columnsOpen}
          openActionsEnvironmentId={model.openActionsEnvironmentId}
          isActionBusy={model.isSaving}
          onRowClick={(environment) => {
            model.onCloseEnvironmentActions();
            model.setSelectedEnvironmentId(environment.id);
          }}
          onToggleSelectAll={model.onToggleSelectAll}
          onToggleRowSelection={model.onToggleRowSelection}
          onColumnsOpenChange={model.onColumnsOpenChange}
          onToggleColumn={model.onToggleColumn}
          onOpenEnvironmentActions={model.onOpenEnvironmentActions}
          onCloseEnvironmentActions={model.onCloseEnvironmentActions}
          onEditEnvironment={model.handleEditStart}
          onArchiveEnvironment={model.handleDelete}
          pagination={model.tablePagination}
        />
      </EntityListPage>

      {model.selectedEnvironment && !model.isCreating && !model.editingEnvironmentId ? (
        <EnvironmentDetailsSidePanel
          environment={model.selectedEnvironment}
          onClose={() => {
            model.setSelectedEnvironmentId(null);
          }}
          onEditStart={model.handleEditStart}
          onDelete={model.handleDelete}
          revisions={model.revisions}
        />
      ) : null}

      {model.isCreating || model.editingEnvironmentId ? (
        <EnvironmentWizardModal
          isOpen={model.isCreating || Boolean(model.editingEnvironmentId)}
          isCreating={model.isCreating}
          isSaving={model.isSaving}
          draft={model.draft}
          onDraftChange={model.setDraft}
          onClose={model.handleCancelForm}
          onCancel={model.handleCancelForm}
          onSave={model.handleSave}
        />
      ) : null}
    </CommonPage>
  );
}
