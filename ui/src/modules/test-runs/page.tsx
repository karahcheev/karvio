// Test runs list page and single-run overview with items and modals.
import { FileUp, Plus } from "lucide-react";
import { Button, CommonContent, CommonPage, EntityListPage, FilterChecklistSection, ListPageEmptyState } from "@/shared/ui";
import { AddRunItemsModal, ImportJunitXmlModal, UpdateRunItemStatusModal, RunItemSnapshotPanel, RunItemsBulkActions, RunItemsTable, RunItemsToolbar, RunProgressBar, RunStatusCards, TestRunOverviewHeader } from "./components";
import { CreateRunDialog } from "./components/CreateRunDialog";
import { RunDetailsPanel } from "./components/RunDetailsPanel";
import { TestRunsTable } from "./components/TestRunsTable";
import { useTestRunOverviewPage } from "./hooks/use-test-run-overview-page";
import { useTestRunsPage } from "./hooks/use-test-runs-page";

function getStatusText(status: string) {
  if (status === "in_progress") return "In Progress";
  if (status === "not_started") return "Not started";
  if (status === "completed") return "Completed";
  if (status === "archived") return "Archived";
  return status;
}

export function TestRunsModulePage() {
  const model = useTestRunsPage();

  return (
    <CommonPage>
      <EntityListPage
        title={<span className="text-xl">{model.header.title}</span>}
        subtitle={model.header.subtitle}
        actions={
          <div className="flex items-center gap-2">
            <Button
              unstyled
              type="button"
              onClick={model.actions.onImportJunitClick}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
            >
              <FileUp className="h-4 w-4" />
              Import JUnit
            </Button>
            <Button
              unstyled
              type="button"
              onClick={model.actions.onNewRunClick}
              className="flex items-center gap-2 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)]"
            >
              <Plus className="h-4 w-4" />
              New Run
            </Button>
          </div>
        }
        searchQuery={model.toolbar.searchQuery}
        onSearchQueryChange={model.toolbar.onSearchQueryChange}
        searchPlaceholder="Search runs by name, build, environment..."
        filtersOpen={model.toolbar.filtersOpen}
        onFiltersOpenChange={model.toolbar.onFiltersOpenChange}
        activeFiltersCount={model.toolbar.activeFiltersCount}
        onClearFilters={model.toolbar.onClearAllFilters}
        panelClassName="w-72"
        filtersContent={
          <>
            <FilterChecklistSection
              title="Status"
              values={["not_started", "in_progress", "completed", "archived"]}
              selectedValues={model.toolbar.selectedStatuses}
              onToggle={model.toolbar.onToggleStatus}
              getLabel={getStatusText}
            />
            <div className="mb-4 last:mb-0">
              <div className="mb-2 text-sm font-medium text-[var(--foreground)]">Period</div>
              <div className="mb-3 grid grid-cols-2 gap-2">
                {([
                  { value: "all", label: "All time" },
                  { value: "7d", label: "Last 7 days" },
                  { value: "30d", label: "Last 30 days" },
                  { value: "90d", label: "Last 90 days" },
                  { value: "180d", label: "Last 180 days" },
                ] as const).map((preset) => (
                  <Button
                    key={preset.value}
                    unstyled
                    type="button"
                    onClick={() => model.toolbar.onPeriodPresetSelect(preset.value)}
                    className={`rounded-md border px-2 py-1.5 text-xs ${
                      model.toolbar.selectedPeriodPreset === preset.value
                        ? "border-[var(--highlight-border)] bg-[var(--highlight-bg-soft)] text-[var(--highlight-foreground)]"
                        : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]"
                    }`}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <div className="space-y-2 border-t border-[var(--border)] pt-3">
                <label className="block text-xs font-medium text-[var(--foreground)]" htmlFor="test-runs-date-from">
                  From
                </label>
                <input
                  id="test-runs-date-from"
                  type="date"
                  value={model.toolbar.createdFrom}
                  onChange={(event) => model.toolbar.onCreatedFromChange(event.target.value)}
                  className="w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm focus:border-[var(--highlight-border)] focus:outline-none focus:ring-1 focus:ring-[var(--control-focus-ring)]"
                />
                <label className="block text-xs font-medium text-[var(--foreground)]" htmlFor="test-runs-date-to">
                  To
                </label>
                <input
                  id="test-runs-date-to"
                  type="date"
                  value={model.toolbar.createdTo}
                  onChange={(event) => model.toolbar.onCreatedToChange(event.target.value)}
                  className="w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm focus:border-[var(--highlight-border)] focus:outline-none focus:ring-1 focus:ring-[var(--control-focus-ring)]"
                />
              </div>
              <div className="mt-2 text-xs text-[var(--muted-foreground)]">{model.toolbar.datePeriodLabel}</div>
              {model.toolbar.hasDateRangeError ? <p className="mt-1 text-xs text-[var(--status-failure)]">`From` must be earlier than `To`.</p> : null}
            </div>
            <FilterChecklistSection
              title="Environment"
              values={model.toolbar.environments}
              selectedValues={model.toolbar.selectedEnvironments}
              onToggle={model.toolbar.onToggleEnvironment}
              getLabel={model.toolbar.getEnvironmentLabel}
              emptyLabel="No environments found"
            />
            <FilterChecklistSection
              title="Milestone"
              values={model.toolbar.milestones}
              selectedValues={model.toolbar.selectedMilestones}
              onToggle={model.toolbar.onToggleMilestone}
              getLabel={model.toolbar.getMilestoneLabel}
              emptyLabel="No milestones found"
            />
          </>
        }
        isLoading={model.table.isLoading}
        error={null}
        empty={model.table.runs.length === 0}
        colSpan={model.table.visibleColumns.size + 1}
        loadingMessage="Loading test runs..."
        emptyMessage={
          <ListPageEmptyState
            title="No test runs found"
            description="Start a run to track executions, or import JUnit XML results."
            actions={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  unstyled
                  type="button"
                  onClick={model.actions.onImportJunitClick}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
                >
                  <FileUp className="h-4 w-4" />
                  Import JUnit
                </Button>
                <Button
                  unstyled
                  type="button"
                  onClick={model.actions.onNewRunClick}
                  className="flex items-center gap-2 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)]"
                >
                  <Plus className="h-4 w-4" />
                  New Run
                </Button>
              </div>
            }
          />
        }
      >
        <TestRunsTable {...model.table} />
      </EntityListPage>

      {model.details ? <RunDetailsPanel {...model.details} /> : null}
      <CreateRunDialog {...model.createRun} />
      <ImportJunitXmlModal {...model.projectJunitImportDialog} />
      <ImportJunitXmlModal {...model.junitImportDialog} />
    </CommonPage>
  );
}

export function TestRunOverviewModulePage() {
  const model = useTestRunOverviewPage();

  return (
    <CommonPage className="overflow-auto">
      <TestRunOverviewHeader {...model.header} />
      <CommonContent className="overflow-auto pt-3">
        <div className="mb-6">
          <RunStatusCards {...model.statusCards} />
          <RunProgressBar {...model.progress} />
        </div>

        <div>
          <RunItemsToolbar {...model.toolbar} />
          <RunItemsBulkActions {...model.bulkActions} />
          <RunItemsTable {...model.table} />
        </div>
      </CommonContent>

      <RunItemSnapshotPanel {...model.snapshot} />
      <UpdateRunItemStatusModal {...model.statusDialog} />
      <AddRunItemsModal {...model.addRunItemsDialog} />
      <ImportJunitXmlModal {...model.junitImportDialog} />
    </CommonPage>
  );
}
