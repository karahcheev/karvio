// Stacked bar and legend for run progress and pass rate.
import type { RunProgressBarModel } from "@/shared/lib/run-progress-bar-model";
import { cn } from "@/shared/lib/cn";

export type { RunProgressBarModel, RunProgressBarSegment } from "@/shared/lib/run-progress-bar-model";

type RunProgressBarProps = Readonly<
  RunProgressBarModel & {
    className?: string;
  }
>;

export function RunProgressBar({ progress, passRate, segments, className }: RunProgressBarProps) {
  return (
    <div className={cn("mt-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3", className)}>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-[var(--muted-foreground)]">Overall Progress</span>
        <span className="font-medium text-[var(--foreground)]">{progress}% Complete</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-[var(--muted)]">
        {segments.length === 0 ? (
          <div className="h-full w-full bg-[var(--muted)]" />
        ) : (
          segments.map((segment) => (
            <div
              key={segment.key}
              className={`h-full ${segment.color}`}
              style={{ width: `${segment.width}%` }}
              title={`${segment.label}: ${segment.count}`}
            />
          ))
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
        {segments.map((segment) => (
          <div key={segment.key} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${segment.color}`} />
            <span>
              {segment.label}: {segment.count}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-[var(--muted-foreground)]">Pass Rate: {passRate}%</span>
      </div>
    </div>
  );
}
