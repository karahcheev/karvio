import { useMemo, useState } from "react";
import { Archive, Check, Play } from "lucide-react";
import {
  downloadRunReport,
  useImportJunitXmlMutation,
  useSetTestRunStatusMutation,
  type JunitImportDto,
  type RunReportExportFormat,
  type TestRunDto,
} from "@/shared/api";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import { getRunStatusText } from "@/modules/test-runs/utils/constants";

type UseTestRunHeaderActionsParams = {
  projectId: string | undefined;
  runId: string | undefined;
  run: TestRunDto | null;
};

export function useTestRunHeaderActions({ projectId, runId, run }: UseTestRunHeaderActionsParams) {
  const [reportExportLoadingFormat, setReportExportLoadingFormat] = useState<RunReportExportFormat | null>(null);
  const [junitImportOpen, setJunitImportOpen] = useState(false);
  const [selectedJunitFile, setSelectedJunitFile] = useState<File | null>(null);
  const [junitPreview, setJunitPreview] = useState<JunitImportDto | null>(null);
  const [createMissingCases, setCreateMissingCases] = useState(false);
  const setTestRunStatusMutation = useSetTestRunStatusMutation();
  const importJunitXmlMutation = useImportJunitXmlMutation();

  const nextRunStatusAction = useMemo(() => {
    if (!run) return null;
    if (run.status === "not_started") {
      return {
        key: "start" as const,
        label: "Start Run",
        loadingLabel: "Starting...",
        icon: <Play className="h-4 w-4" />,
        className: "bg-[var(--status-in-progress)] text-white hover:brightness-[0.92]",
      };
    }
    if (run.status === "in_progress") {
      return {
        key: "complete" as const,
        label: "Complete Run",
        loadingLabel: "Completing...",
        icon: <Check className="h-4 w-4" />,
        className: "bg-[var(--status-passed)] text-white hover:brightness-[0.92]",
      };
    }
    if (run.status === "completed") {
      return {
        key: "archive" as const,
        label: "Archive Run",
        loadingLabel: "Archiving...",
        icon: <Archive className="h-4 w-4" />,
        className: "bg-[var(--status-blocked)] text-white hover:brightness-[0.92]",
      };
    }
    return null;
  }, [run]);

  const handleRunStatusTransition = async () => {
    if (!run || !nextRunStatusAction) return;
    try {
      let status: "in_progress" | "completed" | "archived" = "archived";
      if (nextRunStatusAction.key === "start") {
        status = "in_progress";
      } else if (nextRunStatusAction.key === "complete") {
        status = "completed";
      }
      const updatedRun = await setTestRunStatusMutation.mutateAsync({ runId: run.id, status });
      notifySuccess(`Run status updated to ${getRunStatusText(updatedRun.status).toLowerCase()}`);
    } catch (error) {
      notifyError(error, "Failed to update run status.");
    }
  };

  const handleExportRunReport = async (format: RunReportExportFormat) => {
    if (!runId || reportExportLoadingFormat) return;

    try {
      setReportExportLoadingFormat(format);
      await downloadRunReport(runId, format);
      notifySuccess(`Report exported as ${format.toUpperCase()}.`);
    } catch (error) {
      notifyError(error, `Failed to export report as ${format.toUpperCase()}.`);
    } finally {
      setReportExportLoadingFormat(null);
    }
  };

  const handlePreviewJunitImport = async () => {
    if (!runId || !projectId || !selectedJunitFile) return;
    try {
      const preview = await importJunitXmlMutation.mutateAsync({
        runId,
        projectId,
        file: selectedJunitFile,
        dryRun: true,
        createMissingCases,
      });
      setJunitPreview(preview);
      notifySuccess("JUnit XML preview generated.");
    } catch (error) {
      notifyError(error, "Failed to preview JUnit XML import.");
    }
  };

  const handleImportJunitXml = async () => {
    if (!runId || !projectId || !selectedJunitFile) return;
    try {
      const result = await importJunitXmlMutation.mutateAsync({
        runId,
        projectId,
        file: selectedJunitFile,
        dryRun: false,
        createMissingCases,
      });
      setJunitPreview(result);
      notifySuccess(`JUnit XML imported. Updated ${result.summary.updated} run item(s).`);
    } catch (error) {
      notifyError(error, "Failed to import JUnit XML.");
    }
  };

  const handleCloseJunitImport = () => {
    if (importJunitXmlMutation.isPending) return;
    setJunitImportOpen(false);
    setSelectedJunitFile(null);
    setJunitPreview(null);
    setCreateMissingCases(false);
  };

  const handleJunitFileChange = (file: File | null) => {
    setSelectedJunitFile(file);
    setJunitPreview(null);
  };

  return {
    nextRunStatusAction,
    runStatusUpdateLoading: setTestRunStatusMutation.isPending,
    reportExportLoadingFormat,
    junitImportOpen,
    selectedJunitFile,
    junitPreview,
    createMissingCases,
    junitImportLoading: importJunitXmlMutation.isPending,
    handleRunStatusTransition,
    handleExportRunReport,
    setJunitImportOpen,
    setSelectedJunitFile: handleJunitFileChange,
    setCreateMissingCases,
    handlePreviewJunitImport,
    handleImportJunitXml,
    handleCloseJunitImport,
  };
}
