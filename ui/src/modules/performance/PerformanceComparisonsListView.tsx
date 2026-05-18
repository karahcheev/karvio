import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Check, Copy, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deletePerformanceComparison,
  getPerformanceComparisonsPage,
  type PerformanceComparisonListItemDto,
  type PerformanceComparisonVisibility,
} from "@/shared/api";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { getErrorMessage, notifyError, notifySuccess } from "@/shared/lib/notifications";
import {
  EntityListPage,
  FilterChecklistSection,
  ListPageEmptyState,
  StatusBadge,
} from "@/shared/ui";
import { ActionConfirmModal } from "@/shared/ui/ActionConfirmModal";
import { PageNumberPagination } from "@/shared/ui/PageNumberPagination";
import { RowActionsMenu } from "@/shared/ui/RowActionsMenu";
import { UnifiedTable, type UnifiedTableColumn } from "@/shared/ui/Table";
import { EditComparisonDialog } from "./edit-comparison-dialog";
import { formatDateTime, toggleSetValue } from "./perf-utils";

const VISIBILITY_VALUES: PerformanceComparisonVisibility[] = ["public", "project"];
const VISIBILITY_LABELS: Record<PerformanceComparisonVisibility, string> = {
  public: "Public link",
  project: "Project only",
};

type ComparisonsColumn = "name" | "runs" | "metric" | "visibility" | "created";

function buildPublicShareUrl(token: string): string {
  return `${window.location.origin}/c/${encodeURIComponent(token)}`;
}

