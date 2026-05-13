// Composes test run overview: items table, snapshot, status modal, and run actions.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  formatRelativeTime,
  type RunCaseDto,
  type RunReportExportFormat,
  useProjectMembersQuery,
  useUnlinkJiraIssueMutation,
} from "@/shared/api";
import { getSessionUser } from "@/shared/auth";
import { useColumnVisibility, useDisclosure } from "@/shared/hooks";
import { useDeleteConfirmation } from "@/shared/lib/use-delete-confirmation";
import { invokeMaybeAsync } from "@/shared/lib/invoke-maybe-async";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import { BulkSelectionToolbarActions } from "@/shared/ui";
import type { UnifiedTableSorting } from "@/shared/ui/Table";
import type { RunItemColumn, RunOverviewRow } from "@/modules/test-runs/components";
import { canImportJunitIntoRun } from "@/modules/test-runs/constants";
import { useTestRunData } from "./use-test-run-data";
import { useTestRunFilters } from "./use-test-run-filters";
import { useTestRunHeaderActions } from "./use-test-run-header-actions";
import { useTestRunItemDetails } from "./use-test-run-item-details";
import { useTestRunMutations } from "./use-test-run-mutations";
import { useTestRunSelection } from "./use-test-run-selection";
import type { StatusUpdatePayload } from "./use-update-run-item-status-form-state";

// Default visible columns for run items table
const DEFAULT_VISIBLE_RUN_ITEM_COLUMNS: RunItemColumn[] = [
  "title",
  "tags",
  "suite",
  "status",
  "assignee",
  "lastExecuted",
];

