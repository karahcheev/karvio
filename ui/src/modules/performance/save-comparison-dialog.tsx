import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import {
  createPerformanceComparison,
  patchPerformanceComparison,
  type PerformanceComparisonDto,
} from "@/shared/api";
import { Button, Input, Switch } from "@/shared/ui";
import { Modal, StandardModalLayout } from "@/shared/ui/Modal";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import type { CompareMetricKey } from "./types";

function buildPublicShareUrl(token: string): string {
  return `${window.location.origin}/c/${encodeURIComponent(token)}`;
}

function buildInternalShareUrl(projectId: string, comparisonId: string): string {
  return `${window.location.origin}/projects/${encodeURIComponent(projectId)}/performance/comparisons/${encodeURIComponent(comparisonId)}`;
}

export function SaveComparisonDialog({
  isOpen,
  onClose,
  projectId,
  baseRunId,
  compareRunIds,
  metricKey,
  initialComparison,
  onSaved,
}: Readonly<{
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  baseRunId: string;
  compareRunIds: string[];
  metricKey: CompareMetricKey;
  initialComparison?: PerformanceComparisonDto | null;
  onSaved?: (comparison: PerformanceComparisonDto) => void;
}>) {
  const [name, setName] = useState("");
  const [makePublic, setMakePublic] = useState(false);
  const [savedComparison, setSavedComparison] = useState<PerformanceComparisonDto | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setName(initialComparison?.name ?? "");
    setMakePublic(Boolean(initialComparison?.public_token));
    setSavedComparison(initialComparison ?? null);
    setCopied(false);
  }, [isOpen, initialComparison]);

  const createMutation = useMutation({
    mutationFn: async () =>
      createPerformanceComparison({
        project_id: projectId,
        name: name.trim() || null,
        base_run_id: baseRunId,
        compare_run_ids: compareRunIds,
        metric_key: metricKey,
        public: makePublic,
      }),
    onSuccess: (comparison) => {
      setSavedComparison(comparison);
      notifySuccess("Comparison saved.");
      onSaved?.(comparison);
    },
    onError: (error) => notifyError(error, "Failed to save comparison."),
  });

  const patchMutation = useMutation({
    mutationFn: async ({
      comparisonId,
      payload,
    }: {
      comparisonId: string;
      payload: { name?: string | null; public?: boolean };
    }) => patchPerformanceComparison(comparisonId, payload),
    onSuccess: (comparison) => {
      setSavedComparison(comparison);
      onSaved?.(comparison);
    },
    onError: (error) => notifyError(error, "Failed to update comparison."),
  });

  const handleSave = async () => {
    if (savedComparison) {
      await patchMutation.mutateAsync({
        comparisonId: savedComparison.id,
        payload: {
          name: name.trim() || null,
          public: makePublic,
        },
      });
      return;
    }
    await createMutation.mutateAsync();
  };

  const handleTogglePublic = async (next: boolean) => {
    setMakePublic(next);
    if (savedComparison) {
      await patchMutation.mutateAsync({
        comparisonId: savedComparison.id,
        payload: { public: next },
      });
    }
  };

  const handleCopyLink = async () => {
    if (!savedComparison?.public_token) return;
    try {
      await navigator.clipboard.writeText(buildPublicShareUrl(savedComparison.public_token));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      notifyError(error, "Failed to copy link.");
    }
  };

  const isPending = createMutation.isPending || patchMutation.isPending;
  const publicUrl = savedComparison?.public_token ? buildPublicShareUrl(savedComparison.public_token) : null;
  const internalUrl = savedComparison
    ? buildInternalShareUrl(savedComparison.project_id, savedComparison.id)
    : null;

  const handleCopyInternal = async () => {
    if (!internalUrl) return;
    try {
      await navigator.clipboard.writeText(internalUrl);
      notifySuccess("Internal link copied.");
    } catch (error) {
      notifyError(error, "Failed to copy link.");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="flex max-h-[min(80vh,640px)] w-[min(96vw,560px)] max-w-none flex-col overflow-hidden rounded-xl border border-[var(--border)] p-0 sm:max-w-none"
    >
      <StandardModalLayout
        title={savedComparison ? "Comparison saved" : "Save comparison"}
        description={
          savedComparison
            ? "Manage the saved comparison and share it with your team."
            : "Saves a snapshot of the runs you're comparing right now. You can share it with a public link."
        }
        onClose={onClose}
        bodyClassName="space-y-4 px-4 py-3"
        footer={
          <>
            <Button type="button" variant="secondary" size="md" onClick={onClose}>
              {savedComparison ? "Close" : "Cancel"}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleSave}
              disabled={isPending}
            >
              {savedComparison ? (isPending ? "Saving…" : "Save changes") : isPending ? "Saving…" : "Save comparison"}
            </Button>
          </>
        }
      >
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Name (optional)
          </span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. v2026.04 release vs baseline"
            maxLength={255}
          />
        </label>

        <div className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--foreground)]">Public share link</p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              Anyone with the link can view the comparison without signing in.
            </p>
          </div>
          <Switch
            checked={makePublic}
            onCheckedChange={(value) => void handleTogglePublic(value)}
            aria-label="Enable public link"
          />
        </div>

        {publicUrl ? (
          <div className="space-y-2">
            <span className="block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Public URL
            </span>
            <div className="flex items-center gap-2">
              <Input value={publicUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => void handleCopyLink()}
                leftIcon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        ) : null}

        {internalUrl ? (
          <div className="space-y-2">
            <span className="block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Internal link (project members)
            </span>
            <div className="flex items-center gap-2">
              <Input value={internalUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => void handleCopyInternal()}
                leftIcon={<Copy className="h-4 w-4" />}
              >
                Copy
              </Button>
            </div>
          </div>
        ) : null}
      </StandardModalLayout>
    </Modal>
  );
}
