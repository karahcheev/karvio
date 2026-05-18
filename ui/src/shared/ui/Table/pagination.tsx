// Table footer: range summary, page size select, and page buttons.

import { useId, type ReactNode } from "react";
import { PageNumberPagination } from "@/shared/ui/PageNumberPagination";

const defaultTablePageSizeOptions = [10, 25, 50] as const;

export function normalizePageSizeOptions(options?: number[]): number[] {
  const source = options && options.length > 0 ? options : [...defaultTablePageSizeOptions];
  const normalized = Array.from(new Set(source.map((value) => Math.floor(value)).filter((value) => value > 0))).sort(
    (left, right) => left - right,
  );
  return normalized.length > 0 ? normalized : [25];
}

type TablePaginationProps = Readonly<{
  page: number;
  pageSize: number;
  pageSizeOptions: number[];
  /** When omitted (server lists without total), the range line omits “of N”. */
  totalItems?: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  /** Rows rendered on this page — used when totalItems is unknown */
  currentPageItemCount: number;
}>;

export function TablePagination({
  page,
  pageSize,
  pageSizeOptions,
  totalItems,
  totalPages,
  onPageChange,
  onPageSizeChange,
  currentPageItemCount,
}: TablePaginationProps) {
  const pageSizeSelectId = useId();

  let pageStart = 0;
  if (typeof totalItems === "number") {
    pageStart = totalItems > 0 ? (page - 1) * pageSize + 1 : 0;
  } else if (currentPageItemCount > 0) {
    pageStart = (page - 1) * pageSize + 1;
  }

  const pageEnd =
    typeof totalItems === "number"
      ? Math.min(page * pageSize, totalItems)
      : (page - 1) * pageSize + currentPageItemCount;

  let rangeLabel: ReactNode;
  if (typeof totalItems === "number") {
    rangeLabel = (
      <>
        Showing {pageStart}-{pageEnd} of {totalItems}
      </>
    );
  } else if (currentPageItemCount > 0) {
    rangeLabel = (
      <>
        Showing {pageStart}-{pageEnd}
      </>
    );
  } else {
    rangeLabel = <>Showing 0</>;
  }

  return (
    <div className="border-t border-[var(--border)] bg-[var(--table-surface)] px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Range label */}
        <span className="text-sm text-[var(--muted-foreground)]">{rangeLabel}</span>
        <div className="flex flex-wrap items-center gap-2">
          {/* Page size */}
          <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]" htmlFor={pageSizeSelectId}>
            Rows:{" "}
            <select
              id={pageSizeSelectId}
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="rounded-md border border-[var(--input)] bg-[var(--input-background)] px-2 py-1 text-sm text-[var(--foreground)]"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          {/* Page controls */}
          <PageNumberPagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
        </div>
      </div>
    </div>
  );
}
