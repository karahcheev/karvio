import { apiRequest } from "@/shared/api/client";
import { fetchAllPageItems } from "./helpers";
import type { PlanGenerationConfigDto, PlanGenerationPreviewDto, TestPlanDto } from "./types";

function buildTestPlansParams(filters?: {
  page?: number;
  pageSize?: number;
  search?: string;
  tags?: string[];
  milestoneIds?: string[];
}): URLSearchParams {
  const params = new URLSearchParams();
  if (typeof filters?.page === "number") {
    params.set("page", String(filters.page));
  }
  if (typeof filters?.pageSize === "number") {
    params.set("page_size", String(filters.pageSize));
  }
  if (filters?.search?.trim()) {
    params.set("search", filters.search.trim());
  }
  if (filters?.tags?.length) {
    filters.tags.forEach((t) => params.append("tags", t));
  }
  if (filters?.milestoneIds?.length) {
    filters.milestoneIds.forEach((milestoneId) => {
      const normalized = milestoneId.trim();
      if (normalized) params.append("milestone_id", normalized);
    });
  }
  return params;
}

export async function getTestPlans(
  projectId: string,
  filters?: { page?: number; pageSize?: number; search?: string; tags?: string[]; milestoneIds?: string[] }
): Promise<TestPlanDto[]> {
  const params = buildTestPlansParams(filters);
  params.set("project_id", projectId);
  return fetchAllPageItems<TestPlanDto>("/test-plans", params);
}

export async function getTestPlanTags(projectId: string): Promise<{ items: string[] }> {
  const params = new URLSearchParams({ project_id: projectId });
  return apiRequest<{ items: string[] }>(`/test-plans/tags?${params.toString()}`);
}

export async function getTestPlansPage(params: {
  projectId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  tags?: string[];
  milestoneIds?: string[];
}): Promise<{
  items: TestPlanDto[];
  page: number;
  page_size: number;
  has_next: boolean;
  total?: number;
}> {
  const query = buildTestPlansParams(params);
  query.set("project_id", params.projectId);
  return apiRequest<{
    items: TestPlanDto[];
    page: number;
    page_size: number;
    has_next: boolean;
    total?: number;
  }>(`/test-plans?${query.toString()}`);
}

export async function getTestPlan(testPlanId: string): Promise<TestPlanDto> {
  return apiRequest<TestPlanDto>(`/test-plans/${testPlanId}`);
}

export async function createTestPlan(payload: {
  project_id: string;
  name: string;
  description?: string | null;
  tags?: string[];
  generation_source?: "manual" | "product_generated";
  generation_config?: PlanGenerationConfigDto | null;
  milestone_id?: string | null;
  suite_ids?: string[];
  case_ids?: string[];
}): Promise<TestPlanDto> {
  return apiRequest<TestPlanDto>("/test-plans", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function patchTestPlan(
  testPlanId: string,
  payload: {
    name?: string;
    description?: string | null;
    tags?: string[];
    generation_source?: "manual" | "product_generated";
    generation_config?: PlanGenerationConfigDto | null;
    milestone_id?: string | null;
    suite_ids?: string[];
    case_ids?: string[];
  }
): Promise<TestPlanDto> {
  return apiRequest<TestPlanDto>(`/test-plans/${testPlanId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function previewTestPlanGeneration(payload: {
  project_id: string;
  config: PlanGenerationConfigDto;
}): Promise<{ preview: PlanGenerationPreviewDto }> {
  return apiRequest("/test-plans/generate-preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteTestPlan(testPlanId: string): Promise<void> {
  await apiRequest<void>(`/test-plans/${testPlanId}`, {
    method: "DELETE",
  });
}

export async function createRunFromTestPlan(
  planId: string,
  payload: {
    name: string;
    description?: string | null;
    environment_id?: string;
    milestone_id?: string | null;
    build?: string | null;
    assignee?: string | null;
    start_immediately?: boolean;
  }
): Promise<import("./types").TestRunDto> {
  return apiRequest<import("./types").TestRunDto>(`/test-plans/${planId}/create-run`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
