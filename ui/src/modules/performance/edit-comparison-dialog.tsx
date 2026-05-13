import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import {
  patchPerformanceComparison,
  type PerformanceComparisonListItemDto,
} from "@/shared/api";
import { Button, Input, Switch } from "@/shared/ui";
import { Modal, StandardModalLayout } from "@/shared/ui/Modal";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";

function buildPublicShareUrl(token: string): string {
  return `${window.location.origin}/c/${encodeURIComponent(token)}`;
}

/**
 * Lightweight edit modal for the Comparisons list — rename and toggle public visibility.
 * Patches via /perf/comparisons/{id} and returns the updated list-item-shaped DTO so
 * the caller can update its cache without a full snapshot fetch.
 */
export function EditComparisonDialog({
  isOpen,
  onClose,
  comparison,
  onSaved,
}: Readonly<{
  isOpen: boolean;
  onClose: () => void;
  comparison: PerformanceComparisonListItemDto | null;
  onSaved?: (updated: PerformanceComparisonListItemDto) => void;
}>) {
  const [name, setName] = useState("");
  const [makePublic, setMakePublic] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !comparison) return;
    setName(comparison.name ?? "");
    setMakePublic(Boolean(comparison.public_token));
    setCopied(false);
  }, [isOpen, comparison]);

  const patchMutation = useMutation({
    mutationFn: async () => {
      if (!comparison) throw new Error("No comparison selected");
      const updated = await patchPerformanceComparison(comparison.id, {
        name: name.trim() || null,
        public: makePublic,
      });
      // The PATCH endpoint returns full-snapshot shape; we project it down to the list-item shape.
      const compareIds = updated.compare_run_ids;
      const projection: PerformanceComparisonListItemDto = {
        id: updated.id,
        project_id: updated.project_id,
        name: updated.name,
        base_run_id: updated.base_run_id,
        compare_run_ids: compareIds,
        metric_key: updated.metric_key,
        run_count: 1 + compareIds.length,
        public_token: updated.public_token,
        created_by: updated.created_by,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      };
      return projection;
    },
    onSuccess: (projection) => {
      notifySuccess("Comparison updated.");
      onSaved?.(projection);
    },
    onError: (error) => notifyError(error, "Failed to update comparison."),
  });

  const publicUrl = comparison?.public_token ? buildPublicShareUrl(comparison.public_token) : null;

  const handleCopyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
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
        title="Edit comparison"
        description="Rename or change the public visibility of this saved comparison."
        onClose={onClose}
        bodyClassName="space-y-4 px-4 py-3"
        footer={
          <>
            <Button type="button" variant="secondary" size="md" onClick={onClose}>
              Close
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => void patchMutation.mutateAsync()}
              disabled={patchMutation.isPending || !comparison}
            >
              {patchMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      >
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Name
          </span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Comparison name"
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
            onCheckedChange={setMakePublic}
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
      </StandardModalLayout>
    </Modal>
  );
}
