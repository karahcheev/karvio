import { apiRequest } from "@/shared/api/client";
import { fetchAllPageItems } from "./helpers";
import type { SuiteDto } from "./types";

function buildSuitesParams(filters?: {
  parentId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): URLSearchParams {
  const params = new URLSearchParams();
  if (filters?.parentId) {
    params.set("parent_id", filters.parentId);
  }
  if (filters?.search?.trim()) {
    params.set("search", filters.search.trim());
  }
  if (typeof filters?.page === "number") {
    params.set("page", String(filters.page));
  }
  if (typeof filters?.pageSize === "number") {
    params.set("page_size", String(filters.pageSize));
  }
  return params;
}

export async function getSuites(
  projectId: string,
  filters?: {
    parentId?: string;
    search?: string;
  }
): Promise<SuiteDto[]> {
  const params = buildSuitesParams(filters);
  params.set("project_id", projectId);
  return fetchAllPageItems<SuiteDto>("/suites", params);
}

export async function getSuitesPage(params: {
  projectId: string;
  parentId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: SuiteDto[]; page: number; page_size: number; has_next: boolean }> {
  const query = buildSuitesParams(params);
  query.set("project_id", params.projectId);
  return apiRequest<{ items: SuiteDto[]; page: number; page_size: number; has_next: boolean }>(`/suites?${query.toString()}`);
}

export async function createSuite(payload: {
  project_id: string;
  name: string;
  parent_id: string | null;
  description?: string | null;
}): Promise<SuiteDto> {
  return apiRequest<SuiteDto>("/suites", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getSuite(suiteId: string): Promise<SuiteDto> {
  return apiRequest<SuiteDto>(`/suites/${suiteId}`);
}

export async function patchSuite(
  suiteId: string,
  payload: {
    name?: string;
    parent_id?: string | null;
    description?: string | null;
    position?: number;
  }
): Promise<SuiteDto> {
  return apiRequest<SuiteDto>(`/suites/${suiteId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteSuite(suiteId: string): Promise<void> {
  await apiRequest<void>(`/suites/${suiteId}`, {
    method: "DELETE",
  });
}
