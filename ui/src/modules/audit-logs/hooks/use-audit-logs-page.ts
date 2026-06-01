import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys, useUsersQuery, getAuditLogs } from "@/shared/api";
import { getSessionUser } from "@/shared/auth";
import { getLastProjectId } from "@/shared/lib/last-project";
import type { AuditColumn, AuditFilters, AuditTableRow } from "@/modules/audit-logs/utils/types";
import { DEFAULT_FILTERS } from "@/modules/audit-logs/utils/constants";
import { useColumnVisibility, useDisclosure, useSearchState, useTableSorting } from "@/shared/hooks";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import type { UnifiedTableSorting } from "@/shared/ui/Table";
import { mapAuditSorting } from "../utils/sorting";

const DEFAULT_VISIBLE_COLUMNS: AuditColumn[] = ["timestamp", "actor", "action", "resource", "result", "request_id"];
const DEFAULT_SORTING: UnifiedTableSorting<AuditColumn> = { column: "timestamp", direction: "desc" };
const DEFAULT_PAGE_SIZE = 50;
export const AUDIT_PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

function resolveAuditProjectScope(isAdmin: boolean, fallbackProjectId: string | undefined): string | undefined {
  if (isAdmin) return undefined;
  return getLastProjectId() ?? fallbackProjectId;
}

export function useAuditLogsPage() {
  const sessionUser = getSessionUser();
  const isAdmin = sessionUser?.role === "admin";
  const fallbackProjectId = sessionUser?.project_memberships[0]?.project_id;
  const { data: users = [] } = useUsersQuery(isAdmin);
  const { isOpen: columnsOpen, setIsOpen: setColumnsOpen } = useDisclosure(false);
  const { isOpen: filtersOpen, setIsOpen: setFiltersOpen } = useDisclosure(false);
  const { searchValue: searchQuery, setSearchValue: setSearchQuery } = useSearchState("");
  const { visibleColumns, toggleColumn } = useColumnVisibility<AuditColumn>(DEFAULT_VISIBLE_COLUMNS, "audit-logs");
  const { sorting, setSorting } = useTableSorting<AuditColumn>(DEFAULT_SORTING);
  const [draftFilters, setDraftFilters] = useState<AuditFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AuditFilters>(DEFAULT_FILTERS);
  const [selectedLogEventId, setSelectedLogEventId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 250);

  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const actorOptions = useMemo(
    () =>
      [...users].sort((left, right) => {
        const leftLabel = [left.first_name, left.last_name].filter(Boolean).join(" ").trim() || left.username;
        const rightLabel = [right.first_name, right.last_name].filter(Boolean).join(" ").trim() || right.username;
        return leftLabel.localeCompare(rightLabel);
      }),
    [users],
  );

  const projectIdScope = resolveAuditProjectScope(isAdmin, fallbackProjectId);
  const missingProjectScope = !isAdmin && !projectIdScope;

  // Reset to the first page whenever the result set changes shape.
  useEffect(() => {
    setPage(1);
  }, [appliedFilters, debouncedSearchQuery, sorting.column, sorting.direction, pageSize]);

  const params = useMemo(
    () => ({
      project_id: projectIdScope,
      page,
      page_size: pageSize,
      actor_id: appliedFilters.actorId || undefined,
      action: appliedFilters.action || undefined,
      resource_type: appliedFilters.resourceType || undefined,
      resource_id: appliedFilters.resourceId || undefined,
      result: appliedFilters.result === "all" ? undefined : appliedFilters.result,
      search: debouncedSearchQuery.trim() || undefined,
      sort_by: mapAuditSorting(sorting.column),
      sort_order: sorting.direction,
    }),
    [appliedFilters, debouncedSearchQuery, page, pageSize, projectIdScope, sorting.column, sorting.direction],
  );

  const logsQuery = useQuery({
    queryKey: queryKeys.auditLogs.list(params),
    queryFn: () => getAuditLogs(params),
    enabled: !missingProjectScope,
    placeholderData: keepPreviousData,
  });

  const logs = useMemo(() => logsQuery.data?.items ?? [], [logsQuery.data]);
  const hasNext = logsQuery.data?.has_next ?? false;
  // Server lists return only has_next, so total page count is the current page (+1 if more exist).
  const totalPages = Math.max(page, hasNext ? page + 1 : page, 1);

  const error = missingProjectScope
    ? "Project context is required to load audit logs"
    : logsQuery.isError
      ? "Failed to load audit logs"
      : null;

  const tableRows = useMemo<AuditTableRow[]>(
    () =>
      logs.map((item) => {
        const actor = item.actor_id ? usersById.get(item.actor_id) : null;
        const actorLabel = actor
          ? [actor.first_name, actor.last_name].filter(Boolean).join(" ").trim() || actor.username
          : item.actor_id ?? item.actor_type;
        return { ...item, actorLabel };
      }),
    [logs, usersById],
  );

  const selectedLog = useMemo(
    () => tableRows.find((item) => item.event_id === selectedLogEventId) ?? null,
    [selectedLogEventId, tableRows],
  );

  const activeFiltersCount = useMemo(
    () =>
      [
        appliedFilters.result !== "all",
        Boolean(appliedFilters.actorId),
        Boolean(appliedFilters.action.trim()),
        Boolean(appliedFilters.resourceType.trim()),
        Boolean(appliedFilters.resourceId.trim()),
      ].filter(Boolean).length,
    [appliedFilters],
  );

  return {
    state: {
      columnsOpen,
      filtersOpen,
      searchQuery,
      visibleColumns,
      page,
      pageSize,
      totalPages,
      hasNext,
      isLoading: logsQuery.isLoading,
      isFetching: logsQuery.isFetching,
      error,
      draftFilters,
      selectedLogEventId,
      sorting,
    },
    data: {
      logs,
      actorOptions,
      tableRows,
      selectedLog,
      activeFiltersCount,
    },
    actions: {
      refresh: () => void logsQuery.refetch(),
      setPage,
      setPageSize,
      setColumnsOpen,
      setFiltersOpen,
      setSearchQuery,
      toggleColumn,
      setDraftFilters,
      setSelectedLogEventId,
      setSorting,
      handleClearFilters: () => {
        setDraftFilters(DEFAULT_FILTERS);
        setAppliedFilters(DEFAULT_FILTERS);
      },
      handleApplyFilters: () => {
        setAppliedFilters(draftFilters);
      },
    },
  };
}
