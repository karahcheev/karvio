import { buildUniqueDatasetKey, normalizeDatasetKey, type DatasetDraftColumn, type DatasetDraftRow } from "./draft";

type ImportedDatasetTable = {
  columns: DatasetDraftColumn[];
  rows: DatasetDraftRow[];
  suggestedName: string;
  suggestedSourceRef: string;
};

type ColumnSeed = {
  sourceKey: string;
  displayName: string;
};

let importIdCounter = 0;
function nextImportId(prefix: string): string {
  importIdCounter += 1;
  return `${prefix}_${importIdCounter}`;
}

function stripExtension(name: string): string {
  return name.replace(/\.[^/.]+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stepCsvInsideQuotes(
  text: string,
  index: number,
  cell: string,
): { cell: string; newIndex: number; inQuotes: boolean } {
  const char = text[index];
  if (char !== '"') {
    return { cell: cell + char, newIndex: index + 1, inQuotes: true };
  }
  const next = text[index + 1];
  if (next === '"') {
    return { cell: cell + '"', newIndex: index + 2, inQuotes: true };
  }
  return { cell, newIndex: index + 1, inQuotes: false };
}

function csvToRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let index = 0;

  while (index < text.length) {
    if (inQuotes) {
      const step = stepCsvInsideQuotes(text, index, cell);
      cell = step.cell;
      inQuotes = step.inQuotes;
      index = step.newIndex;
      continue;
    }

    const char = text[index];
    if (char === '"') {
      inQuotes = true;
      index += 1;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      index += 1;
      continue;
    }
    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      index += 1;
      continue;
    }
    if (char === "\r") {
      index += 1;
      continue;
    }
    cell += char;
    index += 1;
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((item, rowIndex, list) => {
    if (rowIndex < list.length - 1) return true;
    return item.some((cellValue) => cellValue.trim().length > 0);
  });
}

function uniqueDisplayName(seed: string, usedLower: Set<string>, index: number): string {
  const base = seed.trim() || `column_${index + 1}`;
  let candidate = base;
  let next = 2;
  while (usedLower.has(candidate.toLowerCase())) {
    candidate = `${base}_${next}`;
    next += 1;
  }
  usedLower.add(candidate.toLowerCase());
  return candidate;
}

function deriveColumnSeeds(rowObjects: Record<string, unknown>[]): ColumnSeed[] {
  const seen = new Set<string>();
  const seeds: ColumnSeed[] = [];
  for (const row of rowObjects) {
    for (const key of Object.keys(row)) {
      if (seen.has(key)) continue;
      seen.add(key);
      seeds.push({ sourceKey: key, displayName: key });
    }
  }
  return seeds;
}

function createDraftTableFromRows(
  rowObjects: Record<string, unknown>[],
  columnSeeds: ColumnSeed[],
): { columns: DatasetDraftColumn[]; rows: DatasetDraftRow[] } {
  if (columnSeeds.length === 0) {
    throw new Error("Could not derive columns from the imported file.");
  }
  if (columnSeeds.length > 10) {
    throw new Error("Imported file has more than 10 columns.");
  }

  const usedDisplayNames = new Set<string>();
  const usedColumnKeys = new Set<string>();
  const normalizedColumns = columnSeeds.map((seed, index) => {
    const displayName = uniqueDisplayName(seed.displayName, usedDisplayNames, index);
    const columnKey = buildUniqueDatasetKey(displayName, usedColumnKeys, `column_${index + 1}`);
    usedColumnKeys.add(columnKey);
    return {
      id: nextImportId("col"),
      sourceKey: seed.sourceKey,
      columnKey,
      displayName,
      dataType: "string",
      required: false,
      defaultValue: "",
      isScenarioLabel: false,
    };
  });

  const sourceRows = rowObjects.length > 0 ? rowObjects : [{}];
  const rows: DatasetDraftRow[] = sourceRows.map((sourceRow, index) => {
    const values: Record<string, unknown> = {};
    for (const column of normalizedColumns) {
      values[column.columnKey] = sourceRow[column.sourceKey] ?? "";
    }
    return {
      id: nextImportId("row"),
      rowKey: normalizeDatasetKey(`row_${index + 1}`),
      scenarioLabel: "",
      isActive: true,
      values,
    };
  });

  return {
    columns: normalizedColumns.map((column) => ({
      id: column.id,
      columnKey: column.columnKey,
      displayName: column.displayName,
      dataType: column.dataType,
      required: column.required,
      defaultValue: column.defaultValue,
      isScenarioLabel: column.isScenarioLabel,
    })),
    rows,
  };
}

function parseCsvFile(content: string): { rows: Record<string, unknown>[]; columns: ColumnSeed[] } {
  const rows = csvToRows(content);
  if (rows.length === 0) {
    throw new Error("CSV file is empty.");
  }
  const [headerRow, ...dataRows] = rows;
  const normalizedHeaders = headerRow.map((value, index) => value.trim() || `column_${index + 1}`);
  const columns = normalizedHeaders.map((header) => ({
    sourceKey: header,
    displayName: header,
  }));

  const mappedRows = dataRows
    .filter((row) => row.some((value) => value.trim().length > 0))
    .map((row) => {
      const item: Record<string, unknown> = {};
      normalizedHeaders.forEach((header, index) => {
        item[header] = row[index] ?? "";
      });
      return item;
    });

  return { rows: mappedRows, columns };
}

function parseJsonRowsFromArray(parsed: unknown[]): { rows: Record<string, unknown>[]; columns?: ColumnSeed[] } {
  if (parsed.length === 0) return { rows: [] };
  if (parsed.every((item) => isRecord(item))) {
    return { rows: parsed as Record<string, unknown>[] };
  }
  return {
    rows: parsed.map((item) => ({ value: item })),
    columns: [{ sourceKey: "value", displayName: "value" }],
  };
}

function columnSeedFromJsonValue(column: unknown, index: number): ColumnSeed {
  if (!isRecord(column)) {
    const value = String(column ?? `column_${index + 1}`);
    return { sourceKey: value, displayName: value };
  }
  const sourceKey = String(column.column_key ?? column.display_name ?? `column_${index + 1}`);
  const displayName = String(column.display_name ?? column.column_key ?? `column_${index + 1}`);
  return { sourceKey, displayName };
}

function parseJsonRowsFromObject(parsed: Record<string, unknown>): { rows: Record<string, unknown>[]; columns?: ColumnSeed[] } {
  const maybeColumns = Array.isArray(parsed.columns) ? parsed.columns : null;
  const maybeRows = Array.isArray(parsed.rows) ? parsed.rows : null;
  const maybeItems = Array.isArray(parsed.items) ? parsed.items : null;

  if (maybeRows) {
    const rows = maybeRows.map((item) => {
      if (isRecord(item) && isRecord(item.values)) {
        return item.values as Record<string, unknown>;
      }
      if (isRecord(item)) return item;
      return { value: item };
    });
    const columns = maybeColumns ? maybeColumns.map((column, index) => columnSeedFromJsonValue(column, index)) : undefined;
    return { rows, columns };
  }

  if (maybeItems?.every((item) => isRecord(item))) {
    return { rows: maybeItems as Record<string, unknown>[] };
  }

  return { rows: [parsed] };
}

function parseJsonRows(parsed: unknown): { rows: Record<string, unknown>[]; columns?: ColumnSeed[] } {
  if (Array.isArray(parsed)) {
    return parseJsonRowsFromArray(parsed);
  }
  if (isRecord(parsed)) {
    return parseJsonRowsFromObject(parsed);
  }
  throw new Error("Unsupported JSON format for dataset import.");
}

export async function importDatasetTableFromFile(file: File): Promise<ImportedDatasetTable> {
  const fileName = file.name.trim() || "dataset";
  const lowerName = fileName.toLowerCase();
  const content = await file.text();

  let rowObjects: Record<string, unknown>[];
  let columnSeeds: ColumnSeed[] | undefined;

  if (lowerName.endsWith(".csv")) {
    const csvParsed = parseCsvFile(content);
    rowObjects = csvParsed.rows;
    columnSeeds = csvParsed.columns;
  } else if (lowerName.endsWith(".json")) {
    const parsed = JSON.parse(content) as unknown;
    const jsonParsed = parseJsonRows(parsed);
    rowObjects = jsonParsed.rows;
    columnSeeds = jsonParsed.columns;
  } else {
    throw new Error("Only CSV and JSON files are supported.");
  }

  const resolvedSeeds = columnSeeds && columnSeeds.length > 0 ? columnSeeds : deriveColumnSeeds(rowObjects);
  const table = createDraftTableFromRows(rowObjects, resolvedSeeds);

  return {
    ...table,
    suggestedName: stripExtension(fileName) || "Imported dataset",
    suggestedSourceRef: fileName,
  };
}
