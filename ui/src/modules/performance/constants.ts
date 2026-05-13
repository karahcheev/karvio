import type { CompareMetricKey, PerfLoadKind, PerfRunStatus } from "./types";

export const RUN_STATUSES: PerfRunStatus[] = ["running", "completed", "incomplete"];
export const RUN_LOAD_KINDS: PerfLoadKind[] = ["http", "cpu", "ram", "disk_io", "benchmark"];

export const RUN_DETAIL_TABS = ["overview", "environment", "compare", "artifacts"] as const;
export type RunDetailTab = (typeof RUN_DETAIL_TABS)[number];

/** Candidate metrics for run compare; availability is filtered per run set in perf-utils. */
export const COMPARE_METRIC_KEYS: CompareMetricKey[] = ["throughput", "error_rate", "p95", "p99", "checks_pass"];
export const MAX_COMPARE_RUNS = 4;
