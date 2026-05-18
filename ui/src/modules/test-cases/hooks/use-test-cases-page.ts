import { createElement, useCallback, useState } from "react";
import { useParams } from "react-router";
import { useDeleteTestCaseMutation } from "@/shared/api";
import { BulkSelectionToolbarActions } from "@/shared/ui";
import { useDeleteConfirmation } from "@/shared/lib/use-delete-confirmation";
import { getErrorMessage, notifyError, notifySuccess } from "@/shared/lib/notifications";
import type { TestCaseColumn, TestCaseListItem } from "../utils/types";
import { useTestCasesPageData } from "./use-test-cases-page-data";
import { useTestCasesSuiteTree } from "./use-test-cases-suite-tree";
import { useTestCasesFilters } from "./use-test-cases-filters";
import { useTestCasesSelection } from "./use-test-cases-selection";
import { useTestCasesCreate } from "./use-test-cases-create";
import { useTestCasesBulkActions } from "./use-test-cases-bulk-actions";
import { useTestCasesPreview } from "./use-test-cases-preview";

export function useTestCasesPage() {
  const { projectId } = useParams();
  const { confirmDelete } = useDeleteConfirmation();
  const deleteTestCaseMutation = useDeleteTestCaseMutation();

  const filters = useTestCasesFilters();
  const data = useTestCasesPageData({
    projectId,
    selectedStatuses: filters.selectedStatuses,
    selectedPriorities: filters.selectedPriorities,
    searchQuery: filters.searchQuery,
    sorting: filters.sorting,
  });

  const suiteTree = useTestCasesSuiteTree({
    suites: data.suites,
  });

  const selection = useTestCasesSelection();
  const create = useTestCasesCreate(suiteTree.selectedSuite, projectId);

  const preview = useTestCasesPreview(
    data.testCases,
    create.isCreatingTestCase,
    selection.openActionsTestId,
    selection.setOpenActionsTestId,
  );

  const bulkActions = useTestCasesBulkActions(
    projectId,
    selection.selectedTests,
    selection.setSelectedTests,
    preview.closePreview,
    () => selection.setOpenActionsTestId(() => null),
  );

  const [deletingTestCaseId, setDeletingTestCaseId] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<TestCaseColumn>>(
    new Set(["id", "title", "suite", "tags", "status", "priority"]),
  );
  const [columnsOpen, setColumnsOpen] = useState(false);

  const handleNewTestCaseClick = useCallback(() => {
    preview.closePreview();
    create.onNewTestCaseClick();
  }, [create, preview]);

  const handleDeleteTestCase = useCallback(
    async (testCase: TestCaseListItem) => {
      if (deletingTestCaseId) return;
      const confirmed = await confirmDelete({
        title: "Delete Test Case",
        description: `Delete test case "${testCase.title}"? This action cannot be undone.`,
        confirmLabel: "Delete Test Case",
      });
      if (!confirmed) return;

      try {
        setDeletingTestCaseId(testCase.testCaseId);
        await deleteTestCaseMutation.mutateAsync({
          testCaseId: testCase.testCaseId,
          projectId: projectId ?? undefined,
        });
        selection.setSelectedTests((current) => {
          const next = new Set(current);
          next.delete(testCase.testCaseId);
          return next;
        });
        selection.setOpenActionsTestId((current) => (current === testCase.testCaseId ? null : current));
        if (preview.previewTestId === testCase.testCaseId) {
          preview.closePreview();
        }
        notifySuccess(`Test case "${testCase.title}" deleted`);
      } catch (error) {
        notifyError(error, "Failed to delete test case.");
      } finally {
        setDeletingTestCaseId(null);
      }
    },
    [
      confirmDelete,
      deleteTestCaseMutation,
      deletingTestCaseId,
      projectId,
      preview,
      selection,
    ],
  );

  const toggleColumn = useCallback((column: TestCaseColumn) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      return next;
    });
  }, []);

  const handleSortingChange = useCallback(
    (nextSorting: Parameters<typeof filters.onSortingChange>[0]) => {
      filters.onSortingChange(nextSorting, () => data.setCurrentPage(1));
    },
    [data, filters],
  );

  const pages = data.testCasesPageQuery.data?.pages ?? [];
  const listLoading =
    Boolean(projectId) &&
    (data.testCasesPageQuery.isPending ||
      (data.testCasesPageQuery.isFetching && data.testCases.length === 0 && pages.length === 0));
  const listError =
    projectId && data.testCasesPageQuery.isError
      ? getErrorMessage(data.testCasesPageQuery.error, "Failed to load test cases.")
      : null;

  return {
    layout: {
      projectId,
    },
    suiteTree: {
      suites: suiteTree.suitesWithMeta,
      totalCount: data.allTestsTotal,
      isCollapsed: suiteTree.isSuitesSidebarCollapsed,
      selectedSuite: suiteTree.selectedSuite,
      expandedSuites: suiteTree.expandedSuites,
      isCreatingNewSuite: suiteTree.isCreatingNewSuite,
      creatingSuiteParentId: suiteTree.creatingSuiteParentId,
      newSuiteInputValue: suiteTree.newSuiteInputValue,
      setNewSuiteInputValue: suiteTree.setNewSuiteInputValue,
      onToggleCollapsed: () => suiteTree.setIsSuitesSidebarCollapsed((c) => !c),
      onSelectSuite: suiteTree.setSelectedSuite,
      onToggleSuite: suiteTree.toggleSuite,
      onNewSuiteClick: suiteTree.onNewSuiteClick,
      onDeleteSuite: (suiteId: string) => void suiteTree.onDeleteSuite(suiteId),
      canDeleteSuites: suiteTree.canDeleteSuites,
      onCreateSuite: () => void suiteTree.onCreateSuite(projectId),
      onCancelNewSuite: suiteTree.onCancelNewSuite,
    },
    list: {
      isLoading: listLoading,
      error: listError,
    },
    toolbar: {
      suites: suiteTree.suitesWithMeta,
      selectedSuite: suiteTree.selectedSuite,
      searchQuery: filters.searchQuery,
      setSearchQuery: filters.setSearchQuery,
      filtersOpen: filters.filtersOpen,
      setFiltersOpen: filters.setFiltersOpen,
      activeFiltersCount: filters.activeFiltersCount,
      selectedStatuses: filters.selectedStatuses,
      selectedPriorities: filters.selectedPriorities,
      onToggleFilter: filters.toggleFilter,
      setSelectedStatuses: filters.setSelectedStatuses,
      setSelectedPriorities: filters.setSelectedPriorities,
      onClearAllFilters: filters.clearAllFilters,
      onNewTestCaseClick: handleNewTestCaseClick,
      toolbarRightSlot:
        selection.selectedTests.size > 0
          ? createElement(BulkSelectionToolbarActions, {
              selectedCount: selection.selectedTests.size,
              busy: bulkActions.isApplying,
              onEdit: bulkActions.openBulkEditModal,
              onDelete: () => void bulkActions.onBulkDelete(),
              onClearSelection: selection.clearSelection,
            })
          : null,
    },
    bulkActions: {
      selectedCount: selection.selectedTests.size,
      bulkEditModalOpen: bulkActions.bulkEditModalOpen,
      onBulkEditModalOpenChange: bulkActions.onBulkEditModalOpenChange,
      bulkApplySuite: bulkActions.bulkApplySuite,
      bulkApplyStatus: bulkActions.bulkApplyStatus,
      bulkApplyOwner: bulkActions.bulkApplyOwner,
      bulkApplyTag: bulkActions.bulkApplyTag,
      bulkApplyPriority: bulkActions.bulkApplyPriority,
      bulkSuiteId: bulkActions.bulkSuiteId,
      bulkStatus: bulkActions.bulkStatus,
      bulkOwnerId: bulkActions.bulkOwnerId,
      bulkTag: bulkActions.bulkTag,
      bulkPriority: bulkActions.bulkPriority,
      suites: suiteTree.suitesWithMeta,
      ownerOptions: data.ownerOptions,
      isApplying: bulkActions.isApplying,
      onBulkApplySuiteChange: bulkActions.setBulkApplySuite,
      onBulkApplyStatusChange: bulkActions.setBulkApplyStatus,
      onBulkApplyOwnerChange: bulkActions.setBulkApplyOwner,
      onBulkApplyTagChange: bulkActions.setBulkApplyTag,
      onBulkApplyPriorityChange: bulkActions.setBulkApplyPriority,
      onBulkSuiteIdChange: bulkActions.setBulkSuiteId,
      onBulkStatusChange: bulkActions.setBulkStatus,
      onBulkOwnerIdChange: bulkActions.setBulkOwnerId,
      onBulkTagChange: bulkActions.setBulkTag,
      onBulkPriorityChange: bulkActions.setBulkPriority,
      onApply: bulkActions.onApply,
    },
    table: {
      projectId,
      tests: data.testCases,
      deletingTestCaseId,
      selectedTests: selection.selectedTests,
      visibleColumns,
      columnsOpen,
      openActionsTestId: selection.openActionsTestId,
      onDeleteTestCase: (testCase: TestCaseListItem) => void handleDeleteTestCase(testCase),
      onColumnsOpenChange: setColumnsOpen,
      onToggleColumn: toggleColumn,
      onToggleSelectAll: selection.toggleSelectAll,
      onToggleTestSelection: selection.toggleTestSelection,
      onRowClick: preview.onRowClick,
      onToggleActions: (testId: string) =>
        selection.setOpenActionsTestId((current) => (current === testId ? null : testId)),
      onCloseActions: () => selection.setOpenActionsTestId(null),
      sorting: filters.sorting,
      onSortingChange: handleSortingChange,
      pagination: {
        enabled: true,
        mode: "server" as const,
        page: data.currentPage,
        totalPages: data.totalPages,
        totalItems: data.listTotalItems,
        pageSize: data.pageSize,
        pageSizeOptions: [10, 25, 50],
        defaultPageSize: data.pageSize,
        onPageChange: (page: number) => {
          if (page === data.currentPage) return;
          if (page < 1) return;
          if (page > data.totalPages) return;
          data.setCurrentPage(page);
        },
        onPageSizeChange: (nextSize: number) => {
          if (nextSize === data.pageSize) return;
          data.setPageSize(nextSize);
        },
      },
    },
    createPanel: {
      isOpen: create.isCreatingTestCase,
      isSubmitting: create.isSubmittingCreate,
      projectId,
      ownerOptions: data.ownerOptions,
      selectedSuite: suiteTree.selectedSuite,
      suites: suiteTree.suitesWithMeta,
      newTestCase: create.newTestCase,
      setNewTestCase: create.setNewTestCase,
      onAddTag: create.onAddTag,
      onRemoveTag: create.onRemoveTag,
      onAddCoverage: create.onAddCoverage,
      onRemoveCoverage: create.onRemoveCoverage,
      onCoverageComponentChange: create.onCoverageComponentChange,
      onCoverageStrengthChange: create.onCoverageStrengthChange,
      onCoverageMandatoryChange: create.onCoverageMandatoryChange,
      onCancel: create.onCancelNewTestCase,
      onCreate: () => void create.onCreateTestCase(),
      productOptions: data.productOptions,
      componentOptions: data.componentOptions,
      onAddStep: create.onAddStep,
      onInsertStepAfter: create.onInsertStepAfter,
      onRemoveStep: create.onRemoveStep,
      onUpdateStep: create.onUpdateStep,
      onMoveStep: create.onMoveStep,
      uploadingStepId: create.uploadingStepId,
      onStepImageUpload: create.onStepImageUpload,
      onPreconditionsImageUpload: create.onPreconditionsImageUpload,
      aiEnabled: create.aiEnabled,
      aiSourceText: create.aiSourceText,
      aiDrafts: create.aiDrafts,
      aiWarnings: create.aiWarnings,
      duplicateWarnings: create.duplicateWarnings,
      isGeneratingAiDrafts: create.isGeneratingAiDrafts,
      isCheckingDuplicates: create.isCheckingDuplicates,
      onAiSourceTextChange: create.onAiSourceTextChange,
      onGenerateAiDrafts: create.onGenerateAiDrafts,
      onAcceptAiDraft: create.onAcceptAiDraft,
      onAcceptAllAiDrafts: create.onAcceptAllAiDrafts,
      onRejectAiDraft: create.onRejectAiDraft,
      onCheckDuplicates: create.onCheckDuplicates,
    },
    previewPanel: {
      isOpen: preview.isPreviewVisible,
      projectId,
      testCase: preview.previewTest,
      isDeleting: deletingTestCaseId === preview.previewTest?.testCaseId,
      onDelete: (testCase: TestCaseListItem) => void handleDeleteTestCase(testCase),
      onClose: preview.onClose,
    },
  };
}
