import { apiRequest } from "@/shared/api/client";
import { fetchAllPageItems, type ApiSortDirection } from "./helpers";
import { clearCachedProjectMembers, getCachedProjectMembers, setCachedProjectMembers } from "./project-members-cache";
import type { ProjectDto, ProjectMemberDto, ProjectMemberRole } from "./types";

export type ProjectsSortBy = "created_at" | "id" | "name" | "members_count";
export type ProjectMembersSortBy = "created_at" | "role" | "username";

export async function getProjects(params?: {
  sortBy?: ProjectsSortBy;
  sortDirection?: ApiSortDirection;
}): Promise<ProjectDto[]> {
  const query = new URLSearchParams();
  if (params?.sortBy) query.set("sort_by", params.sortBy);
  if (params?.sortDirection) query.set("sort_order", params.sortDirection);
  return fetchAllPageItems<ProjectDto>("/projects", query);
}

export async function createProject(payload: {
  name: string;
  description?: string | null;
}): Promise<ProjectDto> {
  return apiRequest<ProjectDto>("/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getProject(projectId: string): Promise<ProjectDto> {
  return apiRequest<ProjectDto>(`/projects/${projectId}`);
}

export async function patchProject(
  projectId: string,
  payload: { name?: string; description?: string | null }
): Promise<ProjectDto> {
  return apiRequest<ProjectDto>(`/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  await apiRequest<void>(`/projects/${projectId}`, {
    method: "DELETE",
  });
}

export async function getProjectMembers(
  projectId: string,
  params?: { sortBy?: ProjectMembersSortBy; sortDirection?: ApiSortDirection }
): Promise<ProjectMemberDto[]> {
  const cached = getCachedProjectMembers(projectId, params);
  if (cached) {
    return cached;
  }
  const query = new URLSearchParams({
    project_id: projectId,
  });
  if (params?.sortBy) query.set("sort_by", params.sortBy);
  if (params?.sortDirection) query.set("sort_order", params.sortDirection);
  const items = await fetchAllPageItems<ProjectMemberDto>("/project-members", query);
  setCachedProjectMembers(projectId, items, params);
  return items;
}

export async function createProjectMember(payload: {
  project_id: string;
  user_id: string;
  role: ProjectMemberRole;
}): Promise<ProjectMemberDto> {
  const created = await apiRequest<ProjectMemberDto>("/project-members", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  clearCachedProjectMembers(payload.project_id);
  return created;
}

export async function patchProjectMember(
  projectMemberId: string,
  payload: { role: ProjectMemberRole }
): Promise<ProjectMemberDto> {
  const updated = await apiRequest<ProjectMemberDto>(`/project-members/${projectMemberId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  clearCachedProjectMembers(updated.project_id);
  return updated;
}

export async function deleteProjectMember(projectMemberId: string): Promise<void> {
  await apiRequest<void>(`/project-members/${projectMemberId}`, {
    method: "DELETE",
  });
  clearCachedProjectMembers();
}
