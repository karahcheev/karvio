import { useMemo, useState } from "react";

export function useSearchState(initialValue = "") {
  const [searchValue, setSearchValue] = useState(initialValue);
  const normalizedSearchValue = useMemo(() => searchValue.trim().toLowerCase(), [searchValue]);
  return { searchValue, setSearchValue, normalizedSearchValue };
}
