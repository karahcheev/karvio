import { useState } from "react";

export function usePaginationState(initialPage = 1, initialPageSize = 25) {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  return { page, setPage, pageSize, setPageSize };
}
