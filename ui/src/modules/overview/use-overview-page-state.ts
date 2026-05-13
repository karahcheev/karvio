import { useCallback, useMemo, useState } from "react";
import { useMilestonesPageQuery, useProjectOverviewQuery, type ProjectOverviewDto, downloadProjectOverviewExport } from "@/shared/api";
import { downloadBlobAsFile } from "./overview-export";

export type DatePreset = "7d" | "30d" | "90d" | "180d" | "custom";
export type OverviewGranularity = "day" | "week" | "month";
export type OverviewTimeRange = {
  from: string;
  to: string;
  spanDays: number;
};

export type ReleaseStats = {
  activeRuns: number;
  passRate: number;
  error: number;
  failure: number;
  blocked: number;
};

/** Time-bucketed pass rate trend point; `time` is UTC ms for Recharts. */
export type PassRatePoint = {
  time: number;
  label: string;
  passRate: number;
  error: number;
  failure: number;
  runName: string;
  runBuild: string | null;
};
export type FailuresPoint = { category: string; error: number; failure: number };
export type StatusDistributionPoint = { name: string; value: number; color: string };
export type ExecutionByAssigneePoint = { name: string; executed: number };
export type ExecutionTrendPoint = { time: number; label: string; runs: number };
export type StatusTrendPoint = {
  time: number;
  label: string;
  blocked: number;
  skipped: number;
  error: number;
  failure: number;
  passRate: number;
};
export type RunsByDimensionPoint = { name: string; runs: number };
export type RecentActivityItem = ProjectOverviewDto["recent_activity"][number];

const OVERVIEW_TOP_N = 12;

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRelativeRange(days: number) {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - Math.max(days - 1, 0));
  return {
    from: formatDateInput(from),
    to: formatDateInput(to),
  };
}

function getRangeSpanDays(from: string, to: string): number {
  if (!from || !to) return 0;
  const fromTime = new Date(`${from}T00:00:00Z`).getTime();
  const toTime = new Date(`${to}T00:00:00Z`).getTime();
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime) || toTime < fromTime) return 0;
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((toTime - fromTime) / dayMs) + 1;
}

function resolveOverviewGranularity(preset: DatePreset, from: string, to: string): OverviewGranularity {
  if (preset === "7d" || preset === "30d") return "day";
  if (preset === "90d" || preset === "180d") return "week";

  const spanDays = getRangeSpanDays(from, to);
  if (spanDays <= 45) return "day";
  if (spanDays <= 210) return "week";
  return "month";
}

function mapStatusColor(statusName: string): string {
  if (statusName === "Passed") return "var(--status-passed)";
  if (statusName === "Error") return "var(--status-error)";
  if (statusName === "Failure") return "var(--status-failure)";
  if (statusName === "Blocked") return "var(--status-blocked)";
  if (statusName === "Skipped") return "var(--status-skipped)";
  if (statusName === "In progress") return "var(--status-in-progress)";
  if (statusName === "XFailed") return "var(--status-xfailed)";
  if (statusName === "XPassed") return "var(--status-xpassed)";
  return "var(--status-default)";
}

function fallbackExecutionTrend(passRateTrend: NonNullable<ProjectOverviewDto["pass_rate_trend"]>): ExecutionTrendPoint[] {
  const grouped = new Map<string, ExecutionTrendPoint>();
  for (const item of passRateTrend) {
    const date = new Date(item.created_at);
    const dayKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    const current = grouped.get(dayKey);
    if (current) {
      current.runs += 1;
      continue;
    }
    grouped.set(dayKey, {
      time: new Date(`${dayKey}T00:00:00Z`).getTime(),
      label: dayKey,
      runs: 1,
    });
  }
  return [...grouped.values()].sort((a, b) => a.time - b.time);
}

