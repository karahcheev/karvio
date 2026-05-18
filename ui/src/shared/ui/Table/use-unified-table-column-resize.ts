import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { UnifiedTableColumn } from "./types";

/** Column drag-resize: state, sync with resizable columns, and global pointer listeners. */
export function useUnifiedTableColumnResize<TItem, TColumn extends string>(
  columns: ReadonlyArray<UnifiedTableColumn<TItem, TColumn>>,
) {
  const resizableColumns = useMemo(
    () => columns.filter((column) => typeof column.defaultWidth === "number"),
    [columns],
  );
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(resizableColumns.map((column) => [column.id, column.defaultWidth!])),
  );
  const resizeStateRef = useRef<{ column: TColumn; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    setColumnWidths((current) => {
      const next = { ...current };
      for (const column of resizableColumns) {
        if (typeof next[column.id] !== "number") {
          next[column.id] = column.defaultWidth!;
        }
      }
      return next;
    });
  }, [resizableColumns]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) return;

      const column = columns.find((item) => item.id === resizeState.column);
      if (!column) return;
      const minWidth = column.minWidth ?? 56;
      const width = Math.max(minWidth, resizeState.startWidth + event.clientX - resizeState.startX);

      setColumnWidths((current) => ({
        ...current,
        [resizeState.column]: width,
      }));
    };

    const handlePointerUp = () => {
      resizeStateRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [columns]);

  const handleResizeStart = (column: UnifiedTableColumn<TItem, TColumn>, event: React.PointerEvent<HTMLSpanElement>) => {
    if (typeof column.defaultWidth !== "number") return;

    event.preventDefault();
    event.stopPropagation();
    resizeStateRef.current = {
      column: column.id,
      startX: event.clientX,
      startWidth: columnWidths[column.id] ?? column.defaultWidth,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return { columnWidths, handleResizeStart };
}
