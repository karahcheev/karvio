// Swaps table body for loading, error, or empty states before rendering children.

import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { EntityTableState } from "@/shared/ui/EntityTableState";
import { ListPageEmptyState } from "@/shared/ui/ListPageEmptyState";

type EntityTableWithStatesProps = Readonly<{
  isLoading: boolean;
  error: string | null;
  empty: boolean;
  colSpan: number;
  loadingMessage?: ReactNode;
  errorMessage?: ReactNode;
  emptyMessage: ReactNode;
  className?: string;
  children: ReactNode;
}>;

export function EntityTableWithStates({
  isLoading,
  error,
  empty,
  colSpan,
  loadingMessage = "Loading...",
  errorMessage,
  emptyMessage,
  className,
  children,
}: EntityTableWithStatesProps) {
  // Loading / error / empty gates

  if (isLoading) {
    return <EntityTableState colSpan={colSpan} message={loadingMessage} className={className} />;
  }

  if (error) {
    return (
      <EntityTableState
        colSpan={colSpan}
        message={errorMessage ?? <span className="text-[var(--status-failure)]">{error}</span>}
        className={className}
      />
    );
  }

  if (empty) {
    const body =
      typeof emptyMessage === "string" || typeof emptyMessage === "number" ? (
        <ListPageEmptyState title={String(emptyMessage)} />
      ) : (
        emptyMessage
      );
    return (
      <div className={cn("flex min-h-0 w-full flex-1 flex-col items-stretch overflow-auto px-3 pb-4 pt-2", className)}>
        <div className="w-full min-w-0 px-1">{body}</div>
      </div>
    );
  }

  return <>{children}</>;
}
