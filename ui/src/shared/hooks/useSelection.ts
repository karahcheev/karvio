import { useCallback, useState } from "react";

export function useSelection<TId extends string>(initialIds?: Iterable<TId>) {
  const [selectedIds, setSelectedIds] = useState<Set<TId>>(() => new Set(initialIds));

  const clear = useCallback(() => setSelectedIds(new Set()), []);
  const replace = useCallback((ids: Iterable<TId>) => setSelectedIds(new Set(ids)), []);
  const toggle = useCallback((id: TId) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const toggleMany = useCallback((ids: Iterable<TId>, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  return { selectedIds, setSelectedIds, clear, replace, toggle, toggleMany };
}
