import type { ComponentType } from "react";
import { OVERVIEW_WIDGET_IDS, REQUIRED_OVERVIEW_WIDGET_IDS, type OverviewWidgetId } from "./overview-widget-config";
import {
  OverviewBlockedSkippedTrendWidget,
  OverviewExecutionVolumeTrendWidget,
  OverviewExecutionByAssigneeWidget,
  OverviewFailuresByRunWidget,
  OverviewPassRateIssuesTrendWidget,
  OverviewPassRateTrendWidget,
  OverviewRecentActivityWidget,
  OverviewReleaseStatsWidget,
  OverviewRunsByBuildWidget,
  OverviewRunsByEnvironmentWidget,
  OverviewStatusDistributionWidget,
  type OverviewWidgetData,
} from "./OverviewDashboardWidgets";

export type OverviewWidgetRole = "viewer" | "tester" | "lead" | "manager";

export type OverviewWidgetDefinition = {
  id: OverviewWidgetId;
  title: string;
  size: "half" | "full";
  requiredRole: OverviewWidgetRole;
  defaultVisible: boolean;
  required: boolean;
  component: ComponentType<OverviewWidgetData>;
};

export const OVERVIEW_WIDGET_REGISTRY: Record<OverviewWidgetId, OverviewWidgetDefinition> = {
  release_stats: {
    id: "release_stats",
    title: "Release Stats",
    size: "full",
    requiredRole: "viewer",
    defaultVisible: true,
    required: true,
    component: OverviewReleaseStatsWidget,
  },
  pass_rate_trend: {
    id: "pass_rate_trend",
    title: "Pass Rate Trend",
    size: "half",
    requiredRole: "viewer",
    defaultVisible: true,
    required: false,
    component: OverviewPassRateTrendWidget,
  },
  execution_volume_trend: {
    id: "execution_volume_trend",
    title: "Execution Volume Trend",
    size: "half",
    requiredRole: "viewer",
    defaultVisible: true,
    required: false,
    component: OverviewExecutionVolumeTrendWidget,
  },
  blocked_skipped_trend: {
    id: "blocked_skipped_trend",
    title: "Blocked / Skipped Trend",
    size: "half",
    requiredRole: "viewer",
    defaultVisible: true,
    required: false,
    component: OverviewBlockedSkippedTrendWidget,
  },
  pass_rate_issues_trend: {
    id: "pass_rate_issues_trend",
    title: "Pass Rate + Error/Failure Overlay",
    size: "half",
    requiredRole: "viewer",
    defaultVisible: true,
    required: false,
    component: OverviewPassRateIssuesTrendWidget,
  },
  status_distribution: {
    id: "status_distribution",
    title: "Status Distribution",
    size: "half",
    requiredRole: "viewer",
    defaultVisible: true,
    required: false,
    component: OverviewStatusDistributionWidget,
  },
  failures_by_run: {
    id: "failures_by_run",
    title: "Errors & Failures by Run",
    size: "half",
    requiredRole: "viewer",
    defaultVisible: true,
    required: false,
    component: OverviewFailuresByRunWidget,
  },
  execution_by_assignee: {
    id: "execution_by_assignee",
    title: "Execution by Assignee",
    size: "half",
    requiredRole: "viewer",
    defaultVisible: true,
    required: false,
    component: OverviewExecutionByAssigneeWidget,
  },
  runs_by_environment: {
    id: "runs_by_environment",
    title: "Runs by Environment",
    size: "half",
    requiredRole: "viewer",
    defaultVisible: true,
    required: false,
    component: OverviewRunsByEnvironmentWidget,
  },
  runs_by_build: {
    id: "runs_by_build",
    title: "Runs by Build",
    size: "half",
    requiredRole: "viewer",
    defaultVisible: true,
    required: false,
    component: OverviewRunsByBuildWidget,
  },
  recent_activity: {
    id: "recent_activity",
    title: "Recent Activity",
    size: "full",
    requiredRole: "viewer",
    defaultVisible: true,
    required: false,
    component: OverviewRecentActivityWidget,
  },
};

export const OVERVIEW_WIDGET_DEFINITIONS: readonly OverviewWidgetDefinition[] = OVERVIEW_WIDGET_IDS.map((widgetId) => {
  const definition = OVERVIEW_WIDGET_REGISTRY[widgetId];
  return {
    ...definition,
    required: definition.required || REQUIRED_OVERVIEW_WIDGET_IDS.includes(widgetId),
  };
});
