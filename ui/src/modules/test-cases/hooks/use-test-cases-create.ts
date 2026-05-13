import { useCallback, useState } from "react";
import {
  type AiDraftTestCaseDto,
  uploadDraftStepAttachment,
  uploadTestCaseAttachment,
  useAiTestCaseStatusQuery,
  useCheckAiDuplicatesMutation,
  useCreateTestCaseMutation,
  useGenerateAiTestCasesMutation,
  usePatchTestCaseMutation,
  useReplaceTestCaseStepsMutation,
} from "@/shared/api";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import type { NewTestCaseForm } from "../utils/types";
import { createDefaultNewTestCaseForm } from "../utils/newTestCaseForm";
import { createLocalCoverage, createLocalStep, normalizeCoveragesForSave, normalizeStepsForSave, validateFileSize } from "../utils/testCaseEditorUtils";
import { STEP_ATTACHMENT_LIMIT_BYTES } from "../utils/constants";

const DEFAULT_AI_FOCUS = ["functional", "negative", "boundary"] as const;

type PendingInlineImage = {
  alt: string;
  placeholder: string;
  file: File;
};

function buildCreateTestCasePayload(
  newTestCase: NewTestCaseForm,
  projectId: string,
  selectedSuite: string | null,
) {
  const trimmedPreconditions = newTestCase.templateType === "automated" ? null : newTestCase.preconditions.trim() || null;
  const componentCoverages = normalizeCoveragesForSave(
    newTestCase.componentCoverages.map((coverage) => ({ ...coverage, persisted: false }))
  );
  return {
    project_id: projectId,
    suite_id: selectedSuite,
    owner_id: newTestCase.ownerId === "unassigned" ? null : newTestCase.ownerId,
    primary_product_id: newTestCase.primaryProductId === "none" ? null : newTestCase.primaryProductId,
    automation_id: newTestCase.automationId.trim() || null,
    title: newTestCase.title,
    template_type: newTestCase.templateType,
    preconditions: trimmedPreconditions,
    steps_text: newTestCase.templateType === "text" ? newTestCase.stepsText.trim() || null : null,
    expected: newTestCase.templateType === "text" ? newTestCase.expected.trim() || null : null,
    raw_test: newTestCase.templateType === "automated" ? newTestCase.rawTest.trim() || null : null,
    raw_test_language: newTestCase.templateType === "automated" ? newTestCase.rawTestLanguage.trim() || "python" : null,
    time: newTestCase.time.trim() || null,
    priority: newTestCase.priority,
    test_case_type: newTestCase.templateType === "automated" ? "automated" : newTestCase.testCaseType,
    tags: newTestCase.tags,
    component_coverages: componentCoverages,
    status: newTestCase.status,
  };
}

async function patchPreconditionsWithInlineImages(
  testCaseId: string,
  trimmedPreconditions: string,
  pendingPreconditionInlineImages: PendingInlineImage[],
  patchTestCase: (args: { testCaseId: string; payload: { preconditions: string } }) => Promise<unknown>,
): Promise<void> {
  if (!trimmedPreconditions || pendingPreconditionInlineImages.length === 0) {
    return;
  }
  let resolvedPreconditions = trimmedPreconditions;
  for (const pendingImage of pendingPreconditionInlineImages) {
    if (!resolvedPreconditions.includes(pendingImage.placeholder)) continue;
    const uploaded = await uploadTestCaseAttachment(testCaseId, pendingImage.file);
    const resolvedMarkdown = `![${pendingImage.alt}](/attachments/${uploaded.id})`;
    resolvedPreconditions = resolvedPreconditions.split(pendingImage.placeholder).join(resolvedMarkdown);
  }
  if (resolvedPreconditions !== trimmedPreconditions) {
    await patchTestCase({ testCaseId, payload: { preconditions: resolvedPreconditions } });
  }
}

