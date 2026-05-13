import { apiRequest } from "@/shared/api/client";
import { fetchAllPageItems, type ApiSortDirection } from "./helpers";
import type { UserDto } from "./types";

export type UsersSortBy =
  | "created_at"
  | "updated_at"
  | "id"
  | "username"
  | "email"
  | "team"
  | "project_count"
  | "is_enabled"
  | "last_login_at";

export async function getUsersPage(params: {
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: UsersSortBy;
  sortOrder?: ApiSortDirection;
}): Promise<{ items: UserDto[]; page: number; page_size: number; has_next: boolean }> {
  const query = new URLSearchParams();
  query.set("page", String(params.page ?? 1));
  query.set("page_size", String(params.pageSize ?? 50));
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.sortBy) query.set("sort_by", params.sortBy);
  if (params.sortOrder) query.set("sort_order", params.sortOrder);
  return apiRequest<{ items: UserDto[]; page: number; page_size: number; has_next: boolean }>(`/users?${query.toString()}`);
}

export async function getUsers(params?: {
  sortBy?: UsersSortBy;
  sortDirection?: ApiSortDirection;
}): Promise<UserDto[]> {
  const query = new URLSearchParams();
  if (params?.sortBy) query.set("sort_by", params.sortBy);
  if (params?.sortDirection) query.set("sort_order", params.sortDirection);
  return fetchAllPageItems<UserDto>("/users", query);
}

export async function createUser(payload: {
  username: string;
  password: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  team?: string | null;
}): Promise<UserDto> {
  return apiRequest<UserDto>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getUser(userId: string): Promise<UserDto> {
  return apiRequest<UserDto>(`/users/${userId}`);
}

export async function patchUser(
  userId: string,
  payload: {
    username?: string;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    team?: string | null;
    is_enabled?: boolean;
  }
): Promise<UserDto> {
  return apiRequest<UserDto>(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function setUserPassword(
  userId: string,
  payload: { new_password: string }
): Promise<void> {
  await apiRequest<void>(`/users/${userId}/password`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteUser(userId: string): Promise<void> {
  await apiRequest<void>(`/users/${userId}`, {
    method: "DELETE",
  });
}
