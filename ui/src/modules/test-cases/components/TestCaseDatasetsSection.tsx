import { Database, Eye, Pencil, Plug2, Trash2, Unplug } from "lucide-react";
import { useState } from "react";
import type { TestDatasetDto } from "@/shared/api";
import { Button } from "@/shared/ui/Button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { SearchableEntityPicker } from "@/shared/ui";
import { AppModal, StandardModalLayout } from "@/shared/ui/Modal";
import { DatasetDetailsModal, DatasetRevisionTable, formatDatasetSourceTypeLabel, type DatasetDraft } from "@/shared/datasets";

type Props = Readonly<{
  isEditing: boolean;
  canEditDatasets: boolean;
  canDeleteDatasets: boolean;
  datasets: TestDatasetDto[];
  availableDatasets: TestDatasetDto[];
  availableDatasetsHasMore: boolean;
  isLoadingAvailableDatasets: boolean;
  isLoadingMoreAvailableDatasets: boolean;
  onLoadMoreAvailableDatasets: () => void;
  bindDatasetSearch: string;
  onBindDatasetSearchChange: (value: string) => void;
  selectedExistingDatasetId: string;
  onSelectedExistingDatasetIdChange: (value: string) => void;
  draft: DatasetDraft;
  onDraftChange: (value: DatasetDraft | ((prev: DatasetDraft) => DatasetDraft)) => void;
  isLoading: boolean;
  isSaving: boolean;
  isCreating: boolean;
  editingDatasetId: string | null;
  onCreateStart: () => void;
  onEditStart: (dataset: TestDatasetDto) => void;
  onCancelForm: () => void;
  onSave: () => void;
  onBindExisting: () => Promise<boolean> | boolean;
  onOpenDatasetDetails: (datasetId: string) => void;
  onUnbind: (dataset: TestDatasetDto) => void;
  onDelete: (dataset: TestDatasetDto) => void;
  boundDatasetsPagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
    setPage: (page: number) => void;
    canPrev: boolean;
    canNext: boolean;
  };
}>;

