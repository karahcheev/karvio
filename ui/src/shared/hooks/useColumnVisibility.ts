import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY_PREFIX = "tms:columnVisibility:";

function readStoredColumns<TColumn extends string>(
  storageKey: string | undefined,
  allowedColumns: Set<TColumn>,
): Set<TColumn> | undefined {
  if (!storageKey || typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + storageKey);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    // Keep only columns that still exist to stay resilient to schema changes.
    const restored = parsed.filter((column): column is TColumn => typeof column === "string" && allowedColumns.has(column as TColumn));
    return new Set(restored);
  } catch {
    return undefined;
  }
}

/**
 * Tracks which table columns are visible.
 *
 * Pass a stable `storageKey` to persist the selection in localStorage so the
 * choice survives navigation away from and back to the table.
 */
export function useColumnVisibility<TColumn extends string>(initialColumns: Iterable<TColumn>, storageKey?: string) {
  const [visibleColumns, setVisibleColumns] = useState<Set<TColumn>>(() => {
    const allowedColumns = new Set(initialColumns);
    return readStoredColumns(storageKey, allowedColumns) ?? allowedColumns;
  });

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY_PREFIX + storageKey, JSON.stringify([...visibleColumns]));
    } catch {
      // Ignore write failures (e.g. storage full or disabled).
    }
  }, [storageKey, visibleColumns]);

  const toggleColumn = useCallback((column: TColumn) => {
    setVisibleColumns((current) => {
      const next = new Set(current);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      return next;
    });
  }, []);

  return { visibleColumns, setVisibleColumns, toggleColumn };
}
