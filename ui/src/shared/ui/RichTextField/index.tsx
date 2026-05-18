// Switches between markdown editor and read-only rendered preview for one field.

import { RichTextEditor } from "@/shared/ui/RichTextEditor";
import { RichTextPreview } from "@/shared/ui/RichTextPreview";
import type { AttachmentDto } from "@/shared/api/tms/types";

export type RichTextFieldProps = Readonly<{
  /** Подпись поля */
  label: string;
  /** Текущее значение (Markdown) */
  value: string;
  /** Режим редактирования vs просмотра */
  editable: boolean;
  /** Сообщение при пустом значении в режиме просмотра */
  emptyMessage: string;
  /** Placeholder для textarea в режиме редактирования */
  placeholder?: string;
  /** Минимальное количество строк textarea */
  minRows?: number;
  /** Обработчик изменения (только в режиме редактирования) */
  onChange?: (value: string) => void;
  /** Загрузка изображения, возвращает Markdown-ссылку ![...] или null */
  onImageUpload?: (file: File) => Promise<string | null>;
  /** Можно ли загружать изображения (например, во время загрузки другого) */
  canUploadImage?: boolean;
  /** Текст кнопки загрузки изображения */
  imageUploadTitle?: string;
  /** Вложения для разрешения изображений по filename в режиме просмотра */
  attachments?: AttachmentDto[];
  /** ID тест-кейса для разрешения путей /attachments/{id} */
  testCaseId?: string;
  /** ID шага (для ключей в списке) */
  stepId?: string;
}>;

export function RichTextField({
  label,
  value,
  editable,
  emptyMessage,
  placeholder = "",
  minRows = 5,
  onChange,
  onImageUpload,
  canUploadImage = true,
  imageUploadTitle = "Upload image",
  attachments = [],
  testCaseId,
  stepId = "preview",
}: RichTextFieldProps) {
  // Edit vs read-only

  if (editable) {
    return (
      <RichTextEditor
        label={label}
        value={value}
        placeholder={placeholder}
        minRows={minRows}
        onChange={onChange ?? (() => {})}
        onImageUpload={onImageUpload}
        canUploadImage={canUploadImage}
        imageUploadTitle={imageUploadTitle}
      />
    );
  }

  return (
    <RichTextPreview
      label={label}
      value={value}
      emptyMessage={emptyMessage}
      attachments={attachments}
      testCaseId={testCaseId}
      stepId={stepId}
    />
  );
}
