import { useCallback, useEffect, useMemo, useState } from "react";
import type { DatasetDraft, DatasetDraftColumn, DatasetDraftRow } from "@/shared/datasets/draft";
import { normalizeDatasetKey } from "@/shared/datasets/draft";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import { Button } from "@/shared/ui/Button";
import { WizardModalLayout } from "@/shared/ui/Modal";
import { importDatasetTableFromFile } from "./import";
import { DatasetMetadataStep, type DatasetMetadataErrors } from "./DatasetMetadataStep";
import { DatasetTableBuilder } from "./DatasetTableBuilder";
import { DatasetWizardSteps, type DatasetWizardStepItem } from "./DatasetWizardSteps";

type Props = Readonly<{
  draft: DatasetDraft;
  isSaving: boolean;
  isEditing: boolean;
  isCreating: boolean;
  onClose: () => void;
  onDraftChange: (value: DatasetDraft | ((prev: DatasetDraft) => DatasetDraft)) => void;
  onSave: () => void;
  saveActionLabel: string;
}>;

type WizardStep = "metadata" | "table";

function buildMetadataErrors(draft: DatasetDraft): DatasetMetadataErrors {
  return {
    name: draft.name.trim().length > 0 ? undefined : "Name is required.",
    sourceType: draft.sourceType ? undefined : "Type is required.",
    sourceRef: undefined,
  };
}

function hasMetadataErrors(errors: DatasetMetadataErrors): boolean {
  return Boolean(errors.name || errors.sourceType || errors.sourceRef);
}

function createInitialColumns(): DatasetDraftColumn[] {
  const names = ["key", "value", "expected_result"];
  return names.map((name, index) => ({
    id: `seed_col_${index + 1}`,
    columnKey: normalizeDatasetKey(name),
    displayName: name,
    dataType: "string",
    required: false,
    defaultValue: "",
    isScenarioLabel: false,
  }));
}

function createInitialRow(columns: DatasetDraftColumn[]): DatasetDraftRow {
  return {
    id: "seed_row_1",
    rowKey: "row_1",
    scenarioLabel: "",
    isActive: true,
    values: Object.fromEntries(
      columns
        .map((column) => normalizeDatasetKey(column.columnKey))
        .filter((key) => key.length > 0)
        .map((key) => [key, ""]),
    ),
  };
}

export function DatasetWizardForm({
  draft,
  isSaving,
  isEditing,
  isCreating,
  onClose,
  onDraftChange,
  onSave,
  saveActionLabel,
}: Props) {
  const [activeStep, setActiveStep] = useState<WizardStep>("metadata");
  const [metadataTouched, setMetadataTouched] = useState(false);
  const [tableTouched, setTableTouched] = useState(false);
  const [tableValidation, setTableValidation] = useState({ isValid: false });
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (!isCreating) return;
    onDraftChange((current) => {
      if (current.columns.length > 0 || current.rows.length > 0) return current;
      const columns = createInitialColumns();
      return {
        ...current,
        columns,
        rows: [createInitialRow(columns)],
      };
    });
  }, [isCreating, onDraftChange]);

  useEffect(() => {
    setActiveStep("metadata");
    setMetadataTouched(false);
    setTableTouched(false);
  }, [isCreating, isEditing]);

  const metadataErrors = useMemo(() => buildMetadataErrors(draft), [draft]);
  const metadataValid = !hasMetadataErrors(metadataErrors);
  const tableValid = tableValidation.isValid;
  const handleTableValidationChange = useCallback((state: { isValid: boolean }) => {
    setTableValidation((current) => (current.isValid === state.isValid ? current : state));
  }, []);

  const goNext = () => {
    setMetadataTouched(true);
    if (!metadataValid) return;
    setActiveStep("table");
  };

  const handleStepClick = (stepId: WizardStep) => {
    if (stepId === "metadata") {
      setActiveStep("metadata");
      return;
    }
    setMetadataTouched(true);
    if (!metadataValid) {
      setActiveStep("metadata");
      return;
    }
    setActiveStep("table");
  };

  const handleSave = () => {
    setMetadataTouched(true);
    setTableTouched(true);
    if (!metadataValid) {
      setActiveStep("metadata");
      return;
    }
    if (!tableValid) {
      setActiveStep("table");
      return;
    }
    onSave();
  };

  const handleImportFile = async (file: File) => {
    setIsImporting(true);
    try {
      const imported = await importDatasetTableFromFile(file);
      onDraftChange((current) => ({
        ...current,
        name: current.name.trim() ? current.name : imported.suggestedName,
        sourceRef: current.sourceRef.trim() ? current.sourceRef : imported.suggestedSourceRef,
        sourceType: "imported",
        columns: imported.columns,
        rows: imported.rows,
      }));
      setTableTouched(false);
      notifySuccess(
        `Imported ${imported.rows.length} row(s) and ${imported.columns.length} column(s) from "${file.name}".`
      );
    } catch (error) {
      notifyError(error, "Failed to import dataset file.");
    } finally {
      setIsImporting(false);
    }
  };

  let metadataStepStatus: DatasetWizardStepItem["status"] = "complete";
  if (activeStep === "metadata") {
    metadataStepStatus = "current";
  } else if (metadataTouched && !metadataValid) {
    metadataStepStatus = "error";
  }

  let tableStepStatus: DatasetWizardStepItem["status"] = "upcoming";
  if (activeStep === "table") {
    tableStepStatus = tableTouched && !tableValid ? "error" : "current";
  }

  const stepItems: DatasetWizardStepItem[] = [
    {
      id: "metadata",
      title: "Metadata",
      description: "Name, type, description, source",
      status: metadataStepStatus,
    },
    {
      id: "table",
      title: "Table Builder",
      description: "Headers and scenario rows",
      status: tableStepStatus,
    },
  ];

  return (
    <WizardModalLayout
      title={isEditing ? "Edit Dataset" : "New Dataset"}
      description="Build dataset metadata first, then shape the final table before saving."
      sidebar={<DatasetWizardSteps steps={stepItems} onStepClick={handleStepClick} />}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          {activeStep === "table" ? (
            <Button type="button" variant="outline" onClick={() => setActiveStep("metadata")} disabled={isSaving}>
              Back
            </Button>
          ) : null}
          {activeStep === "metadata" ? (
            <Button type="button" variant="primary" onClick={goNext} disabled={isSaving || !metadataValid}>
              Next
            </Button>
          ) : (
            <Button type="button" variant="primary" onClick={handleSave} disabled={isSaving || !tableValid}>
              {isEditing ? "Save" : saveActionLabel}
            </Button>
          )}
        </>
      }
      onClose={onClose}
      closeButtonDisabled={isSaving}
      sidebarClassName="w-[28%] p-3"
      mainClassName="w-[72%]"
    >
      {activeStep === "metadata" ? (
        <DatasetMetadataStep
          draft={draft}
          isSaving={isSaving || isImporting}
          errors={metadataErrors}
          showErrors={metadataTouched}
          onDraftChange={onDraftChange}
          onEnterNext={goNext}
          onImportFile={handleImportFile}
          isImporting={isImporting}
        />
      ) : (
        <DatasetTableBuilder
          draft={draft}
          isSaving={isSaving}
          onDraftChange={onDraftChange}
          onValidationChange={handleTableValidationChange}
        />
      )}
    </WizardModalLayout>
  );
}
