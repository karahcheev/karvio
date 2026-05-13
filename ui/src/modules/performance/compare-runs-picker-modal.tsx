import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { Button, FilterChecklistSection, Modal, SearchFiltersToolbar, StatusBadge } from "@/shared/ui";
import { UnifiedTable, type UnifiedTableColumn } from "@/shared/ui/Table";
import { MAX_COMPARE_RUNS, RUN_STATUSES } from "./constants";
import {
  formatDateTime,
  getLoadKindLabel,
  getLoadKindTone,
  getRunLoadKind,
  getStatusLabel,
  getStatusTone,
  toggleSetValue,
} from "./perf-utils";
import type { PerfRun, PerfRunStatus } from "./types";

type CompareModalColumn = "run" | "service" | "environment" | "version" | "started" | "status" | "loadType" | "tool";

export function CompareRunsPickerModal({
  isOpen,
  onClose,
  baseRun,
  candidateRuns,
  initiallySelectedIds,
  includeArchivedRuns,
  onIncludeArchivedRunsChange,
  onConfirm,
}: Readonly<{
  isOpen: boolean;
  onClose: () => void;
  baseRun: PerfRun;
  candidateRuns: PerfRun[];
  initiallySelectedIds: string[];
  includeArchivedRuns: boolean;
  onIncludeArchivedRunsChange: (value: boolean) => void;
  onConfirm: (selectedIds: string[]) => void;
}>) {
  const baseLoadKind = getRunLoadKind(baseRun);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRunIds, setSelectedRunIds] = useState<Set<string>>(() => new Set(initiallySelectedIds));
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [selectedEnvironments, setSelectedEnvironments] = useState<Set<string>>(new Set());
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedRunIds(new Set(initiallySelectedIds));
      setFiltersOpen(false);
    }
  }, [isOpen, initiallySelectedIds]);

  const environmentValues = useMemo(
    () => Array.from(new Set(candidateRuns.map((item) => item.env))).sort((a, b) => a.localeCompare(b)),
    [candidateRuns],
  );
  const toolValues = useMemo(
    () => Array.from(new Set(candidateRuns.map((item) => item.tool))).sort((a, b) => a.localeCompare(b)),
    [candidateRuns],
  );

  const filteredRuns = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return candidateRuns.filter((candidate) => {
      const matchesSearch =
        query.length === 0 ||
        [
          candidate.id,
          candidate.name,
          candidate.service,
          candidate.scenario,
          candidate.env,
          candidate.branch,
          candidate.build,
          candidate.version,
          candidate.commit,
          candidate.tool,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesStatus = selectedStatuses.size === 0 || selectedStatuses.has(candidate.status);
      const matchesEnv = selectedEnvironments.size === 0 || selectedEnvironments.has(candidate.env);
      const matchesTool = selectedTools.size === 0 || selectedTools.has(candidate.tool);
      return matchesSearch && matchesStatus && matchesEnv && matchesTool;
    });
  }, [candidateRuns, searchQuery, selectedEnvironments, selectedStatuses, selectedTools]);

  const toggleRunSelection = useCallback((candidateId: string) => {
    setSelectedRunIds((prev) => {
      if (prev.has(candidateId)) {
        return toggleSetValue(prev, candidateId);
      }
      if (prev.size >= MAX_COMPARE_RUNS - 1) {
        return prev;
      }
      return toggleSetValue(prev, candidateId);
    });
  }, []);

  const handleToggleSelectAll = useCallback((checked: boolean, visibleRowIds: string[] = []) => {
    if (checked) {
      setSelectedRunIds((prev) => {
        const maxExtra = MAX_COMPARE_RUNS - 1;
        if (prev.size >= maxExtra) {
          return prev;
        }
        const next = new Set(prev);
        let remaining = maxExtra - next.size;
        for (const id of visibleRowIds) {
          if (remaining <= 0) break;
          if (!next.has(id)) {
            next.add(id);
            remaining -= 1;
          }
        }
        return next;
      });
    } else {
      setSelectedRunIds((prev) => {
        const next = new Set(prev);
        visibleRowIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  }, []);

  const tableColumns = useMemo<UnifiedTableColumn<PerfRun, CompareModalColumn>[]>(
    () => [
      {
        id: "run",
        label: "Run",
        menuLabel: "Run",
        defaultWidth: 240,
        minWidth: 180,
        nowrap: false,
        renderCell: (candidate) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-[var(--foreground)]">{candidate.name}</p>
            <p className="font-mono text-xs text-[var(--muted-foreground)]">{candidate.id}</p>
          </div>
        ),
      },
      {
        id: "service",
        label: "Service",
        menuLabel: "Service",
        defaultWidth: 140,
        minWidth: 100,
        renderCell: (candidate) => candidate.service,
      },
      {
        id: "environment",
        label: "Environment",
        menuLabel: "Environment",
        defaultWidth: 140,
        minWidth: 100,
        renderCell: (candidate) => candidate.env,
      },
      {
        id: "version",
        label: "Version",
        menuLabel: "Version",
        defaultWidth: 120,
        minWidth: 90,
        renderCell: (candidate) => candidate.version,
      },
      {
        id: "started",
        label: "Started",
        menuLabel: "Started",
        defaultWidth: 160,
        minWidth: 130,
        renderCell: (candidate) => formatDateTime(candidate.startedAt),
      },
      {
        id: "status",
        label: "Status",
        menuLabel: "Status",
        defaultWidth: 120,
        minWidth: 100,
        renderCell: (candidate) => (
          <StatusBadge tone={getStatusTone(candidate.status)} withBorder>
            {getStatusLabel(candidate.status)}
          </StatusBadge>
        ),
      },
      {
        id: "loadType",
        label: "Load type",
        menuLabel: "Load type",
        defaultWidth: 120,
        minWidth: 100,
        renderCell: (candidate) => (
          <StatusBadge tone={getLoadKindTone(getRunLoadKind(candidate))} withBorder>
            {getLoadKindLabel(getRunLoadKind(candidate))}
          </StatusBadge>
        ),
      },
      {
        id: "tool",
        label: "Tool",
        menuLabel: "Tool",
        defaultWidth: 100,
        minWidth: 80,
        renderCell: (candidate) => (
          <span className="inline-flex rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-medium text-[var(--foreground)]">
            {candidate.tool}
          </span>
        ),
      },
    ],
    [],
  );

  const activeFiltersCount =
    selectedStatuses.size +
    selectedEnvironments.size +
    selectedTools.size +
    (includeArchivedRuns ? 1 : 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="flex max-h-[min(92vh,960px)] w-[min(96vw,1400px)] max-w-none flex-col overflow-hidden rounded-xl border border-[var(--border)] p-0 sm:max-w-none"
    >
      <div className="flex min-h-0 flex-1 flex-col bg-[var(--card)]">
        <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Add runs to compare</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Pick up to {MAX_COMPARE_RUNS - 1} runs with the same load type ({getLoadKindLabel(baseLoadKind)}).
          </p>
        </div>

        <SearchFiltersToolbar
          className="shrink-0 px-4 py-3"
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          searchPlaceholder="Search by id, name, service, scenario, env, build..."
          filtersOpen={filtersOpen}
          onFiltersOpenChange={setFiltersOpen}
          activeFiltersCount={activeFiltersCount}
          onClearFilters={() => {
            setSelectedStatuses(new Set());
            setSelectedEnvironments(new Set());
            setSelectedTools(new Set());
            onIncludeArchivedRunsChange(false);
          }}
          panelClassName="w-72 max-h-[min(380px,50vh)] overflow-y-auto"
          filtersContent={
            <>
              <div className="border-b border-[var(--border)] px-1 py-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--foreground)]">
                  <input
                    type="checkbox"
                    checked={includeArchivedRuns}
                    onChange={(event) => onIncludeArchivedRunsChange(event.target.checked)}
                    className="rounded border-[var(--border)] text-[var(--highlight-foreground)] focus:ring-[var(--control-focus-ring)]"
                  />{" "}
                  Show archived
                </label>
              </div>
              <FilterChecklistSection
                title="Status"
                values={RUN_STATUSES}
                selectedValues={selectedStatuses}
                onToggle={(value) => setSelectedStatuses((prev) => toggleSetValue(prev, value))}
                getLabel={(value) => getStatusLabel(value as PerfRunStatus)}
              />
              <FilterChecklistSection
                title="Environment"
                values={environmentValues}
                selectedValues={selectedEnvironments}
                onToggle={(value) => setSelectedEnvironments((prev) => toggleSetValue(prev, value))}
                emptyLabel="No environments"
              />
              <FilterChecklistSection
                title="Tool"
                values={toolValues}
                selectedValues={selectedTools}
                onToggle={(value) => setSelectedTools((prev) => toggleSetValue(prev, value))}
                emptyLabel="No tools"
              />
            </>
          }
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4 pb-2">
          {filteredRuns.length === 0 ? (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-5 text-sm text-[var(--muted-foreground)]">
              No runs found for current search and filters.
            </div>
          ) : (
            <UnifiedTable
              className="min-h-0 min-w-0 flex-1 p-0"
              items={filteredRuns}
              columns={tableColumns}
              getRowId={(candidate) => candidate.id}
              onRowClick={(candidate) => toggleRunSelection(candidate.id)}
              rowClassName={(candidate) => {
                const atLimit =
                  selectedRunIds.size >= MAX_COMPARE_RUNS - 1 && !selectedRunIds.has(candidate.id);
                return cn(
                  atLimit ? "cursor-not-allowed opacity-60" : undefined,
                  selectedRunIds.has(candidate.id)
                    ? "bg-[var(--highlight-bg-soft)] hover:bg-[var(--highlight-bg-soft)]"
                    : undefined,
                );
              }}
              selection={{
                selectedRowIds: selectedRunIds,
                isRowSelectionDisabled: (candidate) =>
                  !selectedRunIds.has(candidate.id) && selectedRunIds.size >= MAX_COMPARE_RUNS - 1,
                onToggleSelectAll: handleToggleSelectAll,
                onToggleRow: (rowId) => toggleRunSelection(rowId),
                ariaLabel: (candidate) => `Select run ${candidate.name}`,
              }}
              pagination={{ enabled: false }}
              tableClassName="min-w-[1040px]"
            />
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
          <p className="text-sm text-[var(--muted-foreground)]">
            Selected: {selectedRunIds.size + 1}/{MAX_COMPARE_RUNS} (including base run {baseRun.id}).
            {selectedRunIds.size >= MAX_COMPARE_RUNS - 1 ? (
              <span className="ml-1 text-[var(--tone-warning-text)]">Limit reached for additional runs.</span>
            ) : null}
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => onConfirm(Array.from(selectedRunIds).slice(0, MAX_COMPARE_RUNS - 1))}
              disabled={selectedRunIds.size === 0}
            >
              Compare
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
