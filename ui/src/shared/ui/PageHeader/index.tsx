// Standard list/detail page title row with optional subtitle and actions.

import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type PageHeaderSectionProps = Readonly<{
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
}>;

export function PageHeaderSection({
  title,
  subtitle,
  actions,
  className,
  titleClassName,
  subtitleClassName,
}: PageHeaderSectionProps) {
  return (
    <div className={cn("border-b border-[var(--border)] bg-[var(--card)] px-3 py-3", className)}>
      <div className="flex items-center justify-between gap-3">
        {/* Title block */}
        <div className="min-w-0">
          <h1 className={cn("text-2xl font-semibold text-[var(--foreground)]", titleClassName)}>{title}</h1>
          {subtitle ? <div className={cn("mt-1 text-sm text-[var(--muted-foreground)]", subtitleClassName)}>{subtitle}</div> : null}
        </div>
        {/* Actions */}
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export { PageHeaderSection as PageHeader };
