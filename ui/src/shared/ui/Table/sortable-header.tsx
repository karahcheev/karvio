// Sortable, optionally resizable header cell for UnifiedTable columns.

import type React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { StandardTableHeadCell } from "./base";
import type { UnifiedTableColumn, UnifiedTableProps } from "./types";

type UnifiedHeadCellProps<TItem, TColumn extends string> = Readonly<{
  column: UnifiedTableColumn<TItem, TColumn>;
  className?: string;
  style?: React.CSSProperties;
  onResizeStart: (column: UnifiedTableColumn<TItem, TColumn>, event: React.PointerEvent<HTMLSpanElement>) => void;
  sorting?: UnifiedTableProps<TItem, TColumn>["sorting"];
}>;

export function UnifiedHeadCell<TItem, TColumn extends string>({
  column,
  className,
  style,
  onResizeStart,
  sorting,
}: UnifiedHeadCellProps<TItem, TColumn>) {
  // Sort affordance and direction

  const isResizable = typeof column.defaultWidth === "number";
  const isSorted = sorting?.value.column === column.id;
  const sortDirection = isSorted ? sorting.value.direction : null;
  const isSortable = Boolean(column.sortable && sorting);
  let ariaSort: "ascending" | "descending" | "none" = "none";
  if (sortDirection === "asc") {
    ariaSort = "ascending";
  } else if (sortDirection === "desc") {
    ariaSort = "descending";
  }

  const handleSort = () => {
    if (!isSortable || !sorting) {
      return;
    }
    let nextDirection = column.defaultSortDirection ?? "asc";
    if (isSorted) {
      nextDirection = sortDirection === "asc" ? "desc" : "asc";
    }
    sorting.onChange({
      column: column.id,
      direction: nextDirection,
    });
  };

  let sortIcon;
  if (sortDirection === "asc") {
    sortIcon = <ArrowUp className="h-3.5 w-3.5 text-[var(--highlight-foreground)]" aria-hidden="true" />;
  } else if (sortDirection === "desc") {
    sortIcon = <ArrowDown className="h-3.5 w-3.5 text-[var(--highlight-foreground)]" aria-hidden="true" />;
  } else {
    sortIcon = <ArrowUpDown className="h-3.5 w-3.5 text-[var(--muted-foreground)]" aria-hidden="true" />;
  }

  return (
    <StandardTableHeadCell className={cn(isResizable && "group relative", className, column.headClassName)} style={style} aria-sort={ariaSort}>
      {isSortable ? (
        <button
          type="button"
          onClick={handleSort}
          className="m-0 flex w-full min-w-0 items-center gap-1 border-0 bg-transparent p-0 pr-4 text-left shadow-none"
        >
          <span className="min-w-0 flex-1 truncate">{column.label}</span>
          <span
            className={cn(
              "transition-opacity",
              isSorted ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
            )}
          >
            {sortIcon}
          </span>
        </button>
      ) : (
        column.label
      )}
      {isResizable ? (
        <button
          type="button"
          aria-label={`Resize ${typeof column.menuLabel === "string" ? column.menuLabel : "column"}`}
          onPointerDown={(event) => onResizeStart(column, event)}
          className="absolute inset-y-0 right-0 z-10 w-3 cursor-col-resize touch-none border-0 bg-transparent p-0"
        >
          <span className="absolute bottom-1 top-1 right-1/2 w-px translate-x-1/2 bg-[var(--action-primary-indicator)] opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      ) : null}
    </StandardTableHeadCell>
  );
}
