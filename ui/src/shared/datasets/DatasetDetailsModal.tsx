import type { ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { useQueries } from "@tanstack/react-query";
import { getTestCase, queryKeys, type TestDatasetDto } from "@/shared/api";
import { Button } from "@/shared/ui/Button";
import { AppModal, StandardModalLayout } from "@/shared/ui/Modal";
import { SidePanelCard, SidePanelMetaRow } from "@/shared/ui/SidePanel";
import { DatasetRevisionTable } from "./DatasetRevisionTable";
import { DatasetWizardForm } from "./DatasetWizardForm";
import type { DatasetDraft } from "./draft";
import { formatDatasetSourceTypeLabel } from "./source-type";

type Props = Readonly<{
  isOpen: boolean;
  dataset: TestDatasetDto | null;
  draft: DatasetDraft;
  isEditing: boolean;
  isCreating: boolean;
  isSaving: boolean;
  canEditDatasets: boolean;
  canDeleteDatasets: boolean;
  onClose: () => void;
  onEditStart?: (dataset: TestDatasetDto) => void;
  onDelete?: (dataset: TestDatasetDto) => void;
  onDraftChange: (
    value: DatasetDraft | ((prev: DatasetDraft) => DatasetDraft),
  ) => void;
  onCancelEdit: () => void;
  onSave: () => void;
  createActionLabel?: string;
}>;

export function DatasetDetailsModal({
  isOpen,
  dataset,
  draft,
  isEditing,
  isCreating,
  isSaving,
  canEditDatasets,
  canDeleteDatasets,
  onClose,
  onEditStart,
  onDelete,
  onDraftChange,
  onCancelEdit,
  onSave,
  createActionLabel = "Create dataset",
}: Props) {
  let title = dataset?.name ?? "Dataset";
  if (isCreating) {
    title = "New Dataset";
  } else if (isEditing) {
    title = draft.name || "Edit Dataset";
  }

  const linkedTestCaseIds = dataset?.test_case_ids.slice(0, 12) ?? [];
  const linkedTestCaseQueries = useQueries({
    queries: linkedTestCaseIds.map((testCaseId) => ({
      queryKey: queryKeys.testCases.detail(testCaseId),
      queryFn: () => getTestCase(testCaseId),
      enabled: Boolean(dataset) && !isEditing && !isCreating,
    })),
  });

  let footer: ReactNode = null;
  if (!isEditing && !isCreating && dataset) {
    footer = (
      <>
        {canDeleteDatasets && onDelete ? (
          <Button type="button" variant="destructive" onClick={() => onDelete(dataset)} disabled={isSaving}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        ) : null}
        {canEditDatasets && onEditStart ? (
          <Button type="button" variant="primary" onClick={() => onEditStart(dataset)} disabled={isSaving}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        ) : null}
      </>
    );
  }

  if (isEditing || isCreating) {
    return (
      <AppModal
        isOpen={isOpen}
        onClose={onClose}
        closeOnEscape={!isSaving}
        closeOnOverlayClick={!isSaving}
        contentClassName="flex h-[95vh] max-h-[95vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-[min(1520px,calc(100vw-2rem))] sm:max-w-[min(1520px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl"
      >
        <DatasetWizardForm
          draft={draft}
          isSaving={isSaving || !canEditDatasets}
          isEditing={isEditing}
          isCreating={isCreating}
          onDraftChange={onDraftChange}
          onSave={onSave}
          onClose={onCancelEdit}
          saveActionLabel={createActionLabel}
        />
      </AppModal>
    );
  }

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnEscape={!isSaving}
      closeOnOverlayClick={!isSaving}
      contentClassName="flex h-[95vh] max-h-[95vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-[min(1400px,calc(100vw-2rem))] sm:max-w-[min(1400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl"
    >
      <StandardModalLayout
        title={title}
        description={
          "Dataset metadata, linked test cases, and current revision."
        }
        onClose={onClose}
        closeButtonDisabled={isSaving}
        bodyClassName="space-y-4"
        footer={footer}
      >
        {dataset ? (
          <>
            <div className=" border-borderp-4">
              <SidePanelCard className="rounded-lg p-4 shadow-none">
                <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                  <SidePanelMetaRow
                    className="col-span-full border-b border-[var(--border)] pb-3 sm:col-span-2"
                    label="Name"
                    value={dataset.name || "Untitled dataset"}
                  />
                  <SidePanelMetaRow className="border-0 py-2 sm:py-2" label="ID" value={dataset.id} />
                  <SidePanelMetaRow
                    className="border-0 py-2 sm:py-2"
                    label="Source"
                    value={formatDatasetSourceTypeLabel(dataset.source_type)}
                  />
                  <SidePanelMetaRow className="border-0 py-2 sm:py-2" label="Status" value={dataset.status} />
                  <SidePanelMetaRow className="border-0 py-2 sm:py-2" label="Linked Cases" value={dataset.test_cases_count} />
                  <SidePanelMetaRow className="border-0 py-2 sm:py-2" label="Current Revision" value={dataset.current_revision_number} />
                  <SidePanelMetaRow className="border-0 py-2 sm:py-2" label="Columns" value={dataset.current_revision?.columns.length ?? 0} />
                  <SidePanelMetaRow className="border-0 py-2 sm:py-2" label="Rows" value={dataset.current_revision?.rows.length ?? 0} />
                  <SidePanelMetaRow className="border-0 py-2 sm:py-2" label="Source Ref" value={dataset.source_ref || "—"} />
                  <SidePanelMetaRow
                    className="border-0 py-2 sm:py-2"
                    label="Updated"
                    value={new Date(dataset.updated_at).toLocaleString()}
                  />
                  <SidePanelMetaRow
                    className="col-span-full border-0 py-2 sm:col-span-2 sm:py-2"
                    label="Description"
                    value={dataset.description || "—"}
                    alignTop
                  />
                </div>
              </SidePanelCard>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Linked Test Cases</h3>
              {dataset.test_case_ids.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No linked test cases.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Showing {Math.min(dataset.test_case_ids.length, 12)} of {dataset.test_case_ids.length}
                  </p>
                  <ul className="space-y-1 text-xs text-[var(--foreground)]">
                    {linkedTestCaseIds.map((testCaseId, index) => {
                      const testCase = linkedTestCaseQueries[index]?.data;
                      const label = testCase
                        ? `${testCase.key}: ${testCase.title}`
                        : testCaseId;
                      return (
                        <li key={testCaseId}>
                          <Link
                            to={`/projects/${dataset.project_id}/test-cases/${testCaseId}`}
                            className="text-[var(--highlight-foreground)] hover:underline"
                          >
                            {label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            <div className="border-[var(--border)]">
              <DatasetRevisionTable
                columns={dataset.current_revision?.columns ?? []}
                rows={dataset.current_revision?.rows ?? []}
                emptyMessage="Current revision has no rows."
                showSystemColumns={false}
              />
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
            Dataset details are unavailable.
          </div>
        )}
      </StandardModalLayout>
    </AppModal>
  );
}
