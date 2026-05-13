// Thin wrappers around StandardTableStateRow for empty/loading copy.

import { StandardTableStateRow } from "./base";

export function TableEmptyStateRow({
  colSpan,
  message = "No data available.",
}: Readonly<{ colSpan: number; message?: string }>) {
  return <StandardTableStateRow colSpan={colSpan}>{message}</StandardTableStateRow>;
}

export function TableLoadingStateRow({
  colSpan,
  message = "Loading…",
}: Readonly<{ colSpan: number; message?: string }>) {
  return <StandardTableStateRow colSpan={colSpan}>{message}</StandardTableStateRow>;
}
