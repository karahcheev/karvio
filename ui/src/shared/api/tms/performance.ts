import { apiFetch, apiRequest } from "@/shared/api/client";
import { fetchAllPageItems } from "./helpers";

export type PerformanceRunStatusDto = "completed" | "incomplete" | "running";
export type PerformanceRunVerdictDto = "green" | "yellow" | "red";
export type PerformanceParseStatusDto = "parsed" | "partial" | "failed";
export type PerformanceBaselinePolicyDto = "manual" | "latest_green" | "tagged";
export type PerformanceLoadKindDto = "http" | "cpu" | "ram" | "disk_io" | "benchmark";
export type PerformanceArtifactTypeDto = "zip" | "json" | "csv" | "html" | "txt";
export type PerformanceImportStatusDto = "pending" | "processing" | "completed" | "partial" | "failed";
export type PerformanceRunsSortBy =
  | "created_at"
  | "started_at"
  | "name"
  | "status"
  | "verdict"
  | "load_kind"
  | "env";

export interface PerformanceSummaryDto {
  throughput_rps: number;
  error_rate_pct: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  peak_vus: number;
  checks_passed: number;
  checks_total: number;
}

export interface PerformanceBaselineDto {
  ref: string | null;
  policy: PerformanceBaselinePolicyDto;
  label: string;
}

export interface PerformanceRegressionItemDto {
  title: string;
  scope: string;
  delta: string;
}

export interface PerformanceMetricComparisonDto {
  label: string;
  current: string;
  baseline: string;
  delta: string;
  impact: "improved" | "regressed" | "neutral";
}

export interface PerformanceTransactionGeneratorResultDto {
  generator: string;
  requests: number;
  failures: number;
  throughput_rps: number;
  p95_ms: number;
  error_rate_pct: number;
}

export interface PerformanceSystemLoadSampleDto {
  timestamp: string;
  cpu_pct: number;
  memory_pct: number;
  disk_io_mbps: number;
}

export interface PerformanceTransactionArtifactDto {
  label: string;
  href: string;
}

export interface PerformanceTransactionDto {
  key: string;
  group: string;
  label: string;
  throughput_rps: number;
  p95_ms: number;
  error_rate_pct: number;
  delta_p95_pct: number | null;
  delta_throughput_pct: number | null;
  delta_error_rate_pp: number | null;
  delta_error_rate_pct: number;
  description: string | null;
  run_command: string | null;
  generators: PerformanceTransactionGeneratorResultDto[];
  system_load: PerformanceSystemLoadSampleDto[];
  logs: string[];
  artifacts: PerformanceTransactionArtifactDto[];
}

export interface PerformanceErrorBucketDto {
  key: string;
  type: string;
  count: number;
  rate_pct: number;
  last_seen_at: string;
  hint: string;
}

export interface PerformanceArtifactDto {
  id: string;
  label: string;
  type: PerformanceArtifactTypeDto;
  size: string;
  status: "ready" | "missing";
  created_at: string;
}

export interface PerformanceImportRecordDto {
  id: string | null;
  source: string;
  adapter: string;
  adapter_version: string;
  confidence: number;
  found: string[];
  missing: string[];
  parse_status: PerformanceParseStatusDto;
  issues: string[];
}

export interface PerformanceEnvironmentSnapshotDto {
  region: string;
  cluster: string;
  namespace: string;
  instance_type: string;
  cpu_cores: number;
  memory_gb: number;
  python_version?: string | null;
  python_implementation?: string | null;
  os_system?: string | null;
  os_release?: string | null;
  architecture?: string | null;
  cpu_model?: string | null;
  benchmark_framework_version?: string | null;
  warmup_enabled?: boolean | null;
  rounds_total?: number | null;
  iterations_total?: number | null;
}

