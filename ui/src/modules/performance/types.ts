export type PerfRunStatus = "completed" | "incomplete" | "running";
export type PerfRunVerdict = "green" | "yellow" | "red";
export type PerfParseStatus = "parsed" | "partial" | "failed";
export type PerfBaselinePolicy = "manual" | "latest_green" | "tagged";
export type PerfLoadKind = "http" | "cpu" | "ram" | "disk_io" | "benchmark";
export type CompareMetricKey = "throughput" | "error_rate" | "p95" | "p99" | "checks_pass";

export type PerfEnvironmentSnapshot = {
  region: string;
  cluster: string;
  namespace: string;
  instanceType: string;
  cpuCores: number;
  memoryGb: number;
  pythonVersion?: string;
  pythonImplementation?: string;
  osSystem?: string;
  osRelease?: string;
  architecture?: string;
  cpuModel?: string;
  benchmarkFrameworkVersion?: string;
  warmupEnabled?: boolean;
  roundsTotal?: number;
  iterationsTotal?: number;
};

export type PerfMetricComparisonImpact = "improved" | "regressed" | "neutral";

export type PerfMetricComparison = {
  label: string;
  current: string;
  baseline: string;
  delta: string;
  impact: PerfMetricComparisonImpact;
};

export type PerfTransaction = {
  key: string;
  group: string;
  label: string;
  throughputRps: number;
  p95Ms: number;
  errorRatePct: number;
  deltaP95Pct: number | null;
  deltaThroughputPct: number | null;
  deltaErrorRatePp: number | null;
  deltaErrorRatePct: number;
  description?: string;
  runCommand?: string;
  generators?: PerfTransactionGeneratorResult[];
  systemLoad?: PerfSystemLoadSample[];
  logs?: string[];
  artifacts?: PerfTransactionArtifact[];
};

export type PerfTransactionGeneratorResult = {
  generator: string;
  requests: number;
  failures: number;
  throughputRps: number;
  p95Ms: number;
  errorRatePct: number;
};

export type PerfSystemLoadSample = {
  timestamp: string;
  cpuPct: number;
  memoryPct: number;
  diskIoMBps: number;
};

export type PerfTransactionArtifact = {
  label: string;
  href: string;
};

export type CompareMetricOption = {
  key: CompareMetricKey;
  label: string;
  lowerIsBetter: boolean;
  supportsTransactions: boolean;
};

export type PerfErrorBucket = {
  key: string;
  type: string;
  count: number;
  ratePct: number;
  lastSeenAt: string;
  hint: string;
};

export type PerfArtifactType = "zip" | "json" | "csv" | "html" | "txt";

export type PerfArtifact = {
  id: string;
  label: string;
  type: PerfArtifactType;
  size: string;
  status: "ready" | "missing";
  createdAt: string;
};

export type PerfImportRecord = {
  id?: string;
  source: string;
  adapter: string;
  adapterVersion: string;
  confidence: number;
  found: string[];
  missing: string[];
  parseStatus: PerfParseStatus;
  issues: string[];
};

export type PerfRun = {
  id: string;
  projectId?: string;
  name: string;
  service: string;
  env: string;
  scenario: string;
  loadProfile: string;
  branch: string;
  commit: string;
  build: string;
  version: string;
  tool: string;
  status: PerfRunStatus;
  verdict: PerfRunVerdict;
  loadKind?: PerfLoadKind;
  startedAt: string;
  finishedAt: string | null;
  durationMinutes: number;
  summary: {
    throughputRps: number;
    errorRatePct: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    peakVus: number;
    checksPassed: number;
    checksTotal: number;
  };
  baseline: {
    ref: string | null;
    policy: PerfBaselinePolicy;
    label: string;
  };
  regressions: Array<{
    title: string;
    scope: string;
    delta: string;
  }>;
  metricsComparison: PerfMetricComparison[];
  transactions: PerfTransaction[];
  errors: PerfErrorBucket[];
  artifacts: PerfArtifact[];
  importRecord: PerfImportRecord | null;
  environmentSnapshot?: PerfEnvironmentSnapshot;
  acknowledged?: boolean;
  archived?: boolean;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
};
