import type { ReactNode } from "react";
import { FileArchive, FileCode2, FileJson, FileSpreadsheet } from "lucide-react";

import { formatSignedPercent, getMetricDeltaColor, toMetricImpact } from "./perf-utils";
import type { CompareMetricKey, PerfArtifactType } from "./types";

export function getArtifactIcon(type: PerfArtifactType) {
  if (type === "zip") return <FileArchive className="h-4 w-4 text-[var(--muted-foreground)]" />;
  if (type === "json") return <FileJson className="h-4 w-4 text-[var(--muted-foreground)]" />;
  if (type === "csv") return <FileSpreadsheet className="h-4 w-4 text-[var(--muted-foreground)]" />;
  return <FileCode2 className="h-4 w-4 text-[var(--muted-foreground)]" />;
}

/** Primary metric value with baseline delta to the right (detail GET / live baseline). */
export function ValueWithBaselineDelta({
  primary,
  metric,
  deltaPct,
  deltaPp,
  className,
}: Readonly<{
  primary: React.ReactNode;
  metric: CompareMetricKey;
  deltaPct: number | null;
  deltaPp: number | null;
  className?: string;
}>) {
  const lowerIsBetter = metric === "p95" || metric === "p99" || metric === "error_rate";
  let suffix: React.ReactNode;
  if (metric === "error_rate") {
    if (deltaPp != null) {
      const impact = toMetricImpact(deltaPp, true);
      const text = `${deltaPp > 0 ? "+" : ""}${deltaPp.toFixed(2)} pp`;
      suffix = <span className={`whitespace-nowrap text-xs font-medium ${getMetricDeltaColor(impact)}`}>{text}</span>;
    } else {
      suffix = <span className="whitespace-nowrap text-xs text-[var(--muted-foreground)]">—</span>;
    }
  } else if (deltaPct != null) {
    const impact = toMetricImpact(deltaPct, lowerIsBetter);
    suffix = <span className={`whitespace-nowrap text-xs font-medium ${getMetricDeltaColor(impact)}`}>{formatSignedPercent(deltaPct)}</span>;
  } else {
    suffix = <span className="whitespace-nowrap text-xs text-[var(--muted-foreground)]">—</span>;
  }

  return (
    <div className={["flex flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5", className].filter(Boolean).join(" ")}>
      <span className="text-sm text-[var(--foreground)]">{primary}</span>
      {suffix}
    </div>
  );
}

/** Outer frame for grouped transaction tables; title and collapse live on `UnifiedTable` (`tableName` + `sectionCollapsible`). */
export function PerfGroupedTableSection({
  groupTitle,
  children,
}: Readonly<{ groupTitle: string | null; children: ReactNode }>) {
  if (groupTitle == null) {
    return <div className="min-w-0 overflow-x-auto">{children}</div>;
  }

  return <div className="overflow-hidden rounded-lg border border-[var(--border)]">{children}</div>;
}
