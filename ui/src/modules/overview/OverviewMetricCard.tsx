import type { LucideIcon } from "lucide-react";

type Props = Readonly<{
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  iconClassName: string;
}>;

export function OverviewMetricCard({ label, value, hint, icon: Icon, iconClassName }: Props) {
  return (
    <div className="min-w-[160px] w-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-2.5 sm:p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs text-[var(--muted-foreground)] sm:text-sm">{label}</div>
          <div className="mt-0.5 text-xl font-semibold tabular-nums text-[var(--foreground)] sm:text-2xl">{value}</div>
          <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--muted-foreground)] sm:text-xs">{hint}</div>
        </div>
        <Icon className={`h-8 w-8 shrink-0 sm:h-9 sm:w-9 ${iconClassName}`} aria-hidden />
      </div>
    </div>
  );
}
