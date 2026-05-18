import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Archive, ArchiveRestore, ExternalLink, FileUp } from "lucide-react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPerformanceRunsPage, patchPerformanceRun } from "@/shared/api";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { getErrorMessage, notifyError, notifySuccess } from "@/shared/lib/notifications";
import { PageNumberPagination } from "@/shared/ui/PageNumberPagination";
import {
  Button,
  EntityListPage,
  FilterChecklistSection,
  ListPageEmptyState,
  RunProgressBarMini,
  StatusBadge,
} from "@/shared/ui";
import { RowActionsMenu } from "@/shared/ui/RowActionsMenu";
import { UnifiedTable, type UnifiedTableColumn } from "@/shared/ui/Table";
import { PrimarySecondaryCell } from "@/shared/ui/table-cells";
import { RUN_STATUSES } from "./constants";
import { ImportPerformanceArtifactModal } from "./import-performance-artifact-modal";
import { mapPerformanceRunDto } from "./mappers";
import {
  formatDateTime,
  formatDuration,
  getLoadKindLabel,
  getLoadKindTone,
  getRunLoadKind,
  getPerfRunProgressBarModel,
  getStatusLabel,
  getStatusTone,
  toggleSetValue,
} from "./perf-utils";
import type { PerfLoadKind, PerfRun, PerfRunStatus } from "./types";

type PerformanceRunColumn = "title" | "status" | "type" | "version" | "started" | "progress" | "tool";

