// Full-width table row used for loading, error, or empty messages.

import type { ReactNode } from "react";
import { StandardTableStateRow } from "@/shared/ui/Table";
import { cn } from "@/shared/lib/cn";

type EntityTableStateProps = Readonly<{
  colSpan: number;
  message: ReactNode;
  className?: string;
}>;

export function EntityTableState({ colSpan, message, className }: EntityTableStateProps) {
  return (
    <div className={cn("w-full rounded-lg border border-[var(--border)] bg-[var(--table-surface)]", className)}>
      <table className="min-w-full">
        <tbody className="divide-y divide-border bg-[var(--table-surface)]">
          <StandardTableStateRow colSpan={colSpan}>{message}</StandardTableStateRow>
        </tbody>
      </table>
    </div>
  );
}
