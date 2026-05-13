import { useEffect, useState } from "react";
import { KeyRound, ShieldAlert } from "lucide-react";

import {
  ApiKeyCard,
  ApiKeyCreateSection,
  ApiKeySecretModal,
} from "@/modules/api-keys-manager/components";
import type { ConfirmActionTarget, NewApiKeyData, NewlyCreatedKey } from "@/modules/api-keys-manager/types";
import {
  useCreateApiKeyMutation,
  useDeleteApiKeyMutation,
  useMyApiKeyQuery,
  useRegenerateApiKeyMutation,
} from "@/shared/api";
import { getErrorMessage, notifyError, notifySuccess } from "@/shared/lib/notifications";
import { Button } from "@/shared/ui/Button";
import { ActionConfirmModal } from "@/shared/ui/ActionConfirmModal";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Loader } from "@/shared/ui/Loader";
import { AppModal, StandardModalLayout } from "@/shared/ui/Modal";

type ApiKeysManagerModalProps = Readonly<{
  isOpen: boolean;
  onClose: () => void;
}>;

const NAME_MAX_LENGTH = 80;
const DESCRIPTION_MAX_LENGTH = 300;

export function ApiKeysManagerModal({ isOpen, onClose }: ApiKeysManagerModalProps) {
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newKeyData, setNewKeyData] = useState<NewApiKeyData>({ name: "", description: "" });
  const [formErrors, setFormErrors] = useState<Partial<NewApiKeyData>>({});

  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<NewlyCreatedKey | null>(null);
  const [newlyCreatedKeyAcknowledged, setNewlyCreatedKeyAcknowledged] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ConfirmActionTarget | null>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<ConfirmActionTarget | null>(null);

  const apiKeyQuery = useMyApiKeyQuery(isOpen);
  const createApiKeyMutation = useCreateApiKeyMutation();
  const regenerateApiKeyMutation = useRegenerateApiKeyMutation();
  const deleteApiKeyMutation = useDeleteApiKeyMutation();

  const isApiKeyActionPending =
    createApiKeyMutation.isPending ||
    regenerateApiKeyMutation.isPending ||
    deleteApiKeyMutation.isPending;

  useEffect(() => {
    if (!copiedKeyId) {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopiedKeyId(null), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copiedKeyId]);

  useEffect(() => {
    if (isOpen) {
      return;
    }

    setApiKeyError(null);
    setIsCreating(false);
    setNewKeyData({ name: "", description: "" });
    setFormErrors({});
    setCopiedKeyId(null);
    setNewlyCreatedKey(null);
    setNewlyCreatedKeyAcknowledged(false);
    setDeleteTarget(null);
    setRegenerateTarget(null);
  }, [isOpen]);

  const closeMainModal = () => {
    if (isApiKeyActionPending || Boolean(newlyCreatedKey) || Boolean(deleteTarget) || Boolean(regenerateTarget)) {
      return;
    }

    onClose();
  };

  const handleCreateKey = async () => {
    const errors: Partial<NewApiKeyData> = {};
    const normalizedName = newKeyData.name.trim();
    const normalizedDescription = newKeyData.description.trim();

    if (!normalizedName) {
      errors.name = "Name is required.";
    } else if (normalizedName.length > NAME_MAX_LENGTH) {
      errors.name = `Name must be at most ${NAME_MAX_LENGTH} characters.`;
    }

    if (normalizedDescription.length > DESCRIPTION_MAX_LENGTH) {
      errors.description = `Description must be at most ${DESCRIPTION_MAX_LENGTH} characters.`;
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setApiKeyError(null);
    setCopiedKeyId(null);

    try {
      const result = await createApiKeyMutation.mutateAsync({
        name: normalizedName,
        description: normalizedDescription || null,
      });

      setNewlyCreatedKey({ id: result.key.id, value: result.api_key, name: result.key.name });
      setNewlyCreatedKeyAcknowledged(false);
      setIsCreating(false);
      setNewKeyData({ name: "", description: "" });
      setFormErrors({});
      notifySuccess("API key created.");
    } catch (error) {
      const message = getErrorMessage(error, "Failed to create API key.");
      setApiKeyError(message);
      notifyError(error, "Failed to create API key.");
    }
  };

  const handleRegenerateConfirm = async () => {
    if (!regenerateTarget) {
      return;
    }

    setApiKeyError(null);
    setCopiedKeyId(null);

    try {
      const result = await regenerateApiKeyMutation.mutateAsync(regenerateTarget.id);
      setNewlyCreatedKey({ id: regenerateTarget.id, value: result.api_key, name: regenerateTarget.name });
      setNewlyCreatedKeyAcknowledged(false);
      setRegenerateTarget(null);
      notifySuccess("API key regenerated.");
    } catch (error) {
      const message = getErrorMessage(error, "Failed to regenerate API key.");
      setApiKeyError(message);
      notifyError(error, "Failed to regenerate API key.");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) {
      return;
    }

    setApiKeyError(null);

    try {
      await deleteApiKeyMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      notifySuccess("API key deleted.");
    } catch (error) {
      const message = getErrorMessage(error, "Failed to delete API key.");
      setApiKeyError(message);
      notifyError(error, "Failed to delete API key.");
    }
  };

  const handleCopyNewlyCreatedKey = async () => {
    if (!newlyCreatedKey?.value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(newlyCreatedKey.value);
      setApiKeyError(null);
      setCopiedKeyId(newlyCreatedKey.id);
    } catch {
      setApiKeyError("Unable to copy API key automatically.");
    }
  };

  const keys = apiKeyQuery.data ?? [];

  return (
    <>
      <AppModal
        isOpen={isOpen}
        onClose={closeMainModal}
        closeOnOverlayClick={!isApiKeyActionPending}
        closeOnEscape={!isApiKeyActionPending}
        contentClassName="flex !w-[calc(100vw-2rem)] sm:!w-[720px] !max-w-[calc(100vw-2rem)] sm:!max-w-[720px] max-h-[90vh] flex-col overflow-hidden rounded-xl"
      >
        <StandardModalLayout
          title="API Keys"
          description="Personal API keys for integrations and automation."
          onClose={closeMainModal}
          closeButtonDisabled={isApiKeyActionPending}
          bodyClassName="space-y-3"
          footer={
            <>
              <div className="mr-auto flex items-start gap-2 text-xs text-[var(--muted-foreground)]">
                <ShieldAlert className="mt-0.5 size-3.5 flex-shrink-0 text-[var(--status-blocked)]" />
                <p>One key per integration. Rotate periodically. Revoke immediately if exposure is suspected.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={closeMainModal}
                disabled={isApiKeyActionPending}
              >
                Close
              </Button>
            </>
          }
          footerClassName="items-start"
        >
          {apiKeyQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader />
            </div>
          ) : null}

          {apiKeyQuery.isError ? (
            <p className="text-sm text-[var(--status-failure)]">
              {getErrorMessage(apiKeyQuery.error, "Failed to load API keys.")}
            </p>
          ) : null}

          {!apiKeyQuery.isLoading && !apiKeyQuery.isError ? (
            <>
              <ApiKeyCreateSection
                isCreating={isCreating}
                isPending={isApiKeyActionPending}
                formData={newKeyData}
                formErrors={formErrors}
                nameMaxLength={NAME_MAX_LENGTH}
                descriptionMaxLength={DESCRIPTION_MAX_LENGTH}
                onStartCreating={() => setIsCreating(true)}
                onCancel={() => {
                  setIsCreating(false);
                  setNewKeyData({ name: "", description: "" });
                  setFormErrors({});
                }}
                onSubmit={() => {
                  void handleCreateKey();
                }}
                onChange={(next) => {
                  setNewKeyData(next);
                  setFormErrors((prev) => ({
                    ...prev,
                    name: undefined,
                    description: undefined,
                  }));
                }}
              />

              {keys.length === 0 ? (
                <EmptyState
                  title={
                    <span className="inline-flex items-center gap-2">
                      <KeyRound className="size-4 text-[var(--muted-foreground)]" />
                      No API keys yet
                    </span>
                  }
                  description="Create your first API key to start using the API or automation pipelines."
                />
              ) : (
                <div className="space-y-2">
                  {keys.map((apiKey) => (
                    <ApiKeyCard
                      key={apiKey.id}
                      apiKey={apiKey}
                      isPending={isApiKeyActionPending}
                      onRegenerate={(key) => {
                        setApiKeyError(null);
                        setRegenerateTarget({ id: key.id, name: key.name });
                      }}
                      onRevoke={(key) => {
                        setApiKeyError(null);
                        setDeleteTarget({ id: key.id, name: key.name });
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          ) : null}

          {apiKeyError ? (
            <div
              className="rounded-md border border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg-soft)] px-3 py-2 text-sm text-[var(--status-failure)]"
              aria-live="polite"
            >
              {apiKeyError}
            </div>
          ) : null}
        </StandardModalLayout>
      </AppModal>

      <ApiKeySecretModal
        keyData={newlyCreatedKey}
        copiedKeyId={copiedKeyId}
        acknowledged={newlyCreatedKeyAcknowledged}
        isPending={isApiKeyActionPending}
        onCopy={() => {
          void handleCopyNewlyCreatedKey();
        }}
        onAcknowledgeChange={setNewlyCreatedKeyAcknowledged}
        onClose={() => {
          if (isApiKeyActionPending) {
            return;
          }
          setNewlyCreatedKey(null);
          setNewlyCreatedKeyAcknowledged(false);
        }}
      />

      <ActionConfirmModal
        isOpen={Boolean(regenerateTarget)}
        onClose={() => {
          if (isApiKeyActionPending) {
            return;
          }
          setRegenerateTarget(null);
        }}
        onConfirm={() => {
          void handleRegenerateConfirm();
        }}
        isPending={isApiKeyActionPending}
        title="Regenerate API Key"
        description={`Regenerating ${regenerateTarget?.name ?? "this key"} will invalidate the current secret immediately. Update all integrations right after regeneration.`}
        confirmLabel={isApiKeyActionPending ? "Regenerating..." : "Regenerate"}
        tone="warning"
      />

      <ActionConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (isApiKeyActionPending) {
            return;
          }
          setDeleteTarget(null);
        }}
        onConfirm={() => {
          void handleDeleteConfirm();
        }}
        isPending={isApiKeyActionPending}
        title="Revoke API Key"
        description={`Revoking ${deleteTarget?.name ?? "this key"} will permanently disable it. Any integration using this key will stop working.`}
        confirmLabel={isApiKeyActionPending ? "Revoking..." : "Revoke"}
        tone="danger"
      />
    </>
  );
}
