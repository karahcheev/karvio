import { RichTextField } from "@/shared/ui/RichTextField";
import type { AttachmentDto } from "@/shared/api";

type Props = Readonly<{
  title: string;
  value: string | null;
  isEditing: boolean;
  placeholder: string;
  onChange: (value: string) => void;
  onImageUpload?: (file: File) => Promise<string | null>;
  canUploadImage?: boolean;
  testCaseId?: string;
  attachments?: AttachmentDto[];
  fieldKey?: string;
}>;

export function TestCaseContentBlock({
  title,
  value,
  isEditing,
  placeholder,
  onChange,
  onImageUpload,
  canUploadImage = true,
  testCaseId,
  attachments = [],
  fieldKey,
}: Props) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <RichTextField
        label=""
        value={value ?? ""}
        editable={isEditing}
        emptyMessage="No content."
        placeholder={placeholder}
        minRows={6}
        onChange={onChange}
        onImageUpload={onImageUpload}
        canUploadImage={canUploadImage}
        attachments={attachments}
        testCaseId={testCaseId}
        stepId={fieldKey ?? title.toLowerCase().replace(/\s+/g, "-")}
      />
    </section>
  );
}