export function useTestRunOverviewPage() {
  const { confirmDelete } = useDeleteConfirmation();
  const { projectId, runId } = useParams();
  const navigate = useNavigate();

  const projectMembersQuery = useProjectMembersQuery(projectId);
  const sessionUser = getSessionUser();
  const userNamesById = useMemo(() => {
    const names = new Map(
      (projectMembersQuery.data ?? []).map((member) => [member.user_id, member.username ?? "Unknown user"]),
    );
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

  // Table UI: columns, filters, selection, dialogs
  const { isOpen: columnsOpen, setIsOpen: setColumnsOpen } = useDisclosure(false);
  const { visibleColumns, toggleColumn } = useColumnVisibility<RunItemColumn>(DEFAULT_VISIBLE_RUN_ITEM_COLUMNS);
  const [sorting, setSorting] = useState<UnifiedTableSorting<RunItemColumn>>({
    column: "lastExecuted",
    direction: "desc",
  });
  const [addRunItemsOpen, setAddRunItemsOpen] = useState(false);
  const [runItemsBulkEditOpen, setRunItemsBulkEditOpen] = useState(false);

  const {
    filtersOpen,
    setFiltersOpen,
    searchFilter,
    setSearchFilter,
    selectedStatuses,
    selectedAssignees,
    activeFiltersCount,
    handleStatusCardClick,
    toggleStatusFilter,
    toggleAssigneeFilter,
    clearAllFilters,
  } = useTestRunFilters();
  const statusFilters = useMemo(
    () => (selectedStatuses.size > 0 ? Array.from(selectedStatuses) : undefined),
    [selectedStatuses],
  );

  const {
    run,
    runCasesPageQuery,
    items,
    rows,
    runCaseIds,
    hasMoreRunCases,
    total,
    passed,
    error,
    failure,
    blocked,
    inProgress,
    skipped,
    xfailed,
    xpassed,
    untested,
    progress,
    passRate,
    progressSegments,
    handleLoadMoreRunCases,
  } = useTestRunData({
    runId,
    sorting,
    statuses: statusFilters,
    search: searchFilter.trim() || undefined,
  });

  const assigneeOptions = useMemo(
    () => [...new Set(rows.map((item) => item.assignee))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const normalizedSearchFilter = searchFilter.trim().toLowerCase();
  const filteredRows = useMemo(
    () =>
      rows.filter((item) => {
        const matchesSearch =
          !normalizedSearchFilter ||
          item.title.toLowerCase().includes(normalizedSearchFilter) ||
          item.key.toLowerCase().includes(normalizedSearchFilter);
        const matchesStatus = selectedStatuses.size === 0 || selectedStatuses.has(item.status);
        const matchesAssignee = selectedAssignees.size === 0 || selectedAssignees.has(item.assignee);
        return matchesSearch && matchesStatus && matchesAssignee;
      }),
    [normalizedSearchFilter, rows, selectedAssignees, selectedStatuses],
  );

  const ensureStepsLoaded = useCallback((_testCaseId: string) => {
    // Steps are loaded via useTestCaseStepsQuery when selectedRunItemId or statusModalRunItemId is set
  }, []);

  const ensureRunResultsLoaded = useCallback((_runItemId: string, _force?: boolean) => {
    // Results are loaded via useRunItemResultsQuery when selectedRunItemId is set
  }, []);

  const {
    selectedRunItemId,
    setSelectedRunItemId,
    selectedRunItemIds,
    setSelectedRunItemIds,
    openActionsRunItemId,
    setOpenActionsRunItemId,
    setStatusModalRunItemId,
    selectedRow,
    statusModalRow,
    handleToggleRunItemSelection,
    handleToggleSelectAllRunItems,
  } = useTestRunSelection({ rows, filteredRows });

  useEffect(() => {
    setSelectedRunItemIds(new Set());
  }, [searchFilter, selectedStatuses, selectedAssignees, setSelectedRunItemIds]);

  const bulkSelectedRows = useMemo(
    () => rows.filter((row) => selectedRunItemIds.has(row.id)),
    [rows, selectedRunItemIds],
  );
  const bulkSharedTestCaseId = useMemo(() => {
    if (bulkSelectedRows.length === 0) return null;
    const firstId = bulkSelectedRows[0]!.testCaseId;
    return bulkSelectedRows.every((row) => row.testCaseId === firstId) ? firstId : null;
  }, [bulkSelectedRows]);
  const bulkFormInitialStatus = useMemo((): RunCaseDto["status"] => {
    if (bulkSelectedRows.length === 0) return "untested";
    const first = bulkSelectedRows[0]!.status;
    return bulkSelectedRows.every((row) => row.status === first) ? first : "untested";
  }, [bulkSelectedRows]);
  const bulkStepsCaseId = runItemsBulkEditOpen ? bulkSharedTestCaseId : null;

  const {
    selectedSnapshot,
    selectedRunHistory,
    historyLoading,
    statusModalSteps,
    bulkModalSteps,
    stepsByCaseId,
    snapshotStepsLoading,
  } = useTestRunItemDetails({
    run,
    selectedRunItemId,
    selectedRow,
    statusModalRow,
    bulkStepsCaseId,
  });

  // Row / snapshot actions
  const handleOpenSnapshot = (item: RunOverviewRow) => {
    setOpenActionsRunItemId(null);
    setSelectedRunItemId(item.id);
    ensureStepsLoaded(item.testCaseId);
    ensureRunResultsLoaded(item.id, true);
  };

  const runItemStatusLocked = run?.status === "completed" || run?.status === "archived";
  const runItemStatusLockedReason = runItemStatusLocked
    ? "Run item updates are disabled when a test run is completed or archived."
    : undefined;
  const canAddRunItems = run?.status === "not_started" || run?.status === "in_progress";
  const addRunItemsDisabledReason = !canAddRunItems
    ? "New run items can be added only when run status is Not Started or In Progress."
    : undefined;

  const {
    removeRunItemLoadingId,
    handleBulkUpdateStatus,
    handleRemoveRunItemFromRun,
    handleBulkDeleteRunItems,
    handleOpenStatusModal,
    handleUpdateStatus,
    handleAddRunItems,
    addRunCasesMutation,
    patchRunCaseMutation,
    deleteRunCaseMutation,
  } = useTestRunMutations({
    runId,
    rows,
    selectedRunItemIds,
    stepsByCaseId,
    canAddRunItems,
    runItemStatusLocked,
    statusModalRow,
    statusModalSteps,
    confirmDelete,
    setSelectedRunItemIds,
    setOpenActionsRunItemId,
    setSelectedRunItemId,
    setStatusModalRunItemId,
    setRunItemsBulkEditOpen,
    ensureStepsLoaded,
    onAddRunItemsSuccess: () => setAddRunItemsOpen(false),
  });

  useEffect(() => {
    if (selectedRunItemIds.size === 0) setRunItemsBulkEditOpen(false);
  }, [selectedRunItemIds.size]);

  const unlinkJiraIssueMutation = useUnlinkJiraIssueMutation();
  const currentProjectRole =
    sessionUser?.role === "admin"
      ? "manager"
      : sessionUser?.project_memberships.find((membership) => membership.project_id === projectId)?.role ?? null;
  const canManageJira =
    currentProjectRole === "tester" || currentProjectRole === "lead" || currentProjectRole === "manager";

  const {
    nextRunStatusAction,
    runStatusUpdateLoading,
    reportExportLoadingFormat,
    junitImportOpen,
    selectedJunitFile,
    junitPreview,
    createMissingCases,
    junitImportLoading,
    handleRunStatusTransition,
    handleExportRunReport,
    setJunitImportOpen,
    setSelectedJunitFile,
    setCreateMissingCases,
    handlePreviewJunitImport,
    handleImportJunitXml,
    handleCloseJunitImport,
  } = useTestRunHeaderActions({ projectId, runId, run });

  // View-model sections for the overview page
  return {
    container: {
      projectId,
    },
    header: {
      projectId,
      run,
      resolveUserName,
      nextRunStatusAction,
      runStatusUpdateLoading,
      addRunItemsLoading: addRunCasesMutation.isPending,
      canAddRunItems,
      addableTestCasesCount: undefined,
      addRunItemsDisabledReason,
      reportExportLoadingFormat,
      junitImportLoading,
      onRunStatusTransition: () => invokeMaybeAsync(() => handleRunStatusTransition()),
      onImportJunitClick: () => {
        if (!run || !canImportJunitIntoRun(run.status)) return;
        setJunitImportOpen(true);
      },
      onAddRunItemsClick: () => setAddRunItemsOpen(true),
      onExportReport: (format: RunReportExportFormat) => invokeMaybeAsync(() => handleExportRunReport(format)),
      formatRelativeTime,
    },
    statusCards: {
      total,
      passed,
      error,
      failure,
      blocked,
      inProgress,
      skipped,
      xfailed,
      xpassed,
      untested,
      selectedStatuses,
      onStatusCardClick: handleStatusCardClick,
    },
    progress: {
      progress,
      passRate,
      segments: progressSegments,
    },
    toolbar: {
      filtersOpen,
      onFiltersOpenChange: setFiltersOpen,
      activeFiltersCount,
      onClearFilters: clearAllFilters,
      searchFilter,
      onSearchFilterChange: setSearchFilter,
      selectedStatuses,
      onToggleStatusFilter: toggleStatusFilter,
      selectedAssignees,
      onToggleAssigneeFilter: toggleAssigneeFilter,
      assigneeOptions,
      loadedItemsCount: items.length,
      totalItemsCount: total,
      hasMoreRunItems: hasMoreRunCases,
      bulkToolbarSlot:
        selectedRunItemIds.size > 0 ? (
          <BulkSelectionToolbarActions
            selectedCount={selectedRunItemIds.size}
            busy={
              patchRunCaseMutation.isPending ||
              deleteRunCaseMutation.isPending
            }
            onEdit={() => {
              setStatusModalRunItemId(null);
              setRunItemsBulkEditOpen(true);
            }}
            onDelete={() => invokeMaybeAsync(() => handleBulkDeleteRunItems())}
            onClearSelection={() => setSelectedRunItemIds(new Set())}
          />
        ) : null,
    },
    bulkActions: {
      isOpen: runItemsBulkEditOpen && selectedRunItemIds.size > 0,
      loading: patchRunCaseMutation.isPending,
      currentStatus: bulkFormInitialStatus,
      testCaseKey: "",
      testCaseTitle: "",
      descriptionOverride: `Applying to ${selectedRunItemIds.size} selected run item(s)`,
      testSteps: bulkModalSteps,
      onClose: () => setRunItemsBulkEditOpen(false),
      onUpdate: (payload: StatusUpdatePayload) => invokeMaybeAsync(() => handleBulkUpdateStatus(payload)),
      runItemStatusLocked,
      runItemStatusLockedReason,
    },
    table: {
      rows: filteredRows,
      isLoading: runCasesPageQuery.isLoading,
      loadingMessage: "Loading run items…",
      loadedItemsCount: items.length,
      totalItemsCount: total,
      hasMoreRunItems: hasMoreRunCases,
      runItemsLoadingMore: runCasesPageQuery.isFetchingNextPage,
      selectedRunItemIds,
      openActionsRunItemId,
      runItemStatusLocked,
      removeRunItemLoadingId,
      projectId,
      visibleColumns,
      columnsOpen,
      onColumnsOpenChange: setColumnsOpen,
      onToggleColumn: toggleColumn,
      sorting,
      onSortingChange: setSorting,
      onRowClick: handleOpenSnapshot,
      onToggleSelectAll: handleToggleSelectAllRunItems,
      onToggleRow: handleToggleRunItemSelection,
      onOpenActionsChange: setOpenActionsRunItemId,
      onOpenDetails: handleOpenSnapshot,
      onOpenTestCase: (item: RunOverviewRow) => navigate(`/projects/${projectId}/test-cases/${item.testCaseId}`),
      onAddResult: handleOpenStatusModal,
      onRemove: (runItemId: string) => invokeMaybeAsync(() => handleRemoveRunItemFromRun(runItemId)),
      onLoadMore: () => invokeMaybeAsync(() => handleLoadMoreRunCases()),
    },
    snapshot: {
      isOpen: Boolean(selectedSnapshot),
      snapshot: selectedSnapshot,
      stepsLoading: snapshotStepsLoading,
      history: selectedRunHistory,
      historyLoading,
      onClose: () => setSelectedRunItemId(null),
      canUpdateStatus: !runItemStatusLocked,
      canRemove: !runItemStatusLocked,
      canManageJira: !runItemStatusLocked && canManageJira,
      jiraActionLoading: unlinkJiraIssueMutation.isPending,
      removeLoading: removeRunItemLoadingId === selectedRunItemId,
      updateStatusDisabledReason: runItemStatusLockedReason,
      onUpdateStatus: (runItemId: string) => {
        setSelectedRunItemId(null);
        handleOpenStatusModal(runItemId);
      },
      onRemove: (runItemId: string) => invokeMaybeAsync(() => handleRemoveRunItemFromRun(runItemId)),
      onUnlinkJiraIssue: async (linkId: string) => {
        if (!selectedSnapshot) return;
        try {
          await unlinkJiraIssueMutation.mutateAsync({
            linkId,
            ownerType: "run_case",
            ownerId: selectedSnapshot.runItemId,
          });
          notifySuccess("Jira issue unlinked.");
        } catch (error) {
          notifyError(error, "Failed to unlink Jira issue.");
        }
      },
    },
    statusDialog: {
      isOpen: Boolean(statusModalRow),
      loading: patchRunCaseMutation.isPending,
      currentStatus: statusModalRow?.status ?? "untested",
      testCaseKey: statusModalRow?.key ?? "",
      testCaseTitle: statusModalRow?.title ?? "",
      testSteps: statusModalSteps,
      onClose: () => setStatusModalRunItemId(null),
      onUpdate: (payload: StatusUpdatePayload) => invokeMaybeAsync(() => handleUpdateStatus(payload)),
    },
    addRunItemsDialog: {
      isOpen: addRunItemsOpen,
      projectId,
      excludeTestCaseIds: runCaseIds,
      loading: addRunCasesMutation.isPending,
      onClose: () => setAddRunItemsOpen(false),
      onSubmit: (testCaseIds: string[]) => invokeMaybeAsync(() => handleAddRunItems(testCaseIds)),
    },
    junitImportDialog: {
      isOpen: junitImportOpen,
      selectedFile: selectedJunitFile,
      preview: junitPreview,
      previewLoading: junitImportLoading,
      importLoading: junitImportLoading,
      createMissingCases,
      onClose: handleCloseJunitImport,
      onFileChange: setSelectedJunitFile,
      onCreateMissingCasesChange: setCreateMissingCases,
      onPreview: () => invokeMaybeAsync(() => handlePreviewJunitImport()),
      onImport: () => invokeMaybeAsync(() => handleImportJunitXml()),
    },
  };
}
