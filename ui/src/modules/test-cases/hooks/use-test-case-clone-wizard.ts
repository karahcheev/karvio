import { useCallback, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import {
  createTestCase,
  replaceTestCaseSteps,
  uploadDraftStepAttachment,
  uploadTestCaseAttachment,
} from "@/shared/api";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import { fetchAttachmentAsFile } from "@/modules/test-cases/utils/testCaseEditorUtils";
import type { CloneWizardDraft, EditableStep } from "@/modules/test-cases/utils/testCaseEditorTypes";
import type { AttachmentDto } from "@/shared/api";
import type { TestCasePriority } from "@/shared/domain/priority";

import type { TestCaseType } from "@/shared/domain/testCaseType";

export type UseTestCaseCloneWizardProps = Readonly<{
  title: string;
  time: string | null;
  preconditions: string | null;
  priority: TestCasePriority;
  testCaseType: TestCaseType;
  ownerId: string;
  suiteId: string;
  tags: string[];
  steps: EditableStep[];
  testCaseAttachments: AttachmentDto[];
  stepAttachments: Record<string, AttachmentDto[]>;
}>;

export function useTestCaseCloneWizard(props: UseTestCaseCloneWizardProps) {
  const { projectId, testCaseId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [isCloneWizardOpen, setIsCloneWizardOpen] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [cloneWizardDraft, setCloneWizardDraft] = useState<CloneWizardDraft>({
    title: "",
    time: null,
    priority: "medium",
    testCaseType: "manual",
    ownerId: "unassigned",
    suiteId: "unsorted",
    tags: [],
    tagInput: "",
  });

  const handleCloneOpen = useCallback(() => {
    setCloneWizardDraft({
      title: props.title || "Untitled",
      time: props.time,
      priority: props.priority,
      testCaseType: props.testCaseType,
      ownerId: props.ownerId,
      suiteId: props.suiteId,
      tags: [...props.tags],
      tagInput: "",
    });
    setIsCloneWizardOpen(true);
  }, [props.ownerId, props.priority, props.suiteId, props.tags, props.testCaseType, props.time, props.title]);

  const handleCloneClose = useCallback(() => {
    if (isCloning) return;
    setIsCloneWizardOpen(false);
  }, [isCloning]);

  const addCloneTag = useCallback(() => {
    setCloneWizardDraft((current) => {
      const candidate = current.tagInput.trim();
      if (!candidate || current.tags.includes(candidate)) {
        return current;
      }
      return {
        ...current,
        tags: [...current.tags, candidate],
        tagInput: "",
      };
    });
  }, []);

  const removeCloneTag = useCallback((tag: string) => {
    setCloneWizardDraft((current) => ({
      ...current,
      tags: current.tags.filter((currentTag) => currentTag !== tag),
    }));
  }, []);

  const handleCloneCreate = useCallback(async () => {
    if (!projectId || !testCaseId) return;
    const cloneTitle = cloneWizardDraft.title.trim();
    if (!cloneTitle) return;

    setIsCloning(true);
    let createdTestCaseId: string | null = null;
    let createdTestCaseTitle = "";

    try {
      const created = await createTestCase({
        project_id: projectId,
        suite_id: cloneWizardDraft.suiteId === "unsorted" ? null : cloneWizardDraft.suiteId,
        owner_id: cloneWizardDraft.ownerId === "unassigned" ? null : cloneWizardDraft.ownerId,
        title: cloneTitle,
        preconditions: props.preconditions,
        time: cloneWizardDraft.time,
        priority: cloneWizardDraft.priority,
        test_case_type: cloneWizardDraft.testCaseType,
        tags: cloneWizardDraft.tags,
      });
      createdTestCaseId = created.id;
      createdTestCaseTitle = created.title;

      for (const attachment of props.testCaseAttachments) {
        const file = await fetchAttachmentAsFile(
          `/attachments/${attachment.id}`,
          attachment.filename,
          attachment.content_type
        );
        await uploadTestCaseAttachment(created.id, file);
      }

      const clonedStepsPayload: Array<{
        position: number;
        action: string;
        expected_result: string;
        client_id?: string | null;
      }> = [];

      for (const [index, step] of props.steps.entries()) {
        const draftStepId = `clone-${crypto.randomUUID()}`;
        let action = step.action;
        let expectedResult = step.expectedResult;
        const sourceStepAttachments = props.stepAttachments[step.id] ?? [];

        for (const attachment of sourceStepAttachments) {
          const file = await fetchAttachmentAsFile(
            `/attachments/${attachment.id}`,
            attachment.filename,
            attachment.content_type
          );
          const uploadedDraft = await uploadDraftStepAttachment(created.id, draftStepId, file);
          const oldPath = `/attachments/${attachment.id}`;
          const clonedPath = `/attachments/${uploadedDraft.id}`;
          action = action.split(oldPath).join(clonedPath);
          expectedResult = expectedResult.split(oldPath).join(clonedPath);
        }

        clonedStepsPayload.push({
          position: index + 1,
          action,
          expected_result: expectedResult,
          client_id: draftStepId,
        });
      }

      if (clonedStepsPayload.length > 0) {
        await replaceTestCaseSteps(created.id, clonedStepsPayload);
      }

      setIsCloneWizardOpen(false);
      notifySuccess(`Test case "${created.title}" created`);
      navigate({
        pathname: `/projects/${projectId}/test-cases/${created.id}`,
        search: location.search,
      });
    } catch (error) {
      if (createdTestCaseId) {
        setIsCloneWizardOpen(false);
        notifyError(
          error,
          `Test case "${createdTestCaseTitle}" was created, but cloning full content failed.`
        );
        navigate({
          pathname: `/projects/${projectId}/test-cases/${createdTestCaseId}`,
          search: location.search,
        });
      } else {
        notifyError(error, "Failed to clone test case.");
      }
    } finally {
      setIsCloning(false);
    }
  }, [
    projectId,
    testCaseId,
    cloneWizardDraft,
    props.preconditions,
    props.testCaseAttachments,
    props.steps,
    props.stepAttachments,
    location.search,
    navigate,
  ]);

  return {
    isCloneWizardOpen,
    isCloning,
    cloneWizardDraft,
    setCloneWizardDraft,
    handleCloneOpen,
    handleCloneClose,
    addCloneTag,
    removeCloneTag,
    handleCloneCreate,
  };
}
