import { useCallback, useState } from "react";

export function useTestCasesSelection() {
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());
  const [openActionsTestId, setOpenActionsTestId] = useState<string | null>(null);

  const toggleTestSelection = useCallback((testId: string) => {
    setSelectedTests((prev) => {
      const next = new Set(prev);
      if (next.has(testId)) next.delete(testId);
      else next.add(testId);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback((visibleRowIds: string[]) => {
    setSelectedTests((prev) => {
      const next = new Set(prev);
      for (const id of visibleRowIds) next.add(id);
      return next;
    });
  }, []);

  const clearVisibleSelection = useCallback((visibleRowIds: string[]) => {
    setSelectedTests((prev) => {
      const next = new Set(prev);
      for (const id of visibleRowIds) next.delete(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((checked: boolean, visibleRowIds?: string[]) => {
    const rowIds = visibleRowIds ?? [];
    if (checked) {
      setSelectedTests((prev) => {
        const next = new Set(prev);
        for (const id of rowIds) next.add(id);
        return next;
      });
    } else {
      setSelectedTests((prev) => {
        const next = new Set(prev);
        for (const id of rowIds) next.delete(id);
        return next;
      });
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTests(new Set());
  }, []);

  return {
    selectedTests,
    setSelectedTests,
    openActionsTestId,
    setOpenActionsTestId,
    toggleTestSelection,
    toggleSelectAll,
    selectAllVisible,
    clearVisibleSelection,
    clearSelection,
  };
}
