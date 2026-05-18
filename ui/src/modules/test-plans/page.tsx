// Test plans module page: list plans, create or edit, and start runs from templates.
import { Plus } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { Button, CommonPage, EntityListPage, FilterChecklistSection, ListPageEmptyState, UnderlineTabs } from "@/shared/ui";
import { CreateRunFromPlanModal } from "@/modules/test-runs/components/CreateRunFromPlanModal";
import { PlanFormModal } from "@/modules/test-runs/components/PlanFormModal";
import { PlanDetailsSidePanel } from "./components/PlanDetailsSidePanel";
import { TestPlansTable } from "./components/TestPlansTable";
import { useTestPlansPage } from "./hooks/use-test-plans-page";
import { useDisclosure } from "@/shared/hooks";

export function TestPlansModulePage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { isOpen: createFormOpen, open: openCreateForm, close: closeCreateForm } = useDisclosure(false);
  const model = useTestPlansPage({
    loadSelectedPlanDetail: true,
  });
  const selectedPlan = model.selectedPlan;

  const planFormOpen = createFormOpen || Boolean(model.editingPlan);

  const handlePlanFormClose = () => {
    model.setEditingPlan(null);
    closeCreateForm();
  };

  const handleOpenCreateForm = () => {
    openCreateForm();
  };

  const handleEditPlan = (plan: NonNullable<typeof model.editingPlan> | (typeof model.plans)[number]) => {
    model.onEditPlan(plan);
  };

  const handlePlanFormSubmit = async (payload: {
    name: string;
    description: string;
    tags: string[];
    milestone_id: string | null;
    suite_ids: string[];
    case_ids: string[];
  }) => {
    if (model.editingPlan) {
      await model.onPatchPlan(model.editingPlan.id, payload);
    } else {
      await model.onCreatePlan(payload);
    }
    handlePlanFormClose();
  };

  const handleCreateRunSubmit = (payload: {
    name: string;
    description: string;
    environment_id?: string;
    milestone_id?: string | null;
    build: string;
    assignee: string | null;
    start_immediately: boolean;
  }) => {
    if (!model.createRunPlan) return;
    model.onCreateRunFromPlan(model.createRunPlan.id, {
      name: payload.name,
      description: payload.description || null,
      environment_id: payload.environment_id,
      milestone_id: payload.milestone_id,
      build: payload.build || null,
      assignee: payload.assignee,
      start_immediately: payload.start_immediately,
    });
    model.setCreateRunPlan(null);
  };

  const loading = model.createLoading || model.patchLoading;

  return (
    <CommonPage>
      <EntityListPage
        title={<span className="text-xl">Test Plans</span>}
        subtitle={
          <div className="space-y-3">
            <div>Templates for quick test run creation</div>
            <UnderlineTabs<"products" | "components" | "milestones" | "test-plans">
              value="test-plans"
              onChange={(next) => {
                if (!projectId) return;
                if (next === "products") {
                  navigate(`/projects/${projectId}/products`);
                  return;
                }
                if (next === "components") {
                  navigate(`/projects/${projectId}/products?tab=components`);
                  return;
                }
                if (next === "milestones") {
                  navigate(`/projects/${projectId}/products/milestones`);
                }
              }}
              items={[
                { value: "products", label: "Products" },
                { value: "components", label: "Components" },
                { value: "milestones", label: "Milestones" },
                { value: "test-plans", label: "Test Plans" },
              ]}
            />
          </div>
        }
        actions={
          <Button
            unstyled
            type="button"
            onClick={handleOpenCreateForm}
            className="flex items-center gap-2 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] disabled:opacity-50"
            disabled={loading}
          >
            <Plus className="h-4 w-4" />
            New plan
          </Button>
        }
        searchQuery={model.searchQuery}
        onSearchQueryChange={model.setSearchQuery}
        searchPlaceholder="Search plans by name or description..."
        filtersOpen={model.filtersOpen}
        onFiltersOpenChange={model.setFiltersOpen}
        activeFiltersCount={model.activeFiltersCount}
        onClearFilters={model.onClearAllFilters}
        panelClassName="w-72"
        filtersContent={
          <>
            <FilterChecklistSection
              title="Tags"
              values={model.availableTags}
              selectedValues={model.selectedTags}
              onToggle={model.onToggleTag}
              emptyLabel="No tags found"
            />
            <FilterChecklistSection
              title="Milestone"
              values={model.milestoneOptions.map((item) => item.id)}
              selectedValues={model.selectedMilestoneIds}
              onToggle={model.onToggleMilestone}
              getLabel={model.getMilestoneLabel}
              emptyLabel="No milestones found"
            />
          </>
        }
        isLoading={model.isLoading}
        error={null}
        empty={model.plans.length === 0}
        colSpan={model.visibleColumns.size + 1}
        loadingMessage="Loading plans..."
        emptyMessage={
          <ListPageEmptyState
            title="No test plans yet"
            description="Create a plan to quickly start runs from predefined suites and test cases."
            actions={
              <Button
                unstyled
                type="button"
                onClick={handleOpenCreateForm}
                className="flex items-center gap-2 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] disabled:opacity-50"
                disabled={loading}
              >
                <Plus className="h-4 w-4" />
                Create first plan
              </Button>
            }
          />
        }
      >
        <TestPlansTable
          projectId={model.projectId}
          plans={model.plans}
          visibleColumns={model.visibleColumns}
          columnsOpen={model.columnsOpen}
          selectedPlanId={model.selectedPlanId}
          openActionsPlanId={model.openActionsPlanId}
          resolveUserName={model.resolveUserName}
          onColumnsOpenChange={model.onColumnsOpenChange}
          onToggleColumn={model.onToggleColumn}
          onRowClick={model.onRowClick}
          onOpenActionsChange={model.setOpenActionsPlanId}
          onEditPlan={handleEditPlan}
          onDeletePlan={model.onDeletePlan}
          onCreateRun={model.onCreateRun}
          createRunLoading={model.createRunLoading}
          pagination={model.tablePagination}
        />
      </EntityListPage>

      <PlanFormModal
        isOpen={planFormOpen}
        loading={loading || model.planFormDataLoading}
        plan={model.editingPlan}
        projectId={model.projectId}
        suites={model.suites}
        testCases={model.testCases ?? []}
        milestoneOptions={model.milestoneOptions}
        onClose={handlePlanFormClose}
        onSubmit={handlePlanFormSubmit}
      />

      <CreateRunFromPlanModal
        isOpen={Boolean(model.createRunPlan)}
        loading={model.createRunLoading}
        plan={model.createRunPlan}
        assigneeOptions={model.assigneeOptions}
        environmentOptions={model.environmentOptions}
        milestoneOptions={model.milestoneOptions}
        onClose={() => model.setCreateRunPlan(null)}
        onSubmit={handleCreateRunSubmit}
      />

      {selectedPlan ? (
        <PlanDetailsSidePanel
          plan={selectedPlan}
          onClose={() => model.onRowClick(selectedPlan.id)}
          onEdit={handleEditPlan}
          onCreateRun={model.onCreateRun}
          onDelete={model.onDeletePlan}
          resolveUserName={model.resolveUserName}
          createRunLoading={model.createRunLoading}
        />
      ) : null}
    </CommonPage>
  );
}
