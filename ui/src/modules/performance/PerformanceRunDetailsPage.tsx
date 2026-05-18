import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { Archive, ArchiveRestore, CheckCircle2, Flag, FolderArchive, Gauge, Server } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPerformanceRun, getPerformanceRuns, patchPerformanceRun } from "@/shared/api";
import { getErrorMessage, notifyError, notifySuccess } from "@/shared/lib/notifications";
import { useUrlHashState } from "@/shared/lib/use-url-hash-state";
import {
  Button,
  CommonContent,
  CommonPage,
  DetailPageHeader,
  PageHeaderSection,
  StatusBadge,
  UrlHashTabs,
} from "@/shared/ui";
import { RUN_DETAIL_TABS, type RunDetailTab } from "./constants";
import { mapPerformanceRunDto } from "./mappers";
import {
  formatDateTime,
  getLoadKindLabel,
  getLoadKindTone,
  getRunLoadKind,
  getStatusLabel,
  getStatusTone,
} from "./perf-utils";
import { PerformanceRunArtifactsTab } from "./run-artifacts-tab";
import { PerformanceRunCompareTab } from "./run-compare-tab";
import { PerformanceRunEnvironmentTab } from "./run-environment-tab";
import { PerformanceRunOverviewTab } from "./run-overview-tab";

