import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { AlertTriangle, FileUp, Upload } from "lucide-react";
import {
  createPerformanceImport,
  getPerformanceImport,
  type PerformanceImportStatusDto,
  validatePerformanceImport,
} from "@/shared/api";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import { Button } from "@/shared/ui/Button";
import { Loader } from "@/shared/ui/Loader";
import { AppModal, StandardModalLayout } from "@/shared/ui/Modal";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { mapImportDto, mapPreflightDto } from "./mappers";
import { getParseStatusLabel, getParseStatusTone } from "./perf-utils";
import type { PerfImportRecord } from "./types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

type ImportPerformanceArtifactModalProps = Readonly<{
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}>;

export function ImportPerformanceArtifactModal({ projectId, isOpen, onClose }: ImportPerformanceArtifactModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [preflightResult, setPreflightResult] = useState<PerfImportRecord | null>(null);
  const [importStatus, setImportStatus] = useState<PerformanceImportStatusDto | null>(null);
  const [importDetails, setImportDetails] = useState<PerfImportRecord | null>(null);
  const [importFlowBusy, setImportFlowBusy] = useState(false);

  const preflightMutation = useMutation({
    mutationFn: async ({ projectId: pid, file }: { projectId: string; file: File }) => {
      const result = await validatePerformanceImport(pid, { file });
      return mapPreflightDto(result);
    },
  });

  const createImportMutation = useMutation({
    mutationFn: ({ projectId: pid, file }: { projectId: string; file: File }) =>
      createPerformanceImport(pid, { file }),
  });

  useEffect(() => {
    if (!isOpen) {
      setImportFile(null);
      setPreflightResult(null);
      setImportStatus(null);
      setImportDetails(null);
      setImportFlowBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [isOpen]);

  const isBusy = preflightMutation.isPending || createImportMutation.isPending || importFlowBusy;
  const previewPayload = preflightResult ?? importDetails;

  function handleRequestClose() {
    if (isBusy) return;
    onClose();
  }

  async function runPreflight(file: File) {
    try {
      const result = await preflightMutation.mutateAsync({ projectId, file });
      setPreflightResult(result);
    } catch (error) {
      notifyError(error, "Failed to check file.");
    }
  }

  async function handleImport() {
    if (!importFile) return;

    setImportFlowBusy(true);
    try {
      const accepted = await createImportMutation.mutateAsync({ projectId, file: importFile });
      setImportStatus(accepted.status);
      notifySuccess("Import queued for asynchronous processing.");

      let terminalStatus: PerformanceImportStatusDto | null = null;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const importItem = await getPerformanceImport(accepted.import_id);
        setImportStatus(importItem.status);
        setImportDetails(mapImportDto(importItem));
        if (importItem.status !== "pending" && importItem.status !== "processing") {
          terminalStatus = importItem.status;
          break;
        }
        await sleep(1000);
      }

      if (terminalStatus === "failed") {
        notifyError(new Error("Import finished with failures."), "Import finished with failures.");
      } else if (terminalStatus === "partial") {
        notifySuccess("Import finished as partial. Review missing fields in details.");
      } else if (terminalStatus === "completed") {
        notifySuccess("Import completed.");
      }

      await queryClient.invalidateQueries({ queryKey: ["performance-runs", projectId] });
      onClose();
      navigate(`/projects/${projectId}/performance/${accepted.run_id}#overview`);
    } catch (error) {
      notifyError(error, "Failed to create performance import.");
    } finally {
      setImportFlowBusy(false);
    }
  }

  return (
    <AppModal
      isOpen={isOpen}
      onClose={handleRequestClose}
      closeOnOverlayClick={!isBusy}
      closeOnEscape={!isBusy}
      contentClassName="flex max-h-[90vh] max-w-3xl flex-col rounded-xl"
    >
      <StandardModalLayout
        title="Import performance results"
        description="Upload a k6 JSON, pytest-benchmark JSON, Locust CSV, or zip artifact to create a performance run."
        onClose={handleRequestClose}
        closeButtonDisabled={isBusy}
        footer={
          <>
            <Button
              unstyled
              type="button"
              onClick={handleRequestClose}
              disabled={isBusy}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-50"
            >
              Cancel
            </Button>
            <Button
              unstyled
              type="button"
              onClick={() => void handleImport()}
              disabled={!importFile || isBusy}
              className="flex items-center gap-2 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] disabled:opacity-50"
            >
              <FileUp className="h-4 w-4" />
              {importFlowBusy || createImportMutation.isPending ? "Importing…" : "Import Results"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.json,.csv,.txt,.html,.htm"
            disabled={isBusy}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setImportFile(file);
              setPreflightResult(null);
              setImportDetails(null);
              setImportStatus(null);
              if (file) void runPreflight(file);
            }}
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
            className="w-full rounded-lg border-2 border-dashed border-[var(--border)] p-6 text-center transition-colors hover:border-[var(--highlight-foreground)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importFile ? (
              <div className="flex flex-col items-center gap-2">
                <FileUp className="h-8 w-8 text-[var(--highlight-foreground)]" />
                <span className="text-sm font-medium text-[var(--foreground)]">{importFile.name}</span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {Math.round(importFile.size / 1024)} KB · Click to choose a different file
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-[var(--muted-foreground)]" />
                <span className="text-sm font-medium text-[var(--foreground)]">Click to choose an artifact file</span>
                <span className="text-xs text-[var(--muted-foreground)]">k6 JSON, pytest-benchmark JSON, Locust CSV, or zip</span>
              </div>
            )}
          </button>

          {importFile ? (
            preflightMutation.isPending ? (
              <Loader label="Checking file…" className="py-4" />
            ) : previewPayload ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2">
                  <span className="text-[var(--muted-foreground)]">Detected adapter</span>
                  <span className="font-medium text-[var(--foreground)]">
                    {previewPayload.adapter}@{previewPayload.adapterVersion}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2">
                  <span className="text-[var(--muted-foreground)]">Confidence</span>
                  <span className="font-medium text-[var(--foreground)]">{Math.round(previewPayload.confidence * 100)}%</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2">
                  <span className="text-[var(--muted-foreground)]">Parse status</span>
                  <StatusBadge tone={getParseStatusTone(previewPayload.parseStatus)} withBorder>
                    {getParseStatusLabel(previewPayload.parseStatus)}
                  </StatusBadge>
                </div>
                {previewPayload.found.length > 0 ? (
                  <div className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Found parts</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {previewPayload.found.map((part) => (
                        <StatusBadge key={part} tone="success" withBorder>
                          {part}
                        </StatusBadge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {previewPayload.missing.length > 0 ? (
                  <div className="rounded-md border border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg-soft)] px-3 py-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--tone-warning-text)]">Missing parts</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {previewPayload.missing.map((part) => (
                        <StatusBadge key={part} tone="warning" withBorder>
                          {part}
                        </StatusBadge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null
          ) : null}

          {previewPayload?.issues.length ? (
            <div className="rounded-lg border border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg-soft)] px-3 py-3 text-sm text-[var(--tone-warning-text)]">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Import issues</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {previewPayload.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          {importStatus ? (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)]">
              Import status: <span className="font-medium">{importStatus}</span>
            </div>
          ) : null}
        </div>
      </StandardModalLayout>
    </AppModal>
  );
}
