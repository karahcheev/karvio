import { useCallback, useState } from "react";
import { useParams } from "react-router";
import {
  deleteTestCaseAttachment,
  uploadDraftStepAttachment,
  uploadTestCaseAttachment,
  type AttachmentDto,
} from "@/shared/api";
import { useDeleteConfirmation } from "@/shared/lib/use-delete-confirmation";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import { TEST_CASE_ATTACHMENT_LIMIT_BYTES, STEP_ATTACHMENT_LIMIT_BYTES } from "@/modules/test-cases/utils/constants";
import { validateFileSize } from "@/modules/test-cases/utils/testCaseEditorUtils";
import type { EditableStep } from "@/modules/test-cases/utils/testCaseEditorTypes";

export type UseTestCaseAttachmentsProps = Readonly<{
  steps: EditableStep[];
  testCaseAttachments: AttachmentDto[];
  setTestCaseAttachments: (v: AttachmentDto[] | ((prev: AttachmentDto[]) => AttachmentDto[])) => void;
  stepAttachments: Record<string, AttachmentDto[]>;
  setStepAttachments: (
    v: Record<string, AttachmentDto[]> | ((prev: Record<string, AttachmentDto[]>) => Record<string, AttachmentDto[]>)
  ) => void;
}>;

export function useTestCaseAttachments(props: UseTestCaseAttachmentsProps) {
  const { confirmDelete } = useDeleteConfirmation();
  const { testCaseId } = useParams();
  const { steps, setTestCaseAttachments, setStepAttachments } = props;
  const [isUploadingCaseAttachment, setIsUploadingCaseAttachment] = useState(false);
  const [uploadingStepId, setUploadingStepId] = useState<string | null>(null);

  const handleCaseAttachmentUpload = useCallback(
    async (file: File) => {
      if (!testCaseId) return;
      if (!validateFileSize(file, TEST_CASE_ATTACHMENT_LIMIT_BYTES)) {
        notifyError(`File size exceeds 50 MB.`, "Failed to upload attachment.");
        return;
      }

      setIsUploadingCaseAttachment(true);
      try {
        const uploaded = await uploadTestCaseAttachment(testCaseId, file);
        setTestCaseAttachments((current) => [uploaded, ...current]);
        notifySuccess(`Uploaded "${uploaded.filename}"`);
      } catch (error) {
        notifyError(error, "Failed to upload attachment.");
      } finally {
        setIsUploadingCaseAttachment(false);
      }
    },
    [testCaseId, setTestCaseAttachments]
  );

  const handleCaseAttachmentDelete = useCallback(
    async (attachment: AttachmentDto) => {
      if (!testCaseId) return;
      const confirmed = await confirmDelete({
        title: "Delete Attachment",
        description: `Delete "${attachment.filename}"?`,
        confirmLabel: "Delete Attachment",
      });
      if (!confirmed) return;

      try {
        await deleteTestCaseAttachment(testCaseId, attachment.id);
        setTestCaseAttachments((current) => current.filter((item) => item.id !== attachment.id));
        setStepAttachments((current) => {
          const next: Record<string, AttachmentDto[]> = {};
          for (const [stepId, files] of Object.entries(current)) {
            next[stepId] = files.filter((item) => item.id !== attachment.id);
          }
          return next;
        });
        notifySuccess(`Deleted "${attachment.filename}"`);
      } catch (error) {
        notifyError(error, "Failed to delete attachment.");
      }
    },
    [testCaseId, confirmDelete, setStepAttachments, setTestCaseAttachments]
  );

  const handleStepInlineImageUpload = useCallback(
    async (stepId: string, file: File): Promise<string | null> => {
      if (!file.type.startsWith("image/")) {
        notifyError("Only image files are supported here.", "Failed to upload image.");
        return null;
      }
      if (!validateFileSize(file, STEP_ATTACHMENT_LIMIT_BYTES)) {
        notifyError("File size exceeds 10 MB.", "Failed to upload image.");
        return null;
      }

      if (!testCaseId) return null;
      const step = steps.find((item) => item.id === stepId);
      if (!step) return null;

      setUploadingStepId(stepId);
      try {
        // Always use draft-step upload while editing:
        // saved steps are recreated on save and server rebinds draft attachments by client_id.
        const uploaded = await uploadDraftStepAttachment(testCaseId, step.id, file);
        setStepAttachments((current) => ({
          ...current,
          [stepId]: [uploaded, ...(current[stepId] ?? [])],
        }));
        notifySuccess(`Uploaded "${uploaded.filename}"`);
        const alt = uploaded.filename.trim() || file.name.trim() || "Step image";
        return `![${alt}]`;
      } catch (error) {
        notifyError(error, "Failed to upload image.");
        return null;
      } finally {
        setUploadingStepId(null);
      }
    },
    [testCaseId, steps, setStepAttachments]
  );

  const handleCaseInlineImageUpload = useCallback(
    async (file: File): Promise<string | null> => {
      if (!file.type.startsWith("image/")) {
        notifyError("Only image files are supported here.", "Failed to upload image.");
        return null;
      }
      if (!validateFileSize(file, STEP_ATTACHMENT_LIMIT_BYTES)) {
        notifyError("File size exceeds 10 MB.", "Failed to upload image.");
        return null;
      }

      if (!testCaseId) return null;

      setIsUploadingCaseAttachment(true);
      try {
        const uploaded = await uploadTestCaseAttachment(testCaseId, file);
        setTestCaseAttachments((current) => [uploaded, ...current]);
        notifySuccess(`Uploaded "${uploaded.filename}"`);
        const alt = uploaded.filename.trim() || file.name.trim() || "Image";
        return `![${alt}]`;
      } catch (error) {
        notifyError(error, "Failed to upload image.");
        return null;
      } finally {
        setIsUploadingCaseAttachment(false);
      }
    },
    [testCaseId, setTestCaseAttachments]
  );

  return {
    isUploadingCaseAttachment,
    uploadingStepId,
    handleCaseAttachmentUpload,
    handleCaseAttachmentDelete,
    handleStepInlineImageUpload,
    handleCaseInlineImageUpload,
  };
}
