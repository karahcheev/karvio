import { apiRequest } from "@/shared/api/client";
import type { EnvironmentDto, EnvironmentRevisionDto, EnvironmentTopologyDto } from "./types";

export type EnvironmentsSortBy = "created_at" | "updated_at" | "name";

function buildEnvironmentsParams(filters?: {
  projectId?: string;
  includeArchived?: boolean;
  search?: string;
  useCases?: string[];
  page?: number;
  pageSize?: number;
  sortBy?: EnvironmentsSortBy;
  sortOrder?: "asc" | "desc";
}): URLSearchParams {
  const params = new URLSearchParams();
  if (filters?.projectId) params.set("project_id", filters.projectId);
  if (typeof filters?.includeArchived === "boolean") {
    params.set("include_archived", String(filters.includeArchived));
  }
  if (filters?.search?.trim()) params.set("search", filters.search.trim());
  filters?.useCases?.forEach((u) => {
    const t = u.trim();
    if (t) params.append("use_case", t);
  });
  if (typeof filters?.page === "number") params.set("page", String(filters.page));
  if (typeof filters?.pageSize === "number") params.set("page_size", String(filters.pageSize));
  if (filters?.sortBy) params.set("sort_by", filters.sortBy);
  if (filters?.sortOrder) params.set("sort_order", filters.sortOrder);
  return params;
}

export async function getEnvironmentUseCases(projectId: string, includeArchived = false): Promise<{ items: string[] }> {
  const params = new URLSearchParams({ project_id: projectId, include_archived: String(includeArchived) });
  return apiRequest<{ items: string[] }>(`/environments/use-cases?${params.toString()}`);
}

export async function getEnvironmentsPage(params: {
  projectId: string;
  includeArchived?: boolean;
  search?: string;
  useCases?: string[];
  page?: number;
  pageSize?: number;
  sortBy?: EnvironmentsSortBy;
  sortOrder?: "asc" | "desc";
}): Promise<{
  items: EnvironmentDto[];
  page: number;
  page_size: number;
  has_next: boolean;
  total?: number;
}> {
  const query = buildEnvironmentsParams(params);
  return apiRequest(`/environments?${query.toString()}`);
}

export async function getEnvironment(environmentId: string): Promise<EnvironmentDto> {
  return apiRequest(`/environments/${environmentId}`);
}

export async function createEnvironment(payload: {
  project_id: string;
  name: string;
  kind?: string;
  status?: string;
  description?: string | null;
  tags?: string[];
  use_cases?: string[];
  topology?: EnvironmentTopologyDto;
  meta?: Record<string, unknown>;
  extra?: Record<string, unknown>;
}): Promise<EnvironmentDto> {
  return apiRequest("/environments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function patchEnvironment(
  environmentId: string,
  payload: {
    name?: string;
    kind?: string;
    status?: string;
    description?: string | null;
    tags?: string[];
    use_cases?: string[];
    topology?: EnvironmentTopologyDto;
    meta?: Record<string, unknown>;
    extra?: Record<string, unknown>;
  },
): Promise<EnvironmentDto> {
  return apiRequest(`/environments/${environmentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteEnvironment(environmentId: string): Promise<void> {
  await apiRequest(`/environments/${environmentId}`, { method: "DELETE" });
}

export async function getEnvironmentRevisionsPage(params: {
  environmentId: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  items: EnvironmentRevisionDto[];
  page: number;
  page_size: number;
  has_next: boolean;
}> {
  const query = new URLSearchParams();
  if (typeof params.page === "number") query.set("page", String(params.page));
  if (typeof params.pageSize === "number") query.set("page_size", String(params.pageSize));
  return apiRequest(`/environments/${params.environmentId}/revisions?${query.toString()}`);
}
