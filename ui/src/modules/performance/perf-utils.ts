import type { RunProgressBarModel } from "@/shared/lib/run-progress-bar-model";
import { getRunProgressBarModel } from "@/shared/lib/run-progress-bar-model";
import type { StatusBadgeTone } from "@/shared/ui/StatusBadge";

import { COMPARE_METRIC_KEYS } from "./constants";
import type {
  CompareMetricKey,
  CompareMetricOption,
  PerfEnvironmentSnapshot,
  PerfLoadKind,
  PerfMetricComparisonImpact,
  PerfParseStatus,
  PerfRun,
  PerfRunStatus,
  PerfRunVerdict,
  PerfSystemLoadSample,
  PerfTransaction,
  PerfTransactionArtifact,
  PerfTransactionGeneratorResult,
} from "./types";

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }
  return parsedDate.toLocaleString();
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) {
    return `${remainder}m`;
  }
  return `${hours}h ${remainder}m`;
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString();
}

export function formatCompactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs < 1000) {
    return String(value);
  }

  const units = [
    { threshold: 1_000_000_000_000, suffix: "t" },
    { threshold: 1_000_000_000, suffix: "b" },
    { threshold: 1_000_000, suffix: "m" },
    { threshold: 1_000, suffix: "k" },
  ] as const;

  for (const unit of units) {
    if (abs >= unit.threshold) {
      const compact = value / unit.threshold;
      const rounded = Number(compact.toFixed(1));
      return `${rounded}${unit.suffix}`;
    }
  }

  return String(value);
}

export function getStatusTone(status: PerfRunStatus): StatusBadgeTone {
  if (status === "completed") return "success";
  if (status === "running") return "info";
  return "warning";
}

export function getStatusLabel(status: PerfRunStatus): string {
  if (status === "completed") return "Completed";
  if (status === "running") return "Running";
  return "Incomplete";
}

export function getVerdictTone(verdict: PerfRunVerdict): StatusBadgeTone {
  if (verdict === "green") return "success";
  if (verdict === "yellow") return "warning";
  return "danger";
}

export function getVerdictLabel(verdict: PerfRunVerdict): string {
  if (verdict === "green") return "Green";
  if (verdict === "yellow") return "Yellow";
  return "Red";
}

export function getParseStatusTone(parseStatus: PerfParseStatus): StatusBadgeTone {
  if (parseStatus === "parsed") return "success";
  if (parseStatus === "partial") return "warning";
  return "danger";
}

export function getParseStatusLabel(parseStatus: PerfParseStatus): string {
  if (parseStatus === "parsed") return "Parsed";
  if (parseStatus === "partial") return "Partial";
  return "Failed";
}

export function getLoadKindLabel(kind: PerfLoadKind): string {
  if (kind === "http") return "HTTP";
  if (kind === "cpu") return "CPU";
  if (kind === "ram") return "RAM";
  if (kind === "disk_io") return "DISK IO";
  return "Benchmark";
}

export function getLoadKindTone(kind: PerfLoadKind): StatusBadgeTone {
  if (kind === "http") return "info";
  if (kind === "cpu") return "warning";
  if (kind === "ram") return "muted";
  if (kind === "disk_io") return "neutral";
  return "success";
}

export function getRunLoadKind(run: PerfRun): PerfLoadKind {
  return run.loadKind ?? "http";
}

export function getRunEnvironmentSnapshot(run: PerfRun): PerfEnvironmentSnapshot {
  if (run.environmentSnapshot) {
    return run.environmentSnapshot;
  }
  return {
    region: "unknown",
    cluster: run.env,
    namespace: "default",
    instanceType: "unknown",
    cpuCores: 0,
    memoryGb: 0,
  };
}

export function formatDeltaPercent(current: number, baseline: number): number | null {
  if (baseline === 0) {
    return null;
  }
  return ((current - baseline) / baseline) * 100;
}

