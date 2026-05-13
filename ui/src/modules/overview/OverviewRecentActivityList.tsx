import { Play } from "lucide-react";
import type { RecentActivityItem } from "./use-overview-page-state";

type Props = Readonly<{
  items: RecentActivityItem[];
}>;

export function OverviewRecentActivityList({ items }: Props) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-[var(--foreground)]">Recent Activity</h2>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
        <div className="divide-y divide-border">
          {items.length === 0 ? (
            <div className="p-3 text-sm text-[var(--muted-foreground)]">No recent activity</div>
          ) : (
            items.map((run) => (
              <div className="p-3" key={run.id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-[var(--highlight-bg)] p-2">
                      <Play className="h-4 w-4 text-[var(--highlight-foreground)]" />
                    </div>
                    <div>
                      <div className="font-medium text-[var(--foreground)]">{run.name}</div>
                      <div className="text-sm text-[var(--muted-foreground)]">
                        {run.status} • Build {run.build ?? "-"}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-[var(--muted-foreground)]">{new Date(run.updated_at).toLocaleString()}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
