import { Button } from "@/shared/ui/Button";
import { AppModal, ConfirmModalLayout } from "@/shared/ui/Modal";

type ActionConfirmModalProps = Readonly<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending?: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "warning" | "danger";
}>;

export function ActionConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isPending = false,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "warning",
}: ActionConfirmModalProps) {
  const confirmButtonClassName =
    tone === "danger"
      ? "rounded-lg bg-[var(--action-danger-fill)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--action-danger-fill-hover)] disabled:cursor-not-allowed disabled:opacity-50"
      : "rounded-lg bg-[var(--status-blocked)] px-4 py-2 text-sm font-medium text-white hover:bg-[color-mix(in_srgb,var(--status-blocked),transparent_15%)] disabled:cursor-not-allowed disabled:opacity-50";

  const borderClassName = tone === "danger" ? "border-[var(--tone-danger-border)]" : "border-[var(--tone-warning-border)]";

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnOverlayClick={!isPending}
      closeOnEscape={!isPending}
      contentClassName={`flex !w-[calc(100vw-2rem)] sm:!w-[560px] !max-w-[calc(100vw-2rem)] sm:!max-w-[560px] flex-col overflow-hidden rounded-xl border ${borderClassName}`}
    >
      <ConfirmModalLayout
        title={title}
        tone={tone}
        footer={(
          <>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border-[var(--border)] bg-[var(--card)] font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
            >
              {cancelLabel}
            </Button>
            <Button type="button" unstyled onClick={onConfirm} disabled={isPending} className={confirmButtonClassName}>
              {confirmLabel}
            </Button>
          </>
        )}
      >
        <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
      </ConfirmModalLayout>
    </AppModal>
  );
}
