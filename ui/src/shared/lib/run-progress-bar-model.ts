// Props for RunProgressBar / RunProgressBarMini derived from aggregate run counts (list row, side panel, etc.).

export type RunProgressBarCounts = {
  progress: number;
  passed: number;
  error: number;
  failure: number;
  blocked: number;
  inProgress?: number;
  skipped: number;
  xfailed?: number;
  xpassed?: number;
  total: number;
  planned_item_count?: number | null;
};

export type RunProgressBarSegment = {
  key: string;
  label: string;
  count: number;
  color: string;
  width: number;
};

export type RunProgressBarModel = {
  progress: number;
  passRate: number;
  segments: RunProgressBarSegment[];
};

/** Segments and pass rate for RunProgressBar (matches mini progress column in the runs table). */
export function getRunProgressBarModel(run: RunProgressBarCounts): RunProgressBarModel {
  const total = run.total;
  const planned = run.planned_item_count;
  const usePlanned = planned != null && planned > 0;
  const denom = usePlanned ? planned : total;
  const xf = run.xfailed ?? 0;
  const xp = run.xpassed ?? 0;
  const inProgress = run.inProgress ?? 0;
  const untested = Math.max(
    total - (run.passed + run.error + run.failure + run.blocked + inProgress + run.skipped + xf + xp),
    0,
  );
  const pending = usePlanned ? Math.max(0, planned - total) : 0;
  const raw =
    denom <= 0
      ? []
      : [
          { key: "passed", label: "Passed", count: run.passed, color: "bg-[var(--status-bar-passed)]" },
          { key: "error", label: "Error", count: run.error, color: "bg-[var(--status-bar-error)]" },
          { key: "failure", label: "Failure", count: run.failure, color: "bg-[var(--status-bar-failure)]" },
          { key: "blocked", label: "Blocked", count: run.blocked, color: "bg-[var(--status-bar-blocked)]" },
          { key: "in_progress", label: "In Progress", count: inProgress, color: "bg-[var(--status-bar-in-progress)]" },
          { key: "skipped", label: "Skipped", count: run.skipped, color: "bg-[var(--status-bar-skipped)]" },
          { key: "xfailed", label: "XFailed", count: xf, color: "bg-[var(--status-bar-xfailed)]" },
          { key: "xpassed", label: "XPassed", count: xp, color: "bg-[var(--status-bar-xpassed)]" },
          ...(usePlanned
            ? []
            : [{ key: "untested", label: "Untested", count: untested, color: "bg-[var(--status-bar-untested)]" }]),
          ...(pending > 0
            ? [{ key: "pending", label: "Untested", count: pending, color: "bg-[var(--status-bar-untested)]" }]
            : []),
        ].filter((segment) => segment.count > 0);
  const segments = raw.map((segment) => ({
    ...segment,
    width: denom > 0 ? (segment.count / denom) * 100 : 0,
  }));
  const decided = run.passed + run.error + run.failure + xf + xp;
  const passRate = decided > 0 ? Math.round((run.passed / decided) * 100) : 0;
  return { progress: run.progress, passRate, segments };
}
