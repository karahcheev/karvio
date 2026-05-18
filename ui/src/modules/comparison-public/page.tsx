import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { GitCompare } from "lucide-react";
import { getPublicPerformanceComparison } from "@/shared/api";
import { Loader } from "@/shared/ui";
import { PerformanceComparisonView } from "@/modules/performance/comparison-view";
import { mapPerformanceRunDto } from "@/modules/performance/mappers";
import type { CompareMetricKey } from "@/modules/performance/types";

export function PublicPerformanceComparisonPage() {
  const { token } = useParams();
  const query = useQuery({
    queryKey: ["public-performance-comparison", token],
    queryFn: async () => {
      if (!token) return null;
      return getPublicPerformanceComparison(token);
    },
    enabled: Boolean(token),
    retry: false,
  });

  const comparison = query.data ?? null;
  const [metricKey, setMetricKey] = useState<CompareMetricKey>("throughput");
  // Adopt the snapshot's saved metric as the initial selection; viewer can switch locally.
  useEffect(() => {
    if (comparison?.metric_key) {
      setMetricKey(comparison.metric_key as CompareMetricKey);
    }
  }, [comparison?.id, comparison?.metric_key]);
  const runs = useMemo(
    () => (comparison?.snapshot.runs ?? []).map(mapPerformanceRunDto),
    [comparison],
  );

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] bg-[var(--card)] px-6 py-4">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-2">
          <GitCompare className="h-5 w-5 text-[var(--highlight-foreground)]" />
          <h1 className="text-base font-semibold">
            {comparison?.name?.trim() || "Performance comparison"}
          </h1>
          {comparison ? (
            <span className="ml-auto text-xs text-[var(--muted-foreground)]">
              Shared snapshot · {new Date(comparison.created_at).toLocaleString()}
            </span>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-screen-2xl space-y-3 px-6 py-6">
        {query.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader />
          </div>
        ) : query.error || !comparison ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-6 py-8 text-center">
            <h2 className="text-base font-semibold">Comparison unavailable</h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              This share link is invalid or the comparison is no longer public.
            </p>
          </div>
        ) : runs.length === 0 ? (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-6 py-8 text-center text-sm text-[var(--muted-foreground)]">
            This comparison has no runs.
          </p>
        ) : (
          <PerformanceComparisonView runs={runs} metricKey={metricKey} onMetricKeyChange={setMetricKey} />
        )}
      </main>
    </div>
  );
}
