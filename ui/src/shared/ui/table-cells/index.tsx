import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { OverflowTagList } from "@/shared/ui/OverflowTagList";
import { StatusBadge, type StatusBadgeTone } from "@/shared/ui/StatusBadge";
import { TagChip, type TagChipVariant } from "@/shared/ui/TagChip";
import { TagList } from "@/shared/ui/TagList";

type DateTimeCellProps = Readonly<{
  value: string | number | Date | null | undefined;
  fallback?: ReactNode;
  className?: string;
  truncate?: boolean;
}>;

function formatDateTime(value: DateTimeCellProps["value"]): string | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

export function DateTimeCell({ value, fallback = "—", className, truncate = true }: DateTimeCellProps) {
  return (
    <span className={cn(truncate && "block truncate", "text-sm text-[var(--foreground)]", className)}>
      {formatDateTime(value) ?? fallback}
    </span>
  );
}

type StatusCellProps = Readonly<{
  tone: StatusBadgeTone;
  withBorder?: boolean;
  className?: string;
  children: ReactNode;
}>;

export function StatusCell({ tone, withBorder = false, className, children }: StatusCellProps) {
  return (
    <StatusBadge tone={tone} withBorder={withBorder} className={className}>
      {children}
    </StatusBadge>
  );
}

type TagsCellProps = Readonly<{
  tags: string[];
  emptyLabel?: ReactNode;
  mode?: "overflow" | "wrap";
  chipVariant?: TagChipVariant;
  className?: string;
}>;

export function TagsCell({
  tags,
  emptyLabel = "No tags",
  mode = "overflow",
  chipVariant = "fill",
  className,
}: TagsCellProps) {
  const emptyContent = <span className="text-sm text-[var(--muted-foreground)]">{emptyLabel}</span>;

  if (mode === "wrap") {
    if (tags.length === 0) return emptyContent;
    return (
      <TagList gap="xs" className={className}>
        {tags.map((tag, index) => (
          <TagChip key={`${tag}-${index}`} variant={chipVariant}>
            {tag}
          </TagChip>
        ))}
      </TagList>
    );
  }

  return <OverflowTagList tags={tags} emptyContent={emptyContent} chipVariant={chipVariant} />;
}

type PrimarySecondaryCellProps = Readonly<{
  primary: ReactNode;
  secondary?: ReactNode;
  className?: string;
  primaryClassName?: string;
  secondaryClassName?: string;
}>;

export function PrimarySecondaryCell({
  primary,
  secondary,
  className,
  primaryClassName,
  secondaryClassName,
}: PrimarySecondaryCellProps) {
  return (
    <div className={cn("min-w-0 space-y-0.5", className)}>
      <div className={cn("truncate font-medium text-[var(--foreground)]", primaryClassName)}>{primary}</div>
      {secondary != null ? <div className={cn("truncate text-xs text-[var(--muted-foreground)]", secondaryClassName)}>{secondary}</div> : null}
    </div>
  );
}

type IdCellProps = Readonly<{
  value: string | null | undefined;
  fallback?: ReactNode;
  className?: string;
  mono?: boolean;
}>;

export function IdCell({ value, fallback = "—", className, mono = true }: IdCellProps) {
  return (
    <span className={cn("block truncate", mono && "font-mono text-xs", "text-[var(--muted-foreground)]", className)}>
      {value || fallback}
    </span>
  );
}
