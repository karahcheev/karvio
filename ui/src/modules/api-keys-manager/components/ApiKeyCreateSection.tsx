import { Plus, X } from "lucide-react";

import type { NewApiKeyData } from "@/modules/api-keys-manager/types";
import { Button } from "@/shared/ui/Button";
import { TextField, TextareaField } from "@/shared/ui";

type ApiKeyCreateSectionProps = Readonly<{
  isCreating: boolean;
  isPending: boolean;
  formData: NewApiKeyData;
  formErrors: Partial<NewApiKeyData>;
  nameMaxLength: number;
  descriptionMaxLength: number;
  onStartCreating: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  onChange: (next: NewApiKeyData) => void;
}>;

export function ApiKeyCreateSection({
  isCreating,
  isPending,
  formData,
  formErrors,
  nameMaxLength,
  descriptionMaxLength,
  onStartCreating,
  onCancel,
  onSubmit,
  onChange,
}: ApiKeyCreateSectionProps) {
  if (!isCreating) {
    return (
      <div className="mb-3 flex justify-end">
        <Button
          type="button"
          variant="primary"
          size="sm"
          leftIcon={<Plus />}
          onClick={onStartCreating}
          disabled={isPending}
        >
          New API Key
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">New API Key</h3>
        <Button
          type="button"
          variant="icon"
          size="sm"
          onClick={onCancel}
          disabled={isPending}
          aria-label="Cancel"
        >
          <X />
        </Button>
      </div>

      <div className="space-y-3">
        <TextField
          label="Name"
          required
          value={formData.name}
          maxLength={nameMaxLength}
          onChange={(event) => onChange({ ...formData, name: event.target.value })}
          placeholder="e.g. CI Pipeline, Production API"
          error={formErrors.name}
          hint={`${formData.name.length} / ${nameMaxLength}`}
          autoFocus
        />

        <TextareaField
          label="Description"
          value={formData.description}
          maxLength={descriptionMaxLength}
          onChange={(event) => onChange({ ...formData, description: event.target.value })}
          placeholder="What is this key used for?"
          rows={3}
          error={formErrors.description}
          hint={`${formData.description.length} / ${descriptionMaxLength}`}
        />

        <p className="text-xs text-[var(--muted-foreground)]">
          The full secret is shown once after creation. Store it in a password manager or secret vault.
        </p>

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            leftIcon={<Plus />}
            onClick={onSubmit}
            disabled={isPending}
            loading={isPending}
          >
            Generate Key
          </Button>
        </div>
      </div>
    </div>
  );
}
