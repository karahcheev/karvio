import { useCallback, useEffect, useMemo } from "react";
import {
  formatRelativeTime,
  useRunCasesPageQuery,
  useTestRunQuery,
  type RunCaseDto,
  type RunCasesSortBy,
} from "@/shared/api";
import { invokeMaybeAsync } from "@/shared/lib/invoke-maybe-async";
import { notifyError } from "@/shared/lib/notifications";
import type { UnifiedTableSorting } from "@/shared/ui/Table";
import type { RunItemColumn, RunOverviewRow } from "@/modules/test-runs/components";
import { EMPTY_STATUS_BREAKDOWN } from "@/modules/test-runs/utils/constants";

const RUN_ITEMS_PAGE_SIZE = 100;

function mapRunCaseSorting(column: RunItemColumn): RunCasesSortBy | null {
  switch (column) {
    case "title":
      return "test_case_title";
    case "suite":
      return "suite_name";
    case "status":
      return "status";
    case "assignee":
      return "assignee_name";
    case "lastExecuted":
      return "last_executed_at";
    case "tags":
      return null;
  }
}

type UseTestRunDataParams = {
  runId: string | undefined;
  sorting: UnifiedTableSorting<RunItemColumn>;
  statuses?: RunCaseDto["status"][];
  assigneeId?: string;
  search?: string;
};

export function useTestRunData({ runId, sorting, statuses, assigneeId, search }: UseTestRunDataParams) {
  const runQuery = useTestRunQuery(runId);
  const run = runQuery.data ?? null;

  const runCasesPageQuery = useRunCasesPageQuery(runId, {
    pageSize: RUN_ITEMS_PAGE_SIZE,
    statuses,
    assigneeId,
    search,
    sortBy: mapRunCaseSorting(sorting.column) ?? undefined,
    sortDirection: sorting.direction,
  });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = runCasesPageQuery;

  useEffect(() => {
    if (runQuery.isError) notifyError(runQuery.error, "Failed to load run overview.");
  }, [runQuery.error, runQuery.isError]);

  const handleLoadMoreRunCases = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) invokeMaybeAsync(() => fetchNextPage());
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const items = useMemo(
    () => runCasesPageQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [runCasesPageQuery.data?.pages],
  );

  const summary = run?.summary ?? {
    total: 0,
    passed: 0,
    error: 0,
    failure: 0,
    blocked: 0,
    skipped: 0,
    xfailed: 0,
    xpassed: 0,
    pass_rate: 0,
  };
  const statusBreakdown = useMemo(
    () =>
      run?.status_breakdown?.items?.reduce<Record<RunCaseDto["status"], number>>(
        (acc, item) => {
          acc[item.status] = item.count;
          return acc;
        },
        { ...EMPTY_STATUS_BREAKDOWN },
      ) ?? EMPTY_STATUS_BREAKDOWN,
    [run?.status_breakdown?.items],
  );

  const passed = statusBreakdown.passed;
  const error = statusBreakdown.error;
  const failure = statusBreakdown.failure;
  const blocked = statusBreakdown.blocked;
  const inProgress = statusBreakdown.in_progress;
  const skipped = statusBreakdown.skipped;
  const xfailed = statusBreakdown.xfailed;
  const xpassed = statusBreakdown.xpassed;
  const untested = statusBreakdown.untested;
  const total = summary.total;
  const planned = run?.planned_item_count;
  const completed = passed + error + failure + blocked + skipped + xfailed + xpassed;
  let progress = 0;
  if (planned != null && planned > 0) {
    progress = Math.min(100, Math.round((completed / planned) * 100));
  } else if (total > 0) {
    progress = Math.round((completed / total) * 100);
  }
  const decided = summary.error + summary.failure + passed + xfailed + xpassed;
  let passRate = 0;
  if (summary.pass_rate != null && Number.isFinite(summary.pass_rate)) {
    passRate = Math.round(summary.pass_rate);
  } else if (decided > 0) {
    passRate = Math.round((passed / decided) * 100);
  }
  const statusCounts = statusBreakdown;

  const progressSegments = useMemo(() => {
    const plannedCount = run?.planned_item_count;
    const usePlanned = plannedCount != null && plannedCount > 0;
    const pending = usePlanned ? Math.max(0, plannedCount - total) : 0;
    let breakdownTotal = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    if (usePlanned && plannedCount > 0) {
      breakdownTotal = plannedCount;
    } else if (total > 0) {
      breakdownTotal = total;
    }
    if (breakdownTotal === 0) return [];
    const rows = [
      { key: "passed", label: "Passed", count: statusCounts.passed, color: "bg-[var(--status-bar-passed)]" },
      { key: "error", label: "Error", count: statusCounts.error, color: "bg-[var(--status-bar-error)]" },
      { key: "failure", label: "Failure", count: statusCounts.failure, color: "bg-[var(--status-bar-failure)]" },
      { key: "blocked", label: "Blocked", count: statusCounts.blocked, color: "bg-[var(--status-bar-blocked)]" },
      {
        key: "in_progress",
        label: "In Progress",
        count: statusCounts.in_progress,
        color: "bg-[var(--status-bar-in-progress)]",
      },
      { key: "skipped", label: "Skipped", count: statusCounts.skipped, color: "bg-[var(--status-bar-skipped)]" },
      { key: "xfailed", label: "XFailed", count: statusCounts.xfailed, color: "bg-[var(--status-bar-xfailed)]" },
      { key: "xpassed", label: "XPassed", count: statusCounts.xpassed, color: "bg-[var(--status-bar-xpassed)]" },
      ...(usePlanned
        ? []
        : [{ key: "untested", label: "Untested", count: statusCounts.untested, color: "bg-[var(--status-bar-untested)]" }]),
      ...(pending > 0
        ? [{ key: "pending", label: "Untested", count: pending, color: "bg-[var(--status-bar-untested)]" }]
        : []),
    ]
      .filter((segment) => segment.count > 0)
      .map((segment) => ({
        ...segment,
        width: (segment.count / breakdownTotal) * 100,
      }));
    return rows;
  }, [statusCounts, total, run?.planned_item_count]);

  const rows = useMemo<RunOverviewRow[]>(
    () =>
      items.map((item) => ({
        id: item.id,
        testCaseId: item.test_case_id,
        key: item.test_case_key ?? item.test_case_id,
        title: item.test_case_title ?? item.comment ?? "Run item",
        status: item.status,
        time: item.time,
        assignee: item.assignee_name ?? (item.assignee_id ? "Unknown user" : "Unassigned"),
        lastExecuted: formatRelativeTime(item.last_executed_at),
        comment: item.comment,
        priority: item.test_case_priority ?? "medium",
        tags: item.test_case_tags ?? [],
        suite: item.suite_name ?? "Unsorted",
        externalIssues: item.external_issues ?? [],
      })),
    [items],
  );

  const runCaseIds = useMemo(() => items.map((item) => item.test_case_id), [items]);
  const hasMoreRunCases = hasNextPage ?? false;

  return {
    run,
    runCasesPageQuery,
    items,
    rows,
    runCaseIds,
    hasMoreRunCases,
    total,
    passed,
    error,
    failure,
    blocked,
    inProgress,
    skipped,
    xfailed,
    xpassed,
    untested,
    progress,
    passRate,
    progressSegments,
    handleLoadMoreRunCases,
  };
}
