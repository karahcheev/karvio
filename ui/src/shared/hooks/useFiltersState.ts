import { useMemo, useState } from "react";

type FilterMap<TFilter extends string> = Record<TFilter, Set<string>>;

export function useFiltersState<TFilter extends string>(initialValues?: Partial<Record<TFilter, Iterable<string>>>) {
  const [filters, setFilters] = useState<FilterMap<TFilter>>(() => {
    const next = {} as FilterMap<TFilter>;
    for (const [key, values] of Object.entries(initialValues ?? {}) as Array<[TFilter, Iterable<string> | undefined]>) {
      next[key] = new Set(values ?? []);
    }
    return next;
  });

  const activeFiltersCount = useMemo(
    () => (Object.values(filters) as Set<string>[]).reduce((count, items) => count + items.size, 0),
    [filters],
  );

  const setFilterValues = (filter: TFilter, values: Iterable<string>) => {
    setFilters((current) => ({ ...current, [filter]: new Set(values) }));
  };

  const toggleFilterValue = (filter: TFilter, value: string) => {
    setFilters((current) => {
      const next = new Set(current[filter] ?? []);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...current, [filter]: next };
    });
  };

  const clearFilters = () => {
    setFilters((current) => {
      const next = {} as FilterMap<TFilter>;
      for (const key of Object.keys(current) as TFilter[]) {
        next[key] = new Set<string>();
      }
      return next;
    });
  };

  return { filters, setFilters, setFilterValues, toggleFilterValue, clearFilters, activeFiltersCount };
}
