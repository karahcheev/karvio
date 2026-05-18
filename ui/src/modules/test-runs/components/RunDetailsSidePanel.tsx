// Side panel: run summary, progress counts, and primary actions.
import { Archive, Check, ExternalLink, FileUp, Play } from "lucide-react";
import { invokeMaybeAsync } from "@/shared/lib/invoke-maybe-async";
import type { TestRunDto } from "@/shared/api";
import {
  DetailsSection,
  EntityDetailsPanelLayout,
  MetaInfoCard,
} from "@/shared/ui/EntityDetailsPanelLayout";
import { getRunProgressBarModel } from "@/shared/lib/run-progress-bar-model";
import { RunProgressBar } from "./RunProgressBar";
import { StatusBadge, type StatusBadgeTone } from "@/shared/ui/StatusBadge";
import { Button } from "@/shared/ui/Button";
import { canImportJunitIntoRun } from "@/modules/test-runs/constants";

export interface RunDetailsSidePanelRun extends TestRunDto {
  progress: number;
  passed: number;
  error: number;
  failure: number;
  blocked: number;
  inProgress: number;
  skipped: number;
  xfailed: number;
  xpassed: number;
  passRate: number;
  total: number;
}

// Status display helpers
function getStatusTone(status: string): StatusBadgeTone {
  if (status === "in_progress") return "info";
  if (status === "completed") return "success";
  if (status === "archived") return "warning";
  return "neutral";
}

function getStatusText(status: string) {
  if (status === "in_progress") return "In Progress";
  if (status === "not_started") return "Not started";
  if (status === "completed") return "Completed";
  if (status === "archived") return "Archived";
  return status;
}

export function getRunFlowAction(status: TestRunDto["status"]) {
  if (status === "not_started") {
    return {
      key: "start" as const,
      label: "Start",
      icon: <Play className="h-3.5 w-3.5" />,
      className: "bg-[var(--status-in-progress)] text-white hover:brightness-[0.92]",
      successMessage: "started",
    };
  }
  if (status === "in_progress") {
    return {
      key: "complete" as const,
      label: "Complete",
      icon: <Check className="h-3.5 w-3.5" />,
      className: "bg-[var(--status-passed)] text-white hover:brightness-[0.92]",
      successMessage: "completed",
    };
  }
  if (status === "completed") {
    return {
      key: "archive" as const,
      label: "Archive",
      icon: <Archive className="h-3.5 w-3.5" />,
      className: "bg-[var(--status-blocked)] text-white hover:brightness-[0.92]",
      successMessage: "archived",
    };
  }
  return null;
}

type RunDetailsSidePanelProps = Readonly<{
  run: RunDetailsSidePanelRun;
  onClose: () => void;
  onOpenFull: (runId: string) => void;
  onRunFlowAction: (run: RunDetailsSidePanelRun) => void;
  onImportJunit: () => void;
  actionRunId: string | null;
  resolveUserName: (userId: string | null | undefined) => string;
}>;

export function RunDetailsSidePanel({
  run,
  onClose,
  onOpenFull,
  onRunFlowAction,
  onImportJunit,
  actionRunId,
  resolveUserName,
}: RunDetailsSidePanelProps) {
  // Next action for current run status (start/complete/archive)
  const flowAction = getRunFlowAction(run.status);

  return (
    <EntityDetailsPanelLayout
      title={run.name}
      onClose={onClose}
      actions={
        <>
          {flowAction ? (
            <Button
              unstyled
              type="button"
              onClick={() => invokeMaybeAsync(() => onRunFlowAction(run))}
              disabled={actionRunId === run.id}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${flowAction.className}`}
            >
              {flowAction.icon}
              {actionRunId === run.id
                ? `${flowAction.label}...`
                : flowAction.label}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="panel"
            onClick={onImportJunit}
            disabled={!canImportJunitIntoRun(run.status)}
          >
            <FileUp className="h-3.5 w-3.5" />
            Import JUnit
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="panel"
            onClick={() => onOpenFull(run.id)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open
          </Button>
        </>
      }
    >
      <DetailsSection title="Metadata">
        <MetaInfoCard
          rows={[
            { label: "ID", value: run.id },
            { label: "Status", value: 
              <StatusBadge tone={getStatusTone(run.status)} withBorder>
              {getStatusText(run.status)}
              </StatusBadge> },
            {
              label: "Environment",
              value: run.environment_name
                ? `${run.environment_name}${run.environment_revision_number != null ? ` · r${run.environment_revision_number}` : ""}`
                : "—",
            },
            { label: "Build", value: run.build ?? "—" },
            { label: "Created by", value: resolveUserName(run.created_by) },
            {
              label: "Created",
              value: new Date(run.created_at).toLocaleString(),
            },
          ]}
        />
      </DetailsSection>
      <DetailsSection title="Progress">
        <RunProgressBar {...getRunProgressBarModel(run)} className="mt-0" />
      </DetailsSection>
    </EntityDetailsPanelLayout>
  );
}