export function PerformanceRunsListView() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showArchivedRuns, setShowArchivedRuns] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [selectedLoadKinds, setSelectedLoadKinds] = useState<Set<string>>(new Set());
  const [selectedEnvironments, setSelectedEnvironments] = useState<Set<string>>(new Set());
  const [selectedRunIds, setSelectedRunIds] = useState<Set<string>>(new Set());
  const [openActionsRunId, setOpenActionsRunId] = useState<string | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<PerformanceRunColumn>>(
    () =>
      new Set<PerformanceRunColumn>([
        "title",
        "status",
        "type",
        "version",
        "started",
        "progress",
        "tool",
      ]),
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 250);

  const selectedStatusValues = useMemo(
    () =>
      Array.from(selectedStatuses).sort((a, b) => String(a).localeCompare(String(b))) as PerfRunStatus[],
    [selectedStatuses],
  );
  const selectedLoadKindValues = useMemo(
    () =>
      Array.from(selectedLoadKinds).sort((a, b) => String(a).localeCompare(String(b))) as PerfLoadKind[],
    [selectedLoadKinds],
  );
  const selectedEnvironmentValues = useMemo(
    () => Array.from(selectedEnvironments).sort((a, b) => a.localeCompare(b)),
    [selectedEnvironments],
  );

  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearchQuery,
    selectedStatusValues,
    selectedLoadKindValues,
    selectedEnvironmentValues,
    showArchivedRuns,
  ]);

  const archiveRunMutation = useMutation({
    mutationFn: async (payload: { runId: string; archived: boolean }) =>
      patchPerformanceRun(payload.runId, { archived: payload.archived }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["performance-runs"] });
      notifySuccess(variables.archived ? "Run archived." : "Run restored.");
    },
    onError: (error, variables) => {
      notifyError(error, variables.archived ? "Failed to archive run." : "Failed to restore run.");
    },
  });

  const runsQuery = useQuery({
    queryKey: [
      "performance-runs",
      projectId,
      page,
      pageSize,
      selectedStatusValues,
      selectedLoadKindValues,
      selectedEnvironmentValues,
      debouncedSearchQuery.trim(),
      showArchivedRuns,
    ],
    queryFn: async () => {
      if (!projectId) return null;
      const runsPage = await getPerformanceRunsPage({
        projectId,
        page,
        pageSize,
        statuses: selectedStatusValues.length > 0 ? selectedStatusValues : undefined,
        loadKinds: selectedLoadKindValues.length > 0 ? selectedLoadKindValues : undefined,
        environments: selectedEnvironmentValues.length > 0 ? selectedEnvironmentValues : undefined,
        search: debouncedSearchQuery.trim() || undefined,
        includeArchived: showArchivedRuns,
        sortBy: "started_at",
        sortOrder: "desc",
      });
      return { ...runsPage, items: runsPage.items.map(mapPerformanceRunDto) };
    },
    enabled: Boolean(projectId),
    placeholderData: keepPreviousData,
  });

  const filteredRuns = useMemo(() => runsQuery.data?.items ?? [], [runsQuery.data]);
  useEffect(() => {
    const visibleRunIds = new Set(filteredRuns.map((run) => run.id));
    setSelectedRunIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => visibleRunIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
    setOpenActionsRunId((current) => (current && !visibleRunIds.has(current) ? null : current));
  }, [filteredRuns]);
  const environmentValues = useMemo(
    () =>
      Array.from(new Set(filteredRuns.map((run) => run.env))).sort((a, b) => a.localeCompare(b)),
    [filteredRuns],
  );
  const loadKindValues = useMemo(
    () => Array.from(new Set(filteredRuns.map((run) => getRunLoadKind(run)))),
    [filteredRuns],
  );

  const activeFiltersCount =
    selectedStatuses.size + selectedLoadKinds.size + selectedEnvironments.size + (showArchivedRuns ? 1 : 0);
  const listError = runsQuery.error ? getErrorMessage(runsQuery.error, "Failed to load performance runs.") : null;
  const hasNext = runsQuery.data?.has_next ?? false;
  let dataTotalPages = page;
  if (runsQuery.data) {
    dataTotalPages = runsQuery.data.has_next ? runsQuery.data.page + 1 : runsQuery.data.page;
  }
  const totalPages = Math.max(page, dataTotalPages);
  const visibleItemsCount = filteredRuns.length;
  const pageStart = visibleItemsCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = visibleItemsCount > 0 ? pageStart + visibleItemsCount - 1 : 0;
  const totalItemsLabel = hasNext ? `${pageEnd}+` : String(pageEnd);

  const tableColumns = useMemo<UnifiedTableColumn<PerfRun, PerformanceRunColumn>[]>(
    () => [
      {
        id: "title",
        label: "Title",
        menuLabel: "Title",
        defaultWidth: 318,
        minWidth: 240,
        locked: true,
        onCellClick: (event) => event.stopPropagation(),
        renderCell: (run) => {
          const isTaggedBaseline = run.baseline.policy === "tagged" && run.baseline.ref === run.id;
          return (
            <div className="flex min-w-0 items-center gap-2">
              <PrimarySecondaryCell
                className="flex-1"
                primaryClassName="font-semibold"
                primary={
                  <Link
                    to={`/projects/${projectId}/performance/${run.id}`}
                    className="text-[var(--highlight-foreground)] hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {run.name}
                  </Link>
                }
                secondary={`${run.service} · ${run.env}`}
              />
              {isTaggedBaseline || run.archived ? (
                <div className="flex shrink-0 flex-row items-center gap-2">
                  {isTaggedBaseline ? (
                    <StatusBadge tone="info" withBorder>
                      Baseline
                    </StatusBadge>
                  ) : null}
                  {run.archived ? (
                    <StatusBadge tone="neutral" withBorder>
                      Archived
                    </StatusBadge>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "status",
        label: "Status",
        menuLabel: "Status",
        defaultWidth: 130,
        minWidth: 120,
        nowrap: false,
        renderCell: (run) => (
          <StatusBadge tone={getStatusTone(run.status)} withBorder>
            {getStatusLabel(run.status)}
          </StatusBadge>
        ),
      },
      {
        id: "type",
        label: "Type",
        menuLabel: "Type",
        defaultWidth: 130,
        minWidth: 94,
        renderCell: (run) => (
          <StatusBadge tone={getLoadKindTone(getRunLoadKind(run))} withBorder>
            {getLoadKindLabel(getRunLoadKind(run))}
          </StatusBadge>
        ),
      },
      {
        id: "version",
        label: "Version",
        menuLabel: "Version",
        defaultWidth: 148,
        minWidth: 120,
        renderCell: (run) => <span className="font-mono text-xs text-[var(--foreground)]">{run.version}</span>,
      },
      {
        id: "started",
        label: "Started",
        menuLabel: "Started",
        defaultWidth: 170,
        minWidth: 140,
        nowrap: false,
        renderCell: (run) => (
          <>
            <p className="text-sm text-[var(--foreground)]">{formatDateTime(run.startedAt)}</p>
            <p className="text-xs text-[var(--muted-foreground)]">{formatDuration(run.durationMinutes)}</p>
          </>
        ),
      },
      {
        id: "progress",
        label: "Progress",
        menuLabel: "Progress",
        defaultWidth: 200,
        minWidth: 160,
        nowrap: false,
        renderCell: (run) => <RunProgressBarMini {...getPerfRunProgressBarModel(run)} />,
      },
      {
        id: "tool",
        label: "Tool",
        menuLabel: "Tool",
        defaultWidth: 160,
        minWidth: 110,
        renderCell: (run) => (
          <span className="inline-flex rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-xs font-medium text-[var(--foreground)]">
            {run.tool}
          </span>
        ),
      },
    ],
    [projectId],
  );

  const toggleColumn = (column: PerformanceRunColumn) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      return next;
    });
  };

  if (!projectId) return null;

  return (
    <>
      <ImportPerformanceArtifactModal
        projectId={projectId}
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />
      <EntityListPage
        title={<span className="text-xl">Performance Runs</span>}
        subtitle="Import perf artifacts, inspect run metrics, and compare against baseline policies"
        actions={
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => setImportModalOpen(true)}
            leftIcon={<FileUp className="h-4 w-4" />}
          >
            Import Results
          </Button>
        }
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchPlaceholder="Search by service, scenario, branch, build..."
        filtersOpen={filtersOpen}
        onFiltersOpenChange={setFiltersOpen}
        activeFiltersCount={activeFiltersCount}
        onClearFilters={() => {
          setSelectedStatuses(new Set());
          setSelectedLoadKinds(new Set());
          setSelectedEnvironments(new Set());
          setShowArchivedRuns(false);
        }}
        panelClassName="w-72"
        filtersContent={
          <>
            <FilterChecklistSection
              title="Status"
              values={RUN_STATUSES}
              selectedValues={selectedStatuses}
              onToggle={(value) => setSelectedStatuses((prev) => toggleSetValue(prev, value))}
              getLabel={(value) => getStatusLabel(value as PerfRunStatus)}
            />
            <FilterChecklistSection
              title="Load Type"
              values={loadKindValues}
              selectedValues={selectedLoadKinds}
              onToggle={(value) => setSelectedLoadKinds((prev) => toggleSetValue(prev, value))}
              getLabel={(value) => getLoadKindLabel(value as PerfLoadKind)}
            />
            <FilterChecklistSection
              title="Environment"
              values={environmentValues}
              selectedValues={selectedEnvironments}
              onToggle={(value) => setSelectedEnvironments((prev) => toggleSetValue(prev, value))}
              emptyLabel="No environments found"
            />
            <div className="border-t border-[var(--border)] px-1 py-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={showArchivedRuns}
                  onChange={(event) => setShowArchivedRuns(event.target.checked)}
                  className="rounded border-[var(--border)] text-[var(--highlight-foreground)] focus:ring-[var(--control-focus-ring)]"
                />{" "}
                Show archived
              </label>
            </div>
          </>
        }
        isLoading={runsQuery.isLoading}
        error={listError}
        empty={!listError && !runsQuery.isLoading && filteredRuns.length === 0}
        colSpan={visibleColumns.size + 2}
        emptyMessage={
          <ListPageEmptyState
            title="No performance runs found"
            description="Import a performance artifact to record runs, metrics, and comparisons."
            actions={
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => setImportModalOpen(true)}
                leftIcon={<FileUp className="h-4 w-4" />}
              >
                Import Results
              </Button>
            }
          />
        }
      >
        <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
          <UnifiedTable
            className="p-0"
            items={filteredRuns}
            columns={tableColumns}
            visibleColumns={visibleColumns}
            getRowId={(run) => run.id}
            onRowClick={(run) => {
              setOpenActionsRunId(null);
              navigate(`/projects/${projectId}/performance/${run.id}`);
            }}
            rowClassName={(run) =>
              selectedRunIds.has(run.id) ? "bg-[var(--highlight-bg-soft)] hover:bg-[var(--highlight-bg)]" : undefined
            }
            selection={{
              selectedRowIds: selectedRunIds,
              onToggleSelectAll: (checked, visibleRowIds) => {
                if (!visibleRowIds || visibleRowIds.length === 0) return;
                setSelectedRunIds((prev) => {
                  const next = new Set(prev);
                  if (checked) visibleRowIds.forEach((id) => next.add(id));
                  else visibleRowIds.forEach((id) => next.delete(id));
                  return next;
                });
              },
              onToggleRow: (runId) =>
                setSelectedRunIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(runId)) next.delete(runId);
                  else next.add(runId);
                  return next;
                }),
              ariaLabel: (run) => `Select ${run.name}`,
            }}
            columnsMenu={{ open: columnsOpen, onOpenChange: setColumnsOpen, onToggleColumn: toggleColumn }}
            actions={{
              render: (run) => (
                <RowActionsMenu
                  triggerLabel={`Open actions for ${run.name}`}
                  open={openActionsRunId === run.id}
                  onOpenChange={(open) => setOpenActionsRunId(open ? run.id : null)}
                  contentClassName="w-44"
                  items={[
                    {
                      key: "open",
                      label: "Open",
                      icon: <ExternalLink className="h-4 w-4" />,
                      onSelect: () => {
                        setOpenActionsRunId(null);
                        navigate(`/projects/${projectId}/performance/${run.id}`);
                      },
                    },
                    run.archived
                      ? {
                          key: "restore",
                          label: "Restore",
                          icon: <ArchiveRestore className="h-4 w-4" />,
                          onSelect: () => {
                            setOpenActionsRunId(null);
                            archiveRunMutation.mutate({ runId: run.id, archived: false });
                          },
                        }
                      : {
                          key: "archive",
                          label: "Archive",
                          icon: <Archive className="h-4 w-4" />,
                          onSelect: () => {
                            setOpenActionsRunId(null);
                            archiveRunMutation.mutate({ runId: run.id, archived: true });
                          },
                        },
                  ]}
                />
              ),
            }}
            tableClassName="min-w-[1200px] table-fixed"
            pagination={{ enabled: false }}
            footer={
              <div className="border-t border-[var(--border)] bg-[var(--card)] px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm text-[var(--muted-foreground)]">
                    Showing {pageStart}-{pageEnd} of {totalItemsLabel}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                      Rows:{" "}
                      <select
                        value={pageSize}
                        onChange={(event) => {
                          setPageSize(Number(event.target.value));
                          setPage(1);
                        }}
                        className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm text-[var(--foreground)]"
                      >
                        {[25, 50, 100, 200].map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <PageNumberPagination page={page} totalPages={Math.max(totalPages, 1)} onPageChange={setPage} />
                  </div>
                </div>
              </div>
            }
          />
        </div>
      </EntityListPage>
    </>
  );
}
