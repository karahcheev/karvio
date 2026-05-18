import { apiRequest } from "@/shared/api/client";
import type { MilestoneDto, MilestoneStatus, MilestoneSummaryDto } from "./types";

function buildMilestonesParams(filters?: {
  statuses?: MilestoneStatus[];
  search?: string;
  page?: number;
  pageSize?: number;
}): URLSearchParams {
  const params = new URLSearchParams();
  filters?.statuses?.forEach((status) => {
    if (status) params.append("status", status);
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
  return params;
}

export async function getMilestonesPage(params: {
  projectId: string;
  statuses?: MilestoneStatus[];
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  items: MilestoneDto[];
  page: number;
  page_size: number;
  has_next: boolean;
  total?: number;
}> {
  const query = buildMilestonesParams(params);
  query.set("project_id", params.projectId);
  return apiRequest<{
    items: MilestoneDto[];
    page: number;
    page_size: number;
    has_next: boolean;
    total?: number;
  }>(`/milestones?${query.toString()}`);
}

export async function getMilestone(milestoneId: string): Promise<MilestoneDto> {
  return apiRequest<MilestoneDto>(`/milestones/${milestoneId}`);
}

export async function getMilestoneSummary(milestoneId: string): Promise<MilestoneSummaryDto> {
  return apiRequest<MilestoneSummaryDto>(`/milestones/${milestoneId}/summary`);
}

export async function createMilestone(payload: {
  project_id: string;
  name: string;
  description?: string | null;
  status?: MilestoneStatus;
  start_date?: string | null;
  target_date?: string | null;
  completed_at?: string | null;
  owner_id?: string | null;
  release_label?: string | null;
}): Promise<MilestoneDto> {
  return apiRequest<MilestoneDto>("/milestones", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function patchMilestone(
  milestoneId: string,
  payload: {
    name?: string;
    description?: string | null;
    status?: MilestoneStatus;
    start_date?: string | null;
    target_date?: string | null;
    completed_at?: string | null;
    owner_id?: string | null;
    release_label?: string | null;
  }
): Promise<MilestoneDto> {
  return apiRequest<MilestoneDto>(`/milestones/${milestoneId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteMilestone(milestoneId: string): Promise<void> {
  await apiRequest<void>(`/milestones/${milestoneId}`, { method: "DELETE" });
}
