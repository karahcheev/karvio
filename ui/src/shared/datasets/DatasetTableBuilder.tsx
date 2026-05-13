import { Plus, Trash2 } from "lucide-react";
import {
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { DatasetDraft, DatasetDraftColumn, DatasetDraftRow } from "@/shared/datasets/draft";
import { normalizeDatasetKey } from "@/shared/datasets/draft";
import { Button, Input, Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";

type Props = Readonly<{
  draft: DatasetDraft;
  isSaving: boolean;
  onDraftChange: (value: DatasetDraft | ((prev: DatasetDraft) => DatasetDraft)) => void;
  onValidationChange: (state: { isValid: boolean }) => void;
}>;

type EditingState =
  | {
      mode: "header";
      columnId: string;
      value: string;
      originalValue: string;
    }
  | {
      mode: "cell";
      columnId: string;
      rowId: string;
      value: string;
      originalValue: string;
    }
  | null;

let localIdCounter = 0;
function nextLocalId(prefix: string): string {
  localIdCounter += 1;
  return `${prefix}_${localIdCounter}`;
}

function stringifyCellValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function nextColumnName(columns: DatasetDraftColumn[]): string {
  const existing = new Set(
    columns
      .map((column) => normalizeDatasetKey(column.displayName || column.columnKey))
      .filter((value) => value.length > 0),
  );
  let index = 1;
  while (existing.has(`column_${index}`)) index += 1;
  return `column_${index}`;
}

function nextRowKey(rows: DatasetDraftRow[]): string {
  const existing = new Set(rows.map((row) => normalizeDatasetKey(row.rowKey)).filter((value) => value.length > 0));
  let index = 1;
  while (existing.has(`row_${index}`)) index += 1;
  return `row_${index}`;
}

function buildHeaderValidation(columns: DatasetDraftColumn[]) {
  const emptyIds = new Set<string>();
  const counts = new Map<string, number>();
  const idsByKey = new Map<string, string[]>();

  for (const column of columns) {
    const header = column.displayName.trim();
    if (!header) {
      emptyIds.add(column.id);
    }
    const key = normalizeDatasetKey(header);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const ids = idsByKey.get(key) ?? [];
    ids.push(column.id);
    idsByKey.set(key, ids);
  }

  const duplicateIds = new Set<string>();
  const duplicateKeys: string[] = [];
  for (const [key, count] of counts.entries()) {
    if (count <= 1) continue;
    duplicateKeys.push(key);
    for (const id of idsByKey.get(key) ?? []) duplicateIds.add(id);
  }

  return {
    emptyIds,
    duplicateIds,
    duplicateKeys,
  };
}

function normalizeHeaderToColumnKey(headerText: string): string {
  return normalizeDatasetKey(headerText.trim());
}

function patchEditingCellInput(
  setEditing: Dispatch<SetStateAction<EditingState>>,
  rowId: string,
  columnId: string,
  event: ChangeEvent<HTMLInputElement>,
) {
  const { value } = event.target;
  setEditing((current) =>
    current?.mode === "cell" && current.rowId === rowId && current.columnId === columnId
      ? { ...current, value }
      : current,
  );
}

const GRID_ROW_HEIGHT_PX = 44;
const GRID_VIRTUAL_OVERSCAN_ROWS = 10;
const GRID_DEFAULT_VISIBLE_ROWS = 24;

export function DatasetTableBuilder({
  draft,
  isSaving,
  onDraftChange,
  onValidationChange,
}: Props) {
  const [editing, setEditing] = useState<EditingState>(null);
  const [gridErrorStripId] = useState(() => `dataset-grid-errors-${nextLocalId("err")}`);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const headerValidation = useMemo(() => buildHeaderValidation(draft.columns), [draft.columns]);
  const rowKeys = useMemo(
    () => draft.rows.map((row) => normalizeDatasetKey(row.rowKey)).filter((value) => value.length > 0),
    [draft.rows],
  );
  const rowKeySet = useMemo(() => new Set(rowKeys), [rowKeys]);
  const hasDuplicateRowKeys = rowKeySet.size !== rowKeys.length;
  const hasRowKeyError = hasDuplicateRowKeys || draft.rows.some((row) => normalizeDatasetKey(row.rowKey).length === 0);
  const rowIndexById = useMemo(() => {
    const indexMap = new Map<string, number>();
    draft.rows.forEach((row, index) => indexMap.set(row.id, index));
    return indexMap;
  }, [draft.rows]);

  const columnsCountError = draft.columns.length < 1 || draft.columns.length > 10;
  const rowsCountError = draft.rows.length < 1;
  const hasHeaderErrors = headerValidation.emptyIds.size > 0 || headerValidation.duplicateIds.size > 0;
  const isValid = !(columnsCountError || rowsCountError || hasHeaderErrors || hasRowKeyError);

  useEffect(() => {
    onValidationChange({ isValid });
  }, [isValid, onValidationChange]);

  const headerErrors: string[] = [];
  if (headerValidation.emptyIds.size > 0) {
    headerErrors.push("Header cannot be empty.");
  }
  if (headerValidation.duplicateKeys.length > 0) {
    headerErrors.push(`Duplicate headers: ${headerValidation.duplicateKeys.join(", ")}.`);
  }
  if (columnsCountError) {
    headerErrors.push("Columns must be between 1 and 10.");
  }
  if (rowsCountError) {
    headerErrors.push("At least one row is required.");
  }
  if (hasRowKeyError) {
    headerErrors.push("Row keys must be unique and non-empty.");
  }

  const addColumn = () => {
    if (draft.columns.length >= 10) return;
    const displayName = nextColumnName(draft.columns);
    const columnKey = normalizeHeaderToColumnKey(displayName);
    const newColumn: DatasetDraftColumn = {
      id: nextLocalId("col"),
      columnKey,
      displayName,
      dataType: "string",
      required: false,
      defaultValue: "",
      isScenarioLabel: false,
    };

    onDraftChange((current) => ({
      ...current,
      columns: [...current.columns, newColumn],
      rows: current.rows.map((row) => ({
        ...row,
        values: {
          ...row.values,
          [columnKey]: "",
        },
      })),
    }));
    setEditing({
      mode: "header",
      columnId: newColumn.id,
      value: newColumn.displayName,
      originalValue: newColumn.displayName,
    });
  };

  const removeColumn = (columnId: string) => {
    if (draft.columns.length <= 1) return;
    onDraftChange((current) => {
      const target = current.columns.find((column) => column.id === columnId);
      if (!target) return current;
      const keyToDelete = normalizeDatasetKey(target.columnKey);
      return {
        ...current,
        columns: current.columns.filter((column) => column.id !== columnId),
        rows: current.rows.map((row) => {
          if (!keyToDelete) return row;
          const nextValues = { ...row.values };
          delete nextValues[keyToDelete];
          return { ...row, values: nextValues };
        }),
      };
    });
    setEditing((current) => {
      if (!current) return current;
      if (current.mode === "header" && current.columnId === columnId) return null;
      if (current.mode === "cell" && current.columnId === columnId) return null;
      return current;
    });
  };

  const addRowBelow = (rowId: string) => {
    const rowIndex = draft.rows.findIndex((row) => row.id === rowId);
    if (rowIndex < 0) return;
    const newRowKey = nextRowKey(draft.rows);
    const newRow: DatasetDraftRow = {
      id: nextLocalId("row"),
      rowKey: newRowKey,
      scenarioLabel: "",
      isActive: true,
      values: Object.fromEntries(
        draft.columns
          .map((column) => normalizeDatasetKey(column.columnKey))
          .filter((columnKey) => columnKey.length > 0)
          .map((columnKey) => [columnKey, ""]),
      ),
    };

    onDraftChange((current) => {
      const targetIndex = current.rows.findIndex((row) => row.id === rowId);
      if (targetIndex < 0) return current;
      const nextRows = [...current.rows];
      nextRows.splice(targetIndex + 1, 0, newRow);
      return { ...current, rows: nextRows };
    });

    const firstColumn = draft.columns[0];
    if (!firstColumn) return;
    setEditing({
      mode: "cell",
      rowId: newRow.id,
      columnId: firstColumn.id,
      value: "",
      originalValue: "",
    });
  };

  const removeRow = (rowId: string) => {
    if (draft.rows.length <= 1) return;
    onDraftChange((current) => ({
      ...current,
      rows: current.rows.filter((row) => row.id !== rowId),
    }));
    setEditing((current) => (current?.mode === "cell" && current.rowId === rowId ? null : current));
  };

  const beginHeaderEdit = (column: DatasetDraftColumn) => {
    setEditing({
      mode: "header",
      columnId: column.id,
      value: column.displayName,
      originalValue: column.displayName,
    });
  };

  const beginCellEdit = (row: DatasetDraftRow, column: DatasetDraftColumn) => {
    const key = normalizeDatasetKey(column.columnKey);
    const value = key ? stringifyCellValue(row.values[key]) : "";
    setEditing({
      mode: "cell",
      columnId: column.id,
      rowId: row.id,
      value,
      originalValue: value,
    });
  };

  const moveHeaderEditing = (columnId: string, direction: 1 | -1) => {
    const currentIndex = draft.columns.findIndex((column) => column.id === columnId);
    if (currentIndex < 0) {
      setEditing(null);
      return;
    }
    const nextColumn = draft.columns[currentIndex + direction];
    if (!nextColumn) {
      setEditing(null);
      return;
    }
    setEditing({
      mode: "header",
      columnId: nextColumn.id,
      value: nextColumn.displayName,
      originalValue: nextColumn.displayName,
    });
  };

  const moveCellEditing = (rowId: string, columnId: string, direction: 1 | -1) => {
    const rowIndex = draft.rows.findIndex((row) => row.id === rowId);
    const columnIndex = draft.columns.findIndex((column) => column.id === columnId);
    if (rowIndex < 0 || columnIndex < 0) {
      setEditing(null);
      return;
    }

    const nextColumn = draft.columns[columnIndex + direction];
    if (nextColumn) {
      const row = draft.rows[rowIndex];
      const key = normalizeDatasetKey(nextColumn.columnKey);
      setEditing({
        mode: "cell",
        rowId: row.id,
        columnId: nextColumn.id,
        value: key ? stringifyCellValue(row.values[key]) : "",
        originalValue: key ? stringifyCellValue(row.values[key]) : "",
      });
      return;
    }

    const nextRow = draft.rows[rowIndex + direction];
    if (!nextRow) {
      setEditing(null);
      return;
    }
    const edgeColumn = direction > 0 ? draft.columns[0] : draft.columns[draft.columns.length - 1];
    if (!edgeColumn) {
      setEditing(null);
      return;
    }
    const edgeKey = normalizeDatasetKey(edgeColumn.columnKey);
    setEditing({
      mode: "cell",
      rowId: nextRow.id,
      columnId: edgeColumn.id,
      value: edgeKey ? stringifyCellValue(nextRow.values[edgeKey]) : "",
      originalValue: edgeKey ? stringifyCellValue(nextRow.values[edgeKey]) : "",
    });
  };

  const commitHeaderValue = (columnId: string, rawValue: string) => {
    const trimmedDisplayName = rawValue.trim();
    const nextKey = normalizeHeaderToColumnKey(trimmedDisplayName);

    onDraftChange((current) => {
      const targetColumn = current.columns.find((column) => column.id === columnId);
      if (!targetColumn) return current;
      const previousKey = normalizeDatasetKey(targetColumn.columnKey);

      const nextColumns = current.columns.map((column) =>
        column.id === columnId
          ? {
              ...column,
              displayName: trimmedDisplayName,
              columnKey: nextKey,
            }
          : column,
      );

      if (!previousKey || !nextKey || previousKey === nextKey) {
        return {
          ...current,
          columns: nextColumns,
        };
      }

      const nextRows = current.rows.map((row) => {
        if (!Object.prototype.hasOwnProperty.call(row.values, previousKey)) return row;
        const nextValues = { ...row.values };
        if (!Object.prototype.hasOwnProperty.call(nextValues, nextKey)) {
          nextValues[nextKey] = nextValues[previousKey];
          delete nextValues[previousKey];
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
  };

  const commitCellValue = (rowId: string, columnId: string, rawValue: string) => {
    const column = draft.columns.find((item) => item.id === columnId);
    if (!column) return;
    const key = normalizeDatasetKey(column.columnKey);
    if (!key) return;
    const preferredIndex = rowIndexById.get(rowId);
    onDraftChange((current) => {
      const resolvedIndex =
        typeof preferredIndex === "number" && current.rows[preferredIndex]?.id === rowId
          ? preferredIndex
          : current.rows.findIndex((row) => row.id === rowId);
      if (resolvedIndex < 0) return current;

      const currentRow = current.rows[resolvedIndex];
      if ((currentRow.values[key] ?? "") === rawValue) return current;

      const nextRows = [...current.rows];
      nextRows[resolvedIndex] = {
        ...currentRow,
        values: {
          ...currentRow.values,
          [key]: rawValue,
        },
      };

      return {
        ...current,
        rows: nextRows,
      };
    });
  };

  const headerHasError = (columnId: string) =>
    headerValidation.emptyIds.has(columnId) || headerValidation.duplicateIds.has(columnId);

  const handleGridScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  useEffect(() => {
    const node = scrollContainerRef.current;
    if (!node) return;
    setViewportHeight(node.clientHeight);
    setScrollTop(node.scrollTop);

    if (typeof ResizeObserver === "undefined") {
      const handleResize = () => setViewportHeight(node.clientHeight);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }

    const resizeObserver = new ResizeObserver(() => {
      setViewportHeight(node.clientHeight);
    });
    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, []);

  const totalRows = draft.rows.length;
  const visibleRowsEstimate =
    viewportHeight > 0 ? Math.ceil(viewportHeight / GRID_ROW_HEIGHT_PX) : GRID_DEFAULT_VISIBLE_ROWS;
  const unclampedStart = Math.max(0, Math.floor(scrollTop / GRID_ROW_HEIGHT_PX) - GRID_VIRTUAL_OVERSCAN_ROWS);
  const maxStart = Math.max(0, totalRows - visibleRowsEstimate);
  const virtualStartIndex = Math.min(unclampedStart, maxStart);
  const virtualEndIndex = Math.min(
    totalRows,
    virtualStartIndex + visibleRowsEstimate + GRID_VIRTUAL_OVERSCAN_ROWS * 2,
  );
  const visibleRows = useMemo(
    () => draft.rows.slice(virtualStartIndex, virtualEndIndex),
    [draft.rows, virtualStartIndex, virtualEndIndex],
  );
  const topSpacerHeight = virtualStartIndex * GRID_ROW_HEIGHT_PX;
  const bottomSpacerHeight = Math.max(0, (totalRows - virtualEndIndex) * GRID_ROW_HEIGHT_PX);

  useEffect(() => {
    if (editing?.mode !== "cell") return;
    const rowIndex = rowIndexById.get(editing.rowId);
    if (typeof rowIndex !== "number") return;
    const node = scrollContainerRef.current;
    if (!node) return;

    const rowTop = rowIndex * GRID_ROW_HEIGHT_PX;
    const rowBottom = rowTop + GRID_ROW_HEIGHT_PX;
    const viewportTop = node.scrollTop;
    const viewportBottom = viewportTop + node.clientHeight;

    if (rowTop < viewportTop) {
      node.scrollTop = rowTop;
      setScrollTop(rowTop);
      return;
    }
    if (rowBottom > viewportBottom) {
      const nextScrollTop = rowBottom - node.clientHeight;
      node.scrollTop = nextScrollTop;
      setScrollTop(nextScrollTop);
    }
  }, [editing, rowIndexById]);

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleGridScroll}
      className="max-h-[68vh] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--card)]"
    >
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="group/header">
              {draft.columns.map((column, columnIndex) => {
                const isEditingHeader = editing?.mode === "header" && editing.columnId === column.id;
                return (
                  <th
                    key={column.id}
                    className={cn(
                      "sticky top-0 z-30 min-w-44 border-b border-r border-[var(--border)] bg-[var(--card)] px-2 py-2 text-left align-top",
                      columnIndex === 0 ? "left-0 z-40" : "",
                      headerHasError(column.id) ? "bg-[var(--tone-danger-bg-soft)]" : ""
                    )}
                    style={{
                      boxShadow:
                        columnIndex === 0
                          ? "inset -1px 0 0 var(--border), inset 0 -1px 0 var(--border)"
                          : "inset 0 -1px 0 var(--border)",
                    }}
                  >
                    <div className="flex items-center gap-1">
                      {isEditingHeader ? (
                        <Input
                          autoFocus
                          value={editing.value}
                          aria-describedby={headerErrors.length > 0 ? gridErrorStripId : undefined}
                          onChange={(event) =>
                            setEditing((current) =>
                              current?.mode === "header" && current.columnId === column.id
                                ? { ...current, value: event.target.value }
                                : current,
                            )
                          }
                          onBlur={() => {
                            if (editing?.mode !== "header" || editing.columnId !== column.id) return;
                            commitHeaderValue(column.id, editing.value);
                            setEditing(null);
                          }}
                          onKeyDown={(event) => {
                            if (editing?.mode !== "header" || editing.columnId !== column.id) return;
                            if (event.key === "Escape") {
                              event.preventDefault();
                              setEditing(null);
                              return;
                            }
                            if (event.key === "Enter" || event.key === "Tab") {
                              event.preventDefault();
                              const direction: 1 | -1 = event.shiftKey ? -1 : 1;
                              commitHeaderValue(column.id, editing.value);
                              moveHeaderEditing(column.id, direction);
                            }
                          }}
                          disabled={isSaving}
                          className="h-8"
                        />
                      ) : (
                        <button
                          type="button"
                          className="w-full rounded px-1 py-1 text-left text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)] focus-visible:bg-[var(--muted)] focus-visible:outline-none"
                          onClick={() => beginHeaderEdit(column)}
                          disabled={isSaving}
                          aria-describedby={headerErrors.length > 0 ? gridErrorStripId : undefined}
                        >
                          {column.displayName.trim() || "—"}
                        </button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => removeColumn(column.id)}
                        disabled={isSaving || draft.columns.length <= 1}
                        aria-label={`Delete column ${column.displayName || column.columnKey || "column"}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </th>
                );
              })}
              <th
                className="sticky top-0 z-10 w-12 border-b border-[var(--border)] bg-[var(--card)] px-2 py-2 text-center"
                style={{ boxShadow: "inset 0 -1px 0 var(--border)" }}
              >
                {draft.columns.length >= 10 ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          disabled
                          aria-label="Add column"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent sideOffset={4}>Column limit reached</TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 opacity-0 transition-opacity group-hover/header:opacity-100 focus-visible:opacity-100"
                    onClick={addColumn}
                    disabled={isSaving}
                    aria-label="Add column"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                )}
              </th>
            </tr>
            {headerErrors.length > 0 ? (
              <tr>
                <th
                  id={gridErrorStripId}
                  colSpan={draft.columns.length + 1}
                  className="border-b border-[var(--tone-danger-border-strong)] bg-[var(--tone-danger-bg-soft)] px-3 py-2 text-left text-xs font-medium text-[var(--status-failure)]"
                >
                  {headerErrors.join(" ")}
                </th>
              </tr>
            ) : null}
          </thead>
          {topSpacerHeight > 0 ? (
            <tbody aria-hidden="true">
              <tr>
                <td colSpan={draft.columns.length + 1} className="border-0 p-0" style={{ height: topSpacerHeight }} />
              </tr>
            </tbody>
          ) : null}
          {visibleRows.map((row, visibleRowIndex) => {
            const rowIndex = virtualStartIndex + visibleRowIndex;
            return (
            <tbody key={row.id} className="group/row">
              <tr>
                {draft.columns.map((column, columnIndex) => {
                  const columnKey = normalizeDatasetKey(column.columnKey);
                  const isEditingCell =
                    editing?.mode === "cell" && editing.rowId === row.id && editing.columnId === column.id;
                  return (
                    <td
                      key={`${row.id}:${column.id}`}
                      className={cn(
                        "min-w-44 border-b border-r border-[var(--border)] p-0 align-top hover:bg-[color-mix(in_srgb,var(--muted),transparent_65%)]",
                        columnIndex === 0 ? "sticky left-0 z-20 bg-[var(--card)]" : "",
                      )}
                      style={
                        columnIndex === 0
                          ? { boxShadow: "inset -1px 0 0 var(--border)" }
                          : undefined
                      }
                    >
                      {isEditingCell ? (
                        <Input
                          autoFocus
                          value={editing.value}
                          onChange={(event) => patchEditingCellInput(setEditing, row.id, column.id, event)}
                          onBlur={() => {
                            if (
                              editing?.mode !== "cell" ||
                              editing.rowId !== row.id ||
                              editing.columnId !== column.id
                            ) {
                              return;
                            }
                            commitCellValue(row.id, column.id, editing.value);
                            setEditing(null);
                          }}
                          onKeyDown={(event) => {
                            if (
                              editing?.mode !== "cell" ||
                              editing.rowId !== row.id ||
                              editing.columnId !== column.id
                            ) {
                              return;
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              setEditing(null);
                              return;
                            }
                            if (event.key === "Enter" || event.key === "Tab") {
                              event.preventDefault();
                              const direction: 1 | -1 = event.shiftKey ? -1 : 1;
                              commitCellValue(row.id, column.id, editing.value);
                              moveCellEditing(row.id, column.id, direction);
                            }
                          }}
                          disabled={isSaving}
                          className="h-11 rounded-none border-0 px-3 py-2 shadow-none"
                        />
                      ) : (
                        <button
                          type="button"
                          className="block h-11 w-full overflow-hidden text-ellipsis whitespace-nowrap px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[color-mix(in_srgb,var(--muted),transparent_40%)] focus-visible:bg-[var(--muted)] focus-visible:outline-none"
                          onClick={() => beginCellEdit(row, column)}
                          disabled={isSaving || !columnKey}
                        >
                          {columnKey ? stringifyCellValue(row.values[columnKey]) || " " : "Set header"}
                        </button>
                      )}
                    </td>
                  );
                })}
                <td className="w-12 border-b border-[var(--border)] px-2 py-2 text-center align-top">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100"
                    onClick={() => removeRow(row.id)}
                    disabled={isSaving || draft.rows.length <= 1}
                    aria-label={`Delete row ${rowIndex + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
              <tr className="h-0">
                <td colSpan={draft.columns.length + 1} className="relative h-0 border-0 p-0">
                  <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1/2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="pointer-events-auto h-6 rounded-full px-2 text-xs opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100"
                      onClick={() => addRowBelow(row.id)}
                      disabled={isSaving}
                      aria-label={`Add row below row ${rowIndex + 1}`}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            </tbody>
          );
          })}
          {bottomSpacerHeight > 0 ? (
            <tbody aria-hidden="true">
              <tr>
                <td colSpan={draft.columns.length + 1} className="border-0 p-0" style={{ height: bottomSpacerHeight }} />
              </tr>
            </tbody>
          ) : null}
        </table>
      </div>
  );
}
