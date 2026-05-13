import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import {
  deleteAttachment,
  usePatchTestCaseMutation,
  useReplaceTestCaseStepsMutation,
  type AttachmentDto,
} from "@/shared/api";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import { useUrlHashState } from "@/shared/lib/use-url-hash-state";
import { TEST_CASE_MODES } from "@/modules/test-cases/utils/testCaseEditorTypes";
import {
  cloneSnapshot,
  createLocalCoverage,
  createLocalStep,
  mapApiCoverage,
  normalizeCoveragesForSave,
  mapApiStep,
  normalizeStepsForSave,
} from "@/modules/test-cases/utils/testCaseEditorUtils";
import type { EditableCoverage, EditableStep, EditorSnapshot } from "@/modules/test-cases/utils/testCaseEditorTypes";
import type { TestCasePriority } from "@/shared/domain/priority";
import type { TestCaseTemplateType } from "@/shared/domain/testCaseTemplateType";
import type { TestCaseType } from "@/shared/domain/testCaseType";

export type TestCaseEditorStateProps = Readonly<{
  title: string;
  setTitle: (v: string | ((prev: string) => string)) => void;
  templateType: TestCaseTemplateType;
  setTemplateType: (v: TestCaseTemplateType | ((prev: TestCaseTemplateType) => TestCaseTemplateType)) => void;
  automationId: string | null;
  setAutomationId: (v: string | null | ((prev: string | null) => string | null)) => void;
  time: string | null;
  setTime: (v: string | null | ((prev: string | null) => string | null)) => void;
  preconditions: string | null;
  setPreconditions: (v: string | null | ((prev: string | null) => string | null)) => void;
  stepsText: string | null;
  setStepsText: (v: string | null | ((prev: string | null) => string | null)) => void;
  expected: string | null;
  setExpected: (v: string | null | ((prev: string | null) => string | null)) => void;
  rawTest: string | null;
  setRawTest: (v: string | null | ((prev: string | null) => string | null)) => void;
  rawTestLanguage: string | null;
  setRawTestLanguage: (v: string | null | ((prev: string | null) => string | null)) => void;
  priority: TestCasePriority;
  setPriority: (v: TestCasePriority | ((prev: TestCasePriority) => TestCasePriority)) => void;
  testCaseType: TestCaseType;
  setTestCaseType: (v: TestCaseType | ((prev: TestCaseType) => TestCaseType)) => void;
  status: "draft" | "active" | "archived";
  setStatus: (v: "draft" | "active" | "archived" | ((prev: "draft" | "active" | "archived") => "draft" | "active" | "archived")) => void;
  persistedStatus: "draft" | "active" | "archived";
  setPersistedStatus: (v: "draft" | "active" | "archived" | ((prev: "draft" | "active" | "archived") => "draft" | "active" | "archived")) => void;
  ownerId: string;
  setOwnerId: (v: string | ((prev: string) => string)) => void;
  primaryProductId: string;
  setPrimaryProductId: (v: string | ((prev: string) => string)) => void;
  suiteId: string;
  setSuiteId: (v: string | ((prev: string) => string)) => void;
  tags: string[];
  setTags: (v: string[] | ((prev: string[]) => string[])) => void;
  componentCoverages: EditableCoverage[];
  setComponentCoverages: (v: EditableCoverage[] | ((prev: EditableCoverage[]) => EditableCoverage[])) => void;
  steps: EditableStep[];
  setSteps: (v: EditableStep[] | ((prev: EditableStep[]) => EditableStep[])) => void;
  initialStepSignature: string;
  setInitialStepSignature: (v: string | ((prev: string) => string)) => void;
  testCaseAttachments: AttachmentDto[];
  setTestCaseAttachments: (v: AttachmentDto[] | ((prev: AttachmentDto[]) => AttachmentDto[])) => void;
  stepAttachments: Record<string, AttachmentDto[]>;
  setStepAttachments: (v: Record<string, AttachmentDto[]> | ((prev: Record<string, AttachmentDto[]>) => Record<string, AttachmentDto[]>)) => void;
  setUpdatedAt: (v: string | null | ((prev: string | null) => string | null)) => void;
  initialSnapshot: EditorSnapshot | null;
}>;

