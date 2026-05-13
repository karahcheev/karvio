// Centered empty placeholder with optional description and actions.

import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export type EmptyStateProps = Readonly<{
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}>;

export function EmptyState({ title, description, actions, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--highlight-bg-soft)] px-6 py-8 text-center",
        className,
      )}
    >
      {/* Title */}
      <div className="text-base font-semibold text-[var(--foreground)]">{title}</div>
      {/* Description */}
      {description ? <p className="mt-2 max-w-3xl text-sm text-[var(--muted-foreground)]">{description}</p> : null}
      {/* Actions */}
      {actions ? <div className="mt-4 flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
