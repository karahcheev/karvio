import { useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, Eye, EyeOff, KeyRound } from "lucide-react";

import type { NewlyCreatedKey } from "@/modules/api-keys-manager/types";
import { Button } from "@/shared/ui/Button";
import { CheckboxField } from "@/shared/ui";
import { AppModal, StandardModalLayout } from "@/shared/ui/Modal";

type ApiKeySecretModalProps = Readonly<{
  keyData: NewlyCreatedKey | null;
  copiedKeyId: string | null;
  acknowledged: boolean;
  isPending?: boolean;
  onCopy: () => void;
  onAcknowledgeChange: (checked: boolean) => void;
  onClose: () => void;
}>;

const HIDDEN_MASK = "•".repeat(36);

export function ApiKeySecretModal({
  keyData,
  copiedKeyId,
  acknowledged,
  isPending = false,
  onCopy,
  onAcknowledgeChange,
  onClose,
}: ApiKeySecretModalProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    setIsRevealed(false);
  }, [keyData?.id]);

  return (
    <AppModal
      isOpen={Boolean(keyData)}
      onClose={onClose}
      closeOnOverlayClick={false}
      closeOnEscape={false}
      contentClassName="flex !w-[calc(100vw-2rem)] sm:!w-[560px] !max-w-[calc(100vw-2rem)] sm:!max-w-[560px] max-h-[90vh] flex-col overflow-hidden rounded-xl"
    >
      <StandardModalLayout
        title={
          <span className="inline-flex items-center gap-2">
            <KeyRound className="size-4 text-[var(--status-passed)]" />
            API Key Ready
          </span>
        }
        description="Copy and store the secret now. You will not be able to view it again."
        titleClassName="text-base"
        hideCloseButton
        footer={
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={onClose}
            disabled={!acknowledged || isPending}
          >
            I Saved My Key
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-[var(--foreground)]">
              {keyData?.name ?? "New API key"}
            </p>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2">
                <div
                  className="max-h-28 min-w-0 flex-1 select-all overflow-auto font-mono text-xs text-[var(--foreground)]"
                  aria-label={isRevealed ? "API key" : "API key (hidden)"}
                >
                  {isRevealed ? keyData?.value : HIDDEN_MASK}
                </div>
                <Button
                  type="button"
                  variant="icon"
                  size="sm"
                  onClick={() => setIsRevealed((value) => !value)}
                  aria-label={isRevealed ? "Hide API key" : "Show API key"}
                  aria-pressed={isRevealed}
                >
                  {isRevealed ? <EyeOff /> : <Eye />}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="md"
                leftIcon={copiedKeyId === keyData?.id ? <Check /> : <Copy />}
                onClick={onCopy}
                className="sm:flex-shrink-0"
              >
                {copiedKeyId === keyData?.id ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          <div className="flex gap-2 rounded-md border border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg-soft)] px-3 py-2 text-xs text-[var(--tone-warning-text)]">
            <AlertTriangle className="mt-0.5 size-4 flex-shrink-0" />
            <ul className="space-y-1">
              <li>This is the only time the full secret is shown.</li>
              <li>Store it in a secure password manager or secret vault.</li>
              <li>Rotate or revoke immediately if the key is exposed.</li>
            </ul>
          </div>

          <CheckboxField
            label="I understand that I cannot view this key again and have stored it securely."
            checked={acknowledged}
            onChange={(event) => onAcknowledgeChange(event.target.checked)}
          />
        </div>
      </StandardModalLayout>
    </AppModal>
  );
}
