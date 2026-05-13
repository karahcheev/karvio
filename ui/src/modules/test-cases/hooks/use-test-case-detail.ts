import { useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import {
  useAiTestCaseStatusQuery,
  useLinkJiraIssueMutation,
  useReviewAiTestCaseMutation,
  useUnlinkJiraIssueMutation,
  type ExternalIssueLinkDto,
  type ReviewAiTestCaseResponseDto,
} from "@/shared/api";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import { useTestCaseDetailData } from "./use-test-case-detail-data";
import { useTestCaseEditorState } from "./use-test-case-editor-state";
import { useTestCasePermissions } from "./use-test-case-permissions";
import { useTestCaseAttachments } from "./use-test-case-attachments";
import { useTestCaseCloneWizard } from "./use-test-case-clone-wizard";
import { useTestCaseActions } from "./use-test-case-actions";
import { useTestCaseDatasets } from "./use-test-case-datasets";

export function useTestCaseDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId, testCaseId } = useParams();
  const [activeTab, setActiveTab] = useState<"details" | "attachments" | "datasets" | "results-history" | "defects">(() => {
    const tab = new URLSearchParams(location.search).get("tab");
    if (
      tab === "details" ||
      tab === "attachments" ||
      tab === "datasets" ||
      tab === "results-history" ||
      tab === "defects"
    ) {
      return tab;
    }
    return "details";
  });
  const isEditMode = location.hash === "#edit";
  const data = useTestCaseDetailData(isEditMode, isEditMode);
  const editor = useTestCaseEditorState({
    ...data,
    initialSnapshot: data.initialSnapshot,
  });
  const permissions = useTestCasePermissions(data.currentProjectRole, data.persistedStatus);
  const attachments = useTestCaseAttachments({
    steps: data.steps,
    testCaseAttachments: data.testCaseAttachments,
    setTestCaseAttachments: data.setTestCaseAttachments,
    stepAttachments: data.stepAttachments,
    setStepAttachments: data.setStepAttachments,
  });
  const cloneWizard = useTestCaseCloneWizard({
    title: data.title,
    time: data.time,
    preconditions: data.preconditions,
    priority: data.priority,
    testCaseType: data.testCaseType,
    ownerId: data.ownerId,
    suiteId: data.suiteId,
    tags: data.tags,
    steps: data.steps,
    testCaseAttachments: data.testCaseAttachments,
    stepAttachments: data.stepAttachments,
  });
  const datasets = useTestCaseDatasets(projectId, testCaseId, {
    enabled: activeTab === "datasets",
    initialDatasetsCount: data.datasetsCount,
  });
  const actions = useTestCaseActions({
    title: data.title,
    key: data.key,
    locationSearch: location.search,
    savedSnapshot: editor.savedSnapshot,
    setSavedSnapshot: editor.setSavedSnapshot,
    status: data.status,
    setStatus: data.setStatus,
    persistedStatus: data.persistedStatus,
    setPersistedStatus: data.setPersistedStatus,
    setUpdatedAt: data.setUpdatedAt,
    onEditStart: () => {
      editor.handleEditStart();
    },
  });

  const [tagInput, setTagInput] = useState("");
  const caseAttachmentInputRef = useRef<HTMLInputElement>(null);
  const linkJiraIssueMutation = useLinkJiraIssueMutation();
  const unlinkJiraIssueMutation = useUnlinkJiraIssueMutation();
  const aiStatusQuery = useAiTestCaseStatusQuery(projectId);
  const reviewAiMutation = useReviewAiTestCaseMutation();
  const [aiReview, setAiReview] = useState<ReviewAiTestCaseResponseDto | null>(null);
  const envAiEnabled = import.meta.env.VITE_AI_TEST_CASE_ASSISTANT_ENABLED === "true";
  const aiEnabled = Boolean(aiStatusQuery.data?.enabled || envAiEnabled);
  const canManageExternalIssues =
    data.currentProjectRole === "tester" || data.currentProjectRole === "lead" || data.currentProjectRole === "manager";

  const addTag = () => editor.addTag(tagInput, setTagInput);
  const handleLinkExternalIssue = async (issueKeyOrUrl: string) => {
    if (!testCaseId) return;
    try {
      const link = await linkJiraIssueMutation.mutateAsync({
        owner_type: "test_case",
        owner_id: testCaseId,
        issue_key_or_url: issueKeyOrUrl,
      });
      data.setExternalIssues((previous) => {
        if (previous.some((item) => item.id === link.id)) return previous;
        return [link, ...previous];
      });
      notifySuccess("Jira issue linked.");
    } catch (error) {
      notifyError(error, "Failed to link Jira issue.");
    }
  };
  const handleUnlinkExternalIssue = async (linkId: string) => {
    if (!testCaseId) return;
    try {
      await unlinkJiraIssueMutation.mutateAsync({
        linkId,
        ownerType: "test_case",
        ownerId: testCaseId,
        projectId: projectId ?? undefined,
      });
      data.setExternalIssues((previous) => previous.filter((item) => item.id !== linkId));
      notifySuccess("Jira issue unlinked.");
    } catch (error) {
      notifyError(error, "Failed to unlink Jira issue.");
    }
  };
  const handleUnlinkDefectIssue = async (issue: ExternalIssueLinkDto) => {
    try {
      await unlinkJiraIssueMutation.mutateAsync({
        linkId: issue.id,
        ownerType: issue.owner_type,
        ownerId: issue.owner_id,
        projectId: projectId ?? undefined,
      });
      if (issue.owner_type === "test_case") {
        data.setExternalIssues((previous) => previous.filter((item) => item.id !== issue.id));
      }
      notifySuccess("Jira issue unlinked.");
    } catch (error) {
      notifyError(error, "Failed to unlink Jira issue.");
    }
  };
  const handleOpenDatasetDetails = (datasetId: string) => {
    if (!projectId || !testCaseId) return;
    const fromUrl = `/projects/${projectId}/test-cases/${testCaseId}?tab=datasets${location.hash ?? ""}`;
    const search = new URLSearchParams();
    search.set("datasetId", datasetId);
    search.set("from", fromUrl);
    navigate({
      pathname: `/projects/${projectId}/datasets`,
      search: `?${search.toString()}`,
    });
  };
  const handleRunAiReview = async () => {
    if (!testCaseId) return;
    try {
      actions.closeActionsMenu();
      const review = await reviewAiMutation.mutateAsync({
        testCaseId,
        payload: { mode: "all" },
      });
      setAiReview(review);
    } catch (error) {
      notifyError(error, "Failed to review test case.");
    }
  };
  const handleApplyAiReviewField = (
    field: "title" | "preconditions" | "steps" | "priority" | "tags" | "component_coverages"
  ) => {
    if (!aiReview) return;
    if (!editor.isEditing) {
      editor.handleEditStart();
    }
    const revision = aiReview.suggested_revision;
    if (field === "title" && revision.title) data.setTitle(revision.title);
    if (field === "preconditions" && revision.preconditions !== null) data.setPreconditions(revision.preconditions);
    if (field === "steps" && revision.steps) {
      data.setTemplateType("steps");
      data.setSteps(
        revision.steps.map((step) => ({
          id: `local-${crypto.randomUUID()}`,
          action: step.action,
          expectedResult: step.expected_result,
          persisted: false,
        }))
      );
    }
    if (field === "priority" && revision.priority) data.setPriority(revision.priority);
    if (field === "tags" && revision.tags) data.setTags(revision.tags);
    if (field === "component_coverages" && revision.component_coverages) {
      data.setComponentCoverages(
        revision.component_coverages.map((coverage) => ({
          id: `local-${crypto.randomUUID()}`,
          componentId: coverage.component_id,
          coverageType: coverage.coverage_type,
          coverageStrength: coverage.coverage_strength,
          isMandatoryForRelease: coverage.is_mandatory_for_release,
          persisted: false,
        }))
      );
    }
  };

  return {
    projectId,
    testCaseId,
    activeTab,
    setActiveTab,
    location,
    aiEnabled,
    aiReview,
    isReviewingWithAi: reviewAiMutation.isPending,
    key: data.key,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    title: data.title,
    templateType: data.templateType,
    setTemplateType: data.setTemplateType,
    setTitle: data.setTitle,
    automationId: data.automationId,
    setAutomationId: data.setAutomationId,
    time: data.time,
    setTime: data.setTime,
    preconditions: data.preconditions,
    setPreconditions: data.setPreconditions,
    stepsText: data.stepsText,
    setStepsText: data.setStepsText,
    expected: data.expected,
    setExpected: data.setExpected,
    rawTest: data.rawTest,
    setRawTest: data.setRawTest,
    rawTestLanguage: data.rawTestLanguage,
    setRawTestLanguage: data.setRawTestLanguage,
    priority: data.priority,
    setPriority: data.setPriority,
    testCaseType: data.testCaseType,
    setTestCaseType: data.setTestCaseType,
    status: data.status,
    setStatus: data.setStatus,
    ownerId: data.ownerId,
    setOwnerId: data.setOwnerId,
    primaryProductId: data.primaryProductId,
    setPrimaryProductId: data.setPrimaryProductId,
    suiteId: data.suiteId,
    setSuiteId: data.setSuiteId,
    tags: data.tags,
    componentCoverages: data.componentCoverages,
    externalIssues: data.externalIssues,
    canManageExternalIssues,
    externalIssueActionLoading: linkJiraIssueMutation.isPending || unlinkJiraIssueMutation.isPending,
    tagInput,
    setTagInput,
    actionsMenuOpen: actions.actionsMenuOpen,
    setActionsMenuOpen: actions.setActionsMenuOpen,
    owners: data.owners,
    products: data.products,
    components: data.components,
    suites: data.suites,
    datasets: datasets.datasets,
    datasetsCount: datasets.count,
    canEditDatasets: datasets.canEditDatasets,
    canDeleteDatasets: datasets.canDeleteDatasets,
    availableDatasets: datasets.availableDatasets,
    availableDatasetsHasMore: datasets.availableDatasetsHasMore,
    isLoadingAvailableDatasets: datasets.isLoadingAvailableDatasets,
    isLoadingMoreAvailableDatasets: datasets.isLoadingMoreAvailableDatasets,
    handleLoadMoreAvailableDatasets: datasets.handleLoadMoreAvailableDatasets,
    bindDatasetSearch: datasets.bindSearch,
    setBindDatasetSearch: datasets.setBindSearch,
    boundDatasetsPagination: datasets.boundPagination,
    selectedExistingDatasetId: datasets.selectedExistingDatasetId,
    setSelectedExistingDatasetId: datasets.setSelectedExistingDatasetId,
    datasetDraft: datasets.draft,
    setDatasetDraft: datasets.setDraft,
    datasetsLoading: datasets.isLoading,
    datasetsSaving: datasets.isSaving,
    isCreatingDataset: datasets.isCreating,
    editingDatasetId: datasets.editingDatasetId,
    steps: data.steps,
    testCaseAttachments: data.testCaseAttachments,
    stepAttachments: data.stepAttachments,
    isLoading: data.isLoading,
    error: data.error,
    refetch: data.refetch,
    isSaving: editor.isSaving,
    isUploadingCaseAttachment: attachments.isUploadingCaseAttachment,
    uploadingStepId: attachments.uploadingStepId,
    isEditing: editor.isEditing,
    isCloneWizardOpen: cloneWizard.isCloneWizardOpen,
    isCloning: cloneWizard.isCloning,
    cloneWizardDraft: cloneWizard.cloneWizardDraft,
    setCloneWizardDraft: cloneWizard.setCloneWizardDraft,
    actionsMenuRef: actions.actionsMenuRef,
    caseAttachmentInputRef,
    ownerLabel: data.ownerLabel,
    productLabel: data.productLabel,
    suiteLabel: data.suiteLabel,
    availableStatusOptions: permissions.availableStatusOptions,
    addStep: editor.addStep,
    insertStepAfter: editor.insertStepAfter,
    removeStep: editor.removeStep,
    updateStep: editor.updateStep,
    moveStep: editor.moveStep,
    addTag,
    removeTag: editor.removeTag,
    addCoverage: editor.addCoverage,
    removeCoverage: editor.removeCoverage,
    updateCoverageComponent: editor.updateCoverageComponent,
    updateCoverageStrength: editor.updateCoverageStrength,
    updateCoverageMandatory: editor.updateCoverageMandatory,
    handleLinkExternalIssue,
    handleUnlinkExternalIssue,
    handleUnlinkDefectIssue,
    handleSave: editor.handleSave,
    handleEditStart: actions.handleEditStart,
    handleCancelEdit: editor.handleCancelEdit,
    handleCloneOpen: () => {
      cloneWizard.handleCloneOpen();
      actions.closeActionsMenu();
    },
    handleCloneClose: cloneWizard.handleCloneClose,
    addCloneTag: cloneWizard.addCloneTag,
    removeCloneTag: cloneWizard.removeCloneTag,
    handleCloneCreate: cloneWizard.handleCloneCreate,
    handleArchive: actions.handleArchive,
    handleDelete: actions.handleDelete,
    handleRunAiReview,
    handleApplyAiReviewField,
    handleCaseAttachmentUpload: attachments.handleCaseAttachmentUpload,
    handleCaseAttachmentDelete: attachments.handleCaseAttachmentDelete,
    handleCaseInlineImageUpload: attachments.handleCaseInlineImageUpload,
    handleStepInlineImageUpload: attachments.handleStepInlineImageUpload,
    handleDatasetCreateStart: datasets.handleCreateStart,
    handleDatasetEditStart: datasets.handleEditStart,
    handleDatasetCancelForm: datasets.handleCancelForm,
    handleDatasetSave: datasets.handleSave,
    handleBindExistingDataset: datasets.handleBindExisting,
    handleOpenDatasetDetails,
    handleUnbindDataset: datasets.handleUnbind,
    handleDeleteDataset: datasets.handleDelete,
  };
}
