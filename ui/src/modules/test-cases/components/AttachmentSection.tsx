// Lists attachments with upload/download/delete actions.
import { Download, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { useId, useRef, type ChangeEvent } from "react";
import type { AttachmentDto } from "@/shared/api";
import { invokeMaybeAsync } from "@/shared/lib/invoke-maybe-async";
import { Button } from "@/shared/ui/Button";

type Props = Readonly<{
  title: string;
  subtitle: string;
  attachments: AttachmentDto[];
  emptyMessage: string;
  uploadLabel: string;
  showUploadAction?: boolean;
  showDeleteAction?: boolean;
  isUploading?: boolean;
  canUpload?: boolean;
  disabledReason?: string;
  onUpload: (file: File) => void | Promise<void>;
  onDownload: (attachment: AttachmentDto) => void | Promise<void>;
  onDelete: (attachment: AttachmentDto) => void | Promise<void>;
}>;

// Human-readable file size
function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentSection({
  title,
  subtitle,
  attachments,
  emptyMessage,
  uploadLabel,
  showUploadAction = true,
  showDeleteAction = true,
  isUploading = false,
  canUpload = true,
  disabledReason,
  onUpload,
  onDownload,
  onDelete,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    invokeMaybeAsync(() => onUpload(file));
    event.target.value = "";
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted),transparent_30%)] p-3">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">{subtitle}</p>
        </div>
        {showUploadAction ? (
          <div className="flex items-center gap-2">
            <input ref={inputRef} id={inputId} type="file" className="hidden" onChange={handleChange} />
            <Button unstyled
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={!canUpload || isUploading}
              title={!canUpload ? disabledReason : uploadLabel}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploadLabel}
            </Button>
          </div>
        ) : null}
      </div>

      {!canUpload && disabledReason ? <p className="mb-3 text-xs text-[var(--status-blocked)]">{disabledReason}</p> : null}

      {attachments.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] px-3 py-3 text-sm text-[var(--muted-foreground)]">
          <Paperclip className="h-4 w-4" />
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2"
            >
              <div className="min-w-0">
                <Button unstyled
                  type="button"
                  onClick={() => invokeMaybeAsync(() => onDownload(attachment))}
                  className="block truncate text-sm font-medium text-[var(--highlight-foreground)] hover:text-[var(--highlight-strong)]"
                >
                  {attachment.filename}
                </Button>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {formatFileSize(attachment.size)} • {new Date(attachment.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button unstyled
                  type="button"
                  onClick={() => invokeMaybeAsync(() => onDownload(attachment))}
                  className="rounded-md p-2 text-[var(--muted-foreground)] transition hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </Button>
                {showDeleteAction ? (
                  <Button unstyled
                    type="button"
                    onClick={() => invokeMaybeAsync(() => onDelete(attachment))}
                    className="rounded-md p-2 text-[var(--muted-foreground)] transition hover:bg-[var(--tone-danger-bg-soft)] hover:text-[var(--status-failure)]"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
