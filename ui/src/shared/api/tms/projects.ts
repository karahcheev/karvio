import { apiRequest } from "@/shared/api/client";
import { fetchAllPageItems, type ApiSortDirection } from "./helpers";
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
  const query = new URLSearchParams({
    project_id: projectId,
  });
  if (params?.sortBy) query.set("sort_by", params.sortBy);
  if (params?.sortDirection) query.set("sort_order", params.sortDirection);
  return await fetchAllPageItems<ProjectMemberDto>("/project-members", query);
}

export async function createProjectMember(payload: {
  project_id: string;
  user_id: string;
  role: ProjectMemberRole;
}): Promise<ProjectMemberDto> {
  return await apiRequest<ProjectMemberDto>("/project-members", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function patchProjectMember(
  projectMemberId: string,
  payload: { role: ProjectMemberRole }
): Promise<ProjectMemberDto> {
  return await apiRequest<ProjectMemberDto>(`/project-members/${projectMemberId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteProjectMember(projectMemberId: string): Promise<void> {
  await apiRequest<void>(`/project-members/${projectMemberId}`, {
    method: "DELETE",
  });
}