export function useOverviewPageState(projectId: string | undefined) {
  const initialRange = useMemo(() => getRelativeRange(30), []);

  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [appliedDatePreset, setAppliedDatePreset] = useState<DatePreset>("30d");
  const [appliedDateFrom, setAppliedDateFrom] = useState(initialRange.from);
  const [appliedDateTo, setAppliedDateTo] = useState(initialRange.to);
  const [draftDatePreset, setDraftDatePreset] = useState<DatePreset>("30d");
  const [draftDateFrom, setDraftDateFrom] = useState(initialRange.from);
  const [draftDateTo, setDraftDateTo] = useState(initialRange.to);
  const [appliedMilestoneIds, setAppliedMilestoneIds] = useState<Set<string>>(new Set());
  const [draftMilestoneIds, setDraftMilestoneIds] = useState<Set<string>>(new Set());

  const milestonesQuery = useMilestonesPageQuery(
    projectId,
    { page: 1, pageSize: 200, search: "", statuses: undefined },
    Boolean(projectId),
  );

  const overviewGranularity = useMemo<OverviewGranularity>(
    () => resolveOverviewGranularity(appliedDatePreset, appliedDateFrom, appliedDateTo),
    [appliedDateFrom, appliedDatePreset, appliedDateTo],
  );

  const { data: overview = null } = useProjectOverviewQuery(projectId, {
    createdFrom: appliedDateFrom || undefined,
    createdTo: appliedDateTo || undefined,
    milestoneIds: appliedMilestoneIds.size > 0 ? Array.from(appliedMilestoneIds) : undefined,
    topN: OVERVIEW_TOP_N,
    granularity: overviewGranularity,
  });

  const resolvePresetRange = (preset: DatePreset) => {
    if (preset === "7d") return getRelativeRange(7);
    if (preset === "30d") return getRelativeRange(30);
    if (preset === "90d") return getRelativeRange(90);
    if (preset === "180d") return getRelativeRange(180);
    return { from: draftDateFrom, to: draftDateTo };
  };

  const hasDateRangeError = !!draftDateFrom && !!draftDateTo && draftDateFrom > draftDateTo;

  const handleDraftPresetSelect = (preset: DatePreset) => {
    const range = resolvePresetRange(preset);
    setDraftDatePreset(preset);
    setDraftDateFrom(range.from);
    setDraftDateTo(range.to);
  };

  const handleDraftDateFromChange = (value: string) => {
    setDraftDateFrom(value);
    setDraftDatePreset("custom");
  };

  const handleDraftDateToChange = (value: string) => {
    setDraftDateTo(value);
    setDraftDatePreset("custom");
  };

  const applyDateFilter = () => {
    if (hasDateRangeError) return;
    setAppliedDatePreset(draftDatePreset);
    setAppliedDateFrom(draftDateFrom);
    setAppliedDateTo(draftDateTo);
    setAppliedMilestoneIds(new Set(draftMilestoneIds));
    setDateFilterOpen(false);
  };

  const openDateFilter = () => {
    setDraftDatePreset(appliedDatePreset);
    setDraftDateFrom(appliedDateFrom);
    setDraftDateTo(appliedDateTo);
    setDraftMilestoneIds(new Set(appliedMilestoneIds));
    setDateFilterOpen(true);
  };

  const dateFilterLabel = useMemo(() => {
    if (appliedDatePreset === "7d") return "Last 7 days";
    if (appliedDatePreset === "30d") return "Last 30 days";
    if (appliedDatePreset === "90d") return "Last 90 days";
    if (appliedDatePreset === "180d") return "Last 180 days";
    if (appliedDateFrom || appliedDateTo) return `${appliedDateFrom || "Start"} - ${appliedDateTo || "Now"}`;
    return "Custom range";
  }, [appliedDateFrom, appliedDatePreset, appliedDateTo]);
  const milestoneOptions = (milestonesQuery.data?.items ?? []).map((milestone) => ({
    id: milestone.id,
    label: milestone.name,
  }));

  const timeRange = useMemo<OverviewTimeRange>(
    () => ({
      from: appliedDateFrom,
      to: appliedDateTo,
      spanDays: getRangeSpanDays(appliedDateFrom, appliedDateTo),
    }),
    [appliedDateFrom, appliedDateTo],
  );

  const releaseStats = useMemo<ReleaseStats>(
    () => ({
      activeRuns: overview?.release_stats.active_runs ?? 0,
      passRate: Math.round(overview?.release_stats.pass_rate ?? 0),
      error: overview?.release_stats.error ?? 0,
      failure: overview?.release_stats.failure ?? 0,
      blocked: overview?.release_stats.blocked ?? 0,
    }),
    [overview],
  );

  const passRateData = useMemo<PassRatePoint[]>(() => {
    const statusTrend = [...(overview?.status_trend ?? [])].sort(
      (a, b) => new Date(a.bucket_start).getTime() - new Date(b.bucket_start).getTime(),
    );
    if (statusTrend.length > 0) {
      return statusTrend.map((item) => ({
        time: new Date(item.bucket_start).getTime(),
        label: item.bucket_label,
        passRate: Math.round(item.pass_rate),
        error: item.error,
        failure: item.failure,
        runName: item.bucket_label,
        runBuild: null,
      }));
    }

    return [...(overview?.pass_rate_trend ?? [])]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((item) => ({
        time: new Date(item.created_at).getTime(),
        label: new Date(item.created_at).toLocaleDateString(),
        passRate: Math.round(item.pass_rate),
        error: item.error,
        failure: item.failure,
        runName: item.name,
        runBuild: item.build,
      }));
  }, [overview]);

  const executionTrend = useMemo<ExecutionTrendPoint[]>(() => {
    const items = [...(overview?.execution_trend ?? [])]
      .sort((a, b) => new Date(a.bucket_start).getTime() - new Date(b.bucket_start).getTime())
      .map((item) => ({
        time: new Date(item.bucket_start).getTime(),
        label: item.bucket_label,
        runs: item.runs,
      }));

    if (items.length > 0) return items;
    return fallbackExecutionTrend(overview?.pass_rate_trend ?? []);
  }, [overview]);

  const statusTrend = useMemo<StatusTrendPoint[]>(() => {
    const items = [...(overview?.status_trend ?? [])]
      .sort((a, b) => new Date(a.bucket_start).getTime() - new Date(b.bucket_start).getTime())
      .map((item) => ({
        time: new Date(item.bucket_start).getTime(),
        label: item.bucket_label,
        blocked: item.blocked,
        skipped: item.skipped,
        error: item.error,
        failure: item.failure,
        passRate: Math.round(item.pass_rate),
      }));

    if (items.length > 0) return items;

    return [...(overview?.pass_rate_trend ?? [])]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((item) => ({
        time: new Date(item.created_at).getTime(),
        label: new Date(item.created_at).toLocaleDateString(),
        blocked: 0,
        skipped: 0,
        error: item.error,
        failure: item.failure,
        passRate: Math.round(item.pass_rate),
      }));
  }, [overview]);

  const failuresByRun = useMemo<FailuresPoint[]>(
    () => (overview?.failures_by_run ?? []).map((item) => ({ category: item.category, error: item.error, failure: item.failure })),
    [overview],
  );

  const statusDistribution = useMemo<StatusDistributionPoint[]>(
    () =>
      (overview?.status_distribution ?? []).map((item) => ({
        ...item,
        color: mapStatusColor(item.name),
      })),
    [overview],
  );

  const executionByAssignee = useMemo<ExecutionByAssigneePoint[]>(
    () => (overview?.execution_by_assignee ?? []).map((item) => ({ name: item.assignee_name, executed: item.executed })),
    [overview],
  );

  const runsByEnvironment = useMemo<RunsByDimensionPoint[]>(
    () => (overview?.runs_by_environment ?? []).map((item) => ({ name: item.environment, runs: item.runs })),
    [overview],
  );

  const runsByBuild = useMemo<RunsByDimensionPoint[]>(
    () => (overview?.runs_by_build ?? []).map((item) => ({ name: item.build, runs: item.runs })),
    [overview],
  );

  const recentActivity = useMemo<RecentActivityItem[]>(() => overview?.recent_activity ?? [], [overview]);

  const buildExportFilename = useCallback(
    (extension: string) => `project-${projectId}-overview-${appliedDateFrom}_${appliedDateTo}.${extension}`,
    [appliedDateFrom, appliedDateTo, projectId],
  );

  const handleExportJson = useCallback(() => {
    if (!overview || !projectId) return;
    const blob = new Blob([JSON.stringify(overview, null, 2)], { type: "application/json" });
    downloadBlobAsFile(blob, buildExportFilename("json"));
  }, [buildExportFilename, overview, projectId]);

  const handleExportXml = useCallback(() => {
    if (!projectId) return;
    void downloadProjectOverviewExport(projectId, "xml", {
      createdFrom: appliedDateFrom || undefined,
      createdTo: appliedDateTo || undefined,
      milestoneIds: appliedMilestoneIds.size > 0 ? Array.from(appliedMilestoneIds) : undefined,
      granularity: overviewGranularity,
    });
  }, [appliedDateFrom, appliedDateTo, appliedMilestoneIds, overviewGranularity, projectId]);

  const handleExportPdf = useCallback(() => {
    if (!projectId) return;
    void downloadProjectOverviewExport(projectId, "pdf", {
      createdFrom: appliedDateFrom || undefined,
      createdTo: appliedDateTo || undefined,
      milestoneIds: appliedMilestoneIds.size > 0 ? Array.from(appliedMilestoneIds) : undefined,
      granularity: overviewGranularity,
    });
  }, [appliedDateFrom, appliedDateTo, appliedMilestoneIds, overviewGranularity, projectId]);

  return {
    overviewAvailable: Boolean(overview),
    dateFilter: {
      open: dateFilterOpen,
      setOpen: setDateFilterOpen,
      label: dateFilterLabel,
      draftPreset: draftDatePreset,
      draftFrom: draftDateFrom,
      draftTo: draftDateTo,
      hasError: hasDateRangeError,
      openDateFilter,
      apply: applyDateFilter,
      selectDraftPreset: handleDraftPresetSelect,
      setDraftFrom: handleDraftDateFromChange,
      setDraftTo: handleDraftDateToChange,
      milestoneOptions,
      selectedMilestoneIds: draftMilestoneIds,
      toggleMilestone: (milestoneId: string) => {
        setDraftMilestoneIds((current) => {
          const next = new Set(current);
          if (next.has(milestoneId)) next.delete(milestoneId);
          else next.add(milestoneId);
          return next;
        });
      },
    },
    overviewGranularity,
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
    exportJson: handleExportJson,
    exportXml: handleExportXml,
    exportPdf: handleExportPdf,
  };
}
