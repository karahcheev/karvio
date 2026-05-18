import { useMemo } from "react";
import { OVERVIEW_WIDGET_REGISTRY } from "./overview-widget-registry";
import type { OverviewWidgetId } from "./overview-widget-config";
import type { OverviewWidgetData } from "./OverviewDashboardWidgets";

type Props = OverviewWidgetData & {
  visibleWidgetOrder: OverviewWidgetId[];
};

export function OverviewDashboardContent({
  visibleWidgetOrder,
  timeRange,
  releaseStats,
  passRateData,
  executionTrend,
  statusTrend,
  failuresByRun,
  statusDistribution,
  executionByAssignee,
  runsByEnvironment,
  runsByBuild,
  recentActivity,
}: Props) {
  const widgetData = useMemo(
    () => ({
      releaseStats,
      passRateData,
      executionTrend,
      statusTrend,
      failuresByRun,
      statusDistribution,
      executionByAssignee,
      runsByEnvironment,
      runsByBuild,
      recentActivity,
      timeRange,
    }),
    [
      executionByAssignee,
      executionTrend,
      failuresByRun,
      passRateData,
      recentActivity,
      releaseStats,
      runsByBuild,
      runsByEnvironment,
      statusDistribution,
      statusTrend,
      timeRange,
    ],
  );

  const visibleWidgets = useMemo(
    () => visibleWidgetOrder.map((widgetId) => OVERVIEW_WIDGET_REGISTRY[widgetId]).filter(Boolean),
    [visibleWidgetOrder],
  );

  return (
    <div className="p-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {visibleWidgets.map((widget) => {
          const WidgetComponent = widget.component;
          return (
            <section key={widget.id} className={widget.size === "full" ? "lg:col-span-2" : undefined}>
              <WidgetComponent {...widgetData} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
