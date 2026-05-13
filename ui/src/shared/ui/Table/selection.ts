import type { RefObject } from "react";

export function getVisibleSelectionState(visibleRowIds: string[], selectedRowIds: Set<string>) {
  const selectedVisibleRowsCount = visibleRowIds.reduce(
    (count, rowId) => count + (selectedRowIds.has(rowId) ? 1 : 0),
    0,
  );
  const isAllVisibleRowsSelected = visibleRowIds.length > 0 && selectedVisibleRowsCount === visibleRowIds.length;
  const isSomeVisibleRowsSelected = selectedVisibleRowsCount > 0 && !isAllVisibleRowsSelected;

  return {
    selectedVisibleRowsCount,
    isAllVisibleRowsSelected,
    isSomeVisibleRowsSelected,
  };
}

export function syncIndeterminateCheckbox(ref: RefObject<HTMLInputElement | null>, checked: boolean) {
  if (!ref.current) return;
  ref.current.indeterminate = checked;
}
