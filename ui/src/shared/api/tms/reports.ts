import { apiFetch, apiRequest } from "@/shared/api/client";

export type ProjectOverviewDto = {
  project_id: string;
  created_from: string | null;
  created_to: string | null;
  granularity?: "day" | "week" | "month";
  run_count: number;
  release_stats: {
    active_runs: number;
    total: number;
    passed: number;
    error: number;
    failure: number;
    blocked: number;
    skipped: number;
    untested: number;
    pass_rate: number;
  };
  pass_rate_trend: Array<{
    run_id: string;
    name: string;
    build: string | null;
    created_at: string;
    pass_rate: number;
    error: number;
    failure: number;
  }>;
  failures_by_run: Array<{
    run_id: string;
    category: string;
    error: number;
    failure: number;
  }>;
  execution_trend?: Array<{
    bucket_start: string;
    bucket_label: string;
    runs: number;
  }>;
  status_trend?: Array<{
    bucket_start: string;
    bucket_label: string;
    runs: number;
    total: number;
    passed: number;
    error: number;
    failure: number;
    blocked: number;
    skipped: number;
    in_progress: number;
    untested: number;
    xfailed: number;
    xpassed: number;
    pass_rate: number;
  }>;
  runs_by_environment?: Array<{
    environment: string;
    runs: number;
  }>;
  runs_by_build?: Array<{
    build: string;
    runs: number;
  }>;
  status_distribution: Array<{
    name:
      | "Passed"
      | "Error"
      | "Failure"
      | "Blocked"
      | "Skipped"
      | "In progress"
      | "Untested"
      | "XFailed"
      | "XPassed";
    value: number;
  }>;
  execution_by_assignee: Array<{
    assignee_id: string | null;
    assignee_name: string;
    executed: number;
  }>;
  recent_activity: Array<{
    id: string;
    name: string;
    status: string;
    build: string | null;
    updated_at: string;
  }>;
};

export type RunReportExportFormat = "json" | "pdf" | "xml";
export type OverviewExportFormat = "json" | "pdf" | "xml";

export type ProjectOverviewQueryFilters = {
  createdFrom?: string;
  createdTo?: string;
  sections?: string[];
  topN?: number;
  groupBy?: string;
  granularity?: "day" | "week" | "month";
  assigneeId?: string;
  suiteId?: string;
  environment?: string;
  build?: string;
  milestoneIds?: string[];
};

export async function getProjectOverview(
  projectId: string,
  filters?: ProjectOverviewQueryFilters,
): Promise<ProjectOverviewDto> {
  const params = new URLSearchParams();
  if (filters?.createdFrom) {
    params.set("created_from", filters.createdFrom);
  }
  if (filters?.createdTo) {
    params.set("created_to", filters.createdTo);
  }
  if (filters?.sections && filters.sections.length > 0) {
    params.set("sections", filters.sections.join(","));
  }
  if (typeof filters?.topN === "number" && Number.isFinite(filters.topN)) {
    params.set("top_n", String(Math.max(1, Math.floor(filters.topN))));
  }
  if (filters?.groupBy) {
    params.set("group_by", filters.groupBy);
  }
  if (filters?.granularity) {
    params.set("granularity", filters.granularity);
  }
  if (filters?.assigneeId) {
    params.set("assignee_id", filters.assigneeId);
  }
  if (filters?.suiteId) {
    params.set("suite_id", filters.suiteId);
  }
  if (filters?.environment) {
    params.set("environment", filters.environment);
  }
  if (filters?.build) {
    params.set("build", filters.build);
  }
  if (filters?.milestoneIds?.length) {
    filters.milestoneIds.forEach((milestoneId) => {
      const normalized = milestoneId.trim();
      if (normalized) params.append("milestone_id", normalized);
    });
  }
  const query = params.toString();
  return apiRequest<ProjectOverviewDto>(
    query ? `/projects/${projectId}/overview?${query}` : `/projects/${projectId}/overview`
  );
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

export async function downloadProjectOverviewExport(
  projectId: string,
  format: OverviewExportFormat,
  params: {
    createdFrom?: string;
    createdTo?: string;
    milestoneIds?: string[];
    topN?: number;
    granularity?: "day" | "week" | "month";
  },
): Promise<void> {
  const query = new URLSearchParams({ format });
  if (params.createdFrom) query.set("created_from", params.createdFrom);
  if (params.createdTo) query.set("created_to", params.createdTo);
  if (params.granularity) query.set("granularity", params.granularity);
  if (typeof params.topN === "number") query.set("top_n", String(params.topN));
  if (params.milestoneIds?.length) {
    for (const id of params.milestoneIds) {
      const normalized = id.trim();
      if (normalized) query.append("milestone_id", normalized);
    }
  }
  const response = await apiFetch(`/projects/${encodeURIComponent(projectId)}/overview/export?${query.toString()}`);
  const blob = await response.blob();
  const fallbackFilename = `project-${projectId}-overview.${format}`;
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

export async function downloadRunReport(testRunId: string, format: RunReportExportFormat): Promise<void> {
  const query = new URLSearchParams({ format });
  const response = await apiFetch(`/test-runs/${encodeURIComponent(testRunId)}/export?${query.toString()}`);
  const blob = await response.blob();
  const fallbackFilename = `test-run-${testRunId}-report.${format}`;
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
