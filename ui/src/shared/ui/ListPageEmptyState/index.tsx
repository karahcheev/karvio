// Empty state for entity list table areas (shared copy layout via EmptyState).

import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { EmptyState } from "@/shared/ui/EmptyState";

export type ListPageEmptyStateProps = Readonly<{
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}>;

export function ListPageEmptyState({ title, description, actions, className }: ListPageEmptyStateProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      actions={actions}
      className={cn("w-full min-h-52 min-w-0", className)}
    />
  );
}
