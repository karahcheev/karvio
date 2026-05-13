import { Download, FolderArchive } from "lucide-react";
import { downloadPerformanceArtifact } from "@/shared/api";
import { notifyError } from "@/shared/lib/notifications";
import { Button, StatusBadge } from "@/shared/ui";
import { formatDateTime } from "./perf-utils";
import { getArtifactIcon } from "./perf-ui";
import type { PerfRun } from "./types";

export function PerformanceRunArtifactsTab({ run }: Readonly<{ run: PerfRun }>) {
  const readyArtifactsCount = run.artifacts.filter((artifact) => artifact.status === "ready").length;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--foreground)]">
        <div className="flex items-start gap-2">
          <FolderArchive className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
          <p>
            Original artifacts are retained for this run. Available for download: {readyArtifactsCount}/{run.artifacts.length}.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {run.artifacts.map((artifact) => (
          <div key={artifact.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {getArtifactIcon(artifact.type)}
                  <p className="truncate text-sm font-semibold text-[var(--foreground)]">{artifact.label}</p>
                </div>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">{artifact.size} • {formatDateTime(artifact.createdAt)}</p>
              </div>
              <StatusBadge tone={artifact.status === "ready" ? "success" : "warning"} withBorder>
                {artifact.status === "ready" ? "Ready" : "Missing"}
              </StatusBadge>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={artifact.status !== "ready"}
                leftIcon={<Download className="h-4 w-4" />}
                onClick={() => {
                  if (artifact.status !== "ready") {
                    return;
                  }
                  void downloadPerformanceArtifact(artifact.id, artifact.label).catch((error) => {
                    notifyError(error, "Failed to download performance artifact.");
                  });
                }}
              >
                Download
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