export function toMetricImpact(delta: number | null, lowerIsBetter: boolean): PerfMetricComparisonImpact {
  if (delta == null || Math.abs(delta) < 0.01) {
    return "neutral";
  }
  if (lowerIsBetter) {
    return delta < 0 ? "improved" : "regressed";
  }
  return delta > 0 ? "improved" : "regressed";
}

export function formatSignedPercent(delta: number | null): string {
  if (delta == null) {
    return "n/a";
  }
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;
}

export function getCompareMetricMeta(metric: CompareMetricKey): { label: string; lowerIsBetter: boolean } {
  switch (metric) {
    case "throughput":
      return { label: "Throughput", lowerIsBetter: false };
    case "error_rate":
      return { label: "Error Rate", lowerIsBetter: true };
    case "p95":
      return { label: "P95", lowerIsBetter: true };
    case "p99":
      return { label: "P99", lowerIsBetter: true };
    case "checks_pass":
      return { label: "Checks pass", lowerIsBetter: false };
  }
}

function runMetricHasMeaningfulValue(run: PerfRun, key: CompareMetricKey): boolean {
  if (key === "throughput") return run.summary.throughputRps > 0;
  if (key === "error_rate") return run.summary.errorRatePct >= 0; // 0 is meaningful
  if (key === "p95") return run.summary.p95Ms > 0;
  if (key === "p99") return run.summary.p99Ms > 0;
  return run.summary.checksTotal > 0;
}

function transactionMetricDefinedOnRow(key: CompareMetricKey): boolean {
  const empty: PerfTransaction = {
    key: "_",
    group: "",
    label: "",
    throughputRps: 0,
    p95Ms: 0,
    errorRatePct: 0,
    deltaP95Pct: null,
    deltaThroughputPct: null,
    deltaErrorRatePp: null,
    deltaErrorRatePct: 0,
  };
  return getTransactionMetricValue(empty, key) !== null;
}

/**
 * Metrics that can be compared for the selected runs.
 * A metric is offered when at least one of the runs reports a meaningful (non-zero) value;
 * runs without that metric show n/a in the cell. Per-transaction breakdown is enabled only
 * when every run carries transaction rows AND the metric exists at the transaction level.
 */
export function deriveCompareMetricOptions(runs: PerfRun[]): CompareMetricOption[] {
  if (runs.length === 0) {
    return [];
  }
  return COMPARE_METRIC_KEYS.filter((key: CompareMetricKey) =>
    runs.some((r) => runMetricHasMeaningfulValue(r, key)),
  ).map((key: CompareMetricKey) => {
    const meta = getCompareMetricMeta(key);
    const supportsTransactions =
      runs.every((r) => r.transactions.length > 0) && transactionMetricDefinedOnRow(key);
    return { key, label: meta.label, lowerIsBetter: meta.lowerIsBetter, supportsTransactions };
  });
}

export function getCompareMetricOption(metric: CompareMetricKey): CompareMetricOption {
  const meta = getCompareMetricMeta(metric);
  return {
    key: metric,
    label: meta.label,
    lowerIsBetter: meta.lowerIsBetter,
    supportsTransactions: transactionMetricDefinedOnRow(metric),
  };
}

export function buildRunMetricDelta(current: number, baseline: number, metric: CompareMetricOption): {
  label: string;
  impact: PerfMetricComparisonImpact;
} {
  if (metric.key === "error_rate") {
    const deltaPp = current - baseline;
    return {
      label: `${deltaPp > 0 ? "+" : ""}${deltaPp.toFixed(2)} pp`,
      impact: toMetricImpact(deltaPp, metric.lowerIsBetter),
    };
  }

  const delta = formatDeltaPercent(current, baseline);
  return {
    label: formatSignedPercent(delta),
    impact: toMetricImpact(delta, metric.lowerIsBetter),
  };
}

export function getRunMetricValue(run: PerfRun, metric: CompareMetricKey): number {
  if (metric === "throughput") return run.summary.throughputRps;
  if (metric === "error_rate") return run.summary.errorRatePct;
  if (metric === "p95") return run.summary.p95Ms;
  if (metric === "p99") return run.summary.p99Ms;
  if (run.summary.checksTotal === 0) return 0;
  return (run.summary.checksPassed / run.summary.checksTotal) * 100;
}

