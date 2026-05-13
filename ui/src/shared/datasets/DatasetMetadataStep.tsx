import { Upload } from "lucide-react";
import { useRef } from "react";
import type { DatasetDraft } from "@/shared/datasets/draft";
import { Button, SelectField, TextField, TextareaField } from "@/shared/ui";
import { DATASET_SOURCE_TYPE_OPTIONS, formatDatasetSourceTypeLabel } from "./source-type";

export type DatasetMetadataErrors = {
  name?: string;
  sourceType?: string;
  sourceRef?: string;
};

type Props = Readonly<{
  draft: DatasetDraft;
  isSaving: boolean;
  errors: DatasetMetadataErrors;
  showErrors: boolean;
  onDraftChange: (value: DatasetDraft | ((prev: DatasetDraft) => DatasetDraft)) => void;
  onEnterNext: () => void;
  onImportFile: (file: File) => Promise<void>;
  isImporting: boolean;
}>;

export function DatasetMetadataStep({
  draft,
  isSaving,
  errors,
  showErrors,
  onDraftChange,
  onEnterNext,
  onImportFile,
  isImporting,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (isSaving) return;
        onEnterNext();
      }}
    >
      <TextField
        label="Name"
        required
        value={draft.name}
        onChange={(event) => onDraftChange((current) => ({ ...current, name: event.target.value }))}
        disabled={isSaving}
        error={showErrors ? errors.name : undefined}
      />

      <SelectField
        label="Type"
        required
        value={draft.sourceType}
        onChange={(event) =>
          onDraftChange((current) => ({
            ...current,
            sourceType: event.target.value as DatasetDraft["sourceType"],
          }))
        }
        disabled={isSaving}
        error={showErrors ? errors.sourceType : undefined}
      >
        {DATASET_SOURCE_TYPE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {formatDatasetSourceTypeLabel(option)}
          </option>
        ))}
      </SelectField>

      <TextareaField
        label="Description"
        value={draft.description}
        onChange={(event) => onDraftChange((current) => ({ ...current, description: event.target.value }))}
        textareaClassName="min-h-24"
        disabled={isSaving}
      />

      <TextField
        label="Source"
        value={draft.sourceRef}
        onChange={(event) => onDraftChange((current) => ({ ...current, sourceRef: event.target.value }))}
        disabled={isSaving}
        placeholder="tests/test_login.py::test_auth[case-1]"
        error={showErrors ? errors.sourceRef : undefined}
      />

      <div className="rounded-lg border border-dashed border-[var(--border)] bg-[color-mix(in_srgb,var(--muted),transparent_60%)] px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">Import from file</p>
            <p className="text-xs text-[var(--muted-foreground)]">Upload `CSV` or `JSON` to prefill columns and rows.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSaving || isImporting}
          >
            <Upload className="h-4 w-4" />
            {isImporting ? "Importing..." : "Import CSV/JSON"}
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json,application/json,text/csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = "";
            if (!file) return;
            void onImportFile(file);
          }}
        />
      </div>
    </form>
  );
}
