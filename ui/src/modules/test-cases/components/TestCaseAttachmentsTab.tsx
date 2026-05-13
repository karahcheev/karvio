import { useMemo } from "react";
import type { AttachmentDto } from "@/shared/api";
import { AttachmentSection } from "./AttachmentSection";

type Props = Readonly<{
  isEditing: boolean;
  testCaseAttachments: AttachmentDto[];
  stepAttachments: Record<string, AttachmentDto[]>;
  onAttachmentUpload: (file: File) => void | Promise<void>;
  onAttachmentDelete: (attachment: AttachmentDto) => void | Promise<void>;
  onAttachmentDownload: (attachment: AttachmentDto) => void | Promise<void>;
}>;

export function TestCaseAttachmentsTab({
  isEditing,
  testCaseAttachments,
  stepAttachments,
  onAttachmentUpload,
  onAttachmentDelete,
  onAttachmentDownload,
}: Props) {
  const allAttachments = useMemo(() => {
    const merged = [...testCaseAttachments, ...Object.values(stepAttachments).flat()];
    const deduped = new Map<string, AttachmentDto>();
    for (const attachment of merged) {
      deduped.set(attachment.id, attachment);
    }
    return Array.from(deduped.values()).sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    );
  }, [stepAttachments, testCaseAttachments]);

  return (
    <AttachmentSection
      title="Attachments"
      subtitle="All files and inline images attached to this test case and its steps."
      attachments={allAttachments}
      emptyMessage="No attachments yet."
      uploadLabel="Files"
      showUploadAction={false}
      showDeleteAction={isEditing}
      canUpload={false}
      onUpload={onAttachmentUpload}
      onDownload={onAttachmentDownload}
      onDelete={onAttachmentDelete}
    />
  );
}