export function PerformanceRunDetailsModulePage() {
  const { projectId, runId } = useParams();
  const queryClient = useQueryClient();
  const [includeArchivedRunsForCompare, setIncludeArchivedRunsForCompare] = useState(false);
  const [tab, setTab] = useUrlHashState<RunDetailTab>({
    values: RUN_DETAIL_TABS,
    defaultValue: "overview",
    omitHashFor: "overview",
  });

  const runQuery = useQuery({
    queryKey: ["performance-run", runId],
    queryFn: async () => {
      if (!runId) {
        return null;
      }
      const run = await getPerformanceRun(runId);
      return mapPerformanceRunDto(run);
    },
    enabled: Boolean(runId),
  });

  const allRunsQuery = useQuery({
    queryKey: ["performance-runs", projectId, "all", includeArchivedRunsForCompare],
    queryFn: async () => {
      if (!projectId) {
        return [];
      }
      const runs = await getPerformanceRuns(projectId, {
        sortBy: "started_at",
        sortOrder: "desc",
        includeArchived: includeArchivedRunsForCompare,
      });
      return runs.map(mapPerformanceRunDto);
    },
    enabled: Boolean(projectId),
  });

  const run = runQuery.data ?? null;
  const archiveRunMutation = useMutation({
    mutationFn: async (payload: { runId: string; archived: boolean }) => {
      const dto = await patchPerformanceRun(payload.runId, { archived: payload.archived });
      return mapPerformanceRunDto(dto);
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["performance-run", variables.runId] }),
        queryClient.invalidateQueries({ queryKey: ["performance-runs"] }),
      ]);
      notifySuccess(variables.archived ? "Run archived." : "Run restored.");
    },
    onError: (error, variables) => {
      notifyError(error, variables.archived ? "Failed to archive run." : "Failed to restore run.");
    },
  });
  const markAsBaselineMutation = useMutation({
    mutationFn: async (targetRunId: string) => {
      const updated = await patchPerformanceRun(targetRunId, { mark_as_baseline: true });
      return mapPerformanceRunDto(updated);
    },
  });
  const compatibleRuns = useMemo(() => {
    if (!run) {
      return [];
    }
    const runLoadKind = getRunLoadKind(run);
    return (allRunsQuery.data ?? []).filter(
      (candidate) => candidate.id !== run.id && getRunLoadKind(candidate) === runLoadKind
    );
  }, [allRunsQuery.data, run]);

  if (!projectId) {
    return <Navigate to="/" replace />;
  }

  if (runQuery.isLoading) {
    return (
      <CommonPage>
        <PageHeaderSection title="Loading performance run..." subtitle="Fetching run details from backend" />
      </CommonPage>
    );
  }

  if (runQuery.error) {
    return (
      <CommonPage>
        <PageHeaderSection
          title="Failed to load performance run"
          subtitle={getErrorMessage(runQuery.error, "Unable to load selected performance run")}
        />
        <CommonContent>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <Button type="button" variant="secondary" size="md" asChild>
              <Link to={`/projects/${projectId}/performance`}>Back to Performance Runs</Link>
            </Button>
          </div>
        </CommonContent>
      </CommonPage>
    );
  }

  if (!run) {
    return (
      <CommonPage>
        <PageHeaderSection title="Performance run not found" subtitle="The selected run ID does not exist" />
        <CommonContent>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <Button type="button" variant="secondary" size="md" asChild>
              <Link to={`/projects/${projectId}/performance`}>Back to Performance Runs</Link>
            </Button>
          </div>
        </CommonContent>
      </CommonPage>
    );
  }

  const currentRun = run;
  const isTaggedBaseline = currentRun.baseline.policy === "tagged" && currentRun.baseline.ref === currentRun.id;
  const canMarkAsBaseline = currentRun.status === "completed" && !isTaggedBaseline;

  async function handleMarkAsBaseline() {
    try {
      await markAsBaselineMutation.mutateAsync(currentRun.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["performance-run", currentRun.id] }),
        queryClient.invalidateQueries({ queryKey: ["performance-runs", projectId] }),
      ]);
      notifySuccess("Run marked as baseline.");
    } catch (error) {
      notifyError(error, "Failed to mark run as baseline.");
    }
  }

  return (
    <CommonPage className="overflow-auto">
      <DetailPageHeader
        backLabel="Back to performance runs"
        backTo={`/projects/${projectId}/performance`}
        title={currentRun.name}
        titleTrailing={
          <>
            <StatusBadge tone={getStatusTone(currentRun.status)} withBorder>
              {getStatusLabel(currentRun.status)}
            </StatusBadge>
            <StatusBadge tone={getLoadKindTone(getRunLoadKind(currentRun))} withBorder>
              {getLoadKindLabel(getRunLoadKind(currentRun))}
            </StatusBadge>
            {currentRun.archived ? (
              <StatusBadge tone="neutral" withBorder>
                Archived
              </StatusBadge>
            ) : null}
          </>
        }
        meta={
          <>
            <span>{currentRun.service}</span>
            <span>{currentRun.env}</span>
            <span className="font-mono">{currentRun.commit}</span>
            <span>{currentRun.build}</span>
            <span>{formatDateTime(currentRun.startedAt)}</span>
          </>
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg bg-[var(--card)] hover:bg-[var(--muted)] dark:bg-[color-mix(in_srgb,var(--input),transparent_70%)] dark:hover:bg-[color-mix(in_srgb,var(--input),transparent_50%)]"
              leftIcon={<Flag className="h-4 w-4" />}
              onClick={() => void handleMarkAsBaseline()}
              disabled={!canMarkAsBaseline || markAsBaselineMutation.isPending}
            >
              {(() => {
                if (markAsBaselineMutation.isPending) return "Marking…";
                if (isTaggedBaseline) return "Baseline selected";
                return "Mark as baseline";
              })()}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg bg-[var(--card)] hover:bg-[var(--muted)] dark:bg-[color-mix(in_srgb,var(--input),transparent_70%)] dark:hover:bg-[color-mix(in_srgb,var(--input),transparent_50%)]"
              leftIcon={
                currentRun.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />
              }
              onClick={() =>
                archiveRunMutation.mutate({ runId: currentRun.id, archived: !currentRun.archived })
              }
              disabled={archiveRunMutation.isPending}
            >
              {(() => {
                if (archiveRunMutation.isPending) return "Saving…";
                if (currentRun.archived) return "Restore";
                return "Archive";
              })()}
            </Button>
          </>
        }
      />

      <UrlHashTabs
        className="border-t"
        activeTab={tab}
        onTabChange={setTab}
        items={[
          { value: "overview", label: "Overview", icon: <Gauge className="h-4 w-4" /> },
          { value: "environment", label: "Environment", icon: <Server className="h-4 w-4" /> },
          { value: "compare", label: "Compare", icon: <CheckCircle2 className="h-4 w-4" /> },
          { value: "artifacts", label: "Artifacts", icon: <FolderArchive className="h-4 w-4" /> },
        ]}
      />

      <CommonContent className="space-y-3 overflow-auto">

        {tab === "overview" ? <PerformanceRunOverviewTab run={currentRun} /> : null}
        {tab === "environment" ? <PerformanceRunEnvironmentTab run={currentRun} /> : null}
        {tab === "compare" ? (
          <PerformanceRunCompareTab
            run={currentRun}
            compatibleRuns={compatibleRuns}
            includeArchivedRuns={includeArchivedRunsForCompare}
            onIncludeArchivedRunsChange={setIncludeArchivedRunsForCompare}
          />
        ) : null}
        {tab === "artifacts" ? <PerformanceRunArtifactsTab run={currentRun} /> : null}
      </CommonContent>
    </CommonPage>
  );
}