async function replaceStepsWithInlineImages(options: {
  testCaseId: string;
  projectId: string;
  stepsPayload: ReturnType<typeof normalizeStepsForSave>;
  pendingInlineImagesByStepId: Record<string, PendingInlineImage[]>;
  replaceSteps: (args: { testCaseId: string; projectId: string; steps: ReturnType<typeof normalizeStepsForSave> }) => Promise<unknown>;
  setUploadingStepId: (stepId: string | null) => void;
}): Promise<void> {
  const { testCaseId, projectId, stepsPayload, pendingInlineImagesByStepId, replaceSteps, setUploadingStepId } = options;
  for (const step of stepsPayload) {
    const stepClientId = step.client_id ?? "";
    const pendingImages = pendingInlineImagesByStepId[stepClientId] ?? [];
    if (pendingImages.length === 0) continue;

    let nextAction = step.action;
    let nextExpectedResult = step.expected_result;

    for (const pendingImage of pendingImages) {
      const isUsedInStep =
        nextAction.includes(pendingImage.placeholder) || nextExpectedResult.includes(pendingImage.placeholder);
      if (!isUsedInStep) continue;

      setUploadingStepId(stepClientId);
      const uploaded = await uploadDraftStepAttachment(testCaseId, stepClientId, pendingImage.file);
      const attachmentPath = `/attachments/${uploaded.id}`;
      const resolvedMarkdown = `![${pendingImage.alt}](${attachmentPath})`;
      nextAction = nextAction.split(pendingImage.placeholder).join(resolvedMarkdown);
      nextExpectedResult = nextExpectedResult.split(pendingImage.placeholder).join(resolvedMarkdown);
    }

    step.action = nextAction;
    step.expected_result = nextExpectedResult;
  }

  await replaceSteps({ testCaseId, projectId, steps: stepsPayload });
}

