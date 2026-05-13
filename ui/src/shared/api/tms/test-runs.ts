import { apiRequest } from "@/shared/api/client";
import { fetchAllPageItems } from "./helpers";
import type { JunitImportDto, TestRunDto } from "./types";

export type TestRunsSortBy = "created_at" | "name" | "status" | "build" | "environment";

function buildTestRunsParams(filters?: {
  statuses?: TestRunDto["status"][];
  environmentIds?: string[];
  milestoneIds?: string[];
  search?: string;
  createdBy?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: TestRunsSortBy;
  sortOrder?: "asc" | "desc";
}): URLSearchParams {
  const params = new URLSearchParams();
  filters?.statuses?.forEach((status) => {
    if (status) params.append("status", status);
  });
  filters?.environmentIds?.forEach((environmentId) => {
    const normalizedEnvironmentId = environmentId.trim();
    if (normalizedEnvironmentId) params.append("environment_id", normalizedEnvironmentId);
  });
  filters?.milestoneIds?.forEach((milestoneId) => {
    const normalizedMilestoneId = milestoneId.trim();
    if (normalizedMilestoneId) params.append("milestone_id", normalizedMilestoneId);
  });
  if (filters?.search?.trim()) {
    params.set("search", filters.search.trim());
  }
  if (filters?.createdBy) {
    params.set("created_by", filters.createdBy);
  }
  if (filters?.createdFrom) {
    params.set("created_from", filters.createdFrom);
  }
  if (filters?.createdTo) {
    params.set("created_to", filters.createdTo);
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

export async function getTestRuns(
  projectId: string,
  filters?: {
    statuses?: TestRunDto["status"][];
    environmentIds?: string[];
    milestoneIds?: string[];
    search?: string;
    createdBy?: string;
    createdFrom?: string;
    createdTo?: string;
    sortBy?: TestRunsSortBy;
    sortDirection?: "asc" | "desc";
  }
): Promise<TestRunDto[]> {
  const params = buildTestRunsParams({ ...filters, sortOrder: filters?.sortDirection });
  params.set("project_id", projectId);
  return fetchAllPageItems<TestRunDto>("/test-runs", params);
}

export async function getTestRunsPage(params: {
  projectId: string;
  statuses?: TestRunDto["status"][];
  environmentIds?: string[];
  milestoneIds?: string[];
  search?: string;
  createdBy?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: TestRunsSortBy;
  sortOrder?: "asc" | "desc";
}): Promise<{
  items: TestRunDto[];
  page: number;
  page_size: number;
  has_next: boolean;
  /** Total rows for current filters (same on every page). */
  total?: number;
}> {
  const query = buildTestRunsParams(params);
  query.set("project_id", params.projectId);
  return apiRequest<{
    items: TestRunDto[];
    page: number;
    page_size: number;
    has_next: boolean;
    total?: number;
  }>(`/test-runs?${query.toString()}`);
}

export async function createTestRun(payload: {
  project_id: string;
  name: string;
  description?: string | null;
  environment_id?: string;
  milestone_id?: string | null;
  build?: string | null;
  assignee?: string | null;
}): Promise<TestRunDto> {
  return apiRequest<TestRunDto>("/test-runs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getTestRun(testRunId: string): Promise<TestRunDto> {
  return apiRequest<TestRunDto>(`/test-runs/${testRunId}`);
}

export async function patchTestRun(
  testRunId: string,
  payload: {
    name?: string;
    description?: string | null;
    environment_id?: string;
    milestone_id?: string | null;
    build?: string | null;
    assignee?: string | null;
    status?: TestRunDto["status"];
    started_at?: string | null;
    completed_at?: string | null;
    archived_at?: string | null;
  }
): Promise<TestRunDto> {
  return apiRequest<TestRunDto>(`/test-runs/${testRunId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteTestRun(testRunId: string): Promise<void> {
  await apiRequest<void>(`/test-runs/${testRunId}`, {
    method: "DELETE",
  });
}

export async function importJunitXml(
  testRunId: string,
  payload: { file: File; dryRun?: boolean; createMissingCases?: boolean }
): Promise<JunitImportDto> {
  const query = new URLSearchParams();
  if (payload.dryRun !== undefined) {
    query.set("dry_run", String(payload.dryRun));
  }
  if (payload.createMissingCases !== undefined) {
    query.set("create_missing_cases", String(payload.createMissingCases));
  }
  const formData = new FormData();
  formData.set("file", payload.file);
  const suffix = query.toString();
  const queryPart = suffix ? `?${suffix}` : "";
  return apiRequest<JunitImportDto>(`/test-runs/${testRunId}/imports/junit${queryPart}`, {
    method: "POST",
    body: formData,
  });
}

export async function importProjectJunitXml(
  projectId: string,
  payload: { file: File; createMissingCases?: boolean }
): Promise<JunitImportDto> {
  const query = new URLSearchParams();
  if (payload.createMissingCases !== undefined) {
    query.set("create_missing_cases", String(payload.createMissingCases));
  }
  const formData = new FormData();
  formData.set("file", payload.file);
  const junitQuery = query.size ? `?${query.toString()}` : "";
  return apiRequest<JunitImportDto>(`/projects/${projectId}/imports/junit${junitQuery}`, {
    method: "POST",
    body: formData,
  });
}