export function formatRunMetricValue(metric: CompareMetricKey, value: number): string {
  if (metric === "throughput") return `${formatNumber(Math.round(value))} rps`;
  if (metric === "error_rate") return formatPercent(value, 2);
  if (metric === "p95" || metric === "p99") return `${Math.round(value)} ms`;
  return formatPercent(value, 1);
}

export function getTransactionMetricValue(transaction: PerfTransaction, metric: CompareMetricKey): number | null {
  if (metric === "throughput") return transaction.throughputRps;
  if (metric === "error_rate") return transaction.errorRatePct;
  if (metric === "p95") return transaction.p95Ms;
  return null;
}

export function formatTransactionMetricValue(metric: CompareMetricKey, value: number | null): string {
  if (value == null) return "n/a";
  if (metric === "throughput") return `${formatNumber(Math.round(value))} rps`;
  if (metric === "error_rate") return formatPercent(value, 2);
  if (metric === "p95") return `${Math.round(value)} ms`;
  return "n/a";
}

export function hashText(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 1000003;
  }
  return hash;
}

export function buildGeneratorBreakdown(transaction: PerfTransaction): PerfTransactionGeneratorResult[] {
  if (transaction.generators && transaction.generators.length > 0) {
    return transaction.generators;
  }

  const hash = hashText(transaction.key);
  const generatorCount = 2 + (hash % 2);
  const generatorNames = ["generator-eu-1", "generator-eu-2", "generator-us-1", "generator-ap-1"].slice(0, generatorCount);
  const baseShares = generatorCount === 2 ? [0.58, 0.42] : [0.46, 0.34, 0.2];

  let remainingThroughput = transaction.throughputRps;
  const results = generatorNames.map((generator, index) => {
    const isLast = index === generatorNames.length - 1;
    const throughput = isLast
      ? remainingThroughput
      : Math.max(1, Math.round(transaction.throughputRps * baseShares[index]));
    remainingThroughput = Math.max(0, remainingThroughput - throughput);

    const latencyDrift = 0.9 + (((hash + index * 17) % 24) / 100);
    const errorDrift = 0.72 + (((hash + index * 11) % 31) / 100);
    const p95Ms = Math.max(1, Math.round(transaction.p95Ms * latencyDrift));
    const errorRatePct = Number((transaction.errorRatePct * errorDrift).toFixed(2));
    const requests = Math.max(1, Math.round(throughput * 120));
    const failures = Math.max(0, Math.round((requests * errorRatePct) / 100));

    return {
      generator,
      requests,
      failures,
      throughputRps: throughput,
      p95Ms,
      errorRatePct,
    };
  });

  return results;
}

export function buildSystemLoadSeries(run: PerfRun, transaction: PerfTransaction): PerfSystemLoadSample[] | undefined {
  if (transaction.systemLoad) {
    return transaction.systemLoad;
  }

  const hash = hashText(`${run.id}-${transaction.key}`);
  if (hash % 4 === 0) {
    return undefined;
  }

  return Array.from({ length: 6 }).map((_, index) => {
    const minuteMark = (index + 1) * 5;
    const drift = ((hash + index * 13) % 18) - 9;
    const cpuBase = getRunLoadKind(run) === "cpu" ? 72 : 58;
    const memoryBase = getRunLoadKind(run) === "ram" ? 80 : 64;
    const diskBase = getRunLoadKind(run) === "disk_io" ? 420 : 210;

    return {
      timestamp: `+${minuteMark}m`,
      cpuPct: Math.max(10, Math.min(99, cpuBase + drift)),
      memoryPct: Math.max(10, Math.min(99, memoryBase + Math.round(drift * 0.6))),
      diskIoMBps: Math.max(20, diskBase + drift * 8),
    };
  });
}

