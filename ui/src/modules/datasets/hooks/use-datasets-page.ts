import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useDisclosure } from "@/shared/hooks";
import {
  useBulkOperateTestDatasetsMutation,
  useCreateTestDatasetMutation,
  useDeleteTestDatasetMutation,
  usePatchTestDatasetMutation,
  useTestDatasetQuery,
  useTestDatasetsPageQuery,
  type TestDatasetDto,
} from "@/shared/api";
import type { UnifiedTableProps } from "@/shared/ui/Table";
import { useDeleteConfirmation } from "@/shared/lib/use-delete-confirmation";
import { getErrorMessage, notifyError, notifySuccess } from "@/shared/lib/notifications";
import { useSearchState } from "@/shared/hooks";
import { LIST_SEARCH_DEBOUNCE_MS, useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import {
  buildDatasetSavePayload,
  EMPTY_DATASET_DRAFT,
  hasProjectRole,
  toDatasetDraft,
  type DatasetDraft,
} from "@/shared/datasets";

type DatasetColumn = "name" | "source_type" | "linked_cases" | "updated_at";

export function useDatasetsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams();
  const datasetIdFromUrl = useMemo(() => {
    const value = new URLSearchParams(location.search).get("datasetId");
    return value?.trim() || null;
  }, [location.search]);
  const { searchValue, setSearchValue: setSearchQuery } = useSearchState("");
  const debouncedSearchValue = useDebouncedValue(searchValue, LIST_SEARCH_DEBOUNCE_MS);
  const { isOpen: filtersOpen, setIsOpen: setFiltersOpen } = useDisclosure(false);
  const { confirmDelete } = useDeleteConfirmation();
  const [selectedSourceTypes, setSelectedSourceTypes] = useState<Set<TestDatasetDto["source_type"]>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const canEditDatasets = hasProjectRole(projectId, "tester");
  const canDeleteDatasets = hasProjectRole(projectId, "lead");

  const listParams = useMemo(
    () => ({
      page: currentPage,
      pageSize,
      search: debouncedSearchValue.trim() || undefined,
      sourceTypes: selectedSourceTypes.size > 0 ? Array.from(selectedSourceTypes) : undefined,
    }),
    [currentPage, pageSize, debouncedSearchValue, selectedSourceTypes],
  );

  const datasetsQuery = useTestDatasetsPageQuery(projectId, listParams);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchValue, selectedSourceTypes]);
  const createMutation = useCreateTestDatasetMutation();
  const patchMutation = usePatchTestDatasetMutation();
  const deleteMutation = useDeleteTestDatasetMutation();
  const bulkDeleteMutation = useBulkOperateTestDatasetsMutation();

  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  const [openActionsDatasetId, setOpenActionsDatasetId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingDatasetId, setEditingDatasetId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DatasetDraft>(EMPTY_DATASET_DRAFT);

  const datasets = useMemo(() => datasetsQuery.data?.items ?? [], [datasetsQuery.data?.items]);

  const listTotalItems = useMemo(() => {
    const total = datasetsQuery.data?.total;
    return typeof total === "number" ? total : undefined;
  }, [datasetsQuery.data?.total]);

  const totalPages = useMemo(() => {
    if (typeof listTotalItems === "number") {
      return Math.max(1, Math.ceil(listTotalItems / pageSize));
    }
    return Math.max(1, currentPage + (datasetsQuery.data?.has_next ? 1 : 0));
  }, [listTotalItems, pageSize, currentPage, datasetsQuery.data?.has_next]);

  const tablePagination = useMemo((): NonNullable<UnifiedTableProps<TestDatasetDto, DatasetColumn>["pagination"]> => {
    return {
      enabled: true,
      mode: "server",
      page: currentPage,
      totalPages,
      totalItems: listTotalItems,
      pageSize,
      pageSizeOptions: [10, 25, 50],
      defaultPageSize: pageSize,
      onPageChange: (page: number) => {
        if (page === currentPage) return;
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);
      },
      onPageSizeChange: (nextSize: number) => {
        if (nextSize === pageSize) return;
        setPageSize(nextSize);
        setCurrentPage(1);
      },
    };
  }, [currentPage, totalPages, listTotalItems, pageSize]);

  const setDatasetIdParam = useCallback(
    (datasetId: string | null) => {
      const nextParams = new URLSearchParams(location.search);
      if (datasetId) {
        nextParams.set("datasetId", datasetId);
      } else {
        nextParams.delete("datasetId");
      }
      navigate(
        {
          pathname: location.pathname,
          search: nextParams.toString() ? `?${nextParams.toString()}` : "",
        },
        { replace: true }
      );
    },
    [location.pathname, location.search, navigate]
  );

  useEffect(() => {
    if (!datasetIdFromUrl) return;
    setSelectedDatasetId(datasetIdFromUrl);
    setIsCreating(false);
    setEditingDatasetId(null);
  }, [datasetIdFromUrl]);

  const selectedDatasetQuery = useTestDatasetQuery(selectedDatasetId ?? undefined);

  const selectedDataset = useMemo(
    () =>
      selectedDatasetId
        ? datasets.find((dataset) => dataset.id === selectedDatasetId) ?? selectedDatasetQuery.data ?? null
        : null,
    [datasets, selectedDatasetId, selectedDatasetQuery.data]
  );

  useEffect(() => {
    const validIds = new Set(datasets.map((d) => d.id));
    setSelectedRowIds((prev) => {
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [datasets]);

  const clearRowSelection = useCallback(() => {
    setSelectedRowIds(new Set());
  }, []);

  const handleToggleRowSelection = useCallback((datasetId: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(datasetId)) next.delete(datasetId);
      else next.add(datasetId);
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback((checked: boolean, visibleRowIds?: string[]) => {
    if (!visibleRowIds?.length) return;
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const id of visibleRowIds) next.add(id);
      } else {
        for (const id of visibleRowIds) next.delete(id);
      }
      return next;
    });
  }, []);

  const resetDraft = useCallback(() => {
    setDraft(EMPTY_DATASET_DRAFT);
    setIsCreating(false);
    setEditingDatasetId(null);
  }, []);

  const handleCreateStart = useCallback(() => {
    if (!canEditDatasets) return;
    setDraft(EMPTY_DATASET_DRAFT);
    setEditingDatasetId(null);
    setIsCreating(true);
    setDatasetIdParam(null);
  }, [canEditDatasets, setDatasetIdParam]);

  const handleEditStart = useCallback((dataset: TestDatasetDto) => {
    if (!canEditDatasets) return;
    setSelectedDatasetId(dataset.id);
    setDatasetIdParam(dataset.id);
    setDraft(toDatasetDraft(dataset));
    setEditingDatasetId(dataset.id);
    setIsCreating(false);
  }, [canEditDatasets, setDatasetIdParam]);

  const handleSave = useCallback(async () => {
    if (!projectId || !canEditDatasets || !draft.name.trim()) return;
    const payload = buildDatasetSavePayload(draft);

    try {
      if (editingDatasetId) {
        await patchMutation.mutateAsync({ datasetId: editingDatasetId, payload });
        notifySuccess(`Dataset "${draft.name.trim()}" updated`);
      } else {
        await createMutation.mutateAsync({ project_id: projectId, ...payload });
        notifySuccess(`Dataset "${draft.name.trim()}" created`);
      }
      resetDraft();
    } catch (error) {
      notifyError(error, "Failed to save dataset.");
    }
  }, [canEditDatasets, createMutation, draft, editingDatasetId, patchMutation, projectId, resetDraft]);

  const handleDelete = useCallback(
    async (dataset: TestDatasetDto) => {
      if (!projectId || !canDeleteDatasets) return;
      const confirmed = await confirmDelete({
        title: "Delete Dataset",
        description: `Delete dataset "${dataset.name}"? This action cannot be undone.`,
        confirmLabel: "Delete Dataset",
      });
      if (!confirmed) return;
      try {
        await deleteMutation.mutateAsync({ datasetId: dataset.id, projectId });
        if (editingDatasetId === dataset.id) {
          resetDraft();
        }
        if (selectedDatasetId === dataset.id) {
          setSelectedDatasetId(null);
          setDatasetIdParam(null);
        }
        notifySuccess(`Dataset "${dataset.name}" deleted`);
      } catch (error) {
        notifyError(error, "Failed to delete dataset.");
      }
    },
    [canDeleteDatasets, confirmDelete, deleteMutation, editingDatasetId, projectId, resetDraft, selectedDatasetId, setDatasetIdParam]
  );

  const handleBulkDelete = useCallback(async () => {
    if (!projectId || !canDeleteDatasets || selectedRowIds.size === 0 || bulkDeleteMutation.isPending) return;
    const datasetIds = [...selectedRowIds];
    const confirmed = await confirmDelete({
      title: "Delete Datasets",
      description: `Delete ${datasetIds.length} dataset(s)? They will be removed from all linked test cases. This cannot be undone.`,
      confirmLabel: "Delete datasets",
    });
    if (!confirmed) return;
    try {
      const result = await bulkDeleteMutation.mutateAsync({
        project_id: projectId,
        dataset_ids: datasetIds,
        action: "delete",
      });
      clearRowSelection();
      setOpenActionsDatasetId(null);
      if (editingDatasetId && datasetIds.includes(editingDatasetId)) {
        resetDraft();
      }
      if (selectedDatasetId && datasetIds.includes(selectedDatasetId)) {
        setSelectedDatasetId(null);
        setDatasetIdParam(null);
      }
      notifySuccess(
        result.affected_count === 1 ? "1 dataset deleted" : `${result.affected_count} datasets deleted`
      );
    } catch (error) {
      notifyError(error, "Failed to delete datasets.");
    }
  }, [
    bulkDeleteMutation,
    clearRowSelection,
    confirmDelete,
    editingDatasetId,
    projectId,
    resetDraft,
    selectedDatasetId,
    selectedRowIds,
    setDatasetIdParam,
    canDeleteDatasets,
  ]);

  const isSaving =
    createMutation.isPending || patchMutation.isPending || deleteMutation.isPending || bulkDeleteMutation.isPending;
  const isBulkDeleting = bulkDeleteMutation.isPending;
  const listError = datasetsQuery.isError ? getErrorMessage(datasetsQuery.error, "Failed to load datasets.") : null;

  return {
    projectId: projectId ?? "",
    datasets,
    selectedDatasetId,
    selectedDataset,
    setSelectedDatasetId,
    searchQuery: searchValue,
    setSearchQuery,
    filtersOpen,
    setFiltersOpen,
    selectedSourceTypes,
    activeFiltersCount: selectedSourceTypes.size,
    canEditDatasets,
    canDeleteDatasets,
    isLoading:
      Boolean(projectId) &&
      (datasetsQuery.isPending ||
        (datasetsQuery.isFetching && datasets.length === 0 && datasetsQuery.data === undefined)),
    listError,
    isModalOpen: isCreating || Boolean(editingDatasetId) || Boolean(selectedDatasetId),
    isSaving,
    isBulkDeleting,
    isCreating,
    editingDatasetId,
    draft,
    setDraft,
    onToggleSourceType: (value: TestDatasetDto["source_type"]) =>
      setSelectedSourceTypes((current) => {
        const next = new Set(current);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return next;
      }),
    onClearFilters: () => {
      setSelectedSourceTypes(new Set());
      setFiltersOpen(false);
      setCurrentPage(1);
    },
    tablePagination,
    handleCreateStart,
    handleEditStart,
    handleCancelForm: resetDraft,
    handleSave,
    handleDelete,
    selectedRowIds,
    openActionsDatasetId,
    onToggleRowSelection: handleToggleRowSelection,
    onToggleSelectAll: handleToggleSelectAll,
    clearRowSelection,
    handleBulkDelete,
    onOpenDatasetActions: (datasetId: string) => setOpenActionsDatasetId(datasetId),
    onCloseDatasetActions: () => setOpenActionsDatasetId(null),
    onViewDataset: (dataset: TestDatasetDto) => {
      setSelectedDatasetId(dataset.id);
      setDatasetIdParam(dataset.id);
      setIsCreating(false);
      setEditingDatasetId(null);
    },
    handleCloseModal: () => {
      setSelectedDatasetId(null);
      resetDraft();
      const fromParam = new URLSearchParams(location.search).get("from");
      // Only follow same-origin relative paths to avoid open-redirect risk.
      if (fromParam && fromParam.startsWith("/") && !fromParam.startsWith("//")) {
        navigate(fromParam);
        return;
      }
      setDatasetIdParam(null);
    },
  };
}
