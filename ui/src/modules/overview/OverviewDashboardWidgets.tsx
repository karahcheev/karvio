import { useMemo } from "react";
import { AlertCircle, CheckCircle2, Clock, Play, XCircle } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { OverviewChartCard } from "./OverviewChartCard";
import { OverviewMetricCard } from "./OverviewMetricCard";
import { OverviewRecentActivityList } from "./OverviewRecentActivityList";
import type {
  ExecutionByAssigneePoint,
  ExecutionTrendPoint,
  FailuresPoint,
  OverviewTimeRange,
  PassRatePoint,
  RecentActivityItem,
  ReleaseStats,
  RunsByDimensionPoint,
  StatusDistributionPoint,
  StatusTrendPoint,
} from "./use-overview-page-state";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatTimeTick(ms: number, spanDays: number) {
  const date = new Date(ms);
  if (spanDays >= 365) {
    return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }
  if (spanDays >= 120) {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function parseUtcDateStart(value: string): number | null {
  if (!value) return null;
  const ms = new Date(`${value}T00:00:00Z`).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function parseUtcDateEnd(value: string): number | null {
  if (!value) return null;
  const ms = new Date(`${value}T23:59:59.999Z`).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function resolveTickStepDays(spanDays: number): number {
  if (spanDays <= 8) return 1;
  if (spanDays <= 30) return 5;
  if (spanDays <= 60) return 10;
  if (spanDays <= 90) return 15;
  return 30;
}

function buildTicks(startMs: number, endMs: number, stepDays: number): number[] {
  if (stepDays <= 0 || endMs <= startMs) return [startMs, endMs];

  const ticks: number[] = [];
  let current = startMs;
  const stepMs = stepDays * MS_PER_DAY;
  while (current <= endMs) {
    ticks.push(current);
    current += stepMs;
  }
  if (ticks[ticks.length - 1] !== endMs) {
    ticks.push(endMs);
  }
  return ticks;
}

function PassRateTrendTooltip({
  active,
  payload,
}: Readonly<{
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: PassRatePoint }>;
}>) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload as PassRatePoint;
  const subtitle = point.runBuild ? `${point.runName} · ${point.runBuild}` : point.runName;
  return (
    <div className="rounded-md border border-[var(--border)] bg-[color-mix(in_srgb,var(--background),transparent_5%)] px-2.5 py-2 text-xs shadow-md backdrop-blur-sm">
      <div className="text-[var(--muted-foreground)]">{point.label}</div>
      <div className="mt-0.5 font-medium text-[var(--foreground)]">{subtitle}</div>
      <div className="mt-1 tabular-nums text-[var(--foreground)]">{point.passRate}% pass rate</div>
    </div>
  );
}

function resolveTimeAxis(timeRange: OverviewTimeRange): {
  domain: [number, number] | ["dataMin", "dataMax"];
  ticks?: number[];
} {
  const startMs = parseUtcDateStart(timeRange.from);
  const endDayStartMs = parseUtcDateStart(timeRange.to);
  const endMs = parseUtcDateEnd(timeRange.to);
  if (startMs === null || endDayStartMs === null || endMs === null || endDayStartMs < startMs) {
    return { domain: ["dataMin", "dataMax"] };
  }

  const stepDays = resolveTickStepDays(timeRange.spanDays);
  return {
    domain: [startMs, endMs],
    ticks: buildTicks(startMs, endDayStartMs, stepDays),
  };
}

export type OverviewWidgetData = {
  timeRange: OverviewTimeRange;
  releaseStats: ReleaseStats;
  passRateData: PassRatePoint[];
  executionTrend: ExecutionTrendPoint[];
  statusTrend: StatusTrendPoint[];
  failuresByRun: FailuresPoint[];
  statusDistribution: StatusDistributionPoint[];
  executionByAssignee: ExecutionByAssigneePoint[];
  runsByEnvironment: RunsByDimensionPoint[];
  runsByBuild: RunsByDimensionPoint[];
  recentActivity: RecentActivityItem[];
};

export function OverviewReleaseStatsWidget({
  releaseStats,
}: Readonly<Pick<OverviewWidgetData, "releaseStats">>) {
  return (
    <div className="grid w-full gap-2.5 sm:gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
      <OverviewMetricCard
        label="Pass Rate"
        value={`${releaseStats.passRate}%`}
        hint="Across all run items"
        icon={CheckCircle2}
        iconClassName="text-[var(--status-passed)]"
      />
      <OverviewMetricCard
        label="Active Runs"
        value={releaseStats.activeRuns}
        hint="Runs in progress"
        icon={Play}
        iconClassName="text-[var(--status-in-progress)]"
      />
      <OverviewMetricCard
        label="Error"
        value={releaseStats.error}
        hint="Run items in error status"
        icon={AlertCircle}
        iconClassName="text-[var(--status-error)]"
      />
      <OverviewMetricCard
        label="Failure"
        value={releaseStats.failure}
        hint="Run items in failure status"
        icon={XCircle}
        iconClassName="text-[var(--status-failure)]"
      />
      <OverviewMetricCard
        label="Blocked Tests"
        value={releaseStats.blocked}
        hint="Needs investigation"
        icon={Clock}
        iconClassName="text-[var(--status-blocked)]"
      />
    </div>
  );
}

export function OverviewPassRateTrendWidget({
  passRateData,
  timeRange,
}: Readonly<Pick<OverviewWidgetData, "passRateData" | "timeRange">>) {
  const xAxis = useMemo(() => resolveTimeAxis(timeRange), [timeRange]);

  return (
    <OverviewChartCard title="Pass Rate Trend">
      {passRateData.length === 0 ? (
        <div className="flex h-[250px] items-center justify-center text-sm text-[var(--muted-foreground)]">No runs in this period</div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={passRateData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              type="number"
              domain={xAxis.domain}
              ticks={xAxis.ticks}
              scale="time"
              tickFormatter={(value) => formatTimeTick(value, timeRange.spanDays)}
              minTickGap={24}
            />
            <YAxis domain={[0, 100]} />
            <Tooltip content={PassRateTrendTooltip} />
            <Legend />
            <Line type="monotone" dataKey="passRate" stroke="var(--chart-pass-rate)" name="Pass Rate %" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </OverviewChartCard>
  );
}

export function OverviewExecutionVolumeTrendWidget({
  executionTrend,
  timeRange,
}: Readonly<Pick<OverviewWidgetData, "executionTrend" | "timeRange">>) {
  const xAxis = useMemo(() => resolveTimeAxis(timeRange), [timeRange]);

  return (
    <OverviewChartCard title="Execution Volume Trend">
      {executionTrend.length === 0 ? (
        <div className="flex h-[250px] items-center justify-center text-sm text-[var(--muted-foreground)]">No runs in this period</div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={executionTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              type="number"
              domain={xAxis.domain}
              ticks={xAxis.ticks}
              scale="time"
              tickFormatter={(value) => formatTimeTick(value, timeRange.spanDays)}
              minTickGap={24}
            />
            <YAxis allowDecimals={false} />
            <Tooltip
              formatter={(value: number) => [value, "Runs"]}
              labelFormatter={(_, payload) => (payload?.[0]?.payload as ExecutionTrendPoint | undefined)?.label ?? ""}
            />
            <Legend />
            <Line type="monotone" dataKey="runs" stroke="var(--chart-executed)" name="Runs" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </OverviewChartCard>
  );
}

export function OverviewBlockedSkippedTrendWidget({
  statusTrend,
  timeRange,
}: Readonly<Pick<OverviewWidgetData, "statusTrend" | "timeRange">>) {
  const xAxis = useMemo(() => resolveTimeAxis(timeRange), [timeRange]);

  return (
    <OverviewChartCard title="Blocked / Skipped Trend">
      {statusTrend.length === 0 ? (
        <div className="flex h-[250px] items-center justify-center text-sm text-[var(--muted-foreground)]">No status data in this period</div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={statusTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              type="number"
              domain={xAxis.domain}
              ticks={xAxis.ticks}
              scale="time"
              tickFormatter={(value) => formatTimeTick(value, timeRange.spanDays)}
              minTickGap={24}
            />
            <YAxis allowDecimals={false} />
            <Tooltip
              labelFormatter={(_, payload) => (payload?.[0]?.payload as StatusTrendPoint | undefined)?.label ?? ""}
            />
            <Legend />
            <Line type="monotone" dataKey="blocked" stroke="var(--status-blocked)" name="Blocked" dot={false} />
            <Line type="monotone" dataKey="skipped" stroke="var(--status-skipped)" name="Skipped" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </OverviewChartCard>
  );
}

export function OverviewPassRateIssuesTrendWidget({
  passRateData,
  timeRange,
}: Readonly<Pick<OverviewWidgetData, "passRateData" | "timeRange">>) {
  const xAxis = useMemo(() => resolveTimeAxis(timeRange), [timeRange]);

  return (
    <OverviewChartCard title="Pass Rate + Error/Failure Overlay">
      {passRateData.length === 0 ? (
        <div className="flex h-[250px] items-center justify-center text-sm text-[var(--muted-foreground)]">No trend data in this period</div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={passRateData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              type="number"
              domain={xAxis.domain}
              ticks={xAxis.ticks}
              scale="time"
              tickFormatter={(value) => formatTimeTick(value, timeRange.spanDays)}
              minTickGap={24}
            />
            <YAxis yAxisId="left" allowDecimals={false} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
            <Tooltip labelFormatter={(_, payload) => (payload?.[0]?.payload as PassRatePoint | undefined)?.label ?? ""} />
            <Legend />
            <Bar yAxisId="left" dataKey="error" fill="var(--chart-error)" name="Error" />
            <Bar yAxisId="left" dataKey="failure" fill="var(--chart-failure)" name="Failure" />
            <Line yAxisId="right" type="monotone" dataKey="passRate" stroke="var(--chart-pass-rate)" name="Pass Rate %" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </OverviewChartCard>
  );
}

export function OverviewStatusDistributionWidget({
  statusDistribution,
}: Readonly<Pick<OverviewWidgetData, "statusDistribution">>) {
  const statusDistributionNonZero = statusDistribution.filter((status) => status.value > 0);

  return (
    <OverviewChartCard title="Test Status Distribution">
      {statusDistributionNonZero.length === 0 ? (
        <div className="flex h-[250px] items-center justify-center text-sm text-[var(--muted-foreground)]">No status data in this period</div>
      ) : (
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
          <div className="min-h-[250px] min-w-0 flex-1 sm:max-w-[58%]">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusDistributionNonZero}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="var(--chart-pie-default)"
                  dataKey="value"
                >
                  {statusDistributionNonZero.map((entry, index) => (
                    <Cell key={`cell-${entry.name}-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex w-full shrink-0 flex-col gap-2 sm:w-44 sm:self-center" aria-label="Case counts by status">
            {statusDistributionNonZero.map((entry) => (
              <li key={entry.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: entry.color }} aria-hidden />
                  <span className="truncate text-[var(--foreground)]">{entry.name}</span>
                </span>
                <span className="shrink-0 tabular-nums font-medium text-[var(--foreground)]">{entry.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </OverviewChartCard>
  );
}

export function OverviewFailuresByRunWidget({
  failuresByRun,
}: Readonly<Pick<OverviewWidgetData, "failuresByRun">>) {
  return (
    <OverviewChartCard title="Errors & Failures by Run">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={failuresByRun}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="category" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="error" stackId="issues" fill="var(--chart-error)" name="Error" />
          <Bar dataKey="failure" stackId="issues" fill="var(--chart-failure)" name="Failure" />
        </BarChart>
      </ResponsiveContainer>
    </OverviewChartCard>
  );
}

export function OverviewExecutionByAssigneeWidget({
  executionByAssignee,
}: Readonly<Pick<OverviewWidgetData, "executionByAssignee">>) {
  return (
    <OverviewChartCard title="Execution by Assignee">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={executionByAssignee}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="executed" fill="var(--chart-executed)" name="Tests Executed" />
        </BarChart>
      </ResponsiveContainer>
    </OverviewChartCard>
  );
}

export function OverviewRunsByEnvironmentWidget({
  runsByEnvironment,
}: Readonly<Pick<OverviewWidgetData, "runsByEnvironment">>) {
  return (
    <OverviewChartCard title="Runs by Environment">
      {runsByEnvironment.length === 0 ? (
        <div className="flex h-[250px] items-center justify-center text-sm text-[var(--muted-foreground)]">No environment data in this period</div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={runsByEnvironment}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip formatter={(value: number) => [value, "Runs"]} />
            <Legend />
            <Bar dataKey="runs" fill="var(--chart-executed)" name="Runs" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </OverviewChartCard>
  );
}

export function OverviewRunsByBuildWidget({ runsByBuild }: Readonly<Pick<OverviewWidgetData, "runsByBuild">>) {
  return (
    <OverviewChartCard title="Runs by Build">
      {runsByBuild.length === 0 ? (
        <div className="flex h-[250px] items-center justify-center text-sm text-[var(--muted-foreground)]">No build data in this period</div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={runsByBuild}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip formatter={(value: number) => [value, "Runs"]} />
            <Legend />
            <Bar dataKey="runs" fill="var(--chart-pass-rate)" name="Runs" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </OverviewChartCard>
  );
}

export function OverviewRecentActivityWidget({
  recentActivity,
}: Readonly<Pick<OverviewWidgetData, "recentActivity">>) {
  return <OverviewRecentActivityList items={recentActivity} />;
}
