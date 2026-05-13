import { StatusBadge } from "@/shared/ui";
import {
  getLoadKindLabel,
  getLoadKindTone,
  getRunEnvironmentSnapshot,
  getRunLoadKind,
} from "./perf-utils";
import type { PerfRun } from "./types";

export function PerformanceRunEnvironmentTab({ run }: Readonly<{ run: PerfRun }>) {
  const environmentSnapshot = getRunEnvironmentSnapshot(run);
  const loadKind = getRunLoadKind(run);
  let warmupLabel: string | undefined;
  if (environmentSnapshot.warmupEnabled != null) {
    warmupLabel = environmentSnapshot.warmupEnabled ? "enabled" : "disabled";
  }
  const benchmarkMetaRows = [
    ["Python", environmentSnapshot.pythonVersion],
    ["Implementation", environmentSnapshot.pythonImplementation],
    ["OS", environmentSnapshot.osSystem],
    ["OS release", environmentSnapshot.osRelease],
    ["Architecture", environmentSnapshot.architecture],
    ["CPU model", environmentSnapshot.cpuModel],
    ["Framework", environmentSnapshot.benchmarkFrameworkVersion],
    ["Warmup", warmupLabel],
    ["Rounds", environmentSnapshot.roundsTotal == null ? undefined : String(environmentSnapshot.roundsTotal)],
    ["Iterations", environmentSnapshot.iterationsTotal == null ? undefined : String(environmentSnapshot.iterationsTotal)],
  ].filter(([, value]) => Boolean(value));
  const hasBenchmarkMetadata = benchmarkMetaRows.length > 0;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <h2 className="text-base font-semibold text-[var(--foreground)]">Environment</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3">
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Load Type</p>
          <div className="mt-2">
            <StatusBadge tone={getLoadKindTone(loadKind)} withBorder>
              {getLoadKindLabel(loadKind)}
            </StatusBadge>
          </div>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">Tool: {run.tool}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3">
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Environment</p>
          <p className="mt-1 text-sm font-medium text-[var(--foreground)]">{run.env}</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {environmentSnapshot.region} • {environmentSnapshot.cluster} • ns/{environmentSnapshot.namespace}
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {environmentSnapshot.instanceType} • {environmentSnapshot.cpuCores} CPU • {environmentSnapshot.memoryGb} GB RAM
          </p>
        </div>
        {hasBenchmarkMetadata ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Benchmark metadata</p>
            <div className="mt-2 space-y-1 text-xs text-[var(--foreground)]">
              {benchmarkMetaRows.map(([label, value]) => (
                <p key={label}>
                  <span className="font-medium text-[var(--foreground)]">{label}:</span> {value}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
