import type { TestRunsSortBy } from "@/shared/api";
import type { TestRunColumn, RunView } from "@/modules/test-runs/components";
import type { TestRunDto } from "@/shared/api";

export function uniqueIds(items: string[]): string[] {
  return Array.from(new Set(items));
}

export function mapTestRunSorting(column: TestRunColumn): TestRunsSortBy | null {
  switch (column) {
    case "name":
      return "name";
    case "build":
      return "build";
    case "environment":
      return "environment";
    case "status":
      return "status";
    case "created":
      return "created_at";
    case "milestone":
    case "progress":
    case "passRate":
      return null;
  }
}

export function mapTestRunToView(run: TestRunDto): RunView {
  const summary = run.summary ?? {
    total: 0,
    passed: 0,
    error: 0,
    failure: 0,
    blocked: 0,
    in_progress: 0,
    skipped: 0,
    xfailed: 0,
    xpassed: 0,
    pass_rate: 0,
  };
  const completed =
    summary.passed +
    summary.error +
    summary.failure +
    summary.blocked +
    summary.skipped +
    (summary.xfailed ?? 0) +
    (summary.xpassed ?? 0);
  const planned = run.planned_item_count;
  let progress = 0;
  if (run.status !== "not_started") {
    if (planned != null && planned > 0) {
      progress = Math.min(100, Math.round((completed / planned) * 100));
    } else if (summary.total > 0) {
      progress = Math.round((completed / summary.total) * 100);
    }
  }

  const decided =
    summary.passed + summary.error + summary.failure + (summary.xfailed ?? 0) + (summary.xpassed ?? 0);
  let passRate = 0;
  if (summary.pass_rate != null && Number.isFinite(summary.pass_rate)) {
    passRate = Math.round(summary.pass_rate);
  } else if (decided > 0) {
    passRate = Math.round((summary.passed / decided) * 100);
  }

  return {
    ...run,
    total: summary.total,
    passed: summary.passed,
    error: summary.error,
    failure: summary.failure,
    blocked: summary.blocked,
    inProgress: summary.in_progress ?? 0,
    skipped: summary.skipped,
    xfailed: summary.xfailed ?? 0,
    xpassed: summary.xpassed ?? 0,
    passRate,
    progress,
  };
}