export function useTestCaseEditorState(props: TestCaseEditorStateProps) {
  const { projectId, testCaseId } = useParams();
  const patchMutation = usePatchTestCaseMutation();
  const replaceStepsMutation = useReplaceTestCaseStepsMutation();
  const [mode, setMode] = useUrlHashState<(typeof TEST_CASE_MODES)[number]>({
    values: TEST_CASE_MODES,
    defaultValue: "view",
    omitHashFor: "view",
  });
  const [savedSnapshot, setSavedSnapshot] = useState<EditorSnapshot | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSavedSnapshot(null);
  }, [testCaseId]);

  useEffect(() => {
    if (props.initialSnapshot && !savedSnapshot) {
      setSavedSnapshot(cloneSnapshot(props.initialSnapshot));
    }
  }, [props.initialSnapshot, savedSnapshot]);

  const currentStepSignature = useMemo(
    () => JSON.stringify(normalizeStepsForSave(props.steps)),
    [props.steps]
  );
  const stepsChanged = currentStepSignature !== props.initialStepSignature;
  const isEditing = mode === "edit";

  const addStep = useCallback(() => {
    props.setSteps((current) => [...current, createLocalStep()]);
  }, [props.setSteps]);

  const insertStepAfter = useCallback(
    (afterId: string) => {
      props.setSteps((current) => {
        const next = [...current];
        const index = next.findIndex((step) => step.id === afterId);
        next.splice(index + 1, 0, createLocalStep());
        return next;
      });
    },
    [props.setSteps]
  );

  const removeStep = useCallback(
    (stepId: string) => {
      props.setSteps((current) => current.filter((step) => step.id !== stepId));
      props.setStepAttachments((current) => {
        const next = { ...current };
        delete next[stepId];
        return next;
      });
    },
    [props.setSteps, props.setStepAttachments]
  );

  const updateStep = useCallback(
    (stepId: string, field: "action" | "expectedResult", value: string) => {
      props.setSteps((current) =>
        current.map((step) => (step.id === stepId ? { ...step, [field]: value } : step))
      );
    },
    [props.setSteps]
  );

  const moveStep = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;
      props.setSteps((current) => {
        const sourceIndex = current.findIndex((step) => step.id === sourceId);
        const targetIndex = current.findIndex((step) => step.id === targetId);
        if (sourceIndex < 0 || targetIndex < 0) return current;
        const next = [...current];
        const [moved] = next.splice(sourceIndex, 1);
        next.splice(targetIndex, 0, moved);
        return next;
      });
    },
    [props.setSteps]
  );

  const addTag = useCallback(
    (tagInput: string, setTagInput: (v: string | ((prev: string) => string)) => void) => {
      if (tagInput.trim() && !props.tags.includes(tagInput.trim())) {
        props.setTags((current) => [...current, tagInput.trim()]);
        setTagInput("");
      }
    },
    [props.tags, props.setTags]
  );

  const removeTag = useCallback(
    (tag: string) => {
      props.setTags((current) => current.filter((currentTag) => currentTag !== tag));
    },
    [props.setTags]
  );

  const addCoverage = useCallback(() => {
    props.setComponentCoverages((current) => [...current, createLocalCoverage()]);
  }, [props.setComponentCoverages]);

  const removeCoverage = useCallback(
    (coverageId: string) => {
      props.setComponentCoverages((current) => current.filter((coverage) => coverage.id !== coverageId));
    },
    [props.setComponentCoverages]
  );

  const updateCoverageComponent = useCallback(
    (coverageId: string, componentId: string) => {
      props.setComponentCoverages((current) =>
        current.map((coverage) => (coverage.id === coverageId ? { ...coverage, componentId } : coverage))
      );
    },
    [props.setComponentCoverages]
  );

  const updateCoverageStrength = useCallback(
    (coverageId: string, coverageStrength: EditableCoverage["coverageStrength"]) => {
      props.setComponentCoverages((current) =>
        current.map((coverage) => (coverage.id === coverageId ? { ...coverage, coverageStrength } : coverage))
      );
    },
    [props.setComponentCoverages]
  );

  const updateCoverageMandatory = useCallback(
    (coverageId: string, isMandatoryForRelease: boolean) => {
      props.setComponentCoverages((current) =>
        current.map((coverage) => (coverage.id === coverageId ? { ...coverage, isMandatoryForRelease } : coverage))
      );
    },
    [props.setComponentCoverages]
  );

  const handleSave = useCallback(async () => {
    if (!testCaseId) return;

    setIsSaving(true);
    try {
      const updated = await patchMutation.mutateAsync({
        testCaseId,
        payload: {
          title: props.title,
          template_type: props.templateType,
          automation_id: props.automationId,
          preconditions: props.templateType === "automated" ? null : props.preconditions,
          steps_text: props.templateType === "text" ? props.stepsText : null,
          expected: props.templateType === "text" ? props.expected : null,
          raw_test: props.templateType === "automated" ? props.rawTest : null,
          raw_test_language: props.templateType === "automated" ? props.rawTestLanguage : null,
          time: props.time,
          priority: props.priority,
          test_case_type: props.testCaseType,
          primary_product_id: props.primaryProductId === "none" ? null : props.primaryProductId,
          component_coverages: normalizeCoveragesForSave(props.componentCoverages),
          suite_id: props.suiteId === "unsorted" ? null : props.suiteId,
          owner_id: props.ownerId === "unassigned" ? null : props.ownerId,
          tags: props.tags,
          status: props.status,
        },
      });

      let savedSteps = props.steps;
      let savedStepAttachments = props.stepAttachments;
      const savedPrimaryProductId =
        updated.primary_product_id === undefined ? props.primaryProductId : (updated.primary_product_id ?? "none");
      const savedComponentCoverages =
        updated.component_coverages === undefined
          ? props.componentCoverages
          : updated.component_coverages.map(mapApiCoverage);
      if (props.templateType === "steps" && stepsChanged) {
        const replaced = await replaceStepsMutation.mutateAsync({
          testCaseId,
          projectId,
          steps: normalizeStepsForSave(props.steps),
        });
        savedSteps = replaced.steps.map(mapApiStep);
        savedStepAttachments = replaced.step_attachments ?? {};
        props.setSteps(savedSteps);
        props.setInitialStepSignature(JSON.stringify(normalizeStepsForSave(savedSteps)));
        props.setStepAttachments(savedStepAttachments);
      }

      props.setTitle(updated.title);
      props.setTemplateType(updated.template_type ?? "steps");
      props.setAutomationId(updated.automation_id ?? null);
      props.setPreconditions(updated.preconditions ?? null);
      props.setStepsText(updated.steps_text ?? null);
      props.setExpected(updated.expected ?? null);
      props.setRawTest(updated.raw_test ?? null);
      props.setRawTestLanguage(updated.raw_test_language ?? null);
      props.setTime(updated.time ?? null);
      props.setPriority((updated.priority ?? "medium") as TestCasePriority);
      props.setTestCaseType(updated.test_case_type ?? "manual");
      props.setStatus(updated.status);
      props.setPersistedStatus(updated.status);
      props.setOwnerId(updated.owner_id ?? "unassigned");
      props.setPrimaryProductId(savedPrimaryProductId);
      props.setSuiteId(updated.suite_id ?? "unsorted");
      props.setTags(updated.tags);
      props.setComponentCoverages(savedComponentCoverages);
      props.setUpdatedAt(updated.updated_at);
      setSavedSnapshot(
        cloneSnapshot({
          title: updated.title,
          templateType: updated.template_type ?? "steps",
          automationId: updated.automation_id ?? null,
          stepsText: updated.steps_text ?? null,
          expected: updated.expected ?? null,
          rawTest: updated.raw_test ?? null,
          rawTestLanguage: updated.raw_test_language ?? null,
          time: updated.time ?? null,
          priority: (updated.priority ?? "medium") as TestCasePriority,
          status: updated.status,
          testCaseType: updated.test_case_type ?? "manual",
          ownerId: updated.owner_id ?? "unassigned",
          primaryProductId: savedPrimaryProductId,
          suiteId: updated.suite_id ?? "unsorted",
          tags: updated.tags,
          componentCoverages: savedComponentCoverages,
          steps: savedSteps,
          preconditions: updated.preconditions ?? null,
          testCaseAttachments: props.testCaseAttachments,
          stepAttachments: savedStepAttachments,
        })
      );
      setMode("view");
      notifySuccess(`Test case "${updated.title}" updated`);

      if (!stepsChanged) {
        props.setSteps(savedSteps);
      }
    } catch (error) {
      notifyError(error, "Failed to update test case.");
    } finally {
      setIsSaving(false);
    }
  }, [
    testCaseId,
    projectId,
    patchMutation,
    replaceStepsMutation,
    props.title,
    props.templateType,
    props.priority,
    props.time,
    props.automationId,
    props.stepsText,
    props.expected,
    props.rawTest,
    props.rawTestLanguage,
    props.testCaseType,
    props.primaryProductId,
    props.componentCoverages,
    props.suiteId,
    props.ownerId,
    props.tags,
    props.status,
    props.steps,
    props.stepAttachments,
    props.preconditions,
    props.testCaseAttachments,
    stepsChanged,
    props.setTitle,
    props.setTemplateType,
    props.setAutomationId,
    props.setPreconditions,
    props.setStepsText,
    props.setExpected,
    props.setRawTest,
    props.setRawTestLanguage,
    props.setTime,
    props.setPriority,
    props.setStatus,
    props.setPersistedStatus,
    props.setOwnerId,
    props.setPrimaryProductId,
    props.setSuiteId,
    props.setTags,
    props.setComponentCoverages,
    props.setSteps,
    props.setInitialStepSignature,
    props.setStepAttachments,
    props.setUpdatedAt,
    setMode,
  ]);

  const handleEditStart = useCallback(() => {
    setMode("edit");
  }, [setMode]);

  const handleCancelEdit = useCallback(() => {
    if (!savedSnapshot) {
      setMode("view");
      return;
    }

    const snapshot = cloneSnapshot(savedSnapshot);
    const snapshotAttachmentIds = new Set<string>([
      ...snapshot.testCaseAttachments.map((a) => a.id),
      ...Object.values(snapshot.stepAttachments).flatMap((atts) => atts.map((a) => a.id)),
    ]);
    const currentAttachmentIds = [
      ...props.testCaseAttachments.map((a) => a.id),
      ...Object.values(props.stepAttachments).flatMap((atts) => atts.map((a) => a.id)),
    ];
    const toDelete = currentAttachmentIds.filter((id) => !snapshotAttachmentIds.has(id));
    if (toDelete.length > 0) {
      void Promise.allSettled(toDelete.map((id) => deleteAttachment(id))).then((results) => {
        const failed = results.filter((r) => r.status === "rejected");
        if (failed.length > 0) {
          notifyError(
            new Error("Some attachments could not be removed."),
            "Failed to remove attachments."
          );
        }
      });
    }

    props.setTitle(snapshot.title);
    props.setTemplateType(snapshot.templateType);
    props.setAutomationId(snapshot.automationId);
    props.setStepsText(snapshot.stepsText);
    props.setExpected(snapshot.expected);
    props.setRawTest(snapshot.rawTest);
    props.setRawTestLanguage(snapshot.rawTestLanguage);
    props.setPriority(snapshot.priority);
    props.setTestCaseType(snapshot.testCaseType);
    props.setStatus(snapshot.status);
    props.setOwnerId(snapshot.ownerId);
    props.setPrimaryProductId(snapshot.primaryProductId);
    props.setSuiteId(snapshot.suiteId);
    props.setTags(snapshot.tags);
    props.setComponentCoverages(snapshot.componentCoverages);
    props.setSteps(snapshot.steps);
    props.setPreconditions(snapshot.preconditions);
    props.setTestCaseAttachments(snapshot.testCaseAttachments);
    props.setStepAttachments(snapshot.stepAttachments);
    props.setInitialStepSignature(JSON.stringify(normalizeStepsForSave(snapshot.steps)));
    setMode("view");
  }, [
    savedSnapshot,
    props.testCaseAttachments,
    props.stepAttachments,
    props.setTitle,
    props.setTemplateType,
    props.setAutomationId,
    props.setStepsText,
    props.setExpected,
    props.setRawTest,
    props.setRawTestLanguage,
    props.setPriority,
    props.setStatus,
    props.setOwnerId,
    props.setPrimaryProductId,
    props.setSuiteId,
    props.setTags,
    props.setComponentCoverages,
    props.setSteps,
    props.setPreconditions,
    props.setTestCaseAttachments,
    props.setStepAttachments,
    props.setInitialStepSignature,
    setMode,
  ]);

  return {
    mode,
    setMode,
    savedSnapshot,
    setSavedSnapshot,
    isSaving,
    stepsChanged,
    isEditing,
    addStep,
    insertStepAfter,
    removeStep,
    updateStep,
    moveStep,
    addTag,
    removeTag,
    addCoverage,
    removeCoverage,
    updateCoverageComponent,
    updateCoverageStrength,
    updateCoverageMandatory,
    handleSave,
    handleEditStart,
    handleCancelEdit,
  };
}
