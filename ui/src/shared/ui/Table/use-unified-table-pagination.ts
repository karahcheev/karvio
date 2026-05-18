import { useEffect, useMemo, useState } from "react";
import { normalizePageSizeOptions } from "./pagination";
import type { UnifiedTableProps } from "./types";

type PaginationProp<TItem, TColumn extends string> = UnifiedTableProps<TItem, TColumn>["pagination"];

export function useUnifiedTablePaginationState<TItem, TColumn extends string>(
  items: TItem[],
  pagination: PaginationProp<TItem, TColumn>,
  paginationEnabled: boolean,
) {
  const isServerPagination = paginationEnabled && pagination?.mode === "server";
  const pageSizeOptions = useMemo(() => normalizePageSizeOptions(pagination?.pageSizeOptions), [pagination?.pageSizeOptions]);
  const fallbackDefaultPageSize = pageSizeOptions[Math.min(1, pageSizeOptions.length - 1)] ?? pageSizeOptions[0];
  const defaultPageSize = useMemo(() => {
    const requestedDefault = pagination?.defaultPageSize;
    if (typeof requestedDefault !== "number" || requestedDefault <= 0) {
      return fallbackDefaultPageSize;
    }
    const roundedDefault = Math.floor(requestedDefault);
    if (pageSizeOptions.includes(roundedDefault)) {
      return roundedDefault;
    }
    return pageSizeOptions.find((option) => option >= roundedDefault) ?? pageSizeOptions[pageSizeOptions.length - 1];
  }, [fallbackDefaultPageSize, pageSizeOptions, pagination?.defaultPageSize]);

  const [clientPageSize, setClientPageSize] = useState(defaultPageSize);
  const [clientPage, setClientPage] = useState(1);

  useEffect(() => {
    if (isServerPagination) return;
    setClientPageSize((current) => (pageSizeOptions.includes(current) ? current : defaultPageSize));
  }, [defaultPageSize, pageSizeOptions, isServerPagination]);

  const pageSize = isServerPagination ? (pagination?.pageSize ?? defaultPageSize) : clientPageSize;
  const page = isServerPagination ? (pagination?.page ?? 1) : clientPage;

  const totalPages = useMemo(() => {
    if (!paginationEnabled) return 1;
    if (isServerPagination) {
      return Math.max(1, pagination?.totalPages ?? 1);
    }
    return Math.max(1, Math.ceil(items.length / pageSize));
  }, [items.length, pageSize, paginationEnabled, isServerPagination, pagination?.totalPages]);

  useEffect(() => {
    if (isServerPagination) return;
    setClientPage((current) => Math.min(current, totalPages));
  }, [totalPages, isServerPagination]);

  useEffect(() => {
    if (isServerPagination) return;
    setClientPage(1);
  }, [clientPageSize, isServerPagination]);

  const displayedItems = useMemo(() => {
    if (!paginationEnabled) return items;
    if (isServerPagination) return items;
    const startIndex = (clientPage - 1) * clientPageSize;
    return items.slice(startIndex, startIndex + clientPageSize);
  }, [items, clientPage, clientPageSize, paginationEnabled, isServerPagination]);

  return {
    isServerPagination,
    pageSizeOptions,
    defaultPageSize,
    pageSize,
    page,
    totalPages,
    displayedItems,
    setClientPage,
    setClientPageSize,
  };
}
