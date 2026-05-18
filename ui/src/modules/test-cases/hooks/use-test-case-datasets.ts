import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import {
  queryKeys,
  useBindDatasetToTestCaseMutation,
  useTestCaseDatasetBindingsQuery,
  useCreateTestDatasetMutation,
  useDeleteTestDatasetMutation,
  usePatchTestDatasetMutation,
  useTestDatasetsPageQuery,
  useUnbindDatasetFromTestCaseMutation,
  type TestCaseDatasetBindingDto,
  type TestDatasetDto,
  type TestDatasetsPageResponse,
} from "@/shared/api";
import { useDeleteConfirmation } from "@/shared/lib/use-delete-confirmation";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import {
  buildDatasetSavePayload,
  EMPTY_DATASET_DRAFT,
  hasProjectRole,
  toDatasetDraft,
  type DatasetDraft,
} from "@/shared/datasets";

const BIND_SEARCH_DEBOUNCE_MS = 300;
const BOUND_DATASETS_PAGE_SIZE = 50;
const AVAILABLE_DATASETS_PAGE_SIZE = 20;

function normalizeAliasSeed(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "");
  const base = normalized || "dataset";
  return /^[0-9]/.test(base) ? `d_${base}` : base;
}

function buildUniqueAlias(seed: string, existingAliases: Set<string>): string {
  const base = normalizeAliasSeed(seed);
  if (!existingAliases.has(base)) return base;
  let next = 2;
  while (existingAliases.has(`${base}_${next}`)) next += 1;
  return `${base}_${next}`;
}