export function buildResultLogs(run: PerfRun, transaction: PerfTransaction): string[] {
  if (transaction.logs && transaction.logs.length > 0) {
    return transaction.logs;
  }

  return [
    `[${run.startedAt ?? "unknown-start"}] test-case=${transaction.key} started`,
    `[${run.startedAt ?? "unknown-start"}] load-profile=${run.loadProfile} tool=${run.tool}`,
    `[${run.finishedAt ?? run.startedAt ?? "unknown-finish"}] aggregated p95=${transaction.p95Ms}ms err=${transaction.errorRatePct.toFixed(2)}%`,
    `[${run.finishedAt ?? run.startedAt ?? "unknown-finish"}] completed status=${run.status}`,
  ];
}

export function buildResultArtifacts(run: PerfRun, transaction: PerfTransaction): PerfTransactionArtifact[] {
  if (transaction.artifacts && transaction.artifacts.length > 0) {
    return transaction.artifacts;
  }

  return [
    { label: "Case report JSON", href: `#artifact/${run.id}/${transaction.key}/report.json` },
    { label: "Case raw logs", href: `#artifact/${run.id}/${transaction.key}/logs.txt` },
    { label: "Case timeline CSV", href: `#artifact/${run.id}/${transaction.key}/timeline.csv` },
  ];
}

export function getTransactionDescription(run: PerfRun, transaction: PerfTransaction): string {
  if (transaction.description) {
    return transaction.description;
  }
  return `Aggregated result for ${transaction.label} under scenario "${run.scenario}" and load profile "${run.loadProfile}".`;
}

export function getTransactionRunCommand(run: PerfRun, transaction: PerfTransaction): string {
  if (transaction.runCommand) {
    return transaction.runCommand;
  }

  if (run.tool.toLowerCase() === "k6") {
    return `k6 run scripts/${transaction.key}.js --env TARGET=${run.env} --tag scenario=${run.scenario}`;
  }
  if (run.tool.toLowerCase() === "locust") {
    return `locust -f locust/${transaction.key}.py --host=https://${run.service}.${run.env} --users=300`;
  }
  return `${run.tool} run ${transaction.key} --env ${run.env}`;
}

export function getMetricDeltaColor(impact: PerfMetricComparisonImpact): string {
  if (impact === "improved") return "text-[var(--status-passed)]";
  if (impact === "regressed") return "text-[var(--status-failure)]";
  return "text-[var(--muted-foreground)]";
}

export function getRunProgress(run: PerfRun): { done: number; errors: number; all: number; pending: number } {
  const all = Math.max(run.summary.checksTotal, 0);
  const failedChecks = Math.max(all - run.summary.checksPassed, 0);
  const failedByRate = Math.round((run.summary.errorRatePct / 100) * all);
  const errors = Math.max(Math.min(Math.max(failedChecks, failedByRate), all), 0);
  const done = Math.max(Math.min(run.summary.checksPassed, all - errors), 0);
  const pending = Math.max(all - done - errors, 0);
  return { done, errors, all, pending };
}

/** Segments for the shared mini progress bar (same palette as test runs: passed / failure / pending). */
export function getPerfRunProgressBarModel(run: PerfRun): RunProgressBarModel {
  const p = getRunProgress(run);
  const progress = p.all > 0 ? Math.round(((p.done + p.errors) / p.all) * 100) : 0;
  return getRunProgressBarModel({
    progress,
    passed: p.done,
    error: 0,
    failure: p.errors,
    blocked: 0,
    skipped: 0,
    xfailed: 0,
    xpassed: 0,
    total: p.all,
  });
}

export function groupTransactions(transactions: PerfTransaction[]): Array<{ group: string; items: PerfTransaction[] }> {
  const grouped = transactions.reduce<Record<string, PerfTransaction[]>>((acc, transaction) => {
    const group = transaction.group || "General";
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(transaction);
    return acc;
  }, {});

  return Object.entries(grouped)
    .sort(([groupA], [groupB]) => groupA.localeCompare(groupB))
    .map(([group, items]) => ({ group, items }));
}

export function toggleSetValue(current: Set<string>, value: string): Set<string> {
  const next = new Set(current);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}
