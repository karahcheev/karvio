// Detail page chrome: back link, title with optional meta, and trailing actions.

import type { ReactNode } from "react";
import { Link, type To } from "react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/shared/lib/cn";

type DetailPageHeaderProps = Readonly<{
  backLabel: string;
  backTo: To;
  title: string;
  /** Renders inline after the title (e.g. status badges). */
  titleTrailing?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}>;

export function DetailPageHeader({
  backLabel,
  backTo,
  title,
  titleTrailing,
  meta,
  actions,
  className,
}: DetailPageHeaderProps) {
  return (
    <div className={cn("border-b border-[var(--border)] bg-[var(--card)] px-3 py-3", className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            {/* Back navigation */}
            <Link
              to={backTo}
              aria-label={backLabel}
              className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0 flex-1">
              {/* Title row: name + chips flush after the title (not pushed to the far right) */}
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="min-w-0 max-w-full shrink truncate text-2xl font-semibold text-[var(--foreground)]">{title}</h1>
                {titleTrailing ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">{titleTrailing}</div>
                ) : null}
              </div>
              {meta ? <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--muted-foreground)]">{meta}</div> : null}
            </div>
          </div>
        </div>
        {/* Actions */}
        {actions ? <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
