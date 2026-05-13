// Horizontal toolbar: main controls on the left, optional actions on the right.

import type { PropsWithChildren, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export type ToolbarProps = PropsWithChildren<
  Readonly<{
    actions?: ReactNode;
    className?: string;
  }>
>;

export function Toolbar({ children, actions, className }: ToolbarProps) {
  return (
    <div className={cn("border-b border-[var(--border)] bg-[var(--card)] px-3 py-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Primary controls */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
        {/* Secondary actions */}
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
