import { useEffect, useMemo, useState } from "react";
import type { RunOverviewRow } from "@/modules/test-runs/components";

type UseTestRunSelectionParams = {
  rows: RunOverviewRow[];
  filteredRows: RunOverviewRow[];
};

export function useTestRunSelection({ rows, filteredRows }: UseTestRunSelectionParams) {
  const [selectedRunItemId, setSelectedRunItemId] = useState<string | null>(null);
  const [selectedRunItemIds, setSelectedRunItemIds] = useState<Set<string>>(new Set());
  const [openActionsRunItemId, setOpenActionsRunItemId] = useState<string | null>(null);
  const [statusModalRunItemId, setStatusModalRunItemId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedRunItemIds((previous) => {
      const visibleIds = new Set(filteredRows.map((item) => item.id));
      const next = new Set([...previous].filter((id) => visibleIds.has(id)));
      return next.size === previous.size ? previous : next;
    });
    setOpenActionsRunItemId((previous) =>
      previous && filteredRows.some((item) => item.id === previous) ? previous : null,
    );
  }, [filteredRows]);

  useEffect(() => {
    const availableRowIds = new Set(rows.map((item) => item.id));
    setSelectedRunItemId((previous) => (previous && availableRowIds.has(previous) ? previous : null));
    setStatusModalRunItemId((previous) => (previous && availableRowIds.has(previous) ? previous : null));
  }, [rows]);

  const selectedRow = useMemo(
    () => (selectedRunItemId ? rows.find((item) => item.id === selectedRunItemId) ?? null : null),
    [rows, selectedRunItemId],
  );

  const statusModalRow = useMemo(
    () => (statusModalRunItemId ? rows.find((item) => item.id === statusModalRunItemId) ?? null : null),
    [rows, statusModalRunItemId],
  );

  const handleToggleRunItemSelection = (runItemId: string) => {
    setSelectedRunItemIds((previous) => {
      const next = new Set(previous);
      if (next.has(runItemId)) next.delete(runItemId);
      else next.add(runItemId);
      return next;
    });
  };

  const handleToggleSelectAllRunItems = (checked: boolean, visibleRowIds?: string[]) => {
    const rowIds = visibleRowIds ?? [];
    if (checked) {
      setSelectedRunItemIds((previous) => new Set([...previous, ...rowIds]));
      return;
    }
    setSelectedRunItemIds((previous) => new Set([...previous].filter((id) => !rowIds.includes(id))));
  };

  return {
    selectedRunItemId,
    setSelectedRunItemId,
    selectedRunItemIds,
    setSelectedRunItemIds,
    openActionsRunItemId,
    setOpenActionsRunItemId,
    statusModalRunItemId,
    setStatusModalRunItemId,
    selectedRow,
    statusModalRow,
    handleToggleRunItemSelection,
    handleToggleSelectAllRunItems,
  };
}