export function PerformanceComparisonsListView() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<PerformanceComparisonListItemDto | null>(null);
  const [editCandidate, setEditCandidate] = useState<PerformanceComparisonListItemDto | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedVisibility, setSelectedVisibility] = useState<Set<string>>(new Set());
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 250);

  // The list endpoint accepts a single visibility value; "both selected" means no filter.
  const visibilityParam: PerformanceComparisonVisibility | undefined = useMemo(() => {
    if (selectedVisibility.size !== 1) return undefined;
    const [first] = Array.from(selectedVisibility);
    return first === "public" || first === "project" ? (first as PerformanceComparisonVisibility) : undefined;
  }, [selectedVisibility]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchQuery, visibilityParam]);

  const comparisonsQuery = useQuery({
    queryKey: [
      "performance-comparisons",
      projectId,
      page,
      pageSize,
      debouncedSearchQuery.trim(),
      visibilityParam ?? "all",
    ],
    queryFn: async () => {
      if (!projectId) return null;
      return getPerformanceComparisonsPage({
        projectId,
        page,
        pageSize,
        search: debouncedSearchQuery.trim() || undefined,
        visibility: visibilityParam,
      });
    },
    enabled: Boolean(projectId),
    placeholderData: keepPreviousData,
  });

  const items = useMemo(() => comparisonsQuery.data?.items ?? [], [comparisonsQuery.data]);

  const deleteMutation = useMutation({
    mutationFn: async (comparisonId: string) => deletePerformanceComparison(comparisonId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["performance-comparisons"] });
      notifySuccess("Comparison deleted.");
    },
    onError: (error) => notifyError(error, "Failed to delete comparison."),
  });

  const handleCopyShareLink = async (item: PerformanceComparisonListItemDto) => {
    if (!item.public_token) return;
    try {
      await navigator.clipboard.writeText(buildPublicShareUrl(item.public_token));
      setCopiedTokenId(item.id);
      window.setTimeout(() => setCopiedTokenId((current) => (current === item.id ? null : current)), 1500);
    } catch (error) {
      notifyError(error, "Failed to copy link.");
    }
  };

  const tableColumns = useMemo<UnifiedTableColumn<PerformanceComparisonListItemDto, ComparisonsColumn>[]>(
    () => [
      {
        id: "name",
        label: "Name",
        menuLabel: "Name",
        defaultWidth: 320,
        minWidth: 220,
        locked: true,
        nowrap: false,
        onCellClick: (event) => event.stopPropagation(),
        renderCell: (item) => (
          <div className="min-w-0">
            <Link
              to={`/projects/${projectId}/performance/comparisons/${item.id}`}
              className="text-sm font-semibold text-[var(--highlight-foreground)] hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {item.name?.trim() || `Comparison ${item.id}`}
            </Link>
            <p className="mt-0.5 font-mono text-xs text-[var(--muted-foreground)]">{item.id}</p>
          </div>
        ),
      },
      {
        id: "runs",
        label: "Runs",
        menuLabel: "Runs",
        defaultWidth: 240,
        minWidth: 180,
        nowrap: false,
        renderCell: (item) => (
          <div className="text-xs">
            <p className="text-sm text-[var(--foreground)]">{item.run_count} runs</p>
            <p className="font-mono text-[var(--muted-foreground)]">base: {item.base_run_id}</p>
          </div>
        ),
      },
      {
        id: "metric",
        label: "Metric",
        menuLabel: "Metric",
        defaultWidth: 140,
        minWidth: 110,
        renderCell: (item) => (
          <span className="inline-flex rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-medium text-[var(--foreground)]">
            {item.metric_key}
          </span>
        ),
      },
      {
        id: "visibility",
        label: "Visibility",
        menuLabel: "Visibility",
        defaultWidth: 130,
        minWidth: 110,
        renderCell: (item) =>
          item.public_token ? (
            <StatusBadge tone="info" withBorder>
              Public link
            </StatusBadge>
          ) : (
            <StatusBadge tone="neutral" withBorder>
              Project only
            </StatusBadge>
          ),
      },
      {
        id: "created",
        label: "Created",
        menuLabel: "Created",
        defaultWidth: 180,
        minWidth: 150,
        renderCell: (item) => (
          <p className="text-sm text-[var(--foreground)]">{formatDateTime(item.created_at)}</p>
        ),
      },
    ],
    [projectId],
  );

  if (!projectId) return null;

  const listError = comparisonsQuery.error
    ? getErrorMessage(comparisonsQuery.error, "Failed to load saved comparisons.")
    : null;
  const hasNext = comparisonsQuery.data?.has_next ?? false;
  let dataTotalPages = page;
  if (comparisonsQuery.data) {
    dataTotalPages = comparisonsQuery.data.has_next ? comparisonsQuery.data.page + 1 : comparisonsQuery.data.page;
  }
  const totalPages = Math.max(page, dataTotalPages);
  const visibleItemsCount = items.length;
  const pageStart = visibleItemsCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = visibleItemsCount > 0 ? pageStart + visibleItemsCount - 1 : 0;
  const totalItemsLabel = hasNext ? `${pageEnd}+` : String(pageEnd);

  return (
    <>
      <EntityListPage
        title={<span className="text-xl">Saved Comparisons</span>}
        subtitle="Snapshots of multi-run performance comparisons. Open one to view, share, or revoke its public link."
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchPlaceholder="Search by name or base run id..."
        filtersOpen={filtersOpen}
        onFiltersOpenChange={setFiltersOpen}
        activeFiltersCount={selectedVisibility.size}
        onClearFilters={() => setSelectedVisibility(new Set())}
        panelClassName="w-64"
        filtersContent={
          <FilterChecklistSection
            title="Visibility"
            values={VISIBILITY_VALUES}
            selectedValues={selectedVisibility}
            onToggle={(value) => setSelectedVisibility((prev) => toggleSetValue(prev, value))}
            getLabel={(value) => VISIBILITY_LABELS[value as PerformanceComparisonVisibility] ?? value}
          />
        }
        isLoading={comparisonsQuery.isLoading}
        error={listError}
        empty={!listError && !comparisonsQuery.isLoading && items.length === 0}
        colSpan={tableColumns.length + 2}
        emptyMessage={
          <ListPageEmptyState
            title="No saved comparisons yet"
            description="Open any performance run, add runs to compare, then click Save & share to keep a snapshot here."
          />
        }
      >
        <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
          <UnifiedTable
            className="p-0"
            items={items}
            columns={tableColumns}
            getRowId={(item) => item.id}
            onRowClick={(item) => {
              setOpenActionsId(null);
              navigate(`/projects/${projectId}/performance/comparisons/${item.id}`);
            }}
            actions={{
              render: (item) => (
                <RowActionsMenu
                  triggerLabel={`Open actions for ${item.name ?? item.id}`}
                  open={openActionsId === item.id}
                  onOpenChange={(open) => setOpenActionsId(open ? item.id : null)}
                  contentClassName="w-52"
                  items={[
                    {
                      key: "open",
                      label: "Open",
                      icon: <ExternalLink className="h-4 w-4" />,
                      onSelect: () => {
                        setOpenActionsId(null);
                        navigate(`/projects/${projectId}/performance/comparisons/${item.id}`);
                      },
                    },
                    {
                      key: "edit",
                      label: "Rename / share…",
                      icon: <Pencil className="h-4 w-4" />,
                      onSelect: () => {
                        setOpenActionsId(null);
                        setEditCandidate(item);
                      },
                    },
                    ...(item.public_token
                      ? [
                          {
                            key: "copy-link",
                            label: copiedTokenId === item.id ? "Copied!" : "Copy public link",
                            icon: copiedTokenId === item.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />,
                            onSelect: () => {
                              setOpenActionsId(null);
                              void handleCopyShareLink(item);
                            },
                          },
                        ]
                      : []),
                    {
                      key: "delete",
                      label: "Delete",
                      icon: <Trash2 className="h-4 w-4" />,
                      variant: "destructive",
                      separatorBefore: true,
                      onSelect: () => {
                        setOpenActionsId(null);
                        setDeleteCandidate(item);
                      },
                    },
                  ]}
                />
              ),
            }}
            tableClassName="min-w-[1040px] table-fixed"
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

      <EditComparisonDialog
        isOpen={Boolean(editCandidate)}
        onClose={() => setEditCandidate(null)}
        comparison={editCandidate}
        onSaved={(updated) => {
          void queryClient.invalidateQueries({ queryKey: ["performance-comparisons"] });
          // Also refresh any open snapshot view for this comparison.
          void queryClient.invalidateQueries({ queryKey: ["performance-comparison", updated.id] });
          setEditCandidate(null);
        }}
      />

      <ActionConfirmModal
        isOpen={Boolean(deleteCandidate)}
        title="Delete this comparison?"
        description={
          deleteCandidate
            ? `“${deleteCandidate.name?.trim() || deleteCandidate.id}” will be removed permanently. Any public share link will stop working.`
            : ""
        }
        confirmLabel="Delete"
        tone="danger"
        isPending={deleteMutation.isPending}
        onClose={() => {
          if (!deleteMutation.isPending) setDeleteCandidate(null);
        }}
        onConfirm={() => {
          if (!deleteCandidate) return;
          deleteMutation.mutate(deleteCandidate.id, {
            onSuccess: () => setDeleteCandidate(null),
          });
        }}
      />

    </>
  );
}
