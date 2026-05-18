// Test run overview: title, status transitions, add items, and report export.
import { Download, FileUp, Plus } from "lucide-react";
import { invokeMaybeAsync } from "@/shared/lib/invoke-maybe-async";
import type { TestRunDto } from "@/shared/api";
import { DetailPageHeader } from "@/shared/ui/DetailPageHeader";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/DropdownMenu";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { Button } from "@/shared/ui/Button";
import { canImportJunitIntoRun, getRunStatusTone, getRunStatusText } from "../constants";

type TestRunOverviewHeaderProps = Readonly<{
  projectId: string | undefined;
  run: TestRunDto | null;
  resolveUserName: (userId: string | null | undefined) => string;
  nextRunStatusAction: {
    key: "start" | "complete" | "archive";
    label: string;
    loadingLabel: string;
    icon: React.ReactNode;
    className: string;
  } | null;
  runStatusUpdateLoading: boolean;
  addRunItemsLoading: boolean;
  canAddRunItems: boolean;
  addableTestCasesCount: number | undefined;
  addRunItemsDisabledReason: string | undefined;
  reportExportLoadingFormat: string | null;
  junitImportLoading: boolean;
  onRunStatusTransition: () => void;
  onAddRunItemsClick: () => void;
  onImportJunitClick: () => void;
  onExportReport: (format: "json" | "pdf" | "xml") => void;
  formatRelativeTime: (date: string) => string;
}>;

export function TestRunOverviewHeader({
  projectId,
  run,
  resolveUserName,
  nextRunStatusAction,
  runStatusUpdateLoading,
  addRunItemsLoading,
  canAddRunItems,
  addableTestCasesCount,
  addRunItemsDisabledReason,
  reportExportLoadingFormat,
  junitImportLoading,
  onRunStatusTransition,
  onAddRunItemsClick,
  onImportJunitClick,
  onExportReport,
  formatRelativeTime,
}: TestRunOverviewHeaderProps) {
  return (
    <DetailPageHeader
      backLabel="Back to Test Runs"
      backTo={`/projects/${projectId}/test-runs`}
      title={run?.name ?? "Run Overview"}
      titleTrailing={
        <StatusBadge tone={run ? getRunStatusTone(run.status) : "neutral"} withBorder className="px-2">
          {run ? getRunStatusText(run.status) : "—"}
        </StatusBadge>
      }
      meta={
        <>
          <span>
            Environment{" "}
            {run?.environment_name
              ? `${run.environment_name}${run.environment_revision_number != null ? ` · r${run.environment_revision_number}` : ""}`
              : "—"}
          </span>
          <span>Build {run?.build ?? "—"}</span>
          <span>Created by {resolveUserName(run?.created_by)}</span>
          <span>Created {run ? formatRelativeTime(run.created_at) : "—"}</span>
        </>
      }
      actions={
        <div className="flex items-center gap-2">
          {nextRunStatusAction ? (
            <Button
              unstyled
              type="button"
              onClick={() => invokeMaybeAsync(() => onRunStatusTransition())}
              disabled={runStatusUpdateLoading}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 ${nextRunStatusAction.className}`}
            >
              {nextRunStatusAction.icon}
              {runStatusUpdateLoading ? nextRunStatusAction.loadingLabel : nextRunStatusAction.label}
            </Button>
          ) : null}
          <Button
            unstyled
            type="button"
            onClick={onImportJunitClick}
            disabled={!run || junitImportLoading || !canImportJunitIntoRun(run.status)}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileUp className="h-4 w-4" />
            {junitImportLoading ? "Importing..." : "Import JUnit"}
          </Button>
          <Button
            unstyled
            type="button"
            onClick={onAddRunItemsClick}
            disabled={addRunItemsLoading || !canAddRunItems || (addableTestCasesCount !== undefined && addableTestCasesCount === 0)}
            title={addRunItemsDisabledReason}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add Test Cases
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                unstyled
                type="button"
                disabled={!run || reportExportLoadingFormat !== null}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {reportExportLoadingFormat ? `Exporting ${reportExportLoadingFormat.toUpperCase()}...` : "Export"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                disabled={!run || reportExportLoadingFormat !== null}
                onClick={() => invokeMaybeAsync(() => onExportReport("json"))}
              >
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!run || reportExportLoadingFormat !== null}
                onClick={() => invokeMaybeAsync(() => onExportReport("pdf"))}
              >
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!run || reportExportLoadingFormat !== null}
                onClick={() => invokeMaybeAsync(() => onExportReport("xml"))}
              >
                Export as XML
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    />
  );
}
