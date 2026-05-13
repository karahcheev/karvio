import { apiRequest } from "@/shared/api/client";
import { fetchAllPageItems } from "./helpers";
import type { RunCaseDetailDto, RunCaseDto, RunCaseRowDto } from "./types";

export type RunCasesSortBy =
  | "test_case_title"
  | "suite_name"
  | "status"
  | "assignee_name"
  | "last_executed_at";

function buildRunCasesParams(filters?: {
  testRunId?: string;
  projectId?: string;
  testCaseId?: string;
  statuses?: RunCaseDto["status"][];
  assigneeId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: RunCasesSortBy;
  sortOrder?: "asc" | "desc";
}): URLSearchParams {
  const params = new URLSearchParams();
  if (filters?.testRunId) params.set("test_run_id", filters.testRunId);
  if (filters?.projectId) params.set("project_id", filters.projectId);
  if (filters?.testCaseId) params.set("test_case_id", filters.testCaseId);
  filters?.statuses?.forEach((value) => params.append("status", value));
  if (filters?.assigneeId) params.set("assignee_id", filters.assigneeId);
  if (filters?.search?.trim()) params.set("search", filters.search.trim());
  if (typeof filters?.page === "number") params.set("page", String(filters.page));
  if (typeof filters?.pageSize === "number") params.set("page_size", String(filters.pageSize));
  if (filters?.sortBy) params.set("sort_by", filters.sortBy);
  if (filters?.sortOrder) params.set("sort_order", filters.sortOrder);
  return params;
}

export async function getRunCases(
  testRunId: string,
  filters?: {
    statuses?: RunCaseDto["status"][];
    assigneeId?: string;
    testCaseId?: string;
    search?: string;
    sortBy?: RunCasesSortBy;
    sortDirection?: "asc" | "desc";
  }
): Promise<RunCaseDto[]> {
  const params = buildRunCasesParams({
    testRunId,
    statuses: filters?.statuses,
    assigneeId: filters?.assigneeId,
    testCaseId: filters?.testCaseId,
    search: filters?.search,
    sortBy: filters?.sortBy,
    sortOrder: filters?.sortDirection,
  });
  return fetchAllPageItems<RunCaseDto>("/run-cases", params);
}

export async function getRunCasesPage(params: {
  testRunId: string;
  statuses?: RunCaseDto["status"][];
  assigneeId?: string;
  testCaseId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: RunCasesSortBy;
  sortDirection?: "asc" | "desc";
  sortOrder?: "asc" | "desc";
}): Promise<{ items: RunCaseDto[]; page: number; page_size: number; has_next: boolean }> {
  const query = buildRunCasesParams({
    testRunId: params.testRunId,
    statuses: params.statuses,
    assigneeId: params.assigneeId,
    testCaseId: params.testCaseId,
    search: params.search,
    page: params.page,
    pageSize: params.pageSize,
    sortBy: params.sortBy,
    sortOrder: params.sortDirection ?? params.sortOrder,
  });
  return apiRequest(`/run-cases?${query.toString()}`);
}

export async function getTestCaseRunCasesPage(params: {
  projectId: string;
  testCaseId: string;
  statuses?: RunCaseDto["status"][];
  assigneeId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: RunCasesSortBy;
  sortDirection?: "asc" | "desc";
  sortOrder?: "asc" | "desc";
}): Promise<{ items: RunCaseDto[]; page: number; page_size: number; has_next: boolean }> {
  const query = buildRunCasesParams({
    projectId: params.projectId,
    testCaseId: params.testCaseId,
    statuses: params.statuses,
    assigneeId: params.assigneeId,
    search: params.search,
    page: params.page,
    pageSize: params.pageSize,
    sortBy: params.sortBy,
    sortOrder: params.sortDirection ?? params.sortOrder,
  });
  return apiRequest(`/run-cases?${query.toString()}`);
}

export async function createRunCase(payload: {
  test_run_id: string;
  test_case_id: string;
  assignee_id?: string;
}): Promise<RunCaseDto> {
  return apiRequest<RunCaseDto>("/run-cases", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function bulkCreateRunCases(
  runId: string,
  payload: { test_case_ids?: string[]; suite_id?: string }
): Promise<RunCaseDto[]> {
  const result = await apiRequest<{ items: RunCaseDto[] }>("/run-cases/bulk", {
    method: "POST",
    body: JSON.stringify({ test_run_id: runId, ...payload }),
  });
  return result.items;
}

export async function getRunCase(
  runCaseId: string,
  params?: { historyPage?: number; historyPageSize?: number }
): Promise<RunCaseDetailDto> {
  const query = new URLSearchParams();
  if (params?.historyPage) query.set("history_page", String(params.historyPage));
  if (params?.historyPageSize) query.set("history_page_size", String(params.historyPageSize));
  const suffix = query.toString();
  return apiRequest<RunCaseDetailDto>(suffix ? `/run-cases/${runCaseId}?${suffix}` : `/run-cases/${runCaseId}`);
}

export async function patchRunCase(
  runCaseId: string,
  payload: {
    assignee_id?: string | null;
    comment?: string | null;
  }
): Promise<RunCaseDto> {
  return apiRequest<RunCaseDto>(`/run-cases/${runCaseId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getRunCaseRows(
  runCaseId: string,
  params?: { statuses?: RunCaseDto["status"][]; page?: number; pageSize?: number }
): Promise<{ items: RunCaseRowDto[]; page: number; page_size: number; has_next: boolean }> {
  const query = new URLSearchParams();
  params?.statuses?.forEach((status) => query.append("status", status));
  if (typeof params?.page === "number") query.set("page", String(params.page));
  if (typeof params?.pageSize === "number") query.set("page_size", String(params.pageSize));
  const suffix = query.toString();
  const queryPart = suffix ? `?${suffix}` : "";
  return apiRequest(`/run-cases/${runCaseId}/rows${queryPart}`);
}

export async function patchRunCaseRow(
  runCaseRowId: string,
  payload: {
    status?: RunCaseDto["status"];
    comment?: string | null;
    defect_ids?: string[];
    actual_result?: string | null;
    system_out?: string | null;
    system_err?: string | null;
    executed_by_id?: string | null;
    started_at?: string | null;
    finished_at?: string | null;
    duration_ms?: number | null;
  }
): Promise<RunCaseRowDto> {
  return apiRequest(`/run-cases/rows/${runCaseRowId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function rerunRunCase(
  runCaseId: string,
  payload: { mode: "failed" | "subset"; run_case_row_ids?: string[]; use_latest_revisions?: boolean }
): Promise<{ items: RunCaseRowDto[]; page: number; page_size: number; has_next: boolean }> {
  return apiRequest(`/run-cases/${runCaseId}/rerun`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteRunCase(runCaseId: string): Promise<void> {
  await apiRequest(`/run-cases/${runCaseId}`, {
    method: "DELETE",
  });
}