export interface PerformanceRunDto {
  id: string;
  project_id: string;
  name: string;
  service: string;
  env: string;
  scenario: string;
  load_profile: string;
  branch: string;
  commit: string;
  build: string;
  version: string;
  tool: string;
  status: PerformanceRunStatusDto;
  verdict: PerformanceRunVerdictDto;
  load_kind: PerformanceLoadKindDto;
  started_at: string;
  finished_at: string | null;
  duration_minutes: number;
  summary: PerformanceSummaryDto;
  baseline: PerformanceBaselineDto;
  regressions: PerformanceRegressionItemDto[];
  metrics_comparison: PerformanceMetricComparisonDto[];
  transactions: PerformanceTransactionDto[];
  errors: PerformanceErrorBucketDto[];
  artifacts: PerformanceArtifactDto[];
  import_record: PerformanceImportRecordDto | null;
  environment_snapshot: PerformanceEnvironmentSnapshotDto;
  acknowledged: boolean;
  archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PerformanceRunsPageDto {
  items: PerformanceRunDto[];
  page: number;
  page_size: number;
  has_next: boolean;
}

export interface PatchPerformanceRunPayload {
  name?: string;
  service?: string;
  env?: string;
  scenario?: string;
  load_profile?: string;
  branch?: string;
  commit?: string;
  build?: string;
  version?: string;
  tool?: string;
  status?: PerformanceRunStatusDto;
  acknowledged?: boolean;
  archived?: boolean;
  mark_as_baseline?: boolean;
}

export interface PerformancePreflightDto {
  source: string;
  adapter: string;
  adapter_version: string;
  confidence: number;
  found: string[];
  missing: string[];
  parse_status: PerformanceParseStatusDto;
  issues: string[];
}

export interface PerformanceImportAcceptedDto {
  import_id: string;
  run_id: string;
  status: "pending";
}

export interface PerformanceImportDto {
  id: string;
  project_id: string;
  run_id: string;
  status: PerformanceImportStatusDto;
  parse_status: PerformanceParseStatusDto;
  source_filename: string;
  source_content_type: string | null;
  adapter: string | null;
  adapter_version: string | null;
  confidence: number | null;
  found: string[];
  missing: string[];
  issues: string[];
  error_detail: string | null;
  created_by: string | null;
  started_processing_at: string | null;
  finished_processing_at: string | null;
  created_at: string;
  updated_at: string;
}

function buildPerformanceRunsParams(filters?: {
  statuses?: PerformanceRunStatusDto[];
  verdicts?: PerformanceRunVerdictDto[];
  loadKinds?: PerformanceLoadKindDto[];
  environments?: string[];
  search?: string;
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: PerformanceRunsSortBy;
  sortOrder?: "asc" | "desc";
}): URLSearchParams {
  const params = new URLSearchParams();

  if (typeof filters?.includeArchived === "boolean") {
    params.set("include_archived", String(filters.includeArchived));
  }

  filters?.statuses?.forEach((status) => {
    params.append("status", status);
  });
  filters?.verdicts?.forEach((verdict) => {
    params.append("verdict", verdict);
  });
  filters?.loadKinds?.forEach((loadKind) => {
    params.append("load_kind", loadKind);
  });
  filters?.environments?.forEach((environment) => {
    const normalized = environment.trim();
    if (normalized) {
      params.append("environment", normalized);
    }
  });
  if (filters?.search?.trim()) {
    params.set("search", filters.search.trim());
  }
  if (typeof filters?.page === "number") {
    params.set("page", String(filters.page));
  }
  if (typeof filters?.pageSize === "number") {
    params.set("page_size", String(filters.pageSize));
  }
  if (filters?.sortBy) {
    params.set("sort_by", filters.sortBy);
  }
  if (filters?.sortOrder) {
    params.set("sort_order", filters.sortOrder);
  }

  return params;
}

export async function getPerformanceRuns(
  projectId: string,
  filters?: {
    statuses?: PerformanceRunStatusDto[];
    verdicts?: PerformanceRunVerdictDto[];
    loadKinds?: PerformanceLoadKindDto[];
    environments?: string[];
    search?: string;
    includeArchived?: boolean;
    sortBy?: PerformanceRunsSortBy;
    sortOrder?: "asc" | "desc";
  },
): Promise<PerformanceRunDto[]> {
  const params = buildPerformanceRunsParams(filters);  

  params.set("project_id", projectId);
  return fetchAllPageItems<PerformanceRunDto>("/perf/runs", params);
}

export async function getPerformanceRunsPage(params: {
  projectId: string;
  statuses?: PerformanceRunStatusDto[];
  verdicts?: PerformanceRunVerdictDto[];
  loadKinds?: PerformanceLoadKindDto[];
  environments?: string[];
  search?: string;
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: PerformanceRunsSortBy;
  sortOrder?: "asc" | "desc";
}): Promise<PerformanceRunsPageDto> {
  const query = buildPerformanceRunsParams({
    statuses: params.statuses,
    verdicts: params.verdicts,
    loadKinds: params.loadKinds,
    environments: params.environments,
    search: params.search,
    includeArchived: params.includeArchived,
    page: params.page,
    pageSize: params.pageSize,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  });
  query.set("project_id", params.projectId);
  return apiRequest<PerformanceRunsPageDto>(`/perf/runs?${query.toString()}`);
}

export async function getPerformanceRun(runId: string): Promise<PerformanceRunDto> {
  return apiRequest<PerformanceRunDto>(`/perf/runs/${runId}`);
}

export async function patchPerformanceRun(
  runId: string,
  payload: PatchPerformanceRunPayload,
): Promise<PerformanceRunDto> {
  return apiRequest<PerformanceRunDto>(`/perf/runs/${runId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function validatePerformanceImport(
  projectId: string,
  payload: { file: File },
): Promise<PerformancePreflightDto> {
  const formData = new FormData();
  formData.set("file", payload.file);
  const query = new URLSearchParams({ project_id: projectId });
  return apiRequest<PerformancePreflightDto>(`/perf/imports/validate?${query.toString()}`, {
    method: "POST",
    body: formData,
  });
}

export async function createPerformanceImport(
  projectId: string,
  payload: { file: File },
): Promise<PerformanceImportAcceptedDto> {
  const formData = new FormData();
  formData.set("file", payload.file);
  const query = new URLSearchParams({ project_id: projectId });
  return apiRequest<PerformanceImportAcceptedDto>(`/perf/imports?${query.toString()}`, {
    method: "POST",
    body: formData,
  });
}

export async function getPerformanceImport(importId: string): Promise<PerformanceImportDto> {
  return apiRequest<PerformanceImportDto>(`/perf/imports/${importId}`);
}

function extractFilename(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) return fallback;
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }
  const plainMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1] ?? fallback;
}

export interface PerformanceComparisonSnapshotDto {
  metric_key: string;
  runs: PerformanceRunDto[];
}

export interface PerformanceComparisonDto {
  id: string;
  project_id: string;
  name: string | null;
  base_run_id: string;
  compare_run_ids: string[];
  metric_key: string;
  snapshot: PerformanceComparisonSnapshotDto;
  public_token: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PerformanceComparisonPublicDto {
  id: string;
  name: string | null;
  metric_key: string;
  snapshot: PerformanceComparisonSnapshotDto;
  created_at: string;
}

export interface CreatePerformanceComparisonPayload {
  project_id: string;
  name?: string | null;
  base_run_id: string;
  compare_run_ids: string[];
  metric_key: string;
  public?: boolean;
}

export interface PatchPerformanceComparisonPayload {
  name?: string | null;
  public?: boolean;
}

export interface PerformanceComparisonListItemDto {
  id: string;
  project_id: string;
  name: string | null;
  base_run_id: string;
  compare_run_ids: string[];
  metric_key: string;
  run_count: number;
  public_token: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PerformanceComparisonsPageDto {
  items: PerformanceComparisonListItemDto[];
  page: number;
  page_size: number;
  has_next: boolean;
}

export type PerformanceComparisonVisibility = "public" | "project";

export async function getPerformanceComparisonsPage(params: {
  projectId: string;
  search?: string;
  visibility?: PerformanceComparisonVisibility;
  page?: number;
  pageSize?: number;
}): Promise<PerformanceComparisonsPageDto> {
  const query = new URLSearchParams();
  query.set("project_id", params.projectId);
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.visibility) query.set("visibility", params.visibility);
  if (typeof params.page === "number") query.set("page", String(params.page));
  if (typeof params.pageSize === "number") query.set("page_size", String(params.pageSize));
  return apiRequest<PerformanceComparisonsPageDto>(`/perf/comparisons?${query.toString()}`);
}

export async function createPerformanceComparison(
  payload: CreatePerformanceComparisonPayload,
): Promise<PerformanceComparisonDto> {
  return apiRequest<PerformanceComparisonDto>(`/perf/comparisons`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getPerformanceComparison(
  comparisonId: string,
): Promise<PerformanceComparisonDto> {
  return apiRequest<PerformanceComparisonDto>(`/perf/comparisons/${comparisonId}`);
}

export async function patchPerformanceComparison(
  comparisonId: string,
  payload: PatchPerformanceComparisonPayload,
): Promise<PerformanceComparisonDto> {
  return apiRequest<PerformanceComparisonDto>(`/perf/comparisons/${comparisonId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deletePerformanceComparison(comparisonId: string): Promise<void> {
  await apiFetch(`/perf/comparisons/${comparisonId}`, { method: "DELETE" });
}

export async function getPublicPerformanceComparison(
  token: string,
): Promise<PerformanceComparisonPublicDto> {
  return apiRequest<PerformanceComparisonPublicDto>(
    `/public/perf/comparisons/${encodeURIComponent(token)}`,
  );
}

export async function downloadPerformanceArtifact(artifactId: string, fallbackFilename: string): Promise<void> {
  const response = await apiFetch(`/performance-artifacts/${encodeURIComponent(artifactId)}`);
  const blob = await response.blob();
  const filename = extractFilename(response.headers.get("content-disposition"), fallbackFilename);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