export function useTestCaseDatasets(
  projectId: string | undefined,
  testCaseId: string | undefined,
  options?: { enabled?: boolean; initialDatasetsCount?: number },
) {
  const queryClient = useQueryClient();
  const { confirmDelete } = useDeleteConfirmation();
  const enabled = options?.enabled ?? false;
  const canEditDatasets = hasProjectRole(projectId, "tester");
  const canDeleteDatasets = hasProjectRole(projectId, "lead");
  const initialDatasetsCount = options?.initialDatasetsCount ?? 0;
  const [shouldLoadBoundDatasets, setShouldLoadBoundDatasets] = useState(initialDatasetsCount > 0);
  const [bindSearch, setBindSearch] = useState("");
  const [boundPage, setBoundPage] = useState(1);
  const [availablePage, setAvailablePage] = useState(1);
  const [availableDatasets, setAvailableDatasets] = useState<TestDatasetDto[]>([]);
  const debouncedBindSearch = useDebouncedValue(bindSearch, BIND_SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    setBoundPage(1);
  }, [testCaseId]);

  const boundDatasetsQuery = useTestDatasetsPageQuery(
    projectId,
    {
      page: boundPage,
      pageSize: BOUND_DATASETS_PAGE_SIZE,
      ...(testCaseId ? { testCaseId } : {}),
    },
    enabled && shouldLoadBoundDatasets && Boolean(testCaseId),
  );

  const availableQuery = useTestDatasetsPageQuery(
    projectId,
    {
      page: availablePage,
      pageSize: AVAILABLE_DATASETS_PAGE_SIZE,
      ...(testCaseId ? { excludeTestCaseId: testCaseId } : {}),
      search: debouncedBindSearch.trim() || undefined,
    },
    enabled && Boolean(testCaseId),
  );
  const createDatasetMutation = useCreateTestDatasetMutation();
  const patchDatasetMutation = usePatchTestDatasetMutation();
  const deleteDatasetMutation = useDeleteTestDatasetMutation();
  const bindDatasetMutation = useBindDatasetToTestCaseMutation();
  const unbindDatasetMutation = useUnbindDatasetFromTestCaseMutation();
  const bindingsQuery = useTestCaseDatasetBindingsQuery(testCaseId, enabled && shouldLoadBoundDatasets && Boolean(testCaseId));

  const [isCreating, setIsCreating] = useState(false);
  const [editingDatasetId, setEditingDatasetId] = useState<string | null>(null);
  const [selectedExistingDatasetId, setSelectedExistingDatasetId] = useState("");
  const [draft, setDraft] = useState<DatasetDraft>(EMPTY_DATASET_DRAFT);

  useEffect(() => {
    setAvailablePage(1);
    setAvailableDatasets([]);
    setSelectedExistingDatasetId("");
  }, [testCaseId, debouncedBindSearch]);

  useEffect(() => {
    if (enabled && initialDatasetsCount > 0) {
      setShouldLoadBoundDatasets(true);
    }
  }, [enabled, initialDatasetsCount]);

  const boundDatasets = boundDatasetsQuery.data?.items ?? [];
  const bindings = useMemo(() => bindingsQuery.data ?? [], [bindingsQuery.data]);
  const bindingByDatasetId = useMemo(() => {
    const map = new Map<string, (typeof bindings)[number]>();
    for (const binding of bindings) map.set(binding.dataset_id, binding);
    return map;
  }, [bindings]);
  const currentAliases = useMemo(() => new Set(bindings.map((binding) => binding.dataset_alias)), [bindings]);

  useEffect(() => {
    const pageItems = availableQuery.data?.items ?? [];
    if (availablePage === 1) {
      setAvailableDatasets(pageItems);
      return;
    }
    if (pageItems.length === 0) return;
    setAvailableDatasets((current) => {
      const existingIds = new Set(current.map((item) => item.id));
      const merged = [...current];
      for (const dataset of pageItems) {
        if (existingIds.has(dataset.id)) continue;
        merged.push(dataset);
      }
      return merged;
    });
  }, [availablePage, availableQuery.data?.items]);

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
  }, [canEditDatasets]);

  const handleEditStart = useCallback((dataset: TestDatasetDto) => {
    if (!canEditDatasets) return;
    setDraft(toDatasetDraft(dataset));
    setIsCreating(false);
    setEditingDatasetId(dataset.id);
  }, [canEditDatasets]);

  const handleCancelForm = useCallback(() => {
    resetDraft();
  }, [resetDraft]);

  const handleSave = useCallback(async () => {
    if (!projectId || !testCaseId || !canEditDatasets) return;
    if (!draft.name.trim()) {
      notifyError(new Error("Dataset name is required."), "Failed to save dataset.");
      return;
    }

    try {
      const payload = buildDatasetSavePayload(draft);

      if (editingDatasetId) {
        await patchDatasetMutation.mutateAsync({
          datasetId: editingDatasetId,
          payload,
        });
        notifySuccess(`Dataset "${draft.name.trim()}" updated`);
      } else {
        const created = await createDatasetMutation.mutateAsync({
          project_id: projectId,
          ...payload,
        });
        setShouldLoadBoundDatasets(true);
        await bindDatasetMutation.mutateAsync({
          projectId,
          testCaseId,
          payload: {
            dataset_id: created.id,
            dataset_alias: buildUniqueAlias(created.name, currentAliases),
          },
        });
        notifySuccess(`Dataset "${created.name}" created and linked`);
      }
      resetDraft();
    } catch (error) {
      notifyError(error, "Failed to save dataset.");
    }
  }, [
    bindDatasetMutation,
    createDatasetMutation,
    currentAliases,
    draft,
    editingDatasetId,
    patchDatasetMutation,
    canEditDatasets,
    projectId,
    resetDraft,
    testCaseId,
  ]);

  const handleBindExisting = useCallback(async (): Promise<boolean> => {
    if (!projectId || !testCaseId || !selectedExistingDatasetId || !canEditDatasets) return false;
    try {
      const dataset = availableDatasets.find((item) => item.id === selectedExistingDatasetId);
      setShouldLoadBoundDatasets(true);
      await bindDatasetMutation.mutateAsync({
        projectId,
        testCaseId,
        payload: {
          dataset_id: selectedExistingDatasetId,
          dataset_alias: buildUniqueAlias(dataset?.name ?? selectedExistingDatasetId, currentAliases),
        },
      });
      notifySuccess(`Dataset "${dataset?.name ?? selectedExistingDatasetId}" linked`);
      setSelectedExistingDatasetId("");
      return true;
    } catch (error) {
      notifyError(error, "Failed to link dataset.");
      return false;
    }
  }, [
    availableDatasets,
    bindDatasetMutation,
    canEditDatasets,
    currentAliases,
    projectId,
    selectedExistingDatasetId,
    testCaseId,
  ]);

  const handleUnbind = useCallback(
    async (dataset: TestDatasetDto) => {
      if (!projectId || !testCaseId || !canEditDatasets) return;
      const binding = bindingByDatasetId.get(dataset.id);
      if (!binding) {
        notifyError(new Error("Binding was not found."), "Failed to unlink dataset.");
        return;
      }
      try {
        await unbindDatasetMutation.mutateAsync({
          projectId,
          testCaseId,
          bindingId: binding.id,
        });
        if (editingDatasetId === dataset.id) {
          resetDraft();
        }
        notifySuccess(`Dataset "${dataset.name}" unlinked`);
      } catch (error) {
        notifyError(error, "Failed to unlink dataset.");
      }
    },
    [bindingByDatasetId, canEditDatasets, editingDatasetId, projectId, resetDraft, testCaseId, unbindDatasetMutation]
  );

  const handleDelete = useCallback(
    async (dataset: TestDatasetDto) => {
      if (!projectId || !canDeleteDatasets) return;
      const confirmed = await confirmDelete({
        title: "Delete Dataset",
        description: `Delete dataset "${dataset.name}" from the project? It will be removed from all linked test cases.`,
        confirmLabel: "Delete Dataset",
      });
      if (!confirmed) return;

      try {
        await deleteDatasetMutation.mutateAsync({ datasetId: dataset.id, projectId });
        if (testCaseId) {
          queryClient.setQueriesData<TestDatasetsPageResponse>(
            { queryKey: ["projects", projectId, "test-cases", testCaseId, "datasets"] },
            (current) => {
              if (!current) return current;
              const nextItems = current.items.filter((item) => item.id !== dataset.id);
              if (nextItems.length === current.items.length) return current;
              const nextTotal = typeof current.total === "number" ? Math.max(0, current.total - 1) : current.total;
              return {
                ...current,
                items: nextItems,
                total: nextTotal,
              };
            },
          );
          queryClient.setQueryData<TestCaseDatasetBindingDto[]>(
            queryKeys.datasets.bindingsByTestCase(testCaseId),
            (current) => current?.filter((binding) => binding.dataset_id !== dataset.id) ?? current,
          );
        }
        if (editingDatasetId === dataset.id) {
          resetDraft();
        }
        notifySuccess(`Dataset "${dataset.name}" deleted`);
      } catch (error) {
        notifyError(error, "Failed to delete dataset.");
      }
    },
    [canDeleteDatasets, confirmDelete, deleteDatasetMutation, editingDatasetId, projectId, queryClient, resetDraft, testCaseId]
  );

  const boundTotal = boundDatasetsQuery.data?.total;
  const availableHasMore = Boolean(availableQuery.data?.has_next);

  const handleLoadMoreAvailable = useCallback(() => {
    if (availableQuery.isFetching || !availableHasMore) return;
    setAvailablePage((current) => current + 1);
  }, [availableHasMore, availableQuery.isFetching]);

  useEffect(() => {
    if (!shouldLoadBoundDatasets || typeof boundTotal !== "number") return;
    const pageCount = Math.max(1, Math.ceil(boundTotal / BOUND_DATASETS_PAGE_SIZE));
    if (boundPage > pageCount) setBoundPage(pageCount);
  }, [boundPage, boundTotal, shouldLoadBoundDatasets]);

  let count = initialDatasetsCount;
  if (shouldLoadBoundDatasets && typeof boundTotal === "number") {
    count = boundTotal;
  } else if (shouldLoadBoundDatasets) {
    count = boundDatasets.length;
  }

  const boundPagination = useMemo(() => {
    let total = boundDatasets.length;
    if (typeof boundTotal === "number") {
      total = boundTotal;
    } else if (boundDatasetsQuery.isLoading) {
      total = 0;
    }
    const pageCount = Math.max(1, Math.ceil(total / BOUND_DATASETS_PAGE_SIZE));
    return {
      page: boundPage,
      pageSize: BOUND_DATASETS_PAGE_SIZE,
      total,
      pageCount,
      setPage: setBoundPage,
      canPrev: boundPage > 1,
      canNext: boundPage < pageCount,
    };
  }, [boundDatasets.length, boundDatasetsQuery.isLoading, boundPage, boundTotal]);

  return {
    datasets: boundDatasets,
    count,
    canEditDatasets,
    canDeleteDatasets,
    availableDatasets,
    availableDatasetsHasMore: availableHasMore,
    isLoadingAvailableDatasets: enabled && availableQuery.isLoading,
    isLoadingMoreAvailableDatasets: enabled && availableQuery.isFetching && availablePage > 1,
    handleLoadMoreAvailableDatasets: handleLoadMoreAvailable,
    bindSearch,
    setBindSearch,
    boundPagination,
    selectedExistingDatasetId,
    setSelectedExistingDatasetId,
    draft,
    setDraft,
    isLoading: enabled && shouldLoadBoundDatasets && boundDatasetsQuery.isLoading,
    isSaving:
      createDatasetMutation.isPending ||
      patchDatasetMutation.isPending ||
      deleteDatasetMutation.isPending ||
      bindDatasetMutation.isPending ||
      unbindDatasetMutation.isPending,
    isCreating,
    editingDatasetId,
    handleCreateStart,
    handleEditStart,
    handleCancelForm,
    handleSave,
    handleBindExisting,
    handleUnbind,
    handleDelete,
  };
}
