import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, useUsersQuery, getAuditLogs, type AuditLogDto } from "@/shared/api";
import { getSessionUser } from "@/shared/auth";
import { getLastProjectId } from "@/shared/lib/last-project";
import type { AuditColumn, AuditFilters, AuditTableRow } from "@/modules/audit-logs/utils/types";
import { DEFAULT_FILTERS } from "@/modules/audit-logs/utils/constants";
import { mergeUniqueByEventId } from "@/modules/audit-logs/utils/helpers";
import { useColumnVisibility, useDisclosure, useSearchState, useTableSorting } from "@/shared/hooks";
import type { UnifiedTableSorting } from "@/shared/ui/Table";
import { mapAuditSorting } from "../utils/sorting";

const DEFAULT_VISIBLE_COLUMNS: AuditColumn[] = ["timestamp", "actor", "action", "resource", "result", "request_id"];
const DEFAULT_SORTING: UnifiedTableSorting<AuditColumn> = { column: "timestamp", direction: "desc" };

function resolveAuditProjectScope(isAdmin: boolean, fallbackProjectId: string | undefined): string | undefined {
  if (isAdmin) return undefined;
  return getLastProjectId() ?? fallbackProjectId;
}

function abortAuditLoadWithoutProject(
  mode: "replace" | "append",
  setLogs: Dispatch<SetStateAction<AuditLogDto[]>>,
  setHasNext: (value: boolean) => void,
  setNextPage: (value: number | null) => void,
  setError: (value: string | null) => void,
): void {
  if (mode === "replace") {
    setLogs([]);
    setHasNext(false);
    setNextPage(null);
  }
  setError("Project context is required to load audit logs");
}

export function useAuditLogsPage() {
  const queryClient = useQueryClient();
  const sessionUser = getSessionUser();
  const isAdmin = sessionUser?.role === "admin";
  const fallbackProjectId = sessionUser?.project_memberships[0]?.project_id;
  const { data: users = [] } = useUsersQuery(isAdmin);
  const { isOpen: columnsOpen, setIsOpen: setColumnsOpen } = useDisclosure(false);
  const { isOpen: filtersOpen, setIsOpen: setFiltersOpen } = useDisclosure(false);
  const { searchValue: searchQuery, setSearchValue: setSearchQuery } = useSearchState("");
  const { visibleColumns, toggleColumn } = useColumnVisibility<AuditColumn>(DEFAULT_VISIBLE_COLUMNS);
  const { sorting, setSorting } = useTableSorting<AuditColumn>(DEFAULT_SORTING);
  const [logs, setLogs] = useState<AuditLogDto[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(1);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftFilters, setDraftFilters] = useState<AuditFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AuditFilters>(DEFAULT_FILTERS);
  const [selectedLogEventId, setSelectedLogEventId] = useState<string | null>(null);
  const requestSeqRef = useRef(0);

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

  const loadLogs = useCallback(
    async (mode: "replace" | "append", page?: number | null) => {
      const projectIdScope = resolveAuditProjectScope(isAdmin, fallbackProjectId);

      if (!isAdmin && !projectIdScope) {
        abortAuditLoadWithoutProject(mode, setLogs, setHasNext, setNextPage, setError);
        return;
      }

      const requestSeq = ++requestSeqRef.current;
      if (mode === "replace") setIsLoading(true);
      else setIsLoadingMore(true);
      setError(null);

      const params = {
        project_id: projectIdScope,
        page: page ?? 1,
        page_size: 100,
        actor_id: appliedFilters.actorId || undefined,
        action: appliedFilters.action || undefined,
        resource_type: appliedFilters.resourceType || undefined,
        resource_id: appliedFilters.resourceId || undefined,
        result: appliedFilters.result === "all" ? undefined : appliedFilters.result,
        sort_by: mapAuditSorting(sorting.column),
        sort_order: sorting.direction,
      };

      try {
        const response = await queryClient.fetchQuery({
          queryKey: queryKeys.auditLogs.list(params),
          queryFn: () => getAuditLogs(params),
        });

        if (requestSeq !== requestSeqRef.current) return;

        setLogs((current) => (mode === "replace" ? response.items : mergeUniqueByEventId(current, response.items)));
        setHasNext(response.has_next);
        setNextPage(response.has_next ? response.page + 1 : null);
      } catch {
        if (requestSeq !== requestSeqRef.current) return;
        setError("Failed to load audit logs");
      } finally {
        if (requestSeq === requestSeqRef.current) {
          if (mode === "replace") setIsLoading(false);
          else setIsLoadingMore(false);
        }
      }
    },
    [appliedFilters, fallbackProjectId, isAdmin, queryClient, sorting.column, sorting.direction],
  );


  useEffect(() => {
    void loadLogs("replace");
  }, [loadLogs]);

  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return logs;

    return logs.filter((item) => {
      const actor = item.actor_id ? usersById.get(item.actor_id)?.username ?? item.actor_id : item.actor_type;
      const haystack = [
        item.event_id,
        item.action,
        item.resource_type ?? "",
        item.resource_id ?? "",
        actor,
        item.request_id ?? "",
        item.ip ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [logs, searchQuery, usersById]);

  const tableRows = useMemo<AuditTableRow[]>(
    () =>
      filteredLogs.map((item) => {
        const actor = item.actor_id ? usersById.get(item.actor_id) : null;
        const actorLabel = actor
          ? ([actor.first_name, actor.last_name].filter(Boolean).join(" ").trim() || actor.username)
          : item.actor_id ?? item.actor_type;
        return { ...item, actorLabel };
      }),
    [filteredLogs, usersById],
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
      nextPage,
      hasNext,
      isLoading,
      isLoadingMore,
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
      loadLogs,
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
