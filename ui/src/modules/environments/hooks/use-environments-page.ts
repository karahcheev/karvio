import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import {
  useBulkArchiveEnvironmentsMutation,
  useCreateEnvironmentMutation,
  useDeleteEnvironmentMutation,
  useEnvironmentRevisionsPageQuery,
  useEnvironmentUseCasesQuery,
  useEnvironmentsPageQuery,
  usePatchEnvironmentMutation,
  type EnvironmentComponentDto,
  type EnvironmentDto,
  type EnvironmentNodeDto,
  type EnvironmentTopologyDto,
} from "@/shared/api";
import type { UnifiedTableProps } from "@/shared/ui/Table";
import { useSearchState } from "@/shared/hooks";
import { useDisclosure } from "@/shared/hooks";
import { LIST_SEARCH_DEBOUNCE_MS, useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { useDeleteConfirmation } from "@/shared/lib/use-delete-confirmation";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import {
  createEmptyEnvironmentHostDraft,
  type EnvironmentDraft,
  type EnvironmentHostDraft,
  type EnvironmentHostPlacement,
} from "../components";
import type { EnvironmentColumn } from "../components/EnvironmentsTable";

const EMPTY_DRAFT: EnvironmentDraft = {
  name: "",
  kind: "custom",
  status: "active",
  description: "",
  tagsText: "",
  useCasesText: "functional, performance",
  hosts: [],
  metaJson: "{}",
  extraJson: "{}",
};

function parseJsonObject(value: string, fieldName: string): Record<string, unknown> {
  const normalized = value.trim() || "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new Error(`${fieldName} must contain valid JSON.`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${fieldName} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function parseStringList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,\n]/g)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
}

function toHostDraft(
  placement: EnvironmentHostPlacement,
  component: EnvironmentComponentDto,
  node: EnvironmentNodeDto,
): EnvironmentHostDraft {
  const base = createEmptyEnvironmentHostDraft();
  return {
    ...base,
    name: String(node.name ?? component.name ?? ""),
    placement,
    hostType: String(node.host_type ?? "vm"),
    componentName: String(component.name ?? ""),
    componentType: String(component.component_type ?? ""),
    role: String(node.role ?? ""),
    provider: String(node.provider ?? ""),
    region: String(node.region ?? ""),
    endpoint: String(node.endpoint ?? ""),
    count: String(node.count ?? 1),
    tagsText: (node.tags ?? []).join(", "),
    componentEndpointsText: (component.endpoints ?? []).join(", "),
    componentTagsText: (component.tags ?? []).join(", "),
    resourcesJson: JSON.stringify(node.resources ?? {}, null, 2),
    metadataJson: JSON.stringify(node.metadata ?? {}, null, 2),
    componentMetadataJson: JSON.stringify(component.metadata ?? {}, null, 2),
  };
}

function flattenSection(
  placement: EnvironmentHostPlacement,
  components: EnvironmentComponentDto[] | undefined,
): EnvironmentHostDraft[] {
  return (components ?? []).flatMap((component) => {
    const nodes = component.nodes ?? [];
    if (nodes.length === 0) {
      return [
        toHostDraft(placement, component, {
          host_type: "vm",
          count: 1,
          resources: {},
          tags: [],
          metadata: {},
          name: component.name,
        }),
      ];
    }
    return nodes.map((node) => toHostDraft(placement, component, node));
  });
}

function toDraft(environment: EnvironmentDto): EnvironmentDraft {
  return {
    name: environment.name,
    kind: environment.kind ?? "custom",
    status: environment.status ?? "active",
    description: environment.description ?? "",
    tagsText: environment.tags.join(", "),
    useCasesText: environment.use_cases.join(", "),
    hosts: [
      ...flattenSection("load_generators", environment.topology.load_generators),
      ...flattenSection("system_under_test", environment.topology.system_under_test),
      ...flattenSection("supporting_services", environment.topology.supporting_services),
    ],
    metaJson: JSON.stringify(environment.meta ?? {}, null, 2),
    extraJson: JSON.stringify(environment.extra ?? {}, null, 2),
  };
}

function toNodePayload(host: EnvironmentHostDraft, hostIndex: number): EnvironmentNodeDto {
  return {
    name: host.name.trim() || null,
    host_type: host.hostType.trim() || "vm",
    role: host.role.trim() || null,
    provider: host.provider.trim() || null,
    region: host.region.trim() || null,
    endpoint: host.endpoint.trim() || null,
    count: parsePositiveInt(host.count),
    tags: parseStringList(host.tagsText),
    resources: parseJsonObject(host.resourcesJson, `Host ${hostIndex + 1} resources`),
    metadata: parseJsonObject(host.metadataJson, `Host ${hostIndex + 1} metadata`),
  };
}

function toComponentPayload(host: EnvironmentHostDraft, hostIndex: number): EnvironmentComponentDto {
  return {
    name: host.componentName.trim() || host.name.trim() || `host-${hostIndex + 1}`,
    component_type: host.componentType.trim() || null,
    endpoints: parseStringList(host.componentEndpointsText),
    tags: parseStringList(host.componentTagsText),
    metadata: parseJsonObject(host.componentMetadataJson, `Host ${hostIndex + 1} component metadata`),
    nodes: [toNodePayload(host, hostIndex)],
  };
}

function toTopologyPayload(draft: EnvironmentDraft): EnvironmentTopologyDto {
  const topology: EnvironmentTopologyDto = {
    load_generators: [],
    system_under_test: [],
    supporting_services: [],
    metadata: {},
  };

  draft.hosts
    .filter((host) => host.name.trim())
    .forEach((host, index) => {
      const component = toComponentPayload(host, index);
      if (host.placement === "load_generators") {
        topology.load_generators.push(component);
      } else if (host.placement === "supporting_services") {
        topology.supporting_services.push(component);
      } else {
        topology.system_under_test.push(component);
      }
    });

  return topology;
}

export function useEnvironmentsPage() {
  const { projectId } = useParams();
  const { searchValue, setSearchValue: setSearchQuery } = useSearchState("");
  const debouncedSearchValue = useDebouncedValue(searchValue, LIST_SEARCH_DEBOUNCE_MS);
  const { isOpen: filtersOpen, setIsOpen: setFiltersOpen } = useDisclosure(false);
  const { confirmDelete } = useDeleteConfirmation();
  const [selectedUseCases, setSelectedUseCases] = useState<Set<string>>(new Set());
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  const [openActionsEnvironmentId, setOpenActionsEnvironmentId] = useState<string | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<EnvironmentColumn>>(
    () => new Set<EnvironmentColumn>(["name", "status", "use_cases", "topology", "infra", "revision", "updated_at"]),
  );
  const [isCreating, setIsCreating] = useState(false);
  const [editingEnvironmentId, setEditingEnvironmentId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EnvironmentDraft>(EMPTY_DRAFT);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const useCasesQuery = useEnvironmentUseCasesQuery(projectId);

  const listParams = useMemo(
    () => ({
      page: currentPage,
      pageSize,
      search: debouncedSearchValue.trim() || undefined,
      useCases: selectedUseCases.size > 0 ? Array.from(selectedUseCases) : undefined,
      sortBy: "updated_at" as const,
      sortOrder: "desc" as const,
    }),
    [currentPage, pageSize, debouncedSearchValue, selectedUseCases],
  );

  const environmentsQuery = useEnvironmentsPageQuery(projectId, listParams);
  const revisionsQuery = useEnvironmentRevisionsPageQuery(
    selectedEnvironmentId ?? undefined,
    { page: 1, pageSize: 20 },
    Boolean(selectedEnvironmentId) && !isCreating && !editingEnvironmentId,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchValue, selectedUseCases]);

  const createMutation = useCreateEnvironmentMutation();
  const patchMutation = usePatchEnvironmentMutation();
  const deleteMutation = useDeleteEnvironmentMutation();
  const bulkArchiveMutation = useBulkArchiveEnvironmentsMutation();

  const useCaseOptions = useCasesQuery.data ?? [];

  const environments = useMemo(
    () => environmentsQuery.data?.items ?? [],
    [environmentsQuery.data?.items],
  );

  const listTotalItems = useMemo(() => {
    const total = environmentsQuery.data?.total;
    return typeof total === "number" ? total : undefined;
  }, [environmentsQuery.data?.total]);

  const totalPages = useMemo(() => {
    if (typeof listTotalItems === "number") {
      return Math.max(1, Math.ceil(listTotalItems / pageSize));
    }
    return Math.max(1, currentPage + (environmentsQuery.data?.has_next ? 1 : 0));
  }, [listTotalItems, pageSize, currentPage, environmentsQuery.data?.has_next]);

  const tablePagination = useMemo((): NonNullable<UnifiedTableProps<EnvironmentDto, EnvironmentColumn>["pagination"]> => {
    return {
      enabled: true,
      mode: "server",
      page: currentPage,
      totalPages,
      totalItems: listTotalItems,
      pageSize,
      pageSizeOptions: [10, 25, 50],
      defaultPageSize: pageSize,
      onPageChange: (page: number) => {
        if (page === currentPage) return;
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);
      },
      onPageSizeChange: (nextSize: number) => {
        if (nextSize === pageSize) return;
        setPageSize(nextSize);
        setCurrentPage(1);
      },
    };
  }, [currentPage, totalPages, listTotalItems, pageSize]);

  const selectedEnvironment = useMemo(
    () =>
      selectedEnvironmentId
        ? environments.find((environment) => environment.id === selectedEnvironmentId) ?? null
        : null,
    [environments, selectedEnvironmentId],
  );

  useEffect(() => {
    if (!selectedEnvironmentId) return;
    if (!environments.some((e) => e.id === selectedEnvironmentId)) {
      setSelectedEnvironmentId(null);
    }
  }, [environments, selectedEnvironmentId]);

  useEffect(() => {
    const visibleEnvironmentIds = new Set(environments.map((environment) => environment.id));
    setSelectedRowIds((current) => {
      const next = new Set(Array.from(current).filter((environmentId) => visibleEnvironmentIds.has(environmentId)));
      return next.size === current.size ? current : next;
    });
    setOpenActionsEnvironmentId((current) =>
      current && !visibleEnvironmentIds.has(current) ? null : current,
    );
  }, [environments]);

  const clearRowSelection = useCallback(() => {
    setSelectedRowIds(new Set());
  }, []);

  const handleToggleRowSelection = useCallback((environmentId: string) => {
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (next.has(environmentId)) next.delete(environmentId);
      else next.add(environmentId);
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback((checked: boolean, visibleRowIds?: string[]) => {
    if (!visibleRowIds?.length) return;
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (checked) {
        for (const environmentId of visibleRowIds) next.add(environmentId);
      } else {
        for (const environmentId of visibleRowIds) next.delete(environmentId);
      }
      return next;
    });
  }, []);

  const resetDraft = useCallback(() => {
    setDraft(EMPTY_DRAFT);
    setIsCreating(false);
    setEditingEnvironmentId(null);
  }, []);

  const handleCreateStart = useCallback(() => {
    setDraft(EMPTY_DRAFT);
    setEditingEnvironmentId(null);
    setIsCreating(true);
  }, []);

  const handleEditStart = useCallback((environment: EnvironmentDto) => {
    setDraft(toDraft(environment));
    setEditingEnvironmentId(environment.id);
    setIsCreating(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!projectId || !draft.name.trim()) return;

    const payload = {
      name: draft.name.trim(),
      kind: draft.kind.trim() || "custom",
      status: draft.status.trim() || "active",
      description: draft.description.trim() || null,
      tags: parseStringList(draft.tagsText),
      use_cases: parseStringList(draft.useCasesText),
      topology: toTopologyPayload(draft),
      meta: parseJsonObject(draft.metaJson, "Meta"),
      extra: parseJsonObject(draft.extraJson, "Extra"),
    } as const;

    try {
      if (editingEnvironmentId) {
        await patchMutation.mutateAsync({ environmentId: editingEnvironmentId, payload });
        notifySuccess(`Environment "${draft.name.trim()}" updated`);
      } else {
        await createMutation.mutateAsync({ project_id: projectId, ...payload });
        notifySuccess(`Environment "${draft.name.trim()}" created`);
      }
      resetDraft();
    } catch (error) {
      notifyError(error, "Failed to save environment.");
    }
  }, [createMutation, draft, editingEnvironmentId, patchMutation, projectId, resetDraft]);

  const handleDelete = useCallback(
    async (environment: EnvironmentDto) => {
      if (!projectId) return;
      const confirmed = await confirmDelete({
        title: "Archive Environment",
        description: `Archive environment "${environment.name}"?`,
        confirmLabel: "Archive",
      });
      if (!confirmed) return;
      try {
        await deleteMutation.mutateAsync({ environmentId: environment.id, projectId });
        if (editingEnvironmentId === environment.id) resetDraft();
        if (selectedEnvironmentId === environment.id) setSelectedEnvironmentId(null);
        notifySuccess(`Environment "${environment.name}" archived`);
      } catch (error) {
        notifyError(error, "Failed to archive environment.");
      }
    },
    [
      confirmDelete,
      deleteMutation,
      editingEnvironmentId,
      projectId,
      resetDraft,
      selectedEnvironmentId,
    ],
  );

  const handleBulkArchive = useCallback(async () => {
    if (!projectId || selectedRowIds.size === 0 || bulkArchiveMutation.isPending) return;
    const environmentIds = Array.from(selectedRowIds);
    const confirmed = await confirmDelete({
      title: "Archive Environments",
      description: `Archive ${environmentIds.length} environment(s)?`,
      confirmLabel: "Archive",
    });
    if (!confirmed) return;

    try {
      const result = await bulkArchiveMutation.mutateAsync({ environmentIds, projectId });
      clearRowSelection();
      setOpenActionsEnvironmentId(null);

      const archivedSet = new Set(result.succeededIds);
      if (editingEnvironmentId && archivedSet.has(editingEnvironmentId)) resetDraft();
      if (selectedEnvironmentId && archivedSet.has(selectedEnvironmentId)) setSelectedEnvironmentId(null);

      if (result.failed.length === 0) {
        notifySuccess(
          result.succeededIds.length === 1
            ? "1 environment archived"
            : `${result.succeededIds.length} environments archived`,
        );
      } else if (result.succeededIds.length === 0) {
        notifyError(result.failed[0]?.reason, "Failed to archive selected environments.");
      } else {
        notifySuccess(
          `${result.succeededIds.length} archived, ${result.failed.length} failed. Refresh and retry failed items.`,
        );
      }
    } catch (error) {
      notifyError(error, "Failed to archive selected environments.");
    }
  }, [
    bulkArchiveMutation,
    clearRowSelection,
    confirmDelete,
    editingEnvironmentId,
    projectId,
    resetDraft,
    selectedEnvironmentId,
    selectedRowIds,
  ]);

  return {
    projectId: projectId ?? "",
    environments,
    revisions: revisionsQuery.data?.items ?? [],
    useCaseOptions,
    selectedEnvironmentId,
    selectedEnvironment,
    setSelectedEnvironmentId,
    searchQuery: searchValue,
    setSearchQuery,
    filtersOpen,
    setFiltersOpen,
    selectedUseCases,
    activeFiltersCount: selectedUseCases.size,
    tablePagination,
    isLoading:
      Boolean(projectId) &&
      (environmentsQuery.isPending ||
        (environmentsQuery.isFetching && environments.length === 0 && environmentsQuery.data === undefined)),
    isSaving:
      createMutation.isPending ||
      patchMutation.isPending ||
      deleteMutation.isPending ||
      bulkArchiveMutation.isPending,
    isCreating,
    editingEnvironmentId,
    draft,
    setDraft,
    selectedRowIds,
    openActionsEnvironmentId,
    columnsOpen,
    visibleColumns,
    clearRowSelection,
    onToggleRowSelection: handleToggleRowSelection,
    onToggleSelectAll: handleToggleSelectAll,
    onColumnsOpenChange: setColumnsOpen,
    onToggleColumn: (column: EnvironmentColumn) =>
      setVisibleColumns((current) => {
        const next = new Set(current);
        if (next.has(column)) next.delete(column);
        else next.add(column);
        return next;
      }),
    onOpenEnvironmentActions: (environmentId: string) => setOpenActionsEnvironmentId(environmentId),
    onCloseEnvironmentActions: () => setOpenActionsEnvironmentId(null),
    onToggleUseCase: (value: string) =>
      setSelectedUseCases((current) => {
        const next = new Set(current);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return next;
      }),
    onClearFilters: () => {
      setSelectedUseCases(new Set());
      setFiltersOpen(false);
      setCurrentPage(1);
    },
    handleCreateStart,
    handleEditStart,
    handleCancelForm: resetDraft,
    handleSave,
    handleDelete,
    handleBulkArchive,
  };
}
