import { Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { Button, Checkbox, Input, SelectField, TextareaField, TextField } from "@/shared/ui";
import type { DatasetDraft } from "@/shared/datasets/draft";

type DraftRow = DatasetDraft["rows"][number];
import {
  createEmptyDraftColumn,
  createEmptyDraftRow,
  normalizeDatasetKey,
} from "@/shared/datasets/draft";
import { DATASET_SOURCE_TYPE_OPTIONS, formatDatasetSourceTypeLabel } from "@/shared/datasets/source-type";

type Props = Readonly<{
  draft: DatasetDraft;
  isSaving: boolean;
  onDraftChange: (value: DatasetDraft | ((prev: DatasetDraft) => DatasetDraft)) => void;
  className?: string;
}>;

const DATA_TYPE_OPTIONS = ["string", "number", "boolean", "json"] as const;

function findDuplicateKeys(keys: string[]): string[] {
  const counts = new Map<string, number>();
  for (const key of keys) {
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
}

function toCellInputValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function applyDatasetColumnKeyChange(
  columnId: string,
  rawValue: string,
  onDraftChange: Props["onDraftChange"],
) {
  const normalized = rawValue.trim() ? normalizeDatasetKey(rawValue) : "";
  onDraftChange((current) => {
    const currentColumn = current.columns.find((item) => item.id === columnId);
    if (!currentColumn) return current;
    const previousKey = normalizeDatasetKey(currentColumn.columnKey);
    const nextColumns = current.columns.map((item) =>
      item.id === columnId ? { ...item, columnKey: normalized } : item,
    );
    if (!previousKey || !normalized || previousKey === normalized) {
      return {
        ...current,
        columns: nextColumns,
      };
    }
    const nextRows = current.rows.map((row) => {
      if (!Object.prototype.hasOwnProperty.call(row.values, previousKey)) {
        return row;
      }
      const nextValues = { ...row.values };
      const previousValue = nextValues[previousKey];
      delete nextValues[previousKey];
      if (!Object.prototype.hasOwnProperty.call(nextValues, normalized)) {
        nextValues[normalized] = previousValue;
      }
      return {
        ...row,
        values: nextValues,
      };
    });
    return {
      ...current,
      columns: nextColumns,
      rows: nextRows,
    };
  });
}

function toggleDatasetScenarioLabelColumn(columnId: string, checked: boolean, onDraftChange: Props["onDraftChange"]) {
  onDraftChange((current) => ({
    ...current,
    columns: current.columns.map((item) => {
      if (item.id === columnId) return { ...item, isScenarioLabel: checked };
      if (checked) return { ...item, isScenarioLabel: false };
      return item;
    }),
  }));
}

function updateDatasetMatrixCellValue(
  rowId: string,
  columnKey: string,
  value: string,
  updateRow: (rowId: string, updater: (row: DraftRow) => DraftRow) => void,
) {
  updateRow(rowId, (item) => ({
    ...item,
    values: {
      ...item.values,
      [columnKey]: value,
    },
  }));
}

export function DatasetEditorForm({ draft, isSaving, onDraftChange, className }: Props) {
  const columnKeys = useMemo(
    () => draft.columns.map((column) => normalizeDatasetKey(column.columnKey)).filter((key) => key.length > 0),
    [draft.columns],
  );
  const duplicateColumnKeys = useMemo(() => findDuplicateKeys(columnKeys), [columnKeys]);
  const rowKeys = useMemo(
    () => draft.rows.map((row) => normalizeDatasetKey(row.rowKey)).filter((key) => key.length > 0),
    [draft.rows],
  );
  const duplicateRowKeys = useMemo(() => findDuplicateKeys(rowKeys), [rowKeys]);
  const scenarioColumnsCount = useMemo(
    () => draft.columns.filter((column) => column.isScenarioLabel).length,
    [draft.columns],
  );

  const updateColumn = (columnId: string, updater: (column: DatasetDraft["columns"][number]) => DatasetDraft["columns"][number]) => {
    onDraftChange((current) => ({
      ...current,
      columns: current.columns.map((column) => (column.id === columnId ? updater(column) : column)),
    }));
  };

  const updateRow = (rowId: string, updater: (row: DatasetDraft["rows"][number]) => DatasetDraft["rows"][number]) => {
    onDraftChange((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === rowId ? updater(row) : row)),
    }));
  };

  const addColumn = () => {
    onDraftChange((current) => {
      const existingKeys = new Set(current.columns.map((column) => normalizeDatasetKey(column.columnKey)).filter(Boolean));
      const newColumn = createEmptyDraftColumn(existingKeys);
      const rows = current.rows.map((row) => ({
        ...row,
        values: {
          ...row.values,
          [newColumn.columnKey]: "",
        },
      }));
      return {
        ...current,
        columns: [...current.columns, newColumn],
        rows,
      };
    });
  };

  const removeColumn = (columnId: string) => {
    onDraftChange((current) => {
      const target = current.columns.find((column) => column.id === columnId);
      if (!target) return current;
      const nextColumns = current.columns.filter((column) => column.id !== columnId);
      const keyToDelete = normalizeDatasetKey(target.columnKey);
      const nextRows = current.rows.map((row) => {
        if (!keyToDelete) return row;
        const nextValues = { ...row.values };
        delete nextValues[keyToDelete];
        return { ...row, values: nextValues };
      });
      return {
        ...current,
        columns: nextColumns,
        rows: nextRows,
      };
    });
  };

  const addRow = () => {
    onDraftChange((current) => {
      const existingRowKeys = new Set(current.rows.map((row) => normalizeDatasetKey(row.rowKey)).filter(Boolean));
      const columnKeys = current.columns
        .map((column) => normalizeDatasetKey(column.columnKey))
        .filter((key) => key.length > 0);
      return {
        ...current,
        rows: [...current.rows, createEmptyDraftRow(existingRowKeys, columnKeys)],
      };
    });
  };

  const removeRow = (rowId: string) => {
    onDraftChange((current) => ({
      ...current,
      rows: current.rows.filter((row) => row.id !== rowId),
    }));
  };

  return (
    <div className={className}>
      <TextField
        label="Name"
        value={draft.name}
        onChange={(event) => onDraftChange((current) => ({ ...current, name: event.target.value }))}
        disabled={isSaving}
      />
      <SelectField
        label="Source Type"
        value={draft.sourceType}
        onChange={(event) =>
          onDraftChange((current) => ({
            ...current,
            sourceType: event.target.value as DatasetDraft["sourceType"],
          }))
        }
        disabled={isSaving}
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
        textareaClassName="min-h-20"
        disabled={isSaving}
      />
      <TextField
        label="Source Ref"
        value={draft.sourceRef}
        onChange={(event) => onDraftChange((current) => ({ ...current, sourceRef: event.target.value }))}
        disabled={isSaving}
        placeholder="tests/test_login.py::test_auth[case-1]"
      />
      <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-medium text-[var(--foreground)]">Columns</h4>
            <p className="text-xs text-[var(--muted-foreground)]">{draft.columns.length} column(s)</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addColumn} disabled={isSaving}>
            <Plus className="h-4 w-4" />
            Add column
          </Button>
        </div>

        {duplicateColumnKeys.length > 0 ? (
          <p className="mb-2 text-xs text-[var(--status-failure)]">Duplicate column keys: {duplicateColumnKeys.join(", ")}</p>
        ) : null}
        {scenarioColumnsCount > 1 ? (
          <p className="mb-2 text-xs text-[var(--status-failure)]">Only one column can be marked as scenario label.</p>
        ) : null}

        {draft.columns.length === 0 ? (
          <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--card)] px-3 py-4 text-sm text-[var(--muted-foreground)]">
            Add at least one column to define dataset variables.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--card)]">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-[color-mix(in_srgb,var(--muted),transparent_30%)] text-xs text-[var(--muted-foreground)]">
                <tr>
                  <th className="border-b border-[var(--border)] px-2 py-2 text-left font-medium">Key</th>
                  <th className="border-b border-[var(--border)] px-2 py-2 text-left font-medium">Name</th>
                  <th className="border-b border-[var(--border)] px-2 py-2 text-left font-medium">Type</th>
                  <th className="border-b border-[var(--border)] px-2 py-2 text-left font-medium">Required</th>
                  <th className="border-b border-[var(--border)] px-2 py-2 text-left font-medium">Scenario</th>
                  <th className="border-b border-[var(--border)] px-2 py-2 text-left font-medium">Default</th>
                  <th className="border-b border-[var(--border)] px-2 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {draft.columns.map((column) => (
                  <tr key={column.id}>
                    <td className="border-b border-[var(--border)] px-2 py-2 align-top">
                      <Input
                        value={column.columnKey}
                        onChange={(event) => applyDatasetColumnKeyChange(column.id, event.target.value, onDraftChange)}
                        disabled={isSaving}
                        placeholder="login"
                      />
                    </td>
                    <td className="border-b border-[var(--border)] px-2 py-2 align-top">
                      <Input
                        value={column.displayName}
                        onChange={(event) => updateColumn(column.id, (item) => ({ ...item, displayName: event.target.value }))}
                        disabled={isSaving}
                        placeholder="Login"
                      />
                    </td>
                    <td className="border-b border-[var(--border)] px-2 py-2 align-top">
                      <select
                        className="h-10 w-full rounded-md border border-[var(--input)] bg-[var(--input-background)] px-3 py-2 text-sm text-[var(--foreground)] shadow-xs outline-none transition focus:border-[var(--ring)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ring),transparent_75%)] disabled:cursor-not-allowed disabled:bg-[var(--muted)] disabled:text-[var(--muted-foreground)]"
                        value={column.dataType}
                        onChange={(event) => updateColumn(column.id, (item) => ({ ...item, dataType: event.target.value }))}
                        disabled={isSaving}
                      >
                        {DATA_TYPE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b border-[var(--border)] px-2 py-2 align-middle">
                      <Checkbox
                        checked={column.required}
                        onChange={(event) => updateColumn(column.id, (item) => ({ ...item, required: event.target.checked }))}
                        disabled={isSaving}
                        aria-label={`Required ${column.displayName || column.columnKey || "column"}`}
                      />
                    </td>
                    <td className="border-b border-[var(--border)] px-2 py-2 align-middle">
                      <Checkbox
                        checked={column.isScenarioLabel}
                        onChange={(event) =>
                          toggleDatasetScenarioLabelColumn(column.id, event.target.checked, onDraftChange)
                        }
                        disabled={isSaving}
                        aria-label={`Scenario label ${column.displayName || column.columnKey || "column"}`}
                      />
                    </td>
                    <td className="border-b border-[var(--border)] px-2 py-2 align-top">
                      <Input
                        value={column.defaultValue}
                        onChange={(event) => updateColumn(column.id, (item) => ({ ...item, defaultValue: event.target.value }))}
                        disabled={isSaving}
                        placeholder="Optional"
                      />
                    </td>
                    <td className="border-b border-[var(--border)] px-2 py-2 text-right align-top">
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeColumn(column.id)} disabled={isSaving}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-medium text-[var(--foreground)]">Rows</h4>
            <p className="text-xs text-[var(--muted-foreground)]">{draft.rows.length} row(s)</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={isSaving}>
            <Plus className="h-4 w-4" />
            Add row
          </Button>
        </div>

        {duplicateRowKeys.length > 0 ? (
          <p className="mb-2 text-xs text-[var(--status-failure)]">Duplicate row keys: {duplicateRowKeys.join(", ")}</p>
        ) : null}

        {draft.rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--card)] px-3 py-4 text-sm text-[var(--muted-foreground)]">
            No rows yet. Add at least one scenario row.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--card)]">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-[color-mix(in_srgb,var(--muted),transparent_30%)] text-xs text-[var(--muted-foreground)]">
                <tr>
                  <th className="border-b border-[var(--border)] px-2 py-2 text-left font-medium">Row key</th>
                  <th className="border-b border-[var(--border)] px-2 py-2 text-left font-medium">Scenario label</th>
                  <th className="border-b border-[var(--border)] px-2 py-2 text-left font-medium">Active</th>
                  {draft.columns.map((column) => (
                    <th key={column.id} className="border-b border-[var(--border)] px-2 py-2 text-left font-medium">
                      {column.displayName || column.columnKey || "Column"}
                    </th>
                  ))}
                  <th className="border-b border-[var(--border)] px-2 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {draft.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="border-b border-[var(--border)] px-2 py-2 align-top">
                      <Input
                        value={row.rowKey}
                        onChange={(event) =>
                          updateRow(row.id, (item) => ({
                            ...item,
                            rowKey: event.target.value.trim() ? normalizeDatasetKey(event.target.value) : "",
                          }))
                        }
                        disabled={isSaving}
                        placeholder="happy_path"
                      />
                    </td>
                    <td className="border-b border-[var(--border)] px-2 py-2 align-top">
                      <Input
                        value={row.scenarioLabel}
                        onChange={(event) => updateRow(row.id, (item) => ({ ...item, scenarioLabel: event.target.value }))}
                        disabled={isSaving}
                        placeholder="Happy path"
                      />
                    </td>
                    <td className="border-b border-[var(--border)] px-2 py-2 align-middle">
                      <Checkbox
                        checked={row.isActive}
                        onChange={(event) => updateRow(row.id, (item) => ({ ...item, isActive: event.target.checked }))}
                        disabled={isSaving}
                        aria-label={`Row ${row.rowKey || row.id} active`}
                      />
                    </td>
                    {draft.columns.map((column) => {
                      const columnKey = normalizeDatasetKey(column.columnKey);
                      if (!columnKey) {
                        return (
                          <td key={`${row.id}_${column.id}`} className="border-b border-[var(--border)] px-2 py-2 align-top">
                            <span className="text-xs text-[var(--muted-foreground)]">Set column key</span>
                          </td>
                        );
                      }
                      return (
                        <td key={`${row.id}_${column.id}`} className="border-b border-[var(--border)] px-2 py-2 align-top">
                          <Input
                            value={toCellInputValue(row.values[columnKey])}
                            onChange={(event) =>
                              updateDatasetMatrixCellValue(row.id, columnKey, event.target.value, updateRow)
                            }
                            disabled={isSaving}
                            placeholder={column.defaultValue || "Value"}
                          />
                        </td>
                      );
                    })}
                    <td className="border-b border-[var(--border)] px-2 py-2 text-right align-top">
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(row.id)} disabled={isSaving}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {draft.columns.length === 0 ? (
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            Rows can be created without columns, but values are available only after columns are added.
          </p>
        ) : null}
      </div>
      <TextareaField
        label="Change summary"
        value={draft.changeSummary}
        onChange={(event) => onDraftChange((current) => ({ ...current, changeSummary: event.target.value }))}
        textareaClassName="min-h-20"
        disabled={isSaving}
      />
    </div>
  );
}
