import { useRef } from "react";
import { FileUp, Info, RefreshCcw, Upload } from "lucide-react";
import type { JunitImportDto } from "@/shared/api";
import { Button } from "@/shared/ui/Button";
import { AppModal, StandardModalLayout } from "@/shared/ui/Modal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/Tooltip";

type ImportJunitXmlModalProps = Readonly<{
  isOpen: boolean;
  selectedFile: File | null;
  preview: JunitImportDto | null;
  previewLoading: boolean;
  importLoading: boolean;
  showPreview?: boolean;
  createMissingCases?: boolean;
  onCreateMissingCasesChange?: (value: boolean) => void;
  onClose: () => void;
  onFileChange: (file: File | null) => void;
  onPreview: () => void;
  onImport: () => void;
}>;

function IssueList({
  title,
  items,
  tone,
}: Readonly<{
  title: string;
  items: JunitImportDto["unmatched_cases"];
  tone: "amber" | "rose";
}>) {
  if (items.length === 0) return null;
  const toneClass =
    tone === "amber"
      ? "border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg-soft)] text-[var(--tone-warning-text)]"
      : "border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg-soft)] text-[var(--tone-danger-text)]";
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="mt-2 space-y-2 text-xs">
        {items.map((item, index) => (
          <div key={`${item.testcase_name}-${item.automation_id ?? "none"}-${index}`}>
            <div className="font-medium">{item.testcase_name}</div>
            <div>{item.reason}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreatedCasesList({
  items,
  dryRun,
}: Readonly<{
  items: JunitImportDto["created_cases"];
  dryRun: boolean;
}>) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border border-[var(--tone-success-border)] bg-[var(--tone-success-bg-soft)] p-3 text-[var(--tone-success-text)]">
      <h4 className="text-sm font-semibold">{dryRun ? "Will Create" : "Created Cases"}</h4>
      <div className="mt-2 space-y-2 text-xs">
        {items.map((item, index) => (
          <div key={`${item.id ?? "new"}-${item.automation_id ?? "none"}-${index}`}>
            <div className="font-medium">{item.title}</div>
            <div>
              {[item.key, item.automation_id].filter(Boolean).join(" • ") || "No automation_id"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ImportJunitXmlModal({
  isOpen,
  selectedFile,
  preview,
  previewLoading,
  importLoading,
  showPreview = true,
  createMissingCases = false,
  onCreateMissingCasesChange,
  onClose,
  onFileChange,
  onPreview,
  onImport,
}: ImportJunitXmlModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <AppModal isOpen={isOpen} onClose={onClose} contentClassName="max-w-2xl rounded-xl">
      <StandardModalLayout
        title="Import JUnit XML"
        description="Upload a JUnit XML report, preview case matching, then apply results to this run."
        onClose={onClose}
        closeButtonDisabled={previewLoading || importLoading}
        footer={
          <>
            <Button
              unstyled
              type="button"
              onClick={onClose}
              disabled={previewLoading || importLoading}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)]"
            >
              Cancel
            </Button>
            {showPreview ? (
              <Button
                unstyled
                type="button"
                onClick={onPreview}
                disabled={!selectedFile || previewLoading || importLoading}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-50"
              >
                <RefreshCcw className="h-4 w-4" />
                {previewLoading ? "Previewing..." : "Dry Run"}
              </Button>
            ) : null}
            <Button
              unstyled
              type="button"
              onClick={onImport}
              disabled={!selectedFile || importLoading}
              className="flex items-center gap-2 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] disabled:opacity-50"
            >
              <FileUp className="h-4 w-4" />
              {importLoading ? "Importing..." : "Import Results"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml,text/xml,application/xml"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-lg border-2 border-dashed border-[var(--border)] p-6 text-center transition-colors hover:border-[var(--highlight-foreground)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight-foreground)]"
          >
            {selectedFile ? (
              <div className="flex flex-col items-center gap-2">
                <FileUp className="h-8 w-8 text-[var(--highlight-foreground)]" />
                <span className="text-sm font-medium text-[var(--foreground)]">{selectedFile.name}</span>
                <span className="text-xs text-[var(--muted-foreground)]">Click to choose a different file</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-[var(--muted-foreground)]" />
                <span className="text-sm font-medium text-[var(--foreground)]">Click to choose a JUnit XML file</span>
                <span className="text-xs text-[var(--muted-foreground)]">Report generated by your CI or test runner</span>
              </div>
            )}
          </button>

          {onCreateMissingCasesChange ? (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3 text-sm text-[var(--foreground)]">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={createMissingCases}
                  onChange={(event) => onCreateMissingCasesChange(event.target.checked)}
                  disabled={previewLoading || importLoading}
                  className="h-4 w-4 rounded border-[var(--border)] text-[var(--highlight-foreground)]"
                />
                <span className="flex items-center gap-1.5">
                  Add missing test cases
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 shrink-0 cursor-default text-[var(--muted-foreground)]" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-64">
                      Create missing test cases automatically if no exact match is found. Karvio will try to recreate suites from JUnit paths and fall back to creating the case without a suite if that fails.
                    </TooltipContent>
                  </Tooltip>
                </span>
              </label>
            </div>
          ) : null}

          {preview ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3">
                  <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Total</div>
                  <div className="mt-1 text-xl font-semibold text-[var(--foreground)]">{preview.summary.total_cases}</div>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3">
                  <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Automation ID</div>
                  <div className="mt-1 text-xl font-semibold text-[var(--foreground)]">{preview.summary.matched_by_automation_id}</div>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3">
                  <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Name Match</div>
                  <div className="mt-1 text-xl font-semibold text-[var(--foreground)]">{preview.summary.matched_by_name}</div>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3">
                  <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Updated</div>
                  <div className="mt-1 text-xl font-semibold text-[var(--foreground)]">{preview.summary.updated}</div>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3">
                  <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Created Cases</div>
                  <div className="mt-1 text-xl font-semibold text-[var(--foreground)]">{preview.summary.created_test_cases}</div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <CreatedCasesList items={preview.created_cases} dryRun={preview.dry_run} />
                <IssueList title="Unmatched" items={preview.unmatched_cases} tone="amber" />
                <IssueList title="Ambiguous" items={preview.ambiguous_cases} tone="rose" />
                <IssueList title="Errors" items={preview.error_cases} tone="rose" />
              </div>
            </div>
          ) : null}
        </div>
      </StandardModalLayout>
    </AppModal>
  );
}
