import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  useCreateRunFromTestPlanMutation,
  useCreateTestPlanMutation,
  useDeleteTestPlanMutation,
  useEnvironmentsPageQuery,
  useMilestonesPageQuery,
  usePatchTestPlanMutation,
  useProjectMembersQuery,
  useTestPlanQuery,
  useTestPlanTagsQuery,
  useTestPlansPageQuery,
  type TestPlanDto,
} from "@/shared/api";
import type { UnifiedTableProps } from "@/shared/ui/Table";
import { useColumnVisibility, useDisclosure, useSearchState } from "@/shared/hooks";
import { LIST_SEARCH_DEBOUNCE_MS, useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { useDeleteConfirmation } from "@/shared/lib/use-delete-confirmation";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import type { TestPlanColumn } from "../components/TestPlansTable";

const DEFAULT_VISIBLE_COLUMNS: TestPlanColumn[] = ["name", "description", "milestone", "tags", "suites", "created"];

function toggleStringSet(setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) {
  setter((current) => {
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  });
}

export function useTestPlansPage(options?: { loadSelectedPlanDetail?: boolean }) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { confirmDelete } = useDeleteConfirmation();
  const { searchValue: searchQuery, setSearchValue: setSearchQuery } = useSearchState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, LIST_SEARCH_DEBOUNCE_MS);
  const { isOpen: filtersOpen, setIsOpen: setFiltersOpen } = useDisclosure(false);
  const { isOpen: columnsOpen, setIsOpen: setColumnsOpen } = useDisclosure(false);
  const { visibleColumns, toggleColumn } = useColumnVisibility<TestPlanColumn>(DEFAULT_VISIBLE_COLUMNS);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedMilestoneIds, setSelectedMilestoneIds] = useState<Set<string>>(new Set());
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<import("@/shared/api").TestPlanDto | null>(null);
  const [createRunPlan, setCreateRunPlan] = useState<import("@/shared/api").TestPlanDto | null>(null);
  const [openActionsPlanId, setOpenActionsPlanId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const listParams = useMemo(
    () => ({
      page: currentPage,
      pageSize,
      search: debouncedSearchQuery.trim() || undefined,
      tags: selectedTags.size > 0 ? Array.from(selectedTags) : undefined,
      milestoneIds: selectedMilestoneIds.size > 0 ? Array.from(selectedMilestoneIds) : undefined,
    }),
    [currentPage, pageSize, debouncedSearchQuery, selectedTags, selectedMilestoneIds],
  );

  const testPlansQuery = useTestPlansPageQuery(projectId, listParams);
  const planTagsQuery = useTestPlanTagsQuery(projectId);
  const environmentsQuery = useEnvironmentsPageQuery(
    projectId,
    { page: 1, pageSize: 200, sortBy: "name", sortOrder: "asc" },
    true,
  );
  const milestonesQuery = useMilestonesPageQuery(
    projectId,
    { page: 1, pageSize: 200, search: "", statuses: undefined },
    true,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, selectedTags, selectedMilestoneIds]);
  const selectedPlanQuery = useTestPlanQuery(
    options?.loadSelectedPlanDetail && selectedPlanId ? selectedPlanId : undefined,
  );
  const projectMembersQuery = useProjectMembersQuery(projectId);
  const createTestPlanMutation = useCreateTestPlanMutation();
  const patchTestPlanMutation = usePatchTestPlanMutation();
  const deleteTestPlanMutation = useDeleteTestPlanMutation();
  const createRunFromPlanMutation = useCreateRunFromTestPlanMutation();

  const userNamesById = Object.fromEntries(
    (projectMembersQuery.data ?? []).map((m) => [m.user_id, m.username ?? "Unknown"])
  );
  const assigneeOptions = Array.from(
    new Set((projectMembersQuery.data ?? []).map((m) => m.user_id))
  ).map((userId) => ({
    id: userId,
    label: userNamesById[userId] ?? "Unknown",
  })).sort((a, b) => a.label.localeCompare(b.label));

  const environmentOptions = useMemo(
    () =>
      (environmentsQuery.data?.items ?? []).map((environment) => ({
        id: environment.id,
        label: environment.name,
        revisionNumber: environment.current_revision_number ?? null,
      })),
    [environmentsQuery.data?.items],
  );

  const handleCreatePlan = useCallback(
    async (payload: {
      name: string;
      description: string;
      tags: string[];
      milestone_id: string | null;
      suite_ids: string[];
      case_ids: string[];
    }) => {
      if (!projectId) return;
      try {
        await createTestPlanMutation.mutateAsync({
          project_id: projectId,
          name: payload.name,
          description: payload.description || null,
          tags: payload.tags ?? [],
          milestone_id: payload.milestone_id,
          suite_ids: payload.suite_ids ?? [],
          case_ids: payload.case_ids ?? [],
        });
        notifySuccess("Test plan created");
      } catch (error) {
        notifyError(error, "Failed to create plan.");
        throw error;
      }
    },
    [projectId, createTestPlanMutation]
  );

  const handlePatchPlan = useCallback(
    async (
      planId: string,
      payload: {
        name?: string;
        description?: string | null;
        tags?: string[];
        milestone_id?: string | null;
        suite_ids?: string[];
        case_ids?: string[];
      }
    ) => {
      try {
        await patchTestPlanMutation.mutateAsync({ planId, payload });
        notifySuccess("Test plan updated");
      } catch (error) {
        notifyError(error, "Failed to update plan.");
        throw error;
      }
    },
    [patchTestPlanMutation]
  );

  const handleDeletePlan = useCallback(
    async (plan: import("@/shared/api").TestPlanDto) => {
      if (!projectId) return;
      const confirmed = await confirmDelete({
        title: "Delete Test Plan",
        description: `Delete test plan "${plan.name}"? This action cannot be undone.`,
        confirmLabel: "Delete Test Plan",
      });
      if (!confirmed) return;

      try {
        await deleteTestPlanMutation.mutateAsync({ planId: plan.id, projectId });
        notifySuccess("Test plan deleted");
      } catch (error) {
        notifyError(error, "Failed to delete plan.");
      }
    },
    [projectId, confirmDelete, deleteTestPlanMutation]
  );

  const handleCreateRunFromPlan = useCallback(
    async (
      planId: string,
      payload: {
        name: string;
        description?: string | null;
        environment_id?: string;
        milestone_id?: string | null;
        build?: string | null;
        assignee?: string | null;
        start_immediately?: boolean;
      }
    ) => {
      if (!projectId) return;
      try {
        const run = await createRunFromPlanMutation.mutateAsync({ planId, payload });
        notifySuccess(`Run "${run.name}" created`);
        navigate(`/projects/${projectId}/test-runs/${run.id}`);
      } catch (error) {
        notifyError(error, "Failed to create run from plan.");
      }
    },
    [projectId, createRunFromPlanMutation, navigate]
  );

  const plans = testPlansQuery.data?.items ?? [];

  const listTotalItems = useMemo(() => {
    const total = testPlansQuery.data?.total;
    return typeof total === "number" ? total : undefined;
  }, [testPlansQuery.data?.total]);

  const totalPages = useMemo(() => {
    if (typeof listTotalItems === "number") {
      return Math.max(1, Math.ceil(listTotalItems / pageSize));
    }
    return Math.max(1, currentPage + (testPlansQuery.data?.has_next ? 1 : 0));
  }, [listTotalItems, pageSize, currentPage, testPlansQuery.data?.has_next]);

  const tablePagination = useMemo((): NonNullable<UnifiedTableProps<TestPlanDto, TestPlanColumn>["pagination"]> => {
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

  useEffect(() => {
    if (!selectedPlanId) return;
    if (!plans.some((p) => p.id === selectedPlanId)) {
      setSelectedPlanId(null);
    }
  }, [plans, selectedPlanId]);

  const selectedPlan = useMemo(() => {
    if (!selectedPlanId) return null;
    return selectedPlanQuery.data ?? plans.find((p) => p.id === selectedPlanId) ?? null;
  }, [plans, selectedPlanId, selectedPlanQuery.data]);

  const availableTags = useMemo(
    () =>
      Array.from(new Set([...selectedTags, ...(planTagsQuery.data ?? [])]))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [planTagsQuery.data, selectedTags],
  );
  const activeFiltersCount = selectedTags.size + selectedMilestoneIds.size;
  const milestoneOptions = (milestonesQuery.data?.items ?? []).map((milestone) => ({
    id: milestone.id,
    label: milestone.name,
  }));
  const milestoneLabelById = new Map(milestoneOptions.map((item) => [item.id, item.label]));

  const handleEditPlan = useCallback((plan: import("@/shared/api").TestPlanDto) => {
    setEditingPlan(plan);
  }, []);

  const handleCreateRun = useCallback((plan: import("@/shared/api").TestPlanDto) => {
    setCreateRunPlan(plan);
  }, []);

  const resolveUserName = useCallback(
    (userId: string | null | undefined) => {
      if (!userId) return "System";
      return userNamesById[userId] ?? "Unknown user";
    },
    [userNamesById]
  );

  return {
    projectId: projectId ?? "",
    plans,
    suites: [],
    testCases: [],
    planFormDataLoading: false,
    assigneeOptions,
    environmentOptions,
    tablePagination,
    isLoading:
      Boolean(projectId) &&
      (testPlansQuery.isPending ||
        (testPlansQuery.isFetching && plans.length === 0 && testPlansQuery.data === undefined)),
    selectedPlanLoading: selectedPlanQuery.isLoading,
    createLoading: createTestPlanMutation.isPending,
    patchLoading: patchTestPlanMutation.isPending,
    deleteLoading: deleteTestPlanMutation.isPending,
    createRunLoading: createRunFromPlanMutation.isPending,
    editingPlan,
    createRunPlan,
    openActionsPlanId,
    selectedPlanId,
    selectedPlan,
    visibleColumns,
    columnsOpen,
    onColumnsOpenChange: setColumnsOpen,
    onToggleColumn: toggleColumn,
    onRowClick: (planId: string) => setSelectedPlanId((current) => (current === planId ? null : planId)),
    searchQuery,
    setSearchQuery,
    filtersOpen,
    setFiltersOpen,
    selectedTags,
    availableTags,
    selectedMilestoneIds,
    milestoneOptions,
    getMilestoneLabel: (milestoneId: string) => milestoneLabelById.get(milestoneId) ?? milestoneId,
    activeFiltersCount,
    onToggleTag: (value: string) => toggleStringSet(setSelectedTags, value),
    onToggleMilestone: (value: string) => toggleStringSet(setSelectedMilestoneIds, value),
    onClearAllFilters: () => {
      setSelectedTags(new Set());
      setSelectedMilestoneIds(new Set());
      setFiltersOpen(false);
      setCurrentPage(1);
    },
    setEditingPlan,
    setCreateRunPlan,
    setOpenActionsPlanId,
    resolveUserName,
    onCreatePlan: handleCreatePlan,
    onPatchPlan: handlePatchPlan,
    onDeletePlan: handleDeletePlan,
    onCreateRunFromPlan: handleCreateRunFromPlan,
    onEditPlan: handleEditPlan,
    onCreateRun: handleCreateRun,
  };
}
