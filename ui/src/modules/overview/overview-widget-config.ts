export const OVERVIEW_WIDGET_IDS = [
  "release_stats",
  "pass_rate_trend",
  "execution_volume_trend",
  "blocked_skipped_trend",
  "pass_rate_issues_trend",
  "status_distribution",
  "failures_by_run",
  "execution_by_assignee",
  "runs_by_environment",
  "runs_by_build",
  "recent_activity",
] as const;

export type OverviewWidgetId = (typeof OVERVIEW_WIDGET_IDS)[number];
export type OverviewGranularity = "day" | "week" | "month";

export type OverviewDashboardPreferences = {
  enabledWidgets: OverviewWidgetId[];
  widgetOrder: OverviewWidgetId[];
  hiddenSeries: Partial<Record<OverviewWidgetId, string[]>>;
  filters: {
    topN?: number;
    granularity?: OverviewGranularity;
  };
};

export const REQUIRED_OVERVIEW_WIDGET_IDS: readonly OverviewWidgetId[] = ["release_stats"];

export const DEFAULT_OVERVIEW_WIDGET_ORDER: readonly OverviewWidgetId[] = [...OVERVIEW_WIDGET_IDS];

export const DEFAULT_OVERVIEW_ENABLED_WIDGETS: readonly OverviewWidgetId[] = [...OVERVIEW_WIDGET_IDS];

export function createDefaultOverviewDashboardPreferences(): OverviewDashboardPreferences {
  return {
    enabledWidgets: [...DEFAULT_OVERVIEW_ENABLED_WIDGETS],
    widgetOrder: [...DEFAULT_OVERVIEW_WIDGET_ORDER],
    hiddenSeries: {},
    filters: {},
  };
}

export function isOverviewWidgetId(value: string): value is OverviewWidgetId {
  return OVERVIEW_WIDGET_IDS.includes(value as OverviewWidgetId);
}
