import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { Share2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPerformanceComparison, type PerformanceComparisonDto } from "@/shared/api";
import {
  Button,
  CommonContent,
  CommonPage,
  DetailPageHeader,
  PageHeaderSection,
} from "@/shared/ui";
import { getErrorMessage } from "@/shared/lib/notifications";
import { PerformanceComparisonView } from "./comparison-view";
import { mapPerformanceRunDto } from "./mappers";
import { SaveComparisonDialog } from "./save-comparison-dialog";
import type { CompareMetricKey } from "./types";

export function PerformanceComparisonPage() {
  const { projectId, comparisonId } = useParams();
  const queryClient = useQueryClient();
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  const comparisonQuery = useQuery({
    queryKey: ["performance-comparison", comparisonId],
    queryFn: async () => {
      if (!comparisonId) return null;
      return getPerformanceComparison(comparisonId);
    },
    enabled: Boolean(comparisonId),
  });

  const comparison = comparisonQuery.data ?? null;
  const savedMetricKey = (comparison?.metric_key ?? "throughput") as CompareMetricKey;
  const [metricKey, setMetricKey] = useState<CompareMetricKey>(savedMetricKey);
  // Reset the local metric pick when a different saved comparison is loaded.
  useEffect(() => {
    if (comparison?.metric_key) {
      setMetricKey(comparison.metric_key as CompareMetricKey);
    }
  }, [comparison?.id, comparison?.metric_key]);
  const runs = useMemo(
    () => (comparison?.snapshot.runs ?? []).map(mapPerformanceRunDto),
    [comparison],
  );

  if (!projectId) {
    return <Navigate to="/" replace />;
  }

  if (comparisonQuery.isLoading) {
    return (
      <CommonPage>
        <PageHeaderSection title="Loading comparison..." subtitle="Fetching saved comparison" />
      </CommonPage>
    );
  }

  if (comparisonQuery.error || !comparison) {
    return (
      <CommonPage>
        <PageHeaderSection
          title="Comparison not found"
          subtitle={getErrorMessage(comparisonQuery.error, "The selected comparison does not exist or was deleted")}
        />
        <CommonContent>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <Button type="button" variant="secondary" size="md" asChild>
              <Link to={`/projects/${projectId}/performance`}>Back to performance runs</Link>
            </Button>
          </div>
        </CommonContent>
      </CommonPage>
    );
  }

  const title = comparison.name?.trim() || `Comparison ${comparison.id}`;

  return (
    <CommonPage className="overflow-auto">
      <DetailPageHeader
        backLabel="Back to performance runs"
        backTo={`/projects/${projectId}/performance`}
        title={title}
        meta={
          <>
            <span>{runs.length} runs</span>
            <span>Snapshot · saved {new Date(comparison.created_at).toLocaleString()}</span>
            {comparison.public_token ? <span>Public link enabled</span> : null}
          </>
        }
        actions={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<Share2 className="h-4 w-4" />}
            onClick={() => setIsShareDialogOpen(true)}
          >
            Share
          </Button>
        }
      />

      <CommonContent className="space-y-3 overflow-auto">
        <PerformanceComparisonView
          runs={runs}
          metricKey={metricKey}
          onMetricKeyChange={setMetricKey}
          projectId={projectId}
        />
      </CommonContent>

      <SaveComparisonDialog
        isOpen={isShareDialogOpen}
        onClose={() => setIsShareDialogOpen(false)}
        projectId={comparison.project_id}
        baseRunId={comparison.base_run_id}
        compareRunIds={comparison.compare_run_ids}
        metricKey={savedMetricKey}
        initialComparison={comparison}
        onSaved={(updated: PerformanceComparisonDto) => {
          queryClient.setQueryData(["performance-comparison", comparisonId], updated);
        }}
      />
    </CommonPage>
  );
}
