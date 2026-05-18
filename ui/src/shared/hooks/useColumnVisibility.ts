import { useCallback, useState } from "react";

export function useColumnVisibility<TColumn extends string>(initialColumns: Iterable<TColumn>) {
  const [visibleColumns, setVisibleColumns] = useState<Set<TColumn>>(() => new Set(initialColumns));

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
