import type { PlanGenerationPreviewDto } from "@/shared/api";
import { Button } from "@/shared/ui";
import { AppModal, StandardModalLayout } from "@/shared/ui/Modal";

function formatSummaryKey(key: string) {
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function PlanPreviewModal({
  isOpen,
  onClose,
  onRetry,
  onCreatePlan,
  createDisabled,
  creatingPlan,
  productName,
  preview,
  loading,
  errorMessage,
}: Readonly<{
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  onCreatePlan: () => void;
  createDisabled: boolean;
  creatingPlan: boolean;
  productName: string;
  preview: PlanGenerationPreviewDto | null;
  loading: boolean;
  errorMessage: string | null;
}>) {
  const summaryEntries = Object.entries(preview?.summary ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <AppModal isOpen={isOpen} onClose={onClose} contentClassName="max-w-5xl rounded-xl">
      <StandardModalLayout
        title="Preview Generated Plan"
        description={`Review what will be included for "${productName}" before creating the plan.`}
        onClose={onClose}
        footer={(
          <>
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={onCreatePlan}
              disabled={createDisabled}
            >
              {creatingPlan ? "Creating plan..." : "Create plan"}
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          {loading ? (
            <div className="rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted),transparent_60%)] px-3 py-4 text-sm text-[var(--muted-foreground)]">
              Generating preview...
            </div>
          ) : null}

          {!loading && errorMessage ? (
            <div className="space-y-3 rounded-lg border border-[color-mix(in_srgb,var(--destructive),transparent_60%)] bg-[color-mix(in_srgb,var(--destructive),transparent_95%)] p-3">
              <div className="text-sm text-[var(--destructive)]">{errorMessage}</div>
              <Button type="button" variant="secondary" onClick={onRetry}>
                Retry preview
              </Button>
            </div>
          ) : null}

          {!loading && !errorMessage && preview ? (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted),transparent_60%)] px-3 py-2">
                  <div className="text-xs text-[var(--muted-foreground)]">Resolved components</div>
                  <div className="text-lg font-semibold text-[var(--foreground)]">{preview.resolved_component_ids.length}</div>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted),transparent_60%)] px-3 py-2">
                  <div className="text-xs text-[var(--muted-foreground)]">Included cases</div>
                  <div className="text-lg font-semibold text-[var(--foreground)]">{preview.included_cases.length}</div>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted),transparent_60%)] px-3 py-2">
                  <div className="text-xs text-[var(--muted-foreground)]">Excluded cases</div>
                  <div className="text-lg font-semibold text-[var(--foreground)]">{preview.excluded_cases.length}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--foreground)]">Summary</div>
                {summaryEntries.length === 0 ? (
                  <div className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
                    No summary metrics returned.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {summaryEntries.map(([key, value]) => (
                      <div key={key} className="rounded-lg border border-[var(--border)] px-3 py-2">
                        <div className="text-xs text-[var(--muted-foreground)]">{formatSummaryKey(key)}</div>
                        <div className="text-base font-semibold text-[var(--foreground)]">{value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--foreground)]">Included cases</div>
                <div className="max-h-64 overflow-auto rounded-lg border border-[var(--border)]">
                  {preview.included_cases.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-[var(--muted-foreground)]">No cases were included.</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-[minmax(140px,1fr)_minmax(220px,2fr)_minmax(120px,1fr)] gap-2 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--muted),transparent_60%)] px-3 py-2 text-xs font-medium text-[var(--muted-foreground)]">
                        <div>Case ID</div>
                        <div>Reason codes</div>
                        <div>Highest risk</div>
                      </div>
                      {preview.included_cases.map((item) => (
                        <div
                          key={item.test_case_id}
                          className="grid grid-cols-[minmax(140px,1fr)_minmax(220px,2fr)_minmax(120px,1fr)] gap-2 border-b border-[color-mix(in_srgb,var(--border),transparent_30%)] px-3 py-2 text-sm last:border-b-0"
                        >
                          <div className="font-mono text-xs text-[var(--foreground)]">{item.test_case_id}</div>
                          <div className="text-[var(--foreground)]">
                            {item.reason_codes.length > 0 ? item.reason_codes.join(", ") : "No reason codes"}
                          </div>
                          <div className="text-[var(--foreground)]">
                            {item.highest_component_risk_level.toUpperCase()} ({item.highest_component_risk_score})
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--foreground)]">Excluded cases</div>
                <div className="max-h-56 overflow-auto rounded-lg border border-[var(--border)]">
                  {preview.excluded_cases.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-[var(--muted-foreground)]">No cases were excluded.</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-[minmax(140px,1fr)_minmax(240px,2fr)] gap-2 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--muted),transparent_60%)] px-3 py-2 text-xs font-medium text-[var(--muted-foreground)]">
                        <div>Case ID</div>
                        <div>Reason</div>
                      </div>
                      {preview.excluded_cases.map((item) => (
                        <div
                          key={item.test_case_id}
                          className="grid grid-cols-[minmax(140px,1fr)_minmax(240px,2fr)] gap-2 border-b border-[color-mix(in_srgb,var(--border),transparent_30%)] px-3 py-2 text-sm last:border-b-0"
                        >
                          <div className="font-mono text-xs text-[var(--foreground)]">{item.test_case_id}</div>
                          <div className="text-[var(--foreground)]">{item.reason}</div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </>
          ) : null}

          {!loading && !errorMessage && !preview ? (
            <div className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
              No preview data available.
            </div>
          ) : null}
        </div>
      </StandardModalLayout>
    </AppModal>
  );
}
