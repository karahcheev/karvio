import { useEffect, useMemo, useState } from "react";
import { GitCompare, Pencil, Save, Share2, X } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { getPerformanceRun, type PerformanceComparisonDto } from "@/shared/api";
import { Button, EmptyState, Loader, StatusBadge } from "@/shared/ui";
import { mapPerformanceRunDto } from "./mappers";
import { CompareRunsPickerModal } from "./compare-runs-picker-modal";
import { PerformanceComparisonView } from "./comparison-view";
import { MAX_COMPARE_RUNS } from "./constants";
import {
  deriveCompareMetricOptions,
  getLoadKindLabel,
  getLoadKindTone,
  getRunLoadKind,
} from "./perf-utils";
import { SaveComparisonDialog } from "./save-comparison-dialog";
import type { CompareMetricKey, PerfRun } from "./types";

export function PerformanceRunCompareTab({
  run,
  compatibleRuns,
  includeArchivedRuns,
  onIncludeArchivedRunsChange,
}: Readonly<{
  run: PerfRun;
  compatibleRuns: PerfRun[];
  includeArchivedRuns: boolean;
  onIncludeArchivedRunsChange: (value: boolean) => void;
}>) {
  const loadKind = getRunLoadKind(run);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [savedComparison, setSavedComparison] = useState<PerformanceComparisonDto | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<CompareMetricKey>("throughput");
  const [selectedCompareRunIds, setSelectedCompareRunIds] = useState<string[]>([]);

  // Drop selections that are no longer compatible (e.g. load type changed, archive visibility toggled).
  useEffect(() => {
    const compatibleIds = new Set(compatibleRuns.map((item) => item.id));
    setSelectedCompareRunIds((prev) => prev.filter((id) => compatibleIds.has(id)));
  }, [compatibleRuns]);

  // The /perf/runs list is lightweight (no transactions). For per-transaction comparison we need
  // full run details, so fetch each selected compare run by id.
  const compareRunDetailQueries = useQueries({
    queries: selectedCompareRunIds.map((id) => ({
      queryKey: ["performance-run", id],
      queryFn: async () => mapPerformanceRunDto(await getPerformanceRun(id)),
    })),
  });

  const selectedCompareRuns = useMemo(() => {
    const fallbackById = new Map(compatibleRuns.map((item) => [item.id, item]));
    return selectedCompareRunIds
      .map((id, index) => compareRunDetailQueries[index]?.data ?? fallbackById.get(id))
      .filter((item): item is PerfRun => Boolean(item));
  }, [compareRunDetailQueries, compatibleRuns, selectedCompareRunIds]);

  const isLoadingCompareDetails = compareRunDetailQueries.some((query) => query.isLoading);

  const runsInComparison = useMemo(
    () => [run, ...selectedCompareRuns].slice(0, MAX_COMPARE_RUNS),
    [run, selectedCompareRuns],
  );

  // Snap selectedMetric to a still-valid option whenever the comparison changes.
  const metricOptions = useMemo(() => deriveCompareMetricOptions(runsInComparison), [runsInComparison]);
  useEffect(() => {
    if (metricOptions.length === 0) return;
    if (!metricOptions.some((option) => option.key === selectedMetric)) {
      setSelectedMetric(metricOptions[0].key);
    }
  }, [metricOptions, selectedMetric]);

  // Saving locks in the current selection — any subsequent edit invalidates the saved snapshot link.
  useEffect(() => {
    if (!savedComparison) return;
    const sameRuns =
      savedComparison.compare_run_ids.length === selectedCompareRunIds.length &&
      savedComparison.compare_run_ids.every((id, idx) => selectedCompareRunIds[idx] === id);
    const sameMetric = savedComparison.metric_key === selectedMetric;
    if (!sameRuns || !sameMetric) {
      setSavedComparison(null);
    }
  }, [savedComparison, selectedCompareRunIds, selectedMetric]);

  const handleConfirmPicker = (ids: string[]) => {
    setSelectedCompareRunIds(ids);
    setIsPickerOpen(false);
  };

  const handleRemoveCompareRun = (runId: string) => {
    setSelectedCompareRunIds((prev) => prev.filter((id) => id !== runId));
  };

  if (selectedCompareRuns.length === 0) {
    return (
      <>
        <EmptyState
          className="min-h-72"
          title={
            <span className="inline-flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-[var(--highlight-foreground)]" />
              Compare this run with others
            </span>
          }
          description={
            <>
              Pick up to {MAX_COMPARE_RUNS - 1} runs of the same load type (
              <StatusBadge tone={getLoadKindTone(loadKind)} withBorder>
                {getLoadKindLabel(loadKind)}
              </StatusBadge>
              ) to see throughput, latency and error-rate side by side. You can save the comparison and share it with a
              public link.
            </>
          }
          actions={
            <Button
              type="button"
              variant="primary"
              size="md"
              leftIcon={<GitCompare className="h-4 w-4" />}
              onClick={() => setIsPickerOpen(true)}
              disabled={compatibleRuns.length === 0}
            >
              Add runs to compare
            </Button>
          }
        />
        {compatibleRuns.length === 0 ? (
          <p className="mt-3 text-center text-xs text-[var(--muted-foreground)]">
            No other {getLoadKindLabel(loadKind)} runs found in this project yet.
          </p>
        ) : null}

        <CompareRunsPickerModal
          isOpen={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          baseRun={run}
          candidateRuns={compatibleRuns}
          initiallySelectedIds={selectedCompareRunIds}
          includeArchivedRuns={includeArchivedRuns}
          onIncludeArchivedRunsChange={onIncludeArchivedRunsChange}
          onConfirm={handleConfirmPicker}
        />
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Comparing
            </span>
            <RunChip label={`#1 ${run.name} (base)`} />
            {selectedCompareRuns.map((compareRun, idx) => (
              <RunChip
                key={compareRun.id}
                label={`#${idx + 2} ${compareRun.name}`}
                onRemove={() => handleRemoveCompareRun(compareRun.id)}
              />
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<Pencil className="h-4 w-4" />}
              onClick={() => setIsPickerOpen(true)}
            >
              Edit selection
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {savedComparison ? (
              <Button
                type="button"
                variant="secondary"
                size="md"
                leftIcon={<Share2 className="h-4 w-4" />}
                onClick={() => setIsSaveDialogOpen(true)}
              >
                Manage share
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="md"
                leftIcon={<Save className="h-4 w-4" />}
                onClick={() => setIsSaveDialogOpen(true)}
              >
                Save & share
              </Button>
            )}
          </div>
        </div>
      </div>

      {isLoadingCompareDetails ? (
        <div className="flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] py-10">
          <Loader label="Loading run details…" />
        </div>
      ) : (
        <PerformanceComparisonView
          runs={runsInComparison}
          metricKey={selectedMetric}
          onMetricKeyChange={setSelectedMetric}
          projectId={run.projectId}
        />
      )}

      <CompareRunsPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        baseRun={run}
        candidateRuns={compatibleRuns}
        initiallySelectedIds={selectedCompareRunIds}
        includeArchivedRuns={includeArchivedRuns}
        onIncludeArchivedRunsChange={onIncludeArchivedRunsChange}
        onConfirm={handleConfirmPicker}
      />

      <SaveComparisonDialog
        isOpen={isSaveDialogOpen}
        onClose={() => setIsSaveDialogOpen(false)}
        projectId={run.projectId ?? ""}
        baseRunId={run.id}
        compareRunIds={selectedCompareRunIds}
        metricKey={selectedMetric}
        initialComparison={savedComparison}
        onSaved={(comparison) => setSavedComparison(comparison)}
      />
    </div>
  );
}

function RunChip({
  label,
  onRemove,
}: Readonly<{
  label: string;
  onRemove?: () => void;
}>) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--muted)] px-2 py-0.5 text-xs font-medium text-[var(--foreground)]">
      <span className="font-mono">{label}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="rounded-full p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}
