import type {
  PerformanceImportDto,
  PerformanceImportRecordDto,
  PerformancePreflightDto,
  PerformanceRunDto,
} from "@/shared/api";
import type { PerfImportRecord, PerfRun } from "./types";

function mapImportRecord(record: PerformanceImportRecordDto): PerfImportRecord {
  return {
    id: record.id ?? undefined,
    source: record.source,
    adapter: record.adapter,
    adapterVersion: record.adapter_version,
    confidence: record.confidence,
    found: record.found,
    missing: record.missing,
    parseStatus: record.parse_status,
    issues: record.issues,
  };
}

export function mapPerformanceRunDto(dto: PerformanceRunDto): PerfRun {
  return {
    id: dto.id,
    projectId: dto.project_id,
    name: dto.name,
    service: dto.service,
    env: dto.env,
    scenario: dto.scenario,
    loadProfile: dto.load_profile,
    branch: dto.branch,
    commit: dto.commit,
    build: dto.build,
    version: dto.version,
    tool: dto.tool,
    status: dto.status,
    verdict: dto.verdict,
    loadKind: dto.load_kind,
    startedAt: dto.started_at,
    finishedAt: dto.finished_at,
    durationMinutes: dto.duration_minutes,
    summary: {
      throughputRps: dto.summary.throughput_rps,
      errorRatePct: dto.summary.error_rate_pct,
      p50Ms: dto.summary.p50_ms,
      p95Ms: dto.summary.p95_ms,
      p99Ms: dto.summary.p99_ms,
      peakVus: dto.summary.peak_vus,
      checksPassed: dto.summary.checks_passed,
      checksTotal: dto.summary.checks_total,
    },
    baseline: {
      ref: dto.baseline.ref,
      policy: dto.baseline.policy,
      label: dto.baseline.label,
    },
    regressions: dto.regressions,
    metricsComparison: dto.metrics_comparison,
    transactions: dto.transactions.map((transaction) => ({
      key: transaction.key,
      group: transaction.group,
      label: transaction.label,
      throughputRps: transaction.throughput_rps,
      p95Ms: transaction.p95_ms,
      errorRatePct: transaction.error_rate_pct,
      deltaP95Pct: transaction.delta_p95_pct ?? null,
      deltaThroughputPct: transaction.delta_throughput_pct ?? null,
      deltaErrorRatePp: transaction.delta_error_rate_pp ?? null,
      deltaErrorRatePct: transaction.delta_error_rate_pct,
      description: transaction.description ?? undefined,
      runCommand: transaction.run_command ?? undefined,
      generators: transaction.generators.map((generator) => ({
        generator: generator.generator,
        requests: generator.requests,
        failures: generator.failures,
        throughputRps: generator.throughput_rps,
        p95Ms: generator.p95_ms,
        errorRatePct: generator.error_rate_pct,
      })),
      systemLoad: transaction.system_load.map((sample) => ({
        timestamp: sample.timestamp,
        cpuPct: sample.cpu_pct,
        memoryPct: sample.memory_pct,
        diskIoMBps: sample.disk_io_mbps,
      })),
      logs: transaction.logs,
      artifacts: transaction.artifacts,
    })),
    errors: dto.errors.map((error) => ({
      key: error.key,
      type: error.type,
      count: error.count,
      ratePct: error.rate_pct,
      lastSeenAt: error.last_seen_at,
      hint: error.hint,
    })),
    artifacts: dto.artifacts.map((artifact) => ({
      id: artifact.id,
      label: artifact.label,
      type: artifact.type,
      size: artifact.size,
      status: artifact.status,
      createdAt: artifact.created_at,
    })),
    importRecord: dto.import_record ? mapImportRecord(dto.import_record) : null,
    environmentSnapshot: {
      region: dto.environment_snapshot.region,
      cluster: dto.environment_snapshot.cluster,
      namespace: dto.environment_snapshot.namespace,
      instanceType: dto.environment_snapshot.instance_type,
      cpuCores: dto.environment_snapshot.cpu_cores,
      memoryGb: dto.environment_snapshot.memory_gb,
      pythonVersion: dto.environment_snapshot.python_version ?? undefined,
      pythonImplementation: dto.environment_snapshot.python_implementation ?? undefined,
      osSystem: dto.environment_snapshot.os_system ?? undefined,
      osRelease: dto.environment_snapshot.os_release ?? undefined,
      architecture: dto.environment_snapshot.architecture ?? undefined,
      cpuModel: dto.environment_snapshot.cpu_model ?? undefined,
      benchmarkFrameworkVersion: dto.environment_snapshot.benchmark_framework_version ?? undefined,
      warmupEnabled: dto.environment_snapshot.warmup_enabled ?? undefined,
      roundsTotal: dto.environment_snapshot.rounds_total ?? undefined,
      iterationsTotal: dto.environment_snapshot.iterations_total ?? undefined,
    },
    acknowledged: dto.acknowledged,
    archived: dto.archived,
    createdBy: dto.created_by,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function mapPreflightDto(dto: PerformancePreflightDto): PerfImportRecord {
  return {
    source: dto.source,
    adapter: dto.adapter,
    adapterVersion: dto.adapter_version,
    confidence: dto.confidence,
    found: dto.found,
    missing: dto.missing,
    parseStatus: dto.parse_status,
    issues: dto.issues,
  };
}

export function mapImportDto(dto: PerformanceImportDto): PerfImportRecord {
  return {
    id: dto.id,
    source: `upload://${dto.source_filename}`,
    adapter: dto.adapter ?? "unknown",
    adapterVersion: dto.adapter_version ?? "unknown",
    confidence: dto.confidence ?? 0,
    found: dto.found,
    missing: dto.missing,
    parseStatus: dto.parse_status,
    issues: dto.issues,
  };
}
