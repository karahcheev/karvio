import { cn } from "@/shared/lib/cn";
import type { DatasetColumnDto, DatasetRowDto } from "@/shared/api";

type Props = Readonly<{
  columns: DatasetColumnDto[];
  rows: DatasetRowDto[];
  maxRows?: number;
  className?: string;
  emptyMessage?: string;
  showSystemColumns?: boolean;
}>;

function formatValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function DatasetRevisionTable({
  columns,
  rows,
  maxRows,
  className,
  emptyMessage,
  showSystemColumns = true,
}: Props) {
  if (rows.length === 0) {
    return (
      <div className={cn("rounded-md border border-dashed border-[var(--border)] bg-[var(--muted)] px-3 py-4 text-sm text-[var(--muted-foreground)]", className)}>
        {emptyMessage ?? "No rows in this revision."}
      </div>
    );
  }

  const sortedColumns = [...columns].sort((left, right) => left.order_index - right.order_index);
  const sortedRows = [...rows].sort((left, right) => left.order_index - right.order_index);
  const visibleRows = typeof maxRows === "number" ? sortedRows.slice(0, maxRows) : sortedRows;

  return (
    <div className={cn("overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--card)]", className)}>
      <table className="min-w-full border-collapse text-xs">
        <thead className="bg-[color-mix(in_srgb,var(--muted),transparent_30%)] text-[var(--muted-foreground)]">
          <tr>
            {showSystemColumns ? (
              <>
                <th className="border-b border-[var(--border)] px-2 py-2 text-left font-medium">Row key</th>
                <th className="border-b border-[var(--border)] px-2 py-2 text-left font-medium">Scenario</th>
                <th className="border-b border-[var(--border)] px-2 py-2 text-left font-medium">Active</th>
              </>
            ) : null}
            {sortedColumns.map((column) => (
              <th key={column.id} className="border-b border-[var(--border)] px-2 py-2 text-left font-medium">
                {column.display_name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <tr key={row.id}>
              {showSystemColumns ? (
                <>
                  <td className="border-b border-[var(--border)] px-2 py-2 font-mono text-[var(--foreground)]">{row.row_key}</td>
                  <td className="border-b border-[var(--border)] px-2 py-2 text-[var(--foreground)]">{row.scenario_label || row.row_key}</td>
                  <td className="border-b border-[var(--border)] px-2 py-2 text-[var(--foreground)]">{row.is_active ? "Yes" : "No"}</td>
                </>
              ) : null}
              {sortedColumns.map((column) => (
                <td key={`${row.id}_${column.id}`} className="border-b border-[var(--border)] px-2 py-2 text-[var(--foreground)]">
                  {formatValue(row.values[column.column_key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {typeof maxRows === "number" && sortedRows.length > maxRows ? (
        <div className="border-t border-[var(--border)] px-2 py-1 text-xs text-[var(--muted-foreground)]">
          Showing first {maxRows} of {sortedRows.length} rows.
        </div>
      ) : null}
    </div>
  );
}
