import type { TestDatasetDto } from "@/shared/api";

type DatasetSourceType = TestDatasetDto["source_type"];

export type DatasetDraftColumn = {
  id: string;
  columnKey: string;
  displayName: string;
  dataType: string;
  required: boolean;
  defaultValue: string;
  isScenarioLabel: boolean;
};

export type DatasetDraftRow = {
  id: string;
  rowKey: string;
  scenarioLabel: string;
  isActive: boolean;
  values: Record<string, unknown>;
};

export type DatasetDraft = {
  name: string;
  description: string;
  sourceType: DatasetSourceType;
  sourceRef: string;
  changeSummary: string;
  columns: DatasetDraftColumn[];
  rows: DatasetDraftRow[];
};

let localIdCounter = 0;

function nextLocalId(prefix: string): string {
  localIdCounter += 1;
  return `${prefix}_${localIdCounter}`;
}

function toInputValue(value: unknown): unknown {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function normalizeDatasetKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "");
}

export function buildUniqueDatasetKey(seed: string, existing: Set<string>, fallbackPrefix: string): string {
  const normalizedSeed = normalizeDatasetKey(seed);
  const base = normalizedSeed || normalizeDatasetKey(fallbackPrefix) || "item";
  if (!existing.has(base)) return base;
  let suffix = 2;
  while (existing.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

export function createEmptyDraftColumn(existingKeys: Set<string>): DatasetDraftColumn {
  const key = buildUniqueDatasetKey("column", existingKeys, "column");
  return {
    id: nextLocalId("col"),
    columnKey: key,
    displayName: key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
    dataType: "string",
    required: false,
    defaultValue: "",
    isScenarioLabel: false,
  };
}

export function createEmptyDraftRow(existingKeys: Set<string>, columnKeys: string[]): DatasetDraftRow {
  const rowKey = buildUniqueDatasetKey("row", existingKeys, "row");
  const values: Record<string, unknown> = {};
  for (const columnKey of columnKeys) {
    values[columnKey] = "";
  }
  return {
    id: nextLocalId("row"),
    rowKey,
    scenarioLabel: "",
    isActive: true,
    values,
  };
}

export const EMPTY_DATASET_DRAFT: DatasetDraft = {
  name: "",
  description: "",
  sourceType: "manual",
  sourceRef: "",
  changeSummary: "",
  columns: [],
  rows: [],
};

export function toDatasetDraft(dataset: TestDatasetDto): DatasetDraft {
  const revision = dataset.current_revision;
  const columns = [...(revision?.columns ?? [])]
    .sort((left, right) => left.order_index - right.order_index)
    .map((column) => {
      const normalizedKey = normalizeDatasetKey(column.column_key) || column.column_key;
      return {
        id: column.id || nextLocalId("col"),
        columnKey: normalizedKey,
        displayName: column.display_name,
        dataType: column.data_type || "string",
        required: column.required,
        defaultValue: column.default_value ?? "",
        isScenarioLabel: column.is_scenario_label,
      };
    });
  const columnKeys = columns.map((column) => column.columnKey);
  const rows = [...(revision?.rows ?? [])]
    .sort((left, right) => left.order_index - right.order_index)
    .map((row) => {
      const mappedValues: Record<string, unknown> = {};
      for (const sourceColumn of revision?.columns ?? []) {
        const normalizedKey = normalizeDatasetKey(sourceColumn.column_key) || sourceColumn.column_key;
        mappedValues[normalizedKey] = toInputValue(row.values[sourceColumn.column_key]);
      }
      for (const columnKey of columnKeys) {
        if (Object.prototype.hasOwnProperty.call(mappedValues, columnKey)) continue;
        mappedValues[columnKey] = "";
      }
      return {
        id: row.id || nextLocalId("row"),
        rowKey: row.row_key,
        scenarioLabel: row.scenario_label ?? "",
        isActive: row.is_active,
        values: mappedValues,
      };
    });

  return {
    name: dataset.name,
    description: dataset.description ?? "",
    sourceType: dataset.source_type,
    sourceRef: dataset.source_ref ?? "",
    changeSummary: "",
    columns,
    rows,
  };
}

export type DatasetSavePayload = {
  name: string;
  description: string | null;
  source_type: DatasetSourceType;
  source_ref: string | null;
  change_summary: string | null;
  columns: Array<{
    column_key: string;
    display_name: string;
    data_type: string;
    required: boolean;
    default_value: string | null;
    is_scenario_label: boolean;
  }>;
  rows: Array<{
    row_key: string;
    scenario_label: string | null;
    values: Record<string, unknown>;
    is_active: boolean;
  }>;
};

function ensureUniqueKeys(items: string[], itemName: string): void {
  const set = new Set<string>();
  for (const key of items) {
    if (set.has(key)) {
      throw new Error(`${itemName} must be unique.`);
    }
    set.add(key);
  }
}

export function buildDatasetSavePayload(draft: DatasetDraft): DatasetSavePayload {
  const name = draft.name.trim();
  if (!name) {
    throw new Error("Dataset name is required.");
  }

  const normalizedColumns = draft.columns.map((column) => {
    const columnKey = normalizeDatasetKey(column.columnKey);
    if (!columnKey) {
      throw new Error("Column key is required.");
    }
    const displayName = column.displayName.trim();
    if (!displayName) {
      throw new Error("Column display name is required.");
    }
    return {
      column_key: columnKey,
      display_name: displayName,
      data_type: column.dataType.trim() || "string",
      required: column.required,
      default_value: column.defaultValue.trim() || null,
      is_scenario_label: column.isScenarioLabel,
    };
  });
  ensureUniqueKeys(
    normalizedColumns.map((column) => column.column_key),
    "Column key",
  );

  const scenarioColumns = normalizedColumns.filter((column) => column.is_scenario_label).length;
  if (scenarioColumns > 1) {
    throw new Error("Only one column can be marked as scenario label.");
  }

  const columnKeySet = new Set(normalizedColumns.map((column) => column.column_key));

  const normalizedRows = draft.rows.map((row) => {
    const rowKey = normalizeDatasetKey(row.rowKey);
    if (!rowKey) {
      throw new Error("Row key is required.");
    }
    const values: Record<string, unknown> = {};
    for (const columnKey of columnKeySet) {
      const rawValue = row.values[columnKey];
      values[columnKey] = rawValue ?? "";
    }
    return {
      row_key: rowKey,
      scenario_label: row.scenarioLabel.trim() || null,
      values,
      is_active: row.isActive,
    };
  });
  ensureUniqueKeys(
    normalizedRows.map((row) => row.row_key),
    "Row key",
  );

  return {
    name,
    description: draft.description.trim() || null,
    source_type: draft.sourceType,
    source_ref: draft.sourceRef.trim() || null,
    change_summary: draft.changeSummary.trim() || null,
    columns: normalizedColumns,
    rows: normalizedRows,
  };
}