export function useTestCasesCreate(selectedSuite: string | null, projectId: string | undefined) {
  const aiStatusQuery = useAiTestCaseStatusQuery(projectId);
  const generateAiMutation = useGenerateAiTestCasesMutation();
  const checkAiDuplicatesMutation = useCheckAiDuplicatesMutation();
  const createTestCaseMutation = useCreateTestCaseMutation();
  const patchTestCaseMutation = usePatchTestCaseMutation();
  const replaceTestCaseStepsMutation = useReplaceTestCaseStepsMutation();

  const [isCreatingTestCase, setIsCreatingTestCase] = useState(false);
  const [isSubmittingCreateFlow, setIsSubmittingCreateFlow] = useState(false);
  const [uploadingStepId, setUploadingStepId] = useState<string | null>(null);
  const [pendingInlineImagesByStepId, setPendingInlineImagesByStepId] = useState<Record<string, PendingInlineImage[]>>({});
  const [pendingPreconditionInlineImages, setPendingPreconditionInlineImages] = useState<PendingInlineImage[]>([]);
  const [newTestCase, setNewTestCase] = useState<NewTestCaseForm>(() => createDefaultNewTestCaseForm());
  const [aiSourceText, setAiSourceText] = useState("");
  const [aiDrafts, setAiDrafts] = useState<AiDraftTestCaseDto[]>([]);
  const [aiWarnings, setAiWarnings] = useState<string[]>([]);
  const [duplicateWarnings, setDuplicateWarnings] = useState<AiDraftTestCaseDto["possible_duplicates"]>([]);

  const handleNewTestCaseClick = useCallback(() => {
    setIsCreatingTestCase(true);
    setPendingInlineImagesByStepId({});
    setPendingPreconditionInlineImages([]);
    setNewTestCase(createDefaultNewTestCaseForm());
    setAiSourceText("");
    setAiDrafts([]);
    setAiWarnings([]);
    setDuplicateWarnings([]);
  }, []);

  const handleCancelNewTestCase = useCallback(() => {
    setIsCreatingTestCase(false);
    setIsSubmittingCreateFlow(false);
    setPendingInlineImagesByStepId({});
    setPendingPreconditionInlineImages([]);
    setUploadingStepId(null);
    setNewTestCase(createDefaultNewTestCaseForm());
    setAiSourceText("");
    setAiDrafts([]);
    setAiWarnings([]);
    setDuplicateWarnings([]);
  }, []);

  const createFromForm = useCallback(
    async (
      form: NewTestCaseForm,
      options?: {
        pendingStepImages?: Record<string, PendingInlineImage[]>;
        pendingPreconditionImages?: PendingInlineImage[];
        forceDraft?: boolean;
      }
    ) => {
      if (!form.title.trim() || !projectId) return null;
      const payload = buildCreateTestCasePayload(
        options?.forceDraft ? { ...form, status: "draft" } : form,
        projectId,
        selectedSuite
      );
      const trimmedPreconditions = payload.preconditions ?? null;
      const created = await createTestCaseMutation.mutateAsync(payload);
      await patchPreconditionsWithInlineImages(
        created.id,
        trimmedPreconditions ?? "",
        options?.pendingPreconditionImages ?? [],
        patchTestCaseMutation.mutateAsync,
      );
      if (form.templateType === "steps" && form.steps.length > 0) {
        const stepsPayload = normalizeStepsForSave(form.steps);
        await replaceStepsWithInlineImages({
          testCaseId: created.id,
          projectId,
          stepsPayload,
          pendingInlineImagesByStepId: options?.pendingStepImages ?? {},
          replaceSteps: replaceTestCaseStepsMutation.mutateAsync,
          setUploadingStepId,
        });
      }
      return created;
    },
    [
      createTestCaseMutation,
      patchTestCaseMutation.mutateAsync,
      projectId,
      replaceTestCaseStepsMutation.mutateAsync,
      selectedSuite,
    ]
  );

  const handleCreateTestCase = useCallback(async () => {
    if (!newTestCase.title.trim() || !projectId) return;
    setIsSubmittingCreateFlow(true);
    try {
      const created = await createFromForm(newTestCase, {
        pendingStepImages: pendingInlineImagesByStepId,
        pendingPreconditionImages: pendingPreconditionInlineImages,
      });
      if (!created) return;
      handleCancelNewTestCase();
      notifySuccess(`Test case "${created.title}" created`);
    } catch (error) {
      notifyError(error, "Failed to create test case.");
    } finally {
      setUploadingStepId(null);
      setIsSubmittingCreateFlow(false);
    }
  }, [
    createFromForm,
    handleCancelNewTestCase,
    newTestCase,
    pendingPreconditionInlineImages,
    pendingInlineImagesByStepId,
    projectId,
  ]);

  const mapAiDraftToForm = useCallback(
    (draft: AiDraftTestCaseDto): NewTestCaseForm => ({
      ...createDefaultNewTestCaseForm(),
      title: draft.title,
      templateType: "steps",
      preconditions: draft.preconditions ?? "",
      status: "draft",
      priority: draft.priority,
      testCaseType: draft.test_case_type,
      ownerId: newTestCase.ownerId,
      primaryProductId: draft.primary_product_id ?? newTestCase.primaryProductId,
      tags: draft.tags,
      steps: draft.steps.map((step) => ({
        id: `local-${crypto.randomUUID()}`,
        action: step.action,
        expectedResult: step.expected_result,
        persisted: false,
      })),
      componentCoverages: draft.component_coverages.map((coverage) => ({
        id: `local-${crypto.randomUUID()}`,
        componentId: coverage.component_id,
        coverageType: coverage.coverage_type,
        coverageStrength: coverage.coverage_strength,
        isMandatoryForRelease: coverage.is_mandatory_for_release,
      })),
    }),
    [newTestCase.ownerId, newTestCase.primaryProductId]
  );

  const handleGenerateAiDrafts = useCallback(async () => {
    if (!projectId) return;
    try {
      const selectedComponentIds = newTestCase.componentCoverages
        .map((coverage) => coverage.componentId)
        .filter((componentId) => componentId.trim().length > 0);
      const response = await generateAiMutation.mutateAsync({
        project_id: projectId,
        source_text: aiSourceText.trim() || newTestCase.title.trim() || null,
        suite_id: selectedSuite,
        primary_product_id: newTestCase.primaryProductId === "none" ? null : newTestCase.primaryProductId,
        component_ids: selectedComponentIds,
        test_focus: [...DEFAULT_AI_FOCUS],
        priority_preference: newTestCase.priority,
        count: 3,
      });
      setAiDrafts(response.draft_test_cases);
      setAiWarnings(response.warnings);
    } catch (error) {
      notifyError(error, "Failed to generate draft test cases.");
    }
  }, [aiSourceText, generateAiMutation, newTestCase, projectId, selectedSuite]);

  const handleAcceptAiDraft = useCallback(
    (draft: AiDraftTestCaseDto) => {
      setNewTestCase(mapAiDraftToForm(draft));
      setDuplicateWarnings(draft.possible_duplicates);
    },
    [mapAiDraftToForm]
  );

  const handleRejectAiDraft = useCallback((index: number) => {
    setAiDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const handleAcceptAllAiDrafts = useCallback(async () => {
    if (!projectId || aiDrafts.length === 0) return;
    setIsSubmittingCreateFlow(true);
    try {
      for (const draft of aiDrafts) {
        await createFromForm(mapAiDraftToForm(draft), { forceDraft: true });
      }
      handleCancelNewTestCase();
      notifySuccess(`${aiDrafts.length} draft test cases created`);
    } catch (error) {
      notifyError(error, "Failed to create AI draft test cases.");
    } finally {
      setIsSubmittingCreateFlow(false);
    }
  }, [aiDrafts, createFromForm, handleCancelNewTestCase, mapAiDraftToForm, projectId]);

  const handleCheckDuplicates = useCallback(async () => {
    if (!projectId || !newTestCase.title.trim()) return;
    try {
      const response = await checkAiDuplicatesMutation.mutateAsync({
        project_id: projectId,
        test_case: {
          title: newTestCase.title,
          preconditions: newTestCase.preconditions.trim() || null,
          steps: newTestCase.steps.map((step) => ({
            action: step.action,
            expected_result: step.expectedResult,
          })),
          tags: newTestCase.tags,
          component_ids: newTestCase.componentCoverages
            .map((coverage) => coverage.componentId)
            .filter((componentId) => componentId.trim().length > 0),
        },
        exclude_test_case_id: null,
      });
      setDuplicateWarnings(response.duplicates);
    } catch (error) {
      notifyError(error, "Failed to check duplicate test cases.");
    }
  }, [checkAiDuplicatesMutation, newTestCase, projectId]);

  const handleAddTag = useCallback(() => {
    setNewTestCase((prev) => {
      if (prev.tagInput.trim() && !prev.tags.includes(prev.tagInput.trim())) {
        return {
          ...prev,
          tags: [...prev.tags, prev.tagInput.trim()],
          tagInput: "",
        };
      }
      return prev;
    });
  }, []);

  const handleRemoveTag = useCallback((tag: string) => {
    setNewTestCase((prev) => ({
      ...prev,
      tags: prev.tags.filter((value) => value !== tag),
    }));
  }, []);

  const handleAddStep = useCallback(() => {
    setNewTestCase((prev) => ({ ...prev, steps: [...prev.steps, createLocalStep()] }));
  }, []);

  const handleAddCoverage = useCallback(() => {
    setNewTestCase((prev) => ({
      ...prev,
      componentCoverages: [...prev.componentCoverages, createLocalCoverage()],
    }));
  }, []);

  const handleRemoveCoverage = useCallback((coverageId: string) => {
    setNewTestCase((prev) => ({
      ...prev,
      componentCoverages: prev.componentCoverages.filter((coverage) => coverage.id !== coverageId),
    }));
  }, []);

  const handleCoverageComponentChange = useCallback((coverageId: string, componentId: string) => {
    setNewTestCase((prev) => ({
      ...prev,
      componentCoverages: prev.componentCoverages.map((coverage) =>
        coverage.id === coverageId ? { ...coverage, componentId } : coverage
      ),
    }));
  }, []);

  const handleCoverageStrengthChange = useCallback(
    (coverageId: string, coverageStrength: NewTestCaseForm["componentCoverages"][number]["coverageStrength"]) => {
      setNewTestCase((prev) => ({
        ...prev,
        componentCoverages: prev.componentCoverages.map((coverage) =>
          coverage.id === coverageId ? { ...coverage, coverageStrength } : coverage
        ),
      }));
    },
    []
  );

  const handleCoverageMandatoryChange = useCallback((coverageId: string, isMandatoryForRelease: boolean) => {
    setNewTestCase((prev) => ({
      ...prev,
      componentCoverages: prev.componentCoverages.map((coverage) =>
        coverage.id === coverageId ? { ...coverage, isMandatoryForRelease } : coverage
      ),
    }));
  }, []);

  const handleInsertStepAfter = useCallback((afterId: string) => {
    setNewTestCase((prev) => {
      const next = [...prev.steps];
      const index = next.findIndex((step) => step.id === afterId);
      next.splice(index + 1, 0, createLocalStep());
      return { ...prev, steps: next };
    });
  }, []);

  const handleRemoveStep = useCallback((stepId: string) => {
    setNewTestCase((prev) => ({
      ...prev,
      steps: prev.steps.filter((step) => step.id !== stepId),
    }));
    setPendingInlineImagesByStepId((prev) => {
      const next = { ...prev };
      delete next[stepId];
      return next;
    });
  }, []);

  const handleUpdateStep = useCallback(
    (stepId: string, field: "action" | "expectedResult", value: string) => {
      setNewTestCase((prev) => ({
        ...prev,
        steps: prev.steps.map((step) => (step.id === stepId ? { ...step, [field]: value } : step)),
      }));
    },
    []
  );

  const handleMoveStep = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setNewTestCase((prev) => {
      const sourceIndex = prev.steps.findIndex((step) => step.id === sourceId);
      const targetIndex = prev.steps.findIndex((step) => step.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;
      const next = [...prev.steps];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return { ...prev, steps: next };
    });
  }, []);

  const handleStepInlineImageUpload = useCallback(
    async (stepId: string, file: File): Promise<string | null> => {
      if (!file.type.startsWith("image/")) {
        notifyError("Only image files are supported here.", "Failed to attach image.");
        return null;
      }
      if (!validateFileSize(file, STEP_ATTACHMENT_LIMIT_BYTES)) {
        notifyError("File size exceeds 10 MB.", "Failed to attach image.");
        return null;
      }

      const step = newTestCase.steps.find((item) => item.id === stepId);
      if (!step) return null;

      const currentStepPending = pendingInlineImagesByStepId[stepId] ?? [];
      const usedPlaceholders = new Set<string>(currentStepPending.map((item) => item.placeholder));
      const stepContent = `${step.action}\n${step.expectedResult}`;

      const baseAlt = file.name.trim() || "Step image";
      let alt = baseAlt;
      let placeholder = `![${alt}]`;
      let suffix = 2;
      while (usedPlaceholders.has(placeholder) || stepContent.includes(placeholder)) {
        alt = `${baseAlt} (${suffix})`;
        placeholder = `![${alt}]`;
        suffix += 1;
      }

      setPendingInlineImagesByStepId((prev) => ({
        ...prev,
        [stepId]: [...(prev[stepId] ?? []), { alt, placeholder, file }],
      }));
      return placeholder;
    },
    [newTestCase.steps, pendingInlineImagesByStepId]
  );

  const handlePreconditionsInlineImageUpload = useCallback(
    async (file: File): Promise<string | null> => {
      if (!file.type.startsWith("image/")) {
        notifyError("Only image files are supported here.", "Failed to attach image.");
        return null;
      }
      if (!validateFileSize(file, STEP_ATTACHMENT_LIMIT_BYTES)) {
        notifyError("File size exceeds 10 MB.", "Failed to attach image.");
        return null;
      }

      const usedPlaceholders = new Set<string>(pendingPreconditionInlineImages.map((item) => item.placeholder));
      const currentValue = newTestCase.preconditions;

      const baseAlt = file.name.trim() || "Precondition image";
      let alt = baseAlt;
      let placeholder = `![${alt}]`;
      let suffix = 2;
      while (usedPlaceholders.has(placeholder) || currentValue.includes(placeholder)) {
        alt = `${baseAlt} (${suffix})`;
        placeholder = `![${alt}]`;
        suffix += 1;
      }

      setPendingPreconditionInlineImages((prev) => [...prev, { alt, placeholder, file }]);
      return placeholder;
    },
    [newTestCase.preconditions, pendingPreconditionInlineImages]
  );

  const isSubmittingCreate =
    isSubmittingCreateFlow || createTestCaseMutation.isPending || replaceTestCaseStepsMutation.isPending;
  const envAiEnabled = import.meta.env.VITE_AI_TEST_CASE_ASSISTANT_ENABLED === "true";
  const aiEnabled = Boolean(aiStatusQuery.data?.enabled || envAiEnabled);

  return {
    isCreatingTestCase,
    isSubmittingCreate,
    newTestCase,
    setNewTestCase,
    onNewTestCaseClick: handleNewTestCaseClick,
    onCancelNewTestCase: handleCancelNewTestCase,
    onCreateTestCase: handleCreateTestCase,
    onAddTag: handleAddTag,
    onRemoveTag: handleRemoveTag,
    onAddStep: handleAddStep,
    onAddCoverage: handleAddCoverage,
    onRemoveCoverage: handleRemoveCoverage,
    onCoverageComponentChange: handleCoverageComponentChange,
    onCoverageStrengthChange: handleCoverageStrengthChange,
    onCoverageMandatoryChange: handleCoverageMandatoryChange,
    onInsertStepAfter: handleInsertStepAfter,
    onRemoveStep: handleRemoveStep,
    onUpdateStep: handleUpdateStep,
    onMoveStep: handleMoveStep,
    uploadingStepId,
    onStepImageUpload: handleStepInlineImageUpload,
    onPreconditionsImageUpload: handlePreconditionsInlineImageUpload,
    aiEnabled,
    aiSourceText,
    aiDrafts,
    aiWarnings,
    duplicateWarnings,
    isGeneratingAiDrafts: generateAiMutation.isPending,
    isCheckingDuplicates: checkAiDuplicatesMutation.isPending,
    onAiSourceTextChange: setAiSourceText,
    onGenerateAiDrafts: handleGenerateAiDrafts,
    onAcceptAiDraft: handleAcceptAiDraft,
    onAcceptAllAiDrafts: () => void handleAcceptAllAiDrafts(),
    onRejectAiDraft: handleRejectAiDraft,
    onCheckDuplicates: () => void handleCheckDuplicates(),
  };
}
