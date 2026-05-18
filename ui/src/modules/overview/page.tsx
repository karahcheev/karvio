// Project overview dashboard: date filter, charts, and export.
import { useParams } from "react-router";
import { PageHeaderSection } from "@/shared/ui/PageHeader";
import { OverviewDashboardContent } from "@/modules/overview/OverviewDashboardContent";
import { OverviewHeaderActions } from "@/modules/overview/OverviewHeaderActions";
import { OVERVIEW_WIDGET_DEFINITIONS } from "@/modules/overview/overview-widget-registry";
import { useDashboardVisibility } from "@/modules/overview/use-dashboard-visibility";
import { useOverviewPageState } from "@/modules/overview/use-overview-page-state";

export function OverviewPage() {
  const { projectId } = useParams();
  const model = useOverviewPageState(projectId);
  const dashboardVisibility = useDashboardVisibility(projectId);

  return (
    <div className="h-full overflow-auto bg-[var(--table-canvas)]">
      <PageHeaderSection
        title="Project Overview"
        subtitle="Operational dashboard and quality insights"
        actions={
          <OverviewHeaderActions
            overviewAvailable={model.overviewAvailable}
            dateFilterOpen={model.dateFilter.open}
            dateFilterLabel={model.dateFilter.label}
            draftDatePreset={model.dateFilter.draftPreset}
            draftDateFrom={model.dateFilter.draftFrom}
            draftDateTo={model.dateFilter.draftTo}
            hasDateRangeError={model.dateFilter.hasError}
            setDateFilterOpen={model.dateFilter.setOpen}
            openDateFilter={model.dateFilter.openDateFilter}
            applyDateFilter={model.dateFilter.apply}
            onDraftPresetSelect={model.dateFilter.selectDraftPreset}
            onDraftDateFromChange={model.dateFilter.setDraftFrom}
            onDraftDateToChange={model.dateFilter.setDraftTo}
            milestoneOptions={model.dateFilter.milestoneOptions}
            selectedMilestoneIds={model.dateFilter.selectedMilestoneIds}
            onToggleMilestone={model.dateFilter.toggleMilestone}
            onExportJson={model.exportJson}
            onExportXml={model.exportXml}
            onExportPdf={model.exportPdf}
            widgetDefinitions={OVERVIEW_WIDGET_DEFINITIONS}
            enabledWidgetIds={dashboardVisibility.enabledWidgetIds}
            isWidgetRequired={dashboardVisibility.isWidgetRequired}
            onToggleWidget={dashboardVisibility.toggleWidget}
            onResetDashboard={dashboardVisibility.resetDashboardPreferences}
          />
        }
      />

      <OverviewDashboardContent
        visibleWidgetOrder={dashboardVisibility.visibleWidgetOrder}
        timeRange={model.timeRange}
        releaseStats={model.releaseStats}
        passRateData={model.passRateData}
        executionTrend={model.executionTrend}
        statusTrend={model.statusTrend}
        failuresByRun={model.failuresByRun}
        statusDistribution={model.statusDistribution}
        executionByAssignee={model.executionByAssignee}
        runsByEnvironment={model.runsByEnvironment}
        runsByBuild={model.runsByBuild}
        recentActivity={model.recentActivity}
      />
    </div>
  );
}