export function TestCaseDatasetsSection({
  isEditing,
  canEditDatasets,
  canDeleteDatasets,
  datasets,
  availableDatasets,
  availableDatasetsHasMore,
  isLoadingAvailableDatasets,
  isLoadingMoreAvailableDatasets,
  onLoadMoreAvailableDatasets,
  bindDatasetSearch,
  onBindDatasetSearchChange,
  selectedExistingDatasetId,
  onSelectedExistingDatasetIdChange,
  draft,
  onDraftChange,
  isLoading,
  isSaving,
  isCreating,
  editingDatasetId,
  onCreateStart,
  onEditStart,
  onCancelForm,
  onSave,
  onBindExisting,
  onOpenDatasetDetails,
  onUnbind,
  onDelete,
  boundDatasetsPagination,
}: Props) {
  const [isLinkDatasetModalOpen, setIsLinkDatasetModalOpen] = useState(false);
  const editingDataset = editingDatasetId
    ? datasets.find((dataset) => dataset.id === editingDatasetId) ?? null
    : null;
  const isDatasetModalOpen = canEditDatasets && (isCreating || Boolean(editingDatasetId));

  const handleBindExistingClick = async () => {
    const linked = await onBindExisting();
    if (linked) {
      setIsLinkDatasetModalOpen(false);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Datasets</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Reusable parameter sets linked to this test case and future automated runs.
          </p>
        </div>
        {canEditDatasets ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setIsLinkDatasetModalOpen(true)} disabled={isSaving}>
              <Plug2 className="h-4 w-4" />
              Link dataset
            </Button>
            <Button type="button" variant="outline" onClick={onCreateStart} disabled={isSaving}>
              <Database className="h-4 w-4" />
              New dataset
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        {!canEditDatasets ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
            You have read-only access to datasets in this project.
          </div>
        ) : null}

        {(() => {
          if (isLoading) {
            return (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-6 text-sm text-[var(--muted-foreground)]">
                Loading datasets…
              </div>
            );
          }
          if (datasets.length === 0) {
            const emptyDescription = canEditDatasets
              ? "Create a dataset or link an existing one to prepare this test case for parameterized execution."
              : "This test case does not have datasets yet.";
            return (
              <EmptyState
                title="No datasets linked"
                description={emptyDescription}
              />
            );
          }
          return (
          <div className="space-y-3">
            {datasets.map((dataset) => (
              <div key={dataset.id} className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[var(--foreground)]">{dataset.name}</span>
                      <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
                        {formatDatasetSourceTypeLabel(dataset.source_type)}
                      </span>
                      <span className="rounded-full bg-[var(--secondary)] px-2 py-0.5 text-xs text-[var(--foreground)]">
                        rev {dataset.current_revision_number}
                      </span>
                    </div>
                    {dataset.description ? (
                      <p className="mt-2 text-sm text-[var(--muted-foreground)]">{dataset.description}</p>
                    ) : null}
                    <div className="mt-3 grid gap-2 text-xs text-[var(--muted-foreground)] md:grid-cols-3">
                      <div>Used in cases: {dataset.test_cases_count}</div>
                      <div>Columns: {dataset.current_revision?.columns.length ?? 0}</div>
                      <div>Rows: {dataset.current_revision?.rows.length ?? 0}</div>
                      <div>Status: {dataset.status}</div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => onOpenDatasetDetails(dataset.id)} disabled={isSaving}>
                      <Eye className="h-4 w-4" />
                      Details
                    </Button>
                    {isEditing && canEditDatasets ? (
                      <Button type="button" variant="outline" onClick={() => onEditStart(dataset)} disabled={isSaving}>
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                    ) : null}
                    {canEditDatasets ? (
                      <Button type="button" variant="outline" onClick={() => onUnbind(dataset)} disabled={isSaving}>
                        <Unplug className="h-4 w-4" />
                        Unlink
                      </Button>
                    ) : null}
                    {isEditing && canDeleteDatasets ? (
                      <Button type="button" variant="destructive" onClick={() => onDelete(dataset)} disabled={isSaving}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </div>

                {(dataset.current_revision?.rows.length ?? 0) > 0 ? (
                  <DatasetRevisionTable
                    className="mt-3 w-full"
                    columns={dataset.current_revision?.columns ?? []}
                    rows={dataset.current_revision?.rows ?? []}
                    maxRows={3}
                  />
                ) : null}
              </div>
            ))}
            {boundDatasetsPagination.total > boundDatasetsPagination.pageSize ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3 text-sm text-[var(--muted-foreground)]">
                <span>
                  Page {boundDatasetsPagination.page} of {boundDatasetsPagination.pageCount} ·{" "}
                  {boundDatasetsPagination.total} total
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!boundDatasetsPagination.canPrev || isSaving}
                    onClick={() => boundDatasetsPagination.setPage(boundDatasetsPagination.page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!boundDatasetsPagination.canNext || isSaving}
                    onClick={() => boundDatasetsPagination.setPage(boundDatasetsPagination.page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        );
        })()}
      </div>

      <DatasetDetailsModal
        isOpen={isDatasetModalOpen}
        dataset={editingDataset}
        draft={draft}
        isEditing={Boolean(editingDatasetId)}
        isCreating={isCreating}
        isSaving={isSaving}
        canEditDatasets={canEditDatasets}
        canDeleteDatasets={false}
        onClose={onCancelForm}
        onDraftChange={onDraftChange}
        onCancelEdit={onCancelForm}
        onSave={onSave}
        createActionLabel="Create and link"
      />
      <AppModal
        isOpen={canEditDatasets && isLinkDatasetModalOpen}
        onClose={() => setIsLinkDatasetModalOpen(false)}
        closeOnEscape={!isSaving}
        closeOnOverlayClick={!isSaving}
        contentClassName="flex h-[85vh] max-h-[85vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-[min(1100px,calc(100vw-2rem))] sm:max-w-[min(1100px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl"
      >
        <StandardModalLayout
          title="Link Dataset"
          description="Select an existing dataset to link it with this test case."
          onClose={() => setIsLinkDatasetModalOpen(false)}
          closeButtonDisabled={isSaving}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setIsLinkDatasetModalOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => void handleBindExistingClick()}
                disabled={!selectedExistingDatasetId || isSaving}
              >
                <Plug2 className="h-4 w-4" />
                Link dataset
              </Button>
            </>
          }
        >
          <SearchableEntityPicker
            searchValue={bindDatasetSearch}
            onSearchChange={onBindDatasetSearchChange}
            searchLabel="Search datasets"
            searchPlaceholder="Search datasets by name..."
            items={availableDatasets}
            getKey={(dataset) => dataset.id}
            isSelected={(dataset) => dataset.id === selectedExistingDatasetId}
            onToggle={(dataset) => onSelectedExistingDatasetIdChange(dataset.id)}
            selectionType="radio"
            name="link-existing-dataset"
            isLoading={isLoadingAvailableDatasets}
            isLoadingMore={isLoadingMoreAvailableDatasets}
            hasMore={availableDatasetsHasMore}
            onLoadMore={onLoadMoreAvailableDatasets}
            getInputAriaLabel={(dataset) => `Select ${dataset.name}`}
            getItemDisabled={() => isSaving}
            emptyState={
              <div className="rounded-lg border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted-foreground)]">
                No unlinked datasets available.
              </div>
            }
            renderItem={(dataset) => (
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-[var(--foreground)]">{dataset.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  <span>{formatDatasetSourceTypeLabel(dataset.source_type)}</span>
                  <span>{dataset.test_cases_count} linked case(s)</span>
                </div>
                {dataset.description ? <p className="mt-1 line-clamp-2 text-xs text-[var(--muted-foreground)]">{dataset.description}</p> : null}
              </div>
            )}
          />
        </StandardModalLayout>
      </AppModal>
    </div>
  );
}
