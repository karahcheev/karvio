import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  type JunitImportDto,
  useAddRunCasesMutation,
  useCreateTestRunMutation,
  useEnvironmentsPageQuery,
  useImportJunitXmlMutation,
  useImportProjectJunitXmlMutation,
  useMilestonesPageQuery,
  useProjectMembersQuery,
  useSetTestRunStatusMutation,
  useTestRunsPageQuery,
} from "@/shared/api";
import { getSessionUser } from "@/shared/auth";
import { useColumnVisibility, useDisclosure, useSearchState, useTableSorting } from "@/shared/hooks";
import { LIST_SEARCH_DEBOUNCE_MS, useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import type { UnifiedTableProps, UnifiedTableSorting } from "@/shared/ui/Table";
import { invokeMaybeAsync } from "@/shared/lib/invoke-maybe-async";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import type { AssigneeOption, CreateTestRunPayload } from "../components/CreateRunDialog";
import type { RunDetailsSidePanelRun } from "../components/RunDetailsPanel";
import type { TestRunColumn, RunView } from "../components/TestRunsTable";
import { getRunFlowAction } from "../components/RunDetailsPanel";
import { canImportJunitIntoRun } from "../constants";
import { normalizeCreateRunPayload } from "../utils/create-run";
import { mapTestRunSorting, mapTestRunToView } from "../utils/mappers";

const DEFAULT_VISIBLE_COLUMNS: TestRunColumn[] = ["name", "milestone", "build", "environment", "status", "progress", "passRate", "created"];
const DEFAULT_SORTING: UnifiedTableSorting<TestRunColumn> = { column: "created", direction: "desc" };
export type TestRunsPeriodPreset = "all" | "7d" | "30d" | "90d" | "180d" | "custom";

function toggleStringSet(setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) {
  setter((current) => {
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  });
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRelativeRange(days: number) {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - Math.max(days - 1, 0));
  return {
    from: formatDateInput(from),
    to: formatDateInput(to),
  };
}

export function useTestRunsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { isOpen: filtersOpen, setIsOpen: setFiltersOpen } = useDisclosure(false);
  const { isOpen: columnsOpen, setIsOpen: setColumnsOpen } = useDisclosure(false);
  const { isOpen: createRunOpen, open: openCreateRun, close: closeCreateRun } = useDisclosure(false);
  const { searchValue: searchQuery, setSearchValue: setSearchQuery } = useSearchState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, LIST_SEARCH_DEBOUNCE_MS);
  const { visibleColumns, toggleColumn } = useColumnVisibility<TestRunColumn>(DEFAULT_VISIBLE_COLUMNS);
  const { sorting, setSorting } = useTableSorting<TestRunColumn>(DEFAULT_SORTING);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [selectedEnvironmentIds, setSelectedEnvironmentIds] = useState<Set<string>>(new Set());
  const [selectedMilestoneIds, setSelectedMilestoneIds] = useState<Set<string>>(new Set());
  const [selectedPeriodPreset, setSelectedPeriodPreset] = useState<TestRunsPeriodPreset>("all");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [actionRunId, setActionRunId] = useState<string | null>(null);
  const [openActionsRunId, setOpenActionsRunId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [projectJunitImportOpen, setProjectJunitImportOpen] = useState(false);
  const [projectJunitFile, setProjectJunitFile] = useState<File | null>(null);
  const [projectJunitResult, setProjectJunitResult] = useState<JunitImportDto | null>(null);
  const [projectCreateMissingCases, setProjectCreateMissingCases] = useState(false);
  const [junitImportRunId, setJunitImportRunId] = useState<string | null>(null);
  const [selectedJunitFile, setSelectedJunitFile] = useState<File | null>(null);
  const [junitPreview, setJunitPreview] = useState<JunitImportDto | null>(null);
  const [createMissingCases, setCreateMissingCases] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const hasDateRangeError = Boolean(createdFrom && createdTo && createdFrom > createdTo);

  const listParams = useMemo(
    () => ({
      statuses: selectedStatuses.size > 0 ? (Array.from(selectedStatuses) as RunView["status"][]) : undefined,
      environmentIds: selectedEnvironmentIds.size > 0 ? Array.from(selectedEnvironmentIds) : undefined,
      milestoneIds: selectedMilestoneIds.size > 0 ? Array.from(selectedMilestoneIds) : undefined,
      search: debouncedSearchQuery.trim() || undefined,
      createdFrom: !hasDateRangeError && createdFrom ? createdFrom : undefined,
      createdTo: !hasDateRangeError && createdTo ? createdTo : undefined,
      sortBy: mapTestRunSorting(sorting.column) ?? undefined,
      sortOrder: sorting.direction,
      pageSize,
      page: currentPage,
    }),
    [
      selectedStatuses,
      selectedEnvironmentIds,
      selectedMilestoneIds,
      debouncedSearchQuery,
      hasDateRangeError,
      createdFrom,
      createdTo,
      sorting.column,
      sorting.direction,
      pageSize,
      currentPage,
    ],
  );

  const testRunsPageQuery = useTestRunsPageQuery(projectId, listParams);
  const environmentsQuery = useEnvironmentsPageQuery(
    projectId,
    {
      page: 1,
      pageSize: 200,
      sortBy: "name",
      sortOrder: "asc",
    },
    Boolean(projectId),
  );
  const projectMembersQuery = useProjectMembersQuery(projectId);
  const milestonesQuery = useMilestonesPageQuery(
    projectId,
    { page: 1, pageSize: 200, search: "", statuses: undefined },
    true,
  );

  const createRunMutation = useCreateTestRunMutation();
  const addRunCasesMutation = useAddRunCasesMutation();
  const setTestRunStatusMutation = useSetTestRunStatusMutation();
  const importJunitXmlMutation = useImportJunitXmlMutation();
  const importProjectJunitXmlMutation = useImportProjectJunitXmlMutation();

  const runs = useMemo(
    () => (testRunsPageQuery.data?.items ?? []).map(mapTestRunToView),
    [testRunsPageQuery.data?.items],
  );

  const listTotalItems = useMemo(() => {
    const total = testRunsPageQuery.data?.total;
    return typeof total === "number" ? total : undefined;
  }, [testRunsPageQuery.data?.total]);

  const totalPages = useMemo(() => {
    if (typeof listTotalItems === "number") {
      return Math.max(1, Math.ceil(listTotalItems / pageSize));
    }
    return Math.max(1, currentPage + (testRunsPageQuery.data?.has_next ? 1 : 0));
  }, [listTotalItems, pageSize, currentPage, testRunsPageQuery.data?.has_next]);

  const tablePagination = useMemo((): NonNullable<UnifiedTableProps<RunView, TestRunColumn>["pagination"]> => {
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
        if (page < 1) return;
        if (page > totalPages) return;
        setCurrentPage(page);
      },
      onPageSizeChange: (nextSize: number) => {
        if (nextSize === pageSize) return;
        setPageSize(nextSize);
        setCurrentPage(1);
      },
    };
  }, [currentPage, totalPages, listTotalItems, pageSize]);
  const sessionUser = getSessionUser();
  const userNamesById = useMemo(() => {
    const names = new Map((projectMembersQuery.data ?? []).map((member) => [member.user_id, member.username ?? "Unknown user"]));
    if (sessionUser) {
      names.set(sessionUser.id, sessionUser.username);
    }
    return names;
  }, [projectMembersQuery.data, sessionUser]);
  const resolveUserName = useCallback(
    (userId: string | null | undefined) => {
      if (!userId) return "System";
      return userNamesById.get(userId) ?? "Unknown user";
    },
    [userNamesById],
  );

  const assigneeOptions = useMemo<AssigneeOption[]>(() => {
    return Array.from(new Set((projectMembersQuery.data ?? []).map((member) => member.user_id)))
      .map((userId) => ({
        id: userId,
        label: userNamesById.get(userId) ?? "Unknown user",
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [projectMembersQuery.data, userNamesById]);

  useEffect(() => {
    if (!selectedRunId) return;
    if (!runs.some((run) => run.id === selectedRunId)) {
      setSelectedRunId(null);
    }
  }, [runs, selectedRunId]);

  const environmentItems = environmentsQuery.data?.items ?? [];
  const environmentOptions = useMemo(
    () =>
      environmentItems.map((environment) => ({
        id: environment.id,
        label: environment.name,
        revisionNumber: environment.current_revision_number ?? null,
      })),
    [environmentItems],
  );
  const environments = environmentOptions.map((environment) => environment.id);
  const environmentLabelById = useMemo(
    () =>
      new Map(
        environmentOptions.map((environment) => [
          environment.id,
          environment.revisionNumber != null
            ? `${environment.label} · r${environment.revisionNumber}`
            : environment.label,
        ]),
      ),
    [environmentOptions],
  );
  const milestoneOptions = (milestonesQuery.data?.items ?? []).map((milestone) => ({
    id: milestone.id,
    label: milestone.name,
  }));
  const milestoneLabelById = new Map(milestoneOptions.map((item) => [item.id, item.label]));
  const filteredRuns = runs;

  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedStatuses,
    selectedEnvironmentIds,
    selectedMilestoneIds,
    debouncedSearchQuery,
    createdFrom,
    createdTo,
    hasDateRangeError,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [sorting.column, sorting.direction]);

  const handleSortingChange = useCallback(
    (next: UnifiedTableSorting<TestRunColumn>) => {
      setSorting(next);
    },
    [setSorting],
  );
  const hasPeriodFilter = Boolean(createdFrom || createdTo);
  const activeFiltersCount =
    selectedStatuses.size + selectedEnvironmentIds.size + selectedMilestoneIds.size + (hasPeriodFilter ? 1 : 0);
  const selectedRun = useMemo(
    () => (selectedRunId ? runs.find((run) => run.id === selectedRunId) ?? null : null),
    [runs, selectedRunId],
  );

  const datePeriodLabel = useMemo(() => {
    if (selectedPeriodPreset === "all") return "All time";
    if (selectedPeriodPreset === "7d") return "Last 7 days";
    if (selectedPeriodPreset === "30d") return "Last 30 days";
    if (selectedPeriodPreset === "90d") return "Last 90 days";
    if (selectedPeriodPreset === "180d") return "Last 180 days";
    if (createdFrom || createdTo) return `${createdFrom || "Start"} - ${createdTo || "Now"}`;
    return "Custom";
  }, [createdFrom, createdTo, selectedPeriodPreset]);

  const handlePeriodPresetSelect = useCallback((preset: TestRunsPeriodPreset) => {
    if (preset === "all") {
      setSelectedPeriodPreset("all");
      setCreatedFrom("");
      setCreatedTo("");
      return;
    }
    if (preset === "custom") {
      setSelectedPeriodPreset("custom");
      return;
    }

    let days = 180;
    if (preset === "7d") days = 7;
    else if (preset === "30d") days = 30;
    else if (preset === "90d") days = 90;
    const range = getRelativeRange(days);
    setSelectedPeriodPreset(preset);
    setCreatedFrom(range.from);
    setCreatedTo(range.to);
  }, []);

  const handleCreatedFromChange = useCallback((value: string) => {
    setCreatedFrom(value);
    setSelectedPeriodPreset("custom");
  }, []);

  const handleCreatedToChange = useCallback((value: string) => {
    setCreatedTo(value);
    setSelectedPeriodPreset("custom");
  }, []);

  const handleCreateRun = useCallback(async (payload: CreateTestRunPayload, startImmediately: boolean) => {
    if (!projectId || createRunMutation.isPending) return;

    const normalizedPayload = normalizeCreateRunPayload(payload);

    if (!normalizedPayload.name) {
      notifyError("Run name is required.", "Failed to create run.");
      return;
    }

    try {
      const createdRun = await createRunMutation.mutateAsync({
        project_id: projectId,
        name: normalizedPayload.name,
        description: normalizedPayload.description,
        environment_id: normalizedPayload.environment_id,
        milestone_id: normalizedPayload.milestone_id,
        build: normalizedPayload.build,
        assignee: normalizedPayload.assignee,
      });

      if (normalizedPayload.selectedCaseIds.length > 0) {
        await addRunCasesMutation.mutateAsync({
          runId: createdRun.id,
          payload: { test_case_ids: normalizedPayload.selectedCaseIds },
        });
      }
      for (const suiteId of normalizedPayload.selectedSuiteIds) {
        await addRunCasesMutation.mutateAsync({
          runId: createdRun.id,
          payload: { suite_id: suiteId },
        });
      }

      const startedRun = startImmediately
        ? await setTestRunStatusMutation.mutateAsync({ runId: createdRun.id, status: "in_progress" })
        : createdRun;

      await testRunsPageQuery.refetch();
      notifySuccess(`Run "${startedRun.name}" created`);
      closeCreateRun();
      navigate(`/projects/${projectId}/test-runs/${startedRun.id}`);
    } catch (error) {
      notifyError(error, "Failed to create run.");
    }
  }, [addRunCasesMutation, closeCreateRun, createRunMutation, navigate, projectId, setTestRunStatusMutation, testRunsPageQuery]);

  const selectedImportRun = useMemo(
    () => (junitImportRunId ? runs.find((run) => run.id === junitImportRunId) ?? null : null),
    [junitImportRunId, runs],
  );

  const handleJunitFileChange = useCallback((file: File | null) => {
    setSelectedJunitFile(file);
    setJunitPreview(null);
  }, []);

  const handleProjectJunitFileChange = useCallback((file: File | null) => {
    setProjectJunitFile(file);
    setProjectJunitResult(null);
  }, []);

  const handleOpenProjectJunitImport = useCallback(() => {
    setProjectJunitImportOpen(true);
    setProjectJunitFile(null);
    setProjectJunitResult(null);
    setProjectCreateMissingCases(false);
  }, []);

  const handleCloseProjectJunitImport = useCallback(() => {
    if (importProjectJunitXmlMutation.isPending) return;
    setProjectJunitImportOpen(false);
    setProjectJunitFile(null);
    setProjectJunitResult(null);
    setProjectCreateMissingCases(false);
  }, [importProjectJunitXmlMutation.isPending]);

  const handleImportProjectJunitXml = useCallback(async () => {
    if (!projectId || !projectJunitFile) return;
    try {
      const result = await importProjectJunitXmlMutation.mutateAsync({
        projectId,
        file: projectJunitFile,
        createMissingCases: projectCreateMissingCases,
      });
      setProjectJunitResult(result);
      notifySuccess(
        result.target_run?.match_mode === "created"
          ? `JUnit XML imported into new run "${result.target_run.name}".`
          : `JUnit XML imported into run "${result.target_run?.name ?? result.test_run_id}".`
      );
      setProjectJunitImportOpen(false);
      navigate(`/projects/${projectId}/test-runs/${result.test_run_id}`);
    } catch (error) {
      notifyError(error, "Failed to import JUnit XML.");
    }
  }, [importProjectJunitXmlMutation, navigate, projectCreateMissingCases, projectId, projectJunitFile]);

  const handleOpenJunitImport = useCallback((runId: string) => {
    const run = runs.find((item) => item.id === runId);
    if (!run || !canImportJunitIntoRun(run.status)) return;
    setJunitImportRunId(runId);
    setSelectedJunitFile(null);
    setJunitPreview(null);
    setCreateMissingCases(false);
    setOpenActionsRunId(null);
  }, [runs]);

  const handleCloseJunitImport = useCallback(() => {
    if (importJunitXmlMutation.isPending) return;
    setJunitImportRunId(null);
    setSelectedJunitFile(null);
    setJunitPreview(null);
    setCreateMissingCases(false);
  }, [importJunitXmlMutation.isPending]);

  const handlePreviewJunitImport = useCallback(async () => {
    if (!projectId || !junitImportRunId || !selectedJunitFile) return;
    try {
      const preview = await importJunitXmlMutation.mutateAsync({
        runId: junitImportRunId,
        projectId,
        file: selectedJunitFile,
        dryRun: true,
        createMissingCases,
      });
      setJunitPreview(preview);
      notifySuccess("JUnit XML preview generated.");
    } catch (error) {
      notifyError(error, "Failed to preview JUnit XML import.");
    }
  }, [createMissingCases, importJunitXmlMutation, junitImportRunId, projectId, selectedJunitFile]);

  const handleImportJunitXml = useCallback(async () => {
    if (!projectId || !junitImportRunId || !selectedJunitFile) return;
    try {
      const result = await importJunitXmlMutation.mutateAsync({
        runId: junitImportRunId,
        projectId,
        file: selectedJunitFile,
        dryRun: false,
        createMissingCases,
      });
      setJunitPreview(result);
      notifySuccess(`JUnit XML imported. Updated ${result.summary.updated} run item(s).`);
    } catch (error) {
      notifyError(error, "Failed to import JUnit XML.");
    }
  }, [createMissingCases, importJunitXmlMutation, junitImportRunId, projectId, selectedJunitFile]);

  const handleRunFlowAction = useCallback(async (run: RunView | RunDetailsSidePanelRun) => {
    const flowAction = getRunFlowAction(run.status);
    if (!flowAction || !projectId || actionRunId) return;

    try {
      setActionRunId(run.id);
      let status: "in_progress" | "completed" | "archived" = "archived";
      if (flowAction.key === "start") {
        status = "in_progress";
      } else if (flowAction.key === "complete") {
        status = "completed";
      }
      await setTestRunStatusMutation.mutateAsync({ runId: run.id, status });
      await testRunsPageQuery.refetch();
      notifySuccess(`Run "${run.name}" ${flowAction.successMessage}`);
    } catch (error) {
      notifyError(error, "Failed to update run status.");
    } finally {
      setActionRunId(null);
    }
  }, [actionRunId, projectId, setTestRunStatusMutation, testRunsPageQuery]);

  return {
    header: {
      title: "Test Runs",
      subtitle: "Manage test execution runs",
    },
    toolbar: {
      searchQuery,
      onSearchQueryChange: setSearchQuery,
      filtersOpen,
      onFiltersOpenChange: setFiltersOpen,
      activeFiltersCount,
      selectedStatuses,
      selectedEnvironments: selectedEnvironmentIds,
      selectedMilestones: selectedMilestoneIds,
      environments,
      milestones: milestoneOptions.map((milestone) => milestone.id),
      getEnvironmentLabel: (environmentId: string) => environmentLabelById.get(environmentId) ?? environmentId,
      getMilestoneLabel: (milestoneId: string) => milestoneLabelById.get(milestoneId) ?? milestoneId,
      selectedPeriodPreset,
      datePeriodLabel,
      createdFrom,
      createdTo,
      hasDateRangeError,
      onToggleStatus: (value: string) => toggleStringSet(setSelectedStatuses, value),
      onToggleEnvironment: (value: string) => toggleStringSet(setSelectedEnvironmentIds, value),
      onToggleMilestone: (value: string) => toggleStringSet(setSelectedMilestoneIds, value),
      onPeriodPresetSelect: handlePeriodPresetSelect,
      onCreatedFromChange: handleCreatedFromChange,
      onCreatedToChange: handleCreatedToChange,
      onClearAllFilters: () => {
        setSelectedStatuses(new Set());
        setSelectedEnvironmentIds(new Set());
        setSelectedMilestoneIds(new Set());
        setSelectedPeriodPreset("all");
        setCreatedFrom("");
        setCreatedTo("");
        setFiltersOpen(false);
        setCurrentPage(1);
      },
    },
    actions: {
      onNewRunClick: openCreateRun,
      onImportJunitClick: handleOpenProjectJunitImport,
    },
    table: {
      projectId,
      runs: filteredRuns,
      visibleColumns,
      columnsOpen,
      selectedRunId,
      openActionsRunId,
      actionRunId,
      resolveUserName,
      onColumnsOpenChange: setColumnsOpen,
      onToggleColumn: toggleColumn,
      sorting,
      onSortingChange: handleSortingChange,
      pagination: tablePagination,
      onRowClick: (runId: string) => setSelectedRunId((current) => (current === runId ? null : runId)),
      onOpenActionsChange: setOpenActionsRunId,
      onRunFlowAction: handleRunFlowAction,
      onImportJunit: handleOpenJunitImport,
      isLoading:
        Boolean(projectId) &&
        (testRunsPageQuery.isPending ||
          (testRunsPageQuery.isFetching && runs.length === 0 && testRunsPageQuery.data === undefined)),
    },
    details: selectedRun
      ? {
          run: selectedRun,
          onClose: () => setSelectedRunId(null),
          onOpenFull: (runId: string) => navigate(`/projects/${projectId}/test-runs/${runId}`),
          onRunFlowAction: handleRunFlowAction,
          onImportJunit: () => handleOpenJunitImport(selectedRun.id),
          actionRunId,
          resolveUserName,
        }
      : null,
    createRun: {
      isOpen: createRunOpen,
      loading: createRunMutation.isPending || addRunCasesMutation.isPending || setTestRunStatusMutation.isPending,
      projectId,
      suites: [],
      testCases: [],
      assigneeOptions,
      environmentOptions,
      milestoneOptions,
      onClose: closeCreateRun,
      onSubmit: (payload: CreateTestRunPayload, startImmediately: boolean) =>
        invokeMaybeAsync(() => handleCreateRun(payload, startImmediately)),
    },
    junitImportDialog: {
      isOpen: Boolean(selectedImportRun),
      selectedFile: selectedJunitFile,
      preview: junitPreview,
      previewLoading: importJunitXmlMutation.isPending,
      importLoading: importJunitXmlMutation.isPending,
      createMissingCases,
      onClose: handleCloseJunitImport,
      onFileChange: handleJunitFileChange,
      onCreateMissingCasesChange: setCreateMissingCases,
      onPreview: () => invokeMaybeAsync(() => handlePreviewJunitImport()),
      onImport: () => invokeMaybeAsync(() => handleImportJunitXml()),
    },
    projectJunitImportDialog: {
      isOpen: projectJunitImportOpen,
      selectedFile: projectJunitFile,
      preview: projectJunitResult,
      previewLoading: false,
      importLoading: importProjectJunitXmlMutation.isPending,
      showPreview: false,
      createMissingCases: projectCreateMissingCases,
      onClose: handleCloseProjectJunitImport,
      onFileChange: handleProjectJunitFileChange,
      onCreateMissingCasesChange: setProjectCreateMissingCases,
      onPreview: () => undefined,
      onImport: () => invokeMaybeAsync(() => handleImportProjectJunitXml()),
    },
  };
}
