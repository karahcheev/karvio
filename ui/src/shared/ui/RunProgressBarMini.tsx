// Compact stacked progress bar + percent (test runs table, performance runs list, etc.).
import type { RunProgressBarModel } from "@/shared/lib/run-progress-bar-model";
import { cn } from "@/shared/lib/cn";

type RunProgressBarMiniProps = Readonly<
  Pick<RunProgressBarModel, "progress" | "segments"> & {
    className?: string;
    barClassName?: string;
  }
>;

export function RunProgressBarMini({ progress, segments, className, barClassName }: RunProgressBarMiniProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("flex h-2 w-24 shrink-0 overflow-hidden rounded-full bg-[var(--muted)]", barClassName)}>
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
      <span className="shrink-0 text-sm text-[var(--muted-foreground)]">{progress}%</span>
    </div>
  );
}
